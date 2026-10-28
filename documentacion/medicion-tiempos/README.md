# Ficha de medición de tiempos — LegalTriage AI

Plantilla para un **piloto exploratorio con datos ficticios**. No contiene tiempos observados, porcentajes de mejora ni resultados de usuarios. Los nueve pares predefinidos son un plan de trabajo, no nueve pruebas realizadas.

## Primero: confirmar el procedimiento actual

La opción correcta es la que describa lo que realmente hace el estudio: papel, documentos digitales u otro procedimiento observado. Si todavía no lo conoces, deja esta parte pendiente. **No elijas Excel/Word solo porque parezca una comparación más conveniente.** Antes de presentar resultados, describe la línea base y su fuente en la pestaña Preparación y valida el alcance con tu asesor.

Si creas un método manual únicamente para practicar, identifícalo como escenario simulado; no lo presentes como procedimiento actual del estudio.

## Archivos listos para usar

- [Ficha editable en Excel](FICHA_MEDICION_TIEMPOS.xlsx): preparación, casos, tareas, registro y resumen automático.
- [Guía y ficha imprimible en PDF](GUIA_Y_FICHA_IMPRIMIBLE.pdf): una guía y una ficha vacía por par de mediciones.
- [Registro en CSV](REGISTRO_EN_BLANCO.csv): captura de datos sin fórmulas, alternativa para importar después al Excel.

La hoja Excel tiene 200 filas disponibles; las nueve primeras solo tienen códigos, orden y estado Pendiente. Las columnas de tiempo están vacías. Las medias y porcentajes se calculan al abrir/recalcular el archivo en Excel, después de completar los datos requeridos. El CSV no calcula resultados.

**Guarda una copia de trabajo fuera del repositorio antes de llenarla**, por ejemplo `D:\EvidenciasTesis\Mediciones_Piloto.xlsx`. Así podrás actualizar LegalTriage sin conflictos de Git ni riesgo de sustituir tus mediciones por la plantilla vacía.

## Qué podemos preparar mientras Gemini devuelve 503

| Código | Tarea sobre un caso preparado | Inicio | Fin verificable |
|---|---|---|---|
| T01 | Localizar y abrir el PDF original | Se entrega el código y la orden de abrirlo, desde la vista inicial acordada | PDF correcto abierto y código del caso confirmado |
| T02 | Asignar un caso ya registrado y clasificado | Se entrega el caso sin responsable y la orden de asignarlo | Responsable correcto guardado según la misma regla y disponibilidad |
| T03 | Localizar una aclaración ya recibida | Se entrega el código y se pide localizar una respuesta concreta | Respuesta correcta visible, vinculada al caso y solicitud |

En ambas modalidades deben existir previamente los mismos materiales e información. Describe el procedimiento manual real de cada tarea, su punto de partida y criterio de éxito antes de medir. Las operaciones de preparación —crear perfiles, preparar carpetas, ingresar casos, resolver el 503, practicar— quedan fuera del intervalo cronometrado.

T02 requiere un caso sin responsable: no uses uno ya asignado y midas solo leer el nombre, porque sería otra tarea. Puedes preparar un caso ficticio nuevo, dejar que se guarde aunque Gemini falle y revisar su especialidad manualmente antes de medir. La lista de abogados, especialidades, disponibilidad, cargas y regla de desempate debe ser equivalente en ambas modalidades. Prepara estados independientes para que la primera ejecución no resuelva la segunda.

T03 usa una respuesta que ya existe: no mide cuánto tarda un cliente en contestar ni requiere enviar un correo durante el intervalo.

T04 (consultar una versión anterior) es opcional. Solo se compara si el procedimiento manual real conserva esa versión. Si no existe, registra **No disponible** y **No comparable**; esto es una diferencia funcional, no un tiempo cero o un ahorro infinito.

T05 (registro y clasificación nuevos) y T06 (análisis documental con verificación humana) quedan pendientes hasta que Gemini real responda. Un intento bloqueado por 503 se registra como **Bloqueada**, con incidencia y tiempo de intento si se cronometró; no se considera análisis completado. No sustituir al proveedor real por un mock y presentar sus tiempos como rendimiento del modelo.

