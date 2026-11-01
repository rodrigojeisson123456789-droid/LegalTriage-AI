# LegalTriage AI: descripción funcional y alcance de la solución

Documento de apoyo para redactar y explicar la tesis. Revisión del **1 de noviembre de 2026**, sobre la implementación `4380ba0acaa75ca8cbcf17205ec528c8f21d90df`. Sustituye la descripción funcional anterior; el informe de pruebas del 25 de octubre conserva su propia versión y cifras. No sustituye la observación del procedimiento actual del estudio ni presenta resultados de ahorro de tiempo. Ver también la [revisión de objetivos y pendientes](REVISION_OBJETIVOS_Y_PENDIENTES.md).

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
| F04 | Análisis con Gemini | Presenta resumen, tipo de documento, legibilidad, hallazgos y fechas con referencias de página e información faltante. Los errores externos conservan el documento y permiten revisión manual/reintento. El reanálisis registra cuáles aclaraciones se enviaron y avisa si hay respuestas recientes sin incorporar. |
| F05 | Asignación por especialidad | Elige entre abogados disponibles del área con menor número de casos activos; en empate utiliza el identificador. Sin perfil coincidente, el caso queda pendiente. No cambia automáticamente un responsable ya asignado. |
| F06 | Aclaraciones | El equipo redacta o adapta preguntas y crea un enlace privado de un uso, con vigencia de siete días. La respuesta se incorpora al mismo caso. En esta etapa la respuesta del cliente es textual. |
| F07 | Evaluación y comunicación | Borrador con fundamentos internos y respuesta, propuesta o cotización. La cotización requiere importe en soles. El equipo revisa y confirma la aprobación; el contenido aprobado queda bloqueado para edición. |
| F08 | Decisión y plazos | El profesional elige seguimiento judicial o cierre de atención inicial. Los plazos se registran manualmente y se muestran alertas visuales según proximidad. No hay cálculo automático de días hábiles o vencimientos legales. |
| F09 | Notificación y respuesta privada | Con Gmail y MAIL_AUTO_RESPONSE habilitados, aprobar la evaluación envía automáticamente la respuesta ya revisada por el profesional. Las aclaraciones y envíos adicionales mantienen acciones explícitas; hay vista previa sin envío. El cliente consulta la comunicación aprobada por enlace privado de treinta días. Aceptación SMTP no confirma entrega ni lectura. |
| F10 | Historial y versiones | Registra acciones con fecha, actor y metadatos; conserva copias de evaluaciones y análisis completados para consultarlas después. Las copias son de solo lectura y respetan los permisos. |
| F11 | Equipo y acceso | Gerencia configura las seis especialidades y la disponibilidad. Hay acceso por rol, contraseñas almacenadas con bcrypt y cambio/restablecimiento con revocación de sesiones anteriores. |
| F12 | Portales y actualización | /consulta recibe al cliente; /equipo/* es privado. El panel actualiza datos cada diez segundos mientras está visible, al volver a la pestaña o recuperar conexión; permite actualizar manualmente. Respeta permisos y filtros. |
| F13 | Recordatorios de plazos | La API configurada revisa etapas de 48 h, 24 h o vencimiento y puede avisar por Gmail al abogado/Gerencia responsable. Guarda una reserva por plazo, destinatario y etapa. La alerta visual aparece solo en Consultas y Control de plazos y permite abrir el caso exacto. La API debe permanecer encendida. |

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
| Registrar fechas y alertas | Registro manual por Gerencia o abogado autorizado y alertas visuales. | Las fechas extraídas del PDF no se convierten en plazos sin verificación humana. Gmail puede recordar los plazos registrados al responsable si se activa MAIL_DEADLINE_REMINDERS y la API está encendida; las atenciones iniciales cerradas quedan excluidas. |
| Cerrar atención y notificar al cliente | Decisión aprobada, enlace privado y envío automático de la respuesta aprobada si se configura. | El seguimiento judicial puede continuar; el abogado aprueba el contenido antes del envío. Gmail depende de configuración y servicio. |

## 6. Conservación de información y continuidad

La consulta y su documento se guardan en MySQL. El archivo original no se publica como una carpeta abierta: su descarga pasa por controles de acceso. Cuando falla Gemini, el sistema conserva el caso y el documento; si existía un análisis anterior válido, un reintento fallido no lo elimina. Esto permite continuar con aclaraciones y evaluación manual.

El historial conserva las acciones registradas desde su incorporación. Las versiones permiten leer el contenido de una evaluación o análisis guardado sin modificar el contenido actual. Al activar las versiones se puede conservar el contenido vigente como captura inicial, pero no se reconstruyen textos que ya fueron sobrescritos antes de esa funcionalidad. Las copias de contenido se almacenan separadamente de los metadatos generales del historial.

Los enlaces del cliente se almacenan mediante una huella del token y tienen vigencia y restricciones. Poseer uno de esos enlaces no acredita identidad civil. La protección de la aplicación requiere además medidas de despliegue, copias de seguridad y operación adecuadas; no se afirma que exista una auditoría de seguridad integral ni un registro inviolable frente al administrador de la base de datos.

En desarrollo, una dirección localhost solo funciona desde el equipo donde se ejecuta el sistema. La atención a clientes externos requiere un despliegue accesible por HTTPS, configuración del origen público y medidas de protección del servidor y de MySQL.

El contexto de un análisis completado conserva hasta las veinte aclaraciones respondidas más recientes, por fecha de respuesta, del mismo caso. Las preguntas y respuestas enviadas se pueden consultar y acompañan a la versión del análisis. Una respuesta que llega durante la generación se detecta como pendiente en la consulta posterior; un fallo no sustituye el análisis válido anterior ni su contexto. Mostrar que una respuesta se envió no garantiza que Gemini la haya interpretado correctamente.

Los recordatorios de correo se reservan antes del envío para evitar repetir un intento después de un reinicio o entre procesos concurrentes. Los resultados rechazados, inciertos o pendientes requieren revisión del registro y buzón; no se reintentan automáticamente para esa misma etapa. Si el servidor inicia tarde, se procesa solo la etapa vigente. No se garantiza entrega exactamente una vez ni se instala un servicio de inicio automático del sistema.

## 7. Arquitectura resumida

La interfaz está desarrollada con React y Vite. El servidor utiliza Node.js y Express para autenticación, permisos, validaciones y operaciones del caso. MySQL conserva los registros, documentos, aclaraciones, evaluaciones, plazos e historial. Gemini se consulta desde el servidor por HTTPS; la clave no se entrega al navegador. El correo se integra mediante Nodemailer y Gmail cuando se habilita ese modo.

El esquema actual contiene trece tablas y diecinueve claves foráneas. Incluye case_events, case_versions y deadline_reminders, además de las entidades de casos y atención. Las [figuras técnicas actuales](DIAGRAMAS.md) se contrastaron con los metadatos de MySQL y setup.js; no contienen datos de expedientes.

Este diseño mantiene la decisión jurídica en el equipo profesional y concentra la interacción con proveedores externos en el backend. Los errores de un proveedor pueden impedir la función dependiente de él, aunque las funciones locales continúen disponibles.

## 8. Evidencia disponible y límites de la evaluación

| Evidencia | Qué permite sostener | Qué no permite concluir |
|---|---|---|
| Informe funcional del 25 de octubre de 2026 | Registra 22 pruebas unitarias, nueve grupos de integración y once comprobaciones de navegador en la versión allí identificada; incluye capturas y registros. | No demuestra la precisión real de Gemini ni entrega real de Gmail, porque se simularon esos proveedores. |
| Comprobación posterior de Penal | En la implementación de Penal se verificaron 25 pruebas unitarias, compilación, asignación con MySQL y Gemini simulado y perfiles/selectores en navegador. | No actualiza retrospectivamente las cifras del informe anterior ni constituye medición de atención humana. |
| Confirmación del autor en su laptop | El autor informó que pudo consultar versiones y que Penal funcionaba en los perfiles, asignación e historial. | Es una comprobación reportada por el autor; no es una muestra de usuarios o evaluación independiente de usabilidad. |
| Incidencia y recuperación de Gemini | El autor compartió errores 503 por alta demanda y después un diagnóstico PDF exitoso con modelo efectivo gemini-3.5-flash-lite, HTTP 200 y duración de 3 s. | La latencia del diagnóstico no es tiempo total de atención ni evidencia de precisión jurídica. No prueba disponibilidad permanente. |
| Práctica de localización documental | El autor declaró 20 segundos en un ejercicio de práctica. | No es un tiempo validado del estudio, no tiene par manual equivalente y no permite calcular ahorro. |
| Ficha de medición | Instrumento vacío para registrar pares comparables y documentar fallos e incidencias. | Una plantilla preparada no equivale a datos observados ni a resultados estadísticos. |
| Comprobación de la implementación 4380ba0 | Última ejecución registrada: 44 pruebas automatizadas correctas, compilación y 13 comprobaciones de navegador; también prueba de permisos. MySQL real y Gemini/SMTP simulados. | No actualiza retrospectivamente el informe del 25 de octubre ni demuestra mejoras empresariales o entrega real. |
| Recordatorios por Gmail | Prueba con MySQL y SMTP simulado de etapas, concurrencia, reinicio, destinatario, errores y arranque automático del worker desde la API. | No certifica que Gmail entregue cada correo ni que una fecha registrada sea jurídicamente correcta. |
| Confirmación posterior del autor | El autor informó funcionamiento de análisis con aclaraciones, actualización de consultas y recordatorios en su equipo. | Confirmación reportada, no una evaluación independiente con personal del estudio ni una muestra para medir impacto. |

No se ejecutó una nueva batería de pruebas para redactar este documento; se describen las comprobaciones previas y las fuentes del repositorio. Las cifras corresponden a sus respectivas versiones y alcances.

## 9. Trabajo pendiente para completar la evaluación de la tesis

Primero debe observarse y describirse el procedimiento actual del estudio, identificar cómo se almacenan y localizan los documentos y acordar tareas equivalentes. Después se podrá aplicar la ficha de medición a casos ficticios preparados, conservar evidencias y analizar tiempos, errores y bloqueos por tarea.

La muestra y el método definitivo deben validarse con el asesor. Un piloto pequeño sirve para revisar el instrumento y describir observaciones; por sí solo no prueba una mejora causal general. Gemini real respondió en una prueba aportada por el autor; sigue pendiente evaluar sus resultados frente a categorías y referencias definidas por un profesional. La muestra, el modelo y la configuración deben registrarse. Cualquier evaluación jurídica del resultado requiere participación profesional.

La migración de Excel permanece en el objetivo tecnológico de la última copia del documento y no está implementada. Primero debe confirmarse el origen real de los datos y resolver el alcance con el asesor. Los respaldos automáticos, su restauración documentada, manuales ilustrados, capacitación formal, costos, referencias y conclusiones necesitan cierre según la [matriz de pendientes](REVISION_OBJETIVOS_Y_PENDIENTES.md). La publicación HTTPS corresponde si el alcance requiere acceso externo.

## 10. Texto breve de apoyo para la redacción

> La propuesta consiste en una aplicación web para centralizar la recepción y atención inicial de consultas jurídicas. El sistema permite registrar datos y documentos, apoyar la clasificación por especialidad mediante Gemini, asignar responsables según disponibilidad y carga, gestionar aclaraciones y conservar evaluaciones y versiones anteriores. La aprobación de respuestas, la decisión sobre el seguimiento y el registro de plazos permanecen bajo responsabilidad del equipo jurídico. Con la configuración habilitada, Gmail distribuye la respuesta aprobada al cliente y los recordatorios de plazos al responsable. Las pruebas funcionales disponibles respaldan los escenarios comprobados en las versiones documentadas; la reducción de tiempos permanece pendiente de evaluación comparativa con el procedimiento actual observado.

Este texto debe adaptarse a la estructura y terminología aprobadas para la tesis. No incorpora porcentajes de mejora ni describe como observado un procedimiento manual que todavía no se conoce.

## Fuentes de respaldo

- [Guía técnica del proyecto](../../README.md).
- [Informe funcional y evidencias del 25 de octubre](../pruebas/2026-10-25/README.md).
- [Ficha y protocolo para medir tiempos](../medicion-tiempos/README.md).
- Código: `server/src/domain.js`, `documents.js`, `assignment.js`, `access.js`, `clarifications.js`, `evaluations.js`, `notifications.js`, `history.js`, `versions.js`, `deadline-reminders.js`, `analysis-context.js` e `index.js`.
- Pruebas reproducibles: `server/test/` y `server/scripts/*-smoke.js`; condiciones de ejecución descritas en el README.
