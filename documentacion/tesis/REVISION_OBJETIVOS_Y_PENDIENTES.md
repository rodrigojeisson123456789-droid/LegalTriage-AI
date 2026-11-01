# Revisión de objetivos y pendientes de la tesis

Revisión documental: **1 de noviembre de 2026**. Implementación de referencia: `4380ba0acaa75ca8cbcf17205ec528c8f21d90df`.

Este documento contrasta los objetivos de la última copia corregida compartida por el autor con el código y las comprobaciones disponibles. Es una guía de trabajo para el autor y su asesor; no aprueba cambios de alcance ni certifica que la tesis esté lista para entregar. No se asigna un porcentaje de avance: los objetivos incluyen desarrollo, diagnóstico y evaluación, con evidencias diferentes.

## 1. Resultado de la revisión

El prototipo cubre el flujo central de recepción, análisis asistido, clasificación, asignación, aclaraciones, evaluación profesional, respuesta, historial y plazos. El panel separa cliente y equipo, actualiza consultas y permite abrir el caso desde una alerta. Gmail puede enviar la respuesta aprobada y recordatorios al responsable cuando está configurado y la API permanece encendida.

El diagnóstico del procedimiento actual, la migración desde Excel y la evaluación de impacto todavía necesitan trabajo o evidencia. Las pruebas funcionales no acreditan reducción de tiempos del estudio, mejora de retención de clientes ni exactitud jurídica general de Gemini.

## 2. Revisión de los objetivos vigentes

| Objetivo | Estado y evidencia disponible | Qué falta para considerarlo cumplido |
|---|---|---|
| General: implementar una plataforma web con IA para optimizar el triaje legal y la gestión de procesos. | Implementación funcional disponible. La optimización empresarial sigue pendiente de evaluación. | Vincular cada resultado a una tarea e indicador observado y completar los pendientes del alcance aprobado. |
| OE1: analizar los procesos actuales, los cuellos de botella, las demoras mencionadas de hasta 48 horas y los errores de plazos. | Pendiente de sustentación del diagnóstico. El autor señaló demoras al buscar documentos, pero indicó que no conoce todavía el procedimiento completo. | Observar el proceso, identificar herramientas reales, documentar responsables y puntos de inicio/fin; sustentar las cifras con registros o entrevistas identificadas. Las 48 horas no se adoptan como línea base confirmada. |
| OE2: diseñar la arquitectura, clasificación mediante NLP, derivación y alertas tempranas. | Arquitectura implementada con React, Express, MySQL, Gemini y Gmail. Hay reglas de asignación por especialidad/carga y alertas 24/48 h. Se incluyen diagramas de arquitectura, datos y flujo actual. | Integrar los diagramas en el documento y validar su correspondencia con los requisitos y el asesor. Explicar que NLP se consume mediante Gemini; no se entrenó un modelo propio y los plazos los confirma el profesional. |
| OE3: desarrollar con React, Express y MySQL, integrar Gemini y migrar desde Excel. | Desarrollo e integración implementados; **migración desde Excel no implementada**. | Confirmar primero que existen datos en Excel y su estructura. Si se mantiene la migración, definir mapeo, validaciones, duplicados, prueba y recuperación. Si no corresponde al procedimiento real, acordar expresamente el ajuste con el asesor. No se elimina este compromiso de forma silenciosa. |
| OE4: evaluar reducción de respuesta, retención de clientes, trazabilidad y errores de plazos. | Hay pruebas de funcionamiento y confirmaciones del autor. No hay una evaluación empresarial con muestra e instrumentos completos. | Aplicar el piloto y la revisión profesional, comparar tareas equivalentes y documentar resultados. La retención exige definición del indicador, periodo de observación y registros de consultas/casos; un piloto breve de interfaz no la demuestra. |

Los objetivos se conservan en la copia revisada del documento. Las siguientes formulaciones son propuestas para discutir, no objetivos aprobados que sustituyan a los anteriores.

## 3. Propuesta de redacción para revisión con el asesor

