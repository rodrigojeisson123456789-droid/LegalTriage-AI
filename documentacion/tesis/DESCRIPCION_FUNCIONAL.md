# LegalTriage AI: descripción funcional y alcance de la solución

Documento de apoyo para redactar y explicar la tesis. Describe la implementación del repositorio en la versión `1f21fe648e6c6412a0aea442663326eaabb436ad`. No sustituye la observación del procedimiento actual del estudio ni presenta resultados de ahorro de tiempo.

## 1. Problema planteado y aspecto pendiente de verificar

El autor señala, de forma preliminar, que localizar los documentos de una persona puede tomar tiempo. Esta apreciación permite plantear la búsqueda documental como un problema por investigar, pero todavía no permite determinar su duración, frecuencia, causas o impacto. El procedimiento manual real está pendiente de observar: no se ha confirmado si se utiliza papel, Word, Excel, correo u otra combinación de herramientas.

La solución propuesta centraliza la consulta, su documento original y las actuaciones de atención inicial dentro de un registro de caso. Con ello se busca facilitar la consulta de antecedentes, la derivación por especialidad y el seguimiento de las acciones del equipo. Que estas funciones estén implementadas no demuestra por sí solo una reducción de tiempo; esa mejora deberá evaluarse mediante tareas equivalentes y observaciones registradas.

## 2. Descripción general de la propuesta

LegalTriage AI es una aplicación web que apoya la recepción y gestión inicial de consultas jurídicas. El cliente registra sus datos, describe la situación y puede adjuntar un documento. La aplicación conserva la información en MySQL y solicita a Gemini una clasificación o un análisis orientativo, cuando el servicio está disponible. El equipo revisa los antecedentes, puede solicitar aclaraciones, asignar al abogado correspondiente y preparar una respuesta, propuesta o cotización.

La atención se mantiene bajo control humano. El sistema no determina la admisibilidad jurídica de una consulta ni reemplaza el criterio profesional. Una clasificación sugerida puede revisarse manualmente; las referencias extraídas deben contrastarse con el archivo original y las fechas mencionadas no se convierten automáticamente en plazos procesales.

La integración utiliza la API de Gemini con instrucciones y un esquema de respuesta validado. No se ha entrenado un modelo propio ni implementado búsqueda automática de jurisprudencia o normativa externa. El comportamiento depende también de la disponibilidad y las condiciones del proveedor.

## 3. Participantes y responsabilidades

| Participante | Intervención en el sistema | Límite de acceso |
|---|---|---|
| Cliente | Registra una consulta y, mediante enlaces privados, responde aclaraciones o consulta la comunicación aprobada. | Los enlaces no otorgan acceso al panel interno ni a las conclusiones privadas del abogado. |
| Gerencia | Administra cuentas, roles, perfiles y especialidades; consulta todos los casos y puede intervenir en su atención. | La administración no sustituye la revisión profesional de la información generada por IA. |
| Soporte | Consulta la recepción, tramita aclaraciones, revisa especialidades y participa en la asignación de responsables. | No accede a las evaluaciones jurídicas internas ni a sus versiones; no registra plazos. |
| Abogado | Atiende sus casos asignados, revisa documentos, registra evaluaciones, aprueba decisiones y registra plazos. | No consulta casos ajenos ni reasigna responsables mediante las operaciones reservadas a Gerencia/Soporte. |
| Gemini | Sugiere una especialidad y genera un análisis estructurado del documento y contexto recibido. | No aprueba respuestas, decide el cierre ni registra vencimientos automáticamente. |

El sistema permite que una cuenta de Gerencia atienda casos si tiene un perfil disponible. Soporte no recibe asignaciones jurídicas automáticas.

## 4. Funciones implementadas

