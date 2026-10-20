// Captura peças reais do site NEON (NEON.html / Diagnostico.html) em alta resolução.
// Esconde apenas elementos com números (hero-proof) para não exibir métricas não auditadas.
const { chromium } = require('playwright');
const path = require('path');
const root = path.resolve(__dirname, '../../../project');
const out = path.resolve(__dirname, '../assets/cards');
const CSS = `
  #preloader,.wa-float,body::before,.spotlight,.cursor-ring,.cursor-dot,#progress,#header{display:none!important}
  .reveal{opacity:1!important;transform:none!important;transition:none!important}
  .line-mask>span{transform:none!important;opacity:1!important}
  [data-hero-fade]{opacity:1!important;transform:none!important}
  .hero-proof{display:none!important}
  *{animation-play-state:paused!important}
`;
const jobs = [
  ['NEON.html', '.hero-copy', 'hero'],
  ['NEON.html', '#servicos .card', 'servico'],
  ['NEON.html', '#metodo .step', 'metodo'],
  ['NEON.html', '#metodo .section-head', 'metodo-head'],
  ['NEON.html', '#servicos .section-head', 'servicos-head'],
  ['NEON.html', '#porque .why-list', 'porque'],
  ['NEON.html', '#porque .section-head', 'porque-head'],
  ['NEON.html', '.cta-card', 'cta'],
  ['Diagnostico.html', '#form-card', 'form'],
  ['Diagnostico.html', '.diag-aside h1', 'diag-h1'],
];
(async () => {
  const b = await chromium.launch();
  for (const file of ['NEON.html', 'Diagnostico.html']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
    await p.goto('file://' + path.join(root, file), { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: CSS });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(800);
    for (const [f, sel, name] of jobs.filter(j => j[0] === file)) {
      const els = await p.$$(sel);
      for (let i = 0; i < els.length; i++) {
        await els[i].scrollIntoViewIfNeeded();
        await p.waitForTimeout(150);
        const fn = els.length > 1 ? `${name}-${i + 1}.png` : `${name}.png`;
        await els[i].screenshot({ path: path.join(out, fn) });
        console.log(fn);
      }
    }
    await p.close();
  }
  await b.close();
})();