**Objetivo general propuesto:** Desarrollar y evaluar una plataforma web de apoyo al triaje legal y seguimiento de plazos en Núñez Saldaña S.A.C., mediante la centralización de consultas y documentos, clasificación asistida por inteligencia artificial y revisión del equipo jurídico.

1. **Diagnóstico:** Describir el procedimiento actual de recepción, clasificación, derivación y consulta documental, e identificar sus demoras y dificultades mediante observación y entrevistas documentadas.
2. **Diseño:** Diseñar la arquitectura, el modelo de datos y el flujo de atención de la plataforma, diferenciando la asistencia de Gemini, las automatizaciones administrativas y las decisiones profesionales.
3. **Implementación:** Implementar y verificar los módulos de recepción, clasificación asistida, asignación, aclaraciones, evaluación, comunicaciones, plazos e historial; desarrollar y validar la migración desde Excel prevista en el alcance vigente.
4. **Evaluación:** Evaluar el funcionamiento, la usabilidad y los tiempos/errores de tareas equivalentes mediante un piloto documentado y revisión de los resultados de IA por un abogado.

**Decisiones de alcance pendientes:** la propuesta de OE3 conserva la migración. La propuesta de OE4 concentra la medición en tareas observables; sustituir el objetivo vigente por esa formulación supondría retirar o posponer la retención de clientes y requiere un acuerdo explícito con el asesor. Si se mantiene retención, debe añadirse su seguimiento con datos y periodo adecuados. La elección de Python tampoco debe presentarse como requisito cumplido: el backend principal utiliza JavaScript/Node.js.

## 4. Qué ya se puede documentar como implementado

- Formulario público y portal privado del equipo; permisos de Gerencia, Soporte y Abogado.
- Registro y descarga privada de un adjunto PDF/PNG/JPG por consulta.
- Clasificación en seis especialidades y estado Indeterminado para revisión; análisis documental estructurado y verificable por página.
- Asignación al abogado disponible de la especialidad con menor carga activa; desempate por identificador.
- Solicitudes de aclaración y respuesta textual privada; reanálisis con hasta las 20 respuestas más recientes y registro del contexto enviado.
- Evaluaciones, respuesta/propuesta/cotización, aprobación profesional y elección de seguimiento judicial o cierre de atención inicial.
- Historial de acciones y versiones de evaluaciones/análisis para lectura, con controles de acceso.
- Registro manual de fechas verificadas, tiempo restante y alertas en Consultas/Control de plazos con acceso al caso exacto.
- Gmail configurado: respuesta aprobada automática y recordatorios al responsable en la etapa vigente de 48 h, 24 h o vencimiento; reservas persistentes para evitar repetir intentos.
- Actualización de datos mientras el panel está visible, al volver a la pestaña o recuperar conexión; cambio/restablecimiento de contraseña con revocación de sesiones anteriores.

Estas funciones no acreditan por sí mismas eficiencia empresarial. El historial no es inviolable frente a un administrador de MySQL, una respuesta aprobada no dispone de reapertura y el sistema no calcula reglas jurídicas de vencimiento. Gmail requiere servidor e Internet; aceptación SMTP no acredita entrega ni lectura.

## 5. Lista de cierre y criterio de aceptación

