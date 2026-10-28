# LegalTriage AI

Base full-stack para Núñez Saldaña S.A.C.: React 19 + Vite + Tailwind CSS, Express y MySQL 8.4. Integración directa con Google Gemini desde Node.js; no requiere microservicio Python.

## Inicio local

Requisitos: Node.js 22 o superior, npm y Docker con Compose (o MySQL 8 existente).

1. `npm ci --cache /tmp/legaltriage-npm`
2. Copiar `server/.env.example` a `server/.env` **solo si no existe**. Establecer contraseñas propias, `JWT_SECRET` aleatorio de 32 caracteres o más y `MYSQL_ROOT_PASSWORD` si se usa Docker. Nunca versionar este archivo.
3. `docker compose --env-file server/.env up -d` y esperar estado healthy con `docker compose --env-file server/.env ps`. Si usas MySQL existente, configura DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME; la base debe existir.
4. `npm run db:init` (crea las tablas sin borrar datos; se puede repetir).
5. Crear usuario desde `server/`: `ADMIN_NAME='Nombre del abogado' ADMIN_EMAIL='abogado@example.com' node src/create-user.js`, suministrando `ADMIN_PASSWORD` mediante una variable segura (mínimo 8 caracteres). La primera cuenta creada por CLI recibe Gerencia si no existe otra; las posteriores usan ADMIN_ROLE o Soporte por defecto. No hay registro público.
6. `npm run dev` desde la raíz. Vite sirve el frontend en puerto 5173 y delega `/api` al backend en 3001. Acceso del equipo abre el login.

En este entorno se generó un `server/.env` local con secretos aleatorios para desarrollo. No contiene una clave de Gemini ni credenciales públicas de usuario. Crear tu propia cuenta mediante el paso 5.

## Gemini y privacidad

Configurar `GEMINI_API_KEY` y opcionalmente `GEMINI_MODEL` en el backend. La petición sale a `generativelanguage.googleapis.com` y envía solo la descripción. La clave nunca se expone al navegador. El formulario exige consentimiento explícito para ese envío. Revisar la política de privacidad, las condiciones del proveedor y las obligaciones aplicables antes de recibir datos reales.

El prompt clasifica en Civil, Corporativo, Familia, Bancario, Laboral, Penal o Indeterminado mediante salida JSON estructurada. Una categoría inválida, error, timeout o falta de clave conserva la consulta como Indeterminado con `classification_status=unavailable`; el panel indica revisión manual. La IA es orientativa y no constituye asesoría legal. No hay clasificación simulada ni reintento automático posterior.

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

Dashboard y agenda muestran hasta 500 registros; paginación, auditoría integral, recuperación de contraseña y retención de datos son ampliaciones pendientes. Los roles y el correo explícito están implementados.

## Despliegue

Esta base usa Vite para desarrollo. Para producción, servir `client/dist` con un servidor web y delegar `/api` a Express bajo el mismo origen HTTPS. Configurar `NODE_ENV=production` para cookies Secure, secretos persistentes y MySQL protegido. Las sesiones JWT expiran a las 8 horas; salir elimina la cookie pero no revoca un token copiado. Configurar el proxy y los límites según el despliegue, copias de seguridad y políticas de acceso antes de usar datos reales. Google Fonts es opcional: la interfaz tiene tipografías de respaldo.

## Documentos y análisis con Gemini (primera etapa del flujo)

El formulario admite **un documento opcional por consulta**: PDF (hasta 50 páginas), PNG o JPG, de hasta 8 MB. Se verifica el formato por su contenido y se rechazan PDFs dañados o protegidos. El consentimiento incluye el envío del adjunto a Gemini. No adjuntar originales únicos ni información innecesaria.

La consulta y el documento se guardan juntos, en una transacción de MySQL. El archivo se almacena como BLOB en la nueva tabla `documents`, no en una carpeta pública. Las copias de seguridad de MySQL deben incluir esa tabla. Los adjuntos aumentan el tamaño de la base; esta primera versión no incluye cuotas globales, antivirus ni una política automática de eliminación.

