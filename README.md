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
