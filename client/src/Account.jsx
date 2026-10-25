import React, { useState } from "react";
export default function Account({ api, user, onPasswordChanged }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [show, setShow] = useState(false);
  return (
    <section className="card account-card">
      <div className="eyebrow">ACCESO PERSONAL</div>
      <h1>
        Mi cuenta<span>.</span>
      </h1>
      <p>
        {user.name} ·{" "}
        {user.role === "gerencia"
          ? "Gerencia"
          : user.role === "abogado"
            ? "Abogado"
            : "Soporte"}
      </p>
      <p className="help">
        Elige una contraseña de al menos 8 caracteres. No se exigen mayúsculas,
        números ni símbolos. El cambio cerrará tus sesiones anteriores.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {done ? (
        <div className="success">
          <h2>Contraseña actualizada</h2>
          <p>
            Se conservaron tu cuenta y tus casos. Vuelve a ingresar con la nueva
            contraseña.
          </p>
          <button className="primary" onClick={() => window.location.reload()}>
            Volver a iniciar sesión
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = Object.fromEntries(new FormData(form));
            if (data.password !== data.confirmation) {
              setError("Las contraseñas nuevas no coinciden.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await api("/me/password", {
                method: "PUT",
                body: JSON.stringify(data),
              });
              form.reset();
              setShow(false);
              setDone(true);
              onPasswordChanged?.();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Contraseña actual
            <input
              name="current_password"
              type={show ? "text" : "password"}
              required
              maxLength={200}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <label>
            Nueva contraseña
            <input
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
          <label>
            Repite tu nueva contraseña
            <input
              name="confirmation"
              type={show ? "text" : "password"}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              disabled={busy}
            />
            <span>Mostrar contraseñas mientras escribo</span>
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Cambiar mi contraseña"}
          </button>
          <p className="help">
            Si olvidaste la contraseña actual, solicita a Gerencia que la
            restablezca desde Equipo.
          </p>
        </form>
      )}
    </section>
  );
}