Gemini recibe la descripción y el documento por HTTPS y devuelve un JSON validado con: resumen, especialidad sugerida, tipo documental, legibilidad, hallazgos con página, fechas textuales con contexto y página e información faltante. Las referencias deben contrastarse con el original; la IA puede equivocarse. No se calculan ni crean plazos automáticamente. El abogado registra los plazos confirmados en Control de plazos.

Si no hay clave, hay timeout o Gemini devuelve un error, el archivo permanece guardado y el caso aparece como Indeterminado, pendiente de revisión. Desde el panel privado, **Ver documentos y análisis → Analizar con Gemini** permite reintentar sin reenviar la consulta. Un reintento fallido conserva un análisis anterior válido. Solo usuarios autenticados pueden consultar análisis y descargar originales; Gerencia y Soporte acceden a la recepción completa; un Abogado solo a sus casos asignados.

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

## Especialidad Laboral y circuito de aclaraciones

`Laboral` está incluida en el prompt y la salida estructurada de Gemini, en MySQL y en el formulario público. Después de actualizar, ejecutar `npm run db:init`: amplía los ENUM de forma aditiva y crea `clarifications` sin borrar datos. Los casos antiguos no se reclasifican automáticamente. El abogado puede seleccionar **Laboral** directamente en la tabla (queda marcado como revisión manual), o volver a analizar el documento para actualizar la sugerencia de Gemini.

En **Consultas → Aclaraciones**, el equipo revisa y edita las necesidades de información sugeridas por el último análisis documental disponible. Crear la solicitud cambia el caso a **Pendiente de aclaración** y muestra una sola vez un enlace privado. El abogado debe copiarlo y compartirlo por su canal habitual: **no hay envío automático de correo o WhatsApp**. Si pierde el enlace, puede crear otra solicitud; se invalidará la anterior sin responder. También puede cancelarla.

El enlace vence a los siete días. Usa un token aleatorio de 256 bits; en MySQL solo se guarda su hash. El token va en el fragmento de la URL y se envía en el cuerpo de las peticiones, no en la ruta del API. Quien lo posea puede ver las preguntas y responder; no accede al expediente, DNI, documentos ni respuestas anteriores. Es una credencial de acceso: compartir solo con el destinatario. Se limita la frecuencia de uso y se deshabilita la caché de las respuestas del API.

La respuesta admite texto (hasta 10.000 caracteres), requiere consentimiento, se guarda una sola vez de forma transaccional y devuelve el caso a **En evaluación**. No crea otra consulta ni dispara una nueva petición a Gemini. El equipo puede ver las últimas 20 solicitudes y respuestas. Al volver a analizar el documento, las últimas 20 aclaraciones respondidas se incorporan como contexto. Los documentos adicionales en respuestas y el envío automático de notificaciones quedan pendientes.

**En desarrollo**, un enlace con `localhost` o `127.0.0.1` funciona solo en la laptop donde corre el sistema. Para un cliente externo se requiere desplegar frontend y API bajo una dirección pública HTTPS; esta actualización no publica el sitio.

Prueba local: crear una solicitud, copiar el enlace, abrirlo en una ventana privada y responder. Volver al panel y abrir el historial; el caso debe volver a evaluación (el panel se refresca cada minuto o al cerrar Aclaraciones). Los enlaces respondidos, vencidos, cancelados o reemplazados no permiten una respuesta nueva.

Endpoints: públicos `POST /api/clarifications/access` y `POST /api/clarifications/answer` (token por cuerpo); privados `GET/POST /api/cases/:id/clarifications` y `DELETE /api/cases/:id/clarifications/:requestId`. `PATCH /api/cases/:id` admite corrección manual de especialidad.

Desde `server/`, `node scripts/clarifications-smoke.js` prueba con MySQL real permisos, clasificación Laboral/manual, sustitución, vencimiento, cancelación, respuesta única concurrente y conservación del mismo caso, y elimina sus datos de prueba. Usa temporalmente el puerto 3002. No contacta Gemini.

