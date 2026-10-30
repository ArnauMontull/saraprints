# Plan: PWA de apuntes para la impresora térmica de Sara (UB Farmacia)

## Context
Arnau va a comprar una mini impresora térmica (GuKKK X5, ~19 €, papel adhesivo 57×25 mm, app «Tiny Print», Bluetooth)
para su hermana Sara, que estudia Farmacia en la UB. Quiere una app muy simple, instalable en el iPhone, que convierta
fotos de enunciados/apuntes en tiras listas para imprimir y pegar en la libreta. Plazo: **27/11/2026** (cumpleaños).
Hoy es 26/10; la impresora llegaría ~29-30/10. Repo **público** nuevo; la clave de la API nunca va en el repo.
Respuesta corta a «¿podrías hacerlo?»: **sí**, con una limitación de iOS (abajo).

## Decisiones ya tomadas (respuestas de Arnau)
- v1 con las 4 funciones, todas en pocos clics: **Transcribir** (foto → texto/LaTeX limpio), **Mejorar** (foto → B/N limpio),
  **Redibujar** (gráfico/esquema → versión limpia), **Tiras** (foto grande → trozos de ancho de papel).
- Contenido: texto + fórmulas químicas, estructuras moleculares, tablas, esquemas de fisiología/anatomía.
- Arnau paga la IA; acceso con **código** que se le da a Sara + límite de gasto. Interfaz en **castellano**.
- Nombre: pendiente (propuestas: **Apuntiras**, **Tirita**, **Pegapunt**) → lo elige Arnau al aprobar.

## Limitación clave (iOS) y cómo se resuelve
Safari/PWA en iPhone **no tiene Web Bluetooth**, así que la PWA no puede hablar con la impresora. Flujo realista:
PWA genera PNG(s) → botón «Compartir/Guardar en Fotos» (`navigator.share` con ficheros) → Tiny Print los imprime.
**Hay que probarlo con la impresora real** (¿Tiny Print aparece en la hoja de compartir o hay que pasar por Fotos?).
Si hay un paso de más, se minimiza (guardar todas las tiras de golpe). Plan B v2: navegador Bluefy (Web Bluetooth en iOS).

## Arquitectura (lo más simple que funciona)
- **Frontend estático PWA**: HTML + JS vanilla, Tailwind (CDN) + Lucide, slate + un acento (`perfil/prompts/rulebook_ui.md`),
  `manifest.json` + iconos Apple touch + service worker. 4 botones grandes: Foto → modo → resultado → Guardar tiras.
- **Una función serverless** (`/api/procesar`, Vercel, gratis): valida el código de acceso, llama a la API de Claude con
  visión y devuelve JSON. Clave y código solo en variables de entorno. Límite de tokens por llamada + límite de gasto
  mensual en la consola de Anthropic. Imagen reducida a ~1600 px en el cliente antes de enviarla (coste).
- **Modelo**: Haiku 5.5 (`claude-haiku-5-5`) por defecto; subir a Sonnet 5.5 solo si falla en letra a mano/tablas.
  Antes de codificar, cargar skill `claude-api` y **medir el coste real por foto** (las cifras de Gemini no están verificadas).
- **Render sin LaTeX en servidor**: la IA devuelve bloques (texto, fórmula, `mhchem`, tabla, SMILES); en el cliente se pintan
  con **KaTeX + mhchem** y **SmilesDrawer** (estructuras desde SMILES) en un `div` de 48 mm y se rasterizan a canvas.
- **Salida para térmica**: ancho de impresión ≈ 384 px (48 mm a 200 dpi; **verificar** con la prueba), renderizado a 2×,
  umbral/dithering a 1 bit y tipografía gruesa (las reseñas dicen que el texto fino se ve distorsionado). Tablas anchas: opción de girar 90°.
- Modos: **Mejorar** y **Tiras** son 100 % cliente (canvas, sin IA, gratis). **Transcribir** y **Redibujar** usan la API
  (Redibujar → la IA devuelve SVG simple, se rasteriza). Estructuras moleculares dudosas → opción «pegar recorte como imagen».
- Sin base de datos ni cuentas en v1. Historial opcional en `localStorage` (con try/catch).

## Estructura del proyecto (se crea al aprobar)
`C:\LIFE_OS\<nombre>\` = repo git independiente y **público** en GitHub (`gh` ya autenticado como ArnauMontull):
`README.md` (qué es, cómo usarla, cómo desplegar), `CLAUDE.md` (reglas: nunca claves en el repo, datos de Sara fuera de git,
Arnau domina Python/Git pero JS web = explicar lo no obvio), `docs/PLAN.md` (este plan), `docs/PRUEBAS_IMPRESORA.md`
(checklist del día que llegue), `docs/DECISIONES.md`, `.gitignore` (`.env*`, `.vercel`, `muestras/`), `.env.example`.
Además: fila en `perfil/proyectos.md`, entrada en `perfil/decisiones.md`, línea en `CLAUDE.md` raíz, tarea «LIFE OS Tareas»
(comprar la impresora + papel hoy) y memoria del proyecto.

## Calendario
**Cambio del 30/10/2026 (lo pidió Arnau): la app tiene que estar acabada el domingo 1/11 a las 23:59.** Bloques en su
calendario (eventos «Saraprints N/5»):
- **Sáb 31/10, biblioteca**: 12:00-14:00 Vercel + límite de gasto, esqueleto PWA, Tiras y Mejorar; 18:00-19:30
  `/api/procesar` con Transcribir, despliegue en Vercel y prueba en iPhone. Antes, el viernes 30, pedir a Sara las 5-6 fotos.
- **Sáb 31/10, casa, 21:30-22:30** (la impresora llega ese día): `PRUEBAS_IMPRESORA.md` y ajuste de parámetros.
- **Dom 1/11**: 16:30-18:30 Redibujar y estructuras (SMILES); 21:30-23:30 en casa coste real por foto, repaso con Sara y push final.
- **2-26/11**: solo arreglos tras el uso real de Sara (sin funciones nuevas), instrucciones de 1 página, icono y código de acceso.

## Riesgos
1. Flujo iOS → Tiny Print con un paso extra (mitigar: guardar tiras en lote; Bluefy en v2).
2. Estructuras moleculares y letra a mano: errores de la IA → vista previa editable antes de imprimir y «reintentar con Sonnet».
3. Coste desbocado si se filtra el código → límite de gasto en Anthropic + código rotable.
4. Calidad de la térmica (200 dpi, 1 bit): tipografía grande y gruesa; Sara debe saberlo (no es fotografía).

## Verificación
- `vercel dev` en local con foto de muestra → JSON → tira PNG de 384 px de ancho.
- Instalar en un iPhone («Añadir a pantalla de inicio»), probar cámara y compartir.
- Prueba física con la impresora (checklist). Medir coste por foto en el panel de uso de Anthropic.
- Comprobar que `git log -p` y el repo público no contienen claves (`git grep -i "sk-ant"`).

## Pendiente al aprobar
Nombre definitivo del app/repo; ¿iPhone de Sara con iOS ≥ 16? (para share de ficheros); confirmar crear el repo público ya.
