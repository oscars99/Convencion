import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays, Search, UserCog, Users, LogOut, ShieldCheck,
  Pencil, Plus, History, Home, AlertTriangle, MapPin, ChevronRight
} from "lucide-react";
import initialData from "./data/merged_schedule_with_viernes.json";
import type { Assignment, ChangeLog, Person, ScheduleData } from "./types/schedule";
import {
  buildAssignments, dayOrder, findConflicts, formatAreaType,
  formatDay, formatTime, getAreaTypeClass, groupAssignmentsByArea,
  groupAssignmentsByDay, normalizeText, slugifyPersonId,
  sortAssignments, uniquePeopleFromAssignments
} from "./utils/scheduleUtils";
import "./styles.css";

const STORAGE_KEY = "horario_convencion_state_v1";
const ADMIN_PASSWORD = "admin123";

type AppState = {
  people: Person[];
  assignments: Assignment[];
  changeLogs: ChangeLog[];
};

function createInitialState(): AppState {
  const typedData = initialData as ScheduleData;
  const assignments = buildAssignments(typedData);
  const people = uniquePeopleFromAssignments(assignments, typedData.people || []);
  return { people, assignments, changeLogs: [] };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return JSON.parse(raw);
  } catch {
    return createInitialState();
  }
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

type View =
  | { name: "inicio" }
  | { name: "buscar" }
  | { name: "persona"; personId: string }
  | { name: "dia"; day: string }
  | { name: "mapa" }
  | { name: "adminLogin" }
  | { name: "adminDashboard" }
  | { name: "adminHorarios" }
  | { name: "adminPersonas" }
  | { name: "adminHistorial" };

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<View>({ name: "inicio" });
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("admin_auth") === "true");

  useEffect(() => { saveState(state); }, [state]);

  const activePeople = useMemo(
    () => state.people.filter((p) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [state.people]
  );

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requireAdmin(next: View) {
    if (!isAdmin) navigate({ name: "adminLogin" });
    else navigate(next);
  }

  function login(password: string) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_auth", "true");
      setIsAdmin(true);
      navigate({ name: "adminDashboard" });
      return true;
    }
    return false;
  }

  function logout() {
    sessionStorage.removeItem("admin_auth");
    setIsAdmin(false);
    navigate({ name: "inicio" });
  }

  function updateAssignment(assignmentId: string, newPerson: Person, force = false) {
    const current = state.assignments.find((a) => a.assignment_id === assignmentId);
    if (!current) return { ok: false, conflict: [] as Assignment[] };

    const conflicts = findConflicts(state.assignments, newPerson.person_id, current.day, current.time, assignmentId);
    if (conflicts.length > 0 && !force) return { ok: false, conflict: conflicts };

    const updatedAssignments = state.assignments.map((a) =>
      a.assignment_id === assignmentId
        ? { ...a, person_id: newPerson.person_id, person_name: newPerson.name }
        : a
    );

    const log: ChangeLog = {
      change_id: `change_${Date.now()}`,
      action: "update_assignment",
      day: current.day,
      area_name: current.area_name,
      area_type: current.area_type,
      time: current.time,
      previous_person_id: current.person_id,
      previous_person_name: current.person_name,
      new_person_id: newPerson.person_id,
      new_person_name: newPerson.name,
      updated_by: "admin@convencion.local",
      updated_at: new Date().toISOString()
    };

    setState((prev) => ({
      ...prev,
      assignments: sortAssignments(updatedAssignments),
      changeLogs: [log, ...prev.changeLogs]
    }));
    return { ok: true, conflict: [] as Assignment[] };
  }

  function addPerson(name: string) {
    const cleanName = name.trim();
    if (!cleanName) return false;
    const exists = state.people.some((p) => normalizeText(p.name) === normalizeText(cleanName));
    if (exists) return false;

    const newPerson: Person = { person_id: slugifyPersonId(cleanName), name: cleanName, active: true };
    const log: ChangeLog = {
      change_id: `change_${Date.now()}`,
      action: "add_person",
      new_person_id: newPerson.person_id,
      new_person_name: newPerson.name,
      updated_by: "admin@convencion.local",
      updated_at: new Date().toISOString()
    };
    setState((prev) => ({
      ...prev,
      people: [...prev.people, newPerson].sort((a, b) => a.name.localeCompare(b.name)),
      changeLogs: [log, ...prev.changeLogs]
    }));
    return true;
  }

  function editPerson(personId: string, name: string) {
    const cleanName = name.trim();
    if (!cleanName) return;
    const current = state.people.find((p) => p.person_id === personId);
    if (!current) return;

    const log: ChangeLog = {
      change_id: `change_${Date.now()}`,
      action: "edit_person",
      previous_person_id: personId,
      previous_person_name: current.name,
      new_person_id: personId,
      new_person_name: cleanName,
      updated_by: "admin@convencion.local",
      updated_at: new Date().toISOString()
    };
    setState((prev) => ({
      ...prev,
      people: prev.people.map((p) => p.person_id === personId ? { ...p, name: cleanName } : p)
        .sort((a, b) => a.name.localeCompare(b.name)),
      assignments: prev.assignments.map((a) => a.person_id === personId ? { ...a, person_name: cleanName } : a),
      changeLogs: [log, ...prev.changeLogs]
    }));
  }

  function resetData() {
    if (confirm("¿Restaurar todos los datos al horario original?")) {
      setState(createInitialState());
    }
  }

  const currentDay = view.name === "dia" ? view.day : "viernes";

  return (
    <div>
      <Header isAdmin={isAdmin} view={view} navigate={navigate} requireAdmin={requireAdmin} logout={logout} />
      <main className="container">
        {view.name === "inicio" && <HomePage navigate={navigate} />}
        {view.name === "buscar" && (
          <SearchPage people={activePeople} assignments={state.assignments} navigate={navigate} />
        )}
        {view.name === "persona" && (
          <PersonPage personId={view.personId} people={activePeople} assignments={state.assignments} navigate={navigate} />
        )}
        {view.name === "dia" && (
          <DayPage day={view.day} assignments={state.assignments} navigate={navigate} />
        )}
        {view.name === "mapa" && <MapPage />}
        {view.name === "adminLogin" && <AdminLoginPage login={login} />}
        {view.name === "adminDashboard" && (
          <Protected isAdmin={isAdmin} navigate={navigate}>
            <AdminDashboard people={activePeople} assignments={state.assignments} logs={state.changeLogs} navigate={navigate} resetData={resetData} />
          </Protected>
        )}
        {view.name === "adminHorarios" && (
          <Protected isAdmin={isAdmin} navigate={navigate}>
            <AdminSchedulesPage people={activePeople} assignments={state.assignments} updateAssignment={updateAssignment} />
          </Protected>
        )}
        {view.name === "adminPersonas" && (
          <Protected isAdmin={isAdmin} navigate={navigate}>
            <AdminPeoplePage people={activePeople} assignments={state.assignments} addPerson={addPerson} editPerson={editPerson} navigate={navigate} />
          </Protected>
        )}
        {view.name === "adminHistorial" && (
          <Protected isAdmin={isAdmin} navigate={navigate}>
            <AdminHistoryPage logs={state.changeLogs} />
          </Protected>
        )}
      </main>
      <MobileNav isAdmin={isAdmin} view={view} navigate={navigate} requireAdmin={requireAdmin} />
    </div>
  );
}