## Evaluación del abogado, respuesta y decisión

En **Consultas → Evaluación y respuesta**, el equipo registra conclusiones internas y redacta una Respuesta, Propuesta o Cotización. El importe opcional está en soles (PEN); para Cotización es obligatorio. Guardar un borrador no aprueba ni envía nada. Incluye vista previa del texto que podrá leer el cliente y control de revisión para evitar sobrescribir cambios de otro usuario: ante un conflicto, cerrar descartando cambios locales y volver a abrir para recuperar la versión guardada.

Después de revisar los antecedentes, el abogado elige expresamente **seguimiento judicial** o **cierre de atención inicial**, guarda y confirma la aprobación. Se registran el usuario aprobador y la fecha; la evaluación queda bloqueada y esta versión no permite corregirla ni reabrirla. No hay sugerencias de conclusiones automáticas ni envío de notas internas a Gemini. Gerencia y el Abogado asignado pueden evaluar y aprobar; Soporte no puede acceder a notas internas ni aprobar.

La aprobación se bloquea si hay aclaraciones vigentes sin responder. El cierre se bloquea si existen plazos futuros, y una atención cerrada no acepta nuevos plazos ni nuevas aclaraciones. El estado **En seguimiento judicial** permite registrar plazos mediante el botón correspondiente con el caso preseleccionado. Cerrar la atención inicial no declara concluido un proceso judicial ni silencia sus plazos; esta versión no incluye una operación posterior de cierre judicial.

Tras aprobar, **Crear enlace de respuesta aprobada** genera un enlace privado de lectura durante 30 días. Se muestra solo una vez y debe copiarse para compartirlo manualmente; no envía correo ni WhatsApp. Muestra únicamente tipo de respuesta, texto aprobado, importe y fecha de aprobación; excluye notas internas, DNI y expediente. No implica contratación, aceptación del cliente ni pago. El token se guarda como hash, se envía por cuerpo al API, puede revocarse y se reemplaza al crear otro enlace. Un enlace localhost solo sirve en la laptop local; requiere despliegue HTTPS para clientes externos.

Para actualizar: detener `npm run dev`, ejecutar `git pull origin main`, `npm ci`, `npm run db:init` y `npm run dev`. La migración amplía estados y crea `evaluations` y `response_links` sin borrar registros. Incluye un único borrador revisable y la aprobación final; no conserva versiones históricas de cada edición del borrador.

API privada: `GET/PUT /api/cases/:id/evaluation`, `POST /api/cases/:id/evaluation/approve`, `POST/DELETE /api/cases/:id/evaluation/share`. Acceso público mediante token: `POST /api/responses/access`. El registro de plazos y la aprobación usan el mismo bloqueo transaccional del caso para evitar cierres concurrentes con nuevos plazos.

Prueba: desde `server/`, `node scripts/evaluations-smoke.js` usa MySQL real y una API temporal en 3002 para validar permisos, conflictos, aprobación única, bloqueo por aclaraciones/plazos y privacidad/revocación/vencimiento de enlaces. Crea y elimina únicamente sus propios datos de prueba; no llama a Gemini.

## Equipo y asignación automática

Actualizar con `npm run db:init` crea `lawyer_profiles` y `lawyer_specialties`, sin cambiar usuarios ni responsables existentes. En **Equipo**, selecciona una o varias especialidades y activa **Disponible para recibir asignaciones automáticas** únicamente para abogados que atiendan casos. Todos comienzan sin perfil activo; una cuenta de soporte sin configurar no recibe asignaciones automáticas. Solo Gerencia administra Equipo y crea cuentas desde la interfaz o con `npm run user:create`, sin contraseñas predeterminadas. Soporte no recibe asignaciones jurídicas. Gerencia puede atender casos si configura un perfil disponible.

