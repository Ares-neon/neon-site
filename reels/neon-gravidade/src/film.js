/* NEON — "Gravidade" · Reels 9:16 · 1080×1920 · 30 fps · 900 frames
 * Every frame is a pure function of its index: FILM.render(frame).
 * Palette is closed: #000 / #FFF / #39FF14 (plus the untouched official logo and real site pieces).
 * Grid: 120 BPM → 1 beat = 0.5 s = 15 frames.
 */
'use strict';
(() => {
const W = 1080, H = 1920, CX = 540, CY = 960, FPS = 30, F = 1000, FRAMES = 900;
const G = '#39FF14', G_RGB = '57,255,20';
const qs = new URLSearchParams(location.search);
const SCALE = parseFloat(qs.get('scale') || '1');
const cv = document.getElementById('c');
cv.width = Math.round(W * SCALE); cv.height = Math.round(H * SCALE);
const ctx = cv.getContext('2d');

// ---------- math ----------
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = rng(20261020);
const gauss = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const mix = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eInBack = (x, s = 1.9) => (s + 1) * x * x * x - s * x * x;
// damped spring step response, 0 → 1 (f = Hz, z = damping ratio)
function spring(t, f = 1.2, z = .6) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * f;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}

// ---------- assets ----------
const IMG = {};
const CARD = {};
function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
// Real NEON site pieces, framed as cards (no content altered).
function buildCard(img) {
  const CW = 1100, pad = Math.round(CW * .055), iw = CW - pad * 2, ih = Math.round(img.height * iw / img.width);
  const c = document.createElement('canvas'); c.width = CW; c.height = ih + pad * 2;
  const x = c.getContext('2d');
  const r = 34;
  x.beginPath(); x.roundRect(1.5, 1.5, CW - 3, c.height - 3, r);
  x.fillStyle = '#0A0A0A'; x.fill();
  x.save(); x.clip(); x.drawImage(img, pad, pad, iw, ih); x.restore();
  x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.16)'; x.stroke();
  return c;
}

// ---------- text helpers ----------
const SW = (w, s) => `${w} ${s}px Switzer`;
function fit(text, weight, width, ls = -0.012, fam = 'Switzer') {
  ctx.save(); ctx.font = `${weight} 100px ${fam}`; ctx.letterSpacing = (ls * 100) + 'px';
  const m = ctx.measureText(text).width - ls * 100; ctx.restore();
  return 100 * width / m;
}
function textW(text, weight, size, ls = -0.012, fam = 'Switzer') {
  ctx.save(); ctx.font = `${weight} ${size}px ${fam}`; ctx.letterSpacing = (ls * size) + 'px';
  const m = ctx.measureText(text).width - ls * size; ctx.restore(); return m;
}
// draws text with its cap-height visually centred on y
function word(text, size, x, y, o = {}) {
  const { alpha = 1, weight = 800, ls = -0.012, color = '#fff', fam = 'Switzer', align = 'center', stroke = 0 } = o;
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${weight} ${size}px ${fam}`;
  ctx.letterSpacing = (ls * size) + 'px'; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(text).width - ls * size;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  const by = y + size * .355;
  if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = color; } else ctx.fillStyle = color;
  if (size > 300) { // Chromium drops glyphs of very large runs: draw per glyph, keeping kerned advances
    for (let i = 0; i < text.length; i++) {
      const gx = x0 + (i ? ctx.measureText(text.slice(0, i)).width : 0);
      if (gx > W + 50 || gx + size < -50) continue;
      if (stroke) ctx.strokeText(text[i], gx, by); else ctx.fillText(text[i], gx, by);
    }
  } else if (stroke) ctx.strokeText(text, x0, by); else ctx.fillText(text, x0, by);
  ctx.restore();
}
// glyph point cloud in screen space
function sampleText(text, size, x, y, n, step = 3, weight = 800) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x2 = c.getContext('2d');
  x2.font = `${weight} ${size}px Switzer`; x2.letterSpacing = (-0.012 * size) + 'px';
  const w = x2.measureText(text).width + 0.012 * size;
  x2.fillStyle = '#fff'; x2.fillText(text, x - w / 2, y + size * .355);
  const d = x2.getImageData(0, 0, W, H).data, pts = [];
  for (let j = 0; j < H; j += step) for (let i = 0; i < W; i += step) if (d[(j * W + i) * 4 + 3] > 140) pts.push([i, j]);
  const r = rng(text.length * 7919 + size | 0), out = [];
  for (let k = pts.length - 1; k > 0; k--) { const q = (r() * (k + 1)) | 0; [pts[k], pts[q]] = [pts[q], pts[k]]; }
  for (let k = 0; k < n; k++) { const p = pts[k % pts.length]; out.push([p[0] + (r() - .5) * step, p[1] + (r() - .5) * step]); }
  return out;
}

// ---------- drawing primitives ----------
function dot(x, y, r, a = 1) {
  if (r <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
  g.addColorStop(0, `rgba(${G_RGB},.42)`); g.addColorStop(.25, `rgba(${G_RGB},.12)`); g.addColorStop(1, `rgba(${G_RGB},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
  ctx.fillStyle = G; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function ring(x, y, r, a, lw = 2, color = G_RGB) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.strokeStyle = `rgba(${color},${a})`; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
// star / motion-blurred streak. energy-conserving: longer streak → dimmer
function streak(x0, y0, x1, y1, sz, a) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy);
  if (L < sz * .9) {
    ctx.globalAlpha = a;
    if (sz < 1.8) ctx.fillRect(x1 - sz / 2, y1 - sz / 2, sz, sz);
    else { ctx.beginPath(); ctx.arc(x1, y1, sz / 2, 0, 6.2832); ctx.fill(); }
  } else {
    ctx.globalAlpha = a * Math.min(1, Math.sqrt(2.2 * sz / L));
    ctx.lineWidth = sz; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}
function drawCard(c, x, y, w, rot, a) {
  if (a <= 0.01 || w < 2) return;
  const h = w * c.height / c.width;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot);
  ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore();
}

// ---------- camera ----------
function camAt(t) {
  let pitch = 0, roll = 0, dist = 1000;
  if (t >= 2) { const s = spring(t - 2, .32, .95); pitch = 1.05 * s; roll = -.30 * s; dist = 1000 - 380 * eInOutCubic(seg(t, 2, 6.9)); }
  if (t >= 7) { const s = spring(t - 7, .55, .72); pitch = 1.05 + .13 * s; dist = 620 + 430 * s; roll = -.30 + .12 * s - .016 * (t - 7); }
  return { pitch, roll, dist, cp: Math.cos(pitch), sp: Math.sin(pitch), cr: Math.cos(roll), sr: Math.sin(roll) };
}
const P = { x: 0, y: 0, d: 0, s: 0, vx: 0, vy: 0, vz: 0 };
function proj(c, x, y, z, o = P) {
  const y1 = y * c.cp - z * c.sp, z1 = y * c.sp + z * c.cp;
  o.vx = x * c.cr - y1 * c.sr; o.vy = x * c.sr + y1 * c.cr; o.vz = z1;
  o.d = c.dist - z1; o.s = F / o.d; o.x = CX + o.vx * o.s; o.y = CY + o.vy * o.s; return o;
}
function projView(c, vx, vy, vz, o = P) { o.vx = vx; o.vy = vy; o.vz = vz; o.d = c.dist - vz; o.s = F / o.d; o.x = CX + vx * o.s; o.y = CY + vy * o.s; return o; }

