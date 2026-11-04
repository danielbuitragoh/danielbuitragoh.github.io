#!/usr/bin/env node
'use strict';

/*
  Genera capturas/tarjeta.png (1200×630), la imagen que salen al compartir la web.

  La fuente de las cifras es UNA: los tres números de la portada de index.html
  (<p class="cifra">). Este script los lee, comprueba que el resto de la web
  dice lo mismo, rellena tarjeta.html y la captura con Playwright.

    node generar.js               comprueba y genera la imagen
    node generar.js --comprobar   solo comprueba, sin generar nada
    node generar.js --index RUTA --salida RUTA   otras rutas (pruebas)

  Si las cifras de la web no cuadran entre sí, termina con error ANTES de
  tocar la imagen: es mejor no generar nada que publicar una tarjeta que
  contradice la página.
*/

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const AQUI = __dirname;
const RAIZ = path.resolve(AQUI, '..', '..');
const ANCHO = 1200;
const ALTO = 630;

/* ------------------------------------------------------------------ */
/* Lectura de las cifras                                               */
/* ------------------------------------------------------------------ */

// La web escribe «Diez sistemas», no «10 sistemas»: para comprobar los textos
// hace falta saber decir los números en letra. Basta hasta veinte; por encima
// se acepta la cifra en dígitos.
const EN_LETRA = {
  1: ['uno', 'un'], 2: ['dos'], 3: ['tres'], 4: ['cuatro'], 5: ['cinco'],
  6: ['seis'], 7: ['siete'], 8: ['ocho'], 9: ['nueve'], 10: ['diez'],
  11: ['once'], 12: ['doce'], 13: ['trece'], 14: ['catorce'], 15: ['quince'],
  16: ['dieciséis'], 17: ['diecisiete'], 18: ['dieciocho'], 19: ['diecinueve'],
  20: ['veinte'],
};

function aNumero(texto) {
  // «1.791» (punto de millares, como en la web) → 1791
  return Number(String(texto).replace(/\./g, ''));
}

function formatear(n) {
  // Punto de millares siempre, también con cuatro cifras («1.791»): el
  // toLocaleString('es-ES') de Node no agrupa los de cuatro y daría «1791».
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function leerCifras(html) {
  const bloque = [...html.matchAll(
    /<p class="cifra"><b>([^<]+)<\/b><span>([^<]+)<\/span><\/p>/g
  )].map((m) => ({ valor: m[1].trim(), etiqueta: m[2].trim() }));

  const buscar = (clave, patron) => {
    const c = bloque.find((x) => patron.test(x.etiqueta));
    if (!c) {
      throw new Error(
        `No encuentro en la portada de index.html la cifra de ${clave} ` +
        `(<p class="cifra"> con una etiqueta que contenga «${clave}»).`
      );
    }
    return { ...c, numero: aNumero(c.valor) };
  };

  // Se devuelven en el orden en que se pintan en la tarjeta.
  return [
    buscar('proyectos', /proyecto/i),
    buscar('pruebas', /prueba/i),
    buscar('demos', /demo/i),
  ];
}

/* ------------------------------------------------------------------ */
/* Comprobaciones: ¿dice la web lo mismo en todas partes?              */
/* ------------------------------------------------------------------ */

// Cada proyecto es un <article class="pieza …">.
function fichasDeProyecto(html) {
  return html.split(/(?=<article\s+class="pieza[\s"])/).slice(1)
    .map((trozo) => trozo.split('</article>')[0]);
}

// Una «demo que puedes tocar» es una ficha cuyo botón principal
// (class="boton", no el «boton--tenue» del código) abre una página de
// danielbuitragoh.github.io: algo que se usa en el navegador. La documentación
// de una API (onrender.com/docs) o un enlace al código no cuentan. Una ficha
// cuenta una vez aunque tenga dos botones (La Mesa: app y panel de cocina).
function contarDemos(fichas) {
  return fichas.filter((f) =>
    /<a class="boton" href="https:\/\/danielbuitragoh\.github\.io\/[^"]+"/.test(f)
  ).length;
}

