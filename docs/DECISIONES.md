# Decisiones de Saraprints

## 2026-10-26 · Arranque del proyecto
- **Decisión**: PWA (no bot de Telegram, no app nativa) en castellano, repo público `ArnauMontull/saraprints`. v1 con cuatro
  modos (Transcribir, Mejorar, Redibujar, Tiras). Arnau paga la API; acceso con código y límite de gasto.
- **Porqué**: Sara usa iPhone, quiere pocos clics y no hay que pasar por la App Store. Telegram se descartó por preferencia de Arnau.
- **Limitación conocida**: iOS no permite Bluetooth desde la web → se entregan PNGs y se imprime con Tiny Print.
- **Pendiente de verificar**: coste real por foto (las cifras de Gemini eran estimaciones), ancho imprimible real y flujo de
  compartir hacia Tiny Print (`PRUEBAS_IMPRESORA.md`).
- **Origen**: conversación con Gemini (compra de la impresora y primera idea) pegada por Arnau el 26/10/2026; las cifras de
  precio de modelos de aquel chat estaban desfasadas y no se usan.

## 2026-10-31 · v1 programada
- **Render de fórmulas: MathJax (SVG) en vez de KaTeX + html2canvas.** Con html2canvas las fórmulas de KaTeX y el texto
  de las tablas salían desplazados y los glifos eran finos. MathJax en SVG no depende de fuentes, permite engordar el
  trazo (las líneas finas desaparecen a 1 bit) y el HTML se rasteriza con SVG `<foreignObject>`, sin librerías.
- **SmilesDrawer 2.x con `SvgDrawer`**: `draw(árbol, destino, tema)`; el 4.º argumento ya no es «solo info» (con
  `false` falla). Tema propio todo en negro para que el umbral no borre los heteroátomos de color.
- **Formato de Transcribir**: la IA devuelve un texto con un mini formato (`#`, `-`, `$…$`, `\ce{}`, `| tablas |`,
  `smiles:`, `girar: si`) en vez de bloques JSON: Sara puede corregirlo en un cuadro de texto antes de imprimir.
  Salida JSON estructurada (`fuente`, `avisos`) para que la respuesta siempre se pueda leer.
- **Modelos**: Haiku 5.5 con esfuerzo `medium`; «Reintentar con más calidad» usa Sonnet 5.5 con reenvío automático
  (`fallbacks: "default"`) si sus filtros rechazan la foto (apuntes de fármacos podrían caer en la categoría `bio`).
- **Tiras**: «57 × 25 mm» del papel es ancho × diámetro del rollo, no etiquetas: el papel es continuo, así que cada
  resultado sale como una tira larga; en Ajustes se puede fijar un largo máximo y se corta por filas blancas.
- **Pendiente de medir**: coste real por foto (falta desplegar con la clave) y ancho imprimible real (hoja de prueba).