// ---------- collapse (13.0–13.75): anticipation, then everything into the core ----------
function implodeK(t) {
  if (t < 13) return 0;
  if (t < 13.14) return -.06 * Math.sin(Math.PI * seg(t, 13, 13.14));
  return eInExpo(seg(t, 13.14, 13.76));
}
const imp = (v, c, k) => c + (v - c) * (1 - k);

// ---------- particles: big bang → MARCA → galaxy ----------
const N = 7000, NTXT = 2600, NPULL = 2700;
const DX = new Float32Array(N), DY = new Float32Array(N), DZ = new Float32Array(N), RM = new Float32Array(N), KK = new Float32Array(N);
const TX = new Float32Array(N), TY = new Float32Array(N), TS = new Float32Array(N);
const AX = new Float32Array(N), AY = new Float32Array(N), AZ = new Float32Array(N);
const GR = new Float32Array(N), GT = new Float32Array(N), GZ = new Float32Array(N), GO = new Float32Array(N), PT = new Float32Array(N);
const SZ = new Float32Array(N), AL = new Float32Array(N);
const KIND = new Uint8Array(N); // 0 text, 1 pulled, 2 far field
function initParticles() {
  R = rng(77);
  for (let i = 0; i < N; i++) {
    KIND[i] = i < NTXT ? 0 : i < NTXT + NPULL ? 1 : 2;
    // explosion direction, biased toward camera
    let x = gauss(), y = gauss(), z = Math.abs(gauss()) * 1.25 + .15; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    if (KIND[i] === 2 && R() < .5) z = -z * .8;
    DX[i] = x; DY[i] = y; DZ[i] = z;
    RM[i] = KIND[i] === 0 ? 260 + 1100 * R() : KIND[i] === 1 ? 500 + 2600 * R() : 1600 + 3600 * R();
    KK[i] = 3.2 + 3.4 * R();
    // galaxy: bulge + two log-spiral arms
    let r, th, gz;
    if (R() < .17) { r = 12 + 150 * Math.pow(R(), 1.4); th = R() * 6.2832; gz = gauss() * 34 * (1 - r / 200); }
    else { r = 80 + 1000 * Math.pow(R(), 1.35); const arm = R() < .5 ? 0 : Math.PI; th = arm + 2.7 * Math.log(r / 70) + gauss() * .26 * (1 + r / 700); gz = gauss() * 10; }
    GR[i] = r; GT[i] = th; GZ[i] = gz; GO[i] = .34 * (230 / (r + 230));
    const big = Math.pow(R(), 7);
    SZ[i] = .8 + big * 2.6 + (KIND[i] === 0 ? .55 : 0); AL[i] = .32 + .62 * R();
  }
  const pts = sampleText('MARCA', fit('MARCA', 800, 830), CX, CY, NTXT, 4);
  for (let i = 0; i < NTXT; i++) { TX[i] = pts[i][0] - CX; TY[i] = pts[i][1] - CY; TS[i] = .84 + .26 * (pts[i][0] / W) + .1 * R(); }
  for (let i = 0; i < N; i++) {
    posA(i, 2.0); AX[i] = Q[0]; AY[i] = Q[1]; AZ[i] = Q[2];
    // gravity pulls nearer matter first
    PT[i] = 2.0 + .85 * clamp(Math.hypot(AX[i], AY[i], AZ[i]) / 3000) + .15 * R();
  }
}
const Q = [0, 0, 0];
function posA(i, t) {
  const u = t - .5; if (u <= 0) { Q[0] = Q[1] = Q[2] = 0; return Q; }
  const e = 1 - Math.exp(-u * KK[i]) + u * .02;
  let x = DX[i] * RM[i] * e, y = DY[i] * RM[i] * e, z = DZ[i] * RM[i] * e;
  if (KIND[i] === 0) { const g = spring(t - TS[i], 1.35, .6); x = mix(x, TX[i], g); y = mix(y, TY[i], g); z = mix(z, 0, g); }
  Q[0] = x; Q[1] = y; Q[2] = z; return Q;
}
function galLocal(i, t, o) {
  let r = GR[i];
  if (t > 7 && t < 9.5) { // gravity wave from the NEON core pushes neighbours outward
    const wr = (t - 7) * 1300; r += 46 * Math.exp(-Math.pow((r - wr) / 70, 2)) * Math.exp(-(t - 7) * 1.4);
  }
  const a = GT[i] + GO[i] * (t - 2);
  o[0] = r * Math.cos(a); o[1] = r * Math.sin(a); o[2] = GZ[i]; return o;
}
const Gtmp = [0, 0, 0];
function posStar(i, t) {
  if (t < 2) return posA(i, t);
  if (KIND[i] === 2) { Q[0] = AX[i]; Q[1] = AY[i]; Q[2] = AZ[i]; return Q; }
  galLocal(i, t, Gtmp);
  const e = spring(t - PT[i], .78, .78);
  if (e <= 0) { Q[0] = AX[i]; Q[1] = AY[i]; Q[2] = AZ[i]; return Q; }
  const ra = Math.hypot(AX[i], AY[i]), aa = Math.atan2(AY[i], AX[i]);
  const rg = Math.hypot(Gtmp[0], Gtmp[1]), ag = Math.atan2(Gtmp[1], Gtmp[0]);
  let d = ag - aa; while (d < .7) d += 6.2832; while (d > .7 + 6.2832) d -= 6.2832; // swirl with the galaxy
  const r = mix(ra, rg, e), a = aa + d * e;
  Q[0] = r * Math.cos(a); Q[1] = r * Math.sin(a); Q[2] = mix(AZ[i], Gtmp[2], e); return Q;
}
function drawStars(t) {
  if (t < .5 || t >= 13.8) return;
  const dt = 1 / 48, c1 = camAt(t), c0 = camAt(t - dt), k1 = implodeK(t), k0 = implodeK(t - dt);
  const p0 = { x: 0, y: 0, d: 0, s: 0 }, p1 = { x: 0, y: 0, d: 0, s: 0 };
  const born = seg(t, .5, .56);
  const txtDim = t < 2 ? mix(1, .18, seg(t, 1.45, 1.6)) : mix(.18, 1, seg(t, 2, 2.1));
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const q1 = posStar(i, t); const x1 = q1[0], y1 = q1[1], z1 = q1[2];
    proj(c1, x1, y1, z1, p1); if (p1.d < 40) continue;
    const q0 = posStar(i, t - dt); proj(c0, q0[0], q0[1], q0[2], p0); if (p0.d < 40) continue;
    let ax = p0.x, ay = p0.y, bx = p1.x, by = p1.y;
    if (k1 !== 0) { ax = imp(ax, CX, k0); ay = imp(ay, CY, k0); bx = imp(bx, CX, k1); by = imp(by, CY, k1); }
    if ((bx < -60 && ax < -60) || (bx > W + 60 && ax > W + 60) || (by < -60 && ay < -60) || (by > H + 60 && ay > H + 60)) continue;
    let a = AL[i] * born * (KIND[i] === 0 ? txtDim : 1);
    if (KIND[i] === 0 && t < 2) a = Math.max(a, .55 * txtDim);
    const sz = SZ[i] * clamp(p1.s, .55, 2.6) * (1 - .5 * Math.max(0, k1));
    streak(ax, ay, bx, by, sz, a);
  }
  ctx.globalAlpha = 1;
}