Al guardar una consulta nueva clasificada, se asigna un abogado disponible de esa especialidad con el menor número **total** de casos activos (de todas sus áreas). Se consideran activos Nuevo, En evaluación, Pendiente de aclaración y En seguimiento judicial; se excluye Atención inicial cerrada. En empate se usa el menor ID de usuario para obtener un resultado determinista. Las decisiones automáticas concurrentes se serializan en MySQL; es una solución orientada a un estudio pequeño. La carga puede cambiar después por acciones manuales.

Un fallo de Gemini, categoría Indeterminado o ausencia de abogados disponibles deja el caso sin responsable para revisión. Un nuevo análisis documental intenta asignar si el caso sigue sin responsable. Nunca reemplaza un responsable existente ni cambia el estado del caso. Los casos anteriores no se reparten masivamente: en la tabla se puede pulsar **Asignar automáticamente**, después de configurar Equipo o corregir la especialidad. El selector manual sigue permitiendo elegir cualquier usuario interno, incluso fuera de disponibilidad; la disponibilidad afecta solo a la asignación automática. Desactivar o cambiar un perfil no retira ni redistribuye sus casos existentes.

API privada: `GET /api/team`, `PUT /api/team/:id` y `POST /api/cases/:id/auto-assign`. La creación pública de casos no expone datos del abogado. No se envía ninguna notificación externa al asignar.

Prueba de integración: desde `server/`, `node scripts/assignment-smoke.js`. Requiere MySQL de prueba sin otros perfiles Laboral disponibles. Usa una API temporal en 3002 y Gemini simulado; verifica reparto por carga, empates, solicitudes concurrentes, disponibilidad, casos cerrados, falta de clasificación y cambios manuales. Crea y limpia sus propios usuarios, perfiles y casos. No consulta a Google.

## Notificaciones por Gmail

En Aclaraciones o Evaluación, crea el enlace privado y usa la nueva sección **Notificación por Gmail**. El destinatario es el correo guardado en el caso; el API no acepta destinatarios arbitrarios. El mensaje contiene solo un aviso y el enlace, nunca el PDF ni las conclusiones internas. La respuesta debe estar aprobada y el enlace debe seguir vigente. No se envían mensajes automáticamente al guardar, aprobar o asignar.

Por defecto `MAIL_MODE=preview`: permite inspeccionar asunto, destinatario y cuerpo **sin contactar Gmail ni registrar un envío**. Para pruebas reales utiliza un caso cuyo correo sea tu propio Gmail. La vista previa y los enlaces son privados: no publiques capturas con tokens vigentes.

Configuración local en `server/.env` (no compartir ni versionar):

```dotenv
MAIL_MODE=preview
SMTP_USER=tu_cuenta@gmail.com
SMTP_APP_PASSWORD=
PUBLIC_APP_URL=http://localhost:5173
```

1. En tu cuenta Google activa verificación en dos pasos y crea una **contraseña de aplicación** para LegalTriage en https://myaccount.google.com/apppasswords. Algunas cuentas administradas o con restricciones no ofrecen esta opción; no desactives protecciones para forzarla.
2. Introduce esa contraseña únicamente en `SMTP_APP_PASSWORD`. No uses la contraseña habitual de tu cuenta. Se admiten los espacios de agrupación que muestra Google.
3. Cambia `MAIL_MODE=gmail`, guarda y ejecuta `npm run mail:check`. Comprueba conexión TLS y autenticación, **sin enviar correo**. Gmail SMTP usa `smtp.gmail.com:465` con TLS y verificación de certificados.
4. Reinicia `npm run dev`. Crea el enlace desde el panel, comprueba el destinatario, marca la confirmación y pulsa Enviar. La aceptación por Gmail no confirma entrega ni lectura; revisa también Spam.

Mientras PUBLIC_APP_URL sea localhost, el enlace del correo solo abre la aplicación en la laptop local. Para clientes externos debes publicar el frontend y API bajo un origen HTTPS y establecerlo como PUBLIC_APP_URL (sin rutas ni parámetros). La integración no publica el sitio ni requiere un dominio para la vista previa local. El servidor genera el enlace del correo desde esta configuración, no desde un destino proporcionado por el navegador.

