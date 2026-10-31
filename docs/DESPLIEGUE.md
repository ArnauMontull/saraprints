# Despliegue en Vercel (lo hace Arnau)

Unos 15 minutos. Nada de esto va al repo: la clave y el código solo se escriben en las webs de Anthropic y Vercel.

## 1. Clave de la API y límite de gasto (console.anthropic.com)
1. **Settings → API keys → Create key**, nombre `saraprints`. Cópiala (solo se ve una vez).
2. **Settings → Limits → Spend limit**: pon un límite mensual bajo (p. ej. 5 $). Con Haiku 5.5 una foto cuesta
   décimas de céntimo, así que sobra; el límite es por si se filtra el código.

## 2. Proyecto en Vercel (vercel.com)
1. **Add New → Project → Import** el repo `ArnauMontull/saraprints` (cuenta de GitHub).
2. Framework preset: **Other**. Build command: vacío. Output directory: `public` (ya está en `vercel.json`).
3. **Environment Variables** (Production, Preview y Development):
   - `ANTHROPIC_API_KEY` = la clave del paso 1.
   - `ACCESS_CODE` = un código que le darás a Sara (p. ej. tres palabras, sin espacios raros).
4. **Deploy**. La URL queda tipo `https://saraprints.vercel.app` (se puede cambiar en Settings → Domains).
5. Cada `git push` a `main` redepliega solo. Si cambias una variable de entorno, haz **Redeploy** para que la coja.

## 3. Comprobar
1. Abre la URL en el iPhone con Safari → Compartir → **Añadir a pantalla de inicio**.
2. Abre la app desde el icono → rueda de ajustes → escribe el código → Guardar.
3. Haz una foto de un apunte → **Transcribir**. Debe salir el texto y, arriba a la derecha, el coste («≈ 0.05 céntimos»).
4. Coste real: Vercel → proyecto → **Logs**: cada llamada deja una línea JSON con `usage` y `coste_usd`. Apunta la media
   de 5-6 fotos en `docs/DECISIONES.md`. También en console.anthropic.com → Usage.

## Si algo falla
- «Código de acceso incorrecto»: revisa `ACCESS_CODE` en Vercel y haz Redeploy.
- «La IA ha fallado (401)»: la clave está mal o revocada. «(400)»: mira el mensaje en Logs.
- La app no se actualiza en el iPhone: ciérrala del todo y ábrela otra vez (el service worker coge la versión nueva
  al segundo arranque); si sigue igual, sube `VERSION` en `public/sw.js`.
