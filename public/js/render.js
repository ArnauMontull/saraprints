// Convierte el texto «fuente» de Transcribir (mini formato descrito en prompts/transcribir.md) en tiras de 1 bit,
// y el SVG de Redibujar en una imagen. MathJax (fórmulas y mhchem) y SmilesDrawer se cargan por CDN en index.html.
//
// Cómo se pasa HTML a imagen sin librerías: se monta el HTML en un <div> fuera de pantalla, se mete en un SVG con
// <foreignObject> y ese SVG se pinta en un <canvas>. Funciona en Safari/iOS siempre que no haya fuentes ni imágenes
// externas: por eso las fórmulas y las moléculas van como SVG en línea y el texto usa Arial (del sistema).
import { lienzo, escalar, aUnBit, rotar90, apilar } from "./imagen.js";

const ESCALA = 2; // se pinta al doble y se reduce: el texto sale más limpio al pasar a 1 bit
const GROSOR_FORMULAS = 45; // trazo extra de MathJax (milésimas de em): las fórmulas finas desaparecen en la térmica

const PAPEL_CSS = `
.sp-papel { background:#fff; color:#000; font-family:Arial,"Helvetica Neue",Helvetica,sans-serif; font-weight:700;
  line-height:1.3; padding:4px 6px; box-sizing:border-box; overflow-wrap:anywhere; }
.sp-papel * { box-sizing:border-box; }
.sp-titulo { font-size:1.3em; border-bottom:3px solid #000; margin:0.2em 0 0.35em; padding-bottom:0.1em; }
.sp-parrafo, .sp-item { margin:0.15em 0; }
.sp-item { padding-left:0.2em; }
.sp-marca { text-decoration:underline; text-decoration-thickness:3px; }
.sp-hueco { height:0.5em; }
.sp-formula { margin:0.3em 0; text-align:center; }
.sp-mol { display:block; margin:0.2em auto; }
.sp-tabla { border-collapse:collapse; width:100%; margin:0.3em 0; }
.sp-tabla th, .sp-tabla td { border:2px solid #000; padding:2px 4px; text-align:left; vertical-align:top; }
.sp-tabla th { border-bottom-width:4px; }
.sp-papel mjx-container { display:inline-block; }
.sp-papel mjx-container[display="true"] { display:block; text-align:center; margin:0.2em 0; }
.sp-papel mjx-container svg { overflow:visible; }
.sp-muestra div { margin-bottom:6px; }
.sp-girada { display:inline-block; max-width:1400px; }
.sp-girada .sp-tabla { width:auto; }
.sp-girada th, .sp-girada td { white-space:nowrap; }
`;
document.head.append(Object.assign(document.createElement("style"), { textContent: PAPEL_CSS }));

// Separa la fuente en trozos: texto normal y tablas marcadas con «girar: si», que se pintan aparte y giradas
export function segmentar(fuente) {
  const lineas = fuente.replace(/\r/g, "").split("\n");
  const segs = [];
  let actual = [];
  let girarSiguiente = false;
  const cerrar = () => {
    if (actual.length) segs.push({ girar: false, lineas: actual });
    actual = [];
  };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim();
    if (/^girar:\s*s[ií]/i.test(l)) {
      girarSiguiente = true;
      continue;
    }
    if (girarSiguiente && l.startsWith("|")) {
      cerrar();
      const tabla = [];
      while (i < lineas.length && lineas[i].trim().startsWith("|")) tabla.push(lineas[i++].trim());
      i--;
      segs.push({ girar: true, lineas: tabla });
      girarSiguiente = false;
      continue;
    }
    if (l) girarSiguiente = false;
    actual.push(lineas[i]);
  }
  cerrar();
  return segs;
}

const escaparHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Negrita **así**, sin tocar lo que va entre $ (MathJax lo pinta después)
function enLinea(texto) {
  return escaparHtml(texto).replace(/\*\*(.+?)\*\*/g, '<span class="sp-marca">$1</span>');
}