// ---------- big bang dot (also the loop frame) ----------
function drawBang(t) {
  if (t < .5) {
    const r = 7 - 2.4 * eInOutSine(seg(t, 0, .5));
    const p = seg(t, .08, .48);
    ring(CX, CY, mix(16, 70, eOutCubic(p)), .32 * Math.sin(Math.PI * p), 1.5);
    dot(CX, CY, r);
  } else if (t < .75) {
    const u = seg(t, .5, .75);
    dot(CX, CY, 16 * (1 - eOutCubic(u)), 1 - u);
    ring(CX, CY, 30 + 900 * eOutExpo(u), .55 * (1 - u), 3 * (1 - u) + .5);
    ring(CX, CY, 20 + 520 * eOutExpo(u), .25 * (1 - u), 1, '255,255,255');
  }
}

// ---------- dust: words condensing from the matter of the scene ----------
const ND = 1900;
const SRC = new Uint16Array(ND), T1 = [], T2 = [], T3 = [], ST = new Float32Array(ND * 4);
const TXT = {};
function initDust() {
  R = rng(99);
  for (let i = 0; i < ND; i++) {
    let s; do { s = NTXT + ((R() * (N - NTXT)) | 0); } while (KIND[s] === 2 || GR[s] > 620);
    SRC[i] = s;
  }
  TXT.brand = { text: 'BRANDING.', y: 1430 }; TXT.brand.size = fit(TXT.brand.text, 800, 830);
  TXT.cria = { text: 'CRIATIVIDADE.', y: 1430 }; TXT.cria.size = fit(TXT.cria.text, 800, 840);
  TXT.traf = { text: 'TRÁFEGO', y: 1452 }; TXT.traf.size = fit(TXT.traf.text, 800, 800);
  const a = sampleText(TXT.brand.text, TXT.brand.size, CX, TXT.brand.y, ND, 3);
  const b = sampleText(TXT.cria.text, TXT.cria.size, CX, TXT.cria.y, ND, 3);
  const c = sampleText(TXT.traf.text, TXT.traf.size, CX, TXT.traf.y, ND, 3);
  for (let i = 0; i < ND; i++) {
    T1.push(a[i]); T2.push(b[i]); T3.push(c[i]);
    ST[i * 4] = .22 * a[i][0] / W + .12 * R(); ST[i * 4 + 1] = .2 * b[i][0] / W + .1 * R();
    ST[i * 4 + 2] = .3 * R(); ST[i * 4 + 3] = .22 * c[i][0] / W + .12 * R();
  }
}
function galScreen(i, t, c, o) { const q = posStar(i, t); return proj(c, q[0], q[1], q[2], o); }
function dustPos(i, t, c, o) {
  galScreen(SRC[i], t, c, o);
  let bx = o.x, by = o.y;
  if (o.d < 40) { bx = CX + (o.vx > 0 ? 1 : -1) * 900; by = CY; }
  let x = bx, y = by, e;
  e = spring(t - (2.88 + ST[i * 4]), 1.25, .62); x = mix(x, T1[i][0], e); y = mix(y, T1[i][1], e);
  e = spring(t - (4.7 + ST[i * 4 + 1]), 1.5, .6); x = mix(x, T2[i][0], e); y = mix(y, T2[i][1], e);
  e = spring(t - (6.72 + ST[i * 4 + 2] * .5), 1.4, .8); x = mix(x, bx, e); y = mix(y, by, e);
  e = spring(t - (10.5 + ST[i * 4 + 3]), 1.25, .62); x = mix(x, T3[i][0], e); y = mix(y, T3[i][1], e);
  const k = implodeK(t); if (k) { x = imp(x, CX, k); y = imp(y, CY, k); }
  o.x = x; o.y = y; return o;
}
function crispAlpha(t, a, b) { return seg(t, a - .05, a + .07) * (1 - seg(t, b - .04, b + .04)); }
function dustAlpha(t) {
  const on = Math.max(seg(t, 2.85, 3.05) * (1 - seg(t, 7.0, 7.35)), seg(t, 10.45, 10.65) * (1 - seg(t, 13.7, 13.8)));
  const crisp = Math.max(crispAlpha(t, 3.36, 4.72), crispAlpha(t, 5.14, 6.74), crispAlpha(t, 11.06, 13.0));
  return on * (1 - .94 * crisp);
}
function drawDust(t) {
  const a = dustAlpha(t); if (a <= .005) return;
  const dt = 1 / 48, c1 = camAt(t), c0 = camAt(t - dt), o1 = { ...P }, o0 = { ...P };
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let i = 0; i < ND; i++) {
    dustPos(i, t, c1, o1); dustPos(i, t - dt, c0, o0);
    streak(o0.x, o0.y, o1.x, o1.y, 2.1, a * .92);
  }
  ctx.globalAlpha = 1;
}
function drawCrisp(t) {
  const inert = (t0) => 14 * (1 - spring(t - t0, 2.1, .42));
  let a = crispAlpha(t, 1.5, 2.04);
  if (a > 0) word('MARCA', fit('MARCA', 800, 830) * (1 + .012 * seg(t, 1.5, 2.04)), CX, CY + inert(1.46), { alpha: a });
  a = crispAlpha(t, 3.36, 4.72); if (a > 0) word(TXT.brand.text, TXT.brand.size, CX, TXT.brand.y + inert(3.3), { alpha: a });
  a = crispAlpha(t, 5.14, 6.74); if (a > 0) word(TXT.cria.text, TXT.cria.size, CX, TXT.cria.y + inert(5.08), { alpha: a });
  a = crispAlpha(t, 11.06, 13.0); if (a > 0) word(TXT.traf.text, TXT.traf.size, CX, TXT.traf.y + inert(11.0), { alpha: a });
}

