// Pruebas de la función serverless sin llamar a la API (npm test)
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { codigoValido, separarDataUrl, costeUsd, construirPeticion, MODELOS } from "../api/procesar.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function respuestaFalsa() {
  const r = { statusCode: 0, cabeceras: {}, cuerpo: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.setHeader = (k, v) => ((r.cabeceras[k] = v), r);
  r.json = (o) => (r.cuerpo = o);
  return r;
}

test("el código se compara bien y sin código configurado no entra nadie", () => {
  assert.equal(codigoValido("abc", "abc"), true);
  assert.equal(codigoValido(" abc ", "abc"), true);
  assert.equal(codigoValido("abd", "abc"), false);
  assert.equal(codigoValido("", ""), false);
  assert.equal(codigoValido("abc", undefined), false);
  assert.equal(codigoValido(undefined, "abc"), false);
});

test("solo acepta data URLs de imagen", () => {
  assert.deepEqual(separarDataUrl(PNG).media_type, "image/png");
  assert.equal(separarDataUrl("data:text/html;base64,PGgxPg=="), null);
  assert.equal(separarDataUrl("https://example.com/x.png"), null);
  assert.equal(separarDataUrl(undefined), null);
});

test("coste por modelo", () => {
  const u = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
  assert.equal(costeUsd("claude-haiku-5-5", u), 0.6);
  assert.equal(costeUsd("claude-sonnet-5-5", u), 12);
});

test("Haiku por defecto y Sonnet con reenvío solo al pedir calidad", () => {
  const img = separarDataUrl(PNG);
  const rapida = construirPeticion({ modo: "transcribir", imagen: img });
  assert.equal(rapida.model, MODELOS.rapido);
  assert.equal(rapida.fallbacks, undefined);
  assert.match(rapida.system, /Formato del campo `fuente`/);
  assert.equal(rapida.output_config.format.type, "json_schema");
  const buena = construirPeticion({ modo: "redibujar", imagen: img, calidad: "bueno", nota: "solo la gráfica" });
  assert.equal(buena.model, MODELOS.bueno);
  assert.equal(buena.fallbacks, "default");
  assert.match(buena.messages[0].content[1].text, /solo la gráfica/);
});

test("rechaza código incorrecto, modo raro y foto inválida antes de llamar a la IA", async () => {
  process.env.ACCESS_CODE = "secreto-de-prueba";
  const casos = [
    [{ codigo: "mal", modo: "transcribir", imagen: PNG }, 401],
    [{ codigo: "secreto-de-prueba", modo: "borrar", imagen: PNG }, 400],
    [{ codigo: "secreto-de-prueba", modo: "transcribir", imagen: "hola" }, 400],
  ];
  for (const [body, esperado] of casos) {
    const res = respuestaFalsa();
    await handler({ method: "POST", body }, res);
    assert.equal(res.statusCode, esperado);
  }
  const res = respuestaFalsa();
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 405);
});
