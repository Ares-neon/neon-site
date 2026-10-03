import React from 'react';
import {NeonSymbol, SYM} from '../brand/Logo';
import {HEX} from '../brand/logoPaths';
import {C} from '../brand/tokens';
import {E, prog, rnd, spring, track} from '../lib/ease';
import {hexPath, Svg, Word} from '../lib/svg';
import {AXIS, hookLayout, hookPush, originOf, waveArrival} from './shared';
import {useFmt, useT, useT0} from '../lib/time';

// GANCHO 0 → 1,7 s: pixel verde → pulso → símbolo se monta → implode → "MARCA."
// O pixel é o ponto final quadrado da Switzer: protagonista do filme inteiro.

const Ruler: React.FC<{cx: number; cy: number; lenX: number; lenY: number; o: number}> = ({cx, cy, lenX, lenY, o}) => {
  const gap = 26;
  const ticks: React.ReactNode[] = [];
  for (let d = 40; d < Math.max(lenX, lenY); d += 40) {
    const big = d % 200 === 0;
    const l = big ? 12 : 5;
    if (d < lenX) {
      ticks.push(<line key={`r${d}`} x1={cx + d} y1={cy - l} x2={cx + d} y2={cy + l} />);
      ticks.push(<line key={`l${d}`} x1={cx - d} y1={cy - l} x2={cx - d} y2={cy + l} />);
    }
    if (d < lenY) {
      ticks.push(<line key={`d${d}`} x1={cx - l} y1={cy + d} x2={cx + l} y2={cy + d} />);
      ticks.push(<line key={`u${d}`} x1={cx - l} y1={cy - d} x2={cx + l} y2={cy - d} />);
    }
  }
  return (
    <g stroke={C.white} strokeWidth={1} opacity={o}>
      <line x1={cx + gap} y1={cy} x2={cx + Math.max(gap, lenX)} y2={cy} />
      <line x1={cx - gap} y1={cy} x2={cx - Math.max(gap, lenX)} y2={cy} />
      <line x1={cx} y1={cy + gap} x2={cx} y2={cy + Math.max(gap, lenY)} />
      <line x1={cx} y1={cy - gap} x2={cx} y2={cy - Math.max(gap, lenY)} />
      <g opacity={0.7}>{ticks}</g>
    </g>
  );
};