| Código | Función | Comportamiento observable y alcance |
|---|---|---|
| F01 | Recepción y registro | Formulario con datos de contacto, descripción y consentimiento. Admite un adjunto opcional: PDF de hasta 50 páginas, PNG o JPG, con máximo de 8 MB. El formato se comprueba por el contenido. |
| F02 | Consulta documental | El equipo autorizado puede localizar el caso, consultar su información y descargar el documento original. Un abogado accede solo a documentos de sus casos asignados. |
| F03 | Clasificación asistida | Categorías Civil, Corporativo, Familia, Bancario, Laboral y Penal; Indeterminado se utiliza cuando se requiere revisión. La clasificación puede revisarse manualmente. |
| F04 | Análisis con Gemini | Presenta resumen, tipo de documento, legibilidad, hallazgos y fechas con referencias de página e información faltante. Los errores externos conservan el documento y permiten revisión manual/reintento. |
| F05 | Asignación por especialidad | Elige entre abogados disponibles del área con menor número de casos activos; en empate utiliza el identificador. Sin perfil coincidente, el caso queda pendiente. No cambia automáticamente un responsable ya asignado. |
| F06 | Aclaraciones | El equipo redacta o adapta preguntas y crea un enlace privado de un uso, con vigencia de siete días. La respuesta se incorpora al mismo caso. En esta etapa la respuesta del cliente es textual. |
| F07 | Evaluación y comunicación | Borrador con fundamentos internos y respuesta, propuesta o cotización. La cotización requiere importe en soles. El equipo revisa y confirma la aprobación; el contenido aprobado queda bloqueado para edición. |
| F08 | Decisión y plazos | El profesional elige seguimiento judicial o cierre de atención inicial. Los plazos se registran manualmente y se muestran alertas visuales según proximidad. No hay cálculo automático de días hábiles o vencimientos legales. |
| F09 | Notificación y respuesta privada | El envío por Gmail es una acción explícita del equipo; también existe vista previa sin envío. El cliente consulta la comunicación aprobada por enlace privado con vigencia de treinta días. Aceptación SMTP no confirma entrega ni lectura. |
| F10 | Historial y versiones | Registra acciones con fecha, actor y metadatos; conserva copias de evaluaciones y análisis completados para consultarlas después. Las copias son de solo lectura y respetan los permisos. |
| F11 | Equipo y acceso | Gerencia configura las seis especialidades y la disponibilidad. Hay acceso por rol, contraseñas almacenadas con bcrypt y cambio/restablecimiento con revocación de sesiones anteriores. |

La aplicación constituye una gestión de atención inicial y seguimiento registrado por el equipo. El cierre de atención inicial no equivale a concluir automáticamente un proceso judicial completo.

## 5. Correspondencia con el diagrama de flujo

El diagrama debe reflejar las intervenciones humanas y las automatizaciones efectivamente implementadas. Se recomienda mantener las siguientes distinciones al explicarlo o actualizarlo:

| Etapa del diagrama | Implementación actual | Precisión necesaria en la tesis |
|---|---|---|
| Completar formulario y adjuntar documentos | Registro público y un archivo opcional por consulta. | Esta versión no es una carga múltiple de expedientes. |
| Recibir y analizar la consulta | Validación de campos/archivo y clasificación/análisis con Gemini. | Validar el formulario no equivale a declarar que la consulta es jurídicamente válida o clara. |
| Solicitar aclaración cuando falta información | El análisis puede señalar datos faltantes; el equipo revisa y crea la solicitud. | La selección de preguntas y el envío no son un rechazo o una aclaración automática decididos por la IA. |
| Registrar, clasificar y derivar | Persistencia del caso, categoría revisable y asignación por especialidad/carga cuando hay perfiles disponibles. | No se garantiza un responsable automático si no existe un abogado elegible. |
| Evaluar antecedentes y elaborar propuesta | Evaluación del abogado, borradores y aprobación explícita. | Gemini no emite la aprobación profesional. |
| Registrar fechas y alertas | Registro manual por Gerencia o abogado autorizado y alertas visuales. | Las fechas extraídas del PDF no se convierten en alertas sin verificación humana; no se envían recordatorios automáticos de plazos por Gmail. |
| Cerrar atención y notificar al cliente | Decisión aprobada, enlace privado y envío explícito configurado por Gmail. | El seguimiento judicial puede continuar; Gmail depende de configuración, servicio y una acción del equipo. |

## 6. Conservación de información y continuidad

La consulta y su documento se guardan en MySQL. El archivo original no se publica como una carpeta abierta: su descarga pasa por controles de acceso. Cuando falla Gemini, el sistema conserva el caso y el documento; si existía un análisis anterior válido, un reintento fallido no lo elimina. Esto permite continuar con aclaraciones y evaluación manual.

El historial conserva las acciones registradas desde su incorporación. Las versiones permiten leer el contenido de una evaluación o análisis guardado sin modificar el contenido actual. Al activar las versiones se puede conservar el contenido vigente como captura inicial, pero no se reconstruyen textos que ya fueron sobrescritos antes de esa funcionalidad. Las copias de contenido se almacenan separadamente de los metadatos generales del historial.

Los enlaces del cliente se almacenan mediante una huella del token y tienen vigencia y restricciones. Poseer uno de esos enlaces no acredita identidad civil. La protección de la aplicación requiere además medidas de despliegue, copias de seguridad y operación adecuadas; no se afirma que exista una auditoría de seguridad integral ni un registro inviolable frente al administrador de la base de datos.

