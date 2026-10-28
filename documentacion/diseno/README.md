# Diseño de las pantallas

La identidad mantiene los verdes del estudio y utiliza fondos claros, campos con mejor contraste y una jerarquía de texto más legible. Las páginas de entrada tienen una cabecera horizontal; el panel conserva la navegación lateral del equipo.

- [Formulario del cliente — escritorio](formulario.png).
- [Formulario del cliente — móvil](formulario-movil.png).
- [Acceso del equipo — escritorio](login.png).

Estas vistas previas muestran formularios vacíos, sin datos personales. Los menús, permisos y accesos separados siguen vigentes. La pantalla de acceso permite mostrar/ocultar la contraseña y vuelve a ocultarla al cambiar la sesión.

El estilo compartido también actualiza panel, perfiles, cuenta, plazos, documentos, evaluaciones, historial, versiones y páginas privadas del cliente. Se revisó el recorrido funcional con MySQL real y servicios externos simulados y la adaptación móvil (incluido un ancho de 320 px en login, equipo, cuenta y plazos). No constituye una auditoría formal de accesibilidad ni una medición de satisfacción de usuarios.

Código visual: `client/src/design.css`; estructura de las entradas: `client/src/main.jsx`. El archivo de estilos se carga después de la base para mantener los ajustes agrupados.
