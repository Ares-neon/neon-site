import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PieceId, PIECES} from '../brand/pieces';
import {C} from '../brand/tokens';
import {Card, lerpRect, Rect} from '../lib/Card';
import {clamp, deg, E, prog, spring, track} from '../lib/ease';
import {fitSize, glyphBox} from '../lib/fonts';
import {Cam, P2, proj, projSeg, rotate, V3} from '../lib/project';
import {hexPoints, Svg, Word, wordGeom} from '../lib/svg';
import {useFmt, useT} from '../lib/time';
import {FLY_T0, FLY_T1, FLY_Z1, originOf, WAVE_DUR, WAVE_T0, waveR, Z0} from './shared';

// CONSTRUÇÃO 1,7 → 4,0 s
// A onda nasce do ponto de MARCA. → malha triangular (60°, geometria do símbolo) → dobra em grid →
// grid inclina em perspectiva (prancheta) → o pixel verde desenha cada peça real → layouts se
// reconstroem → o pulso corta o bento → "CRIATIVIDADE." → a câmera atravessa o corte.

type Slot = {id: PieceId | 'node'; L0: Rect; L1: Rect; L2: Rect; half: -1 | 1};
type Layout = {slots: Slot[]; order: number[]; boardC: [number, number]; seam: number; bounds: Rect};

const LAND: Layout = {
  slots: [
    {id: 'hero', L0: [-1024, -704, 896, 560], L1: [24, 24, 450, 504], L2: [0, 0, 946, 533], half: -1},
    {id: 'trafego', L0: [-64, -704, 512, 288], L1: [498, 24, 450, 504], L2: [960, 0, 466, 259], half: -1},
    {id: 'simbolo', L0: [512, -704, 320, 400], L1: [972, 24, 450, 504], L2: [1440, 0, 480, 533], half: -1},
    {id: 'design', L0: [-64, -384, 512, 288], L1: [1446, 24, 450, 504], L2: [960, 274, 466, 259], half: -1},
    {id: 'metodo', L0: [0, -32, 832, 416], L1: [498, 552, 450, 504], L2: [634, 547, 792, 533], half: 1},
    {id: 'mobile', L0: [-320, -64, 256, 544], L1: [972, 552, 450, 504], L2: [1440, 547, 480, 533], half: 1},
    {id: 'cta', L0: [-1024, -64, 640, 352], L1: [24, 552, 450, 504], L2: [0, 547, 620, 533], half: 1},
  ],
  order: [0, 1, 2, 3, 4, 5, 6],
  boardC: [-96, -150],
  seam: 540,
  bounds: [-2600, -2600, 5200, 3700],
};
const NODE_TILE_LAND: Rect = [1446, 552, 450, 504];

const PORT: Layout = {
  slots: [
    {id: 'hero', L0: [-896, -1152, 896, 560], L1: [20, 20, 510, 455], L2: [0, 0, 1080, 540], half: -1},
    {id: 'mobile', L0: [64, -1152, 320, 688], L1: [550, 20, 510, 455], L2: [1180, 554, 533, 399], half: -1},
    {id: 'trafego', L0: [-896, -544, 448, 256], L1: [20, 495, 510, 455], L2: [0, 554, 533, 399], half: -1},
    {id: 'simbolo', L0: [-384, -544, 384, 480], L1: [550, 495, 510, 455], L2: [-650, 1521, 533, 399], half: 1},
    {id: 'design', L0: [64, -400, 320, 184], L1: [20, 970, 510, 455], L2: [547, 554, 533, 399], half: -1},
    {id: 'cta', L0: [-896, -224, 448, 256], L1: [550, 970, 510, 455], L2: [0, 967, 1080, 540], half: 1},
    {id: 'metodo', L0: [-896, 96, 896, 448], L1: [20, 1445, 510, 455], L2: [0, 1521, 1080, 399], half: 1},
  ],
  order: [0, 1, 2, 3, 4, 5, 6],
  boardC: [-256, -120],
  seam: 960,
  bounds: [-2600, -3000, 5200, 4300],
};
const NODE_TILE_PORT: Rect = [550, 1445, 510, 455];

