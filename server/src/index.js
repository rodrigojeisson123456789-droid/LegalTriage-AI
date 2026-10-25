import "dotenv/config";
import { notifications } from "./notifications.js";
import { MailConfigError } from "./mail.js";
import { assignment, autoAssign } from "./assignment.js";
import { evaluations, publicResponses } from "./evaluations.js";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import multer from "multer";
import {
  validateDocument,
  analyzeDocument,
  DocumentError,
  MAX_DOCUMENT_BYTES,
  analysisErrorMessage,
} from "./documents.js";
import {
  publicClarifications,
  privateClarifications,
  withClarificationContext,
} from "./clarifications.js";
import { db } from "./db.js";
import {
  caseSchema,
  deadlineSchema,
  classify,
  urgency,
  categories,
} from "./domain.js";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET requiere al menos 32 caracteres");
const app = express();
app.use(helmet());
app.use(express.json({ limit: "96kb" }));
app.use(cookieParser());
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("sec-fetch-site") === "cross-site"
  )
    return res.sendStatus(403);
  next();
});
const limited = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.get("/api/health", async (req, res) => {
  await db.query("SELECT 1");
  res.json({ status: "ok" });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_BYTES,
    files: 1,
    fields: 7,
    fieldSize: 12000,
    parts: 8,
  },
});
app.post(
  "/api/cases",
  limited,
  upload.single("attachment"),
  async (req, res) => {
    const input = caseSchema.parse({
      ...req.body,
      consent: req.is("multipart/form-data")
        ? req.body.consent === "true"
        : req.body.consent,
    });
    const document = req.file ? await validateDocument(req.file) : null;
    const result = document
      ? await analyzeDocument(document, input.description)
      : null;
    const ai = document
      ? {
          specialty: result.analysis?.specialty || "Indeterminado",
          classification_status:
            result.status === "analyzed" ? "classified" : "unavailable",
        }
      : await classify(input.description);
    const connection = await db.getConnection();
    let id;
    try {
      await connection.beginTransaction();
      const [created] = await connection.execute(
        "INSERT INTO cases (name,document,email,phone,description,specialty,classification_status) VALUES (?,?,?,?,?,?,?)",
        [
          input.name,
          input.document,
          input.email,
          input.phone,
          input.description,
          ai.specialty,
          ai.classification_status,
        ],
      );
      id = created.insertId;
      if (document)
        await connection.execute(
          "INSERT INTO documents (case_id,original_name,mime_type,page_count,content,analysis_status,failure_reason,analysis,analyzed_at) VALUES (?,?,?,?,?,?,?,?,?)",
          [
            id,
            document.name,
            document.mime,
            document.pages,
            document.buffer,
            result.status,
            result.reason,
            result.analysis ? JSON.stringify(result.analysis) : null,
            result.analysis ? new Date() : null,
          ],
        );
      await autoAssign(connection, id);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.status(201).json({
      id,
      ...ai,
      status: "Nuevo",
      document_status: result?.status || null,
    });
  },
);
app.use("/api/clarifications", publicClarifications);
app.use("/api/responses", publicResponses);
app.post("/api/login", limited, async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().min(1).max(200) })
    .parse(req.body);
  const [users] = await db.execute("SELECT * FROM users WHERE email=?", [
    email.toLowerCase(),
  ]);
  const user = users[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Credenciales incorrectas" });
  res.cookie(
    "session",
    jwt.sign({ id: user.id, name: user.name }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    }),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 3600000,
    },
  );
  res.json({ id: user.id, name: user.name });
});
app.post("/api/logout", (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.sendStatus(204);
});
app.use("/api", (req, res, next) => {
  try {
    req.user = jwt.verify(req.cookies.session, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    next();
  } catch {
    res.status(401).json({ error: "Inicia sesión para continuar" });
  }
});
app.use("/api/cases", privateClarifications);
app.use("/api/cases", evaluations);
app.use("/api", assignment);
app.use("/api", notifications);
app.get("/api/me", (req, res) =>
  res.json({ id: req.user.id, name: req.user.name }),
);
app.get("/api/users", async (req, res) => {
  const [rows] = await db.query("SELECT id,name FROM users ORDER BY name");
  res.json(rows);
});
app.get("/api/cases", async (req, res) => {
  const [rows] = await db.query(
    "SELECT c.*,u.name AS lawyer_name FROM cases c LEFT JOIN users u ON u.id=c.lawyer_id ORDER BY c.created_at DESC LIMIT 500",
  );
  res.json(rows);
});
// Estas rutas están después del middleware de sesión. No hay directorio público de archivos.
app.get("/api/cases/:id/documents", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [rows] = await db.execute(
    "SELECT id,original_name,mime_type,page_count,analysis_status,failure_reason,analysis,analyzed_at FROM documents WHERE case_id=?",
    [id],
  );
  res.set("Cache-Control", "no-store").json(
    rows.map((row) => ({
      ...row,
      failure_message: row.failure_reason
        ? analysisErrorMessage(row.failure_reason)
        : null,
      analysis:
        typeof row.analysis === "string"
          ? JSON.parse(row.analysis)
          : row.analysis,
    })),
  );
});
app.get("/api/documents/:id/download", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [rows] = await db.execute(
    "SELECT original_name,mime_type,content FROM documents WHERE id=?",
    [id],
  );
  if (!rows.length)
    return res.status(404).json({ error: "Documento no encontrado" });
  res
    .set({
      "Content-Type": rows[0].mime_type,
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(rows[0].original_name)}`,
    })
    .send(rows[0].content);
});
app.post("/api/documents/:id/analyze", limited, async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [rows] = await db.execute(
    "SELECT d.*,c.description FROM documents d JOIN cases c ON c.id=d.case_id WHERE d.id=?",
    [id],
  );
  if (!rows.length)
    return res.status(404).json({ error: "Documento no encontrado" });
  const row = rows[0];
  const result = await analyzeDocument(
    { buffer: row.content, mime: row.mime_type, pages: row.page_count },
    await withClarificationContext(row.case_id, row.description),
  );
  // Conserva el análisis anterior, pero registra el diagnóstico del último intento.
  if (result.status !== "analyzed") {
    await db.execute("UPDATE documents SET failure_reason=? WHERE id=?", [
      result.reason,
      id,
    ]);
    console.warn("Gemini analysis unavailable:", result.reason);
    return res.status(503).json({
      error: analysisErrorMessage(result.reason),
      reason: result.reason,
    });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE documents SET analysis_status=?,failure_reason=NULL,analysis=?,analyzed_at=? WHERE id=?",
      [result.status, JSON.stringify(result.analysis), new Date(), id],
    );
    await connection.execute(
      "UPDATE cases SET specialty=?,classification_status=? WHERE id=?",
      [result.analysis.specialty, "classified", row.case_id],
    );
    await autoAssign(connection, row.case_id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.json(result);
});
app.patch("/api/cases/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z
    .object({
      status: z.enum(["Nuevo", "En evaluación"]).optional(),
      lawyer_id: z.number().int().positive().optional(),
      specialty: z.enum(categories).optional(),
    })
    .refine((v) => Object.keys(v).length > 0)
    .parse(req.body);
  if (input.lawyer_id) {
    const [users] = await db.execute("SELECT id FROM users WHERE id=?", [
      input.lawyer_id,
    ]);
    if (!users.length)
      return res.status(400).json({ error: "Abogado no encontrado" });
  }
  const [result] = await db.execute(
    "UPDATE cases SET status=COALESCE(?,status),lawyer_id=COALESCE(?,lawyer_id),specialty=COALESCE(?,specialty),classification_status=IF(? IS NULL,classification_status,'manual') WHERE id=? AND (? IS NULL OR status NOT IN ('En seguimiento judicial','Atención inicial cerrada'))",
    [
      input.status || null,
      input.lawyer_id || null,
      input.specialty || null,
      input.specialty || null,
      id,
      input.status || null,
    ],
  );
  if (!result.affectedRows) {
    const [existing] = await db.execute("SELECT id FROM cases WHERE id=?", [
      id,
    ]);
    return res.status(existing.length ? 409 : 404).json({
      error: existing.length
        ? "No se puede reabrir un caso con evaluación aprobada."
        : "Caso no encontrado",
    });
  }
  res.sendStatus(204);
});
app.get("/api/deadlines", async (req, res) => {
  const [rows] = await db.query(
    "SELECT d.*,c.name AS client_name FROM deadlines d JOIN cases c ON c.id=d.case_id ORDER BY d.due_at LIMIT 500",
  );
  res.json(rows.map((row) => ({ ...row, urgency: urgency(row.due_at) })));
});
app.post("/api/deadlines", async (req, res) => {
  const input = deadlineSchema.parse(req.body),
    connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [cases] = await connection.execute(
      "SELECT status FROM cases WHERE id=? FOR UPDATE",
      [input.case_id],
    );
    if (!cases.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Caso no encontrado" });
    }
    if (cases[0].status === "Atención inicial cerrada") {
      await connection.rollback();
      return res.status(409).json({
        error: "No se puede registrar un plazo en una atención cerrada.",
      });
    }
    const [result] = await connection.execute(
      "INSERT INTO deadlines (case_id,title,due_at,created_by) VALUES (?,?,?,?)",
      [input.case_id, input.title, new Date(input.due_at), req.user.id],
    );
    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
app.use((err, req, res, next) => {
  if (err instanceof MailConfigError)
    return res.status(503).json({ error: err.message });
  if (err instanceof multer.MulterError)
    return res.status(400).json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "El archivo supera el límite de 8 MB."
          : "Adjunta un solo documento y respeta los límites del formulario.",
    });
  if (err instanceof DocumentError)
    return res.status(400).json({ error: err.message });
  if (err instanceof z.ZodError)
    return res.status(400).json({
      error: "Revisa los datos ingresados",
      details: err.issues.map((i) => i.message),
    });
  console.error("Request failed:", err.code || err.name);
  res
    .status(500)
    .json({ error: "No se pudo completar la operación. Intenta nuevamente." });
});
app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("LegalTriage API iniciada"),
);