En desarrollo, una dirección localhost solo funciona desde el equipo donde se ejecuta el sistema. La atención a clientes externos requiere un despliegue accesible por HTTPS, configuración del origen público y medidas de protección del servidor y de MySQL.

## 7. Arquitectura resumida

La interfaz está desarrollada con React y Vite. El servidor utiliza Node.js y Express para autenticación, permisos, validaciones y operaciones del caso. MySQL conserva los registros, documentos, aclaraciones, evaluaciones, plazos e historial. Gemini se consulta desde el servidor por HTTPS; la clave no se entrega al navegador. El correo se integra mediante Nodemailer y Gmail cuando se habilita ese modo.

Este diseño mantiene la decisión jurídica en el equipo profesional y concentra la interacción con proveedores externos en el backend. Los errores de un proveedor pueden impedir la función dependiente de él, aunque las funciones locales continúen disponibles.

## 8. Evidencia disponible y límites de la evaluación

| Evidencia | Qué permite sostener | Qué no permite concluir |
|---|---|---|
| Informe funcional del 25 de octubre de 2026 | Registra 22 pruebas unitarias, nueve grupos de integración y once comprobaciones de navegador en la versión allí identificada; incluye capturas y registros. | No demuestra la precisión real de Gemini ni entrega real de Gmail, porque se simularon esos proveedores. |
| Comprobación posterior de Penal | En la implementación de Penal se verificaron 25 pruebas unitarias, compilación, asignación con MySQL y Gemini simulado y perfiles/selectores en navegador. | No actualiza retrospectivamente las cifras del informe anterior ni constituye medición de atención humana. |
| Confirmación del autor en su laptop | El autor informó que pudo consultar versiones y que Penal funcionaba en los perfiles, asignación e historial. | Es una comprobación reportada por el autor; no es una muestra de usuarios o evaluación independiente de usabilidad. |
| Incidencia de Gemini | El autor compartió un HTTP 503 con mensaje de alta demanda al probar la API. | No permite afirmar una indisponibilidad permanente ni inferir que el cambio de internet sea la causa. |
| Práctica de localización documental | El autor declaró 20 segundos en un ejercicio de práctica. | No es un tiempo validado del estudio, no tiene par manual equivalente y no permite calcular ahorro. |
| Ficha de medición | Instrumento vacío para registrar pares comparables y documentar fallos e incidencias. | Una plantilla preparada no equivale a datos observados ni a resultados estadísticos. |

No se ejecutó una nueva batería de pruebas para redactar este documento; se describen las comprobaciones previas y las fuentes del repositorio. Las cifras corresponden a sus respectivas versiones y alcances.

## 9. Trabajo pendiente para completar la evaluación de la tesis

Primero debe observarse y describirse el procedimiento actual del estudio, identificar cómo se almacenan y localizan los documentos y acordar tareas equivalentes. Después se podrá aplicar la ficha de medición a casos ficticios preparados, conservar evidencias y analizar tiempos, errores y bloqueos por tarea.

La muestra y el método definitivo deben validarse con el asesor. Un piloto pequeño sirve para revisar el instrumento y describir observaciones; por sí solo no prueba una mejora causal general. Los análisis con Gemini real quedan pendientes de una sesión en la que el proveedor responda. Cualquier evaluación jurídica del resultado requiere participación profesional.

## 10. Texto breve de apoyo para la redacción

> La propuesta consiste en una aplicación web para centralizar la recepción y atención inicial de consultas jurídicas. El sistema permite registrar datos y documentos, apoyar la clasificación por especialidad mediante Gemini, asignar responsables según disponibilidad y carga, gestionar aclaraciones y conservar evaluaciones y versiones anteriores. La aprobación de respuestas, la decisión sobre el seguimiento y el registro de plazos permanecen bajo responsabilidad del equipo jurídico. Las pruebas funcionales disponibles respaldan los escenarios comprobados en las versiones documentadas; la reducción de tiempos permanece pendiente de evaluación comparativa con el procedimiento actual observado.

Este texto debe adaptarse a la estructura y terminología aprobadas para la tesis. No incorpora porcentajes de mejora ni describe como observado un procedimiento manual que todavía no se conoce.

## Fuentes de respaldo

- [Guía técnica del proyecto](../../README.md).
- [Informe funcional y evidencias del 25 de octubre](../pruebas/2026-10-25/README.md).
- [Ficha y protocolo para medir tiempos](../medicion-tiempos/README.md).
- Código: `server/src/domain.js`, `documents.js`, `assignment.js`, `access.js`, `clarifications.js`, `evaluations.js`, `notifications.js`, `history.js`, `versions.js` e `index.js`.
- Pruebas reproducibles: `server/test/` y `server/scripts/*-smoke.js`; condiciones de ejecución descritas en el README.
