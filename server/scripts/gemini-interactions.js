// Interactions: protocolo verificado contra los tipos del SDK oficial @google/genai 2.31.0.
// Prueba de texto sin documentos, búsqueda web ni persistencia de la interacción.
import 'dotenv/config';
import {analysisErrorMessage,providerFailureReason} from '../src/documents.js';
async function main(){
 if(!process.env.GEMINI_API_KEY)throw new Error(analysisErrorMessage('missing_key'));
 const model=(process.env.GEMINI_MODEL||'gemini-3.8-flash').replace(/^models\//,'');
 if(!/^[A-Za-z0-9._-]{1,120}$/.test(model))throw new Error('Nombre de modelo inválido.');
 console.log(`Modelo: ${model}. Ruta: /v1beta/interactions. Límite: 30 segundos.`);
 let response;
 try{response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
  method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(30000),
  body:JSON.stringify({model:`models/${model}`,input:'Responde únicamente con la palabra OK.',store:false,stream:false}),
 });}catch(error){throw new Error(['TimeoutError','AbortError'].includes(error.name)?'Timeout también en Interactions: no hubo respuesta dentro de 30 segundos.':analysisErrorMessage('network_error'));}
 console.log(`HTTP: ${response.status}`);
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(analysisErrorMessage(providerFailureReason(response.status,body)));
 // REST devuelve Interaction directamente; los wrappers de SDK pueden envolverla.
 const interaction=body?.interaction||body;
 const outputs=interaction?.steps?.filter(step=>step.type==='model_output');
 const text=outputs?.at(-1)?.content?.filter(part=>part.type==='text').map(part=>part.text||'').join('');
 if(interaction?.status!=='completed'||!text?.trim())throw new Error('Interactions respondió, pero no devolvió una interacción completada con texto. No se validó la generación.');
 console.log('Interactions: correcto. La generación funciona por esta ruta; falta validar PDF y salida estructurada antes de cambiar la aplicación.');
}
main().catch(error=>{console.error(`Diagnóstico: ${error.message}`);process.exitCode=1;});
