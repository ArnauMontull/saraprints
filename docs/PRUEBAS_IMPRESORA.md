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
- [ ] Ancho real imprimible en píxeles (¿384 px = 48 mm?). Imprimir una regla de 0-50 mm y medir.
- [ ] Margen izquierdo/derecho del papel.
- [ ] Altura máxima de una tira sin que se atasque; largo razonable por tira.
- [ ] Texto: tamaño mínimo legible (probar 8, 10, 12, 14 px-equivalentes en negrita/normal).
- [ ] Umbral 1 bit vs dithering (Floyd–Steinberg) en texto, tabla, esquema y estructura molecular.
- [ ] Fórmula con subíndices (H₂O, C₆H₁₂O₆) y una tabla pequeña: ¿se leen?
- [ ] Adherencia del papel sobre la libreta de Sara y cómo se corta/pega.

## 4. Resultado
Parámetros fijados (ancho px, umbral, tipografía, tamaño base, método de entrega) → pasar a `src/config`.
