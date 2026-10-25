// Lista modelos accesibles sin imprimir la clave ni cuerpos de error de Google.
import 'dotenv/config';
import {analysisErrorMessage,providerFailureReason} from '../src/documents.js';
async function main(){
  if(!process.env.GEMINI_API_KEY)throw new Error(analysisErrorMessage('missing_key'));
  let token;const names=new Set();const seen=new Set();
  do {
    const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize','100');if(token)url.searchParams.set('pageToken',token);
    let response;
    try{response=await fetch(url,{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(20000)});}catch{throw new Error(analysisErrorMessage('network_error'));}
    if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(analysisErrorMessage(providerFailureReason(response.status,body)));}
    const body=await response.json();
    if(!Array.isArray(body.models))throw new Error('Google no devolvió una lista de modelos válida.');
    for(const model of body.models){
      if(model.supportedGenerationMethods?.includes('generateContent')&&/^models\/[A-Za-z0-9._-]+$/.test(model.name))names.add(model.name.slice(7));
    }
    token=body.nextPageToken;
    if(token&&seen.has(token))throw new Error('Google repitió una página de resultados; inténtalo de nuevo más tarde.');
    if(token)seen.add(token);
  }while(token);
  console.log('Modelos accesibles que admiten generateContent (confirma soporte PDF en Google AI Studio):');
  for(const name of [...names].sort())console.log(name);
  if(!names.size)console.log('No se encontraron modelos compatibles para este proyecto.');
}
main().catch(error=>{console.error(error instanceof SyntaxError?'Google devolvió una respuesta inesperada.':error.message);process.exitCode=1;});