// ---------- formation cards: the bigger stars reveal real NEON pieces ----------
const FORM = [ // [card, disk radius, disk angle, reveal time]
  ['hero', 380, -1.9, 2.55], ['servicos-head', 470, -0.8, 3.3], ['porque-head', 330, -2.7, 4.05],
  ['diag-h1', 500, -1.2, 4.8], ['metodo-head', 420, -2.2, 5.55],
];
function formCardState(k, t, c) {
  const [, r, a0, tr] = FORM[k];
  const a = a0 + .34 * (230 / (r + 230)) * (t - 2);
  proj(c, r * Math.cos(a), r * Math.sin(a), 0);
  const lift = 1000 * eInCubic(seg(t, tr + .1, tr + 1.95));
  const vz = P.vz + lift, d = c.dist - vz;
  return { x: CX + P.vx * F / d, y: CY + P.vy * F / d, d, s: F / d, ok: d > 60 };
}
function drawFormation(t, items) {
  if (t < 2 || t > 10.5) return;
  const c = camAt(t), k = implodeK(t);
  FORM.forEach((f, idx) => {
    const tr = f[3]; if (t < tr - .55 || t > tr + 1.95) return;
    const st = formCardState(idx, t, c); if (!st.ok) return;
    if (t < tr + .1) { // flare: a star swelling before it opens
      const u = seg(t, tr - .55, tr + .1), r = 1.5 + 4.5 * eInCubic(u), L = 8 + 40 * eInCubic(u);
      items.push({ d: st.d, draw: () => {
        ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.x, st.y, r, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = .55 * u; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(st.x - L, st.y); ctx.lineTo(st.x + L, st.y); ctx.moveTo(st.x, st.y - L); ctx.lineTo(st.x, st.y + L); ctx.stroke(); ctx.restore();
      } });
    }
    const pop = spring(t - tr, 1.5, .55); if (pop <= 0) return;
    const w = 330 * st.s * pop;
    const a = (1 - seg(w, 860, 1250)) * clamp(pop * 2) * (1 - seg(t, tr + 1.7, tr + 1.95));
    const rot = (.18 * (1 - spring(t - tr, 1.1, .5))) * (idx % 2 ? -1 : 1) + .03 * Math.sin(t * .9 + idx);
    items.push({ d: st.d, draw: () => drawCard(CARD[f[0]], imp(st.x, CX, k), imp(st.y, CY, k), w * (1 - k), rot, a) });
  });
}

// ---------- orbit: symbol as the core, real pieces in inclined orbits ----------
const n3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const RINGS = [
  { R: 560, u: n3(.2, -.98, 0), v: n3(.36, 0, .93), w: .42 },
  { R: 420, u: n3(.97, .24, 0), v: n3(-.05, .2, .98), w: -.5 },
];
const ORBIT = [ // [card, ring, phase, enter time]
  ['servico-1', 0, 0.3, 7.2], ['servico-2', 1, 2.0, 7.4], ['form', 0, 3.4, 7.6],
  ['servico-3', 1, 4.3, 7.8], ['cta', 0, 5.1, 8.0], ['servico-4', 1, 0.2, 8.2],
];
function orbitState(k, t) {
  const [, ri, ph, te] = ORBIT[k], rg = RINGS[ri];
  const e = spring(t - te, .85, .58);
  const R0 = rg.R + 1500 * (1 - e), phi = ph + rg.w * (t - 7) - 1.5 * (1 - e) * Math.sign(rg.w);
  const cs = Math.cos(phi) * R0, sn = Math.sin(phi) * R0;
  return { vx: cs * rg.u[0] + sn * rg.v[0], vy: cs * rg.u[1] + sn * rg.v[1], vz: cs * rg.u[2] + sn * rg.v[2], e, R: rg.R };
}
const ORB_P = [];
function drawOrbit(t, items) {
  ORB_P.length = 0;
  if (t < 7 || t >= 13.8) return;
  const c = camAt(t), k = implodeK(t);
  // symbol
  const s = spring(t - 7.02, 1.5, .42) * (1 - eInExpo(seg(t, 13.3, 13.78)));
  if (s > 0) items.push({ d: c.dist, draw: () => {
    const h = 345 * s * (1 + .012 * Math.sin((t - 7) * 3.1416 * 2)), w = h * IMG.symbol.width / IMG.symbol.height;
    ctx.drawImage(IMG.symbol, CX - w / 2, CY - h / 2, w, h);
  } });
  ORBIT.forEach((o, idx) => {
    if (t < o[3]) return;
    const st = orbitState(idx, t); projView(c, st.vx, st.vy, st.vz);
    if (P.d < 60) return;
    const x = imp(P.x, CX, k), y = imp(P.y, CY, k), sc = P.s;
    const depthA = .5 + .5 * clamp((st.vz + st.R) / (2 * st.R));
    const w = 330 * sc * (1 - Math.max(0, k));
    const rot = .32 * (1 - st.e) * (idx % 2 ? 1 : -1) + .05 * Math.sin(t * 1.3 + idx * 1.7);
    ORB_P[idx] = { x, y, w, d: P.d };
    items.push({ d: P.d, draw: () => drawCard(CARD[o[0]], x, y, w, rot, depthA) });
  });
}
function drawCore(t) { // green gravity source while the galaxy forms
  if (t < 2 || t > 7.3) return;
  const c = camAt(t);
  const a = seg(t, 2, 2.15) * (1 - seg(t, 7.0, 7.3));
  dot(CX, CY, 3.6 + 1.2 * Math.sin((t - 2) * 6.2832 * 2) * .3, a);
  // gravity wave at 2.0 drawn in the disk plane
  const u = seg(t, 2, 2.9); if (u > 0 && u < 1) diskRing(c, 40 + 1100 * eOutCubic(u), .4 * (1 - u), 1.5);
}
function diskRing(c, r, a, lw) {
  ctx.save(); ctx.strokeStyle = `rgba(${G_RGB},${a})`; ctx.lineWidth = lw; ctx.beginPath();
  for (let j = 0; j <= 96; j++) { const an = j / 96 * 6.2832; proj(c, r * Math.cos(an), r * Math.sin(an), 0); if (j) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); }
  ctx.stroke(); ctx.restore();
}
function drawCoreGlow(t) { // long-exposure core luminance (white, very low)
  if (t < 2.2 || t > 13.8) return;
  const k = Math.max(0, implodeK(t)), a = .11 * seg(t, 2.2, 4) * (1 - k);
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 300);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(CX - 300, CY - 300, 600, 600);
}
function drawSymbolPulse(t) {
  if (t < 7 || t > 8.4) return;
  const c = camAt(t), u = seg(t, 7, 8.4);
  diskRing(c, (t - 7) * 1300, .55 * (1 - u), 2.2 * (1 - u) + .6);
  const f = seg(t, 7, 7.25); dot(CX, CY, 10 * (1 - f), 1 - f);
}

