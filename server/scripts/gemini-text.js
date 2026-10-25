// Prueba mínima: no envía documentos, datos de clientes ni esquemas JSON.
import 'dotenv/config';
import { analysisErrorMessage, providerFailureReason } from '../src/documents.js';
async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error(analysisErrorMessage('missing_key'));
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(model)) throw new Error('GEMINI_MODEL tiene un formato inválido. Usa solo el nombre, sin models/ ni espacios.');
  console.log(`Modelo efectivo: ${model}`);
  console.log('Probando texto ficticio sin PDF ni esquema JSON (límite: 30 segundos)…');
  const started = Date.now();
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
      signal:AbortSignal.timeout(30000),
      body:JSON.stringify({contents:[{parts:[{text:'Responde únicamente con la palabra OK.'}]}]}),
    });
    console.log(`HTTP: ${response.status}. Tiempo hasta respuesta: ${Math.round((Date.now()-started)/1000)} s.`);
    const body = await response.json();
    if (!response.ok) throw new Error(analysisErrorMessage(providerFailureReason(response.status,body)));
    if (!body.candidates?.some(c=>c.content?.parts?.some(p=>typeof p.text==='string'&&p.text.trim()))) {
      throw new Error('Google respondió sin texto generado. La conexión funciona, pero la generación no quedó validada.');
    }
    console.log('Texto: correcto. La generación básica funciona; falta comprobar el análisis PDF por separado.');
  } catch (error) {
    if (['AbortError','TimeoutError'].includes(error.name)) throw new Error('Timeout: no se completó la prueba de texto en 30 segundos. No se ha validado la generación básica.');
    if (error instanceof TypeError) throw new Error(analysisErrorMessage('network_error'));
    if (error instanceof SyntaxError) throw new Error('El servidor devolvió una respuesta que no es JSON; revisa el acceso a la API.');
    throw error;
  }
}
main().catch(error=>{console.error(`Diagnóstico: ${error.message}`);process.exitCode=1;});
