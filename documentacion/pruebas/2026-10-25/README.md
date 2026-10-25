# Informe de pruebas funcionales — LegalTriage AI

Fecha: 25 de octubre de 2026. **Pruebas con datos ficticios en el entorno de desarrollo, realizadas mediante scripts y navegador automatizado.**

Versión de la aplicación evaluada: `740e50b02066b1620637e3c7d651095823d2026b`.

## Resultado de esta ejecución

- **22 pruebas unitarias aprobadas; 0 fallidas.**
- **9 grupos de integración aprobados**, con MySQL real.
- **11 comprobaciones del recorrido en navegador aprobadas**, con 12 capturas de evidencia.
- **Compilación de producción completada** con `npm run build`.
- **0 excepciones JavaScript** detectadas mediante el evento `pageerror` durante el recorrido.

Son niveles distintos de verificación; sus cantidades no se suman como una sola muestra estadística.

## Condiciones de la prueba

Aplicación React/Vite y Express reales, MySQL 8.4.13 real, Node.js 24.19.0, npm 11.9.0, Vite 6.4.5, Playwright 1.62.1 y Chromium 154.0.8037.57 en Linux. Escritorio: 1440 × 1000 píxeles. Vistas del cliente probadas además a 390 × 844 píxeles.

Las cuentas, datos personales, PDF y respuestas fueron creados exclusivamente para estas pruebas. Gemini devuelve respuestas controladas simuladas; SMTP devuelve aceptación simulada. **No se llamó a Google Gemini ni se enviaron mensajes a Gmail real.** El navegador bloqueó recursos externos. La aplicación y la persistencia de sus operaciones sí se ejecutaron realmente.

El recorrido usó una API temporal en 3004 y una web temporal en 5175. Los scripts de integración usaron 3002 de forma secuencial. Las cuentas, casos, perfiles y demás registros de estas pruebas se eliminaron al finalizar. Se verificó que no quedaran cuentas con el prefijo de este recorrido. Los enlaces privados se ocultaron en las capturas.

## Matriz de resultados observados

| ID | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|
| UI-01 | Recepción de consulta y PDF | La consulta y el PDF se guardan y se confirma el número de caso. | Formulario real del navegador; PDF generado para esta prueba, persistido en MySQL. | APROBADA | [Captura 1](evidencias/01-recepcion.png) |
| UI-02 | Clasificación y asignación automática | La categoría Laboral se refleja y el algoritmo asigna la abogada disponible. | Respuesta Gemini simulada Laboral; algoritmo real asignó la abogada disponible. | APROBADA | [Captura 1](evidencias/02-asignacion.png) |
| UI-03 | Visualización del análisis documental | El equipo puede leer resumen, hallazgos con páginas, fechas y advertencias. | Resumen, hallazgos con página, fechas y advertencias mostrados; contenido Gemini simulado. | APROBADA | [Captura 1](evidencias/03-analisis-inicial.png) |
| UI-04 | Aclaración y notificación | La solicitud se guarda y la notificación usa el correo del caso. | Solicitud real registrada y envío aceptado por SMTP simulado. Enlace oculto en captura; no hubo correo real. | APROBADA | [Captura 1](evidencias/04-aclaracion-correo.png) |
| UI-05 | Respuesta del cliente y retorno a evaluación | El cliente responde una vez y el mismo caso vuelve a evaluación. | Respuesta privada guardada en el mismo caso; vista de 390 px sin desbordamiento horizontal. | APROBADA | [Captura 1](evidencias/05-respuesta-cliente-movil.png) |
| UI-06 | Consulta de dos versiones de evaluación | Las revisiones 1 y 2 conservan sus textos y pueden abrirse sin editar. | Guardados desde la interfaz; cada revisión mantiene sus fundamentos y respuesta. Solo lectura. | APROBADA | [Captura 1](evidencias/06-evaluaciones-versiones.png)<br>[Captura 2](evidencias/06a-evaluacion-anterior.png) |
| UI-07 | Consulta de dos versiones de análisis Gemini | El análisis inicial y el posterior se pueden abrir tras reanalizar. | Dos respuestas simuladas distintas; ambas copias siguen disponibles después de reanalizar. | APROBADA | [Captura 1](evidencias/07-analisis-versiones.png)<br>[Captura 2](evidencias/07a-analisis-anterior.png) |
| UI-08 | Aprobación y notificación de respuesta | La aprobación bloquea la edición y permite notificar la respuesta. | Evaluación bloqueada tras aprobación; registro real de aceptación SMTP simulada, sin entrega a Gmail real. | APROBADA | [Captura 1](evidencias/08-aprobacion-notificacion.png) |
| UI-09 | Respuesta privada final y cierre | El cliente ve solo respuesta/importe aprobados y la atención queda cerrada. | Cliente ve respuesta e importe aprobados, sin notas internas; caso queda cerrado. | APROBADA | [Captura 1](evidencias/09-respuesta-final-movil.png) |
| UI-10 | Permisos de Soporte y abogado no asignado | Soporte no ve evaluaciones; un abogado ajeno no ve el caso. | Soporte no ve evaluaciones ni sus versiones; otro abogado no ve el caso. | APROBADA | [Captura 1](evidencias/10-permisos-soporte.png) |
| UI-11 | Errores JavaScript del recorrido | El recorrido no produce excepciones JavaScript en las páginas. | Cero excepciones pageerror en las páginas del recorrido. Recursos externos del navegador bloqueados. | APROBADA | [Registro](registros/navegador.txt) |