// ---------- constellations: pieces ↔ performance signals (no numbers) ----------
const NODES = [
  { id: 'CTR', x: 236, y: 500, side: 1 }, { id: 'ROAS', x: 858, y: 590, side: -1 },
  { id: 'LEADS', x: 222, y: 1230, side: 1 }, { id: 'CONVERSÃO', x: 860, y: 1312, side: -1 },
];
const LINKS = [ // [orbit card idx | -1, node a, node b, start]
  [0, 0, -1, 9.0], [2, 1, -1, 9.5], [3, 2, -1, 10.0], [4, 3, -1, 10.5],
  [-1, 0, 1, 11.0], [-1, 2, 3, 11.25], [-1, 1, 3, 11.5], [1, 0, -1, 11.75],
];
const CONST_STARS = [];
function nodePos(n, t, k) {
  const x = n.x + 7 * Math.sin(t * .7 + n.y), y = n.y + 5 * Math.cos(t * .6 + n.x);
  return [imp(x, CX, k), imp(y, CY, k)];
}
function drawConstellationLines(t) {
  if (t < 9 || t >= 13.8) return;
  const k = implodeK(t), fade = 1 - seg(t, 13.5, 13.76);
  // background star constellation: matter getting connected
  const c = camAt(t), o = { ...P };
  ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#fff';
  for (let j = 0; j < CONST_STARS.length - 1; j++) {
    if (CONST_STARS[j + 1] < 0 || CONST_STARS[j] < 0) continue;
    const g = seg(t, 9.1 + j * .07, 9.4 + j * .07); if (g <= 0) continue;
    galScreen(CONST_STARS[j], t, c, o); const ax = imp(o.x, CX, k), ay = imp(o.y, CY, k);
    galScreen(CONST_STARS[j + 1], t, c, o); const bx = imp(o.x, CX, k), by = imp(o.y, CY, k);
    ctx.globalAlpha = .26 * fade; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mix(ax, bx, g), mix(ay, by, g)); ctx.stroke();
    ctx.globalAlpha = .7 * fade; ctx.fillStyle = '#fff'; ctx.fillRect(ax - 1.5, ay - 1.5, 3, 3);
  }
  LINKS.forEach(([ci, na, nb, t0]) => {
    const g = eOutCubic(seg(t, t0, t0 + .3)); if (g <= 0) return;
    const [x1, y1] = nodePos(NODES[na], t, k);
    let x0, y0;
    if (ci >= 0) { const p = ORB_P[ci]; if (!p) return; x0 = p.x; y0 = p.y; } else [x0, y0] = nodePos(NODES[nb], t, k);
    ctx.globalAlpha = (ci >= 0 ? .62 : .32) * fade; ctx.lineWidth = ci >= 0 ? 1.4 : 1;
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(mix(x0, x1, g), mix(y0, y1, g)); ctx.stroke();
    // energy pulse travelling to the signal
    const pu = seg(t, t0 + .12, t0 + .42);
    if (pu > 0 && pu < 1) { ctx.globalAlpha = fade; dot(mix(x0, x1, eInOutCubic(pu)), mix(y0, y1, eInOutCubic(pu)), 3.2, 1); }
  });
  ctx.restore();
}
function drawNodes(t) {
  if (t < 8.9 || t >= 13.8) return;
  const k = implodeK(t), fade = 1 - seg(t, 13.3, 13.7);
  NODES.forEach((n, i) => {
    const t0 = LINKS.find(l => l[1] === i && l[0] >= 0)[3];
    const on = seg(t, t0 + .38, t0 + .45); const pre = seg(t, 8.9 + i * .08, 9.2 + i * .08);
    const [x, y] = nodePos(n, t, k);
    ctx.save(); ctx.globalAlpha = pre * fade;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill(); ctx.restore();
    if (on > 0) {
      const hit = 1 - seg(t, t0 + .42, t0 + 1.0);
      ring(x, y, 7 + 26 * (1 - hit), .7 * hit * fade, 1.5);
      if (hit > 0) dot(x, y, 2.6, hit * fade);
      // label: letters arrive with a short stagger
      const L = n.id, size = 30;
      ctx.save(); ctx.font = `600 ${size}px Inter`; ctx.letterSpacing = (.2 * size) + 'px'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      const full = ctx.measureText(L).width;
      let cx = n.side > 0 ? x + 22 : x - 22 - full;
      for (let j = 0; j < L.length; j++) {
        const la = seg(t, t0 + .42 + j * .025, t0 + .5 + j * .025) * fade;
        ctx.globalAlpha = la; ctx.fillText(L[j], cx, y + 1 + 6 * (1 - la));
        cx += ctx.measureText(L[j]).width + .2 * size;
      }
      ctx.restore();
    }
  });
}

// ---------- collapse → silence → charge ----------
function drawCollapseDot(t) {
  if (t < 13.3 || t >= 15.05) return;
  if (t < 13.76) { dot(CX, CY, 7 * seg(t, 13.4, 13.76), 1); return; }
  if (t < 14.4) { dot(CX, CY, 7); return; } // micro-silence: only the point
  const u = seg(t, 14.4, 15.0);
  ring(CX, CY, mix(140, 10, eInCubic(u)), .45 * eInCubic(u), 1.2);
  dot(CX, CY, 7 - 2.6 * eInBack(u, 1.2) * (u < .9 ? 1 : 1));
}

