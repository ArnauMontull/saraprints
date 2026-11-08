// Saraprints Estudio: tests V/F, tarjetas con repaso espaciado, feed para memorizar y repaso de fallos.
// Todo funciona sin IA ni red (salvo cargar los datos). Los datos de cada asignatura están en datos/<ID>.json
// (fuera de git: salen de los apuntes de Sara). El progreso vive en localStorage de este dispositivo.

const app = document.getElementById("app");
const CLAVE = "estudio:v1";
const API = "https://saraprints.vercel.app/api/corregir"; // solo para corregir preguntas abiertas con el código

// ---------- estado ----------
const E = cargarEstado();
function cargarEstado() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    return { asig: s.asig || null, res: s.res || {}, srs: s.srs || {}, tests: s.tests || [], dias: s.dias || [],
             voz: s.voz ?? true, vel: s.vel || 1, codigo: s.codigo || "", nuevasHoy: s.nuevasHoy || {} };
  } catch { return { asig: null, res: {}, srs: {}, tests: [], dias: [], voz: true, vel: 1, codigo: "", nuevasHoy: {} }; }
}
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch {} }
const hoy = () => new Date().toISOString().slice(0, 10);
function marcarDia() { if (!E.dias.includes(hoy())) { E.dias.push(hoy()); guardar(); } }
function racha() {
  let n = 0; const d = new Date();
  if (!E.dias.includes(hoy())) d.setDate(d.getDate() - 1);
  while (E.dias.includes(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- datos ----------
let INDICE = [], D = null;
async function cargarDatos() {
  INDICE = await (await fetch("datos/indice.json", { cache: "no-cache" })).json();
  if (!E.asig || !INDICE.find((a) => a.id === E.asig)) E.asig = INDICE[0].id;
  const meta = INDICE.find((a) => a.id === E.asig);
  D = await (await fetch(`datos/${meta.archivo}`, { cache: "no-cache" })).json();
  D.meta = meta;
  D.porId = Object.fromEntries([...D.vf, ...D.flashcards].map((x) => [x.id, x]));
}

// ---------- utilidades ----------
function h(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "html") n.innerHTML = v;
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
}
const icono = (nombre, cls = "h-5 w-5") => h("i", { "data-lucide": nombre, class: cls });
const barajar = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tarjeta = (cls = "") => `rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${cls}`;
const boton = (cls = "") => `rounded-xl px-4 py-3 font-semibold transition-all duration-200 ${cls}`;
const primario = boton("bg-teal-600 text-white hover:bg-teal-700");
const secundario = boton("border border-slate-200 bg-white text-slate-700 hover:bg-slate-100");
function pintarIconos() { window.lucide?.createIcons(); }

function fuente(f) {
  if (!f) return null;
  const caja = h("div", { class: "rounded-xl bg-slate-50 p-3 text-sm text-slate-600" },
    h("div", { class: "mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700" },
      icono("book-open", "h-4 w-4"), `De tus apuntes${f.pag ? ` · pág. ${f.pag}` : ""}`));
  if (f.cita) caja.append(h("p", { class: "italic" }, `«${f.cita}»`));
  if (f.figura) caja.append(h("p", {}, `Figura: ${f.figura}`));
  return caja;
}

function molecula(smiles, ancho = 320) {
  if (!smiles || !window.SmilesDrawer) return null;
  const caja = h("div", { class: "smiles mx-auto w-full max-w-xs rounded-xl bg-white p-2" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  caja.append(svg);
  try {
    const drawer = new window.SmilesDrawer.SvgDrawer({ width: ancho, height: Math.round(ancho * 0.7), bondThickness: 1.6, padding: 10 });
    window.SmilesDrawer.parse(smiles, (arbol) => { drawer.draw(arbol, svg, "light"); svg.removeAttribute("height"); svg.removeAttribute("style"); },
      () => caja.remove());
  } catch { return null; }
  return caja;
}

function registrar(id, acierto) {
  const r = (E.res[id] ??= { v: 0, f: 0 });
  acierto ? r.v++ : r.f++;
  r.ult = Date.now(); r.ok = acierto;
  if (!acierto) E.srs[id] ??= { due: 0, int: 0, ease: 2.3, reps: 0, fallo: true }; // los fallos entran en tarjetas
  marcarDia(); guardar();
}

// ---------- repaso espaciado (SM-2 simplificado) ----------
function pendientes() {
  const ahora = Date.now();
  const due = Object.entries(E.srs).filter(([id, s]) => D.porId[id] && s.due <= ahora).map(([id]) => id);
  const vistas = new Set(Object.keys(E.srs));
  const hechasHoy = E.nuevasHoy[hoy()] || 0;
  const nuevas = D.flashcards.filter((c) => !vistas.has(c.id)).slice(0, Math.max(0, 20 - hechasHoy)).map((c) => c.id);
  return { due, nuevas };
}
function calificar(id, nota) { // 0 otra vez, 1 difícil, 2 bien, 3 fácil
  const s = (E.srs[id] ??= { due: 0, int: 0, ease: 2.3, reps: 0 });
  if (s.reps === 0 && !s.fallo) E.nuevasHoy[hoy()] = (E.nuevasHoy[hoy()] || 0) + 1;
  if (nota === 0) { s.reps = 0; s.int = 0; s.ease = Math.max(1.3, s.ease - 0.2); s.due = Date.now() + 60_000; }
  else {
    s.reps++;
    s.ease = Math.max(1.3, s.ease + [0, -0.15, 0, 0.15][nota]);
    s.int = s.reps === 1 ? [0, 0.5, 1, 3][nota] : s.int * (nota === 1 ? 1.2 : s.ease) * (nota === 3 ? 1.3 : 1);
    s.due = Date.now() + s.int * 86_400_000;
  }
  delete s.fallo;
  marcarDia(); guardar();
}

// ---------- navegación ----------
const VISTAS = { inicio, test, tarjetas, feed, fallos, abiertas, ajustes, esquemas };

// ---------- ESQUEMAS ----------
function esquemas() {
  app.append(h("h1", { class: "text-xl font-bold" }, "Esquemas"),
    h("p", { class: "text-sm text-slate-500" }, "Un minuto por tema. Luego, haz el test de ese tema."));
  const lista = D.esquemas || [];
  if (!lista.length) { app.append(h("p", { class: "text-slate-500" }, "Aún no hay esquemas para esta asignatura.")); return; }
  for (const t of D.temas) {
    const e = lista.find((x) => x.tema === t);
    if (!e) continue;
    const qs = D.vf.filter((q) => q.tema === t);
    app.append(h("details", { class: tarjeta("p-4") },
      h("summary", { class: "flex cursor-pointer items-center justify-between gap-3 font-semibold" }, h("span", { class: "min-w-0" }, t),
        importancia(t)),
      h("ul", { class: "mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm" }, e.vinetas.map((v) => h("li", {}, v))),
      e.paginas?.length ? h("p", { class: "mt-2 text-xs text-slate-500" }, `Apuntes, págs. ${e.paginas.join(", ")}`) : null,
      qs.length ? h("a", { href: "#test", class: secundario + " mt-3 block text-center text-sm",
        onclick: () => sessionStorage.setItem("estudio:tema", t) }, `Test de este tema (${qs.length})`) : null));
  }
}

function importancia(tema) {
  const n = D.importancia?.[tema];
  if (!n) return null;
  return h("span", { class: "shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800", title: "Preguntas de este tema en exámenes y simulacros" },
    `Cae en examen · ${n}`);
}
let limpiar = null;
function ir() {
  limpiar?.(); limpiar = null;
  speechSynthesis?.cancel();
  const v = location.hash.slice(1) || "inicio";
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("text-teal-700", a.dataset.tab === v));
  document.getElementById("nav").hidden = v === "feed";
  app.className = v === "feed" ? "" : "mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]";
  app.textContent = "";
  (VISTAS[v] || inicio)();
  pintarIconos();
  window.scrollTo(0, 0);
}

// ---------- INICIO ----------
function inicio() {
  const total = D.vf.length;
  const hechas = D.vf.filter((q) => E.res[q.id]).length;
  const aciertos = D.vf.reduce((a, q) => a + (E.res[q.id]?.v || 0), 0);
  const intentos = D.vf.reduce((a, q) => a + (E.res[q.id]?.v || 0) + (E.res[q.id]?.f || 0), 0);
  const falladas = D.vf.filter((q) => E.res[q.id] && !E.res[q.id].ok).length;
  const p = pendientes();
  const ultimo = E.tests.filter((t) => t.asig === E.asig).at(-1);

  const sel = h("select", { id: "asig", class: "rounded-xl border border-slate-200 bg-white p-2 text-sm",
    onchange: async (e) => { E.asig = e.target.value; guardar(); await cargarDatos(); ir(); } },
    INDICE.map((a) => h("option", { value: a.id, selected: a.id === E.asig ? "" : null }, a.nombre)));

  app.append(h("header", { class: "flex items-center justify-between gap-3 border-b border-slate-200 pb-4" },
    h("div", {}, h("h1", { class: "text-xl font-bold" }, "Estudio"), h("p", { class: "text-sm text-slate-500" }, D.meta.nombre)),
    h("div", { class: "flex items-center gap-1" }, sel,
      h("a", { href: "#ajustes", class: "rounded-xl p-2 text-slate-600 hover:bg-slate-100", "aria-label": "Ajustes" }, icono("settings")))));

  if (D.meta.examen) {
    const ms = new Date(D.meta.examen) - Date.now();
    if (ms > 0) {
      const horas = Math.floor(ms / 3_600_000);
      app.append(h("div", { class: "rounded-2xl bg-teal-600 p-4 text-white" },
        h("p", { class: "text-sm opacity-90" }, D.meta.examenNombre || "Examen"),
        h("p", { class: "text-2xl font-bold" }, horas >= 48 ? `Faltan ${Math.floor(horas / 24)} días` : `Faltan ${horas} h`)));
    }
  }

  const dato = (valor, texto) => h("div", { class: tarjeta("p-4") }, h("p", { class: "text-2xl font-bold tabular-nums" }, valor), h("p", { class: "text-sm text-slate-500" }, texto));
  const dominadas = D.vf.filter((q) => E.res[q.id]?.ok).length;
  app.append(h("section", { class: "grid grid-cols-2 gap-3" },
    dato(`${Math.round((100 * dominadas) / total)} %`, "del temario dominado"),
    dato(ultimo ? ultimo.nota.toFixed(1) : "–", "nota del último test"),
    dato(`${hechas}/${total}`, "preguntas vistas"),
    dato(intentos ? `${Math.round((100 * aciertos) / intentos)} %` : "–", "de aciertos")));
  if (D.cobertura) app.append(h("p", { class: "-mt-3 text-xs text-slate-500" },
    `Las preguntas cubren ${D.cobertura.paginas} de las ${D.cobertura.total} páginas de tus apuntes.`));

  const accion = (href, ic, titulo, sub) => h("a", { href, class: tarjeta("flex items-center gap-4 transition-all duration-200 hover:bg-slate-100") },
    h("span", { class: "rounded-xl bg-teal-50 p-3 text-teal-700" }, icono(ic, "h-6 w-6")),
    h("span", { class: "flex flex-col" }, h("span", { class: "font-semibold" }, titulo), h("span", { class: "text-sm text-slate-500" }, sub)));
  app.append(h("section", { class: "flex flex-col gap-3" },
    h("button", { class: tarjeta("flex items-center gap-4 text-left transition-all duration-200 hover:bg-slate-100"), onclick: () => testRapido() },
      h("span", { class: "rounded-xl bg-teal-600 p-3 text-white" }, icono("zap", "h-6 w-6")),
      h("span", { class: "flex flex-col" }, h("span", { class: "font-semibold" }, "Test rápido de 10"),
        h("span", { class: "text-sm text-slate-500" }, "5 minutos. Prioriza lo que cae en examen y lo que fallas"))),
    h("button", { class: tarjeta("flex items-center gap-4 text-left transition-all duration-200 hover:bg-slate-100"), onclick: () => simulacro() },
      h("span", { class: "rounded-xl bg-teal-50 p-3 text-teal-700" }, icono("file-check", "h-6 w-6")),
      h("span", { class: "flex flex-col" }, h("span", { class: "font-semibold" }, "Simulacro de examen"),
        h("span", { class: "text-sm text-slate-500" }, "40 V/F de todo, +1 / −1 / 0 en blanco, nota sobre 10"))),
    accion("#fallos", "target", "Tus fallos", falladas ? `${falladas} preguntas por recuperar` : "Aún no has fallado ninguna"),
    accion("#tarjetas", "layers", "Tarjetas de hoy", `${p.due.length} para repasar · ${p.nuevas.length} nuevas`),
    accion("#esquemas", "book-open", "Esquemas de cada tema", "Un minuto por tema, con lo que más cae"),
    accion("#abiertas", "pencil-line", "Preguntas para escribir", `${D.abiertas.length} preguntas de desarrollo`)));

  // Progreso por tema
  const lista = h("div", { class: "flex flex-col gap-3" });
  for (const t of D.temas) {
    const qs = D.vf.filter((q) => q.tema === t);
    if (!qs.length) continue;
    const bien = qs.filter((q) => E.res[q.id]?.ok).length;
    const pct = Math.round((100 * bien) / qs.length);
    lista.append(h("a", { href: "#test", onclick: () => { sessionStorage.setItem("estudio:tema", t); }, class: "flex flex-col gap-1" },
      h("div", { class: "flex justify-between gap-3 text-sm" }, h("span", { class: "min-w-0" }, t), h("span", { class: "tabular-nums text-slate-500" }, `${bien}/${qs.length}`)),
      h("div", { class: "h-2 overflow-hidden rounded-full bg-slate-200" }, h("div", { class: "h-full rounded-full bg-teal-600", style: `width:${pct}%` }))));
  }
  app.append(h("section", { class: tarjeta("flex flex-col gap-4") }, h("h2", { class: "font-semibold" }, "Dominado por tema"), lista,
    h("p", { class: "text-xs text-slate-500" }, "Cuenta las preguntas cuya última respuesta fue correcta. Toca un tema para hacer un test de él.")));
}

// ---------- TEST ----------
function test() {
  const temaPrevio = sessionStorage.getItem("estudio:tema"); sessionStorage.removeItem("estudio:tema");
  const conf = { temas: new Set(temaPrevio ? [temaPrevio] : []), n: 10, modo: "examen", soloFallos: false };
  app.append(h("h1", { class: "text-xl font-bold" }, "Test V/F"));

  const chips = h("div", { class: "flex flex-wrap gap-2" });
  const pintarChips = () => {
    chips.textContent = "";
    chips.append(h("button", { type: "button", class: `rounded-full border px-3 py-1.5 text-sm ${conf.temas.size ? "border-slate-200 bg-white" : "border-teal-600 bg-teal-50 text-teal-800"}`,
      onclick: () => { conf.temas.clear(); pintarChips(); } }, "Todos los temas"));
    for (const t of D.temas) {
      const on = conf.temas.has(t);
      chips.append(h("button", { type: "button", class: `rounded-full border px-3 py-1.5 text-sm ${on ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white"}`,
        onclick: () => { on ? conf.temas.delete(t) : conf.temas.add(t); pintarChips(); } }, t));
    }
  };
  pintarChips();

  const grupo = (nombre, opciones, clave) => {
    const g = h("div", { class: "grid grid-cols-3 gap-2" });
    const pintar = () => { g.textContent = ""; for (const [v, txt] of opciones) g.append(h("button", { type: "button",
      class: `rounded-xl border p-3 text-sm font-medium ${conf[clave] === v ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white"}`,
      onclick: () => { conf[clave] = v; pintar(); } }, txt)); };
    pintar();
    return h("div", { class: "flex flex-col gap-2" }, h("p", { class: "text-sm font-medium text-slate-600" }, nombre), g);
  };

  app.append(h("section", { class: tarjeta("flex flex-col gap-5") },
    h("div", { class: "flex flex-col gap-2" }, h("p", { class: "text-sm font-medium text-slate-600" }, "Temas"), chips),
    grupo("Preguntas", [[10, "10"], [20, "20"], [40, "40 (examen)"]], "n"),
    grupo("Corrección", [["examen", "Al final"], ["practica", "Al momento"]], "modo"),
    h("label", { class: "flex items-center gap-3 text-sm" }, h("input", { type: "checkbox", id: "solo-fallos", class: "h-5 w-5 accent-teal-600",
      onchange: (e) => { conf.soloFallos = e.target.checked; } }), "Solo preguntas que he fallado"),
    h("button", { class: primario, onclick: () => empezarTest(conf) }, "Empezar")));
}

function empezarTest(conf) {
  let pool = D.vf.filter((q) => !conf.temas.size || conf.temas.has(q.tema));
  if (conf.soloFallos) pool = pool.filter((q) => E.res[q.id] && !E.res[q.id].ok);
  if (!pool.length) { alertaSuave("No hay preguntas con esos filtros."); return; }
  const preguntas = pool.sort((a, b) => prioridad(b) - prioridad(a)).slice(0, conf.n);
  correrTest(barajar(preguntas), conf.modo);
}

// Peso de una pregunta para elegir: lo no visto y lo fallado primero, y los temas que más caen en examen.
function prioridad(q) {
  const r = E.res[q.id];
  const estado = !r ? 1 : r.ok ? 0.25 : 1.6;
  const imp = 1 + Math.min(D.importancia?.[q.tema] || 0, 8) / 4;
  return estado * imp * (0.6 + Math.random() * 0.8);
}
function testRapido() {
  correrTest(barajar([...D.vf].sort((a, b) => prioridad(b) - prioridad(a)).slice(0, 10)), "examen");
}
// Simulacro: 40 de todo el temario, repartidas por tema en proporción a lo que cae en examen.
function simulacro() {
  const porTema = {};
  for (const q of D.vf) (porTema[q.tema] ??= []).push(q);
  const pesos = Object.fromEntries(Object.keys(porTema).map((t) => [t, 1 + (D.importancia?.[t] || 0)]));
  const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
  let elegidas = [];
  for (const [t, qs] of Object.entries(porTema)) {
    const n = Math.max(1, Math.round((40 * pesos[t]) / suma));
    elegidas.push(...barajar(qs).slice(0, n));
  }
  elegidas = barajar(elegidas).slice(0, 40);
  if (elegidas.length < 40) elegidas.push(...barajar(D.vf.filter((q) => !elegidas.includes(q))).slice(0, 40 - elegidas.length));
  correrTest(barajar(elegidas), "examen");
}

function alertaSuave(txt) {
  const p = h("p", { class: "rounded-xl bg-amber-50 p-3 text-sm text-amber-800", role: "status" }, txt);
  app.append(p); setTimeout(() => p.remove(), 3500);
}

function correrTest(preguntas, modo) {
  const resp = {}; let i = 0;
  const pintar = () => {
    app.textContent = "";
    if (i >= preguntas.length) return resultadoTest(preguntas, resp);
    const q = preguntas[i];
    app.append(h("div", { class: "flex items-center gap-3 text-sm text-slate-500" },
      h("button", { class: "rounded-lg p-1 hover:bg-slate-100", "aria-label": "Salir del test", onclick: () => ir() }, icono("x")),
      h("div", { class: "h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" }, h("div", { class: "h-full bg-teal-600", style: `width:${(100 * i) / preguntas.length}%` })),
      h("span", { class: "tabular-nums" }, `${i + 1}/${preguntas.length}`)));
    const caja = h("section", { class: tarjeta("flex flex-col gap-4") },
      h("p", { class: "text-xs font-semibold uppercase tracking-wide text-teal-700" }, q.tema),
      molecula(q.smiles),
      h("p", { class: "text-lg leading-relaxed" }, q.enunciado));
    app.append(caja);

    const elegir = (v) => {
      resp[q.id] = v;
      if (v !== null) registrar(q.id, v === q.respuesta);
      if (modo === "practica" && v !== null) mostrarCorreccion(caja, q, v, botones);
      else { i++; pintar(); }
    };
    const botones = h("div", { class: "grid grid-cols-3 gap-2" },
      h("button", { class: boton("bg-emerald-600 text-white hover:bg-emerald-700"), onclick: () => elegir(true) }, "Verdadero"),
      h("button", { class: boton("bg-rose-600 text-white hover:bg-rose-700"), onclick: () => elegir(false) }, "Falso"),
      h("button", { class: secundario, onclick: () => elegir(null) }, "En blanco"));
    app.append(botones);
    pintarIconos();
    function mostrarCorreccion(caja, q, v, botones) {
      const ok = v === q.respuesta;
      botones.replaceWith(h("button", { class: primario, onclick: () => { i++; pintar(); } }, i + 1 < preguntas.length ? "Siguiente" : "Ver resultado"));
      caja.append(h("div", { class: `rounded-xl p-3 ${ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}` },
        h("p", { class: "font-semibold" }, `${ok ? "¡Bien!" : "Fallo."} Es ${q.respuesta ? "VERDADERO" : "FALSO"}.`),
        h("p", { class: "mt-1" }, q.explicacion), q.trampa ? h("p", { class: "mt-1 text-sm opacity-80" }, `Trampa: ${q.trampa}`) : null),
        fuente(q.fuente));
      pintarIconos();
    }
  };
  pintar();
}

function resultadoTest(preguntas, resp) {
  let bien = 0, mal = 0, blanco = 0;
  for (const q of preguntas) { const v = resp[q.id]; if (v === null || v === undefined) blanco++; else if (v === q.respuesta) bien++; else mal++; }
  const nota = Math.max(0, (10 * (bien - mal)) / preguntas.length);
  E.tests.push({ asig: E.asig, fecha: Date.now(), n: preguntas.length, bien, mal, blanco, nota }); guardar();

  app.append(h("section", { class: tarjeta("flex flex-col items-center gap-2 text-center") },
    h("p", { class: "text-sm text-slate-500" }, "Tu nota"),
    h("p", { class: `text-5xl font-bold tabular-nums ${nota >= 5 ? "text-emerald-600" : "text-rose-600"}` }, nota.toFixed(1)),
    h("p", { class: "text-sm text-slate-600" }, `${bien} bien · ${mal} mal · ${blanco} en blanco (+1 / −1 / 0)`)));

  const porTema = {};
  for (const q of preguntas) { const t = (porTema[q.tema] ??= { b: 0, n: 0 }); t.n++; if (resp[q.id] === q.respuesta) t.b++; }
  app.append(h("section", { class: tarjeta("flex flex-col gap-2") }, h("h2", { class: "font-semibold" }, "Por tema"),
    Object.entries(porTema).sort((a, b) => a[1].b / a[1].n - b[1].b / b[1].n).map(([t, x]) =>
      h("div", { class: "flex justify-between gap-3 text-sm" }, h("span", { class: "min-w-0" }, t), h("span", { class: "tabular-nums" }, `${x.b}/${x.n}`)))));

  const lista = h("section", { class: "flex flex-col gap-3" }, h("h2", { class: "font-semibold" }, "Corrección"));
  for (const q of preguntas) {
    const v = resp[q.id]; const ok = v === q.respuesta;
    const estado = v === null || v === undefined ? ["En blanco", "bg-slate-100 text-slate-600"] : ok ? ["Bien", "bg-emerald-50 text-emerald-800"] : ["Mal", "bg-rose-50 text-rose-800"];
    lista.append(h("details", { class: tarjeta("p-4"), open: !ok ? "" : null },
      h("summary", { class: "flex cursor-pointer items-start gap-3" }, h("span", { class: `shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${estado[1]}` }, estado[0]),
        h("span", { class: "text-sm" }, q.enunciado)),
      h("div", { class: "mt-3 flex flex-col gap-2 text-sm" }, molecula(q.smiles),
        h("p", {}, h("b", {}, q.respuesta ? "Verdadero. " : "Falso. "), q.explicacion),
        q.trampa ? h("p", { class: "text-slate-500" }, `Trampa: ${q.trampa}`) : null, fuente(q.fuente))));
  }
  app.append(lista, h("div", { class: "grid grid-cols-2 gap-3" },
    h("a", { href: "#fallos", class: secundario + " text-center" }, "Ver mis fallos"),
    h("button", { class: primario, onclick: () => ir() }, "Otro test")));
  pintarIconos();
}

// ---------- TARJETAS ----------
function tarjetas() {
  const { due, nuevas } = pendientes();
  const cola = [...barajar(due), ...nuevas];
  app.append(h("h1", { class: "text-xl font-bold" }, "Tarjetas"));
  if (!cola.length) {
    app.append(h("section", { class: tarjeta("text-center") }, h("p", { class: "font-semibold" }, "Nada pendiente por hoy."),
      h("p", { class: "text-sm text-slate-500" }, "Vuelve mañana, o haz un test: lo que falles aparecerá aquí.")));
    return;
  }
  let i = 0;
  const zona = h("div", { class: "flex flex-col gap-4" });
  app.append(zona);
  const pintar = () => {
    zona.textContent = "";
    if (i >= cola.length) { zona.append(h("section", { class: tarjeta("text-center font-semibold") }, "¡Hecho por hoy!")); return; }
    const c = D.porId[cola[i]];
    const esVF = "enunciado" in c;
    const frente = esVF ? `¿Verdadero o falso? ${c.enunciado}` : c.frente;
    const dorso = esVF ? `${c.respuesta ? "Verdadero" : "Falso"}. ${c.explicacion}` : c.dorso;
    zona.append(h("p", { class: "text-sm text-slate-500" }, `${i + 1} de ${cola.length} · ${c.tema}`));
    const carta = h("section", { class: tarjeta("flex min-h-[14rem] flex-col justify-center gap-4 text-center") }, molecula(c.smiles), h("p", { class: "text-lg" }, frente));
    zona.append(carta);
    const girar = h("button", { class: primario, onclick: () => {
      carta.append(h("hr", { class: "border-slate-200" }), h("p", { class: "text-lg font-semibold text-teal-800" }, dorso), fuente(c.fuente));
      girar.replaceWith(h("div", { class: "grid grid-cols-4 gap-2" }, ["Otra vez", "Difícil", "Bien", "Fácil"].map((t, n) =>
        h("button", { class: n === 0 ? boton("bg-rose-600 text-white") : n === 2 ? primario : secundario, onclick: () => { calificar(c.id, n); if (n === 0) cola.push(c.id); i++; pintar(); } }, t))));
      pintarIconos();
    } }, "Mostrar respuesta");
    zona.append(girar);
    pintarIconos();
  };
  pintar();
}

// ---------- FEED ----------
function feed() {
  const items = [];
  const clips = barajar(D.clips);
  const vfs = barajar(D.vf.filter((q) => (q.dificultad || 1) <= 2));
  clips.forEach((c, n) => { items.push({ tipo: "clip", c }); if (n % 3 === 2 && vfs.length) items.push({ tipo: "vf", q: vfs.pop() }); });

  const cont = h("div", { class: "feed bg-slate-950 text-white" });
  const voz = h("button", { class: "fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 rounded-full bg-white/15 p-3 backdrop-blur", "aria-label": "Voz",
    onclick: () => { E.voz = !E.voz; guardar(); voz.replaceChildren(icono(E.voz ? "volume-2" : "volume-x")); pintarIconos(); if (!E.voz) speechSynthesis.cancel(); else leerActual(); } },
    icono(E.voz ? "volume-2" : "volume-x"));
  const salir = h("a", { href: "#inicio", class: "fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 rounded-full bg-white/15 p-3 backdrop-blur", "aria-label": "Salir" }, icono("x"));
  app.append(cont, voz, salir);

  for (const it of items) {
    const sec = h("section", { class: "clip relative flex flex-col justify-center gap-5 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-20" });
    if (it.tipo === "clip") {
      const c = it.c;
      sec.dataset.voz = [c.gancho, ...c.lineas, c.truco].filter(Boolean).join(". ");
      sec.append(h("p", { class: "text-xs font-semibold uppercase tracking-widest text-teal-300" }, c.tema),
        h("h2", { class: "text-3xl font-bold leading-tight" }, c.titulo),
        h("p", { class: "text-lg text-slate-300" }, c.gancho));
      const m = molecula(c.smiles, 280); if (m) sec.append(m);
      const ul = h("ul", { class: "flex flex-col gap-3 text-xl font-medium" }, c.lineas.map((l) => h("li", { class: "linea border-l-4 border-teal-400 pl-3" }, l)));
      sec.append(ul);
      if (c.truco) sec.append(h("p", { class: "linea rounded-xl bg-teal-400/15 p-3 text-base text-teal-100" }, `💡 ${c.truco}`));
      sec.append(h("p", { class: "text-xs text-slate-500" }, `Apuntes, pág. ${c.fuente?.pag ?? "–"}`));
    } else {
      const q = it.q;
      sec.dataset.voz = `¿Verdadero o falso? ${q.enunciado}`;
      sec.append(h("p", { class: "text-xs font-semibold uppercase tracking-widest text-amber-300" }, "Pregunta rápida"),
        h("p", { class: "text-2xl font-semibold leading-snug" }, q.enunciado));
      const res = h("div", { class: "min-h-[6rem]" });
      const b = (v, txt, cls) => h("button", { class: boton(cls), onclick: () => {
        const ok = v === q.respuesta; registrar(q.id, ok);
        res.replaceChildren(h("div", { class: `rounded-xl p-3 ${ok ? "bg-emerald-500/20" : "bg-rose-500/20"}` },
          h("p", { class: "font-semibold" }, `${ok ? "¡Bien!" : "No."} Es ${q.respuesta ? "verdadero" : "falso"}.`), h("p", { class: "text-sm text-slate-200" }, q.explicacion)));
      } }, txt);
      sec.append(h("div", { class: "grid grid-cols-2 gap-3" }, b(true, "Verdadero", "bg-emerald-600"), b(false, "Falso", "bg-rose-600")), res);
    }
    cont.append(sec);
  }
  cont.append(h("section", { class: "clip flex flex-col items-center justify-center gap-4 px-6 text-center" },
    h("p", { class: "text-2xl font-bold" }, "¡Has llegado al final!"), h("a", { href: "#test", class: primario }, "Hacer un test")));

  let actual = null;
  function leerActual() {
    speechSynthesis.cancel();
    if (!E.voz || !actual?.dataset.voz) return;
    const u = new SpeechSynthesisUtterance(actual.dataset.voz);
    u.lang = "es-ES"; u.rate = E.vel;
    const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith("es-ES")) || speechSynthesis.getVoices().find((x) => x.lang?.startsWith("es"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  const obs = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      actual = e.target;
      e.target.querySelectorAll(".linea").forEach((l, n) => setTimeout(() => l.classList.add("on"), 400 + n * 900));
      marcarDia(); leerActual();
    }
  }, { root: cont, threshold: 0.6 });
  cont.querySelectorAll(".clip").forEach((s) => obs.observe(s));
  limpiar = () => { obs.disconnect(); speechSynthesis.cancel(); };
}

// ---------- FALLOS ----------
function fallos() {
  const mal = D.vf.filter((q) => E.res[q.id] && !E.res[q.id].ok);
  app.append(h("h1", { class: "text-xl font-bold" }, "Tus fallos"));
  if (!mal.length) { app.append(h("section", { class: tarjeta("text-center text-slate-600") }, "No tienes fallos pendientes. Haz un test y aquí verás lo que tienes que repasar.")); return; }
  app.append(h("button", { class: primario, onclick: () => correrTest(barajar(mal).slice(0, 40), "practica") }, `Repetir mis ${Math.min(mal.length, 40)} fallos`));
  const porTema = {};
  for (const q of mal) (porTema[q.tema] ??= []).push(q);
  for (const [t, qs] of Object.entries(porTema).sort((a, b) => b[1].length - a[1].length)) {
    app.append(h("section", { class: tarjeta("flex flex-col gap-3") },
      h("h2", { class: "flex justify-between font-semibold" }, h("span", {}, t), h("span", { class: "text-rose-600" }, qs.length)),
      qs.map((q) => h("details", { class: "border-t border-slate-100 pt-3" },
        h("summary", { class: "cursor-pointer text-sm" }, q.enunciado),
        h("div", { class: "mt-2 flex flex-col gap-2 text-sm" }, h("p", {}, h("b", {}, q.respuesta ? "Verdadero. " : "Falso. "), q.explicacion), fuente(q.fuente))))));
  }
}

// ---------- ABIERTAS ----------
function abiertas() {
  app.append(h("h1", { class: "text-xl font-bold" }, "Preguntas para escribir"),
    h("p", { class: "text-sm text-slate-500" }, E.codigo ? "Escribe tu respuesta y la IA te la corrige con tus apuntes." : "Escribe tu respuesta y compárala con la respuesta modelo. (Con el código de acceso en Ajustes, la corrige la IA.)"));
  for (const q of D.abiertas) {
    const ta = h("textarea", { id: `ab-${q.id}`, rows: 5, class: "w-full rounded-xl border border-slate-200 p-3 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30", placeholder: "Tu respuesta…" });
    const salida = h("div", { class: "flex flex-col gap-2" });
    const ver = h("button", { class: secundario, onclick: () => {
      salida.replaceChildren(h("div", { class: "rounded-xl bg-teal-50 p-3 text-sm text-teal-900" }, h("p", { class: "font-semibold" }, "Respuesta modelo"), h("p", {}, q.respuesta_modelo)),
        h("p", { class: "text-sm font-medium text-slate-600" }, "¿Has dicho esto?"),
        ...q.rubrica.map((r, n) => h("label", { class: "flex items-start gap-2 text-sm" }, h("input", { type: "checkbox", id: `rb-${q.id}-${n}`, class: "mt-0.5 h-5 w-5 accent-teal-600" }), r)),
        fuente(q.fuente));
      pintarIconos();
    } }, "Ver respuesta modelo");
    const botones = h("div", { class: "flex flex-wrap gap-2" }, ver);
    if (E.codigo) botones.append(h("button", { class: primario, onclick: async (ev) => {
      if (!ta.value.trim()) return;
      ev.target.disabled = true; ev.target.textContent = "Corrigiendo…";
      try {
        const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: E.codigo, pregunta: q.pregunta, respuesta_modelo: q.respuesta_modelo, rubrica: q.rubrica, cita: q.fuente?.cita, respuesta: ta.value.trim() }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error");
        salida.replaceChildren(h("div", { class: "rounded-xl bg-slate-50 p-3 text-sm" },
          h("p", { class: "text-lg font-bold" }, `${d.nota}/10`), h("p", {}, d.comentario),
          d.falta?.length ? h("ul", { class: "mt-2 list-disc pl-5" }, d.falta.map((f) => h("li", {}, f))) : null));
      } catch (e) { salida.replaceChildren(h("p", { class: "text-sm text-rose-700" }, `No se ha podido corregir: ${e.message}`)); }
      ev.target.disabled = false; ev.target.textContent = "Corregir con IA";
    } }, "Corregir con IA"));
    app.append(h("section", { class: tarjeta("flex flex-col gap-3") }, h("p", { class: "text-xs font-semibold uppercase tracking-wide text-teal-700" }, q.tema),
      h("p", { class: "font-medium" }, q.pregunta), ta, botones, salida));
  }
}

// ---------- AJUSTES ----------
function ajustes() {
  const codigo = h("input", { id: "codigo", type: "password", autocomplete: "off", value: E.codigo, class: "rounded-xl border border-slate-200 p-3 text-base" });
  const vel = h("input", { id: "vel", type: "range", min: "0.7", max: "1.5", step: "0.1", value: String(E.vel), class: "accent-teal-600" });
  const estado = h("p", { class: "text-sm text-slate-500", "aria-live": "polite" });
  app.append(h("h1", { class: "text-xl font-bold" }, "Ajustes"),
    h("section", { class: tarjeta("flex flex-col gap-5") },
      h("label", { class: "flex flex-col gap-1 text-sm font-medium text-slate-600" }, "Código de acceso (opcional)", codigo,
        h("span", { class: "font-normal text-slate-500" }, "Solo sirve para que la IA corrija las preguntas para escribir. Todo lo demás funciona sin él.")),
      h("label", { class: "flex flex-col gap-1 text-sm font-medium text-slate-600" }, "Velocidad de la voz del feed", vel),
      h("button", { class: primario, onclick: () => { E.codigo = codigo.value.trim(); E.vel = Number(vel.value); guardar(); estado.textContent = "Guardado."; } }, "Guardar")),
    h("section", { class: tarjeta("flex flex-col gap-3") }, h("h2", { class: "font-semibold" }, "Copia de seguridad del progreso"),
      h("p", { class: "text-sm text-slate-500" }, "Tu progreso se guarda en este móvil. Copia el texto para pasarlo a otro dispositivo."),
      h("button", { class: secundario, onclick: async () => {
        const txt = JSON.stringify({ ...E, codigo: "" });
        try { await navigator.clipboard.writeText(txt); estado.textContent = "Progreso copiado."; } catch { estado.textContent = "No se ha podido copiar."; }
      } }, "Copiar mi progreso"),
      h("button", { class: secundario, onclick: async () => {
        try { const s = JSON.parse(await navigator.clipboard.readText()); Object.assign(E, s, { codigo: E.codigo }); guardar(); estado.textContent = "Progreso restaurado."; }
        catch { estado.textContent = "En el portapapeles no hay un progreso válido."; }
      } }, "Pegar progreso copiado"), estado),
    h("a", { href: "https://saraprints.vercel.app", class: "text-center text-sm text-teal-700 underline" }, "Ir a Saraprints (impresora)"));
}

// ---------- arranque ----------
(async () => {
  try { await cargarDatos(); }
  catch { app.innerHTML = '<p class="pt-24 text-center text-slate-600">No se han podido cargar las preguntas. Revisa la conexión y recarga.</p>'; return; }
  addEventListener("hashchange", ir);
  ir();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
