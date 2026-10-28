export function isTeamPath(path) {
  return path === "/equipo" || path.startsWith("/equipo/");
}
export function viewPath(view) {
  return (
    {
      public: "/consulta",
      login: "/equipo/login",
      dashboard: "/equipo/consultas",
      team: "/equipo/equipo",
      account: "/equipo/cuenta",
      deadlines: "/equipo/plazos",
    }[view] || "/equipo/consultas"
  );
}
export function teamView(path) {
  return (
    {
      "/equipo/consultas": "dashboard",
      "/equipo/equipo": "team",
      "/equipo/cuenta": "account",
      "/equipo/plazos": "deadlines",
    }[path] || "dashboard"
  );
}
