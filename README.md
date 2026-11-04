# LegalTriage AI

Aplicación web para la recepción y atención inicial de consultas en **Núñez Saldaña S.A.C.** React 19 y Vite en la interfaz; Node.js/Express y MySQL 8.4 en el servidor, con Gemini y Gmail configurables.

Permite registrar consultas y documentos, clasificar por especialidad, asignar responsables, gestionar aclaraciones, aprobar respuestas, consultar versiones y controlar plazos. El adjunto se guarda pendiente de revisión: el abogado asignado o Gerencia decide cuándo analizarlo con Gemini. La clasificación inicial utiliza solo la descripción para orientar la asignación; el equipo jurídico revisa los resultados y confirma las fechas.

## Encender una instalación existente

Abre Docker Desktop y, desde la carpeta del proyecto, ejecuta:

```powershell
docker compose --env-file server/.env up -d
npm run dev
```

Espera a **LegalTriage API iniciada** antes de usar el panel.

- Cliente: [http://localhost:5173/consulta](http://localhost:5173/consulta).
- Equipo: [http://localhost:5173/equipo/login](http://localhost:5173/equipo/login).

Para detener: **Ctrl+C** en la terminal y `docker compose --env-file server/.env stop`. Los datos permanecen en el volumen de MySQL.

## Primera instalación

Requiere Node.js 22 o superior y Docker con Compose, o MySQL 8 configurado.

1. Ejecuta `npm ci`.
2. Crea `server/.env` a partir de `server/.env.example` **solo si todavía no existe** y configura tus credenciales.
3. Inicia MySQL con el comando de Docker anterior y espera que esté saludable.
4. Ejecuta `npm run db:init` y crea la primera cuenta con `npm run user:create`, suministrando las variables descritas en la [referencia técnica](documentacion/REFERENCIA_TECNICA.md#inicio-local).
5. Ejecuta `npm run dev`.

Para actualizar, detén la aplicación y ejecuta `git pull origin main`. Aplica `npm run db:init` cuando la actualización incluya cambios de esquema. Mantén tus documentos de tesis editados y mediciones fuera del repositorio.

## Comandos habituales

| Comando | Uso |
|---|---|
| `npm run dev` | Iniciar frontend y API. |
| `npm test` | Pruebas automatizadas sin proveedores reales. |
| `npm run build` | Compilar la interfaz. |
| `npm run db:init` | Crear o actualizar el esquema conservando los registros. |
| `npm run gemini:text` | Comprobar generación de texto. |
| `npm run gemini:check` | Comprobar análisis de un PDF ficticio. |
| `npm run gemini:models` | Consultar los modelos accesibles. |
| `npm run mail:check` | Comprobar conexión/autenticación de Gmail sin enviar correo. |

Los diagnósticos de Gemini usan la clave local y pueden consumir cuota. Las pruebas de integración están separadas en [su guía](documentacion/pruebas/README.md).

## Organización

```text
client/                     Interfaz React y estilos
server/src/                 API y lógica de la aplicación
server/test/                Pruebas unitarias
server/scripts/diagnostics/  Comprobaciones de Gemini y Gmail
server/scripts/integration/  Pruebas con MySQL y navegador
documentacion/              Guías, tesis, diagramas y evidencias
compose.yaml                MySQL en Docker
```

## Documentación

- [Índice de documentación](documentacion/README.md).
- [Configuración, módulos y permisos](documentacion/REFERENCIA_TECNICA.md).
- [Pruebas actuales y evidencias históricas](documentacion/pruebas/README.md).
- [Objetivos, pendientes y entregables de la tesis](documentacion/tesis/README.md).
- [Instrumento de medición](documentacion/medicion-tiempos/README.md).
- [Diseño y vistas previas](documentacion/diseno/README.md).

La implementación y las pruebas funcionales no acreditan todavía mejoras empresariales: diagnóstico, migración desde Excel, respaldo/restauración y evaluación del piloto tienen pendientes documentados en la matriz de la tesis.
