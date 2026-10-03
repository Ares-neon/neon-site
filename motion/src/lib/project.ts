// Câmera 3D própria (pinhole) + homografia para planos (cards) via matrix3d.
// Convenção: x para a direita, y para baixo, z para dentro da tela.

export type V3 = [number, number, number];
export type Cam = {x: number; y: number; z: number; rx: number; ry: number; rz: number; f: number; cx: number; cy: number};
export type P2 = {x: number; y: number; z: number};

export const rotate = (p: V3, rx: number, ry: number, rz: number): V3 => {
  let [x, y, z] = p;
  // roll (z)
  let c = Math.cos(rz), s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  // pitch (x)
  c = Math.cos(rx); s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  // yaw (y)
  c = Math.cos(ry); s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
};

export const toCam = (c: Cam, p: V3): V3 => {
  let x = p[0] - c.x, y = p[1] - c.y, z = p[2] - c.z;
  // inverso de yaw
  let cs = Math.cos(-c.ry), sn = Math.sin(-c.ry);
  [x, z] = [x * cs + z * sn, -x * sn + z * cs];
  // inverso de pitch
  cs = Math.cos(-c.rx); sn = Math.sin(-c.rx);
  [y, z] = [y * cs - z * sn, y * sn + z * cs];
  // inverso de roll
  cs = Math.cos(-c.rz); sn = Math.sin(-c.rz);
  [x, y] = [x * cs - y * sn, x * sn + y * cs];
  return [x, y, z];
};

export const NEAR = 40;

export const proj = (c: Cam, p: V3): P2 => {
  const q = toCam(c, p);
  const z = Math.max(q[2], 1e-3);
  return {x: c.cx + (c.f * q[0]) / z, y: c.cy + (c.f * q[1]) / z, z: q[2]};
};

/** Segmento projetado com recorte no plano próximo. */
export const projSeg = (c: Cam, a: V3, b: V3): [P2, P2] | null => {
  let qa = toCam(c, a), qb = toCam(c, b);
  if (qa[2] < NEAR && qb[2] < NEAR) return null;
  if (qa[2] < NEAR) {
    const k = (NEAR - qa[2]) / (qb[2] - qa[2]);
    qa = [qa[0] + (qb[0] - qa[0]) * k, qa[1] + (qb[1] - qa[1]) * k, NEAR];
  } else if (qb[2] < NEAR) {
    const k = (NEAR - qb[2]) / (qa[2] - qb[2]);
    qb = [qb[0] + (qa[0] - qb[0]) * k, qb[1] + (qa[1] - qb[1]) * k, NEAR];
  }
  const pa = {x: c.cx + (c.f * qa[0]) / qa[2], y: c.cy + (c.f * qa[1]) / qa[2], z: qa[2]};
  const pb = {x: c.cx + (c.f * qb[0]) / qb[2], y: c.cy + (c.f * qb[1]) / qb[2], z: qb[2]};
  return [pa, pb];
};

/** Cantos de um plano (centro, tamanho, rotação própria) no mundo. Ordem: TL, TR, BR, BL. */
export const planeCorners = (center: V3, w: number, h: number, rx = 0, ry = 0, rz = 0): V3[] => {
  const loc: V3[] = [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]];
  return loc.map((p) => {
    const r = rotate(p, rx, ry, rz);
    return [r[0] + center[0], r[1] + center[1], r[2] + center[2]] as V3;
  });
};

/** matrix3d que leva um elemento w×h (origin 0 0) ao quadrilátero q (TL, TR, BR, BL). */
export const quadMatrix = (w: number, h: number, q: {x: number; y: number}[]) => {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let a, b, c, d, e, f, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = p1.x - p0.x; b = p2.x - p1.x; c = p0.x;
    d = p1.y - p0.y; e = p2.y - p1.y; f = p0.y;
    g = 0; hh = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    hh = (dx1 * dy3 - dx3 * dy1) / det;
    a = p1.x - p0.x + g * p1.x; b = p3.x - p0.x + hh * p3.x; c = p0.x;
    d = p1.y - p0.y + g * p1.y; e = p3.y - p0.y + hh * p3.y; f = p0.y;
  }
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => (Math.abs(v) < 1e-12 ? 0 : v).toFixed(9)).join(',')})`;
};
