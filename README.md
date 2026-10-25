# LegalTriage AI

Base full-stack para Núñez Saldaña S.A.C.: React 19 + Vite + Tailwind CSS, Express y MySQL 8.4. Integración directa con Google Gemini desde Node.js; no requiere microservicio Python.

## Inicio local

Requisitos: Node.js 22 o superior, npm y Docker con Compose (o MySQL 8 existente).

1. `npm ci --cache /tmp/legaltriage-npm`
2. Copiar `server/.env.example` a `server/.env` **solo si no existe**. Establecer contraseñas propias, `JWT_SECRET` aleatorio de 32 caracteres o más y `MYSQL_ROOT_PASSWORD` si se usa Docker. Nunca versionar este archivo.
3. `docker compose --env-file server/.env up -d` y esperar estado healthy con `docker compose --env-file server/.env ps`. Si usas MySQL existente, configura DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME; la base debe existir.
4. `npm run db:init` (crea las tablas sin borrar datos; se puede repetir).
5. Crear usuario desde `server/`: `ADMIN_NAME='Nombre del abogado' ADMIN_EMAIL='abogado@example.com' node src/create-user.js`, suministrando `ADMIN_PASSWORD` mediante una variable segura (mínimo 12 caracteres). Todos los usuarios internos pueden gestionar los casos; no hay registro público.
6. `npm run dev` desde la raíz. Vite sirve el frontend en puerto 5173 y delega `/api` al backend en 3001. Acceso del equipo abre el login.

En este entorno se generó un `server/.env` local con secretos aleatorios para desarrollo. No contiene una clave de Gemini ni credenciales públicas de usuario. Crear tu propia cuenta mediante el paso 5.

## Gemini y privacidad

Configurar `GEMINI_API_KEY` y opcionalmente `GEMINI_MODEL` en el backend. La petición sale a `generativelanguage.googleapis.com` y envía solo la descripción. La clave nunca se expone al navegador. El formulario exige consentimiento explícito para ese envío. Revisar la política de privacidad, las condiciones del proveedor y las obligaciones aplicables antes de recibir datos reales.

El prompt clasifica en Civil, Corporativo, Familia, Bancario o Indeterminado mediante salida JSON estructurada. Una categoría inválida, error, timeout o falta de clave conserva la consulta como Indeterminado con `classification_status=unavailable`; el panel indica revisión manual. La IA es orientativa y no constituye asesoría legal. No hay clasificación simulada ni reintento automático posterior.

## Plazos

El abogado selecciona un caso e ingresa título y fecha/hora de Lima (UTC−5). La API guarda UTC y recalcula la urgencia al consultar: vencido si ya pasó, crítico hasta 24 h inclusive, próximo hasta 48 h inclusive y programado después. El cliente actualiza cada minuto. Las alertas son visuales, no se envían correos ni notificaciones fuera del panel. No se calculan días hábiles ni plazos legales automáticamente.

## Validación

- `npm test`: validaciones de consultas, límites de 24/48 horas, fecha futura y respuestas/fallos de Gemini con mock.
- `npm run build`: compilación React.
- Con API y MySQL iniciados, `SMOKE_EMAIL=... SMOKE_PASSWORD=... node server/scripts/smoke.js`: prueba funcional de recepción pública, sesión, asignación, evaluación y alertas. Usar una cuenta de prueba y base desechable: crea un caso y un plazo identificados como prueba.

## Estructura y endpoints

- `client/src/main.jsx`: formulario público, login, dashboard y agenda.
- `client/src/style.css`: diseño adaptable, paleta sobria y componentes visuales propios.
- `server/src/index.js`: API, autenticación por cookie HttpOnly (8 horas), validación Zod, rate limiting y consultas SQL parametrizadas.
- `server/src/domain.js`: clasificación y cálculo de urgencias.
- `server/src/setup.js`: esquema de usuarios, casos y plazos.
- `server/src/create-user.js`: alta de usuarios internos con bcrypt.

Públicos: `GET /api/health`, `POST /api/cases`, `POST /api/login`, `POST /api/logout`. Privados: `GET /api/me`, `GET /api/users`, `GET /api/cases`, `PATCH /api/cases/:id`, `GET /api/deadlines`, `POST /api/deadlines`.