const PEN_T0 = 55;
const PEN_STEP = 3.4;
const PIXEL = 22; // tamanho do pixel verde quando não é ponto final
const PEN_TRACE = 4.2;

/** Ponto no perímetro de um retângulo (sentido horário a partir do canto sup. esq.). */
const perim = (r: Rect, p: number): [number, number] => {
  const [x, y, w, h] = r;
  const L = 2 * (w + h);
  let d = clamp(p) * L;
  if (d <= w) return [x + d, y];
  d -= w;
  if (d <= h) return [x + w, y + d];
  d -= h;
  if (d <= w) return [x + w - d, y + h];
  d -= w;
  return [x, y + h - d];
};

/** Recorta a reta c + s·d ao retângulo (Liang–Barsky). */
const clipLine = (c: [number, number], d: [number, number], r: Rect): [[number, number], [number, number]] | null => {
  let t0 = -1e6, t1 = 1e6;
  const [x, y, w, h] = r;
  const pq: [number, number][] = [
    [-d[0], c[0] - x],
    [d[0], x + w - c[0]],
    [-d[1], c[1] - y],
    [d[1], y + h - c[1]],
  ];
  for (const [p, q] of pq) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
    } else {
      const k = q / p;
      if (p < 0) t0 = Math.max(t0, k);
      else t1 = Math.min(t1, k);
    }
  }
  if (t0 > t1) return null;
  return [
    [c[0] + d[0] * t0, c[1] + d[1] * t0],
    [c[0] + d[0] * t1, c[1] + d[1] * t1],
  ];
};

export const buildWord = (W: number, H: number, portrait: boolean, seam: number) => {
  if (!portrait) {
    const fs = fitSize('CRIATIVIDADE.', W * 0.9, 800, -0.045);
    const g = wordGeom('CRIATIVIDADE.', fs, W / 2, 'middle', -0.045);
    return {lines: [{text: 'CRIATIVIDADE.', fs, g, base: seam + g.cap / 2}], fs, cap: g.cap};
  }
  const fs = fitSize('CRIATIVI', W * 0.86, 800, -0.045);
  const g1 = wordGeom('CRIATIVI', fs, W / 2, 'middle', -0.045);
  const g2 = wordGeom('DADE.', fs, W / 2, 'middle', -0.045);
  const gap = g1.cap * 1.24;
  return {
    lines: [
      {text: 'CRIATIVI', fs, g: g1, base: seam - gap / 2 + g1.cap / 2 - gap * 0.0},
      {text: 'DADE.', fs, g: g2, base: seam + gap / 2 + g1.cap / 2},
    ],
    fs,
    cap: g1.cap,
  };
};

