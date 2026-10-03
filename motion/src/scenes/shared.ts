import {E, prog} from '../lib/ease';
import {fitSize, glyphBox} from '../lib/fonts';
import {wordGeom} from '../lib/svg';

// Constantes compartilhadas entre cenas (continuidade: cada cena nasce do último quadro da anterior).

export const AXIS = {x: 0.5, y: -0.8660254}; // ângulo da marca: 60° (eixo dos traços longos do símbolo)
export const Z0 = 1600; // distância focal / plano frontal (1 unidade = 1 px no plano z = Z0)

export const hookLayout = (W: number, H: number, portrait: boolean) => {
  const cx = W / 2, cy = H / 2;
  const fs = fitSize('MARCA.', portrait ? 900 : 1320, 800, -0.045);
  const g = wordGeom('MARCA.', fs, cx, 'middle', -0.045);
  const pb = glyphBox('.', fs, 800);
  const baseline = cy + g.cap / 2;
  const pLeft = g.x0 + g.xs[5] - pb.left;
  const pSize = pb.right + pb.left;
  const pcx = pLeft + pSize / 2;
  const pcy = baseline - (pb.ascent - pb.descent) / 2;
  return {fs, g, baseline, pcx, pcy, pSize, symH: portrait ? 640 : 560};
};

/** Leve aproximação da palavra MARCA. depois de montada (para no início da onda). */
export const hookPush = (t: number) => 1 + 0.02 * E.outQuad(prog(t, 42, 50));

/** Origem da onda/grade: o ponto final verde de MARCA. (na tela). */
export const originOf = (W: number, H: number, portrait: boolean) => {
  const L = hookLayout(W, H, portrait);
  const p = hookPush(50);
  const cx = W / 2, cy = H / 2;
  return {x: cx + (L.pcx - cx) * p, y: cy + (L.pcy - cy) * p, size: L.pSize * p, push: p};
};

// Onda hexagonal que nasce do ponto e constrói a grade.
export const WAVE_T0 = 50;
export const WAVE_DUR = 10;
export const WAVE_MAX = 2600;
export const waveR = (t: number) => WAVE_MAX * E.outCubic(prog(t, WAVE_T0, WAVE_T0 + WAVE_DUR));
export const waveArrival = (dist: number) => WAVE_T0 + WAVE_DUR * (1 - Math.cbrt(1 - Math.min(dist / WAVE_MAX, 0.999)));

// Câmera do "voo" (fim da CONSTRUÇÃO → ACELERAÇÃO → PICO). z cresce para dentro da tela.
export const FLY_T0 = 110;
export const FLY_T1 = 122;
export const FLY_Z1 = Z0 * 1.35;