Dashboard y agenda muestran hasta 500 registros; paginación, roles diferenciados, auditoría, recuperación de contraseña, retención de datos y notificaciones son ampliaciones pendientes.

## Despliegue

Esta base usa Vite para desarrollo. Para producción, servir `client/dist` con un servidor web y delegar `/api` a Express bajo el mismo origen HTTPS. Configurar `NODE_ENV=production` para cookies Secure, secretos persistentes y MySQL protegido. Las sesiones JWT expiran a las 8 horas; salir elimina la cookie pero no revoca un token copiado. Configurar el proxy y los límites según el despliegue, copias de seguridad y políticas de acceso antes de usar datos reales. Google Fonts es opcional: la interfaz tiene tipografías de respaldo.

## Documentos y análisis con Gemini (primera etapa del flujo)

El formulario admite **un documento opcional por consulta**: PDF (hasta 50 páginas), PNG o JPG, de hasta 8 MB. Se verifica el formato por su contenido y se rechazan PDFs dañados o protegidos. El consentimiento incluye el envío del adjunto a Gemini. No adjuntar originales únicos ni información innecesaria.

La consulta y el documento se guardan juntos, en una transacción de MySQL. El archivo se almacena como BLOB en la nueva tabla `documents`, no en una carpeta pública. Las copias de seguridad de MySQL deben incluir esa tabla. Los adjuntos aumentan el tamaño de la base; esta primera versión no incluye cuotas globales, antivirus ni una política automática de eliminación.

Gemini recibe la descripción y el documento por HTTPS y devuelve un JSON validado con: resumen, especialidad sugerida, tipo documental, legibilidad, hallazgos con página, fechas textuales con contexto y página e información faltante. Las referencias deben contrastarse con el original; la IA puede equivocarse. No se calculan ni crean plazos automáticamente. El abogado registra los plazos confirmados en Control de plazos.

Si no hay clave, hay timeout o Gemini devuelve un error, el archivo permanece guardado y el caso aparece como Indeterminado, pendiente de revisión. Desde el panel privado, **Ver documentos y análisis → Analizar con Gemini** permite reintentar sin reenviar la consulta. Un reintento fallido conserva un análisis anterior válido. Solo usuarios autenticados pueden consultar análisis y descargar originales; todos los usuarios internos tienen el mismo acceso en esta versión.

### Actualizar una instalación existente en Windows

Detener `npm run dev` con Ctrl+C. Con Docker Desktop abierto, ejecutar desde PowerShell en la raíz del proyecto:

```powershell
git pull origin main
npm ci
docker compose --env-file server/.env up -d
npm run db:init
npm run dev
```

`db:init` añade la tabla de documentos sin borrar usuarios, casos ni plazos existentes. No modificar las contraseñas de una base ya inicializada. Si MySQL todavía está arrancando, esperar a `healthy` antes de `db:init`.

Configurar una clave **nueva y privada** en `GEMINI_API_KEY` de `server/.env`, guardar y reiniciar el backend. No compartir claves en chats ni versionarlas. No se ha usado la clave expuesta previamente. Sin clave funciona la recepción y descarga, pero no la lectura real de Gemini.

Prueba manual: enviar un PDF con una fecha conocida, iniciar sesión, abrir Consultas → Ver documentos y análisis y descargar el original. Con clave válida debe aparecer el análisis; sin clave debe indicar pendiente y permitir reintentar. Una fecha extraída no debe aparecer automáticamente en Control de plazos.

Endpoints adicionales, todos privados:
- `GET /api/cases/:id/documents`: metadatos y análisis, sin contenido binario.
- `GET /api/documents/:id/download`: descarga autenticada como adjunto.
- `POST /api/documents/:id/analyze`: reintento de Gemini limitado por frecuencia.

Pruebas: `npm test` incluye validación documental y Gemini con respuestas simuladas. Desde `server/`, `node scripts/documents-smoke.js` inicia una API temporal en puerto 3002, usa MySQL real, comprueba persistencia, acceso privado y fallos de carga, y elimina su cuenta y datos de prueba. No contacta Gemini ni necesita una clave. No usar simultáneamente con otra API en 3002.

