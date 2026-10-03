import {E, Key, prog, rnd, track} from '../lib/ease';
import {V3} from '../lib/project';
import {aspectOf, LOOP, PieceId} from '../brand/pieces';
import {FLY_T0, FLY_T1, FLY_Z1, Z0} from './shared';

// Mundo do voo (ACELERAÇÃO → PICO). Câmera em +z; posições calculadas a partir da velocidade.

const V_KEYS: Key[] = [
  [122, 540],
  [134, 115, E.outCubic],
  [150, 140, E.linear],
  [162, 30, E.inOutCubic],
  [176, 13, E.linear], // micropausa: leitura de TRÁFEGO.
  [184, 340, E.inCubic],
  [197, 340, E.linear],
  [212, 0, E.outCubic], // chega ao hub
  [300, 0, E.linear],
];
const STEP = 0.05;
const T_START = FLY_T1;
const T_END = 320;
const TABLE: number[] = (() => {
  const out: number[] = [];
  let z = FLY_Z1;
  for (let tt = T_START; tt <= T_END + STEP; tt += STEP) {
    out.push(z);
    z += track(tt + STEP / 2, V_KEYS) * STEP;
  }
  return out;
})();

export const flyZ = (t: number) => {
  if (t <= FLY_T0) return 0;
  if (t <= FLY_T1) return FLY_Z1 * E.inCubic(prog(t, FLY_T0, FLY_T1));
  const x = (Math.min(t, T_END) - T_START) / STEP;
  const i = Math.floor(x);
  const f = x - i;
  return TABLE[i] + (TABLE[Math.min(i + 1, TABLE.length - 1)] - TABLE[i]) * f;
};

export const Z_HUB = flyZ(212) + Z0;
export const ZW = flyZ(170) + 1750; // plano da palavra TRÁFEGO.

export const HIT_D = 1350; // distância da câmera ao card no instante do clique

// Batidas dos "cliques" (colcheias a 120 BPM ≈ 7,5 frames)
export const HITS: {t: number; id: PieceId; label: string; side: [number, number]}[] = [
  {t: 128, id: 'trafego', label: 'CTR', side: [1, -1]},
  {t: 135.5, id: 'design', label: 'ROAS', side: [-1, 1]},
  {t: 143, id: 'cta', label: 'LEADS', side: [-1, -1]},
  {t: 150.5, id: 'mobileCta', label: 'CONVERSÃO', side: [1, 1]},
];

export type WCard = {key: string; id: PieceId; c: V3; w: number; h: number; rx: number; ry: number; rz: number; hit?: number};

const aspect = aspectOf;

export const corridor = (portrait: boolean): WCard[] => {
  const cards: WCard[] = [];
  const sx = portrait ? 0.62 : 1;
  const sy = portrait ? 1 : 0.6;
  HITS.forEach((h, k) => {
    const z = flyZ(h.t) + HIT_D;
    const w = portrait ? 470 : 600;
    const x = h.side[0] * (portrait ? 230 : 430);
    const y = h.side[1] * (portrait ? 330 : 170);
    cards.push({key: `hit${k}`, id: h.id, c: [x, y, z], w, h: w * aspect(h.id), rx: 0, ry: -h.side[0] * 0.18, rz: 0, hit: k});
  });
  const zStart = flyZ(FLY_T1) + 700;
  const zEnd = Z_HUB - 950;
  let i = 0;
  for (let z = zStart; z < zEnd; ) {
    const after = z > ZW;
    const step = after ? 250 : 420;
    if (HITS.some((h) => Math.abs(flyZ(h.t) + HIT_D - z) < 260) || (z > ZW - 2600 && z < ZW + 1600)) {
      z += step;
      continue;
    }
    const ang = (i * 137.508 * Math.PI) / 180 + 0.6;
    const R = after ? 560 + 300 * rnd(i + 11) : 900 + 260 * rnd(i + 11);
    const x = Math.cos(ang) * R * sx;
    const y = Math.sin(ang) * R * sy;
    const id = LOOP[i % LOOP.length];
    const w = 560 + 180 * rnd(i + 5);
    cards.push({key: `c${i}`, id, c: [x, y, z], w, h: w * aspect(id), rx: (y / R) * 0.25, ry: (-x / R) * 0.35, rz: 0});
    i++;
    z += step;
  }
  return cards;
};

// Hub (convergência do PICO): 6 peças nos vértices de um hexágono.
export const HUB_IDS: PieceId[] = ['hero', 'trafego', 'simbolo', 'cta', 'design', 'mobile'];
export {aspect};
