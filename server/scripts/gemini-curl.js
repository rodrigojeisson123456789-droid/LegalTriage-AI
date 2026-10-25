// Compara el transporte HTTP con curl. La clave viaja por stdin, no por argumentos.
import 'dotenv/config';
import {spawnSync} from 'node:child_process';
import {analysisErrorMessage,providerFailureReason} from '../src/documents.js';
function main(){
 const key=process.env.GEMINI_API_KEY;
 if(!key)throw new Error(analysisErrorMessage('missing_key'));
 if(!/^[A-Za-z0-9._-]+$/.test(key))throw new Error('La clave contiene espacios o caracteres inesperados. Revisa el valor local sin compartirlo.');
 const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
 if(!/^[A-Za-z0-9._-]{1,120}$/.test(model))throw new Error('GEMINI_MODEL tiene un formato inválido.');
 const payload=JSON.stringify({contents:[{parts:[{text:'Responde únicamente con la palabra OK.'}]}]});
 const config=[`url = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent"`,'request = "POST"','header = "Content-Type: application/json"',`header = ${JSON.stringify('x-goog-api-key: '+key)}`,`data = ${JSON.stringify(payload)}`].join('\n');
 console.log(`Modelo efectivo: ${model}. Probando texto con curl, sin documentos (30 segundos)…`);
 const started=Date.now();
 const result=spawnSync(process.platform==='win32'?'curl.exe':'curl',['--config','-','--silent','--show-error','--connect-timeout','10','--max-time','30','--write-out','\n%{http_code}'],{input:config,encoding:'utf8',timeout:35000,maxBuffer:1024*1024,windowsHide:true});
 if(result.error?.code==='ENOENT')throw new Error('No se encontró curl.');
 if(result.status===28||result.error?.code==='ETIMEDOUT')throw new Error('Timeout también con curl: la generación no terminó dentro del límite.');
 if(result.status!==0)throw new Error(`curl no pudo completar la petición (salida ${result.status??'interrumpida'}). No se imprimieron credenciales ni respuestas sin filtrar.`);
 const split=result.stdout.lastIndexOf('\n');const status=Number(result.stdout.slice(split+1));
 console.log(`HTTP: ${status}. Duración: ${Math.round((Date.now()-started)/1000)} s.`);
 let body;try{body=JSON.parse(result.stdout.slice(0,split));}catch{throw new Error('El servidor devolvió una respuesta que no es JSON.');}
 if(status<200||status>=300)throw new Error(analysisErrorMessage(providerFailureReason(status,body)));
 if(!body.candidates?.some(c=>c.content?.parts?.some(p=>typeof p.text==='string'&&p.text.trim())))throw new Error('Google respondió, pero sin texto generado.');
 console.log('Texto con curl: correcto. La generación funciona por este transporte; falta contrastar Node y el análisis PDF.');
}
try{main();}catch(error){console.error(`Diagnóstico: ${error.message}`);process.exitCode=1;}
