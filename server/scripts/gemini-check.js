// No usa documentos del cliente ni imprime la clave o respuestas sin filtrar.
import "dotenv/config";
import { PDFDocument } from "pdf-lib";
import { analyzeDocument, analysisErrorMessage } from "../src/documents.js";
const pdf = await PDFDocument.create();
pdf
  .addPage()
  .drawText("Contrato de arrendamiento. Fecha de firma: 10 enero 2026.");
console.log("Comprobando Gemini con un PDF ficticio de una página…");
const result = await analyzeDocument(
  { buffer: Buffer.from(await pdf.save()), mime: "application/pdf", pages: 1 },
  "Clasifica y resume este contrato ficticio para comprobar la conexión.",
);
if (result.status === "analyzed")
  console.log(
    "Conexión y análisis correctos. Ya puedes reintentar el documento guardado desde el panel.",
  );
else {
  console.error(
    `Diagnóstico: ${result.reason}. ${analysisErrorMessage(result.reason)}`,
  );
  process.exitCode = 1;
}