### Diagnosticar Gemini sin compartir credenciales

Desde la raíz ejecuta `npm run gemini:check`. Lee `server/.env` y envía exclusivamente un PDF ficticio generado en memoria, no archivos de clientes. Imprime un diagnóstico conocido (clave rechazada, permisos, API deshabilitada, cuota 429, modelo 404, solicitud rechazada, conexión, timeout o respuesta inválida) sin mostrar la clave ni el cuerpo de error de Google. Puede consumir cuota de Gemini. Un fallo termina con código 1; conserva las comprobaciones de TLS.

Al reintentar un documento, el panel actualiza el motivo del último fallo. Un análisis válido anterior se conserva aunque un intento posterior falle. Cambiar `server/.env` exige reiniciar el backend; no es necesario volver a subir el documento. Un mensaje de cuota no implica por sí solo que debas pagar: revisa los límites y las opciones disponibles en el proyecto antes de decidir.

Si el diagnóstico es `model_unavailable` (404), ejecuta `npm run gemini:models` para listar los nombres accesibles con tu clave que admiten generación de contenido. El listado no certifica compatibilidad con PDF: elige un modelo Gemini multimodal con soporte documental en Google AI Studio, configura su nombre exacto (sin `models/`) en `GEMINI_MODEL`, guarda y vuelve a ejecutar `npm run gemini:check`. Reinicia el servidor al cambiar la configuración. No se cambia automáticamente de modelo ni se activa facturación.

Si el PDF ficticio termina en timeout, ejecuta `npm run gemini:text`. Esta prueba separada solicita solo un texto ficticio breve, sin adjunto ni salida estructurada. Muestra el modelo efectivo, HTTP y duración, sin mostrar la clave o la respuesta de Google. Un éxito valida generación de texto, no análisis PDF. Un timeout no confirma si la causa está en Google, la red o un intermediario. Mantiene TLS verificado y puede consumir cuota.

Si Node y curl responden a un GET sin clave pero la generación de texto con Node se agota, `npm run gemini:curl` compara la misma solicitud mínima de generación por curl. La clave se suministra por stdin mediante configuración, no en argumentos ni en la URL. No imprime respuestas sin filtrar y mantiene la verificación TLS. No cambia el transporte de la aplicación; solo ayuda a diagnosticar. Necesita curl y puede consumir cuota.

`npm run gemini:interactions` prueba texto mínimo por `/v1beta/interactions`, para comparar con ejemplos de AI Studio que utilizan `client.interactions.create`. El protocolo se contrastó con los tipos y el transporte de `@google/genai` 2.31.0 publicado por Google. Solicita `store:false`, no usa búsqueda web ni documentos y no muestra la clave ni el texto de respuesta. Un éxito no valida PDF ni migra automáticamente la aplicación, que sigue utilizando `generateContent`. Puede consumir cuota.

Para una única prueba de latencia extendida en PowerShell: `$env:GEMINI_DIAGNOSTIC_TIMEOUT_MS = "120000"` seguido de `npm run gemini:text`. Permite medir si la generación básica completa dentro de dos minutos cuando el proyecto registra actividad pero las pruebas breves agotan el tiempo. Después elimina la variable con `Remove-Item Env:GEMINI_DIAGNOSTIC_TIMEOUT_MS`. Solo afecta al diagnóstico de texto; no cambia los límites ni el comportamiento de la aplicación.

### Tiempo de espera del análisis

El análisis PDF y la clasificación de consultas esperan hasta **120 segundos** por respuesta de Gemini. El diagnóstico `npm run gemini:check` utiliza exactamente ese mismo límite e informa su duración. Se amplió a partir de una generación de texto real que tardó 36 segundos; esto no garantiza que el PDF responda dentro de dos minutos. Si expira, se conserva el documento y se permite reintentar. No modifica MySQL ni crea plazos automáticos. La prueba mínima `gemini:text` mantiene su límite independiente de 30 segundos salvo ajuste diagnóstico explícito.
