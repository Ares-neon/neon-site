import React from 'react';
import {C, FONT} from '../brand/tokens';
import {clamp, E, lerp, prog, rnd, spring, track} from '../lib/ease';
import {fitSize, glyphBox} from '../lib/fonts';
import {Svg, Word, wordGeom} from '../lib/svg';
import {useFmt, useT} from '../lib/time';
import {AXIS} from './shared';

// PICO 8,0 → 10,5 s — a equação da NEON em cortes de colcheia/semicolcheia:
// MARCA. + CRIATIVIDADE. + TRÁFEGO. = PERFORMANCE.
// O pixel é o ponto final de cada palavra e se transforma em "+" e "=".
// PERFORMANCE. sobe da linha como barras de um gráfico; o pulso corta a palavra a 60° e tudo explode.

type Line = {text: string; fs: number; base: number; g: ReturnType<typeof wordGeom>};
type Block = {lines: Line[]; dot: {x: number; y: number; s: number}};

const block = (W: number, H: number, parts: string[], widthFrac: number, lineGap = 1.18): Block => {
  const fs = Math.min(...parts.map((p) => fitSize(p, W * widthFrac, 800, -0.045)));
  const cap = wordGeom(parts[0], fs, W / 2, 'middle', -0.045).cap;
  const total = cap * (1 + lineGap * (parts.length - 1));
  const top = H / 2 - total / 2;
  const lines = parts.map((text, i) => ({text, fs, base: top + cap + i * cap * lineGap, g: wordGeom(text, fs, W / 2, 'middle', -0.045)}));
  const last = lines[lines.length - 1];
  const pb = glyphBox('.', fs, 800);
  const s = pb.right + pb.left;
  const i = last.text.length - 1;
  return {lines, dot: {x: last.g.x0 + last.g.xs[i] - pb.left + s / 2, y: last.base - (pb.ascent - pb.descent) / 2, s}};
};

// Cortes (frames)
// cortes em meio-frame: o obturador de cada quadro final nunca atravessa um corte seco
export const EQ = {MARCA: 239.5, PLUS1: 243.5, CRIA: 246.5, PLUS2: 251.5, TRAF: 254.5, EQ: 259.5, PERF: 263.5, SLASH: 284, END: 313};