## Cómo hacer el piloto

1. Confirma la línea base real y el criterio de equivalencia con el asesor. Completa Preparación.
2. Prepara los tres casos ficticios propuestos (Penal, Laboral, Civil), sus materiales y referencias en Casos. No contienen datos personales ni pretenden representar todos los casos del estudio.
3. Haz una práctica por modalidad; identifica esa práctica y exclúyela del registro de resultados.
4. Usa el orden indicado por par. Se alterna manual primero y sistema primero para reducir aprendizaje; no elimina por completo ese efecto. Mantén operador, equipo, información disponible y condiciones de red comparables.
5. Cronometra segundos de reloj, preferiblemente con una persona observadora. Usa la misma precisión y criterio de inicio/fin para ambas modalidades. No restes retrospectivamente la espera del servidor ni reintentes silenciosamente: anótalos. Una interrupción externa se documenta y, si invalida la comparación, se marca No comparable; un nuevo intento usa otro número de repetición.
6. Registra el estado y tiempo medido de ambas modalidades y vincula una evidencia de cada una. Si no mediste un tiempo, deja la celda vacía; no escribas cero. Una tarea de duración inferior a la precisión del cronómetro requiere mayor precisión, no un cero usado para comparar.
7. Comprueba que los resultados sean correctos. Si hay un error o bloqueo, consérvalo. No cambies un fallo por un tiempo estimado.
8. Revisa Resumen: muestra pares válidos y, aparte, errores, bloqueos y funciones no disponibles. Revisa también incidencias y comparaciones descartadas en Mediciones; no ocultes esos registros al presentar los resultados.

No es necesario medir el proceso completo para empezar por las tareas administrativas, pero debes describir claramente que se evalúan esas tareas y no el tiempo total de atención jurídica.

## Qué completa cada columna

En Mediciones, **A:P son entradas** y **Q:S son fórmulas**. Una fila representa un par sobre el mismo caso/tarea/repetición, con un tiempo manual y otro del sistema. Usa códigos de operador, no nombres reales. La evidencia puede ser el nombre de una captura, una ficha firmada por el observador o un video con marcas de inicio/fin; no pegues enlaces privados con tokens.

El registro solo entra a la comparación si:

- Preparación contiene el procedimiento manual y su fuente de observación.
- Caso/tarea pertenecen al catálogo y la combinación caso/tarea/repetición no está duplicada.
- La repetición es un entero positivo, el orden está definido y hay operador y fecha/hora numérica.
- Ambas ejecuciones están marcadas Correcta, ambos tiempos son números mayores que cero y se confirmó comparabilidad.
- Existen referencias de evidencia manual y del sistema.

La comparabilidad debe juzgarse por las condiciones, no porque el sistema salga favorecido. Si marcas No, escribe el motivo. Un registro pendiente o inválido deja vacíos la diferencia y el porcentaje. Excel tiene validaciones de datos; pegar datos puede saltarlas, así que revisa siempre el registro.

## Interpretación sin inventar resultados

- Diferencia en segundos = tiempo manual − tiempo LegalTriage.
- Variación porcentual = diferencia / tiempo manual × 100.
- Un valor positivo indica menor tiempo con LegalTriage en ese par; uno negativo, mayor tiempo.
- Resumen calcula medias por tarea solo con pares válidos. Su porcentaje se obtiene de las medias de esa tarea; no es el promedio simple de porcentajes individuales.

No se calcula un porcentaje global mezclando tareas distintas. No se deben usar las duraciones de `npm test`, la compilación o los smoke tests como tiempos de atención de personas.

Este pequeño piloto permite revisar el instrumento y describir resultados observados. Por sí solo no prueba un efecto causal general, precisión de Gemini, exactitud jurídica, satisfacción de abogados ni mejora estadísticamente demostrada. La muestra y análisis definitivo deben acordarse con el asesor según la metodología de la tesis.

## Estado de esta entrega

Instrumento preparado; mediciones pendientes. Procedimiento manual pendiente de confirmar por el autor. No se han completado resultados ni afirmado un porcentaje de ahorro. La disponibilidad actual de Gemini debe comprobarse al iniciar cada sesión.
