// Procesado de imagen en el cliente (canvas): reducir, limpiar sombras, pasar a 1 bit y cortar en tiras.
// Todo trabaja con <canvas>; la impresora solo entiende blanco y negro, así que el último paso es siempre aUnBit().

export function lienzo(ancho, alto) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(ancho));
  c.height = Math.max(1, Math.round(alto));
  return c;
}

// La URL se mantiene viva porque la miniatura la usa; se libera al cargar la siguiente foto
let urlAnterior = null;
export function cargarImagen(fichero) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(fichero);
    const img = new Image();
    img.onload = () => {
      if (urlAnterior) URL.revokeObjectURL(urlAnterior);
      urlAnterior = url;
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      mal(new Error("No se ha podido abrir la imagen"));
    };
    img.src = url; // <img> ya aplica la orientación EXIF de las fotos del iPhone
  });
}

// Escala por mitades sucesivas: un solo drawImage a mucho menos tamaño deja el texto con dientes de sierra
export function escalar(origen, ancho) {
  const w0 = origen.naturalWidth ?? origen.width;
  const h0 = origen.naturalHeight ?? origen.height;
  let actual = origen;
  let w = w0;
  let h = h0;
  while (w / 2 > ancho) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const paso = lienzo(w, h);
    const ctx = paso.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(actual, 0, 0, w, h);
    actual = paso;
  }
  const alto = (h0 * ancho) / w0;
  const final = lienzo(ancho, alto);
  const ctx = final.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, final.width, final.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(actual, 0, 0, final.width, final.height);
  return final;
}

// Foto para la API: lado mayor ≤ 1600 px y JPEG, para que pese poco y cueste menos
export function fotoParaApi(img, ladoMax = 1600) {
  const w = img.naturalWidth ?? img.width;
  const h = img.naturalHeight ?? img.height;
  const k = Math.min(1, ladoMax / Math.max(w, h));
  return escalar(img, Math.round(w * k)).toDataURL("image/jpeg", 0.85);
}

function grises(datos) {
  const d = datos.data;
  const g = new Float32Array(datos.width * datos.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    // Un píxel transparente cuenta como papel blanco
    const a = d[i + 3] / 255;
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    g[p] = y * a + 255 * (1 - a);
  }
  return g;
}

// Estima el «papel» (fondo con sombras) con un mapa pequeño de máximos locales y divide la imagen por él.
// Así una hoja con sombra o luz amarillenta queda blanca y la tinta sigue negra.
function quitarSombras(g, w, h) {
  const celda = Math.max(8, Math.round(Math.max(w, h) / 40));
  const cw = Math.ceil(w / celda);
  const ch = Math.ceil(h / celda);
  let fondo = new Float32Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      // Percentil alto aproximado: el máximo de una rejilla 4×4 de muestras ignora la tinta fina
      let m = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const x = Math.min(w - 1, cx * celda + Math.floor(((sx + 0.5) * celda) / 4));
          const y = Math.min(h - 1, cy * celda + Math.floor(((sy + 0.5) * celda) / 4));
          m = Math.max(m, g[y * w + x]);
        }
      }
      fondo[cy * cw + cx] = m;
    }
  }
  // Suavizado 3×3 (dos pasadas) para que no se vean los cuadros
  for (let pasada = 0; pasada < 2; pasada++) {
    const s = new Float32Array(fondo.length);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        let suma = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < cw && yy < ch) {
              suma += fondo[yy * cw + xx];
              n++;
            }
          }
        }
        s[y * cw + x] = suma / n;
      }
    }
    fondo = s;
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(ch - 1.001, Math.max(0, y / celda - 0.5));
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(cw - 1.001, Math.max(0, x / celda - 0.5));
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const y1 = Math.min(ch - 1, y0 + 1);
      const x1 = Math.min(cw - 1, x0 + 1);
      const f =
        fondo[y0 * cw + x0] * (1 - tx) * (1 - ty) +
        fondo[y0 * cw + x1] * tx * (1 - ty) +
        fondo[y1 * cw + x0] * (1 - tx) * ty +
        fondo[y1 * cw + x1] * tx * ty;
      out[y * w + x] = Math.min(255, (g[y * w + x] / Math.max(f, 1)) * 255);
    }
  }
  return out;
}

