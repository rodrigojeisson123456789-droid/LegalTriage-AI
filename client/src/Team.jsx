import React, { useEffect, useState } from "react";
const areas = ["Civil", "Corporativo", "Familia", "Bancario", "Laboral"];
function Member({ member, api, onSaved, user }) {
  const [role, setRole] = useState(member.role);
  const [available, setAvailable] = useState(member.available),
    [specialties, setSpecialties] = useState(member.specialties),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setAvailable(member.available);
    setSpecialties(member.specialties);
    setRole(member.role);
  }, [member.available, JSON.stringify(member.specialties), member.role]);
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
      <div className="team-role">
        <label>
          Rol de {member.name}
          <select
            value={role}
            disabled={busy || member.id === user.id}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="gerencia">Gerencia</option>
            <option value="abogado">Abogado</option>
            <option value="soporte">Soporte</option>
          </select>
        </label>
        <button
          type="button"
          disabled={busy || role === member.role || member.id === user.id}
          onClick={async () => {
            setBusy(true);
            setError("");
            setSaved(false);
            try {
              await api(`/users/${member.id}/role`, {
                method: "PUT",
                body: JSON.stringify({ role }),
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
          Guardar rol
        </button>
        {member.id === user.id && (
          <p className="help">Otra cuenta de Gerencia debe cambiar tu rol.</p>
        )}
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
            disabled={member.role === "soporte"}
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
export default function Team({ api, user }) {
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
      <NewUser api={api} onSaved={load} />
      <div className="team-grid">
        {members?.map((member) => (
          <Member
            user={user}
            key={member.id}
            member={member}
            api={api}
            onSaved={load}
          />
        ))}
      </div>
      <p className="help">
        Gerencia administra las cuentas desde esta pantalla o mediante el
        comando user:create. Soporte tramita consultas y los abogados trabajan
        en sus casos asignados.
      </p>
    </>
  );
}

function NewUser({ api, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <section className="card new-user">
      <h2>Crear cuenta del equipo</h2>
      <p className="help">
        Define un rol y una contraseña única de 12 a 128 caracteres. Compártela
        con el destinatario por un canal privado; no se envía por correo.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const input = Object.fromEntries(new FormData(form));
          setBusy(true);
          setError("");
          setMessage("");
          try {
            await api("/users", {
              method: "POST",
              body: JSON.stringify(input),
            });
            form.reset();
            await onSaved();
            setMessage(
              "Cuenta creada. Ya puede iniciar sesión con su correo y contraseña.",
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          <label>
            Nombre de la cuenta
            <input name="name" required minLength={3} maxLength={120} />
          </label>
          <label>
            Correo de acceso
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
            />
          </label>
          <label>
            Contraseña inicial
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Rol de la nueva cuenta
            <select name="role" defaultValue="soporte">
              <option value="soporte">Soporte</option>
              <option value="abogado">Abogado</option>
              <option value="gerencia">Gerencia</option>
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