function celdas(fila) {
  return fila.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

const div = (clase, html) => Object.assign(document.createElement("div"), { className: clase, innerHTML: html });

// Construye el DOM de las líneas dentro de `caja`. Devuelve los SMILES pendientes de dibujar.
function construir(lineas, caja) {
  const smiles = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim();
    if (!l) {
      caja.append(div("sp-hueco", ""));
    } else if (l.startsWith("# ")) {
      caja.append(div("sp-titulo", enLinea(l.slice(2))));
    } else if (l.startsWith("- ")) {
      caja.append(div("sp-item", "• " + enLinea(l.slice(2))));
    } else if (/^smiles:/i.test(l)) {
      const hueco = div("sp-mol", "");
      caja.append(hueco);
      smiles.push({ hueco, codigo: l.replace(/^smiles:\s*/i, "") });
    } else if (l.startsWith("|")) {
      const tabla = document.createElement("table");
      tabla.className = "sp-tabla";
      let primera = true;
      while (i < lineas.length && lineas[i].trim().startsWith("|")) {
        const tr = document.createElement("tr");
        for (const c of celdas(lineas[i].trim())) {
          const td = document.createElement(primera ? "th" : "td");
          td.innerHTML = enLinea(c);
          tr.append(td);
        }
        tabla.append(tr);
        primera = false;
        i++;
      }
      i--;
      caja.append(tabla);
    } else if (/^\$\$.*\$\$$/.test(l)) {
      caja.append(div("sp-formula", escaparHtml(l)));
    } else {
      caja.append(div("sp-parrafo", enLinea(l)));
    }
  }
  return smiles;
}

async function pintarFormulas(caja) {
  const mj = window.MathJax;
  if (!mj?.typesetPromise) throw new Error("No se han cargado las fórmulas (MathJax); revisa la conexión");
  await mj.startup.promise;
  await mj.typesetPromise([caja]);
  // Copia MathML para lectores de pantalla: la oculta una hoja de estilos de MathJax que no viaja al rasterizado
  caja.querySelectorAll("mjx-assistive-mml").forEach((n) => n.remove());
  // MathJax deja el grupo raíz con stroke-width 0: darle trazo engorda los glifos
  for (const g of caja.querySelectorAll("mjx-container > svg > g")) {
    g.setAttribute("stroke", "currentColor");
    g.setAttribute("stroke-width", String(GROSOR_FORMULAS));
  }
}

