// Helpers compartilhados pelos carrosséis NEON.
const LOGO = "../project/assets/neon-symbol.png";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// [texto] = placeholder amarelo, *texto* = destaque neon
const fmt = s => esc(s)
  .replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>')
  .replace(/\*([^*]+)\*/g, '<em class="hl">$1</em>');
// ponto final do título vira o ponto verde da marca
const title = s => fmt(s).replace(/\.(<\/em>)?$/, '$1<span class="dot">.</span>');
const img = (src, dica, cls) => src
  ? `<div class="media ${cls}"><img src="${esc(src)}" alt=""></div>`
  : `<div class="slot ${cls}">${esc(dica)}</div>`;

const pad2 = n => String(n).padStart(2, "0");

// makeSlide("Tráfego pago", 7) devolve slide(i, tema, corpo, extra, rodapéDireito)
const makeSlide = (serie, total) => (i, theme, body, extra = "", footRight = "Arrasta →") => `
  <section class="slide ${theme}" data-n="${i}">
    <div class="glow"></div>${extra}<div class="grain"></div>
    <span class="tick tl"></span><span class="tick tr"></span><span class="tick bl"></span><span class="tick br"></span>
    <header><div class="brand"><img src="${LOGO}" alt="">NEON</div><div class="tag">${serie} / <b>${pad2(i)}</b> de ${pad2(total)}</div></header>
    <main>${body}</main>
    <footer><span>@neoncreates</span><span class="next">${footRight}</span></footer>
  </section>`;
