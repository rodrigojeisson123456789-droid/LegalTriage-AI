import React, { useEffect, useState } from "react";
const areas = ["Civil", "Corporativo", "Familia", "Bancario", "Laboral"];
function Member({ member, api, onSaved }) {
  const [available, setAvailable] = useState(member.available),
    [specialties, setSpecialties] = useState(member.specialties),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const dirty =
    available !== member.available ||
    [...specialties].sort().join() !== [...member.specialties].sort().join();
  return (
    <form
      className="card team-member"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          await api(`/team/${member.id}`, {
            method: "PUT",
            body: JSON.stringify({ available, specialties }),
          });
          await onSaved();
          setSaved(true);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="title-row">
        <div>
          <h2>{member.name}</h2>
          <p className="help">{member.email}</p>
        </div>
        <span className="tag">{member.active_cases} casos activos</span>
      </div>
      <fieldset disabled={busy}>
        <legend>Especialidades que atiende</legend>
        <div className="team-areas">
          {areas.map((area) => (
            <label key={area}>
              <input
                type="checkbox"
                checked={specialties.includes(area)}
                onChange={(e) => {
                  setSaved(false);
                  setSpecialties(
                    e.target.checked
                      ? [...specialties, area]
                      : specialties.filter((x) => x !== area),
                  );
                }}
              />
              {area}
            </label>
          ))}
        </div>
        <label className="consent">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => {
              setSaved(false);
              setAvailable(e.target.checked);
            }}
          />
          <span>Disponible para recibir asignaciones automáticas</span>
        </label>
      </fieldset>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <p role="status" className="help">
          Perfil guardado.
        </p>
      )}
      <button
        className="primary"
        disabled={busy || !dirty || (available && !specialties.length)}
      >
        {busy ? "Guardando…" : "Guardar perfil"}
      </button>
      <p className="help">
        Desactivar disponibilidad no retira los casos ya asignados.
      </p>
    </form>
  );
}
export default function Team({ api }) {
  const [members, setMembers] = useState(null),
    [error, setError] = useState("");
  async function load() {
    setMembers(await api("/team"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="eyebrow">ORGANIZACIÓN DEL ESTUDIO</div>
      <h1>
        Equipo y especialidades<span>.</span>
      </h1>
      <p className="intro">
        Activa únicamente a quienes atienden casos. La asignación elige al
        abogado disponible de la especialidad con menos casos activos; en
        empate, usa su identificador.
      </p>
      <div className="notice">
        Los usuarios sin perfil activo no reciben asignaciones automáticas. Los
        casos Indeterminados quedan para revisión manual. Un caso activo es
        cualquiera cuya atención inicial no esté cerrada.
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!members && !error && <p>Cargando equipo…</p>}
      <div className="team-grid">
        {members?.map((member) => (
          <Member key={member.id} member={member} api={api} onSaved={load} />
        ))}
      </div>
      <p className="help">
        Esta pantalla configura usuarios existentes; para crear una cuenta
        utiliza el comando user:create descrito en el README. Todos los usuarios
        internos mantienen los mismos permisos en esta versión.
      </p>
    </>
  );
}