Se registra un estado por enlace: pending, accepted, failed (autenticación rechazada) o uncertain. Se bloquean duplicados aceptados, pendientes y sin confirmar. Un fallo de autenticación permite reintentar después de corregir la configuración. Ante un error de red, timeout o interrupción del proceso no se puede asegurar si hubo envío: revisar el buzón antes de crear otro enlace. No hay reintentos automáticos ni garantía de entrega única de extremo a extremo. Crear otro enlace revoca el anterior según las reglas de aclaraciones/respuestas; evitar hacerlo mientras haya un correo en curso. El registro guarda el hash del token, no el cuerpo ni la contraseña. Los borradores y notas internas siguen siendo privados.

Actualizar con `npm ci` y `npm run db:init` instala Nodemailer y crea `notifications`, conservando los casos. API privada: `GET /api/mail/config`, `GET/POST /api/cases/:id/notifications`. El botón permite vista previa o envío según MAIL_MODE. `npm test` cubre configuración y mensajes; desde `server/`, `node scripts/mail-smoke.js` usa MySQL real y Gmail simulado para validar permisos, enlaces, destinatario, duplicados y privacidad. No valida credenciales reales; ejecutar en una base de prueba, usa el puerto 3002 y limpia sus datos.

## Roles y permisos

Actualizar con `npm run db:init` añade `users.role`. En la primera migración elige como Gerencia la cuenta admin@legaltriage.local si existe, o la cuenta de menor ID; reconoce como Abogado a otras cuentas que ya tenían casos o disponibilidad, y deja el resto como Soporte. Conserva contraseñas, responsables y expedientes. Repetir la migración no cambia roles ya configurados. En una base vacía, el CLI permite crear la primera Gerencia. Las sesiones existentes consultan el rol actual en MySQL en cada petición; no se confía en un rol almacenado en el JWT.

| Operación | Gerencia | Soporte | Abogado |
|---|---|---|---|
| Consultar casos, documentos y alertas | Todos | Todos | Solo asignados |
| Clasificar y tramitar aclaraciones | Todos | Todos | Solo asignados |
| Asignar o cambiar responsable | Sí | Sí | No |
| Leer notas internas, evaluar, aprobar, compartir respuesta | Todos | No | Solo asignados |
| Registrar plazos | Todos | No | Solo asignados |
| Administrar perfiles, crear cuentas y cambiar roles | Sí | No | No |

Los enlaces públicos del cliente siguen limitados a sus preguntas o su respuesta aprobada y no conceden acceso al panel. La API valida también el caso asociado a un ID de documento y filtra casos/plazos por responsable. Reasignar un caso retira acceso al abogado anterior en peticiones posteriores. Las escrituras transaccionales de expedientes vuelven a comprobar acceso al guardar, incluido el análisis de IA. Los datos que ya se mostraron en el navegador antes de una revocación no se pueden retirar retrospectivamente.

En **Equipo → Crear cuenta**, Gerencia introduce nombre, correo, contraseña inicial de 8 a 72 caracteres y rol. Las contraseñas se guardan con bcrypt y no se envían por correo. No puedes cambiar tu propio rol; otra Gerencia debe hacerlo. No se permite dejar al sistema sin Gerencia, ni convertir en Soporte a alguien con casos activos: reasignarlos primero. Cambiar a Soporte desactiva la disponibilidad automática; los perfiles de Soporte no pueden activarse. Gerencia puede atender casos si así se configura.

Para crear por PowerShell desde la raíz (valores locales, no compartir credenciales):

```powershell
$env:ADMIN_NAME = "Nombre de la persona"
$env:ADMIN_EMAIL = "persona@example.com"
$env:ADMIN_ROLE = "abogado"
# Introducir ADMIN_PASSWORD mediante un mecanismo seguro antes de ejecutar:
npm run user:create
Remove-Item Env:ADMIN_PASSWORD
```

