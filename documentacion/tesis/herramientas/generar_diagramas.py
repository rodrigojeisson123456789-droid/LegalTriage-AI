"""Genera figuras técnicas desde fuentes locales; requiere Graphviz (dot).

No consulta bases de datos ni incorpora filas de usuarios/casos. El esquema de
relaciones es una captura de metadatos verificada contra setup.js.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "diagramas"
schema = json.loads((OUT / "esquema-relaciones.json").read_text(encoding="utf-8"))


def quoted(value):
    return json.dumps(value, ensure_ascii=False)


def render(name, lines):
    source = OUT / f"{name}.dot"
    source.write_text("\n".join(lines) + "\n", encoding="utf-8")
    for kind in ("png", "svg"):
        subprocess.run(["dot", f"-T{kind}", str(source), "-o", str(OUT / f"{name}.{kind}")], check=True)


base = [
    "digraph G {",
    'graph [rankdir=LR,bgcolor="white",pad=0.3,nodesep=0.35,ranksep=0.6,dpi=180];',
    'node [shape=box,style="rounded,filled",fillcolor="#faf7f0",color="#ad8a4c",fontname="DejaVu Sans",fontsize=12,margin=0.16];',
    'edge [color="#68655f",fontname="DejaVu Sans",fontsize=9];',
]

architecture = {
    "cliente": "Cliente\nReact · /consulta",
    "equipo": "Gerencia / Soporte / Abogado\nReact · /equipo/*",
    "api": "Node.js + Express\nSesión, permisos, validación\nCasos y operaciones del equipo",
    "db": "MySQL 8.4 en Docker\n13 tablas · documentos\nhistorial y versiones",
    "gemini": "API de Google Gemini\nClasificación y análisis orientativo",
    "worker": "Temporizador dentro de Node.js\nRecordatorios 48 h / 24 h / vencido\nRequiere API encendida",
    "gmail": "Nodemailer → Gmail SMTP\nRespuesta aprobada y recordatorios\nAceptación ≠ entrega confirmada",
}
lines = base.copy()
lines[1] = 'graph [rankdir=TB,bgcolor="white",pad=0.3,nodesep=0.35,ranksep=0.5,dpi=180];'
for key, label in architecture.items():
    lines.append(f"{key} [label={quoted(label)}];")
for source, target, label in [
    ("cliente", "api", "Formulario / enlaces privados"),
    ("equipo", "api", "API privada / sesión HttpOnly"),
    ("api", "db", "Persistencia y controles de acceso"),
    ("api", "gemini", "HTTPS · clave solo en servidor"),
    ("api", "worker", "Al arrancar la API"),
    ("worker", "db", "Consulta y reserva persistente"),
    ("worker", "gmail", "Aviso al responsable"),
    ("api", "gmail", "Tras aprobación humana / envío explícito"),
]:
    lines.append(f"{source} -> {target} [label={quoted(label)}];")
render("arquitectura", lines + ["}"])

fields = {
    "users": "id PK",
    "cases": "id PK\nlawyer_id FK nullable",
    "documents": "id PK\ncase_id UNIQUE",
    "clarifications": "id PK",
    "evaluations": "case_id PK/FK\napproved_by FK nullable",
    "deadlines": "id PK",
    "deadline_reminders": "id PK\nrecipient_id sin FK",
    "response_links": "id PK",
    "notifications": "id PK",
    "case_events": "id PK\nactor_id FK nullable",
    "case_versions": "event_id PK/FK",
    "lawyer_profiles": "user_id PK/FK",
    "lawyer_specialties": "PK(user_id,specialty)",
}
assert set(fields) == set(schema["tables"]), "Actualizar entidades al cambiar el esquema"
lines = base.copy()
lines[1] = 'graph [rankdir=LR,bgcolor="white",pad=0.3,nodesep=0.35,ranksep=0.75,dpi=180];'
lines.append('node [fontsize=14];')
lines.append('edge [fontsize=10];')
for table in schema["tables"]:
    lines.append(f"{table} [label={quoted(table + chr(10) + fields[table])}];")
for fk in schema["foreign_keys"]:
    auxiliary = fk["parent"] == "users" and fk["child"] not in {"cases", "lawyer_profiles", "lawyer_specialties"}
    extra = ',constraint=false,color="#a8a8a8"' if auxiliary else ""
    lines.append(f'{fk["parent"]} -> {fk["child"]} [label={quoted(fk["column_name"])}{extra}];')
render("entidades", lines + ["}"])

flow = {
    "form": "Cliente registra consulta\ny adjunto opcional",
    "validate": "Validar campos, consentimiento\ny archivo (no validez jurídica)",
    "ai": "Clasificar solo la descripción\ncon Gemini si está disponible",
    "store": "Guardar caso y documento pendiente\nSi clasificación falla: Indeterminado",
    "assign": "Asignar por especialidad y carga\nSin elegible: pendiente del equipo",
    "review": "Profesional revisa antecedentes\ny documento original",
    "analyze": "Abogado asignado / Gerencia solicita\nanálisis opcional con Gemini",
    "questions": "Equipo solicita aclaración\nCliente responde por enlace privado",
    "reanalyze": "Abogado / Gerencia solicita análisis\nDocumento + respuestas guardadas",
    "approve": "Abogado redacta, revisa\ny aprueba respuesta y decisión",
    "judicial": "Seguimiento judicial\nRegistrar fechas verificadas",
    "close": "Cerrar atención inicial\nNo equivale a concluir juicio",
    "respond": "Gmail configurado: respuesta aprobada\nEnlace privado para el cliente",
    "remind": "Panel y Gmail al responsable\n48 h / 24 h / vencido",
}
lines = base.copy()
lines[1] = 'graph [rankdir=TB,bgcolor="white",pad=0.3,nodesep=0.3,ranksep=0.4,dpi=180];'
for key, label in flow.items():
    lines.append(f"{key} [label={quoted(label)}];")
for source, target, label in [
    ("form", "validate", ""), ("validate", "form", "Datos/archivo inválidos"),
    ("validate", "ai", "Entrada válida"), ("ai", "store", "Éxito o fallo conservado"),
    ("store", "assign", ""), ("assign", "review", ""),
    ("review", "analyze", "Si lo considera necesario"), ("analyze", "review", "Resultado orientativo o fallo"),
    ("review", "questions", "Si falta información"), ("questions", "reanalyze", "Reanálisis opcional"),
    ("reanalyze", "review", "Mantiene el mismo caso"), ("questions", "review", "Respuesta guardada"),
    ("review", "approve", "Criterio profesional"), ("approve", "judicial", "Decisión judicial"),
    ("approve", "close", "Decisión de cierre"), ("approve", "respond", "Aprobación explícita"),
    ("judicial", "remind", "Solo plazos registrados"),
]:
    lines.append(f"{source} -> {target} [label={quoted(label)}];")
render("flujo", lines + ["}"])

print("Generados arquitectura, entidades y flujo (DOT, PNG y SVG).")