const Brackets: React.FC<{cx: number; cy: number; b: number; rot: number; o: number}> = ({cx, cy, b, rot, o}) => {
  const arm = 18;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot})`} stroke={C.white} strokeWidth={2.5} fill="none" opacity={o} strokeLinecap="square">
      {corners.map(([sx, sy], i) => (
        <path key={i} d={`M${sx * b} ${sy * (b - arm)} L${sx * b} ${sy * b} L${sx * (b - arm)} ${sy * b}`} />
      ))}
    </g>
  );
};

export const Hook: React.FC = () => {
  const t = useT();
  const {t: t0c, shutter} = useT0();
  const {W, H, cx, cy, portrait, diag} = useFmt();
  if (t > 66) return null;
  const L = hookLayout(W, H, portrait);

  // ---------- pixel (ponto) ----------
  const dBase = 16;
  const appear = 0.35 + 0.65 * spring(t, 0, {f: 4, z: 0.5});
  const charge = 1 - 0.32 * E.inQuad(prog(t, 5.5, 9)) + 0.32 * prog(t, 9, 9.6);
  let d = dBase * appear * charge * (1 + 0.4 * prog(t, 9, 17));
  let dotO = 1 - prog(t, 19, 21.5);
  // ponto renasce ao fim da implosão e vira o ponto final de MARCA.
  const reborn = spring(t, 36, {f: 4.2, z: 0.48});
  if (t >= 35.5) {
    d = L.pSize * (0.25 + 0.75 * reborn);
    dotO = prog(t, 35.5, 36.5);
  }
  // deslocamento de câmera que recentraliza a palavra
  const pan = E.land(prog(t, 37, 48));
  const ox = (cx - L.pcx) * (1 - pan);
  const oy = (cy - L.pcy) * (1 - pan);
  const dotX = t >= 35.5 ? L.pcx + ox : cx;
  const dotY = t >= 35.5 ? L.pcy + oy : cy;
  const dotColor = t > 17 && t < 35.5 ? C.white : C.green;

  // ---------- régua + mira ----------
  const rulerIn = E.outExpo(prog(t, 0, 7));
  const rulerO = t < 9 ? 0.22 : track(t, [[9, 0.45], [10, 0.45], [21, 0, E.outCubic]]);
  const bSpring = spring(t, 0, {f: 4, z: 0.55});
  let b = 170 + (54 - 170) * bSpring - 12 * E.inQuad(prog(t, 5.5, 9));
  b += Math.max(W, H) * 0.65 * E.outCubic(prog(t, 9, 19));
  const bRot = 45 * (1 - bSpring) - 18 * E.outCubic(prog(t, 9, 19));
  const bO = 0.9 * prog(t, 0, 1) * (1 - prog(t, 11, 18));

  // ---------- pulso (anéis hexagonais) ----------
  const ping = prog(t, 3, 10);
  // anéis com blur analítico (tempo central do quadro ± obturador)
  const ring = (tt: number, t0: number, t1: number, r0: number, r1: number) => r0 + (r1 - r0) * E.outQuart(prog(tt, t0, t1));
  const ringBand = (t0: number, t1: number, r0: number, r1: number, sw: number) => {
    const ra = ring(t0c - shutter / 2, t0, t1, r0, r1);
    const rb = ring(t0c + shutter / 2, t0, t1, r0, r1);
    const w = Math.max(sw, rb - ra);
    return {r: (ra + rb) / 2, w, k: sw / w};
  };
  const shock = prog(t0c, 9, 25);
  const sb = ringBand(9, 25, 24, diag * 0.72, 2 + 6 * (1 - shock));
  const shock2 = prog(t0c, 10.5, 26);
  const sb2 = ringBand(10.5, 26, 24, diag * 0.55, 1.5);

  // ---------- símbolo ----------
  const symVisible = t >= 9.5 && t < 39;
  const k = L.symH / SYM.h;
  const D = (Math.max(W, H) * 1.05) / k; // distância de entrada (unidades do logo)
  const order = [1, 7, 6, 0, 5, 2];
  const collapse = track(t, [[30, 1], [33, 1.055, E.outQuad], [38.6, 0.0, E.inExpo]]);
  const colRot = track(t, [[33, 0], [38.6, 80, E.inCubic]]);
  const pieceFn = (i: number) => {
    if (i === 3 || i === 4) {
      const sp = spring(t, 9.5, {f: 2.5, z: 0.8});
      const s = i === 3 ? 1 : -1;
      return {tx: AXIS.x * D * 0.62 * (1 - sp) * s, ty: AXIS.y * D * 0.62 * (1 - sp) * s, o: t >= 9.5 ? 1 : 0};
    }
    const idx = order.indexOf(i);
    const t0 = 10 + idx * 1.2;
    const sp = spring(t, t0, {f: 2.3, z: 0.64});
    const p = HEX[i];
    const dx = p.cx - SYM.cx, dy = p.cy - SYM.cy;
    const len = Math.hypot(dx, dy) || 1;
    const far = 1 - sp;
    return {
      tx: (dx / len) * D * 0.6 * far,
      ty: (dy / len) * D * 0.6 * far,
      s: 1 + 0.7 * far,
      rot: (idx % 2 ? 1 : -1) * 40 * far,
      o: t >= t0 ? 1 : 0,
    };
  };
  const boltS = spring(t, 18.5, {f: 3.6, z: 0.5});
  const glow = 0.75 * prog(t, 20, 25) * (1 - prog(t, 33, 36));
  const boltGlow = track(t, [[18.5, 0], [20, 1.4], [27, 0.55]]) * (1 - prog(t, 33, 36));

  // partículas discretas na liberação do pulso
  const parts = Array.from({length: 18}, (_, i) => {
    const ang = rnd(i + 1) * Math.PI * 2;
    const sp = 260 + rnd(i + 31) * 620;
    const pp = E.outExpo(prog(t, 9, 31));
    const r = 30 + sp * pp;
    const o = (1 - prog(t, 13, 31)) * (t >= 9 ? 1 : 0) * (0.35 + 0.5 * rnd(i + 7));
    const s = 2 + rnd(i + 3) * 2.5;
    return {x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, o, s};
  });

  // ---------- MARCA. ----------
  const wordOn = t >= 37;
  const letterFn = (i: number) => {
    if (i === 5) return {o: 0}; // o ponto é o pixel
    const order2 = 4 - i; // A sai primeiro (mais perto do ponto)
    const t0 = 37 + order2 * 0.7;
    const p = E.outExpo(prog(t, t0, t0 + 6.5));
    const finalX = L.g.x0 + L.g.xs[i] + L.g.ws[i] / 2;
    const startX = L.pcx - L.g.ws[i] * 0.3;
    // onda hexagonal que nasce do ponto: acende a letra em verde e a empurra para fora
    const lx = cx + (finalX - cx) * push;
    const ly = cy + (L.baseline - L.g.cap / 2 - cy) * push;
    const dist = Math.hypot(lx - O.x, ly - O.y);
    const ta = waveArrival(dist);
    const q = E.outCubic(prog(t, ta, ta + 5));
    const ux = (lx - O.x) / (dist || 1), uy = (ly - O.y) / (dist || 1);
    return {
      dx: (startX - finalX) * (1 - p) + ux * 110 * q,
      dy: uy * 110 * q,
      s: (0.55 + 0.45 * p) * (1 - 0.14 * q),
      sx: 1 + 0.25 * (1 - p),
      o: (t >= t0 ? 1 : 0) * (1 - q),
      fill: q > 0.001 && q < 0.45 ? C.green : C.white,
    };
  };
  const push = hookPush(t);
  const O = originOf(W, H, portrait);

  return (
    <Svg>
      {/* halo verde muito sutil atrás do símbolo travado */}
      <defs>
        <radialGradient id="hk-halo">
          <stop offset="0%" stopColor={C.green} stopOpacity={0.14} />
          <stop offset="25%" stopColor={C.green} stopOpacity={0.09} />
          <stop offset="50%" stopColor={C.green} stopOpacity={0.04} />
          <stop offset="75%" stopColor={C.green} stopOpacity={0.012} />
          <stop offset="100%" stopColor={C.green} stopOpacity={0} />
        </radialGradient>
        <filter id="hk-dotglow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation={7} />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={L.symH * 0.9} fill="url(#hk-halo)" opacity={prog(t, 19, 25) * (1 - prog(t, 32, 37))} />

      <Ruler cx={cx} cy={cy} lenX={(W / 2) * rulerIn} lenY={(H / 2) * rulerIn} o={rulerO} />
      {bO > 0.01 ? <Brackets cx={cx} cy={cy} b={b} rot={bRot} o={bO} /> : null}

      {ping > 0 && ping < 1 ? (
        <path d={hexPath(cx, cy, 10 + 70 * E.outCubic(ping))} fill="none" stroke={C.green} strokeWidth={1.5} opacity={0.7 * (1 - ping)} />
      ) : null}
      {shock > 0 && shock < 1 ? (
        <path d={hexPath(cx, cy, sb.r)} fill="none" stroke={C.green} strokeWidth={sb.w} opacity={(1 - E.inQuad(shock)) * sb.k} />
      ) : null}
      {shock2 > 0 && shock2 < 1 ? (
        <path d={hexPath(cx, cy, sb2.r)} fill="none" stroke={C.white} strokeWidth={sb2.w} opacity={0.35 * (1 - shock2) * sb2.k} />
      ) : null}

      {parts.map((p, i) => (p.o > 0.01 ? <rect key={i} x={p.x - p.s / 2} y={p.y - p.s / 2} width={p.s} height={p.s} fill={C.green} opacity={p.o} /> : null))}

      {symVisible ? (
        <NeonSymbol
          id="hook-sym"
          x={cx}
          y={cy}
          height={L.symH * Math.max(collapse, 0.0001)}
          rot={colRot}
          piece={pieceFn}
          bolt={{s: boltS, o: t >= 18.5 ? 1 : 0}}
          glow={glow}
          boltGlow={boltGlow}
        />
      ) : null}

      {/* pixel verde / branco */}
      {dotO > 0.001 && t < 35.5 ? (
        <g opacity={dotO}>
          <rect x={dotX - d * 0.9} y={dotY - d * 0.9} width={d * 1.8} height={d * 1.8} fill={dotColor} opacity={0.75} filter="url(#hk-dotglow)" />
          <rect x={dotX - d / 2} y={dotY - d / 2} width={d} height={d} fill={dotColor} />
        </g>
      ) : null}

      {wordOn ? (
        <g transform={`translate(${cx} ${cy}) scale(${push}) translate(${-cx} ${-cy}) translate(${ox} ${oy})`}>
          <Word text="MARCA." size={L.fs} x={cx} y={L.baseline} tracking={-0.045} letter={letterFn} id="hk-marca" />
        </g>
      ) : null}
      {t >= 35.5 && t <= 50 ? (
        // o ponto acompanha o mesmo push da palavra
        <g transform={`translate(${cx} ${cy}) scale(${push}) translate(${-cx} ${-cy})`} opacity={dotO}>
          <rect x={dotX - d / 2} y={dotY - d / 2} width={d} height={d} fill={C.green} />
        </g>
      ) : null}
    </Svg>
  );
};
