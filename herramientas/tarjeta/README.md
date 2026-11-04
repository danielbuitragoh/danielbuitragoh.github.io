# Tarjeta para redes

Genera `capturas/tarjeta.png` (1200 × 630), la imagen que salen al compartir la
web (`og:image`).

## Cómo regenerarla

Cuando cambien las cifras de la portada de `index.html`:

```bash
cd herramientas/tarjeta
npm install
npx playwright install chromium   # solo la primera vez
npm run tarjeta
```

Eso es todo. **No hay que tocar nada en esta carpeta para cambiar una cifra.**

## De dónde salen las cifras

De un único sitio: los tres números de la portada de `index.html`
(`<p class="cifra"><b>10</b><span>proyectos terminados</span></p>`…). El script
lee el valor y la etiqueta de ahí y rellena `tarjeta.html`.

Antes de capturar, el script comprueba que **el resto de la web dice lo
mismo**, y si no, termina con error sin tocar la imagen:

| Cifra de la portada | Se contrasta con |
|---|---|
| Proyectos | Las fichas `<article class="pieza">` de la página; «Diez sistemas…» en la descripción, en `og:description`, en la presentación, en «Quién soy» y en el rótulo de «Trabajo» |
| Pruebas | La suma de las insignias `N pruebas` de cada ficha (más las «65 pruebas en 11 archivos» de la consola del bot); `og:description` y el párrafo de «Cómo trabajo» |
| Demos | Las fichas cuyo botón principal (`class="boton"`, no `boton--tenue`) abre una página de `danielbuitragoh.github.io`. Una ficha cuenta una vez aunque tenga dos botones (La Mesa). La documentación de una API o un enlace al código no cuentan |
| Las tres | La transcripción de la imagen, `og:image:alt` |

Para comprobar sin generar: `npm run comprobar`.

Si añades un proyecto: súbelo en la portada (`10` → `11`), en los textos que lo
dicen y en las metaetiquetas, y `npm run comprobar` te dice lo que falte.

## Qué hay aquí

| Fichero | Para qué |
|---|---|
| `tarjeta.html` | La plantilla: el diseño, con marcadores `{{CIFRA_1}}`, `{{ETIQUETA_1}}`… No se abre a mano |
| `generar.js` | Lee las cifras, comprueba la web, rellena la plantilla y la captura con Playwright a 1200 × 630 |
| `fuentes/` | Bricolage Grotesque y JetBrains Mono, las mismas que usa la web (ver `LICENCIAS.md`) |

El script aborta si una tipografía no carga: sin esa comprobación el navegador
pintaría otra en silencio y la tarjeta saldría distinta de la web.

La salida es determinista: con las mismas cifras y el mismo Chromium, el PNG es
idéntico byte a byte.