// Suma de pruebas: la insignia «N pruebas» de cada ficha, más el caso del bot,
// que lo cuenta en su consola («65 pruebas en 11 archivos»).
function sumarPruebas(fichas) {
  const partes = [];
  for (const f of fichas) {
    const titular = (f.match(/<h2 class="titular">([^<]+)<\/h2>/) || [])[1] || '?';
    const insignia = f.match(/<span class="insignia">([\d.]+) pruebas<\/span>/);
    const consola = f.match(/([\d.]+) pruebas en \d+ archivos/);
    const m = insignia || consola;
    if (m) partes.push({ titular, n: aNumero(m[1]) });
  }
  return { total: partes.reduce((s, p) => s + p.n, 0), partes };
}

function comprobar(html, cifras) {
  const [proyectos, pruebas, demos] = cifras;
  const fichas = fichasDeProyecto(html);
  const problemas = [];

  // 1. La portada frente al contenido real de la página.
  if (fichas.length !== proyectos.numero) {
    problemas.push(`La portada dice ${proyectos.valor} proyectos y la página tiene ${fichas.length} fichas.`);
  }
  const suma = sumarPruebas(fichas);
  if (suma.total !== pruebas.numero) {
    const detalle = suma.partes.map((p) => `${p.titular} ${p.n}`).join(' + ');
    problemas.push(`La portada dice ${pruebas.valor} pruebas y las fichas suman ${formatear(suma.total)} (${detalle}).`);
  }
  const nDemos = contarDemos(fichas);
  if (nDemos !== demos.numero) {
    problemas.push(`La portada dice ${demos.valor} demos y las fichas con un botón principal a danielbuitragoh.github.io son ${nDemos}.`);
  }

  // 2. El resto de textos de la web frente a la portada.
  const dice = (texto, n) => {
    const t = String(texto).toLowerCase();
    return t === String(n) || t === formatear(n) || (EN_LETRA[n] || []).includes(t);
  };
  const texto = (nombre, patron, esperado, indice = 1) => {
    const m = html.match(patron);
    if (!m) { problemas.push(`No encuentro «${nombre}» en index.html.`); return; }
    if (!dice(m[indice], esperado)) {
      problemas.push(`${nombre} dice «${m[indice]}» y la portada dice ${formatear(esperado)}.`);
    }
  };
  texto('<meta name="description">', /name="description" content="(\S+) sistemas completos/, proyectos.numero);
  texto('og:description (proyectos)', /og:description" content="(\S+) sistemas completos/, proyectos.numero);
  texto('og:description (pruebas)', /og:description" content="[^"]*?([\d.]+) pruebas automáticas/, pruebas.numero);
  texto('la presentación de la portada', /Desarrollador en Madrid\.\s+(\S+) sistemas completos/, proyectos.numero);
  texto('«Quién soy»', /lo demuestra: (\S+) sistemas terminados/, proyectos.numero);
  texto('el rótulo de «Trabajo»', /<span>([^<\s]+) proyectos terminados<\/span>/, proyectos.numero);
  texto('«Cómo trabajo»', /<strong>([\d.]+) pruebas automáticas<\/strong>/, pruebas.numero);

  // 3. El texto alternativo de la imagen transcribe las cifras de la tarjeta.
  const alt = (html.match(/og:image:alt" content="([^"]*)"/) || [])[1];
  if (alt === undefined) {
    problemas.push('Falta <meta property="og:image:alt">: la tarjeta es una imagen con texto y necesita su transcripción.');
  } else {
    [[proyectos, 'proyectos'], [pruebas, 'pruebas'], [demos, 'demos']].forEach(([c, palabra]) => {
      if (!alt.includes(`${c.valor} ${palabra}`)) {
        problemas.push(`og:image:alt no dice «${c.valor} ${palabra}» (la portada sí).`);
      }
    });
  }

  // 4. La imagen que apuntan las metaetiquetas.
  if (!/og:image" content="https:\/\/danielbuitragoh\.github\.io\/capturas\/tarjeta\.png"/.test(html)) {
    problemas.push('og:image ya no apunta a capturas/tarjeta.png.');
  }
  if (!new RegExp(`og:image:width" content="${ANCHO}"`).test(html) ||
      !new RegExp(`og:image:height" content="${ALTO}"`).test(html)) {
    problemas.push(`og:image:width/height no son ${ANCHO}×${ALTO}.`);
  }

  return problemas;
}

/* ------------------------------------------------------------------ */
/* Captura                                                             */
/* ------------------------------------------------------------------ */

function escapar(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rellenar(plantilla, cifras) {
  let salida = plantilla;
  cifras.forEach((c, i) => {
    salida = salida
      .replace(`{{CIFRA_${i + 1}}}`, escapar(c.valor))
      .replace(`{{ETIQUETA_${i + 1}}}`, escapar(c.etiqueta));
  });
  const sobran = salida.match(/\{\{[A-Z_0-9]+\}\}/g);
  if (sobran) throw new Error(`Quedan marcadores sin rellenar en tarjeta.html: ${sobran.join(', ')}`);
  return salida;
}

async function capturar(cifras, salida) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    throw new Error('Falta Playwright. En esta carpeta: npm install && npx playwright install chromium');
  }

  const plantilla = fs.readFileSync(path.join(AQUI, 'tarjeta.html'), 'utf8');
  // Se escribe junto a la plantilla para que las rutas de ./fuentes funcionen.
  const temporal = path.join(AQUI, 'tarjeta.generada.html');
  fs.writeFileSync(temporal, rellenar(plantilla, cifras));

  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({
      viewport: { width: ANCHO, height: ALTO },
      deviceScaleFactor: 1,
    });
    await pagina.goto(pathToFileURL(temporal).href);
    await pagina.evaluate(() => document.fonts.ready);

    // Si una tipografía no carga, el navegador pinta otra y la tarjeta sale
    // «bien» pero distinta de la web. Mejor un error que un cambio silencioso.
    const fuentes = await pagina.evaluate(() =>
      [...document.fonts].map((f) => `${f.family}:${f.status}`));
    const mal = fuentes.filter((f) => !f.endsWith(':loaded'));
    if (mal.length || fuentes.length === 0) {
      throw new Error(`Las tipografías no cargaron (${mal.join(', ') || 'ninguna declarada'}).`);
    }

    await pagina.screenshot({
      path: salida,
      clip: { x: 0, y: 0, width: ANCHO, height: ALTO },
      type: 'png',
    });
  } finally {
    await navegador.close();
    fs.rmSync(temporal, { force: true });
  }

  // Comprobación final de tamaño leyendo la cabecera del PNG.
  const cabecera = fs.readFileSync(salida);
  const ancho = cabecera.readUInt32BE(16);
  const alto = cabecera.readUInt32BE(20);
  if (ancho !== ANCHO || alto !== ALTO) {
    throw new Error(`La imagen salió de ${ancho}×${alto} y debía ser ${ANCHO}×${ALTO}.`);
  }
}

/* ------------------------------------------------------------------ */

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(nombre);
  return i > -1 ? path.resolve(process.argv[i + 1]) : porDefecto;
}

async function main() {
  const indice = argumento('--index', path.join(RAIZ, 'index.html'));
  const salida = argumento('--salida', path.join(RAIZ, 'capturas', 'tarjeta.png'));
  const soloComprobar = process.argv.includes('--comprobar');

  const html = fs.readFileSync(indice, 'utf8');
  const cifras = leerCifras(html);
  console.log('Cifras de la portada de ' + path.relative(process.cwd(), indice) + ':');
  cifras.forEach((c) => console.log(`  ${c.valor.padStart(6)}  ${c.etiqueta}`));

  const problemas = comprobar(html, cifras);
  if (problemas.length) {
    console.error('\nLa web no cuadra consigo misma; no se genera la tarjeta:');
    problemas.forEach((p) => console.error('  ✗ ' + p));
    process.exit(1);
  }
  console.log('\n✓ La portada, las fichas y los textos (descripción, og:description…) dicen lo mismo.');

  if (soloComprobar) return;

  await capturar(cifras, salida);
  console.log(`✓ Tarjeta generada: ${path.relative(process.cwd(), salida)} (${ANCHO}×${ALTO})`);
}

module.exports = { leerCifras, comprobar, rellenar, capturar, formatear };

if (require.main === module) {
  main().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
}