// ---------- hyperspace ----------
const NW = 1500, WA = new Float32Array(NW), WR = new Float32Array(NW), WZ = new Float32Array(NW), WG = new Uint8Array(NW), WY = new Float32Array(NW), WL = new Float32Array(NW);
function initWarp() {
  R = rng(4242);
  for (let i = 0; i < NW; i++) { WA[i] = R() * 6.2832; WR[i] = 40 + 1100 * Math.pow(R(), .7); WZ[i] = R() * 3000; WG[i] = R() < .035 ? 1 : 0; WY[i] = R() * (H + 700); WL[i] = 120 + 420 * Math.pow(R(), 1.5); }
}
const Sdist = u => u <= 0 ? 0 : 3200 * u - 1067 * (1 - Math.exp(-3 * u));
const Svel = u => u <= 0 ? 0 : 3200 * (1 - Math.exp(-3 * u));
// growth line: stepped, ascending, with dips
const GP = [];
(function initGrowth() {
  const r = rng(5); let x = 540, y = 1760; GP.push([x, y]);
  for (let k = 0; k < 6; k++) {
    x = 540 + (k % 2 ? 1 : -1) * (70 + 50 * r()); y -= 400 + 30 * r(); GP.push([x, y]);
    x += (k % 2 ? -1 : 1) * (40 + 20 * r()); y += 75 + 20 * r(); GP.push([x, y]);
  }
  GP.push([540, y - 2600]);
})();
function growthHead(t) {
  let h = 0; for (let k = 0; k < 6; k++) h += 2 * spring(t - (17.5 + k * .5), 2.3, .55);
  h += eInExpo(seg(t, 20.5, 21.0));
  return Math.min(h, GP.length - 1);
}
function ptAt(h) { const i = Math.min(Math.floor(h), GP.length - 2), f = h - i; return [mix(GP[i][0], GP[i + 1][0], f), mix(GP[i][1], GP[i + 1][1], f)]; }
function scrollAt(t) { const tt = Math.min(t, 20.5); const hy = ptAt(growthHead(tt))[1]; return Math.max(0, 600 - hy); }
function warpSeg(i, t, dt) { // radial streak head/tail at time t
  const u = t - 15, S = Sdist(u), v = Svel(u);
  let z = ((WZ[i] - S) % 3000 + 3000) % 3000 + 15;
  const len = 8 + v * .07;
  const sx = Math.cos(WA[i]) * WR[i], sy = Math.sin(WA[i]) * WR[i];
  return [CX + sx * F / z, CY + sy * F / z, CX + sx * F / (z + len), CY + sy * F / (z + len), z];
}
function drawWarp(t) {
  if (t < 15 || t >= 21.6) return;
  const e = eInOutCubic(seg(t, 17.0, 17.9)), born = seg(t, 15, 15.12);
  const sc = scrollAt(t), conv = 1 - .6 * eInOutCubic(seg(t, 17.9, 21));
  const out = 1 - seg(t, 21.0, 21.5);
  ctx.lineCap = 'round';
  for (let i = 0; i < NW; i++) {
    let hx, hy, tx, ty, a, lw;
    const w = e < 1 ? warpSeg(i, t) : null;
    if (w) { a = Math.pow(1 - w[4] / 3015, 1.4) * born; lw = clamp(.6 + 1800 / w[4] * .9, .6, 3.2); }
    if (e > 0) {
      const x = CX + clamp(Math.cos(WA[i]) * WR[i] * .55, -560, 560) * conv;
      const yy = ((WY[i] + 2400 * Math.max(0, t - 17) + sc * 1.6) % (H + 700) + (H + 700)) % (H + 700) - 350;
      const vh = [x, yy + WL[i], x, yy];
      if (w) { hx = mix(w[0], vh[0], e); hy = mix(w[1], vh[1], e); tx = mix(w[2], vh[2], e); ty = mix(w[3], vh[3], e); a = mix(a, .4, e); lw = mix(lw, 1.3, e); }
      else { [hx, hy, tx, ty] = vh; a = .4; lw = 1.3; }
    } else [hx, hy, tx, ty] = w;
    a *= out; if (a <= .01) continue;
    ctx.strokeStyle = WG[i] ? G : '#fff'; ctx.globalAlpha = WG[i] ? Math.min(1, a * 1.3) : a; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // release burst
  const r = seg(t, 15, 15.45); if (r < 1) { ring(CX, CY, 10 + 700 * eOutExpo(r), .6 * (1 - r), 3 * (1 - r) + .5); dot(CX, CY, 7 + 10 * (1 - r) * (r > 0 ? 1 : 0), 1 - r); }
  if (t < 17.4) dot(CX, CY, 2.5, .8 * (1 - seg(t, 16.9, 17.4))); // vanishing point keeps the energy
}
function drawGrowth(t) {
  if (t < 17.45 || t > 21.2) return;
  const h = growthHead(t), sc = scrollAt(t);
  const head = ptAt(h);
  ctx.save(); ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath();
  ctx.moveTo(GP[0][0], GP[0][1] + sc);
  for (let i = 1; i <= Math.floor(h); i++) ctx.lineTo(GP[i][0], GP[i][1] + sc);
  ctx.lineTo(head[0], head[1] + sc); ctx.stroke();
  // energized tip
  const tail = ptAt(Math.max(0, h - .45));
  ctx.strokeStyle = G; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tail[0], tail[1] + sc); ctx.lineTo(head[0], head[1] + sc); ctx.stroke();
  ctx.restore();
  // vertices as data points
  ctx.fillStyle = '#fff';
  for (let i = 1; i <= Math.floor(h); i++) { ctx.fillRect(GP[i][0] - 5, GP[i][1] + sc - 5, 10, 10); }
  dot(head[0], head[1] + sc, 8);
}
function drawHyperWords(t) {
  if (t < 17.5 || t >= 21) return;
  const cut = Math.floor((t - 17.5) / .5); // a cut on every beat
  const isA = cut < 3, txt = isA ? 'ATENÇÃO.' : 'DESEJO.';
  const size = fit(txt, 800, 840), local = (t - 17.5) - cut * .5;
  const mode = cut % 3, inert = 22 * (1 - spring(local, 2.6, .5));
  if (cut === 6) word(txt, size, CX, 1240 + inert - 1500 * eInExpo(seg(local, .1, .5)), {}); // leaves with the rising line
  else if (mode === 0) word(txt, size, CX, 1240 + inert, {});
  else if (mode === 1) { // macro crop: letters bleed off the frame
    const s2 = size * 2.7; word(txt, s2, CX + (isA ? 140 : -60) - 40 * local, CY + inert * .5, {});
  } else {
    word(txt, size, CX, 700 - inert, {});
  }
}

