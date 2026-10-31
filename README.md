# Saraprints

PWA muy simple para pasar fotos de apuntes y enunciados de Farmacia (UB) a **tiras listas para imprimir** en una mini
impresora térmica Bluetooth (GuKKK X5, papel adhesivo de 57 mm, app «Tiny Print») y pegarlas en la libreta.

> Estado: **v1 acabada** (31/10/2026), pendiente de desplegar en Vercel y de la prueba con la impresora real
> (`docs/PRUEBAS_IMPRESORA.md`). Regalo: **27/11/2026**.

## Qué hace
Foto → elegir modo → resultado → «Guardar tiras». En castellano e instalable en el iPhone («Añadir a pantalla de inicio»).

| Modo | Qué hace | IA |
|---|---|---|
| **Transcribir** | Foto de enunciado/apunte → texto limpio con fórmulas, química (mhchem), tablas y estructuras (SMILES). El texto se puede corregir antes de imprimir | Sí |
| **Mejorar** | Quita sombras y tono del papel → blanco y negro limpio | No |
| **Redibujar** | Gráfico o esquema → versión limpia (SVG) | Sí |
| **Tiras** | Foto grande → franjas del ancho del papel, numeradas para pegarlas una al lado de otra | No |

Opciones: «Más claro · más oscuro» (umbral), tramado para fotos con grises, girar 90°, tamaño de letra, «Reintentar
con más calidad» (Sonnet en vez de Haiku) y en Ajustes el código de acceso, el ancho en píxeles, los píxeles por mm,
el largo máximo de cada tira y una **hoja de prueba** (regla en mm, tamaños de letra, grises) para calibrar la impresora.

## Cómo se imprime
Safari en iOS no tiene Web Bluetooth, así que la web **no habla con la impresora**: genera PNG de 1 bit y 384 px de
ancho, los pasa a la hoja de compartir de iOS («Guardar imágenes» → Fotos) y se imprimen con Tiny Print.

## Arquitectura
- `public/`: frontend estático (HTML + JS sin compilar, Tailwind y Lucide por CDN). `js/imagen.js` procesa la imagen en
  canvas (sombras, 1 bit, tramado Atkinson, cortes); `js/render.js` monta el texto en HTML, pinta fórmulas con
  **MathJax en SVG** (+ mhchem) y moléculas con **SmilesDrawer** (SVG), y lo rasteriza con SVG `<foreignObject>`;
  `sw.js` deja la app y las librerías en caché.
- `api/procesar.js`: función serverless de Vercel. Valida el código, manda la foto a Claude con visión y salida JSON
  estructurada, y devuelve el resultado con el coste de la llamada. Haiku 5.5 por defecto; Sonnet 5.5 al reintentar.
- `prompts/*.md`: los prompts de cada modo, fuera del código.

## Desarrollo
```powershell
npm install
copy .env.example .env   # y rellena ANTHROPIC_API_KEY y ACCESS_CODE (el .env está ignorado por git)
npm run dev              # http://localhost:3000
npm test                 # pruebas de la función (sin llamar a la API)
```
Iconos: `C:\LIFE_OS\.venv\Scripts\python.exe scripts\iconos.py`. Al cambiar ficheros de `public/`, sube `VERSION` en
`public/sw.js` para que los móviles cojan la versión nueva.

Despliegue paso a paso: `docs/DESPLIEGUE.md`.

## Seguridad (repo público)
- **Nunca** hay claves en el repo: `ANTHROPIC_API_KEY` y `ACCESS_CODE` viven solo en variables de entorno de Vercel.
- Sin código correcto la función no llama a la IA. Límite de tokens por llamada y límite de gasto mensual en la
  consola de Anthropic. Si el código se filtra, se cambia en Vercel y se redepliega.
- Las fotos de apuntes de muestra van a `muestras/` (ignorada por git). Las fotos no se guardan en ningún sitio.

Docs: [[DECISIONES (saraprints/docs)]], [[PLAN (saraprints/docs)]], [[PRUEBAS_IMPRESORA]].