## Integración con MySQL

| Grupo | Comprobación | Estado | Registro |
|---|---|---|---|
| documents | Validación, descarga privada y conservación de documentos | APROBADA | [Salida del script](registros/documents.txt) |
| clarifications | Aclaraciones, enlaces de un uso y concurrencia | APROBADA | [Salida del script](registros/clarifications.txt) |
| evaluations | Borradores, aprobación, estados y privacidad | APROBADA | [Salida del script](registros/evaluations.txt) |
| assignment | Asignación por especialidad, carga y disponibilidad | APROBADA | [Salida del script](registros/assignment.txt) |
| mail | Vista previa, aceptación/fallo SMTP simulado y duplicados | APROBADA | [Salida del script](registros/mail.txt) |
| roles | Permisos por rol y acceso a casos/documentos | APROBADA | [Salida del script](registros/roles.txt) |
| password | Cambio/restablecimiento y revocación de sesiones | APROBADA | [Salida del script](registros/password.txt) |
| history | Actores, metadatos, rollback y paginación | APROBADA | [Salida del script](registros/history.txt) |
| versions | Versiones, contenido vigente y migración repetible | APROBADA | [Salida del script](registros/versions.txt) |

## Alcance de las conclusiones

La ejecución aporta evidencia de que los escenarios descritos funcionan en esta versión y este entorno. No demuestra exactitud jurídica o calidad real de Gemini, entrega real de correo, funcionamiento en la laptop del autor ni ausencia de fallos en todos los escenarios posibles. No sustituye una auditoría de seguridad, pruebas de carga ni evaluación de usabilidad con abogados.

No se midió el procedimiento manual ni se compararon tiempos de atención. Las duraciones técnicas de los scripts en `integracion.json` no equivalen al tiempo de resolver un caso ni permiten afirmar un porcentaje de ahorro. La clasificación Laboral fue una respuesta simulada y no mide precisión del modelo.

Durante la preparación se corrigió una colisión entre correos temporales del ejecutor del navegador. El recorrido final terminó correctamente, sin modificar el código funcional de la aplicación para obtener estos resultados.

Para la tesis, estos resultados pueden presentarse como **validación funcional con datos ficticios y proveedores simulados**. Quedan pendientes las pruebas controladas con Gemini/Gmail reales y una comparación documentada con el proceso manual.

## Cómo reproducir las pruebas

Utilizar una base MySQL de prueba, con `server/.env` configurado y el esquema inicializado. No utilizar casos reales. No debe haber otros perfiles Laboral disponibles durante la prueba de asignación o el recorrido automatizado. No ejecutar simultáneamente los scripts que comparten el puerto 3002.

Desde la raíz:

```powershell
npm test
npm run build
```

Desde `server/`, ejecutar uno por uno:

```powershell
node scripts/documents-smoke.js
node scripts/clarifications-smoke.js
node scripts/evaluations-smoke.js
node scripts/assignment-smoke.js
node scripts/mail-smoke.js
node scripts/roles-smoke.js
node scripts/password-smoke.js
node scripts/history-smoke.js
node scripts/versions-smoke.js
```

El recorrido visual se reproduce desde `server/` con `node scripts/acceptance-browser.js`. Requiere Playwright y Chromium instalados en el entorno de pruebas (en una copia desechable: `npm install --no-save --package-lock=false playwright@1.62.1`, luego `npx playwright install chromium`). El ejecutor utiliza Chromium del sistema si está en `/usr/bin/chromium`; en otros entornos usa el navegador de Playwright. Puede indicarse `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. La carpeta de salida puede elegirse con `REPORT_DIR`. Los puertos 3004 y 5175 deben estar libres. El ejecutor crea y limpia sus fixtures y sustituye Gemini/SMTP solo en su proceso temporal.

## Archivos de respaldo

- [Matriz editable en CSV](matriz-resultados.csv).
- [Informe en PDF](INFORME_PRUEBAS.pdf).
- [Detalle estructurado de integración](integracion.json).
- [Detalle estructurado del navegador](navegador.json).
- [Salida de las pruebas unitarias](registros/unitarias.txt).
- [Salida de la compilación](registros/compilacion.txt).
- [Salida del recorrido visual](registros/navegador.txt).
- [Huellas SHA-256 de los archivos](SHA256SUMS.txt).