export const Build: React.FC = () => {
  const t = useT();
  const {W, H, cx, cy, portrait} = useFmt();
  if (t < 49 || t > FLY_T1 + 3) return null;
  const O = originOf(W, H, portrait);
  const Ly = portrait ? PORT : LAND;
  const nodeTile = portrait ? NODE_TILE_PORT : NODE_TILE_LAND;

  // ---------------- prancheta (plano) + câmera ----------------
  const alpha = deg(track(t, [[55, 0], [68, -42, E.inOutCubic], [86, -37, E.linear], [96, 0, E.inOutExpo]]));
  const gamma = deg(track(t, [[55, 0], [68, -7, E.inOutCubic], [86, -4, E.linear], [96, 0, E.inOutExpo]]));
  const yaw = deg(track(t, [[55, 0], [70, 5, E.inOutCubic], [87, -3, E.inOutQuad], [96, 0, E.inOutExpo]]));
  const panP = track(t, [[54, 0], [68, 1, E.inOutCubic], [87, 1], [96, 0, E.inOutExpo]]);
  const dolly = track(t, [[55, 0], [70, 300, E.inOutCubic], [87, 440, E.linear], [96, 0, E.inOutExpo]]);
  const fly = FLY_Z1 * E.inCubic(prog(t, FLY_T0, FLY_T1));
  const cam: Cam = {
    x: (O.x - cx + Ly.boardC[0]) * panP,
    y: (O.y - cy + Ly.boardC[1]) * panP,
    z: dolly + fly,
    rx: 0, ry: yaw, rz: 0, f: Z0, cx, cy,
  };
  const Ow: V3 = [O.x - cx, O.y - cy, Z0];
  const plane = (u: number, v: number): V3 => {
    const r = rotate([u, v, 0], alpha, 0, gamma);
    return [Ow[0] + r[0], Ow[1] + r[1], Ow[2] + r[2]];
  };
  const P = (u: number, v: number): P2 => proj(cam, plane(u, v));
  const toPlane = (r: Rect): Rect => [r[0] - O.x, r[1] - O.y, r[2], r[3]];

  // ---------------- malha → grid ----------------
  const s = 64;
  const fold = E.inOutCubic(prog(t, 52, 58.5));
  const fams = [0, 60 + 30 * fold, 120 - 30 * fold];
  const R = waveR(t);
  const waveOn = t < WAVE_T0 + WAVE_DUR;
  const latticeO = 0.15 * prog(t, WAVE_T0, WAVE_T0 + 1) * (1 - 0.45 * prog(t, 68, 82)) * (1 - prog(t, 92, 99));
  const segs: string[] = [];
  if (latticeO > 0.002) {
    fams.forEach((th, fi) => {
      if (fi === 2 && fold > 0.999) return;
      const a = deg(th);
      const n: [number, number] = [-Math.sin(a), Math.cos(a)];
      const d: [number, number] = [Math.cos(a), Math.sin(a)];
      const K = 52;
      for (let k = -K; k <= K; k++) {
        const c: [number, number] = [n[0] * k * s, n[1] * k * s];
        const cl = clipLine(c, d, Ly.bounds);
        if (!cl) continue;
        const sg = projSeg(cam, plane(cl[0][0], cl[0][1]), plane(cl[1][0], cl[1][1]));
        if (!sg) continue;
        segs.push(`M${sg[0].x.toFixed(1)} ${sg[0].y.toFixed(1)}L${sg[1].x.toFixed(1)} ${sg[1].y.toFixed(1)}`);
      }
    });
  }
  const hexD = (r: number) =>
    'M' + hexPoints(0, 0, Math.max(r, 0.5)).map(([u, v]) => P(u, v)).map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L') + 'Z';
  const hexPoly = waveOn;
  const waveP = prog(t, WAVE_T0, WAVE_T0 + WAVE_DUR);

  // ---------------- slots (peças) ----------------
  const l1 = (i: number) => E.snap(prog(t, 87.5 + i * 0.45, 91.5 + i * 0.45));
  const l2 = (i: number) => E.snap(prog(t, 92.5 + i * 0.45, 96.5 + i * 0.45));
  const openMax = buildWord(W, H, portrait, Ly.seam).cap * (portrait ? 1.9 : 0.95);
  const open = openMax * E.inOutExpo(prog(t, 100, 109)) + H * 0.45 * E.inCubic(prog(t, FLY_T0, FLY_T1));
  const rectAt = (i: number): Rect => {
    const sl = Ly.slots[i];
    let r = lerpRect(sl.L0, toPlane(sl.L1), l1(i));
    r = lerpRect(r, toPlane(sl.L2), l2(i));
    return [r[0], r[1] + sl.half * open, r[2], r[3]];
  };

  // caneta (pixel) — desenha o contorno de cada peça
  const penStart = (j: number) => PEN_T0 + PEN_STEP * j;
  const cards: React.ReactNode[] = [];
  const outlines: React.ReactNode[] = [];
  Ly.order.forEach((si, j) => {
    const sl = Ly.slots[si];
    if (sl.id === 'node') return;
    const piece = PIECES[sl.id as PieceId];
    const r = rectAt(si);
    const ts = penStart(j);
    const trace = prog(t, ts, ts + PEN_TRACE);
    const reveal = E.inOutCubic(prog(t, ts + 2.4, ts + 7.4));
    if (t < ts) return;
    const q = [P(r[0], r[1]), P(r[0] + r[2], r[1]), P(r[0] + r[2], r[1] + r[3]), P(r[0], r[1] + r[3])];
    const minZ = Math.min(...q.map((p) => p.z));
    if (minZ < 60) return;
    if (reveal > 0) cards.push(<Card key={sl.id} piece={piece} w={r[2]} h={r[3]} quad={q} reveal={reveal} z={10 + j} />);
    // contorno parcial projetado
    const outlineO = (1 - prog(t, ts + 8, ts + 14)) * (1 - prog(t, 86, 89));
    if (outlineO > 0.01) {
      const steps = 24;
      const pts: string[] = [];
      for (let k = 0; k <= steps; k++) {
        const [u, v] = perim(r, (trace * k) / steps);
        const pp = P(u, v);
        pts.push(`${pp.x.toFixed(1)},${pp.y.toFixed(1)}`);
      }
      outlines.push(
        <polyline key={`o${sl.id}`} points={pts.join(' ')} fill="none" stroke={trace < 1 ? C.green : C.white} strokeWidth={trace < 1 ? 2 : 1.2} opacity={outlineO * (trace < 1 ? 1 : 0.35)} />,
      );
    }
    // borda da varredura (o pulso preenchendo a peça)
    if (reveal > 0 && reveal < 1) {
      const ur = r[0] + r[2] * reveal;
      const a = P(ur, r[1]), b = P(ur, r[1] + r[3]);
      outlines.push(<line key={`w${sl.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.green} strokeWidth={2.5} opacity={0.9} />);
    }
  });

  // posição da caneta
  const lastJ = Ly.order.length - 1;
  const penEnd = penStart(lastJ) + PEN_TRACE;
  let pen: [number, number] = [0, 0];
  if (t >= 51.5 && t < PEN_T0) {
    const r0 = rectAt(Ly.order[0]);
    const k = E.inOutCubic(prog(t, 51.5, PEN_T0));
    pen = [r0[0] * k, r0[1] * k];
  } else if (t >= PEN_T0 && t < penEnd) {
    const j = Math.min(lastJ, Math.floor((t - PEN_T0) / PEN_STEP));
    const r = rectAt(Ly.order[j]);
    const local = prog(t, penStart(j), penStart(j) + PEN_TRACE);
    if (local >= 1 && j < lastJ) {
      // salto rápido para a próxima peça
      const rn = rectAt(Ly.order[j + 1]);
      const k = E.inOutQuad(prog(t, penStart(j) + PEN_TRACE, penStart(j + 1)));
      pen = [r[0] + (rn[0] - r[0]) * k, r[1] + (rn[1] - r[1]) * k];
    } else pen = perim(r, local);
  } else if (t >= penEnd) {
    const rl = rectAt(Ly.order[lastJ]);
    const tile = toPlane(nodeTile);
    const tc: [number, number] = [tile[0] + tile[2] / 2, tile[1] + tile[3] / 2];
    const k1 = E.snap(prog(t, 87.5, 91.5));
    pen = [rl[0] + (tc[0] - rl[0]) * k1, rl[1] + (tc[1] - rl[1]) * k1];
    // corte: vai ao início da costura e corre por ela
    const seamV = Ly.seam - O.y;
    const k2 = E.snap(prog(t, 93, 97));
    pen = [pen[0] + (-O.x - 24 - pen[0]) * k2, pen[1] + (seamV - pen[1]) * k2];
    const k3 = E.inOutQuad(prog(t, 97, 100.5));
    pen = [pen[0] + (W + 24 - O.x - pen[0]) * k3, pen[1]];
  }
  // depois do corte, a caneta volta e vira o ponto final de CRIATIVIDADE.
  const BW = buildWord(W, H, portrait, Ly.seam);
  const last = BW.lines[BW.lines.length - 1];
  const dotIdx = last.text.length - 1;
  const pb = glyphBox('.', last.fs, 800);
  const dotPx = pb.right + pb.left;
  const dotX = last.g.x0 + last.g.xs[dotIdx] - pb.left + dotPx / 2;
  const dotY = last.base - (pb.ascent - pb.descent) / 2;
  const k4 = E.land(prog(t, 100.5, 106));
  if (t >= 100.5) pen = [pen[0] + (dotX - O.x - pen[0]) * k4, pen[1] + (dotY - O.y - pen[1]) * k4];
  const penSize = t < 100.5 ? O.size + (PIXEL - O.size) * E.inOutCubic(prog(t, 50, 54)) : PIXEL + (dotPx - PIXEL) * k4;
  const penP = P(pen[0], pen[1]);
  const penScale = Z0 / Math.max(penP.z, 1);

  // linha do corte
  const cutP = prog(t, 97, 100.5);
  const cutO = cutP > 0 ? 1 - prog(t, 101, 105) : 0;
  const seamY = P(0, Ly.seam - O.y).y;

  // palavra (atrás das peças; a câmera atravessa)
  const wordScale = Z0 / Math.max(Z0 - cam.z, 1);
  const wordO = 1 - prog(wordScale, 3.2, 6);
  const nodeTileO = prog(t, 89, 91) * (1 - prog(t, 93, 95));
  const tile = nodeTile;

  return (
    <AbsoluteFill>
      <Svg>
        {waveOn ? (
          <defs>
            <mask id="bw-wave" maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
              <path d={hexD(R)} fill="white" />
            </mask>
            <mask id="bw-band" maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
              <path d={hexD(R) + hexD(Math.max(R - 300, 0.5))} fill="white" fillRule="evenodd" />
            </mask>
          </defs>
        ) : null}
        {segs.length ? (
          <path d={segs.join('')} stroke={C.white} strokeWidth={1} opacity={latticeO} fill="none" mask={waveOn ? 'url(#bw-wave)' : undefined} />
        ) : null}
        {waveOn && segs.length ? (
          <path d={segs.join('')} stroke={C.green} strokeWidth={1.6} opacity={0.75 * (1 - waveP)} fill="none" mask="url(#bw-band)" />
        ) : null}
        {hexPoly ? <path d={hexD(R)} fill="none" stroke={C.green} strokeWidth={2.5} opacity={(1 - waveP) * 0.9} /> : null}
        {/* CRIATIVIDADE. — revelada pela abertura do bento */}
        {t >= 99 && wordO > 0.01 ? (
          <g transform={`translate(${cx} ${cy}) scale(${wordScale}) translate(${-cx} ${-cy})`} opacity={wordO}>
            {BW.lines.map((ln, li) => (
              <Word
                key={li}
                id={`bw${li}`}
                text={ln.text}
                size={ln.fs}
                x={W / 2}
                y={ln.base}
                tracking={-0.045}
                letter={(i, n, ch) => {
                  if (ch === '.') return {o: 0};
                  const st = 100 + (li * 8 + i) * 0.32;
                  const q = E.outExpo(prog(t, st, st + 7));
                  return {dy: (1 - q) * ln.g.cap * 0.55 * (portrait && li === 1 ? -1 : 1), o: q > 0 ? 1 : 0};
                }}
              />
            ))}
          </g>
        ) : null}
      </Svg>
      <AbsoluteFill>{cards}</AbsoluteFill>
      <Svg>
        {outlines}
        {nodeTileO > 0.01 ? (
          <rect x={tile[0]} y={tile[1]} width={tile[2]} height={tile[3]} fill="none" stroke={C.white} strokeWidth={1} opacity={0.22 * nodeTileO} />
        ) : null}
        {cutO > 0.01 ? (
          <g opacity={cutO}>
            <line x1={-10} y1={seamY} x2={-10 + (W + 20) * cutP} y2={seamY} stroke={C.green} strokeWidth={3} />
            <line x1={-10} y1={seamY} x2={-10 + (W + 20) * cutP} y2={seamY} stroke={C.green} strokeWidth={14} opacity={0.18} />
          </g>
        ) : null}
        {t >= 50 && penP.z > 60 ? (
          <rect
            x={penP.x - (penSize * penScale) / 2}
            y={penP.y - (penSize * penScale) / 2}
            width={penSize * penScale}
            height={penSize * penScale}
            fill={C.green}
            opacity={wordO}
          />
        ) : null}
      </Svg>
    </AbsoluteFill>
  );
};