function dibujarSmiles({ hueco, codigo }, ancho) {
  return new Promise((ok) => {
    const tema = { BACKGROUND: "#fff" };
    for (const el of ["C", "O", "N", "F", "CL", "BR", "I", "P", "S", "B", "SI", "H"]) tema[el] = "#000";
    const alto = Math.round(ancho * 0.75);
    const drawer = new window.SmilesDrawer.SvgDrawer({
      width: ancho,
      height: alto,
      bondThickness: 2.4,
      bondLength: 30,
      fontSizeLarge: 13,
      fontSizeSmall: 9,
      padding: 12,
      themes: { mono: tema },
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hueco.append(svg);
    const fallo = () => {
      // SMILES inválido: se deja el código escrito para que Sara lo vea y lo corrija
      hueco.className = "sp-parrafo";
      hueco.textContent = `[estructura no válida: ${codigo}]`;
      ok(false);
    };
    window.SmilesDrawer.parse(
      codigo,
      (arbol) => {
        try {
          // SmilesDrawer 2.x: draw(árbol, destino, tema); el 4.º argumento ya no es «solo info»
          drawer.draw(arbol, svg, "mono");
          // Sin alto fijo: el viewBox que calcula SmilesDrawer decide la proporción y la molécula ocupa todo el ancho
          svg.removeAttribute("height");
          svg.removeAttribute("style");
          svg.setAttribute("width", ancho);
          // Los textos de los átomos llevan la fuente por clase CSS; se fija en línea para el rasterizado
          for (const t of svg.querySelectorAll("text")) t.setAttribute("font-family", "Arial, sans-serif");
          ok(true);
        } catch (e) {
          console.error(e);
          fallo();
        }
      },
      fallo,
    );
  });
}

// Pasa un elemento del DOM a canvas a través de SVG <foreignObject>
export function htmlACanvas(caja, ancho) {
  const alto = Math.ceil(caja.getBoundingClientRect().height);
  const html = new XMLSerializer().serializeToString(caja);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho * ESCALA}" height="${alto * ESCALA}" viewBox="0 0 ${ancho} ${alto}">` +
    `<foreignObject x="0" y="0" width="${ancho}" height="${alto}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml"><style>${PAPEL_CSS}</style>${html}</div>` +
    `</foreignObject></svg>`;
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const c = lienzo(ancho * ESCALA, alto * ESCALA);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ok(c);
    };
    img.onerror = () => mal(new Error("No se ha podido convertir el texto en imagen"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

// Sin `ancho`, la caja toma el ancho de su contenido (tablas que se van a girar)
function montar(ancho, letra, clase = "") {
  const caja = document.createElement("div");
  caja.className = `sp-papel ${clase}`.trim();
  if (ancho) caja.style.width = `${ancho}px`;
  caja.style.fontSize = `${letra}px`;
  document.getElementById("escenario").replaceChildren(caja);
  return caja;
}

// Pinta un trozo de fuente a un canvas de `ancho` px (a 1 bit). `letra` es el tamaño base en px.
// `ancho` null = tan ancho como el contenido (para girar).
async function pintarSegmento(lineas, ancho, letra, umbral) {
  const caja = montar(ancho, letra, ancho ? "" : "sp-girada");
  const smiles = construir(lineas, caja);
  await pintarFormulas(caja);
  for (const s of smiles) await dibujarSmiles(s, (ancho ?? 384) - 16);
  const w = ancho ?? Math.ceil(caja.getBoundingClientRect().width);
  const grande = await htmlACanvas(caja, w);
  document.getElementById("escenario").replaceChildren();
  return aUnBit(escalar(grande, w), { umbral });
}

// Tabla ancha: se pinta a su ancho natural y se gira 90°. Si girada queda estrecha, se repinta con letra más
// grande para llenar el papel (hasta el doble); si no cabe, se reduce.
async function tablaGirada(lineas, { ancho, letra, umbral }) {
  let c = rotar90(await pintarSegmento(lineas, null, letra, umbral));
  if (c.width < ancho * 0.8) {
    const mayor = Math.min(letra * 2, (letra * ancho * 0.95) / c.width);
    c = rotar90(await pintarSegmento(lineas, null, mayor, umbral));
  }
  return c.width > ancho ? aUnBit(escalar(c, ancho), { umbral }) : c;
}

export async function fuenteACanvas(fuente, opciones) {
  const { ancho, letra, umbral } = opciones;
  const partes = [];
  for (const seg of segmentar(fuente)) {
    partes.push(seg.girar ? await tablaGirada(seg.lineas, opciones) : await pintarSegmento(seg.lineas, ancho, letra, umbral));
  }
  return apilar(partes, ancho, Math.round(letra / 2));
}

// Quita lo peligroso del SVG de la IA. Se pinta como <img>, que ya no ejecuta scripts, pero mejor no fiarse.
export function limpiarSvg(svg) {
  // Solo lo que va de <svg a </svg> (por si la IA lo envuelve en ``` o texto) y con su namespace, sin el cual
  // el navegador no lo reconoce como imagen
  const inicio = svg.indexOf("<svg");
  const fin = svg.lastIndexOf("</svg>");
  if (inicio >= 0 && fin > inicio) svg = svg.slice(inicio, fin + 6);
  if (!/^<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) {
    svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const raiz = doc.documentElement;
  if (raiz.nodeName !== "svg" || doc.querySelector("parsererror")) throw new Error("El dibujo de la IA no es un SVG válido");
  doc.querySelectorAll("script, foreignObject, image, a, iframe, style").forEach((n) => n.remove());
  for (const el of doc.querySelectorAll("*")) {
    for (const at of [...el.attributes]) {
      const enlaceExterno = /href/i.test(at.name) && !at.value.startsWith("#");
      if (/^on/i.test(at.name) || enlaceExterno) el.removeAttribute(at.name);
    }
  }
  return new XMLSerializer().serializeToString(raiz);
}

export function svgACanvas(svg, { ancho, umbral }) {
  const limpio = limpiarSvg(svg);
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const vb = /viewBox="([\d.\s,-]+)"/.exec(limpio)?.[1].trim().split(/[\s,]+/).map(Number);
      const proporcion = vb?.length === 4 ? vb[3] / vb[2] : img.height / img.width || 1;
      const grande = lienzo(ancho * ESCALA, ancho * ESCALA * proporcion);
      const ctx = grande.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, grande.width, grande.height);
      ctx.drawImage(img, 0, 0, grande.width, grande.height);
      ok(aUnBit(escalar(grande, ancho), { umbral }));
    };
    img.onerror = () => mal(new Error("No se ha podido pintar el dibujo"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(limpio);
  });
}

// Hoja de prueba para docs/PRUEBAS_IMPRESORA.md: regla en mm, grises, tamaños de letra y un ejemplo de cada cosa
export async function hojaDePrueba({ ancho, pxPorMm, umbral }) {
  const regla = lienzo(ancho, 70);
  const ctx = regla.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, regla.width, regla.height);
  ctx.fillStyle = "#000";
  ctx.font = "bold 14px Arial, sans-serif";
  for (let mm = 0; mm * pxPorMm < ancho; mm++) {
    const x = Math.round(mm * pxPorMm);
    const largo = mm % 10 === 0 ? 30 : mm % 5 === 0 ? 20 : 10;
    ctx.fillRect(Math.min(x, ancho - 2), 0, 2, largo);
    if (mm % 10 === 0) ctx.fillText(String(mm), Math.min(x + 3, ancho - 20), 46);
  }
  ctx.fillText(`${ancho} px · ${pxPorMm} px/mm`, 6, 66);
  // Bordes: si alguno no sale impreso, el ancho real es menor
  ctx.fillRect(0, 0, 3, 70);
  ctx.fillRect(ancho - 3, 0, 3, 70);

  const grises = lienzo(ancho, 40);
  const g = grises.getContext("2d");
  const deg = g.createLinearGradient(0, 0, ancho, 0);
  deg.addColorStop(0, "#000");
  deg.addColorStop(1, "#fff");
  g.fillStyle = deg;
  g.fillRect(0, 0, ancho, 40);
  const conTramado = aUnBit(grises, { tramado: true, umbral: 128 });

  const caja = montar(ancho, 16, "sp-muestra");
  caja.innerHTML = [10, 12, 14, 16, 18, 20, 24]
    .map((t) => `<div style="font-size:${t}px">${t}px Farmacología $\\ce{C6H12O6}$</div>`)
    .join("");
  await pintarFormulas(caja);
  const letras = aUnBit(escalar(await htmlACanvas(caja, ancho), ancho), { umbral });

  const texto = await fuenteACanvas(
    [
      "# Hoja de prueba",
      "$$C(t)=C_0\\,e^{-k_e t}$$",
      "$\\ce{CH3COOH <=> CH3COO- + H+}$",
      "| Fármaco | Diana |",
      "| Ibuprofeno | COX-1/2 |",
      "smiles: CC(C)Cc1ccc(cc1)C(C)C(=O)O",
      "Ibuprofeno",
    ].join("\n"),
    { ancho, letra: 20, umbral },
  );
  return apilar([regla, conTramado, letras, texto], ancho, 12);
}
