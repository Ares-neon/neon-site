import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PIECES} from '../brand/pieces';
import {a, C, FONT} from '../brand/tokens';
import {Card} from '../lib/Card';
import {clamp, deg, E, prog, rnd, spring, track} from '../lib/ease';
import {fitSize, glyphBox} from '../lib/fonts';
import {Cam, NEAR, P2, planeCorners, proj, projSeg, toCam, V3} from '../lib/project';
import {hexPoints, Svg, Word, wordGeom} from '../lib/svg';
import {useFmt, useT} from '../lib/time';
import {FLY_T1, Z0} from './shared';
import {aspect, corridor, flyZ, HITS, HUB_IDS, Z_HUB, ZW} from './world';

// ACELERAÇÃO 4,0 → 7,0 s + início do PICO (convergência) até 8,0 s.
// Corredor 3D de peças reais; a linha verde (tráfego) costura os cards com profundidade real;
// cliques/targets acendem rótulos de performance (sem números); TRÁFEGO. nasce do pixel;
// tudo converge para um hub hexagonal e implode no pixel.

const catmull = (p0: V3, p1: V3, p2: V3, p3: V3, u: number): V3 => {
  const u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map(
    (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3),
  ) as V3;
};

const wordLayout = (W: number, portrait: boolean) => {
  const fs = fitSize('TRÁFEGO.', portrait ? W * 0.86 : W * 0.78, 800, -0.04);
  const g = wordGeom('TRÁFEGO.', fs, W / 2, 'middle', -0.04);
  const pb = glyphBox('.', fs, 800);
  const pSize = pb.right + pb.left;
  const i = 7;
  const px = g.x0 + g.xs[i] - pb.left + pSize / 2 - W / 2; // relativo ao centro
  const base = g.cap / 2; // linha de base relativa ao centro
  const py = base - (pb.ascent - pb.descent) / 2;
  return {fs, g, pSize, px, py, base};
};

const Chip: React.FC<{x: number; y: number; label: string; p: number; o: number; s: number}> = ({x, y, label, p, o, s}) => {
  const fs = 23;
  const w = 30 + label.length * fs * 0.8 + 44;
  const h = 62;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <rect x={0} y={-h} width={w} height={h} rx={12} fill={a.black(0.78)} stroke={a.white(0.24)} strokeWidth={1.2} />
      <text x={18} y={-h + 33} fontFamily={FONT.display} fontWeight={700} fontSize={fs} fill={C.white} letterSpacing="0.14em">
        {label}
      </text>
      <path d={`M${w - 34} ${-h + 32} l9 -14 l9 14 z`} fill={C.green} />
      <rect x={18} y={-15} width={w - 36} height={4} rx={2} fill={a.white(0.14)} />
      <rect x={18} y={-15} width={(w - 36) * p} height={4} rx={2} fill={C.green} />
    </g>
  );
};

const Cursor: React.FC<{x: number; y: number; s: number; o: number}> = ({x, y, s, o}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <path d="M0 0 L0 26 L7 20 L12 31 L17 29 L12 18 L21 18 Z" fill={C.white} stroke={C.black} strokeWidth={1.6} strokeLinejoin="round" />
  </g>
);

