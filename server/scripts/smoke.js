// Ejecutar con SMOKE_EMAIL y SMOKE_PASSWORD de un usuario creado previamente.
import assert from 'node:assert/strict';
const base=process.env.API_URL||'http://127.0.0.1:3001/api';
async function request(path,method='GET',body,cookie){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return response;}
assert.equal((await request('/health')).status,200);
assert.equal((await request('/cases')).status,401);
assert.equal((await request('/cases','POST',{name:'invalido'})).status,400);
const created=await request('/cases','POST',{name:'Cliente prueba',document:'12345678',email:'smoke@example.com',phone:'+51999999999',description:'Consulta de prueba sobre un contrato civil de arrendamiento.',consent:true});assert.equal(created.status,201);const record=await created.json();assert.equal(record.status,'Nuevo');
const login=await request('/login','POST',{email:process.env.SMOKE_EMAIL,password:process.env.SMOKE_PASSWORD});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
const me=await (await request('/me','GET',null,cookie)).json();
assert.equal((await request('/cases/'+record.id,'PATCH',{lawyer_id:me.id,status:'En evaluación'},cookie)).status,204);
const rows=await(await request('/cases','GET',null,cookie)).json();assert.equal(rows.find(c=>c.id===record.id).status,'En evaluación');
assert.equal((await request('/deadlines','POST',{case_id:record.id,title:'Prueba de audiencia',due_at:new Date(Date.now()+23*3600000).toISOString()},cookie)).status,201);
const deadlines=await(await request('/deadlines','GET',null,cookie)).json();assert.ok(deadlines.some(d=>d.case_id===record.id&&d.urgency==='Crítico'));
assert.equal((await request('/logout','POST',null,cookie)).status,204);
console.log('Smoke OK: MySQL, recepción, autenticación, asignación, evaluación y alerta de 24 horas. Crea datos de prueba identificados.');
