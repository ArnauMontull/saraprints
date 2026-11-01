// Flujo de la app: foto → modo → resultado → guardar tiras (PNG) para imprimirlas con Tiny Print.
import { cargarImagen, fotoParaApi, escalar, aUnBit, rotar90, trocear, franjas, numerar, aBlob } from "./imagen.js";
import { fuenteACanvas, svgACanvas, hojaDePrueba } from "./render.js";

const $ = (id) => document.getElementById(id);

const AJUSTES_INICIALES = { codigo: "", ancho: 384, pxPorMm: 8, largoMm: 0, letra: 20, umbral: 160 };
const ajustes = { ...AJUSTES_INICIALES, ...leer("ajustes", {}) };

const estado = {
  img: null,
  modo: null,
  svg: "", // Redibujar (el texto de Transcribir vive en el <textarea id="fuente">)
  ficheros: [], // PNG listos para compartir (se preparan antes del toque para no perder el permiso de iOS)
};

// localStorage puede fallar en modo privado: la app funciona igual, solo no recuerda los ajustes
function leer(clave, porDefecto) {
  try {
    return JSON.parse(localStorage.getItem(`saraprints.${clave}`)) ?? porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave, valor) {
  try {
    localStorage.setItem(`saraprints.${clave}`, JSON.stringify(valor));
  } catch {}
}

function mostrar(el, si, clase = "flex") {
  el.classList.toggle("hidden", !si);
  el.classList.toggle(clase, si);
}

function error(msg) {
  $("error").textContent = msg ?? "";
  mostrar($("error"), Boolean(msg), "block");
}

async function ocupado(texto, tarea) {
  $("texto-cargando").textContent = texto;
  mostrar($("cargando"), true);
  error(null);
  try {
    return await tarea();
  } catch (e) {
    console.error(e);
    error(e.message ?? String(e));
  } finally {
    mostrar($("cargando"), false);
  }
}

// ---------- Foto ----------
$("entrada-foto").addEventListener("change", async (ev) => {
  const fichero = ev.target.files?.[0];
  ev.target.value = "";
  if (!fichero) return;
  await ocupado("Abriendo la foto…", async () => {
    estado.img = await cargarImagen(fichero);
    $("miniatura").src = estado.img.src;
    mostrar($("zona-foto"), false);
    mostrar($("foto-elegida"), true);
    $("paso-modo").classList.remove("opacity-50");
    $("paso-modo").removeAttribute("aria-disabled");
    mostrar($("paso-resultado"), false);
    mostrar($("barra-guardar"), false, "block");
    marcarModo(null);
  });
});
$("btn-cambiar").addEventListener("click", () => $("entrada-foto").click());

// ---------- Modos ----------
function marcarModo(modo) {
  estado.modo = modo;
  for (const b of document.querySelectorAll(".modo")) {
    const activo = b.dataset.modo === modo;
    b.classList.toggle("border-teal-600", activo);
    b.classList.toggle("ring-2", activo);
    b.classList.toggle("ring-teal-600/30", activo);
  }
}

const TITULOS = { transcribir: "Transcripción", mejorar: "Foto mejorada", redibujar: "Esquema redibujado", tiras: "Tiras" };

for (const b of document.querySelectorAll(".modo")) {
  b.addEventListener("click", () => {
    if (!estado.img) return $("entrada-foto").click();
    elegirModo(b.dataset.modo);
  });
}

async function elegirModo(modo) {
  marcarModo(modo);
  $("titulo-resultado").textContent = TITULOS[modo];
  $("coste").textContent = "";
  avisos("");
  mostrar($("ctl-fuente"), modo === "transcribir");
  mostrar($("ctl-letra"), modo === "transcribir");
  mostrar($("ctl-columnas"), modo === "tiras");
  mostrar($("ctl-opciones"), modo === "mejorar" || modo === "tiras");
  mostrar($("ctl-numerar"), modo === "tiras");
  mostrar($("btn-calidad"), modo === "transcribir" || modo === "redibujar");
  $("tramado").checked = false;
  $("girar").checked = false;

  if (modo === "transcribir" || modo === "redibujar") {
    const ok = await pedirIa(modo, "rapido");
    if (!ok) return;
  }
  await pintar();
}

// ---------- IA ----------
async function pedirIa(modo, calidad) {
  if (!ajustes.codigo) {
    error("Falta el código de acceso: ponlo en Ajustes (rueda de arriba a la derecha).");
    $("btn-ajustes").click();
    return false;
  }
  const r = await ocupado(calidad === "bueno" ? "Leyendo con más calidad…" : "Leyendo la foto…", async () => {
    const resp = await fetch("/api/procesar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: ajustes.codigo, modo, calidad, imagen: fotoParaApi(estado.img) }),
    });
    const datos = await resp.json().catch(() => ({ error: `Error del servidor (${resp.status})` }));
    if (datos.coste_usd != null) $("coste").textContent = `≈ ${(datos.coste_usd * 100).toFixed(2)} céntimos`;
    if (!resp.ok) throw new Error(datos.error ?? `Error ${resp.status}`);
    return datos;
  });
  if (!r) return false;
  avisos(r.avisos);
  if (modo === "transcribir") {
    $("fuente").value = r.fuente;
  } else {
    estado.svg = r.svg;
  }
  return true;
}