export const Flight: React.FC = () => {
  const t = useT();
  const {W, H, cx, cy, portrait} = useFmt();
  if (t < FLY_T1 - 6 || t > 241) return null;

  // ---------------- câmera ----------------
  const camZ = flyZ(t) + 240 * E.inCubic(prog(t, 220, 239));
  const swayIn = prog(t, 124, 140) * (1 - prog(t, 198, 212));
  const cam: Cam = {
    x: 70 * Math.sin((t - 122) / 15) * swayIn,
    y: 40 * Math.sin((t - 122) / 21) * swayIn,
    z: camZ,
    rx: 0,
    ry: 0,
    rz: deg(2.6 * Math.sin((t - 122) / 17) * swayIn),
    f: Z0,
    cx,
    cy,
  };
  const zc = (p: V3) => toCam(cam, p)[2];

  // ---------------- cards do corredor + hub ----------------
  type CardOut = {key: string; node: (z: number) => React.ReactNode; d: number};
  const cardsOut: CardOut[] = [];
  const corr = corridor(portrait);
  for (const c of corr) {
    const d = zc(c.c);
    if (d < 90 || d > 14000) continue;
    const corners = planeCorners(c.c, c.w, c.h, c.rx, c.ry, c.rz);
    const q = corners.map((p) => proj(cam, p));
    if (q.some((p) => p.z < NEAR * 2)) continue;
    if (q.every((p) => p.x < -200) || q.every((p) => p.x > W + 200) || q.every((p) => p.y < -200) || q.every((p) => p.y > H + 200)) continue;
    // cards dos cliques desaparecem antes de encostar na câmera (não podem sombrear a palavra na micropausa)
    const nearFade = c.hit !== undefined ? prog(d, 320, 820) : prog(d, 150, 520);
    const o = prog(d, 12500, 8000) * nearFade * (t < FLY_T1 ? prog(t, FLY_T1 - 6, FLY_T1) : 1);
    const dim = 0.7 * prog(d, 2600, 9000);
    let border: string | undefined;
    if (c.hit !== undefined) {
      const ht = HITS[c.hit].t;
      const hl = prog(t, ht - 0.5, ht + 0.5) * (1 - prog(t, ht + 6, ht + 16));
      if (hl > 0.01) border = a.green(0.9 * hl);
    }
    const piece = PIECES[c.id];
    cardsOut.push({key: c.key, d, node: (z) => <Card key={c.key} piece={piece} w={c.w} h={c.h} quad={q} o={o} dim={dim} z={z} border={border} />});
  }

  // hub: 6 peças em hexágono que convergem e implodem
  const hubR0 = portrait ? 400 : 470;
  const hubW = portrait ? 300 : 330;
  const rot = 240 * E.inCubic(prog(t, 205, 238));
  const contract = E.inExpo(prog(t, 223, 238.5));
  const hubPts: {p: V3; k: number; s: number}[] = [];
  HUB_IDS.forEach((id, k) => {
    const t0 = 186 + k * 1.6;
    if (t < t0) return;
    const sp = spring(t, t0, {f: 1.45, z: 0.8});
    const ang = deg(-90 + k * 60 + rot);
    const ry = portrait ? 1.45 : 1;
    const r = hubR0 * (1 - contract);
    const target: V3 = [Math.cos(ang) * r, Math.sin(ang) * r * ry, Z_HUB];
    const start: V3 = [Math.cos(ang) * hubR0 * 2.3, Math.sin(ang) * hubR0 * 2.3 * ry, Z_HUB - 1700];
    const p: V3 = [start[0] + (target[0] - start[0]) * sp, start[1] + (target[1] - start[1]) * sp, start[2] + (target[2] - start[2]) * sp];
    const s = 1 - 0.88 * contract;
    hubPts.push({p, k, s});
    const w = hubW * s;
    const h = w * aspect(id);
    const corners = planeCorners(p, w, h, 0, 0, deg(rot * 0.35));
    const q = corners.map((pp) => proj(cam, pp));
    if (q.some((pp) => pp.z < NEAR * 2)) return;
    const d = zc(p);
    const piece = PIECES[id];
    cardsOut.push({key: `hub${k}`, d, node: (z) => <Card key={`hub${k}`} piece={piece} w={w} h={h} quad={q} o={1 - prog(t, 237.5, 239)} z={z} border={a.white(0.12)} />});
  });

  cardsOut.sort((p, q) => q.d - p.d); // longe → perto
  const zIndexAt = (d: number) => {
    let j = 0;
    while (j < cardsOut.length && cardsOut[j].d > d) j++;
    return 10 + 4 * j - 2;
  };

  // ---------------- linha de tráfego ----------------
  const WL = wordLayout(W, portrait);
  const Wp: V3 = [WL.px, WL.py, ZW];
  const hitPos = HITS.map((h, k) => corr.find((c) => c.hit === k)!.c);
  const S0: V3 = [-300, 260, flyZ(121)];
  const anchors: {p: V3; t: number}[] = [
    {p: S0, t: 121},
    ...hitPos.map((p, k) => ({p, t: HITS[k].t})),
    {p: Wp, t: 160},
    {p: Wp, t: 177},
    {p: [0, 0, Z_HUB], t: 206},
  ];
  const P = anchors.map((x) => x.p);
  const at = (i: number) => P[Math.max(0, Math.min(P.length - 1, i))];
  const posAt = (i: number, u: number) => catmull(at(i - 1), at(i), at(i + 1), at(i + 2), u);
  const easeSeg = (i: number, x: number) => (i === 0 ? E.outCubic(x) : E.inOutSine(x));
  let segI = anchors.length - 2;
  for (let i = 0; i < anchors.length - 1; i++) if (t < anchors[i + 1].t) { segI = i; break; }
  const uCur = t <= anchors[0].t ? 0 : easeSeg(segI, prog(t, anchors[segI].t, anchors[segI + 1].t));
  // na micropausa o pixel fica cravado no ponto final de TRÁFEGO. (sem overshoot da spline)
  const head = t >= 160 && t < 177 ? Wp : posAt(segI, uCur);
  const lineOn = t >= 121;
  type Seg = {a: P2; b: P2; w: number; o: number; d: number};
  const segs: Seg[] = [];
  if (lineOn) {
    const N = 16;
    for (let i = 0; i <= segI; i++) {
      if (anchors[i].p === anchors[i + 1].p) continue; // trecho de pausa: o pixel não se move
      const uMax = i < segI ? 1 : uCur;
      let prev = posAt(i, 0);
      for (let k = 1; k <= N; k++) {
        const u = (uMax * k) / N;
        const cur = posAt(i, u);
        const sg = projSeg(cam, prev, cur);
        const stamp = anchors[i].t + (anchors[i + 1].t - anchors[i].t) * u;
        if (sg) {
          const d = (sg[0].z + sg[1].z) / 2;
          const age = t - stamp;
          const o = 0.38 + 0.62 * (1 - prog(age, 2, 26));
          segs.push({a: sg[0], b: sg[1], w: clamp((5.2 * Z0) / Math.max(d, 1), 1.3, 16), o: o * (1 - prog(t, 236, 239)), d});
        }
        prev = cur;
      }
    }
  }
  const groups = new Map<number, Seg[]>();
  for (const s of segs) {
    const z = zIndexAt(s.d);
    if (!groups.has(z)) groups.set(z, []);
    groups.get(z)!.push(s);
  }

  // cabeça (pixel)
  const hp = proj(cam, head);
  const hd = zc(head);
  const docked = t >= 160 && t < 177;
  const wk = Z0 / Math.max(ZW - camZ, 1);
  const headSize = docked ? WL.pSize * wk : 20 * clamp(Z0 / Math.max(hd, 1), 0.55, 1.5);

  // ---------------- TRÁFEGO. ----------------
  const wordD = ZW - camZ;
  const wc = proj(cam, [0, 0, ZW]);
  const wordO = wordD > 60 ? 1 - prog(wk, 3.5, 6.5) : 0;
  const wordOn = t >= 160 && wordD > 60;

  // ---------------- túnel hexagonal + partículas ----------------
  const tunnelR = portrait ? 1050 : 1250;
  const rings: string[] = [];
  const z0r = Math.floor((camZ + 100) / 900) * 900;
  for (let z = z0r; z < Math.min(camZ + 14000, Z_HUB - 200); z += 900) {
    const d = z - camZ;
    if (d < 160) continue;
    const pts = hexPoints(0, 0, tunnelR).map(([x, y]) => proj(cam, [x * (portrait ? 0.8 : 1.25), y * (portrait ? 1.2 : 0.78), z]));
    rings.push('M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L') + 'Z');
  }
  const tunnelO = 0.08 * prog(t, 120, 128) * (1 - prog(t, 203, 212));
  const parts = Array.from({length: 70}, (_, i) => {
    const z = flyZ(FLY_T1) + 600 + rnd(i + 3) * (Z_HUB - flyZ(FLY_T1));
    const ang = rnd(i + 17) * Math.PI * 2;
    const r = 180 + rnd(i + 29) * 1100;
    const p: V3 = [Math.cos(ang) * r * (portrait ? 0.7 : 1.2), Math.sin(ang) * r * (portrait ? 1.2 : 0.7), z];
    const pp = proj(cam, p);
    const d = pp.z;
    const o = d > 120 && d < 9000 ? (0.25 + 0.45 * rnd(i + 41)) * prog(d, 9000, 6000) * prog(d, 120, 400) : 0;
    return {x: pp.x, y: pp.y, s: clamp((3.2 * Z0) / Math.max(d, 1), 1.2, 5), o};
  });

  // linhas de velocidade (só nos trechos rápidos)
  const speedO = 0.22 * (prog(t, 122, 124) * (1 - prog(t, 131, 136)) + prog(t, 179, 184) * (1 - prog(t, 199, 206)));
  const streaks: string[] = [];
  if (speedO > 0.005) {
    for (let i = 0; i < 90; i++) {
      const base = rnd(i + 101) * 9000;
      const rel = (((base - camZ) % 9000) + 9000) % 9000; // reaparece lá no fundo depois de passar pela câmera
      const z1 = camZ + 150 + rel;
      const ang = rnd(i + 61) * Math.PI * 2;
      const r = 260 + rnd(i + 83) * 1300;
      const x = Math.cos(ang) * r * (portrait ? 0.75 : 1.3), y = Math.sin(ang) * r * (portrait ? 1.3 : 0.75);
      const sg = projSeg(cam, [x, y, z1], [x, y, z1 + 700]);
      if (sg) streaks.push(`M${sg[0].x.toFixed(1)} ${sg[0].y.toFixed(1)}L${sg[1].x.toFixed(1)} ${sg[1].y.toFixed(1)}`);
    }
  }

  // ---------------- UI dos cliques ----------------
  const ui: React.ReactNode[] = [];
  HITS.forEach((h, k) => {
    const c = corr.find((cc) => cc.hit === k)!;
    const d = zc(c.c);
    if (d < 200 || t < h.t - 6 || t > h.t + 40) return;
    const center = proj(cam, c.c);
    // canto do card mais próximo do centro da tela (o rótulo cresce para dentro do quadro)
    const corners = planeCorners(c.c, c.w, c.h, c.rx, c.ry, c.rz).map((pp) => proj(cam, pp));
    const tl = corners.reduce((best, pp) => (Math.hypot(pp.x - cx, pp.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? pp : best));
    const chipK = portrait ? 1.35 : 1;
    const chipW = (30 + h.label.length * 23 * 0.8 + 44) * chipK;
    const safeX = portrait ? 70 : 60, safeT = portrait ? 260 : 70, safeB = portrait ? 1600 : H - 50;
    const chipX = clamp(tl.x < cx ? tl.x + 16 : tl.x - chipW - 16, safeX, W - safeX - chipW);
    const chipY = clamp(tl.y < cy ? tl.y + 78 * chipK : tl.y - 16, safeT + 62 * chipK, safeB);
    const nearO = prog(d, 380, 900);
    // cursor
    const cp = E.outCubic(prog(t, h.t - 6, h.t - 0.5));
    const click = t >= h.t && t < h.t + 2.5 ? 0.82 : 1;
    const curO = prog(t, h.t - 6, h.t - 4.5) * (1 - prog(t, h.t + 5, h.t + 9)) * nearO;
    if (curO > 0.01) ui.push(<Cursor key={`cu${k}`} x={center.x + 90 * (1 - cp)} y={center.y + 110 * (1 - cp)} s={(portrait ? 1.6 : 1.25) * click} o={curO} />);
    // target
    const tp = prog(t, h.t, h.t + 9);
    if (tp > 0 && tp < 1) {
      const r = 16 + 46 * E.outCubic(tp);
      ui.push(
        <g key={`tg${k}`} opacity={(1 - tp) * nearO}>
          <circle cx={center.x} cy={center.y} r={r} fill="none" stroke={C.green} strokeWidth={2} />
          {[0, 90, 180, 270].map((ang) => {
            const ca = Math.cos(deg(ang + 45)), sa = Math.sin(deg(ang + 45));
            return <line key={ang} x1={center.x + ca * (r + 6)} y1={center.y + sa * (r + 6)} x2={center.x + ca * (r + 16)} y2={center.y + sa * (r + 16)} stroke={C.green} strokeWidth={2} />;
          })}
        </g>,
      );
    }
    // rótulo
    const lp = spring(t, h.t + 0.5, {f: 3.2, z: 0.62});
    const chipO = prog(t, h.t + 0.5, h.t + 2) * nearO;
    if (chipO > 0.01)
      ui.push(<Chip key={`ch${k}`} x={chipX} y={chipY} label={h.label} p={E.outCubic(prog(t, h.t + 1, h.t + 9))} o={chipO} s={(0.6 + 0.4 * lp) * chipK} />);
  });

  // ---------------- hub: raios + medidor ----------------
  const hubC = proj(cam, [0, 0, Z_HUB]);
  const hubD = zc([0, 0, Z_HUB]);
  const spokeP = E.outCubic(prog(t, 205, 211));
  const gauge = E.inOutCubic(prog(t, 206, 232));
  const hubO = (1 - prog(t, 237.5, 239)) * (hubD > 100 ? 1 : 0);
  const hubScale = Z0 / Math.max(hubD, 1);
  const implode = prog(t, 236, 239);

  // ---------------- render ----------------
  const layers: React.ReactNode[] = cardsOut.map((c, i) => c.node(10 + 4 * i));
  groups.forEach((list, z) => {
    layers.push(
      <Svg key={`ln${z}`} style={{zIndex: z}}>
        {list.map((s, i) => (
          <line key={`g${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={C.green} strokeWidth={s.w * 3.2} strokeLinecap="round" opacity={0.13 * s.o} />
        ))}
        {list.map((s, i) => (
          <line key={`l${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={C.green} strokeWidth={s.w} strokeLinecap="round" opacity={s.o} />
        ))}
      </Svg>,
    );
  });
  // palavra (na profundidade correta)
  if (wordOn && wordO > 0.01) {
    const zw = zIndexAt(wordD);
    layers.push(
      <Svg key="word" style={{zIndex: zw}}>
        <g transform={`translate(${wc.x} ${wc.y}) scale(${wk}) translate(${-W / 2} 0)`} opacity={wordO}>
          <Word
            text="TRÁFEGO."
            size={WL.fs}
            x={W / 2}
            y={WL.base}
            tracking={-0.04}
            id="tr"
            letter={(i) => {
              if (i === 7) return {o: 0};
              const t0 = 160 + (6 - i) * 0.6;
              const p = E.outExpo(prog(t, t0, t0 + 6));
              const finalX = WL.g.x0 + WL.g.xs[i] + WL.g.ws[i] / 2 - W / 2;
              return {dx: (WL.px - finalX) * (1 - p), s: 0.5 + 0.5 * p, o: t >= t0 ? 1 : 0};
            }}
          />
        </g>
      </Svg>,
    );
  }
  // pixel (cabeça da linha)
  if (lineOn && hd > NEAR && t < 239) {
    const zh = zIndexAt(hd) + 1;
    const hs = headSize * (1 + 0.5 * implode);
    layers.push(
      <Svg key="head" style={{zIndex: zh}}>
        <defs>
          <filter id="fl-headglow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation={Math.max(4, hs * 0.6)} />
          </filter>
        </defs>
        <rect x={hp.x - hs * 0.8} y={hp.y - hs * 0.8} width={hs * 1.6} height={hs * 1.6} fill={C.green} opacity={0.55} filter="url(#fl-headglow)" />
        <rect x={hp.x - hs / 2} y={hp.y - hs / 2} width={hs} height={hs} fill={implode > 0.5 ? C.white : C.green} />
      </Svg>,
    );
  }

  return (
    <AbsoluteFill>
      <Svg style={{zIndex: 1}}>
        {rings.length ? <path d={rings.join('')} fill="none" stroke={C.white} strokeWidth={1} opacity={tunnelO} /> : null}
        {streaks.length ? <path d={streaks.join('')} fill="none" stroke={C.white} strokeWidth={1.2} opacity={speedO} /> : null}
        {parts.map((p, i) => (p.o > 0.01 ? <rect key={i} x={p.x - p.s / 2} y={p.y - p.s / 2} width={p.s} height={p.s} fill={C.green} opacity={p.o} /> : null))}
        {/* raios do hub */}
        {spokeP > 0 && hubO > 0.01
          ? hubPts.map(({p, k}) => {
              const e = proj(cam, p);
              const x2 = hubC.x + (e.x - hubC.x) * spokeP;
              const y2 = hubC.y + (e.y - hubC.y) * spokeP;
              // sequenciador: cada raio acende em semicolcheias (3,75 frames), girando pelo hexágono
              const step = Math.floor((t - 210) / 3.75);
              const lit = t >= 210 && ((step % 6) + 6) % 6 === k;
              return (
                <g key={k} opacity={hubO}>
                  <line x1={hubC.x} y1={hubC.y} x2={x2} y2={y2} stroke={lit ? C.green : C.white} strokeWidth={lit ? 2.4 : 1.2} opacity={lit ? 0.95 : 0.35} />
                  <rect x={x2 - (lit ? 6 : 4)} y={y2 - (lit ? 6 : 4)} width={lit ? 12 : 8} height={lit ? 12 : 8} fill={C.green} />
                </g>
              );
            })
          : null}
        {gauge > 0 && hubO > 0.01 ? (
          <g opacity={hubO} transform={`translate(${hubC.x} ${hubC.y}) scale(${hubScale * (1 - 0.8 * implode)}) rotate(-90)`}>
            <circle r={118} fill="none" stroke={C.white} strokeWidth={1} opacity={0.18} />
            <circle r={118} fill="none" stroke={C.green} strokeWidth={3} strokeDasharray={`${2 * Math.PI * 118 * gauge} 9999`} />
            {Array.from({length: 24}, (_, i) => {
              const an = deg(i * 15);
              return <line key={i} x1={Math.cos(an) * 128} y1={Math.sin(an) * 128} x2={Math.cos(an) * (i % 6 === 0 ? 142 : 134)} y2={Math.sin(an) * (i % 6 === 0 ? 142 : 134)} stroke={C.white} strokeWidth={1} opacity={i / 24 <= gauge ? 0.55 : 0.15} />;
            })}
          </g>
        ) : null}
      </Svg>
      {layers}
      <Svg style={{zIndex: 5000}}>{ui}</Svg>
    </AbsoluteFill>
  );
};
