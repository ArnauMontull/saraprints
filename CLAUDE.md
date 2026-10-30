<!-- Instrucciones de Claude Code para esta carpeta; las generales están en LIFE_OS/CLAUDE.md -->
## Saraprints (`saraprints/`): PWA de apuntes para la impresora térmica de Sara
Repo git **público** independiente (`ArnauMontull/saraprints`); haz los commits dentro de esta carpeta. Plan completo en
`docs/PLAN.md`; decisiones en `docs/DECISIONES.md`. Plazo: **app acabada el dom 1/11/2026 23:59** (pedido el 30/10); regalo el **27/11/2026** (cumpleaños de Sara, hermana de Arnau, estudiante de Farmacia en la UB).
- **Reglas que no se rompen**: ninguna clave ni código de acceso en el repo (solo variables de entorno; `.env.example` sin
  valores); las fotos de apuntes de Sara van a `muestras/` (ignorada por git); no publiques datos personales de Sara.
  Antes de cada push: `git grep -iE "sk-ant|ACCESS_CODE=.+"` debe salir vacío.
- **Stack**: HTML + JS vanilla, Tailwind (CDN) + Lucide, slate + un acento (`perfil/prompts/rulebook_ui.md`), PWA para
  iPhone (manifest, iconos Apple touch, service worker). Una función serverless `/api/procesar` (Vercel) con la API de Claude.
- **IA**: Haiku 5.5 por defecto, Sonnet 5.5 solo como reintento. Carga la skill `claude-api` antes de escribir la llamada y
  mide el coste real por foto. Los prompts van en ficheros `.md` aparte, no embebidos en el código.
- **Salida térmica**: ancho de impresión ≈ 384 px (48 mm a 200 dpi; **verificar** con la impresora), 1 bit, tipografía gruesa.
  Render con KaTeX + mhchem y SmilesDrawer en el cliente; nada de LaTeX en el servidor.
- **iOS**: la PWA no puede usar Bluetooth; entrega PNGs vía `navigator.share`/Fotos y se imprime con Tiny Print.
- **Arnau**: domina Git y Python; JavaScript web es más flojo, así que explica lo no obvio. UI en castellano.
- Despliegue (Vercel, variables, límite de gasto en Anthropic) lo lanza Arnau; tú preparas los pasos exactos.