/* ─── Header ─────────────────────────────────────── */
function Header({ isAdmin, view, navigate, requireAdmin, logout }: {
  isAdmin: boolean;
  view: View;
  navigate: (v: View) => void;
  requireAdmin: (v: View) => void;
  logout: () => void;
}) {
  return (
    <header className="header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate({ name: "inicio" })}>
          <div className="brand-icon"><CalendarDays size={18} /></div>
          HORARIO DE CONVENCIÓN
        </button>
        <nav className="nav">
          <button
            className={view.name === "buscar" ? "nav-active" : ""}
            onClick={() => navigate({ name: "buscar" })}
          >Buscar</button>
          <button
            className={view.name === "dia" ? "nav-active" : ""}
            onClick={() => navigate({ name: "dia", day: "viernes" })}
          >Por día</button>
          <button
            className={view.name === "mapa" ? "nav-active" : ""}
            onClick={() => navigate({ name: "mapa" })}
          >Mapa</button>
          {isAdmin ? (
            <>
              <button
                className={`nav-admin-btn ${view.name.startsWith("admin") ? "nav-active" : ""}`}
                onClick={() => requireAdmin({ name: "adminDashboard" })}
              >Admin</button>
              <button className="nav-logout-btn" onClick={logout} title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button onClick={() => navigate({ name: "adminLogin" })}>Admin</button>
          )}
        </nav>
      </div>
    </header>
  );
}

