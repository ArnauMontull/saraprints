// Servidor local para probar sin la CLI de Vercel: sirve public/ y monta /api/procesar.
// Uso: npm run dev  (lee las variables de .env, que está ignorado por git)
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const publico = join(raiz, "public");

if (existsSync(join(raiz, ".env"))) {
  for (const linea of readFileSync(join(raiz, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { default: procesar } = await import("../api/procesar.js");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

// Adapta la respuesta de Node a la API de Vercel (res.status().json())
function adaptar(res) {
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (o) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(o));
  };
  return res;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/procesar") {
    let cuerpo = "";
    for await (const trozo of req) cuerpo += trozo;
    try {
      req.body = cuerpo ? JSON.parse(cuerpo) : {};
      await procesar(req, adaptar(res));
    } catch (e) {
      console.error(e);
      adaptar(res).status(500).json({ error: String(e.message ?? e) });
    }
    return;
  }
  let ruta = normalize(join(publico, decodeURIComponent(url.pathname)));
  if (!ruta.startsWith(publico)) return res.writeHead(403).end();
  if (existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, "index.html");
  if (!existsSync(ruta)) return res.writeHead(404).end("No existe");
  res.writeHead(200, { "Content-Type": TIPOS[extname(ruta)] ?? "application/octet-stream" });
  res.end(readFileSync(ruta));
}).listen(process.env.PORT ?? 3000, () => {
  console.log(`Saraprints en http://localhost:${process.env.PORT ?? 3000}`);
});