export const Peak: React.FC = () => {
  const t = useT();
  const {W, H, cx, cy, portrait, diag} = useFmt();
  if (t < 238 || t > EQ.END) return null;

  const B = {
    marca: block(W, H, ['MARCA.'], portrait ? 1.04 : 1.08),
    cria: block(W, H, portrait ? ['CRIATIVI', 'DADE.'] : ['CRIATIVIDADE.'], portrait ? 0.9 : 0.94),
    traf: block(W, H, ['TRÁFEGO.'], portrait ? 1.02 : 1.06),
    perf: block(W, H, portrait ? ['PERFOR', 'MANCE.'] : ['PERFORMANCE.'], portrait ? 0.9 : 0.94, portrait ? 1.22 : 1.18),
  };
  const opSize = portrait ? 500 : 560;

  // ---------------- pixel: posição/forma ao longo dos cortes ----------------
  // keyframes de posição (x, y) e tamanho; o pixel salta entre os cortes (motion blur faz o rastro)
  const jump = (t0: number, a: {x: number; y: number}, b: {x: number; y: number}, d = 1.4) => {
    const k = E.inOutQuad(prog(t, t0 - d, t0));
    return {x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k)};
  };
  const C0 = {x: cx, y: cy};
  // o pixel é o ponto final de cada palavra durante todo o corte; nos operadores ele vira "+" / "="
  let px = C0;
  let ps = 22;
  if (t >= EQ.MARCA && t < EQ.PLUS1) { px = B.marca.dot; ps = B.marca.dot.s; }
  else if (t >= EQ.CRIA && t < EQ.PLUS2) { px = B.cria.dot; ps = B.cria.dot.s; }
  else if (t >= EQ.TRAF && t < EQ.EQ) { px = B.traf.dot; ps = B.traf.dot.s; }
  else if (t >= EQ.PERF) {
    const k = E.inOutCubic(prog(t, EQ.PERF + 2, EQ.PERF + 6));
    px = {x: lerp(C0.x, B.perf.dot.x, k), y: lerp(C0.y, B.perf.dot.y, k)};
    ps = lerp(22, B.perf.dot.s, k);
  }

  // operadores (+ e =) nascem do pixel
  const plusAt = (t0: number, dur: number, rot0: number) => {
    const on = t >= t0 && t < t0 + dur;
    const g = E.outBack(1.8)(prog(t, t0, t0 + 1.6));
    return {on, arm: opSize * 0.5 * g, th: opSize * 0.2, rot: rot0 * (1 - E.outCubic(prog(t, t0, t0 + 2.5)))};
  };
  const plus1 = plusAt(EQ.PLUS1, EQ.CRIA - EQ.PLUS1, 45);
  const plus2 = plusAt(EQ.PLUS2, EQ.TRAF - EQ.PLUS2, -45);
  const eqOn = t >= EQ.EQ && t < EQ.PERF + 6;
  const eqVisible = t >= EQ.EQ && t < EQ.SLASH + 4;
  const eqG = E.outBack(1.6)(prog(t, EQ.EQ, EQ.EQ + 1.8));
  // "=": a barra de baixo vira a linha de base de PERFORMANCE.
  const perfL = B.perf.lines;
  const baseY = perfL.map((l) => l.base + l.g.cap * 0.1);
  const toBase = E.inOutExpo(prog(t, EQ.PERF - 0.5, EQ.PERF + 4));

  // índice editorial no canto
  const idx = t < EQ.CRIA ? '01' : t < EQ.TRAF ? '02' : t < EQ.PERF ? '03' : '→';
  const idxO = t >= EQ.MARCA && t < EQ.SLASH ? 0.55 : 0;

  // ---------------- PERFORMANCE: subida em barras ----------------
  const perfRise = (li: number, i: number) => {
    const order = li * 6 + i;
    const t0 = EQ.PERF + 1.5 + order * 0.85;
    return E.outQuart(prog(t, t0, t0 + 7));
  };
  const push = 1 + 0.05 * E.inOutQuad(prog(t, EQ.PERF, EQ.SLASH)) + 0.04 * E.outCubic(prog(t, EQ.SLASH, EQ.SLASH + 6));

  // ---------------- corte a 60° + explosão ----------------
  const u = {x: AXIS.x, y: AXIS.y};
  const n = {x: -u.y, y: u.x}; // normal
  const slashP = E.inOutQuad(prog(t, EQ.SLASH, EQ.SLASH + 3));
  const cut = t >= EQ.SLASH + 2.5;
  const sep = cut ? 26 * E.outCubic(prog(t, EQ.SLASH + 2.5, EQ.SLASH + 5)) + 1500 * E.inCubic(prog(t, EQ.SLASH + 5, EQ.SLASH + 17)) : 0;
  const shear = cut ? 120 * E.inCubic(prog(t, EQ.SLASH + 4, EQ.SLASH + 17)) : 0;
  const halfRot = cut ? 9 * E.inCubic(prog(t, EQ.SLASH + 5, EQ.SLASH + 17)) : 0;
  const L = diag;
  const Cc = {x: cx, y: cy};
  const polyA = [
    [Cc.x - u.x * L, Cc.y - u.y * L],
    [Cc.x + u.x * L, Cc.y + u.y * L],
    [Cc.x + u.x * L - n.x * L, Cc.y + u.y * L - n.y * L],
    [Cc.x - u.x * L - n.x * L, Cc.y - u.y * L - n.y * L],
  ];
  const polyB = [
    [Cc.x - u.x * L, Cc.y - u.y * L],
    [Cc.x + u.x * L, Cc.y + u.y * L],
    [Cc.x + u.x * L + n.x * L, Cc.y + u.y * L + n.y * L],
    [Cc.x - u.x * L + n.x * L, Cc.y - u.y * L + n.y * L],
  ];
  const pts = (p: number[][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const lineO = t < EQ.SLASH ? 0 : 1 - E.outQuad(prog(t, EQ.SLASH + 5, EQ.SLASH + 22));
  const sx0 = Cc.x - u.x * L * 0.75, sy0 = Cc.y - u.y * L * 0.75;
  const sx1 = Cc.x + u.x * L * 0.75, sy1 = Cc.y + u.y * L * 0.75;
  const hx = lerp(sx0, sx1, slashP), hy = lerp(sy0, sy1, slashP);

  const perfWord = (
    <g>
      {perfL.map((ln, li) => (
        <Word
          key={li}
          id={`pf${li}`}
          text={ln.text}
          size={ln.fs}
          x={W / 2}
          y={ln.base}
          tracking={-0.045}
          letter={(i, nn, ch) => {
            if (ch === '.') return {o: 0};
            const r = perfRise(li, i);
            return {dy: (1 - r) * ln.g.cap * 0.18, o: r > 0 ? 1 : 0};
          }}
          clip={(i, box) => {
            const r = perfRise(li, i);
            const h = (box.h + 40) * r;
            return [box.x - 30, ln.base + 4 - h, box.w + 60, h];
          }}
        />
      ))}
    </g>
  );
  // linha do gráfico conectando o topo das letras enquanto sobem
  const chart: string[] = [];
  perfL.forEach((ln, li) => {
    const ptsL: string[] = [];
    ln.g.chars.forEach((ch, i) => {
      if (ch === '.') return;
      const r = perfRise(li, i);
      if (r <= 0) return;
      const x = ln.g.x0 + ln.g.xs[i] + ln.g.ws[i] / 2;
      const y = ln.base - ln.g.cap * r - 22;
      ptsL.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    if (ptsL.length > 1) chart.push(ptsL.join(' '));
  });
  const chartO = prog(t, EQ.PERF + 2, EQ.PERF + 4) * (1 - prog(t, EQ.PERF + 11, EQ.PERF + 16));

  // partículas do corte
  const sparks = cut
    ? Array.from({length: 46}, (_, i) => {
        const along = (rnd(i + 5) - 0.5) * L * 0.9;
        const side = rnd(i + 9) > 0.5 ? 1 : -1;
        const sp = 120 + rnd(i + 13) * 900;
        const k = E.outExpo(prog(t, EQ.SLASH + 2.5, EQ.SLASH + 26));
        const x = Cc.x + u.x * along + n.x * side * sp * k;
        const y = Cc.y + u.y * along + n.y * side * sp * k;
        const o = (1 - prog(t, EQ.SLASH + 6, EQ.SLASH + 27)) * (0.4 + 0.5 * rnd(i + 21));
        return {x, y, o, s: 2 + rnd(i + 2) * 3};
      })
    : [];

  const wordsLayer = (
    <g transform={`translate(${cx} ${cy}) scale(${push}) translate(${-cx} ${-cy})`}>
      {t >= EQ.MARCA && t < EQ.PLUS1 ? (
        <Word
          id="pk-m"
          text="MARCA."
          size={B.marca.lines[0].fs}
          x={W / 2}
          y={B.marca.lines[0].base}
          tracking={-0.045}
          letter={(i, nn, ch) => (ch === '.' ? {o: 0} : {s: 1 + 0.12 * (1 - E.outExpo(prog(t, EQ.MARCA, EQ.MARCA + 3)))})}
        />
      ) : null}
      {t >= EQ.CRIA && t < EQ.PLUS2
        ? B.cria.lines.map((ln, li) => (
            <Word
              key={li}
              id={`pk-c${li}`}
              text={ln.text}
              size={ln.fs}
              x={W / 2}
              y={ln.base}
              tracking={-0.045}
              letter={(i, nn, ch) => {
                if (ch === '.') return {o: 0};
                const k = E.outExpo(prog(t, EQ.CRIA + (li * 8 + i) * 0.06, EQ.CRIA + 2 + (li * 8 + i) * 0.06));
                return {dx: (1 - k) * W * 0.1};
              }}
            />
          ))
        : null}
      {t >= EQ.TRAF && t < EQ.EQ ? (
        <Word
          id="pk-t"
          text="TRÁFEGO."
          size={B.traf.lines[0].fs}
          x={W / 2}
          y={B.traf.lines[0].base}
          tracking={-0.045}
          letter={(i, nn, ch) => {
            if (ch === '.') return {o: 0};
            const k = E.outExpo(prog(t, EQ.TRAF + (7 - i) * 0.06, EQ.TRAF + 2 + (7 - i) * 0.06));
            return {dx: -(1 - k) * W * 0.1};
          }}
        />
      ) : null}
    </g>
  );

  return (
    <Svg>
      {wordsLayer}
      {/* operadores */}
      {[plus1, plus2].map((p, i) =>
        p.on ? (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(${p.rot})`}>
            <rect x={-p.arm} y={-p.th / 2} width={p.arm * 2} height={p.th} fill={C.green} />
            <rect x={-p.th / 2} y={-p.arm} width={p.th} height={p.arm * 2} fill={C.green} />
          </g>
        ) : null,
      )}
      {eqOn || (t >= EQ.PERF && t < EQ.SLASH + 4) ? (
        <g transform={`translate(${cx} ${cy}) scale(${t >= EQ.PERF ? push : 1}) translate(${-cx} ${-cy})`}>
          {(portrait ? [0, 1] : [0, 1]).map((bi) => {
            const th = opSize * 0.17;
            const half = (opSize * 0.5 * eqG) * (1 - toBase) + (W * 0.47) * toBase;
            const y0 = cy + (bi === 0 ? -1 : 1) * opSize * 0.2;
            const yT = portrait ? baseY[bi] : baseY[0] + (bi === 0 ? -0.5 : 0) * 0;
            const y = lerp(y0, yT, toBase);
            const thick = lerp(th, 6, toBase);
            const o = !portrait && bi === 0 ? 1 - prog(t, EQ.PERF, EQ.PERF + 3) : 1;
            return <rect key={bi} x={cx - half} y={y - thick / 2} width={half * 2} height={thick} fill={C.green} opacity={o * (1 - prog(t, EQ.SLASH + 2, EQ.SLASH + 4))} />;
          })}
        </g>
      ) : null}

      {/* PERFORMANCE. — cortada em duas metades pelo pulso */}
      {t >= EQ.PERF ? (
        <g transform={`translate(${cx} ${cy}) scale(${push}) translate(${-cx} ${-cy})`}>
          <defs>
            <clipPath id="pk-a">
              <polygon points={pts(polyA)} />
            </clipPath>
            <clipPath id="pk-b">
              <polygon points={pts(polyB)} />
            </clipPath>
          </defs>
          {!cut ? (
            perfWord
          ) : (
            <>
              <g transform={`translate(${-n.x * sep - u.x * shear} ${-n.y * sep - u.y * shear}) rotate(${-halfRot} ${cx} ${cy})`}>
                <g clipPath="url(#pk-a)">{perfWord}</g>
              </g>
              <g transform={`translate(${n.x * sep + u.x * shear} ${n.y * sep + u.y * shear}) rotate(${halfRot} ${cx} ${cy})`}>
                <g clipPath="url(#pk-b)">{perfWord}</g>
              </g>
            </>
          )}
          {chart.length && chartO > 0.01 ? (
            <g opacity={chartO}>
              {chart.map((p, i) => (
                <polyline key={i} points={p} fill="none" stroke={C.green} strokeWidth={4} strokeLinejoin="round" />
              ))}
            </g>
          ) : null}
        </g>
      ) : null}

      {/* pulso diagonal */}
      {t >= EQ.SLASH && lineO > 0.01 ? (
        <g opacity={lineO}>
          <line x1={sx0} y1={sy0} x2={hx} y2={hy} stroke={C.green} strokeWidth={150} opacity={0.07} strokeLinecap="square" />
          <line x1={sx0} y1={sy0} x2={hx} y2={hy} stroke={C.green} strokeWidth={56} opacity={0.2} strokeLinecap="square" />
          <line x1={sx0} y1={sy0} x2={hx} y2={hy} stroke={C.green} strokeWidth={16} strokeLinecap="square" />
          <line x1={sx0} y1={sy0} x2={hx} y2={hy} stroke={C.white} strokeWidth={4} opacity={0.9} strokeLinecap="square" />
        </g>
      ) : null}
      {sparks.map((s, i) => (s.o > 0.01 ? <rect key={i} x={s.x - s.s / 2} y={s.y - s.s / 2} width={s.s} height={s.s} fill={C.green} opacity={s.o} /> : null))}

      {/* pixel */}
      {t >= EQ.MARCA && t < EQ.SLASH + 2.5 && !plus1.on && !plus2.on && !(eqOn && t < EQ.PERF + 2) ? (
        <g transform={`translate(${cx} ${cy}) scale(${t >= EQ.PERF ? push : 1}) translate(${-cx} ${-cy})`}>
          <rect x={px.x - ps / 2} y={px.y - ps / 2} width={ps} height={ps} fill={C.green} />
        </g>
      ) : null}

      {/* índice editorial */}
      {idxO > 0 ? (
        <text x={portrait ? 64 : 72} y={portrait ? 250 : 92} fontFamily={FONT.display} fontWeight={600} fontSize={portrait ? 30 : 26} fill={C.white} opacity={idxO} letterSpacing="0.2em">
          {idx}
        </text>
      ) : null}
    </Svg>
  );
};