Si cambia el rol de una sesión abierta, recargar el navegador actualiza las vistas; el backend ya utiliza el rol vigente. La pantalla también actualiza el perfil al refrescar sus datos. No hay recuperación de contraseña por correo, MFA ni auditoría integral en esta versión; Gerencia puede restablecer contraseñas desde Equipo.

`npm test` comprueba la matriz básica. Desde `server/`, `node scripts/roles-smoke.js` prueba MySQL real, acceso por caso/documento, notas internas, plazos, reasignación, cambios de rol con la misma sesión y creación de cuentas sin exponer contraseñas. Usa una API temporal en 3002 y elimina sus fixtures, sin contactar Gemini/Gmail. Los demás smoke tests crean ahora cuentas con roles explícitos; el script smoke.js general requiere una cuenta de Gerencia.

### Restablecer una contraseña desde Gerencia

Ejecutar `npm run db:init` tras actualizar añade `users.session_version` sin cambiar contraseñas existentes. En Equipo, abrir **Restablecer contraseña de [usuario]**, escribir y repetir una nueva clave y pulsar **Guardar nueva contraseña**. Conserva la cuenta, rol y casos. Requiere entre 8 y 72 caracteres y un máximo de 72 bytes UTF-8 para evitar truncamiento de bcrypt. La clave no se muestra ni se envía por correo. No es posible recuperar la anterior desde el hash.

`PUT /api/users/:id/password` está reservado a Gerencia. Incrementa la versión de sesión y rechaza cookies anteriores a partir de la siguiente petición, incluidas cookies antiguas que no tenían versión. Si Gerencia cambia su propia contraseña, la interfaz se recarga y exige iniciar sesión con la nueva. Las sesiones existentes se conservan al migrar mientras no haya un restablecimiento. No incluye recuperación autoservicio ni enlace por email.

Desde `server/`, `node scripts/password-smoke.js` valida permisos, confirmación, hash, rechazo de la contraseña anterior, revocación y nuevo acceso con MySQL real; limpia sus cuentas de prueba y no contacta Gemini/Gmail.

### Contraseña elegida por cada usuario

La política actual admite de 8 a 72 caracteres (máximo 72 bytes UTF-8 por bcrypt), sin exigir mayúsculas, números ni símbolos. Se aplica a creación de cuentas, CLI, restablecimiento de Gerencia y cambio personal. Las contraseñas existentes siguen funcionando y no se acortan automáticamente.

Cada rol dispone de **Mi cuenta**, donde introduce su contraseña actual, elige y repite la nueva, y puede mostrar los campos mientras escribe. `PUT /api/me/password` utiliza exclusivamente la identidad autenticada, valida la contraseña actual y revoca las sesiones previas al guardar. Después se debe iniciar sesión otra vez. Si olvidó la contraseña actual, Gerencia debe restablecerla desde Equipo. No hay registro público ni envío de contraseñas por correo.

### Sesión del navegador y respuestas tardías

Al iniciar/cerrar sesión o cambiar de cuenta, la interfaz cancela las cargas anteriores y descarta resultados de su generación, aunque la respuesta ya estuviera en camino. La comprobación inicial de sesión tampoco puede restaurar una cuenta después de otro login. Una respuesta 401 vigente elimina los datos privados y vuelve al formulario de acceso; una respuesta antigua no muestra alertas en la cuenta nueva. Las credenciales incorrectas siguen mostrando su error y no se confunden con vencimiento de sesión.

Después de cambiar la contraseña desde Mi cuenta, se vuelve al login con un aviso de éxito y se detiene la actualización de la sesión anterior. `npm test` incluye una prueba de aislamiento entre solicitudes de cuentas diferentes. Se comprobó en navegador el caso de 401 retrasado tras otro login, credenciales erróneas, cambio de contraseña y vencimiento real. Para usar dos cuentas simultáneas, utilizar perfiles de navegador separados o una ventana privada: las pestañas normales comparten la cookie de sesión.