// ---------- supernova ----------
const SUP = {};
const NSH = 900, SHX = new Float32Array(NSH), SHV = new Float32Array(NSH), SHU = new Float32Array(NSH), SHG = new Uint8Array(NSH);
const TEAR = [];
const SUPCARDS = ['metodo-1', 'metodo-2', 'metodo-3', 'metodo-4', 'hero', 'porque'];
function initSupernova() {
  SUP.size = fit('PERFORMANCE', 800, 1046);
  SUP.w = textW('PERFORMANCE', 800, SUP.size);
  R = rng(31337);
  for (let i = 0; i < NSH; i++) { SHX[i] = R() * W; SHV[i] = (R() < .5 ? -1 : 1) * (300 + 2600 * Math.pow(R(), 1.6)); SHU[i] = (R() - .5) * 900; SHG[i] = R() < .06 ? 1 : 0; }
  for (let x = -20; x <= W + 20; x += 36) TEAR.push([x, (R() - .5) * 34]);
}
function perfWord(t, m, u, yOff, clipTop, clipBot, dx) {
  ctx.save(); ctx.beginPath(); ctx.rect(-50, clipTop, W + 100, clipBot - clipTop); ctx.clip();
  const s = SUP.size * m, w = SUP.w * m;
  word('PERFORMANCE', s, CX + dx + w * (.5 - u), CY + yOff, {});
  ctx.restore();
}
function drawSupernova(t) {
  if (t < 21 || t >= 24) return;
  // camera: macro pan across the giant word, then spring back to the full word
  let m, u;
  if (t < 21.8) { m = 3.7; u = mix(.08, .9, eInOutCubic(seg(t, 21, 21.8))); }
  else { const s = spring(t - 21.8, 1.3, .55); m = 1 + 2.7 * (1 - s); u = mix(.9, .5, s); }
  const tear = seg(t, 22.75, 22.88), split = spring(t - 22.8, 2.2, .35);
  const boom = eInExpo(seg(t, 23.25, 23.95));
  // editorial repetition fills the frame
  const rowsA = seg(t, 21.85, 22.3) * (1 - seg(t, 23.2, 23.6));
  if (rowsA > 0) for (let k = 1; k <= 5; k++) for (const sg of [-1, 1]) {
    const ap = seg(t, 21.85 + k * .05, 22.1 + k * .05) * rowsA, jol = split > 0 ? 18 * Math.sin((t - 22.8) * 30) * Math.exp(-(t - 22.8) * 5) : 0;
    const y = CY + sg * k * 196 + sg * boom * 900 * k / 5;
    const dir = (k + (sg > 0 ? 1 : 0)) % 2 ? 1 : -1;
    word('PERFORMANCE', SUP.size * 1.38, CX + dir * (120 - 260 * (t - 21.8)) + jol * dir, y, { stroke: 1.6, alpha: ap * (.34 - k * .04) });
  }
  // converging pieces + constellation
  const conv = spring(t - 21.5, 1.1, .7);
  SUPCARDS.forEach((name, i) => {
    const an = i / SUPCARDS.length * 6.2832 + .5 + .25 * (t - 21.5);
    const r = mix(1300, 410, conv) + boom * 1700;
    const x = CX + Math.cos(an) * r * .78, y = CY + Math.sin(an) * r * 1.35;
    const shake = split > 0 ? 10 * Math.sin((t - 22.8) * 40 + i) * Math.exp(-(t - 22.8) * 6) : 0;
    if (t > 22.3 && boom < .3) {
      const g = seg(t, 22.3 + i * .04, 22.5 + i * .04);
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.globalAlpha = .4 * (1 - boom * 3); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mix(x, CX, g), mix(y, CY, g)); ctx.stroke(); ctx.restore();
    }
    drawCard(CARD[name], x + shake, y, 250 * (1 + boom * .8), .3 * Math.sin(an * 2) + shake * .01, clamp(conv * 1.4) * .9);
  });
  // the word: whole, then torn by the pulse
  if (tear <= 0) perfWord(t, m, u, 0, -10, H + 10, 0);
  else {
    const off = 64 * split;
    perfWord(t, m, u, -off * .4 - boom * 1500, -10, CY, -off);
    perfWord(t, m, u, off * .4 + boom * 1500, CY, H + 10, off);
  }
  // the tear: jagged pulse line, left → right
  if (tear > 0 && boom < 1) {
    const xmax = mix(-20, W + 20, tear), a = 1 - seg(t, 23.3, 23.7);
    ctx.save(); ctx.strokeStyle = G; ctx.lineWidth = 3 + 6 * seg(t, 23.1, 23.3) * (1 - boom); ctx.globalAlpha = a; ctx.beginPath();
    TEAR.forEach(([x, y], i) => { if (x > xmax) return; const yy = CY + y * (1 + 2 * split); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
    ctx.stroke(); ctx.restore();
  }
  // shards burst out of the tear
  if (t > 23.2) {
    const v = t - 23.2, out = 1 - seg(t, 23.75, 23.97);
    ctx.lineCap = 'round';
    for (let i = 0; i < NSH; i++) {
      const s1 = (1 - Math.exp(-v * 2.4)) / 2.4, s0 = (1 - Math.exp(-(v - .03) * 2.4)) / 2.4;
      const y1 = CY + SHV[i] * s1, y0 = CY + SHV[i] * Math.max(0, s0), x1 = SHX[i] + SHU[i] * s1, x0 = SHX[i] + SHU[i] * Math.max(0, s0);
      ctx.strokeStyle = SHG[i] ? G : '#fff'; ctx.globalAlpha = out * .85; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- silence + resolution ----------
const RES = {};
const NG2 = 1500, G2R = new Float32Array(NG2), G2T = new Float32Array(NG2), G2Z = new Float32Array(NG2), G2S = new Float32Array(NG2), G2A = new Float32Array(NG2);
function initResolution() {
  RES.size = fit('RESULTADO', 800, 760); RES.w = textW('RESULTADO', 800, RES.size);
  RES.letters = []; let x = CX - RES.w / 2 - textW('.', 800, RES.size) / 2;
  ctx.save(); ctx.font = SW(800, RES.size); ctx.letterSpacing = (-.012 * RES.size) + 'px';
  for (const ch of 'RESULTADO') { const lw = ctx.measureText(ch).width; RES.letters.push({ ch, x: x + lw / 2 }); x += lw; }
  RES.dotW = ctx.measureText('.').width; ctx.restore();
  RES.dotX = x + RES.dotW * .5; RES.dotY = CY + RES.size * .355 - RES.size * .065; RES.dotR = RES.size * .068;
  RES.tag = 'SUA MARCA EM ÓRBITA.'; RES.tagSize = fit(RES.tag, 800, 820);
  R = rng(2026);
  for (let i = 0; i < NG2; i++) {
    const bul = R() < .2, r = bul ? 6 + 60 * R() : 40 + 440 * Math.pow(R(), 1.2);
    G2R[i] = r; G2T[i] = bul ? R() * 6.28 : (R() < .5 ? 0 : Math.PI) + 2.4 * Math.log(r / 40) + gauss() * .3; G2Z[i] = gauss() * 6; G2S[i] = .7 + Math.pow(R(), 6) * 1.8; G2A[i] = .25 + .45 * R();
  }
}
const LOCK = { y: 742, s: .6 };
function endK(t) { return eInExpo(seg(t, 29.58, 29.9)); }
function drawSilence(t) {
  if (t < 24.25 || t >= 26.7) return;
  const lin = 12 * (1 - spring(t - 24.25, 2.4, .5));
  // letters pulled into the point (26.0–26.6), nearest first
  RES.letters.forEach((L, i) => {
    const st = 26.0 + (RES.letters.length - 1 - i) * .045, u = seg(t, st, st + .32);
    const k = eInBack(u, 1.6), x = mix(L.x, RES.dotX, clamp(k, -1, 1)), y = mix(CY + lin, RES.dotY, clamp(k, -1, 1));
    if (u >= 1) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1 - u, 1 - u); word(L.ch, RES.size, 0, 0, { ls: 0 }); ctx.restore();
  });
}
function ignite(t) { // neon tube ignition on frames 750–756
  const f = Math.round(t * FPS);
  if (f < 750) return 0;
  if (f >= 757) return 1;
  return [1, 1, 0, 1, 0, 0, 1][f - 750];
}
function periodState(t) {
  const u = spring(t - 26.25, .9, .78);
  const x = mix(RES.dotX, CX, u), y = mix(RES.dotY, CY, u) - Math.sin(Math.PI * clamp(u)) * 90;
  const r = mix(RES.dotR, 5, clamp(u));
  return { x, y, r };
}
function drawPeriod(t) {
  if (t < 24.25 || t >= 29.9) return;
  const ig = ignite(t), p = periodState(t);
  if (t < 26.0) {
    ctx.save(); ctx.font = SW(800, RES.size); ctx.letterSpacing = (-.012 * RES.size) + 'px'; ctx.textBaseline = 'alphabetic';
    const lin = 12 * (1 - spring(t - 24.25, 2.4, .5));
    ctx.fillStyle = ig ? G : '#fff';
    if (ig) { ctx.shadowColor = `rgba(${G_RGB},.8)`; ctx.shadowBlur = 28; }
    ctx.fillText('.', RES.dotX - RES.dotW / 2, CY + RES.size * .355 + lin); ctx.restore();
    return;
  }
  const k = endK(t);
  dot(p.x, p.y + 0, mix(p.r, 7, seg(t, 29.6, 29.9)) , 1);
  void k;
}
function drawMiniGalaxy(t) {
  if (t < 26.3 || t >= 29.93) return;
  const bloom = spring(t - 26.45, .7, .8), k = endK(t), p = periodState(t);
  const c = { pitch: 1.2, roll: -.2, dist: 1000 }; c.cp = Math.cos(c.pitch); c.sp = Math.sin(c.pitch); c.cr = Math.cos(c.roll); c.sr = Math.sin(c.roll);
  const o = { ...P };
  ctx.fillStyle = '#fff';
  for (let i = 0; i < NG2; i++) {
    const a = G2T[i] + .16 * (300 / (G2R[i] + 300)) * (t - 26.3), r = G2R[i] * bloom;
    proj(c, r * Math.cos(a), r * Math.sin(a), G2Z[i], o);
    let x = o.x - CX + p.x, y = o.y - CY + p.y;
    x = imp(x, CX, k); y = imp(y, CY, k);
    // keep the lockup readable: stars dim behind the type
    const inText = Math.abs(y - LOCK.y) < 190 || Math.abs(y - 1050) < 30 || Math.abs(y - 1185) < 55 || Math.abs(y - 1310) < 30;
    ctx.globalAlpha = G2A[i] * clamp(bloom) * (inText ? .3 : 1) * (1 - k * .4);
    const s = G2S[i] * (1 - k * .5); ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}
function drawLockup(t) {
  if (t < 26.6 || t >= 29.9) return;
  const k = endK(t);
  ctx.save();
  if (k > 0) { ctx.translate(CX, CY); ctx.scale(1 - k, 1 - k); ctx.translate(-CX, -CY); ctx.globalAlpha = 1 - k * .6; }
  const e = spring(t - 26.65, 1.6, .62);
  if (e > 0) {
    const s = LOCK.s * mix(.9, 1, e), w = IMG.lockup.width * s, h = IMG.lockup.height * s;
    ctx.save(); ctx.globalAlpha *= clamp(e * 1.6); ctx.drawImage(IMG.lockup, CX - w / 2, LOCK.y - h / 2 + 20 * (1 - e), w, h); ctx.restore();
  }
  const line = (t0, fn) => { const q = spring(t - t0, 2, .6); if (q <= 0) return; ctx.save(); ctx.globalAlpha *= clamp(q * 1.5); ctx.translate(0, 18 * (1 - q)); fn(); ctx.restore(); };
  line(26.85, () => word('Branding & Performance', 36, CX, 1050, { weight: 500, fam: 'Inter', ls: .02, alpha: .82 }));
  line(26.98, () => word(RES.tag, RES.tagSize, CX, 1185, {}));
  line(27.1, () => word('@NEONCREATES', 33, CX, 1310, { weight: 600, fam: 'Inter', ls: .2, color: G }));
  ctx.restore();
}
function drawLoopDot(t) { if (t >= 29.9) dot(CX, CY, 7); }

// ---------- grain ----------
const GRAIN = [];
function initGrain() {
  const r = rng(11);
  for (let g = 0; g < 4; g++) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const im = x.createImageData(W, H), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 120; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    x.putImageData(im, 0, 0); GRAIN.push(c);
  }
}

// ---------- frame ----------
function render(frame) {
  const t = frame / FPS;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  if (t < 15) {
    drawCoreGlow(t);
    drawStars(t);
    drawCore(t);
    drawSymbolPulse(t);
    drawConstellationLines(t);
    const items = [];
    drawFormation(t, items); drawOrbit(t, items);
    items.sort((a, b) => b.d - a.d).forEach(it => it.draw());
    drawNodes(t);
    drawDust(t);
    drawCrisp(t);
    drawBang(t);
    drawCollapseDot(t);
  } else if (t < 24) {
    drawWarp(t); drawGrowth(t); drawHyperWords(t); drawSupernova(t);
  } else {
    drawMiniGalaxy(t); drawSilence(t); drawLockup(t); drawPeriod(t); drawLoopDot(t);
  }
  // fine grain (overlay keeps true black black)
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .09;
  ctx.drawImage(GRAIN[frame === FRAMES - 1 ? 0 : frame % 4], 0, 0, W, H); // last frame = first frame (loop)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const hud = document.getElementById('hud'); if (hud) hud.textContent = qs.get('hud') ? `f${frame} · ${t.toFixed(2)}s` : '';
}

// ---------- boot ----------
const CARD_NAMES = ['hero', 'servicos-head', 'porque-head', 'diag-h1', 'metodo-head', 'servico-1', 'servico-2', 'servico-3', 'servico-4', 'form', 'cta', 'metodo-1', 'metodo-2', 'metodo-3', 'metodo-4', 'porque'];
const ready = (async () => {
  await Promise.all(['600', '700', '800'].map(w => document.fonts.load(`${w} 80px Switzer`)).concat([document.fonts.load('500 40px Inter'), document.fonts.load('600 40px Inter')]));
  IMG.symbol = await loadImg('../assets/brand/neon-symbol.png');
  IMG.lockup = await loadImg('../assets/brand/neon-lockup.png');
  await Promise.all(CARD_NAMES.map(async n => { CARD[n] = buildCard(await loadImg(`../assets/cards/${n}.png`)); }));
  initParticles(); initDust(); initWarp(); initSupernova(); initResolution(); initGrain();
  // constellation path through bright disk stars
  for (let i = NTXT, n = 0; i < N && n < 16; i++) if (KIND[i] === 1 && SZ[i] > 1.6 && GR[i] > 200 && GR[i] < 560) { CONST_STARS.push(i); n++; }
  render(+(qs.get('frame') || 0));
})();
window.FILM = { ready, render, FRAMES, FPS, W, H };
})();
