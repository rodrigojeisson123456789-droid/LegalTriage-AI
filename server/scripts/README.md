# Herramientas del servidor

## Diagnósticos de servicios

`diagnostics/` contiene las comprobaciones que se usan en la instalación. Desde la raíz del proyecto:

```powershell
npm run gemini:text
npm run gemini:check
npm run gemini:models
npm run mail:check
```

Leen `server/.env` mediante el workspace del servidor. Gemini recibe únicamente texto/PDF ficticio y puede consumir cuota. `mail:check` verifica Gmail sin enviar mensajes.

## Pruebas de integración

`integration/` contiene las pruebas con MySQL y el recorrido de navegador. Deben ejecutarse desde `server/`, con una base de prueba preparada; cada script crea y limpia sus propios registros. La [guía de pruebas](../../documentacion/pruebas/README.md) describe dependencias, puertos y condiciones.

Ejemplo:

```powershell
node scripts/integration/documents-smoke.js
```

Los antiguos diagnósticos alternativos de curl/Interactions y la prueba general `smoke.js` fueron retirados porque quedaron reemplazados por estas comprobaciones. Sus versiones anteriores siguen en el historial de Git.