### Historial del caso

Después de actualizar, ejecutar `npm run db:init` y reiniciar la aplicación. En **Consultas → Historial del caso** se muestran las acciones más recientes con fecha/hora de Lima, nombre y rol del usuario en ese momento, o su origen Sistema/Cliente. Se cargan 50 acciones y el botón **Ver acciones anteriores** continúa con un cursor. Los casos anteriores a esta funcionalidad empiezan sin historial: únicamente se registran acciones nuevas, sin reconstruir hechos pasados.

Registra recepción y clasificación de consultas, recepción/análisis de documentos (incluido análisis no disponible), asignación automática o manual, revisión de especialidad, cambios manuales de estado, solicitudes/respuestas/cancelaciones de aclaración, borradores/aprobación de evaluación, creación/revocación de enlaces de respuesta, creación de plazos e intentos/resultados de correo. Los cambios de estado producidos por aclaraciones o aprobación se reflejan en esas acciones. Las vistas previas de correo no generan intentos de envío. Aceptado por Gmail no confirma entrega al destinatario.

Cada acción se inserta en la misma transacción que su cambio: un cambio rechazado o revertido no aparece como completado. El historial guarda metadatos permitidos; no copia notas jurídicas, respuestas, documentos, nombres de archivos, contraseñas ni tokens privados. El actor Cliente indica uso del formulario o de un enlace privado, sin acreditar identidad civil. Conserva el nombre/rol histórico del usuario aunque su perfil cambie posteriormente.

`GET /api/cases/:id/history?before=<id>` requiere sesión y acceso al caso. Gerencia ve todos; Abogado solo los asignados; Soporte ve acciones operativas, sin borradores de evaluación ni eventos de enlaces de respuesta. No hay endpoints para editar o borrar eventos. Es trazabilidad funcional del caso, sin cubrir accesos de lectura, administración de cuentas ni cambios directos en MySQL; no es un registro inviolable frente al administrador de la base.

Validación: `npm test` incluye restricciones de metadatos y permisos. Desde `server/`, `node scripts/history-smoke.js` inicia una API temporal en 3002 con MySQL de prueba, comprueba acciones reales, actores, aislamiento por caso/rol, exclusión de secretos, rollback y paginación, y limpia sus propios datos. No contacta Gemini ni Gmail. Los smoke tests que usan 3002 deben ejecutarse uno después de otro.

### Consultar versiones de evaluaciones y análisis

Actualizar con la aplicación detenida: `git pull origin main`, `npm run db:init` y `npm run dev`. La migración crea `case_versions` y conserva una copia del contenido vigente de cada evaluación y análisis que todavía no tenga versiones. Aparece como **conservado al activar las versiones**, con la fecha de captura; no se atribuye una fecha de edición pasada. Repetir la migración no duplica esas copias. No puede recuperar contenidos sobrescritos antes de esta función.

A partir de entonces, cada guardado de evaluación, aprobación y análisis documental completado conserva una copia independiente, dentro de la misma transacción del cambio y del evento. Un error de Gemini registra el intento pero no crea un análisis ficticio ni elimina las copias anteriores. Un conflicto de revisión o un guardado rechazado no crea una versión. Las versiones guardan el contenido de la evaluación o del análisis de ese momento; no duplican el archivo original ni los tokens privados. La lista general del historial sigue mostrando solo metadatos.

En **Consultas → Historial del caso**, pulsar **Ver versión guardada** junto a la acción. Permite abrir varias versiones para leer fundamentos, respuesta, importe/decisión o resumen, hallazgos, fechas y datos faltantes del análisis de Gemini. Cada copia es de solo lectura: abrirla no modifica el contenido vigente ni reabre o restaura el caso. Los análisis mantienen sus advertencias de revisión profesional.