function avisos(texto) {
  $("avisos").textContent = texto ? `Ojo: ${texto}` : "";
  mostrar($("avisos"), Boolean(texto), "block");
}

$("btn-calidad").addEventListener("click", async () => {
  if (await pedirIa(estado.modo, "bueno")) await pintar();
});
$("btn-actualizar").addEventListener("click", () => pintar());

// ---------- Controles ----------
function enlazarRango(id, clave, formato = (v) => v) {
  const el = $(id);
  if (clave) el.value = ajustes[clave];
  const etiqueta = () => ($(`${id}-valor`).textContent = formato(el.value));
  etiqueta();
  el.addEventListener("input", etiqueta);
  el.addEventListener("change", () => {
    if (clave) {
      ajustes[clave] = Number(el.value);
      guardar("ajustes", ajustes);
    }
    pintar();
  });
}
enlazarRango("letra", "letra", (v) => `${v} px`);
enlazarRango("umbral", "umbral");
enlazarRango("columnas", null);
for (const id of ["tramado", "girar", "numerar"]) $(id).addEventListener("change", () => pintar());

// ---------- Pintar el resultado ----------
async function generar() {
  const { ancho, umbral, letra } = ajustes;
  const largo = Math.round(ajustes.largoMm * ajustes.pxPorMm);
  const tramado = $("tramado").checked;
  const girar = $("girar").checked;
  // Girar antes de recortar: una foto apaisada pasa a ocupar el largo de la tira. Se reduce antes para no
  // crear un canvas de 12 Mpx en el iPhone.
  const foto = () => (girar ? rotar90(escalar(estado.img, Math.min(estado.img.naturalWidth, 2000))) : estado.img);
  switch (estado.modo) {
    case "transcribir":
      return trocear(await fuenteACanvas($("fuente").value, { ancho, letra, umbral }), largo);
    case "redibujar":
      return trocear(await svgACanvas(estado.svg, { ancho, umbral }), largo);
    case "mejorar":
      return trocear(aUnBit(escalar(foto(), ancho), { umbral, tramado, limpiar: true }), largo);
    case "tiras": {
      const cols = Number($("columnas").value);
      const columnas = franjas(foto(), cols, ancho).map((f) => trocear(aUnBit(f, { umbral, tramado, limpiar: true }), largo));
      if (!$("numerar").checked) return columnas.flat();
      // Una pieza por columna: «2/4» de izquierda a derecha. Columnas cortadas en trozos: letra = columna
      // (A a la izquierda) y número = trozo de arriba abajo («B2»)
      const cortadas = columnas.some((c) => c.length > 1);
      return columnas.flatMap((piezas, i) =>
        piezas.map((p, j) => numerar(p, cortadas ? `${"ABCD"[i]}${j + 1}` : `${i + 1}/${cols}`)),
      );
    }
    case "prueba":
      return [await hojaDePrueba(ajustes)];
  }
  return [];
}

