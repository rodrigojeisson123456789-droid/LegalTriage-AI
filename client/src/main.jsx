import { isTeamPath, viewPath, teamView } from "./portal-route.js";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Scale,
  Users,
  KeyRound,
  LayoutDashboard,
  Clock3,
  ArrowUpRight,
  Plus,
  Search,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  FileText,
} from "lucide-react";
import "./style.css";
import "./design.css";
import { SessionRequests } from "./session.js";
import { ClarificationManager, ClarificationReply } from "./Clarifications.jsx";
import Evaluation, { ClientResponse } from "./Evaluation.jsx";
import Team from "./Team.jsx";
import Account from "./Account.jsx";
import CaseHistory from "./CaseHistory.jsx";
import DocumentReview from "./DocumentReview.jsx";
async function api(path, options = {}) {
  const r = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const error = new Error(d.error || "No se pudo conectar con el servidor");
    error.status = r.status;
    error.path = path;
    throw error;
  }
  return r.status === 204 ? null : r.json();
}
const date = (v) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(v));
function App() {
  const portal = isTeamPath(window.location.pathname);
  const sessionRequests = useRef(new SessionRequests());
  const identity = useRef(null);
  const [view, setView] = useState(portal ? "login" : "public"),
    [user, setUser] = useState(null),
    [cases, setCases] = useState([]),
    [deadlines, setDeadlines] = useState([]),
    [users, setUsers] = useState([]),
    [error, setError] = useState(""),
    [sessionNotice, setSessionNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(null),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(false),
    [documentCase, setDocumentCase] = useState(null),
    [historyCase, setHistoryCase] = useState(null),
    [clarificationCase, setClarificationCase] = useState(null),
    [evaluationCase, setEvaluationCase] = useState(null),
    [deadlineCase, setDeadlineCase] = useState(null),
    [attachmentName, setAttachmentName] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  function replaceSession(nextUser) {
    sessionRequests.current.invalidate();
    identity.current = nextUser;
    setUser(nextUser);
    setCases([]);
    setDeadlines([]);
    setUsers([]);
    setSearch("");
    setDeadlineCase(null);
    setDocumentCase(null);
    setHistoryCase(null);
    setClarificationCase(null);
    setEvaluationCase(null);
    setModal(false);
    setError("");
    setSessionNotice("");
    setBusy(false);
    setShowPassword(false);
  }
  function expiredSession() {
    replaceSession(null);
    setView("login");
    window.history.replaceState({}, "", viewPath("login"));
    setError("Tu sesión terminó. Vuelve a iniciar sesión.");
  }
  async function load() {
    if (!identity.current) return;
    const request = sessionRequests.current.start();
    try {
      const [c, d, u, me] = await Promise.all([
        api("/cases", { signal: request.signal }),
        api("/deadlines", { signal: request.signal }),
        api("/users", { signal: request.signal }),
        api("/me", { signal: request.signal }),
      ]);
      if (!request.isCurrent()) return;
      if (
        me.id !== identity.current?.id ||
        me.role !== identity.current?.role
      ) {
        replaceSession(me);
        setView("dashboard");
        return;
      }
      setCases(c);
      setDeadlines(d);
      setUsers(u);
      identity.current = me;
      setUser((previous) =>
        previous?.id === me.id &&
        previous?.role === me.role &&
        previous?.name === me.name
          ? previous
          : me,
      );
    } catch (e) {
      if (!request.isCurrent() || e.name === "AbortError") return;
      if (e.status === 401) {
        expiredSession();
        return;
      }
      throw e;
    } finally {
      request.finish();
    }
  }
  useEffect(() => {
    if (!portal) return;
    const request = sessionRequests.current.start();
    api("/me", { signal: request.signal })
      .then((me) => {
        if (request.isCurrent()) {
          identity.current = me;
          setUser(me);
          const next = teamView(window.location.pathname);
          setView(next);
          window.history.replaceState({}, "", viewPath(next));
        }
      })
      .catch((e) => {
        if (request.isCurrent() && e.status === 401)
          window.history.replaceState({}, "", viewPath("login"));
      })
      .finally(() => request.finish());
    return () => request.cancel();
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () =>
      load().catch((e) => {
        if (active) setError(e.message);
      });
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (user?.role !== "gerencia" && view === "team") setView("dashboard");
  }, [user?.role, view]);
  async function act(fn) {
    const version = sessionRequests.current.version;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (version === sessionRequests.current.version) {
        if (e.status === 401 && e.path !== "/login") expiredSession();
        else if (e.name !== "AbortError") setError(e.message);
      }
    } finally {
      if (version === sessionRequests.current.version) setBusy(false);
    }
  }
  function change(v) {
    if ((v === "public" && portal) || (v === "login" && !portal)) {
      window.location.assign(viewPath(v));
      return;
    }
    window.history.pushState({}, "", viewPath(v));
    setError("");
    setSessionNotice("");
    setView(v);
  }
  useEffect(() => {
    const update = () => {
      setError("");
      setView(
        portal
          ? identity.current
            ? teamView(window.location.pathname)
            : "login"
          : "public",
      );
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [portal]);
  const input = (label, name, type = "text", extra = {}) => (
    <label>
      {label}
      <input name={name} type={type} required {...extra} />
    </label>
  );
  const canManage = user?.role === "gerencia";
  const canLegal = ["gerencia", "abogado"].includes(user?.role);
  const canAssign = ["gerencia", "soporte"].includes(user?.role);
  const alerts = deadlines.filter(
    (d) => d.urgency === "Crítico" || d.urgency === "Próximo",
  );
  return (
    <div
      className={`shell ${!portal ? "shell-public" : view === "login" ? "shell-login" : "shell-team"}`}
    >
      <aside>
        <a
          className="brand"
          href={portal ? viewPath(user ? "dashboard" : "login") : "/consulta"}
          onClick={(e) => {
            e.preventDefault();
            change(portal ? (user ? "dashboard" : "login") : "public");
          }}
        >
          <span className="brand-icon">
            <Scale size={25} />
          </span>
          <span>
            LegalTriage <b>AI</b>
            <small>NÚÑEZ SALDAÑA S.A.C.</small>
          </span>
        </a>
        <div className="workspace">ESPACIO DE TRABAJO</div>
        <nav>
          {!portal && (
            <button
              className={view === "public" ? "active" : ""}
              onClick={() => change("public")}
            >
              <Plus size={18} /> Nueva consulta
            </button>
          )}
          {portal && (
            <>
              <button
                className={view === "dashboard" ? "active" : ""}
                onClick={() => change(user ? "dashboard" : "login")}
              >
                <LayoutDashboard size={18} /> Consultas{" "}
                <span>{user ? cases.length : "↗"}</span>
              </button>
              <button
                className={view === "deadlines" ? "active" : ""}
                onClick={() => change(user ? "deadlines" : "login")}
              >
                <Clock3 size={18} /> Control de plazos{" "}
                {user && alerts.length > 0 && <span>{alerts.length}</span>}
              </button>
              {canManage && (
                <button
                  className={view === "team" ? "active" : ""}
                  onClick={() => change(user ? "team" : "login")}
                >
                  <Users size={18} /> Equipo
                </button>
              )}
              {user && (
                <button
                  className={view === "account" ? "active" : ""}
                  onClick={() => change("account")}
                >
                  <KeyRound size={18} /> Mi cuenta
                </button>
              )}
            </>
          )}
        </nav>
        <div className="aside-bottom">
          <div className="secure">
            <ShieldCheck size={18} />
            <span>
              Confidencialidad primero<small>Tu información, protegida.</small>
            </span>
          </div>
          {portal && (
            <button
              disabled={busy}
              onClick={() => {
                if (user) {
                  act(async () => {
                    await api("/logout", { method: "POST" });
                    replaceSession(null);
                    change("login");
                  });
                } else change("login");
              }}
            >
              {user ? <LogOut size={16} /> : <BriefcaseBusiness size={16} />}{" "}
              {user
                ? `${user.name} · ${user.role === "gerencia" ? "Gerencia" : user.role === "abogado" ? "Abogado" : "Soporte"} · Salir`
                : "Acceso del equipo"}
            </button>
          )}
        </div>
      </aside>
      <div className="main">
        <header>
          <span>
            Estudio jurídico <span className="slash">/</span>{" "}
            <strong>
              {view === "public"
                ? "Recepción de consultas"
                : view === "deadlines"
                  ? "Control de plazos"
                  : view === "login"
                    ? "Acceso privado"
                    : view === "team"
                      ? "Equipo y especialidades"
                      : view === "account"
                        ? "Mi cuenta"
                        : "Panel de consultas"}
            </strong>
          </span>
          <span className="header-note">
            <span className="dot" /> Portal de atención legal
          </span>
        </header>
        <main>
          {sessionNotice && (
            <div className="notice" role="status">
              {sessionNotice}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {view === "public" && (
            <>
              <div className="eyebrow">
                ASESORÍA LEGAL, CON UN PRIMER PASO MÁS SIMPLE
              </div>
              <h1>
                Cuéntanos cómo podemos ayudarte<span>.</span>
              </h1>
              <p className="intro">
                Cada consulta merece la atención correcta. Comparte tu caso y
                nuestro equipo
                <br className="desktop" /> lo orientará al especialista que
                necesitas.
              </p>
              <div className="public-grid">
                <section className="card">
                  <div className="card-heading">
                    <span className="icon-box">
                      <BriefcaseBusiness size={21} />
                    </span>
                    <div>
                      <h2>Nueva consulta legal</h2>
                      <p>Completa tus datos para comenzar.</p>
                    </div>
                    <span className="step">Datos y consulta</span>
                  </div>
                  {receipt ? (
                    <div className="success">
                      <CheckCircle2 size={42} />
                      <h2>Recibimos tu consulta</h2>
                      <p>
                        Tu número de caso es #{receipt.id}. El equipo revisará
                        tu solicitud.
                      </p>
                      <p>
                        Especialidad: {receipt.specialty}
                        {receipt.classification_status === "unavailable"
                          ? " · Pendiente de revisión manual"
                          : ""}
                      </p>
                      {receipt.document_status && (
                        <p>
                          {receipt.document_status === "analyzed"
                            ? "Documento recibido y analizado para revisión del abogado."
                            : "Documento guardado; el análisis queda pendiente de revisión."}
                        </p>
                      )}
                      <button onClick={() => setReceipt(null)}>
                        Enviar otra consulta
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        data.set(
                          "consent",
                          data.get("consent") === "on" ? "true" : "false",
                        );
                        if (!data.get("attachment")?.size)
                          data.delete("attachment");
                        act(async () => {
                          setReceipt(
                            await api("/cases", { method: "POST", body: data }),
                          );
                          setAttachmentName("");
                        });
                      }}
                    >
                      <div className="section-label">
                        01 <span>INFORMACIÓN DE CONTACTO</span>
                      </div>
                      <div className="fields">
                        {input("Nombre completo", "name", "text", {
                          placeholder: "Ej. María García López",
                          minLength: 3,
                          maxLength: 120,
                        })}
                        {input("DNI o RUC", "document", "text", {
                          placeholder: "8 u 11 dígitos",
                          pattern: "[0-9]{8}|[0-9]{11}",
                          inputMode: "numeric",
                        })}
                        {input("Correo electrónico", "email", "email", {
                          placeholder: "nombre@correo.com",
                          maxLength: 254,
                        })}
                        {input("Teléfono de contacto", "phone", "tel", {
                          placeholder: "+51 999 999 999",
                          pattern: "[+0-9 ()-]{7,25}",
                        })}
                      </div>
                      <div className="section-label second">
                        02 <span>DETALLES DE TU CONSULTA</span>
                      </div>
                      <label>
                        Descripción de la consulta
                        <textarea
                          name="description"
                          required
                          minLength={20}
                          maxLength={10000}
                          placeholder="Describe tu situación, los hechos más relevantes y cómo te gustaría que te ayudemos…"
                          rows={6}
                        />
                      </label>
                      <div className="help">
                        Incluye los detalles relevantes. Evita compartir
                        contraseñas o datos bancarios.
                      </div>
                      <div className="attachment-field">
                        <label>
                          Documento de apoyo (opcional)
                          <input
                            type="file"
                            name="attachment"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && file.size > 8 * 1024 * 1024) {
                                e.target.value = "";
                                setAttachmentName("");
                                setError("El documento no debe superar 8 MB.");
                                return;
                              }
                              setError("");
                              setAttachmentName(file?.name || "");
                            }}
                          />
                        </label>
                        <p className="help">
                          Un PDF de hasta 50 páginas, JPG o PNG. Máximo 8 MB.
                          Sube una copia legible y sin contraseña.
                        </p>
                        {attachmentName && (
                          <p className="help">Seleccionado: {attachmentName}</p>
                        )}
                      </div>
                      <label className="consent">
                        <input type="checkbox" name="consent" required />
                        <span>
                          Autorizo el tratamiento de mis datos y el envío de mi
                          consulta y documento adjunto a Google Gemini para su
                          análisis y clasificación y atención por Núñez Saldaña
                          S.A.C.
                        </span>
                      </label>
                      <div className="form-footer">
                        <span>
                          <ShieldCheck size={15} /> Envío seguro y confidencial
                        </span>
                        <button className="primary" disabled={busy}>
                          {busy ? "Enviando y analizando…" : "Enviar consulta"}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </form>
                  )}
                </section>
                <div className="right-column">
                  <section className="guidance">
                    <div className="eyebrow">UN PROCESO MÁS ÁGIL</div>
                    <h2>
                      Tu consulta, en
                      <br />
                      las manos correctas.
                    </h2>
                    <p>
                      Combinamos tecnología y experiencia legal para entender tu
                      necesidad desde el primer contacto.
                    </p>
                    {[
                      [
                        "01",
                        "Cuéntanos tu situación",
                        "Completa el formulario con los detalles de tu caso.",
                      ],
                      [
                        "02",
                        "Identificamos la especialidad",
                        "La inteligencia artificial nos ayuda a orientar tu consulta.",
                      ],
                      [
                        "03",
                        "Nuestro equipo la evalúa",
                        "Un profesional revisará tu caso y los siguientes pasos.",
                      ],
                    ].map(([n, t, d]) => (
                      <div className="process" key={n}>
                        <span>{n}</span>
                        <div>
                          <h3>{t}</h3>
                          <p>{d}</p>
                        </div>
                      </div>
                    ))}
                    <div className="guidance-foot">
                      <Scale size={20} />
                      <span>Tecnología al servicio de la justicia.</span>
                    </div>
                  </section>
                  <section className="specialties">
                    <h3>Áreas de atención</h3>
                    <div>
                      {[
                        "Civil",
                        "Corporativo",
                        "Familia",
                        "Bancario",
                        "Laboral",
                        "Penal",
                      ].map((x) => (
                        <span key={x}>
                          {x}
                          <ArrowUpRight size={12} />
                        </span>
                      ))}
                    </div>
                    <p>
                      La clasificación inicial es orientativa y será revisada
                      por un profesional.
                    </p>
                  </section>
                </div>
              </div>
            </>
          )}
          {view === "login" && (
            <div className="login-layout">
              <section
                className="login-story"
                aria-label="Espacio del equipo jurídico"
              >
                <span className="story-symbol">
                  <Scale size={42} strokeWidth={1.25} />
                </span>
                <div className="eyebrow">ESPACIO DEL EQUIPO JURÍDICO</div>
                <h2>
                  Cada caso merece
                  <br />
                  toda tu atención.
                </h2>
                <p>
                  Un espacio para organizar tus consultas, revisar documentos y
                  acompañar cada etapa de la atención.
                </p>
                <ul>
                  <li>
                    <FileText size={19} /> Documentos y versiones a mano
                  </li>
                  <li>
                    <Users size={19} /> Un responsable para cada caso
                  </li>
                  <li>
                    <Clock3 size={19} /> Seguimiento de fechas y plazos
                  </li>
                </ul>
                <div className="story-signature">
                  NÚÑEZ SALDAÑA S.A.C.
                  <span>Gestión legal con criterio humano.</span>
                </div>
              </section>
              <section className="card login">
                <div className="eyebrow">ACCESO DEL EQUIPO</div>
                <h1>Bienvenido de nuevo.</h1>
                <p>Ingresa con tu cuenta del estudio jurídico.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    replaceSession(null);
                    act(async () => {
                      replaceSession(
                        await api("/login", {
                          method: "POST",
                          body: JSON.stringify(data),
                        }),
                      );
                      change("dashboard");
                    });
                  }}
                >
                  {input("Correo electrónico", "email", "email", {
                    autoComplete: "username",
                    placeholder: "tu.correo@estudio.com",
                  })}
                  <div className="login-password">
                    {input(
                      "Contraseña",
                      "password",
                      showPassword ? "text" : "password",
                      {
                        autoComplete: "current-password",
                        placeholder: "Ingresa tu contraseña",
                      },
                    )}
                    <button
                      type="button"
                      className="password-visibility"
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  <button className="primary" disabled={busy}>
                    {busy ? "Ingresando…" : "Ingresar"} <ArrowRight size={17} />
                  </button>
                </form>
                <p className="login-note">
                  <ShieldCheck size={16} />
                  Acceso exclusivo para cuentas del estudio. Si necesitas ayuda
                  con tu cuenta, contacta a Gerencia.
                </p>
              </section>
            </div>
          )}
          {user && view === "account" && (
            <Account
              api={api}
              user={user}
              onPasswordChanged={() => {
                replaceSession(null);
                change("login");
                setSessionNotice(
                  "Contraseña actualizada. Inicia sesión con tu nueva clave.",
                );
              }}
            />
          )}
          {user && canManage && view === "team" && (
            <Team api={api} user={user} />
          )}
          {user && view === "dashboard" && (
            <>
              <div className="eyebrow">GESTIÓN DEL ESTUDIO</div>
              <h1>
                Panel de consultas<span>.</span>
              </h1>
              <p className="intro">
                Una visión clara de cada caso, desde el primer contacto.
              </p>
              <div className="stats">
                {[
                  ["Consultas recibidas", cases.length],
                  [
                    "Pendientes de evaluación",
                    cases.filter((c) => c.status === "Nuevo").length,
                  ],
                  [
                    "En evaluación",
                    cases.filter((c) => c.status === "En evaluación").length,
                  ],
                  ["Plazos en las próximas 48 h", alerts.length],
                ].map(([l, n]) => (
                  <div className="card" key={l}>
                    <span>{l}</span>
                    <strong>{n}</strong>
                  </div>
                ))}
              </div>
              <section className="card table-card">
                <div className="table-heading">
                  <h2>Consultas entrantes</h2>
                  <label className="search">
                    <Search size={16} />
                    <input
                      placeholder="Buscar cliente o especialidad"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Fecha / caso",
                          "Cliente",
                          "Consulta",
                          "Especialidad",
                          "Estado",
                          "Responsable",
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cases
                        .filter((c) =>
                          (c.name + " " + c.specialty)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((c) => (
                          <tr key={c.id}>
                            <td>
                              <b>#{c.id}</b>
                              <small>{date(c.created_at)}</small>
                            </td>
                            <td>
                              <b>{c.name}</b>
                              <small>{c.email}</small>
                              <small>{c.phone}</small>
                            </td>
                            <td className="description">
                              {c.description}
                              <button
                                className="text-button"
                                onClick={() => setDocumentCase(c.id)}
                              >
                                Ver documentos y análisis →
                              </button>
                            </td>
                            <td>
                              <select
                                aria-label={"Especialidad del caso " + c.id}
                                value={c.specialty}
                                disabled={busy}
                                onChange={(e) => {
                                  const specialty = e.target.value;
                                  act(async () => {
                                    await api("/cases/" + c.id, {
                                      method: "PATCH",
                                      body: JSON.stringify({ specialty }),
                                    });
                                    await load();
                                  });
                                }}
                              >
                                {[
                                  "Civil",
                                  "Corporativo",
                                  "Familia",
                                  "Bancario",
                                  "Laboral",
                                  "Penal",
                                  "Indeterminado",
                                ].map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                              {c.classification_status === "manual" && (
                                <small>
                                  Especialidad revisada por el equipo
                                </small>
                              )}
                              {c.classification_status === "unavailable" && (
                                <small>Revisión manual pendiente</small>
                              )}
                            </td>
                            <td>
                              <span className="status">{c.status}</span>
                              <button
                                className="text-button"
                                onClick={() => setHistoryCase(c.id)}
                              >
                                Historial del caso →
                              </button>
                              {canLegal && (
                                <button
                                  className="text-button"
                                  onClick={() => setEvaluationCase(c.id)}
                                >
                                  Evaluación y respuesta →
                                </button>
                              )}
                              <button
                                className="text-button"
                                onClick={() => setClarificationCase(c.id)}
                              >
                                Aclaraciones →
                              </button>
                              {c.status === "Nuevo" && (
                                <button
                                  disabled={busy}
                                  className="text-button"
                                  onClick={() =>
                                    act(async () => {
                                      await api("/cases/" + c.id, {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          status: "En evaluación",
                                        }),
                                      });
                                      await load();
                                    })
                                  }
                                >
                                  Mover a evaluación →
                                </button>
                              )}
                            </td>
                            <td>
                              {!c.lawyer_id && canAssign && (
                                <>
                                  <small>Pendiente de asignación</small>
                                  {c.status !== "Atención inicial cerrada" && (
                                    <button
                                      className="text-button"
                                      disabled={busy}
                                      onClick={() =>
                                        act(async () => {
                                          await api(
                                            `/cases/${c.id}/auto-assign`,
                                            { method: "POST" },
                                          );
                                          await load();
                                        })
                                      }
                                    >
                                      Asignar automáticamente
                                    </button>
                                  )}
                                </>
                              )}
                              <select
                                aria-label={"Asignar abogado al caso " + c.id}
                                value={c.lawyer_id || ""}
                                disabled={busy || !canAssign}
                                onChange={(e) => {
                                  const lawyer_id = Number(e.target.value);
                                  act(async () => {
                                    await api("/cases/" + c.id, {
                                      method: "PATCH",
                                      body: JSON.stringify({ lawyer_id }),
                                    });
                                    await load();
                                  });
                                }}
                              >
                                <option value="" disabled>
                                  Asignar abogado
                                </option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!cases.length && (
                    <div className="empty">
                      Aún no hay consultas. Las nuevas solicitudes aparecerán
                      aquí.
                    </div>
                  )}
                </div>
                <div className="table-note">
                  Se muestran hasta las 500 consultas más recientes.
                </div>
              </section>
            </>
          )}
          {user && view === "deadlines" && (
            <>
              <div className="eyebrow">ALERTAS TEMPRANAS</div>
              <div className="title-row">
                <h1>
                  Control de plazos<span>.</span>
                </h1>
                {canLegal && (
                  <button
                    className="primary"
                    onClick={() => {
                      setDeadlineCase(null);
                      setModal(true);
                    }}
                  >
                    <Plus size={17} /> Nuevo plazo
                  </button>
                )}
              </div>
              <p className="intro">
                Anticípate a cada vencimiento. Fechas mostradas en hora de Lima.
              </p>
              <div className="notice">
                <Clock3 size={19} /> {alerts.length} plazo(s) requieren atención
                en las próximas 48 horas. Las alertas se actualizan cada minuto.
              </div>
              <section className="card table-card">
                <div className="table-heading">
                  <h2>Agenda procesal</h2>
                  <span>Audiencias y escritos</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Caso",
                          "Cliente",
                          "Actuación procesal",
                          "Fecha límite · Lima",
                          "Alerta",
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deadlines.map((d) => (
                        <tr key={d.id}>
                          <td>#{d.case_id}</td>
                          <td>{d.client_name}</td>
                          <td>{d.title}</td>
                          <td>{date(d.due_at)}</td>
                          <td>
                            <span
                              className={
                                "tag " +
                                ({
                                  Crítico: "red",
                                  Vencido: "red",
                                  Próximo: "amber",
                                }[d.urgency] || "")
                              }
                            >
                              {d.urgency}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!deadlines.length && (
                    <div className="empty">
                      Sin plazos registrados. Agrega el primer plazo de un caso.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          {user && historyCase && (
            <CaseHistory
              caseId={historyCase}
              api={api}
              onClose={() => setHistoryCase(null)}
            />
          )}
          {user && canLegal && evaluationCase && (
            <Evaluation
              caseId={evaluationCase}
              api={api}
              onClose={() => {
                setEvaluationCase(null);
                load().catch((e) => setError(e.message));
              }}
              onRefresh={load}
              onDeadlines={() => {
                setDeadlineCase(evaluationCase);
                setEvaluationCase(null);
                setModal(true);
                change("deadlines");
              }}
            />
          )}
          {user && clarificationCase && (
            <ClarificationManager
              caseId={clarificationCase}
              api={api}
              onClose={() => {
                setClarificationCase(null);
                load().catch((e) => setError(e.message));
              }}
              onRefresh={load}
            />
          )}
          {user && documentCase && (
            <DocumentReview
              caseId={documentCase}
              api={api}
              onClose={() => setDocumentCase(null)}
              onRefresh={load}
            />
          )}
          {user && canLegal && modal && (
            <div className="overlay">
              <section
                className="card modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
              >
                <h2 id="modal-title">Registrar plazo procesal</h2>
                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    act(async () => {
                      await api("/deadlines", {
                        method: "POST",
                        body: JSON.stringify({
                          case_id: Number(data.case_id),
                          title: data.title,
                          due_at: new Date(
                            data.due_at + "-05:00",
                          ).toISOString(),
                        }),
                      });
                      await load();
                      setModal(false);
                    });
                  }}
                >
                  <label>
                    Caso
                    <select
                      name="case_id"
                      required
                      defaultValue={deadlineCase || ""}
                    >
                      <option value="">Selecciona un caso</option>
                      {cases
                        .filter((c) => c.status !== "Atención inicial cerrada")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.id} · {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {input("Audiencia o escrito", "title", "text", {
                    maxLength: 200,
                    minLength: 3,
                  })}
                  {input(
                    "Fecha y hora límite (Lima, UTC−5)",
                    "due_at",
                    "datetime-local",
                  )}
                  <div className="form-footer">
                    <button
                      type="button"
                      onClick={() => {
                        setModal(false);
                        setError("");
                      }}
                    >
                      Cancelar
                    </button>
                    <button className="primary" disabled={busy}>
                      Guardar plazo
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
          <footer>
            <span>© {new Date().getFullYear()} Núñez Saldaña S.A.C.</span>
            <span>Atención legal con criterio humano.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Root() {
  useEffect(() => {
    if (window.location.pathname === "/" && !window.location.hash)
      window.history.replaceState({}, "", "/consulta");
  }, []);
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const responseMatch = hash.match(/^#respuesta=([a-f0-9]{64})$/);
  if (responseMatch)
    return (
      <ClientResponse
        key={responseMatch[1]}
        token={responseMatch[1]}
        api={api}
      />
    );
  const match = hash.match(/^#aclaracion=([a-f0-9]{64})$/);
  return match ? (
    <ClarificationReply key={match[1]} token={match[1]} api={api} />
  ) : (
    <App />
  );
}
createRoot(document.getElementById("root")).render(<Root />);