| Orden | Pendiente | Material o intervención necesaria | Evidencia de cierre |
|---|---|---|---|
| 1 | Confirmar objetivos y procedimiento real. | Autor, asesor y personal del estudio. Identificar si hay Excel y de dónde salen las cifras del diagnóstico. | Objetivos acordados y ficha de observación/entrevista con fecha, rol y fuente. |
| 2 | Incorporar esta revisión y las figuras actuales. | Copia del Word, diagramas y capturas ficticias con versión y procedencia. | Documento coherente, índices actualizados y revisión visual en Word. |
| 3 | Resolver la migración de Excel. | Modelo del archivo real o anonimizado y alcance acordado. | Importación controlada validada, o ajuste de objetivo autorizado por el asesor; no marcarla cumplida mientras tanto. |
| 4 | Respaldos y restauración. | Definir qué se copia, dónde se conserva, frecuencia y responsables. | Copia y restauración verificadas en otra base de prueba, incluyendo documentos e historial. Actualmente no existe esta prueba documentada ni automatización del respaldo. |
| 5 | Preparar manuales y capacitación. | Guía ilustrada por rol y tareas de práctica. | Manual versionado y constancia de capacitación realmente realizada. |
| 6 | Pilotar funcionamiento y usabilidad. | Participantes y muestra acordados; casos ficticios preparados. | Fichas con resultados, errores y comentarios; sin presentar al autor como una muestra de abogados. |
| 7 | Revisar la IA con un profesional. | Etiquetas y referencias esperadas definidas por un abogado; modelo y configuración registrados. | Comparación por caso: categoría, hechos, páginas, aclaraciones y datos faltantes. Separar fallos del proveedor y errores del modelo. |
| 8 | Medir tiempos y errores comparables. | Línea base real y ficha de medición preparada. | Pares de tareas equivalentes con tiempos, criterios de éxito e incidencias; incluir errores y bloqueos. |
| 9 | Completar costos y análisis económico. | Horas, tarifas, consumos de API/operación y beneficios medidos. | Cálculos trazables con periodo y supuestos; no usar tiempos de pruebas técnicas como ahorro humano. |
| 10 | Cerrar referencias, resultados y conclusiones. | Fuentes verificadas, instrumentos aplicados y criterio institucional. | Conclusiones vinculadas a objetivos y evidencia; limitaciones expresas y revisión del asesor. |

El despliegue público HTTPS se añade si el alcance o el piloto requieren acceso desde equipos externos. WhatsApp sigue fuera de esta etapa. No es necesario añadir más especialidades o funciones por iniciativa propia para completar el alcance: primero resolver los objetivos y las evidencias pendientes.

## 6. Evidencia disponible y cómo interpretarla

- **Implementación `4380ba0`:** la última comprobación registrada en esta sesión pasó 44 pruebas automatizadas, compilación del cliente, 13 comprobaciones de navegador y prueba de permisos. MySQL fue real; Gemini y SMTP se simularon en las pruebas automatizadas. No se ejecuta una nueva batería para esta revisión documental.
- **Recordatorios de correo:** prueba adicional con MySQL y SMTP simulado cubrió etapas, exclusiones, concurrencia, reinicio, reasignación, fallos y arranque del worker desde la API. No prueba entrega real.
- **Equipo del autor:** se compartió un diagnóstico PDF `gemini:check` con modelo efectivo `gemini-3.5-flash-lite`, HTTP 200 y duración de 3 segundos. El autor informó que la actualización, los análisis y los recordatorios funcionaban. Son comprobaciones reportadas; no una evaluación jurídica independiente o una medición empresarial.
- **Informe histórico del 25 de octubre:** mantiene sus 22 pruebas unitarias, nueve grupos de integración y once comprobaciones de navegador correspondientes a su propia versión. No se modifica para hacerle atribuir funciones posteriores.
- **Práctica de 20 segundos:** sigue excluida de la comparación; no se documentó un par manual equivalente.

No se ha demostrado una mejora del 15 % o 60 %, una pérdida de clientes del 25 %, un volumen de 20 consultas diarias ni una reducción de 48 a 4 horas. Esas cifras del borrador requieren fuentes o mediciones y no se trasladan aquí como resultados observados.

## 7. Material relacionado

- [Descripción funcional actual](DESCRIPCION_FUNCIONAL.md).
- [Diagramas de arquitectura, datos y flujo](DIAGRAMAS.md).
- [Ficha de medición y protocolo](../medicion-tiempos/README.md).
- [Informe histórico de pruebas](../pruebas/2026-10-25/README.md).
- [Guía técnica actual](../../README.md).

**Siguiente acción del autor:** confirmar con el estudio el procedimiento de registro/búsqueda y la existencia de Excel, y revisar con su asesor el alcance de migración y retención de clientes. Mientras se obtiene esa información, pueden completarse las capturas, las guías y los diagramas sin inventar resultados.