/* ─── Mobile Nav ─────────────────────────────────── */
function MobileNav({ isAdmin, view, navigate, requireAdmin }: {
  isAdmin: boolean;
  view: View;
  navigate: (v: View) => void;
  requireAdmin: (v: View) => void;
}) {
  const items = [
    { icon: <Home size={20} />, label: "Inicio", action: () => navigate({ name: "inicio" }), active: view.name === "inicio" },
    { icon: <Search size={20} />, label: "Buscar", action: () => navigate({ name: "buscar" }), active: view.name === "buscar" },
    { icon: <CalendarDays size={20} />, label: "Por día", action: () => navigate({ name: "dia", day: "viernes" }), active: view.name === "dia" },
    { icon: <MapPin size={20} />, label: "Mapa", action: () => navigate({ name: "mapa" }), active: view.name === "mapa" },
    { icon: <ShieldCheck size={20} />, label: "Admin", action: () => isAdmin ? requireAdmin({ name: "adminDashboard" }) : navigate({ name: "adminLogin" }), active: view.name.startsWith("admin") },
  ];

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {items.map((item) => (
          <button key={item.label} className={`mobile-nav-item ${item.active ? "active" : ""}`} onClick={item.action}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ─── Home Page ──────────────────────────────────── */
function HomePage({ navigate }: { navigate: (v: View) => void }) {
  return (
    <section className="hero" style={{ backgroundSize: "cover", backgroundPosition: "center top", minHeight: "100svh" }}>
      <div className="hero-card">
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate({ name: "buscar" })}>
            <Search size={18} /> Buscar mi horario
          </button>
          <button className="btn btn-secondary" onClick={() => navigate({ name: "dia", day: "viernes" })}>
            <CalendarDays size={18} /> Ver por día
          </button>
          <button className="btn btn-secondary" onClick={() => navigate({ name: "mapa" })}>
            <MapPin size={18} /> Ver mapa
          </button>
        </div>
        <div className="day-quick-buttons">
          <div className="day-quick-label">Ir directo al día</div>
          {dayOrder.map((day) => (
            <button key={day} className="day-quick-btn" onClick={() => navigate({ name: "dia", day })}>
              {formatDay(day)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Search Page ────────────────────────────────── */
function SearchPage({ people, assignments, navigate }: {
  people: Person[];
  assignments: Assignment[];
  navigate: (v: View) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return people.slice(0, 12);
    return people.filter((p) => normalizeText(p.name).includes(q)).slice(0, 30);
  }, [query, people]);

  return (
    <section>
      <PageTitle eyebrow="Búsqueda" title="Buscar mi horario" subtitle="Escribe tu nombre para ver tus asignaciones." />

      <div className="search-wrap">
        <span className="search-icon"><Search size={18} /></span>
        <input
          className="search-input"
          placeholder="Escribe tu nombre..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="person-list">
        {results.length === 0 && <EmptyState text="No se encontró ninguna persona con ese nombre." />}
        {results.map((person) => {
          const count = assignments.filter((a) => a.active && a.person_id === person.person_id).length;
          return (
            <button key={person.person_id} className="person-row" onClick={() => navigate({ name: "persona", personId: person.person_id })}>
              <div>
                <span className="person-row-name">{person.name}</span>
                <span className="person-row-count">{count} asignación{count === 1 ? "" : "es"}</span>
              </div>
              <ChevronRight size={20} className="person-row-arrow" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Person Page ────────────────────────────────── */
function PersonPage({ personId, people, assignments, navigate }: {
  personId: string;
  people: Person[];
  assignments: Assignment[];
  navigate: (v: View) => void;
}) {
  const person = people.find((p) => p.person_id === personId);
  const personAssignments = assignments.filter((a) => a.active && a.person_id === personId);
  const groups = groupAssignmentsByDay(personAssignments);

  if (!person) return <EmptyState text="No se encontró esta persona." />;

  return (
    <section>
      <PageTitle eyebrow="Horario personal" title={person.name} subtitle={`${personAssignments.length} asignación${personAssignments.length === 1 ? "" : "es"} en total.`} />

      {personAssignments.length === 0 && <EmptyState text="Esta persona no tiene asignaciones registradas." />}

      {dayOrder.map((day) => (
        <div key={day} className="day-section">
          <div className="day-section-title">{formatDay(day)}</div>
          {groups[day].length === 0 ? (
            <p className="muted" style={{ fontSize: 14, paddingBottom: 8 }}>Sin asignaciones este día.</p>
          ) : (
            <div className="assignment-cards">
              {groups[day].map((a) => (
                <div className="assignment-card" key={a.assignment_id}>
                  <div className="assignment-time">{formatTime(a.time)}</div>
                  <div>
                    <div className="assignment-area">{a.area_name}</div>
                    <AreaBadge type={a.area_type} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={() => navigate({ name: "buscar" })}>
          ← Buscar otra persona
        </button>
      </div>
    </section>
  );
}

/* ─── Day Page ───────────────────────────────────── */
function DayPage({ day, assignments, navigate }: {
  day: string;
  assignments: Assignment[];
  navigate: (v: View) => void;
}) {
  const [filter, setFilter] = useState("todos");
  const filtered = assignments.filter((a) =>
    a.active && a.day === day && (filter === "todos" || a.area_type === filter)
  );
  const groups = groupAssignmentsByArea(filtered);

  return (
    <section>
      <PageTitle eyebrow="Horario por día" title={`${formatDay(day)}`} subtitle="Consulta las asignaciones por área y turno." />

      <div className="day-tabs">
        {dayOrder.map((d) => (
          <button key={d} className={`day-tab ${d === day ? "active" : ""}`} onClick={() => navigate({ name: "dia", day: d })}>
            {formatDay(d)}
          </button>
        ))}
      </div>

      <div className="filters">
        {["todos", "lobby", "rampa", "escaleras", "entrada", "otro"].map((type) => (
          <button key={type} className={`filter-pill ${filter === type ? "active" : ""}`} onClick={() => setFilter(type)}>
            {type === "todos" ? "Todos" : formatAreaType(type)}
          </button>
        ))}
      </div>

      {groups.length === 0 && <EmptyState text="No hay asignaciones para este día o filtro." />}

      {groups.map((group) => (
        <div className="area-card" key={group.areaName}>
          <div className="area-card-header">
            <div className="area-card-title">{group.areaName}</div>
            <AreaBadge type={group.areaType} />
          </div>
          <div className="area-card-body">
            {group.items.map((a) => (
              <div className="schedule-row" key={a.assignment_id}>
                <span className="row-time">{formatTime(a.time)}</span>
                <span style={{ fontWeight: 500 }}>{a.person_name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ─── Map Page ───────────────────────────────────── */
function MapPage() {
  return (
    <section>
      <PageTitle eyebrow="Referencia visual" title="Mapa exterior" subtitle="Ubicación de lobbies, rampas, escaleras y entradas." />

      <div className="map-actions">
        <a className="btn btn-secondary" href="/mapa_exterior_area.png" target="_blank" rel="noreferrer">
          <MapPin size={16} /> Abrir en pantalla completa
        </a>
      </div>

      <div className="map-card">
        <img src="/mapa_exterior_area.png" alt="Mapa del área exterior de la convención" />
      </div>

      <div className="area-card">
        <div className="area-card-header">
          <div className="area-card-title">Guía rápida</div>
        </div>
        <div className="quick-guide">
          {[
            { type: "lobby", label: "Lobbies A, B, C y D" },
            { type: "rampa", label: "Rampa Norte y Rampa Sur" },
            { type: "escaleras", label: "Escaleras Norte y Escaleras Sur" },
            { type: "entrada", label: "Lobby Entrada Principal" },
          ].map(({ type, label }) => (
            <div key={type} className="quick-guide-row">
              <AreaBadge type={type} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Admin Login ────────────────────────────────── */
function AdminLoginPage({ login }: { login: (password: string) => boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function tryLogin() {
    const ok = login(password);
    if (!ok) setError("Contraseña incorrecta. Inténtalo de nuevo.");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={28} /></div>
        <h1>Acceso Admin</h1>
        <p>Ingresa la contraseña para editar el horario.</p>
        <input
          className="search-input-plain"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") tryLogin(); }}
          style={{ marginBottom: 12 }}
        />
        {error && <p className="msg-error">{error}</p>}
        <button className="btn btn-primary btn-full" onClick={tryLogin} style={{ marginTop: 14 }}>
          Iniciar sesión
        </button>

      </div>
    </div>
  );
}

/* ─── Admin Dashboard ────────────────────────────── */
function AdminDashboard({ people, assignments, logs, navigate, resetData }: {
  people: Person[];
  assignments: Assignment[];
  logs: ChangeLog[];
  navigate: (v: View) => void;
  resetData: () => void;
}) {
  return (
    <section>
      <PageTitle eyebrow="Panel de control" title="Administración" subtitle="Gestiona horarios, personas y cambios." />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Personas activas</div>
          <div className="stat-value">{people.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Asignaciones</div>
          <div className="stat-value">{assignments.filter((a) => a.active).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cambios</div>
          <div className="stat-value">{logs.length}</div>
        </div>
      </div>

      <div className="admin-actions">
        <button className="admin-action-card" onClick={() => navigate({ name: "adminHorarios" })}>
          <div className="admin-action-icon amber"><Pencil size={18} /></div>
          <div>
            <div>Editar horarios</div>
            <div className="admin-action-sub">Cambiar asignaciones</div>
          </div>
        </button>
        <button className="admin-action-card" onClick={() => navigate({ name: "adminPersonas" })}>
          <div className="admin-action-icon blue"><Users size={18} /></div>
          <div>
            <div>Personas</div>
            <div className="admin-action-sub">Agregar y editar</div>
          </div>
        </button>
        <button className="admin-action-card" onClick={() => navigate({ name: "adminHistorial" })}>
          <div className="admin-action-icon navy"><History size={18} /></div>
          <div>
            <div>Historial</div>
            <div className="admin-action-sub">Ver cambios recientes</div>
          </div>
        </button>
        <button className="admin-action-card" onClick={resetData}>
          <div className="admin-action-icon red"><AlertTriangle size={18} /></div>
          <div>
            <div>Restaurar datos</div>
            <div className="admin-action-sub">Volver al original</div>
          </div>
        </button>
      </div>

      {logs.length > 0 && (
        <div className="area-card">
          <div className="area-card-header">
            <div className="area-card-title">Últimos cambios</div>
          </div>
          <div className="log-list">
            {logs.slice(0, 5).map((log) => <LogRow key={log.change_id} log={log} />)}
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="area-card">
          <div className="area-card-header"><div className="area-card-title">Últimos cambios</div></div>
          <div style={{ padding: "16px 18px" }}>
            <p className="muted" style={{ fontSize: 14 }}>Aún no hay cambios registrados.</p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Admin Schedules ────────────────────────────── */
function AdminSchedulesPage({ people, assignments, updateAssignment }: {
  people: Person[];
  assignments: Assignment[];
  updateAssignment: (id: string, person: Person, force?: boolean) => { ok: boolean; conflict: Assignment[] };
}) {
  const [day, setDay] = useState("viernes");
  const [filter, setFilter] = useState("todos");
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [message, setMessage] = useState("");

  const visible = assignments.filter((a) =>
    a.active && a.day === day && (filter === "todos" || a.area_type === filter)
  );
  const groups = groupAssignmentsByArea(visible);

  return (
    <section>
      <PageTitle eyebrow="Administración" title="Editar horarios" subtitle="Cambia la persona asignada a cualquier turno." />

      {message && <div className="msg-success">{message}</div>}

      <div className="day-tabs">
        {dayOrder.map((d) => (
          <button key={d} className={`day-tab ${d === day ? "active" : ""}`} onClick={() => setDay(d)}>{formatDay(d)}</button>
        ))}
      </div>

      <div className="filters">
        {["todos", "lobby", "rampa", "escaleras", "entrada", "otro"].map((type) => (
          <button key={type} className={`filter-pill ${filter === type ? "active" : ""}`} onClick={() => setFilter(type)}>
            {type === "todos" ? "Todos" : formatAreaType(type)}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <div className="area-card" key={group.areaName}>
          <div className="area-card-header">
            <div className="area-card-title">{group.areaName}</div>
            <AreaBadge type={group.areaType} />
          </div>
          <div className="area-card-body">
            {group.items.map((a) => (
              <div className="schedule-row admin-row" key={a.assignment_id}>
                <span className="row-time">{formatTime(a.time)}</span>
                <span style={{ fontWeight: 500 }}>{a.person_name}</span>
                <button className="btn-action" onClick={() => setEditing(a)}>Cambiar</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <ChangeAssignmentModal
          assignment={editing}
          people={people}
          onClose={() => setEditing(null)}
          onSave={(person, force) => {
            const result = updateAssignment(editing.assignment_id, person, force);
            if (result.ok) {
              setMessage("Cambio guardado correctamente.");
              setEditing(null);
              setTimeout(() => setMessage(""), 3000);
            }
            return result;
          }}
        />
      )}
    </section>
  );
}

/* ─── Change Assignment Modal ────────────────────── */
function ChangeAssignmentModal({ assignment, people, onClose, onSave }: {
  assignment: Assignment;
  people: Person[];
  onClose: () => void;
  onSave: (person: Person, force?: boolean) => { ok: boolean; conflict: Assignment[] };
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [conflict, setConflict] = useState<Assignment[]>([]);

  const results = people.filter((p) => normalizeText(p.name).includes(normalizeText(query))).slice(0, 8);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-title">Cambiar asignación</div>

        <div className="modal-info">
          {[
            ["Día", formatDay(assignment.day)],
            ["Área", assignment.area_name],
            ["Hora", formatTime(assignment.time)],
            ["Persona actual", assignment.person_name],
          ].map(([label, value]) => (
            <div key={label} className="modal-info-row">
              <strong>{label}</strong>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <input
          className="search-input-plain"
          placeholder="Buscar nueva persona..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="mini-results">
          {results.map((p) => (
            <button
              key={p.person_id}
              className={`mini-results-item ${selected?.person_id === p.person_id ? "selected" : ""}`}
              onClick={() => { setSelected(p); setConflict([]); }}
            >
              {p.name}
            </button>
          ))}
        </div>

        {conflict.length > 0 && (
          <div className="msg-warning">
            <strong>Conflicto de horario</strong>
            <p>Esta persona ya está asignada en el mismo horario.</p>
            {conflict.map((c) => (
              <p key={c.assignment_id}>{formatDay(c.day)} · {formatTime(c.time)} · {c.area_name}</p>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          {conflict.length > 0 && selected && (
            <button className="btn btn-danger" onClick={() => onSave(selected, true)}>Guardar de todos modos</button>
          )}
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              const result = onSave(selected);
              if (!result.ok && result.conflict.length > 0) setConflict(result.conflict);
            }}
          >
            Guardar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin People ───────────────────────────────── */
function AdminPeoplePage({ people, assignments, addPerson, editPerson, navigate }: {
  people: Person[];
  assignments: Assignment[];
  addPerson: (name: string) => boolean;
  editPerson: (id: string, name: string) => void;
  navigate: (v: View) => void;
}) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState("");

  const filtered = people.filter((p) => normalizeText(p.name).includes(normalizeText(query)));

  function showMsg(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <section>
      <PageTitle eyebrow="Administración" title="Personas" subtitle="Agrega o edita nombres de personas." />

      {message && <div className="msg-success">{message}</div>}

      <div className="area-card" style={{ marginBottom: 20 }}>
        <div className="area-card-header"><div className="area-card-title">Agregar persona</div></div>
        <div style={{ padding: "14px 18px" }}>
          <div className="inline-form">
            <input
              className="search-input-plain"
              placeholder="Nombre completo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const ok = addPerson(newName);
                  showMsg(ok ? "Persona agregada correctamente." : "Nombre vacío o duplicado.");
                  if (ok) setNewName("");
                }
              }}
            />
            <button className="btn btn-primary" onClick={() => {
              const ok = addPerson(newName);
              showMsg(ok ? "Persona agregada correctamente." : "Nombre vacío o duplicado.");
              if (ok) setNewName("");
            }}>
              <Plus size={16} /> Agregar
            </button>
          </div>
        </div>
      </div>

      <div className="search-wrap" style={{ marginBottom: 12 }}>
        <span className="search-icon"><Search size={18} /></span>
        <input
          className="search-input"
          placeholder="Buscar persona..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="person-list">
        {filtered.map((p) => {
          const count = assignments.filter((a) => a.active && a.person_id === p.person_id).length;
          const isEditing = editingId === p.person_id;

          return (
            <div key={p.person_id} className="person-row person-row-static">
              {isEditing ? (
                <div className="edit-row-form" style={{ width: "100%" }}>
                  <input
                    className="search-input-plain"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    editPerson(p.person_id, editingName);
                    setEditingId("");
                    showMsg("Persona actualizada.");
                  }}>Guardar</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId("")}>Cancelar</button>
                </div>
              ) : (
                <>
                  <button className="person-info-btn" onClick={() => navigate({ name: "persona", personId: p.person_id })}>
                    <span className="person-row-name">{p.name}</span>
                    <span className="person-row-count">{count} asignación{count === 1 ? "" : "es"}</span>
                  </button>
                  <button className="btn-action" onClick={() => { setEditingId(p.person_id); setEditingName(p.name); }}>
                    Editar
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Admin History ──────────────────────────────── */
function AdminHistoryPage({ logs }: { logs: ChangeLog[] }) {
  return (
    <section>
      <PageTitle eyebrow="Administración" title="Historial" subtitle="Cambios realizados por administradores." />
      {logs.length === 0 && <EmptyState text="Aún no hay cambios registrados." />}
      {logs.length > 0 && (
        <div className="area-card">
          <div className="log-list">
            {logs.map((log) => <LogRow key={log.change_id} log={log} />)}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Shared Components ──────────────────────────── */
function LogRow({ log }: { log: ChangeLog }) {
  return (
    <div className="log-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="log-action">
          {log.action === "update_assignment" ? "Cambio de asignación" : "Cambio de persona"}
        </div>
        {log.day && (
          <div className="log-detail">{formatDay(log.day)} · {log.area_name} · {log.time ? formatTime(log.time) : ""}</div>
        )}
        <div className="log-change">
          {log.previous_person_name
            ? `${log.previous_person_name} → ${log.new_person_name}`
            : log.new_person_name}
        </div>
      </div>
      <div className="log-time">{new Date(log.updated_at).toLocaleString("es-US")}</div>
    </div>
  );
}

function Protected({ isAdmin, navigate, children }: {
  isAdmin: boolean;
  navigate: (v: View) => void;
  children: React.ReactNode;
}) {
  if (!isAdmin) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-icon"><ShieldCheck size={28} /></div>
          <h1>Acceso restringido</h1>
          <p>Debes iniciar sesión como administrador.</p>
          <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={() => navigate({ name: "adminLogin" })}>
            Ir al login
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="page-title">
      <div className="page-title-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function AreaBadge({ type }: { type: string }) {
  const cls = `badge badge-${type}`;
  return <span className={cls}>{formatAreaType(type)}</span>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <CalendarDays size={30} strokeWidth={1.5} />
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
