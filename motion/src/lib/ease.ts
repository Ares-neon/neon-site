// Curvas de movimento. Tudo é função do quadro (t em frames, 30 fps).

export const FPS = 30;
export const BEAT = 15; // 120 BPM -> 1 batida = 0,5 s = 15 frames

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (t: number, t0: number, t1: number) => (t1 === t0 ? (t >= t1 ? 1 : 0) : clamp((t - t0) / (t1 - t0)));

export type Ease = (x: number) => number;

const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => {
  // Cubic-bezier (mesma definição do CSS), resolvido por Newton + bissecção.
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-6) return sy(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1;
    u = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
};

export const E = {
  linear: ((x) => x) as Ease,
  inOutSine: ((x) => -(Math.cos(Math.PI * x) - 1) / 2) as Ease,
  inQuad: ((x) => x * x) as Ease,
  outQuad: ((x) => 1 - (1 - x) * (1 - x)) as Ease,
  inOutQuad: ((x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)) as Ease,
  inCubic: ((x) => x * x * x) as Ease,
  outCubic: ((x) => 1 - Math.pow(1 - x, 3)) as Ease,
  inOutCubic: ((x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)) as Ease,
  inQuart: ((x) => x * x * x * x) as Ease,
  outQuart: ((x) => 1 - Math.pow(1 - x, 4)) as Ease,
  inOutQuart: ((x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2)) as Ease,
  outQuint: ((x) => 1 - Math.pow(1 - x, 5)) as Ease,
  inQuint: ((x) => x * x * x * x * x) as Ease,
  inExpo: ((x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10))) as Ease,
  outExpo: ((x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))) as Ease,
  inOutExpo: ((x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2) as Ease,
  outBack: (s = 1.70158): Ease => (x) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (s = 1.70158): Ease => (x) => (s + 1) * x * x * x - s * x * x,
  bezier,
  // Curvas "de estúdio": aceleração agressiva e pouso suave.
  snap: bezier(0.7, 0, 0.1, 1),
  whip: bezier(0.85, 0, 0.15, 1),
  land: bezier(0.16, 1, 0.3, 1),
  launch: bezier(0.7, 0, 0.84, 0),
};

/** Interpolação de t0..t1 com easing. */
export const tween = (t: number, t0: number, t1: number, v0: number, v1: number, ease: Ease = E.inOutCubic) =>
  lerp(v0, v1, ease(prog(t, t0, t1)));

export type Key = [number, number, Ease?];
/** Trilha de keyframes: [frame, valor, easing do trecho que termina neste key]. */
export const track = (t: number, keys: Key[]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) return lerp(v0, v1, (e ?? E.inOutCubic)(prog(t, t0, t1)));
  }
  return keys[keys.length - 1][1];
};

/**
 * Mola (oscilador amortecido, solução fechada) de 0 -> 1 a partir de t0.
 * f = frequência natural (Hz), z = razão de amortecimento (z<1 gera overshoot).
 */
export const spring = (t: number, t0: number, {f = 2.5, z = 0.6}: {f?: number; z?: number} = {}) => {
  const s = (t - t0) / FPS;
  if (s <= 0) return 0;
  const w0 = 2 * Math.PI * f;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + ((z * w0) / wd) * Math.sin(wd * s));
  }
  if (z === 1) return 1 - Math.exp(-w0 * s) * (1 + w0 * s);
  const q = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - q), r2 = -w0 * (z + q);
  const A = -r2 / (r2 - r1), B = -1 - A;
  return 1 + A * Math.exp(r1 * s) + B * Math.exp(r2 * s);
};

/** Velocidade (unidades/frame) de uma função do tempo — usada para reações secundárias. */
export const vel = (fn: (t: number) => number, t: number, h = 0.25) => (fn(t + h) - fn(t - h)) / (2 * h);

/** Pseudoaleatório determinístico. */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

export const deg = (d: number) => (d * Math.PI) / 180;