`GET /api/cases/:id/history/:eventId/version` exige sesión y acceso al caso; el evento debe pertenecer al caso solicitado. Gerencia y el abogado asignado consultan evaluaciones y análisis; Soporte consulta únicamente análisis documentales, igual que en la vista actual de documentos. Las notas jurídicas de versiones anteriores siguen restringidas. No hay API de edición, restauración ni eliminación de versiones. Los contenidos se conservan en MySQL con las mismas necesidades de protección y respaldo que el expediente actual.

Pruebas: `npm test` valida el esquema y restricciones de las versiones. Desde `server/`, `node scripts/versions-smoke.js` usa MySQL real y Gemini simulado en una API temporal en 3002; verifica contenido anterior y vigente, borradores/aprobaciones, permisos, fallos sin versiones falsas y migración repetible con preservación de contenido existente. Limpia sus propios datos. Ejecutar en una base de prueba, sin otros smoke tests simultáneos en ese puerto.

### Evidencia de pruebas funcionales

El [informe del 25 de octubre de 2026](documentacion/pruebas/2026-10-25/README.md) contiene resultados, matriz CSV, PDF, capturas y registros de una ejecución con datos ficticios: 22 pruebas unitarias, nueve grupos de integración y once comprobaciones en navegador. MySQL fue real; Gemini y SMTP se simularon. No demuestra calidad jurídica del modelo, entrega real de Gmail ni ahorro de tiempo frente al proceso manual. El recorrido visual puede reproducirse con `server/scripts/acceptance-browser.js`, siguiendo las condiciones y dependencias indicadas en el informe.

### Detalle de errores en la prueba de texto de Gemini

Si AI Studio responde pero la API falla, `npm run gemini:text` muestra HTTP, duración y, ante un error, **Detalle recibido (filtrado)**: código, estado y mensaje del proveedor. Solo lo hace en esta prueba sintética, sin documentos ni datos de clientes. Oculta la clave configurada, URLs y patrones de credenciales, limita el mensaje a 500 caracteres y no imprime metadatos completos. Una respuesta 503 sin error JSON estructurado se identifica sin mostrar HTML. Este diagnóstico no altera las respuestas del panel ni corrige por sí mismo la disponibilidad externa. AI Studio y una clave de API pueden tener cuotas, permisos o rutas de servicio diferentes; que uno funcione no valida el otro.


### Especialidad Penal

Penal está disponible en la clasificación de consultas y documentos de Gemini, el esquema validado, el selector de especialidad del caso, las áreas públicas y los perfiles del equipo. Tras actualizar con la aplicación detenida, ejecutar `npm run db:init`: añade Penal al final de los ENUM existentes de casos y especialidades de abogados, conservando valores, orden, registros y responsables. Se puede repetir la migración.

En **Equipo**, Gerencia marca **Penal**, activa disponibilidad y guarda el perfil de quienes atienden esa especialidad. Se admiten las seis especialidades simultáneamente. Las consultas nuevas clasificadas Penal pueden asignarse por menor carga entre los abogados disponibles de esa área. Los casos anteriores no se reclasifican ni reasignan automáticamente: el equipo puede seleccionar Penal manualmente en Consultas y, si no tienen responsable, pulsar **Asignar automáticamente**. Sin abogado disponible el caso queda pendiente de asignación. Los cambios y versiones usan el historial existente.

Esto no cambia la disponibilidad de Google: un error de Gemini conserva el caso/documento y permite revisión manual, aunque Penal ya esté configurado.

Verificación: `npm test`, `npm run build` y, desde `server/`, `node scripts/assignment-smoke.js` (Laboral por defecto). Para Penal, en PowerShell: `$env:SMOKE_SPECIALTY = "Penal"`, después `node scripts/assignment-smoke.js` y finalmente `Remove-Item Env:SMOKE_SPECIALTY`. Requiere MySQL de prueba sin otros perfiles disponibles del área probada, usa la API temporal 3002 y Gemini simulado, comprueba clasificación de texto/PDF, asignación, revisión manual e historial/versiones y limpia sus datos.
