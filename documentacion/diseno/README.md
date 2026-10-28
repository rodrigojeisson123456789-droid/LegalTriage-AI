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

Los accesos a documentos, historial, evaluación, aclaraciones, cambio de estado y asignación usan botones con icono, borde y foco visibles. Evaluación y respuesta tiene un tono dorado suave para distinguirla. Los textos y el indicador de dirección ocupan columnas separadas, evitando flechas sueltas. El grupo de acciones conserva las restricciones por rol y estado, y los controles deshabilitados siguen diferenciados.

[Vista de los botones del caso](acciones-caso.png). Captura de un caso ficticio durante la prueba automatizada, con Gemini y correo simulados.
