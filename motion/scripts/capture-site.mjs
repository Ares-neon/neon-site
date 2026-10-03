// Captura seções REAIS do site NEON (NEON.html publicado) para usar como peças no filme.
// Números/estatísticas são ocultados de propósito (não exibir métricas no filme).
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const SITE = new URL('../../NEON.html', import.meta.url).pathname;
const OUT = new URL('../public/site/', import.meta.url).pathname;
fs.mkdirSync(OUT, {recursive: true});
const mode = process.argv[2] || 'full';
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const FONTS = new URL('../public/fonts/', import.meta.url).pathname;
const FACES = [400,500,600,700,800].map(w => `@font-face{font-family:'Switzer';src:url('file://${FONTS}Switzer-${w}.woff2') format('woff2');font-weight:${w};font-style:normal}`).join('\n')
  + `@font-face{font-family:'Inter';src:url('file://${FONTS}Inter-latin.woff2') format('woff2');font-weight:100 900;font-style:normal}`;
const CLEAN = FACES + `
  #preloader,.preloader,.cursor,.cursor-dot,.cursor-ring,.wa-float,.scroll-progress,#progress{display:none!important}
  .hero-proof,.proof{display:none!important}
  section[data-screen-label="Stats"]{display:none!important}
  .reveal{opacity:1!important;transform:none!important}
  .line-mask > span{transform:none!important}
  *{animation-play-state:paused!important}
  body{cursor:auto!important}
`;
async function page(w, h, dpr) {
  const p = await b.newPage({viewport: {width: w, height: h}, deviceScaleFactor: dpr});
  await p.goto('file://' + SITE, {waitUntil: 'load'});
  await p.waitForTimeout(2500);
  await p.addStyleTag({content: CLEAN});
  await p.evaluate(() => { document.documentElement.classList.add('no-anim'); document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')); });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  return p;
}
if (mode === 'full') {
  const p = await page(1440, 900, 1);
  await p.screenshot({path: OUT + '_full.png', fullPage: true});
}
if (mode === 'parts') {
  const p = await page(1440, 900, 2);
  { const el = await p.$('#hero'); await el.screenshot({path: OUT + 'hero.png'}); }
  const shots = {
    'servicos': '#servicos',
    'metodo': '#metodo',
    'porque': '#porque',
    'cta': '#cta',
    'marquee': '.marquee',
  };
  { const el = await p.$('header'); await el.screenshot({path: OUT + 'header.png'}); }
  await p.addStyleTag({content: 'header,#header{visibility:hidden!important}'});
  for (const [k, sel] of Object.entries(shots)) {
    const el = await p.$(sel); if (!el) { console.log('missing', k); continue; }
    await el.screenshot({path: OUT + k + '.png'});
    console.log('ok', k);
  }
  const cards = await p.$$('#servicos .card');
  for (let i = 0; i < cards.length; i++) await cards[i].screenshot({path: OUT + `servico-${i + 1}.png`});
  const steps = await p.$$('#metodo .step');
  for (let i = 0; i < steps.length; i++) await steps[i].screenshot({path: OUT + `metodo-${i + 1}.png`});
  const why = await p.$$('#porque .why-item');
  for (let i = 0; i < why.length; i++) await why[i].screenshot({path: OUT + `porque-${i + 1}.png`});
  console.log('cards', cards.length, steps.length, why.length);
}
if (mode === 'mobile') {
  const p = await page(430, 932, 3);
  await p.screenshot({path: OUT + 'mobile-hero.png'});
  for (const [k, sel] of Object.entries({'mobile-servicos': '#servicos', 'mobile-cta': '#cta .cta-card, #cta'})) {
    const el = await p.$(sel); if (el) { await el.screenshot({path: OUT + k + '.png'}); console.log('ok', k); }
  }
}
await b.close();
