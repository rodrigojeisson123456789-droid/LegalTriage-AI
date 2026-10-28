# Diseño de las pantallas

La identidad utiliza negro carbón y dorado, aproximados a partir de la referencia visual aportada por el autor, junto con fondos claros y una jerarquía de texto más legible. No son valores certificados de un manual de marca. Las páginas de entrada tienen una cabecera horizontal; el panel conserva la navegación lateral del equipo.

- [Formulario del cliente — escritorio](formulario.png).
- [Formulario del cliente — móvil](formulario-movil.png).
- [Acceso del equipo — escritorio](login.png).

Estas vistas previas muestran formularios vacíos, sin datos personales. Los menús, permisos y accesos separados siguen vigentes. La pantalla de acceso permite mostrar/ocultar la contraseña y vuelve a ocultarla al cambiar la sesión.

El estilo compartido también actualiza panel, perfiles, cuenta, plazos, documentos, evaluaciones, historial, versiones y páginas privadas del cliente. Se revisó el recorrido funcional con MySQL real y servicios externos simulados y la adaptación móvil (incluido un ancho de 320 px en login, equipo, cuenta y plazos). No constituye una auditoría formal de accesibilidad ni una medición de satisfacción de usuarios.

Código visual: `client/src/design.css`; estructura de las entradas: `client/src/main.jsx`. El archivo de estilos se carga después de la base para mantener los ajustes agrupados.

La cabecera identifica al estudio como Núñez Saldaña · ABOGADOS SAC y conserva LegalTriage AI como nombre del sistema. Por elección del autor se utiliza la cabecera tipográfica, sin la imagen del logo adjunto. Se mantienen la paleta negro carbón y dorado y las vistas previas de esta presentación.

## Botones y formulario de acceso

Los botones principales tienen acabado dorado sobre texto oscuro, con estados de foco, hover, clic y deshabilitado diferenciados. Las acciones secundarias usan contorno; los enlaces de acción tienen una superficie de interacción mayor. Las transiciones y el indicador de carga respetan la preferencia de movimiento reducido.

El login incorpora iconos decorativos de correo/contraseña, mostrar/ocultar contraseña, aviso de Bloq Mayús y estado Ingresando. Los errores se muestran dentro de la tarjeta de acceso y se anuncian como alerta; los campos mantienen sus etiquetas y autocompletado. La validación real de credenciales y los roles siguen en el servidor. Se verificaron ingreso incorrecto seguido de ingreso correcto, recarga, navegación atrás y el recorrido funcional con proveedores simulados.

- [Acceso del equipo en móvil](login-movil.png).

## Acciones de cada caso

Los accesos a documentos, historial, evaluación, aclaraciones, cambio de estado y asignación usan botones con icono, borde y foco visibles. Evaluación y respuesta se distingue con fondo carbón e icono dorado. Los textos y el indicador de dirección ocupan columnas separadas, evitando flechas sueltas. El grupo de acciones conserva las restricciones por rol y estado, y los controles deshabilitados siguen diferenciados.

[Vista de los botones del caso](acciones-caso.png). Captura de un caso ficticio durante la prueba automatizada, con Gemini y correo simulados.


## Panel organizado por fichas

Cada consulta se presenta como una ficha con referencia y estado en la cabecera, datos de cliente y descripción legibles, especialidad y responsable identificados, y una barra de acciones al pie. En móvil los bloques se ordenan en una columna sin desplazamiento horizontal de la ficha.

Los filtros Todas, Nuevas, En evaluación y Con aclaración operan sobre las consultas autorizadas cargadas en el panel. Todas también incluye las que están en seguimiento o cerradas. El buscador admite número de caso, cliente, especialidad o texto de la consulta. Cuando no hay coincidencias muestra una opción para restablecer filtros. Se mantiene el límite existente de 500 registros y la autorización de cada operación en el servidor.

Se comprobó el recorrido funcional, los filtros sin resultados, su restablecimiento y el diseño móvil en navegador con MySQL real y proveedores externos simulados. No hubo cambios de tablas ni migración para el rediseño.

- [Ficha en escritorio](acciones-caso.png).
- [Ficha en móvil](ficha-caso-movil.png).

Las capturas de casos usan datos ficticios y llevan la identificación de prueba simulada.
