# Material para revisar y completar la tesis

Revisión documental del 1 de noviembre de 2026, con referencia a la implementación `4380ba0`. Estos archivos ayudan a cerrar la documentación; no contienen mediciones empresariales nuevas ni declaran la tesis aprobada.

1. Empezar por [Revisión de objetivos y pendientes](REVISION_OBJETIVOS_Y_PENDIENTES.md), también disponible en [Word](REVISION_OBJETIVOS_Y_PENDIENTES.docx) y [PDF](REVISION_OBJETIVOS_Y_PENDIENTES.pdf). Contrasta cada objetivo vigente, propone redacciones para discutir y define qué evidencia falta.
2. Utilizar la [Descripción funcional actual](DESCRIPCION_FUNCIONAL.md), también en [Word](DESCRIPCION_FUNCIONAL.docx) y [PDF](DESCRIPCION_FUNCIONAL.pdf), para actualizar las secciones de implementación, alcance y limitaciones.
3. Incorporar los [diagramas de arquitectura, datos y flujo](DIAGRAMAS.md), con fuentes editables y figuras PNG/SVG. Las relaciones se comprobaron contra el esquema; los diagramas no observan ni sustituyen el proceso manual del estudio.
4. Preparar la evaluación con la [ficha de medición](../medicion-tiempos/README.md). Registrar observaciones reales y conservar fuera del repositorio la copia que se rellene.

Los documentos públicos de esta carpeta no incluyen el Word académico personal completo. La copia revisada del documento compartido se conserva como entrega aparte, manteniendo intactos el original y la corrección anterior. El autor debe revisar las propuestas con su asesor y actualizar índices/paginación en Word antes de la entrega.

Los objetivos originales se mantienen hasta resolver su alcance: la migración desde Excel sigue pendiente y la retención de clientes exige seguimiento específico si se conserva como indicador. Las cifras de 48 horas, 20 consultas diarias, pérdida del 25 % o mejoras porcentuales del borrador no se consideran verificadas sin sus fuentes.

Para regenerar los Word de apoyo con su formato de tablas, usar Python 3, `python-docx` y Pandoc instalados, desde la raíz:

```sh
python documentacion/tesis/generar_word.py
```

También se puede generar una versión de contenido con el formato predeterminado de Pandoc:

```sh
pandoc documentacion/tesis/DESCRIPCION_FUNCIONAL.md -o documentacion/tesis/DESCRIPCION_FUNCIONAL.docx
pandoc documentacion/tesis/REVISION_OBJETIVOS_Y_PENDIENTES.md -o documentacion/tesis/REVISION_OBJETIVOS_Y_PENDIENTES.docx
```

Las figuras se regeneran mediante `python documentacion/tesis/generar_diagramas.py`, con Python 3 y Graphviz. Los PDF se exportan desde los Word mediante Word o LibreOffice; si se cambia el contenido, volver a exportarlos. Las herramientas de documentación son opcionales y no añaden dependencias para ejecutar la aplicación.
