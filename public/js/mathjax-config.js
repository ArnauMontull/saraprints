// Configuración de MathJax (tiene que existir antes de cargar tex-svg.js).
// Salida SVG sin caché de glifos: cada fórmula es un SVG autónomo que se puede rasterizar sin fuentes externas.
window.MathJax = {
  loader: { load: ["[tex]/mhchem"] },
  tex: {
    packages: { "[+]": ["mhchem"] },
    inlineMath: [["$", "$"]],
    displayMath: [["$$", "$$"]],
  },
  svg: { fontCache: "none" },
  startup: { typeset: false },
};
