# Pruebas actuales y evidencias históricas

## Comprobaciones básicas

Desde la raíz:

```powershell
npm test
npm run build
```

Las pruebas de `server/test` validan reglas y errores con respuestas controladas; no usan Gemini o Gmail reales ni equivalen a mediciones de atención de personas.

## Integración con MySQL

Inicializar una base **de prueba** con `server/.env` y `npm run db:init`. Ejecutar desde `server/`, uno por uno:

```powershell
node scripts/integration/documents-smoke.js
node scripts/integration/clarifications-smoke.js
node scripts/integration/analysis-context-smoke.js
node scripts/integration/evaluations-smoke.js
node scripts/integration/assignment-smoke.js
node scripts/integration/mail-smoke.js
node scripts/integration/auto-mail-smoke.js
node scripts/integration/deadline-reminders-smoke.js
node scripts/integration/roles-smoke.js
node scripts/integration/password-smoke.js
node scripts/integration/history-smoke.js
node scripts/integration/versions-smoke.js
```

Usan temporalmente el puerto 3002 y eliminan sus fixtures. Los servicios externos se simulan o se deshabilitan; los procesos de prueba desactivan los recordatorios reales. La prueba específica de recordatorios usa un transporte SMTP simulado incluso al comprobar el arranque del worker.

La prueba de asignación necesita que no existan otros perfiles Laboral disponibles (o Penal si se usa `SMOKE_SPECIALTY=Penal`). La prueba de recordatorios requiere que no existan otros plazos elegibles. Estas condiciones impiden mezclar resultados con casos ajenos a los fixtures.

## Recorrido en navegador

Desde `server/`:

```powershell
node scripts/integration/acceptance-browser.js
```

Requiere Playwright y Chromium en el entorno de pruebas. Para prepararlos en una copia de prueba: `npm install --no-save --package-lock=false playwright@1.62.1` y `npx playwright install chromium`. Se puede indicar `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para un navegador instalado. Los puertos 3004 y 5175 deben estar libres; no debe haber otros perfiles Laboral disponibles.

La salida predeterminada es `documentacion/pruebas/ejecuciones-locales/<fecha-hora>/`, ignorada por Git. `REPORT_DIR` permite elegir otra carpeta. Las cuentas, documentos y respuestas son ficticios; Gemini/SMTP se simulan y el navegador bloquea conexiones externas. El ejecutor limpia sus fixtures.

## Evidencias históricas

El [informe del 25 de octubre de 2026](2026-10-25/README.md) conserva intactos sus registros, capturas, PDF y huellas. Describe una versión anterior: no se actualizan sus cifras ni sus comandos antiguos para hacerlos pasar por los de la versión actual. Para ejecutar las pruebas del código actual, utilizar las rutas de esta guía.

Las duraciones de estos scripts no son tiempos del procedimiento del estudio. La comparación empresarial y la evaluación jurídica de Gemini siguen los instrumentos y pendientes de la [tesis](../tesis/README.md).
