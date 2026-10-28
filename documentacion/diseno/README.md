# Diseño de las pantallas

La identidad utiliza negro carbón y dorado, aproximados a partir de la referencia visual aportada por el autor, junto con fondos claros y una jerarquía de texto más legible. No son valores certificados de un manual de marca. Las páginas de entrada tienen una cabecera horizontal; el panel conserva la navegación lateral del equipo.

- [Formulario del cliente — escritorio](formulario.png).
- [Formulario del cliente — móvil](formulario-movil.png).
- [Acceso del equipo — escritorio](login.png).

Estas vistas previas muestran formularios vacíos, sin datos personales. Los menús, permisos y accesos separados siguen vigentes. La pantalla de acceso permite mostrar/ocultar la contraseña y vuelve a ocultarla al cambiar la sesión.

El estilo compartido también actualiza panel, perfiles, cuenta, plazos, documentos, evaluaciones, historial, versiones y páginas privadas del cliente. Se revisó el recorrido funcional con MySQL real y servicios externos simulados y la adaptación móvil (incluido un ancho de 320 px en login, equipo, cuenta y plazos). No constituye una auditoría formal de accesibilidad ni una medición de satisfacción de usuarios.

Código visual: `client/src/design.css`; estructura de las entradas: `client/src/main.jsx`. El archivo de estilos se carga después de la base para mantener los ajustes agrupados.

La cabecera identifica al estudio como Núñez Saldaña · ABOGADOS SAC y conserva LegalTriage AI como nombre del sistema. El símbolo gráfico original queda pendiente de recibir como archivo; no se ha redibujado ni sustituido por una reproducción generada. Las vistas previas muestran la versión tipográfica actual.