// Pasa el canvas a blanco y negro puro, en el sitio.
// umbral: 0-255 (más alto = más negro). tramado: Atkinson, que en térmicas deja menos manchas que Floyd–Steinberg.
export function aUnBit(canvas, { umbral = 160, tramado = false, limpiar = false } = {}) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = datos.width;
  const h = datos.height;
  let g = grises(datos);
  if (limpiar) g = quitarSombras(g, w, h);
  if (tramado) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const viejo = g[i];
        // El umbral desplaza el punto medio para que el control funcione igual con y sin tramado
        const nuevo = viejo + (128 - umbral) < 128 ? 0 : 255;
        const err = (viejo - nuevo) / 8;
        g[i] = nuevo;
        for (const [dx, dy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < w && yy < h) g[yy * w + xx] += err;
        }
      }
    }
  }
  const d = datos.data;
  for (let p = 0, i = 0; p < g.length; p++, i += 4) {
    const v = tramado ? g[p] : g[p] < umbral ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(datos, 0, 0);
  return canvas;
}

export function rotar90(canvas) {
  const r = lienzo(canvas.height, canvas.width);
  const ctx = r.getContext("2d");
  ctx.translate(r.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);
  return r;
}

// Pone canvases uno debajo de otro, todos del mismo ancho, con un hueco blanco entre ellos
export function apilar(canvases, ancho, hueco = 0) {
  const alto = canvases.reduce((s, c) => s + c.height, 0) + hueco * Math.max(0, canvases.length - 1);
  const r = lienzo(ancho, alto);
  const ctx = r.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, r.width, r.height);
  let y = 0;
  for (const c of canvases) {
    ctx.drawImage(c, Math.round((ancho - c.width) / 2), y);
    y += c.height + hueco;
  }
  return r;
}

// Corta en trozos de altoMax px como mucho. Intenta cortar por una fila blanca cercana para no partir letras.
export function trocear(canvas, altoMax) {
  if (!altoMax || canvas.height <= altoMax) return [canvas];
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const filaBlanca = (y) => {
    for (let x = 0; x < canvas.width; x++) if (d[(y * canvas.width + x) * 4] < 128) return false;
    return true;
  };
  const trozos = [];
  let inicio = 0;
  while (canvas.height - inicio > altoMax) {
    let corte = inicio + altoMax;
    for (let y = corte; y > inicio + altoMax * 0.7; y--) {
      if (filaBlanca(y)) {
        corte = y;
        break;
      }
    }
    trozos.push(recortar(canvas, 0, inicio, canvas.width, corte - inicio));
    inicio = corte;
  }
  trozos.push(recortar(canvas, 0, inicio, canvas.width, canvas.height - inicio));
  return trozos;
}

export function recortar(canvas, x, y, w, h) {
  const r = lienzo(w, h);
  const ctx = r.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return r;
}

// Modo Tiras: la foto se reparte en `columnas` franjas verticales del ancho del papel, que se pegan una al lado de otra
export function franjas(img, columnas, ancho) {
  const grande = escalar(img, ancho * columnas);
  const out = [];
  for (let i = 0; i < columnas; i++) out.push(recortar(grande, i * ancho, 0, ancho, grande.height));
  return out;
}

// Banda pequeña encima con «2/5» para saber el orden al pegar
export function numerar(canvas, n, total) {
  const banda = 22;
  const r = lienzo(canvas.width, canvas.height + banda);
  const ctx = r.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, r.width, r.height);
  ctx.fillStyle = "#000";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`${n}/${total}`, 4, 2);
  ctx.fillRect(0, banda - 3, r.width, 1);
  ctx.drawImage(canvas, 0, banda);
  return r;
}

export function aBlob(canvas) {
  return new Promise((ok) => canvas.toBlob(ok, "image/png"));
}
