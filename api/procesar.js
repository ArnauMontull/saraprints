// Función serverless de Vercel: recibe una foto (data URL) y un modo, y devuelve JSON de la IA.
// La clave y el código de acceso solo existen como variables de entorno (ANTHROPIC_API_KEY, ACCESS_CODE).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { timingSafeEqual, createHash } from "node:crypto";

export const MODELOS = {
  rapido: "claude-haiku-5-5",
  bueno: "claude-sonnet-5-5",
};

// $ por millón de tokens (entrada, salida). Haiku 5.5: precio para prompts de < 100K tokens.
const PRECIOS = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  // Posibles destinos del reenvío automático de Sonnet
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
};

const MODOS = {
  transcribir: {
    prompt: "transcribir.md",
    max_tokens: 8000,
    schema: {
      type: "object",
      properties: { fuente: { type: "string" }, avisos: { type: "string" } },
      required: ["fuente", "avisos"],
      additionalProperties: false,
    },
  },
  redibujar: {
    prompt: "redibujar.md",
    max_tokens: 12000,
    schema: {
      type: "object",
      properties: { svg: { type: "string" }, avisos: { type: "string" } },
      required: ["svg", "avisos"],
      additionalProperties: false,
    },
  },
};

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64 = 4_000_000; // Vercel corta los cuerpos de más de 4,5 MB

const prompts = {};
function leerPrompt(nombre) {
  prompts[nombre] ??= readFileSync(new URL(`../prompts/${nombre}`, import.meta.url), "utf8");
  return prompts[nombre];
}

export function codigoValido(dado, esperado) {
  if (!esperado || typeof dado !== "string") return false;
  // Comparar hashes de igual longitud evita filtrar el código por tiempos de respuesta
  const a = createHash("sha256").update(dado.trim()).digest();
  const b = createHash("sha256").update(esperado.trim()).digest();
  return timingSafeEqual(a, b);
}

export function separarDataUrl(dataUrl) {
  const m = /^data:([a-z/]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m || !TIPOS_IMAGEN.includes(m[1])) return null;
  if (m[2].length > MAX_BASE64) return null;
  return { media_type: m[1], data: m[2] };
}

export function costeUsd(modelo, usage) {
  const [pin, pout] = PRECIOS[modelo] ?? [0, 0];
  const entrada = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (entrada * pin + (usage.output_tokens ?? 0) * pout) / 1e6;
}

export function construirPeticion({ modo, imagen, calidad, nota }) {
  const conf = MODOS[modo];
  const model = calidad === "bueno" ? MODELOS.bueno : MODELOS.rapido;
  const texto = nota?.trim()
    ? `Indicaciones de Sara para esta foto: ${nota.trim().slice(0, 500)}`
    : "Procesa esta foto.";
  const peticion = {
    model,
    max_tokens: conf.max_tokens,
    system: leerPrompt(conf.prompt),
    output_config: { effort: "medium", format: { type: "json_schema", schema: conf.schema } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", ...imagen } },
          { type: "text", text: texto },
        ],
      },
    ],
  };
  // Sonnet 5.5 admite el reenvío automático a otro modelo si sus filtros rechazan la foto
  if (model === MODELOS.bueno) {
    peticion.betas = ["server-side-fallback-2026-07-01"];
    peticion.fallbacks = "default";
  }
  return peticion;
}

function responder(res, status, cuerpo) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.json(cuerpo);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { error: "Solo POST" });

  const { codigo, modo, imagen, calidad, nota } = req.body ?? {};
  if (!codigoValido(codigo, process.env.ACCESS_CODE)) {
    return responder(res, 401, { error: "Código de acceso incorrecto" });
  }
  if (!MODOS[modo]) return responder(res, 400, { error: "Modo desconocido" });
  const img = separarDataUrl(imagen);
  if (!img) return responder(res, 400, { error: "La foto no es válida o es demasiado grande" });

  const peticion = construirPeticion({ modo, imagen: img, calidad, nota });
  const client = new Anthropic();
  let msg;
  try {
    msg = await client.beta.messages.create(peticion);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return responder(res, 429, { error: "Demasiadas peticiones; espera un minuto" });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("API", error.status, error.message);
      return responder(res, 502, { error: `La IA ha fallado (${error.status ?? "red"})` });
    }
    throw error;
  }

  const usado = msg.model ?? peticion.model;
  const coste = costeUsd(usado, msg.usage ?? {});
  console.log(JSON.stringify({ modo, modelo: usado, usage: msg.usage, coste_usd: coste }));

  if (msg.stop_reason === "refusal") {
    return responder(res, 422, { error: "La IA no ha querido procesar esta foto. Prueba «Reintentar con más calidad».", coste_usd: coste });
  }
  if (msg.stop_reason === "max_tokens") {
    return responder(res, 422, { error: "La foto tiene demasiado contenido; recórtala en trozos.", coste_usd: coste });
  }
  const texto = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return responder(res, 502, { error: "Respuesta de la IA ilegible; reinténtalo", coste_usd: coste });
  }
  return responder(res, 200, { ...datos, modelo: usado, coste_usd: coste, usage: msg.usage });
}