async function pintar() {
  if (!estado.modo) return;
  await ocupado("Preparando las tiras…", async () => {
    // Deja que el navegador pinte el aviso antes de bloquearse con el canvas
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const tiras = await generar();
    await mostrarTiras(tiras, estado.modo);
  });
}

async function mostrarTiras(tiras, nombre) {
  const vista = $("vista");
  vista.replaceChildren(
    ...tiras.map((c) => {
      c.className = "tira";
      return c;
    }),
  );
  const mm = (px) => Math.round(px / ajustes.pxPorMm);
  const total = tiras.reduce((s, c) => s + c.height, 0);
  $("resumen-tiras").textContent =
    tiras.length === 1 ? `1 tira de ${mm(total)} mm` : `${tiras.length} tiras · ${mm(total)} mm de papel en total`;
  const fecha = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  estado.ficheros = await Promise.all(
    tiras.map(async (c, i) => new File([await aBlob(c)], `saraprints-${nombre}-${fecha}-${String(i + 1).padStart(2, "0")}.png`, { type: "image/png" })),
  );
  $("texto-guardar").textContent = tiras.length === 1 ? "Guardar tira" : `Guardar ${tiras.length} tiras`;
  mostrar($("paso-resultado"), true);
  mostrar($("barra-guardar"), true, "block");
}

// ---------- Guardar / compartir ----------
$("btn-guardar").addEventListener("click", async () => {
  const files = estado.ficheros;
  if (!files.length) return;
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
    } catch (e) {
      if (e.name !== "AbortError") error("No se ha podido compartir: " + e.message);
    }
    return;
  }
  // Ordenador o navegador sin compartir: descarga una a una
  for (const f of files) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
});

// ---------- Ajustes ----------
const dlgAjustes = $("dlg-ajustes");
$("btn-ajustes").addEventListener("click", () => {
  $("aj-codigo").value = ajustes.codigo;
  $("aj-ancho").value = ajustes.ancho;
  $("aj-pxmm").value = ajustes.pxPorMm;
  $("aj-largo").value = ajustes.largoMm;
  dlgAjustes.showModal();
});
dlgAjustes.addEventListener("close", () => {
  if (dlgAjustes.returnValue !== "ok") return;
  ajustes.codigo = $("aj-codigo").value.trim();
  ajustes.ancho = Math.round(Number($("aj-ancho").value) || AJUSTES_INICIALES.ancho);
  ajustes.pxPorMm = Number($("aj-pxmm").value) || AJUSTES_INICIALES.pxPorMm;
  ajustes.largoMm = Math.max(0, Number($("aj-largo").value) || 0);
  guardar("ajustes", ajustes);
  if (estado.modo) pintar();
});
$("btn-prueba").addEventListener("click", async () => {
  dlgAjustes.close("cancelar");
  marcarModo(null);
  estado.modo = "prueba";
  $("titulo-resultado").textContent = "Hoja de prueba";
  for (const id of ["ctl-fuente", "ctl-letra", "ctl-columnas", "ctl-opciones", "btn-calidad", "avisos"]) mostrar($(id), false);
  $("coste").textContent = "";
  await pintar();
});
$("btn-ayuda").addEventListener("click", () => $("dlg-ayuda").showModal());

// ---------- Arranque ----------
window.addEventListener("load", () => window.lucide?.createIcons());
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
if (!leer("visto-ayuda", false)) {
  guardar("visto-ayuda", true);
  window.addEventListener("load", () => $("dlg-ayuda").showModal());
}
