# Pruebas con la impresora (el día que llegue)

Impresora: GuKKK X5 (Amazon, ASIN B0CDCDLQG2), app **Tiny Print**. Papel 57 × 25 mm adhesivo. Trae 13 rollos.
Apunta los resultados aquí y actualiza `docs/DECISIONES.md`.

## 1. Preparación (10 min)
- [ ] Cargar la impresora, instalar Tiny Print en el iPhone de Sara (o el de Arnau para probar) y emparejar.
- [ ] Imprimir una foto de prueba desde la propia app para ver la calidad de base.

## 2. Flujo iOS → Tiny Print (lo más importante)
- [ ] ¿Tiny Print aparece en la hoja de compartir de Safari/Fotos? (sí / no)
- [ ] Si no: ¿Tiny Print importa bien desde Fotos? ¿Cuántos toques desde «guardar» hasta «imprimir»?
- [ ] ¿Admite varias imágenes a la vez (lote)? ¿Conserva el orden?
- [ ] ¿Recorta, escala o gira la imagen al importarla? ¿Hay un modo «etiqueta/tira» sin recortes?

## 3. Geometría y calidad (hoja de prueba que genera la PWA)
En la app: rueda de Ajustes → **Crear hoja de prueba** → Guardar tira → imprimir con Tiny Print. Lleva una regla de
0-48 mm (a 8 px/mm), dos rayas en los bordes, una franja de grises con tramado, letras de 10 a 24 px, una fórmula,
una reacción, una tabla y el ibuprofeno. Si la regla mide distinto, corrige «Píxeles por mm»; si falta una raya del
borde, baja «Ancho (px)». Prueba también el control «Más claro · más oscuro» y vuelve a imprimir.
- [ ] Ancho real imprimible en píxeles (¿384 px = 48 mm?). Imprimir una regla de 0-50 mm y medir.
- [ ] Margen izquierdo/derecho del papel.
- [ ] Altura máxima de una tira sin que se atasque; largo razonable por tira.
- [ ] Texto: tamaño mínimo legible (probar 8, 10, 12, 14 px-equivalentes en negrita/normal).
- [ ] Umbral 1 bit vs dithering (Floyd–Steinberg) en texto, tabla, esquema y estructura molecular.
- [ ] Fórmula con subíndices (H₂O, C₆H₁₂O₆) y una tabla pequeña: ¿se leen?
- [ ] Adherencia del papel sobre la libreta de Sara y cómo se corta/pega.

## 4. Resultado
Parámetros fijados (ancho px, px/mm, umbral, tamaño de letra, método de entrega) → cambiar `AJUSTES_INICIALES` en
`public/js/app.js` (y subir `VERSION` en `public/sw.js`).
