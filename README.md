# Saraprints

PWA muy simple para pasar fotos de apuntes y enunciados de Farmacia (UB) a **tiras listas para imprimir** en una mini
impresora térmica Bluetooth (GuKKK X5, papel adhesivo 57 × 25 mm, app «Tiny Print») y pegarlas en la libreta.

> Estado: **planificación** (26/10/2026). Plazo de entrega: **27/11/2026**. Aún no hay código.

## Qué hará (v1)
Foto → elegir modo → resultado → guardar tiras. Todo en pocos clics, en castellano, instalable en el iPhone
(«Añadir a pantalla de inicio»).

| Modo | Qué hace | IA |
|---|---|---|
| **Transcribir** | Foto de enunciado/apunte → texto limpio con fórmulas (LaTeX/mhchem), tablas y estructuras moleculares | Sí |
| **Mejorar** | Quita sombras y sube el contraste → blanco y negro limpio | No |
| **Redibujar** | Gráfico o esquema → versión limpia | Sí |
| **Tiras** | Foto grande → trozos del ancho del papel, en orden | No |

## Cómo se imprime
Safari en iOS no tiene Web Bluetooth, así que la web **no habla con la impresora**: genera imágenes PNG, las guarda en
Fotos (o las comparte) y se imprimen con Tiny Print. El flujo exacto se valida con la impresora real
(`docs/PRUEBAS_IMPRESORA.md`).

## Arquitectura
Frontend estático (HTML + JS, Tailwind y Lucide por CDN) + una función serverless `/api/procesar` que llama a la API de
Claude con visión. Render en el cliente con KaTeX + mhchem y SmilesDrawer. Detalle en `docs/PLAN.md`.

## Seguridad (repo público)
- **Nunca** hay claves en el repo: `ANTHROPIC_API_KEY` y `ACCESS_CODE` viven solo en variables de entorno del hosting.
- La web pide un código de acceso; hay límite de tokens por llamada y límite de gasto mensual en la consola de Anthropic.
- Las fotos de apuntes de muestra van a `muestras/` (ignorada por git).

## Desarrollo
Pendiente de la fase de código. Variables en `.env.example`.
