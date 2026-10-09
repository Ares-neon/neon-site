/* ==========================================================================
   CLAUDE OPUS 5.5 — "Intelligence in Motion"
   30 s · 1080 × 1920 (9:16) · 60 fps · one GSAP master timeline

   Determinism contract
   - The master timeline is always paused. A frame is a pure function of t:
     renderAt(t) seeks the timeline, then redraws every canvas from scratch.
   - Every tween is fromTo() with immediateRender:false, and every property
     forms a continuous chain (each `from` equals the previous `to`), so any
     seek order — forwards, backwards, random — yields the same pixels.
   - Randomness comes from a seeded PRNG; continuous drift uses t only.
   - Motion blur: particles are evaluated at t − shutter and at t and drawn
     as streaks between the two positions (180° shutter).
   ========================================================================== */
(() => {
  'use strict';

  const W = 1080, H = 1920, FPS = 60, DUR = 30;
  const CX = 540, CY = 920;               // optical centre of the composition
  const SHUTTER = 0.5 / FPS;              // 180° shutter
  const RENDER = new URLSearchParams(location.search).has('render');
  document.documentElement.classList.toggle('render', RENDER);

  /* ---------- math ---------- */
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const wrap = (v, r) => ((((v + r) % (2 * r)) + 2 * r) % (2 * r)) - r;
  const E = {
    out3: (t) => 1 - Math.pow(1 - t, 3),
    inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    in2: (t) => t * t,
  };
  const stag = (p, d, spread) => clamp((p - d * spread) / (1 - spread));
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(55);

  /* ---------- canvases ---------- */
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const bg = $('bg').getContext('2d');
  const fg = $('fg').getContext('2d');
  const gr = $('grain').getContext('2d');
  const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const litBuf = off(W / 2, H / 2), lit = litBuf.getContext('2d');
  const beamBuf = off(W / 2, H / 2), beam = beamBuf.getContext('2d');

  /* ======================================================================
     STATE — everything the canvases draw; animated only by the timeline
     ====================================================================== */
  const S = {
    // atmosphere
    baseA: 0, hazeA: 0, fogA: 0, clearA: 0,
    coreA: 0, coreR: 0, streakA: 0, streakL: 0,
    haloA: 0, haloBoost: 0, haloR: 30, haloY: CY, haloCore: 1,
    beamA: 0, beamP: 0, dustA: 0, dustLit: 0,
    sweepA: 0, sweepX: -300,
    // scene 02 light structure
    ringsA: 0, ringsDraw: 0.3, ringsRot: 0, ringsScale: 0.92, ringsBright: 1, ringsY: 905,
    // scene 03 network
    netA: 0, netEdges: 0, netPulse: 0, netScale: 0.04, netRot: 0,
    mCloud: 0, mLat: 0, mSph: 0,
    // scene 04 architecture
    mTower: 0, archA: 0, archEdges: 0, archLit: 0, towerRot: 0,
    // light line (scene 04 scan → scene 05 precision line → scene 06 seed point)
    lineA: 0, lineY: 1580, lineLen: 0, pointA: 0,
    // scene 06 convergence
    mOut: 0, mConv: 0, convA: 0, convLines: 0, flash: 0, embers: 0, embersA: 0,
    leakA: 0,
    // camera
    camYaw: 0, camPitch: 0, camZ: 0, camY: 0,
  };

  /* ======================================================================
     TEXTURES
     ====================================================================== */
  function sprite(size, stops) {
    const c = off(size, size), x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }
  const SPR = {
    white: sprite(64, [[0, 'rgba(255,255,255,1)'], [0.07, 'rgba(248,250,252,.96)'], [0.18, 'rgba(226,231,238,.45)'], [0.42, 'rgba(191,197,206,.10)'], [1, 'rgba(191,197,206,0)']]),
    amber: sprite(64, [[0, 'rgba(255,247,236,1)'], [0.07, 'rgba(252,228,196,.96)'], [0.18, 'rgba(217,166,108,.48)'], [0.42, 'rgba(217,166,108,.11)'], [1, 'rgba(217,166,108,0)']]),
    bokeh: sprite(64, [[0, 'rgba(232,236,242,.34)'], [0.55, 'rgba(214,220,228,.26)'], [0.78, 'rgba(200,206,216,.16)'], [1, 'rgba(191,197,206,0)']]),
    bokehAmber: sprite(64, [[0, 'rgba(240,206,164,.34)'], [0.55, 'rgba(224,182,130,.26)'], [0.78, 'rgba(217,166,108,.15)'], [1, 'rgba(217,166,108,0)']]),
  };

  // Tileable fbm value noise, used as volumetric haze density.
  function fogTexture(w, h, seed, rgb, floor) {
    const r = mulberry32(seed);
    const c = off(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const oct = [[2, 0.58], [4, 0.27], [8, 0.11], [16, 0.04]].map(([cells, amp]) => {
      const gw = cells, gh = Math.max(1, Math.round((cells * h) / w));
      const g = new Float32Array(gw * gh);
      for (let k = 0; k < g.length; k++) g[k] = r();
      return { gw, gh, g, amp };
    });
    for (let y = 0; y < h; y++) {
      for (let xx = 0; xx < w; xx++) {
        let v = 0;
        for (const o of oct) {
          const fx = (xx / w) * o.gw, fy = (y / h) * o.gh;
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = fx - x0, ty = fy - y0;
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const x1 = (x0 + 1) % o.gw, y1 = (y0 + 1) % o.gh;
          const a = o.g[y0 * o.gw + x0], b = o.g[y0 * o.gw + x1];
          const cc = o.g[y1 * o.gw + x0], d = o.g[y1 * o.gw + x1];
          v += o.amp * lerp(lerp(a, b, sx), lerp(cc, d, sx), sy);
        }
        v = smoothstep(0.28, 0.82, v);
        const k = (y * w + xx) * 4;
        img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2];
        img.data[k + 3] = Math.round((floor + (1 - floor) * v) * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  const FOG_WARM = fogTexture(270, 480, 11, [255, 232, 204], 0.3);   // beam density (never fully empty)
  const FOG_LIT = fogTexture(270, 480, 17, [255, 228, 196], 0.0);    // haze lit by the halo
  const FOG_COOL = fogTexture(270, 480, 29, [206, 212, 222], 0.0);

  // Draws a tileable texture covering (0,0,w,h) of ctx, offset by (ox, oy).
  function tiles(ctx, tex, w, h, ox, oy) {
    ox = ((ox % w) + w) % w; oy = ((oy % h) + h) % h;
    for (let i = -1; i <= 0; i++) for (let j = -1; j <= 0; j++) ctx.drawImage(tex, ox + i * w, oy + j * h, w, h);
  }

  // Base: deep black with a barely-there charcoal volume behind the centre.
  const BASE = off(W, H);
  {
    const x = BASE.getContext('2d');
    const g = x.createRadialGradient(CX, CY, 0, CX, CY, 1150);
    g.addColorStop(0, 'rgba(16,17,20,1)'); g.addColorStop(0.55, 'rgba(11,12,14,1)'); g.addColorStop(1, 'rgba(5,5,5,1)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  // Film grain: 8 seeded frames, half resolution (soft ~2 px grain after upscale).
  const GRAIN = [];
  for (let k = 0; k < 8; k++) {
    const c = off(W / 2, H / 2), x = c.getContext('2d');
    const img = x.createImageData(W / 2, H / 2);
    const r = mulberry32(900 + k);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 52;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    GRAIN.push(c);
  }
  let grainIdx = -1;
  function drawGrain(t) {
    const idx = Math.floor(t * 30 + 1e-4) % GRAIN.length;   // epsilon: frame i/60 never flaps across a grain boundary
    if (idx === grainIdx) return;
    grainIdx = idx;
    gr.imageSmoothingEnabled = true;
    gr.drawImage(GRAIN[idx], 0, 0, W, H);
  }

  /* ======================================================================
     PARTICLES — one pool that travels through every scene
     dust (S1, S2, S4) → network nodes (S3) → architecture (S4) → convergence (S6)
     ====================================================================== */
  const N = 380, NNET = 140;
  const P = [];
  for (let i = 0; i < N; i++) {
    const p = {
      dx: (rnd() * 2 - 1) * 780, dy: (rnd() * 2 - 1) * 1250, dz: (rnd() * 2 - 1) * 650,
      vx: (rnd() * 2 - 1) * 7, vy: -(5 + rnd() * 15), vz: (rnd() * 2 - 1) * 5,
      size: 0.7 + Math.pow(rnd(), 2.4) * 2.3,
      tw: rnd() * Math.PI * 2, twf: 0.6 + rnd() * 1.5,
      warm: rnd() < 0.3 ? 1 : 0,
      d1: rnd(), d2: rnd(), d3: rnd(), d4: rnd(), dC: rnd(),
      th: rnd() * Math.PI * 2, rOut: 1320 + rnd() * 520, zOut: (rnd() * 2 - 1) * 240,
      spin: (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.45),
      isTower: false,
    };
    // network cloud: uniform in an ellipsoid, taller than wide (9:16)
    const u = rnd(), v = rnd(), w = rnd();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1), rr = 520 * Math.cbrt(w);
    p.cx = rr * Math.sin(ph) * Math.cos(th);
    p.cy = rr * Math.cos(ph) * 1.45;
    p.cz = rr * Math.sin(ph) * Math.sin(th);
    P.push(p);
  }
  // Coherent slot assignment: sort by height so morphs travel short paths.
  {
    const net = P.slice(0, NNET);
    const lattice = [];
    for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 5; iz++) {
      lattice.push({ x: (ix - 1.5) * 150, y: (iy - 3) * 150, z: (iz - 2) * 150 });
    }
    const byCloud = net.slice().sort((a, b) => a.cy - b.cy || a.cx - b.cx);
    lattice.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
    byCloud.forEach((p, k) => { p.lx = lattice[k].x; p.ly = lattice[k].y; p.lz = lattice[k].z; });

    const fib = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < NNET; k++) {
      const y = 1 - (k / (NNET - 1)) * 2, r = Math.sqrt(1 - y * y), a = golden * k;
      fib.push({ x: Math.cos(a) * r * 430, y: y * 430, z: Math.sin(a) * r * 430 });
    }
    fib.sort((a, b) => a.y - b.y);
    const byLat = net.slice().sort((a, b) => a.ly - b.ly || Math.atan2(a.lz, a.lx) - Math.atan2(b.lz, b.lx));
    byLat.forEach((p, k) => { p.fx = fib[k].x; p.fy = fib[k].y; p.fz = fib[k].z; });

    // Architecture: a 3 × 3 × 9 lattice tower. 81 of the 140 nodes build it.
    const slots = [];
    for (let iy = 0; iy < 9; iy++) for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) {
      slots.push({ ix, iy, iz, x: (ix - 1) * 128, y: 600 - iy * 150, z: (iz - 1) * 128 });
    }
    const bySphere = net.slice().sort((a, b) => b.fy - a.fy); // bottom (large y) first
    const chosen = [];
    for (let k = 0; k < 81; k++) chosen.push(bySphere[Math.round((k * (NNET - 1)) / 80)]);
    const slotsByLevel = slots.slice().sort((a, b) => a.iy - b.iy || a.ix - b.ix || a.iz - b.iz);
    var SLOT_P = new Array(81);
    chosen.forEach((p, k) => {
      const s = slotsByLevel[k];
      p.isTower = true; p.tx = s.x; p.ty = s.y; p.tz = s.z;
      p.dT = s.iy / 8 * 0.85 + rnd() * 0.15;     // assemble from the ground up
      s.p = P.indexOf(p);
    });
    slotsByLevel.forEach((s, k) => { SLOT_P[k] = s; });
    // edges: verticals, level rings, and alternating bracing on the outer faces
    const id = (ix, iy, iz) => slotsByLevel.findIndex((s) => s.ix === ix && s.iy === iy && s.iz === iz);
    var TOWER_EDGES = [];
    for (let iy = 0; iy < 9; iy++) for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) {
      const a = id(ix, iy, iz);
      if (iy < 8) TOWER_EDGES.push([a, id(ix, iy + 1, iz), iy, 0]);
      if (ix < 2) TOWER_EDGES.push([a, id(ix + 1, iy, iz), iy, 1]);
      if (iz < 2) TOWER_EDGES.push([a, id(ix, iy, iz + 1), iy, 1]);
    }
    for (let iy = 0; iy < 8; iy++) {
      const flip = iy % 2;
      TOWER_EDGES.push([id(flip ? 0 : 2, iy, 0), id(flip ? 2 : 0, iy + 1, 0), iy, 2]);
      TOWER_EDGES.push([id(flip ? 2 : 0, iy, 2), id(flip ? 0 : 2, iy + 1, 2), iy, 2]);
      TOWER_EDGES.push([id(0, iy, flip ? 2 : 0), id(0, iy + 1, flip ? 0 : 2), iy, 2]);
      TOWER_EDGES.push([id(2, iy, flip ? 0 : 2), id(2, iy + 1, flip ? 2 : 0), iy, 2]);
    }
    P.SLOTS = SLOT_P; P.EDGES = TOWER_EDGES;
  }

  const buf = () => ({
    x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N),
    sx: new Float32Array(N), sy: new Float32Array(N), k: new Float32Array(N),
    a: new Float32Array(N), s: new Float32Array(N), warm: new Float32Array(N),
    wn: new Float32Array(N), wt: new Float32Array(N), vis: new Uint8Array(N),
  });
  const PREV = buf(), CUR = buf();

  const FOCAL = 1250, CAMD = 1250;
  function project(B, i, x, y, z) {
    const cyw = Math.cos(S.camYaw), syw = Math.sin(S.camYaw);
    const cp = Math.cos(S.camPitch), sp = Math.sin(S.camPitch);
    const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
    const yy = y - S.camY;
    const y1 = yy * cp - z1 * sp, z2 = yy * sp + z1 * cp;
    const zc = z2 + CAMD - S.camZ;
    if (zc < 90) { B.vis[i] = 0; return; }
    const k = FOCAL / zc;
    B.vis[i] = 1; B.k[i] = k;
    B.sx[i] = CX + x1 * k; B.sy[i] = CY + y1 * k;
  }

  function computeParticles(t, B) {
    const cN = Math.cos(S.netRot), sN = Math.sin(S.netRot);
    const tilt = 0.2, cTl = Math.cos(tilt), sTl = Math.sin(tilt);
    const cT = Math.cos(S.towerRot), sT = Math.sin(S.towerRot);
    for (let i = 0; i < N; i++) {
      const p = P[i];
      let x = wrap(p.dx + p.vx * t, 780), y = wrap(p.dy + p.vy * t, 1250), z = wrap(p.dz + p.vz * t, 650);
      const edge = smoothstep(780, 690, Math.abs(x)) * smoothstep(1250, 1130, Math.abs(y)) * smoothstep(650, 560, Math.abs(z));
      let a = i < NNET ? 0 : S.dustA * edge * (0.72 + 0.28 * Math.sin(t * p.twf + p.tw));
      let s = p.size, warm = p.warm, wn = 0, wt = 0;

      if (i < NNET) {
        const qc = E.out3(stag(S.mCloud, p.d1, 0.3));
        if (qc > 0) {
          let nx = p.cx * S.netScale, ny = p.cy * S.netScale + Math.sin(t * 0.7 + p.tw) * 9, nz = p.cz * S.netScale;
          const ql = E.inOut3(stag(S.mLat, p.d2, 0.45));
          if (ql > 0) { nx = lerp(nx, p.lx, ql); ny = lerp(ny, p.ly, ql); nz = lerp(nz, p.lz, ql); }
          const qs = E.inOut3(stag(S.mSph, p.d3, 0.45));
          if (qs > 0) { nx = lerp(nx, p.fx, qs); ny = lerp(ny, p.fy, qs); nz = lerp(nz, p.fz, qs); }
          const rx = nx * cN - nz * sN, rz = nx * sN + nz * cN;
          const ry = ny * cTl - rz * sTl, rz2 = ny * sTl + rz * cTl;
          x = lerp(x, rx, qc); y = lerp(y, ry, qc); z = lerp(z, rz2, qc);
          a = lerp(a, S.netA * (0.82 + 0.18 * Math.sin(t * 2.1 + p.tw)), qc);
          s = lerp(s, 1.9 + p.size * 0.3, qc); warm = lerp(warm, 0.08, qc);
          wn = qc;
        }
        const qt = E.inOut3(stag(S.mTower, p.isTower ? p.dT : p.d4, 0.5));
        if (qt > 0) {
          if (p.isTower) {
            const tx = p.tx * cT - p.tz * sT, tz = p.tx * sT + p.tz * cT;
            x = lerp(x, tx, qt); y = lerp(y, p.ty, qt); z = lerp(z, tz, qt);
            a = lerp(a, S.archA * (0.86 + 0.14 * Math.sin(t * 1.7 + p.tw)), qt);
            s = lerp(s, 2.1, qt); warm = lerp(warm, 0.2, qt);
            wt = qt;
          } else {
            const ox = x * 1.9, oy = y * 1.25, oz = z * 1.6;      // released outward, dissolving
            x = lerp(x, ox, qt); y = lerp(y, oy, qt); z = lerp(z, oz, qt);
            a = lerp(a, 0, qt);
          }
          wn *= 1 - qt;
        }
      }
      if (S.mOut > 0) {
        const m = S.mOut;
        x = lerp(x, Math.cos(p.th) * p.rOut, m); y = lerp(y, Math.sin(p.th) * p.rOut, m); z = lerp(z, p.zOut, m);
        a = lerp(a, 0, m); wn = lerp(wn, 0, m); wt = lerp(wt, 0, m);
      }
      const qv = stag(S.mConv, p.dC, 0.42);
      if (qv > 0) {
        const e = qv * qv * (1.35 - 0.35 * qv);
        const ang = p.th + e * 0.95 * p.spin, rr = p.rOut * (1 - e);
        x = Math.cos(ang) * rr; y = Math.sin(ang) * rr; z = p.zOut * (1 - e);
        a = S.convA * smoothstep(0, 0.1, qv) * (1 - smoothstep(0.84, 1, qv));
        s = p.size * 1.1 + 0.4; warm = p.warm > 0.5 ? 1 : 0.4;
      }

      B.x[i] = x; B.y[i] = y; B.z[i] = z; B.a[i] = a; B.s[i] = s; B.warm[i] = warm; B.wn[i] = wn; B.wt[i] = wt;
      project(B, i, x, y, z);
    }
  }

  /* ======================================================================
     DRAW — background canvas (additive light), then foreground (screen)
     ====================================================================== */
  function drawHalo(t) {
    const a = S.haloA + S.haloBoost;
    const x = CX, y = S.haloY;
    if (a > 0.002) {
      const R = S.haloR * (1 + 0.012 * Math.sin(t * 1.25));
      // haze lit by the light source: fog density masked by the halo falloff
      if (S.fogA > 0.002) {
        lit.globalCompositeOperation = 'source-over';
        lit.clearRect(0, 0, W / 2, H / 2);
        tiles(lit, FOG_LIT, W / 2, H / 2, t * 6, -t * 4);
        lit.globalCompositeOperation = 'destination-in';
        const m = lit.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, (R * 0.95) / 2);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.35, 'rgba(0,0,0,.5)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        lit.fillStyle = m; lit.fillRect(0, 0, W / 2, H / 2);
        bg.globalAlpha = clamp(S.fogA * Math.min(1, a) * 0.15);
        bg.drawImage(litBuf, 0, 0, W, H);
        bg.globalAlpha = 1;
      }
      const g = bg.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,238,216,${0.85 * a * S.haloCore})`);
      g.addColorStop(0.04, `rgba(250,214,170,${0.5 * a * (0.35 + 0.65 * S.haloCore)})`);
      g.addColorStop(0.13, `rgba(217,166,108,${0.24 * a})`);
      g.addColorStop(0.33, `rgba(150,110,72,${0.085 * a})`);
      g.addColorStop(0.62, `rgba(70,54,40,${0.03 * a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bg.fillStyle = g; bg.fillRect(x - R, y - R, 2 * R, 2 * R);
    }
    if (S.streakA > 0.002 && S.streakL > 2) {
      const L = S.streakL;
      for (const [h, al] of [[1.6, 0.9], [7, 0.22], [26, 0.06]]) {
        const g = bg.createLinearGradient(x - L, 0, x + L, 0);
        g.addColorStop(0, 'rgba(255,226,190,0)');
        g.addColorStop(0.5, `rgba(255,238,218,${al * S.streakA})`);
        g.addColorStop(1, 'rgba(255,226,190,0)');
        bg.fillStyle = g; bg.fillRect(x - L, y - h / 2, 2 * L, h);
      }
    }
    if (S.coreA > 0.002) {
      const s = 10 + 44 * S.coreR;
      bg.globalAlpha = clamp(S.coreA);
      bg.drawImage(SPR.amber, x - s / 2, y - s / 2, s, s);
      bg.drawImage(SPR.white, x - s / 4, y - s / 4, s / 2, s / 2);
      bg.globalAlpha = 1;
    }
  }

  function drawHaze(t) {
    if (S.hazeA <= 0.002) return;
    bg.globalAlpha = S.hazeA * 0.022;
    tiles(bg, FOG_COOL, W, H, -t * 9, t * 3);
    bg.globalAlpha = 1;
  }

  function drawBeam(t) {
    if (S.beamA <= 0.002) return;
    const xc = lerp(-460, 1540, S.beamP), yc = CY, ang = -1.08;
    // haze density first, then mask it with the shaft (one fill → destination-in keeps only the shaft)
    beam.globalCompositeOperation = 'source-over';
    beam.clearRect(0, 0, W / 2, H / 2);
    tiles(beam, FOG_WARM, W / 2, H / 2, t * 7, -t * 5);
    beam.globalCompositeOperation = 'destination-in';
    beam.save();
    beam.scale(0.5, 0.5);
    beam.translate(xc, yc); beam.rotate(ang);
    const g = beam.createLinearGradient(-330, 0, 330, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.22, 'rgba(0,0,0,.12)'); g.addColorStop(0.4, 'rgba(0,0,0,.5)');
    g.addColorStop(0.5, 'rgba(0,0,0,.85)'); g.addColorStop(0.6, 'rgba(0,0,0,.5)'); g.addColorStop(0.78, 'rgba(0,0,0,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    beam.fillStyle = g; beam.fillRect(-330, -2200, 660, 4400);
    beam.restore();
    beam.globalCompositeOperation = 'source-over';
    bg.globalAlpha = clamp(S.beamA) * 0.15;
    bg.drawImage(beamBuf, 0, 0, W, H);
    // a fine, brighter filament along the shaft's axis
    bg.save();
    bg.translate(xc, yc); bg.rotate(ang);
    const f = bg.createLinearGradient(0, -1400, 0, 1400);
    f.addColorStop(0, 'rgba(255,236,214,0)'); f.addColorStop(0.5, 'rgba(255,240,224,.5)'); f.addColorStop(1, 'rgba(255,236,214,0)');
    bg.globalAlpha = clamp(S.beamA) * 0.045;
    bg.fillStyle = f; bg.fillRect(-1, -1400, 2, 2800);
    bg.restore();
    bg.globalAlpha = 1;
  }

  // Scene 02 — a gyroscope of light: six thin rings in 3D, each carrying a glint.
  const RINGS = [
    // tilts stay within ~0.7–1.3 rad through the hold, so no ring is ever seen edge-on behind the type
    { r: 336, tx: 0.7, ty: 0.18, sx: 0.3, sy: 0.92, ph: 0.4, gs: 0.55, al: 0.85, w: 1.3 },
    { r: 366, tx: 1.05, ty: -0.62, sx: -0.28, sy: 0.6, ph: 2.1, gs: -0.42, al: 0.6, w: 1.0 },
    { r: 396, tx: 0.62, ty: 0.95, sx: 0.32, sy: -0.4, ph: 4.0, gs: 0.36, al: 0.7, w: 1.1 },
    { r: 426, tx: 1.1, ty: 1.4, sx: -0.3, sy: 0.75, ph: 1.0, gs: -0.3, al: 0.5, w: 0.9 },
    { r: 456, tx: 0.8, ty: -1.15, sx: 0.22, sy: -0.66, ph: 5.2, gs: 0.26, al: 0.42, w: 0.9 },
    { r: 486, tx: 0.95, ty: 0.6, sx: -0.18, sy: 0.4, ph: 3.1, gs: -0.22, al: 0.32, w: 0.8 },
  ];
  function drawRings(t) {
    if (S.ringsA <= 0.002) return;
    const clipping = S.sweepA > 0.01 && S.sweepX < W + 200;
    if (clipping) { bg.save(); bg.beginPath(); bg.rect(0, 0, Math.max(0, S.sweepX + 24), H); bg.clip(); }
    const f = 1500, cy = S.ringsY;
    const SEG = 132;
    RINGS.forEach((ring, k) => {
      const R = ring.r * S.ringsScale;
      const ax = ring.tx + S.ringsRot * ring.sx + t * 0.03, ay = ring.ty + S.ringsRot * ring.sy;
      const cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay);
      const span = clamp(S.ringsDraw * 1.35 - k * 0.06) * Math.PI * 2;
      if (span <= 0.01) return;
      const pt = (u) => {
        const x0 = R * Math.cos(u), y0 = R * Math.sin(u);
        const y1 = y0 * cax, z1 = y0 * sax;
        const x2 = x0 * cay + z1 * say, z2 = -x0 * say + z1 * cay;
        const kk = f / (f + z2);
        return [CX + x2 * kk, cy + y1 * kk, z2];
      };
      const n = Math.max(2, Math.round((SEG * span) / (Math.PI * 2)));
      let prev = pt(ring.ph);
      bg.lineWidth = ring.w * Math.min(1.6, 0.8 + 0.2 * S.ringsBright);
      for (let j = 1; j <= n; j++) {
        const u = ring.ph + (span * j) / n;
        const cur = pt(u);
        const depth = clamp(0.5 - ((prev[2] + cur[2]) / 2) / (2 * R)); // 1 = nearest
        const tail = span < Math.PI * 2 - 0.01 ? smoothstep(0, 0.35, j / n) : 1;
        const a = S.ringsA * ring.al * (0.18 + 0.82 * depth * depth) * tail * Math.min(2.6, S.ringsBright) * 0.5;
        bg.strokeStyle = `rgba(218,224,232,${clamp(a)})`;
        bg.beginPath(); bg.moveTo(prev[0], prev[1]); bg.lineTo(cur[0], cur[1]); bg.stroke();
        prev = cur;
      }
      // specular glint travelling along the ring, trailing a smooth comet tail
      const ug = ring.ph + span * 0.999 * ((((t * ring.gs + k * 0.17) % 1) + 1) % 1);
      const dir = Math.sign(ring.gs);
      let q0 = pt(ug);
      const headDepth = clamp(0.5 - q0[2] / (2 * R));
      bg.lineCap = 'round';
      for (let j = 1; j <= 22; j++) {
        const q1 = pt(ug - j * 0.016 * dir);
        const depth = clamp(0.5 - q1[2] / (2 * R));
        const a = S.ringsA * (0.2 + 0.8 * depth) * Math.pow(1 - j / 22, 1.6) * 0.85 * Math.min(2, S.ringsBright);
        bg.strokeStyle = `rgba(242,204,156,${clamp(a)})`;
        bg.lineWidth = 2.2 * (1 - j / 26);
        bg.beginPath(); bg.moveTo(q0[0], q0[1]); bg.lineTo(q1[0], q1[1]); bg.stroke();
        q0 = q1;
      }
      const hq = pt(ug), hs = 26 * (0.7 + 0.5 * headDepth);
      bg.globalAlpha = clamp(S.ringsA * (0.3 + 0.7 * headDepth) * Math.min(2, S.ringsBright) * 0.9);
      bg.drawImage(SPR.amber, hq[0] - hs / 2, hq[1] - hs / 2, hs, hs);
      bg.globalAlpha = 1;
    });
    if (clipping) bg.restore();
  }

  // Scene 03 — lines of light between nearby nodes, with signal pulses.
  const NET_TH = 182;
  function drawNetwork(t) {
    if (S.netA <= 0.002) return;
    const ew = S.netA * S.netEdges;
    if (ew > 0.002) {
      bg.lineWidth = 1.1;
      for (let i = 0; i < NNET; i++) {
        if (!CUR.vis[i] || CUR.wn[i] < 0.02) continue;
        for (let j = i + 1; j < NNET; j++) {
          if (!CUR.vis[j] || CUR.wn[j] < 0.02) continue;
          const dx = CUR.x[i] - CUR.x[j], dy = CUR.y[i] - CUR.y[j], dz = CUR.z[i] - CUR.z[j];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > NET_TH * NET_TH) continue;
          const d = Math.sqrt(d2);
          const fall = Math.pow(1 - d / NET_TH, 1.3);
          const kd = Math.min(CUR.k[i], CUR.k[j]);
          const a = ew * fall * CUR.wn[i] * CUR.wn[j] * clamp(0.3 + 0.7 * (kd - 0.62) / 0.6) * 0.95;
          if (a < 0.004) continue;
          bg.strokeStyle = `rgba(214,220,229,${clamp(a)})`;
          bg.beginPath(); bg.moveTo(CUR.sx[i], CUR.sy[i]); bg.lineTo(CUR.sx[j], CUR.sy[j]); bg.stroke();
          // signal pulse on ~14 % of the links
          if (S.netPulse > 0.002) {
            const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
            if (h % 100 < 14) {
              const u = (((t * (0.45 + (h % 7) * 0.08) + (h % 997) / 997) % 1) + 1) % 1;
              const px = lerp(CUR.sx[i], CUR.sx[j], u), py = lerp(CUR.sy[i], CUR.sy[j], u);
              const pa = S.netPulse * fall * CUR.wn[i] * CUR.wn[j] * Math.sin(Math.PI * u);
              const s = 20 * kd;
              bg.globalAlpha = clamp(pa);
              bg.drawImage(SPR.amber, px - s / 2, py - s / 2, s, s);
              bg.globalAlpha = 1;
            }
          }
        }
      }
    }
  }

  // Scene 04 — architecture: tower edges connect bottom-up, then a scan of light.
  function drawTower(t) {
    if (S.archA <= 0.002) return;
    const SL = P.SLOTS;
    for (const [sa, sb, level, kind] of P.EDGES) {
      const i = SL[sa].p, j = SL[sb].p;
      if (!CUR.vis[i] || !CUR.vis[j]) continue;
      const w = Math.min(CUR.wt[i], CUR.wt[j]);
      if (w < 0.02) continue;
      const local = clamp(S.archEdges * 11 - level - (kind === 2 ? 1.6 : kind * 0.5));
      if (local <= 0) continue;
      const x0 = CUR.sx[i], y0 = CUR.sy[i];
      const x1 = lerp(x0, CUR.sx[j], local), y1 = lerp(y0, CUR.sy[j], local);
      const my = (y0 + y1) / 2;
      const kd = Math.min(CUR.k[i], CUR.k[j]);
      const scan = S.lineA * Math.exp(-Math.pow((my - S.lineY) / 60, 2));
      const litAbove = S.archLit * smoothstep(-40, 160, my - S.lineY);
      const base = (kind === 2 ? 0.2 : 0.42) * (0.35 + 0.65 * clamp((kd - 0.6) / 0.6));
      const a = S.archA * w * (base + 0.55 * litAbove * base + 0.9 * scan);
      if (a < 0.004) continue;
      bg.lineWidth = kind === 2 ? 0.8 : 1.1 + scan * 0.8;
      const warmMix = clamp(scan * 1.4 + litAbove * 0.25);
      const r = Math.round(lerp(212, 255, warmMix)), g = Math.round(lerp(218, 222, warmMix)), b = Math.round(lerp(228, 186, warmMix));
      bg.strokeStyle = `rgba(${r},${g},${b},${clamp(a)})`;
      bg.beginPath(); bg.moveTo(x0, y0); bg.lineTo(x1, y1); bg.stroke();
    }
  }

  // Scene 06 — fine luminous lines converging on the centre.
  const CONV = Array.from({ length: 72 }, (_, k) => ({
    th: (k / 72) * Math.PI * 2 + (rnd() - 0.5) * 0.06,
    len: 160 + rnd() * 420, d: rnd(), w: 0.6 + rnd() * 0.9, warm: rnd() < 0.35,
  }));
  function drawConvLines() {
    if (S.convLines <= 0.002 || S.convA <= 0.002) return;
    const cy = 914;
    for (const c of CONV) {
      const q = stag(S.convLines, c.d, 0.55);
      if (q <= 0 || q >= 1) continue;
      const e = q * q;
      const rIn = lerp(1350, 6, e);
      const rOut = rIn + c.len * (1 - 0.65 * e);
      const cx = Math.cos(c.th), sy = Math.sin(c.th);
      const x0 = CX + cx * rOut, y0 = cy + sy * rOut, x1 = CX + cx * rIn, y1 = cy + sy * rIn;
      const a = S.convA * smoothstep(0, 0.18, q) * (1 - smoothstep(0.86, 1, q)) * 0.75;
      const g = bg.createLinearGradient(x0, y0, x1, y1);
      const col = c.warm ? '255,226,186' : '226,231,238';
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${clamp(a)})`);
      bg.strokeStyle = g; bg.lineWidth = c.w;
      bg.beginPath(); bg.moveTo(x0, y0); bg.lineTo(x1, y1); bg.stroke();
    }
  }

  function drawParticles() {
    for (let i = 0; i < N; i++) {
      const a0 = CUR.a[i];
      if (a0 <= 0.004 || !CUR.vis[i]) continue;
      const k = CUR.k[i];
      let a = a0 * clamp(0.3 + 0.7 * (k - 0.55) / 0.55);
      // dust catches the key light in scene 01
      if (S.dustLit < 0.999 && i >= NNET) {
        const d = Math.hypot(CUR.sx[i] - CX, CUR.sy[i] - S.haloY);
        const fall = Math.exp(-Math.pow(d / Math.max(80, S.haloR * 0.55), 2));
        a *= lerp(0.18 + 0.82 * fall, 1, S.dustLit);
      }
      const structural = i < NNET && (CUR.wn[i] > 0.05 || CUR.wt[i] > 0.05);
      const near = !structural && k > 1.6;
      const warm = CUR.warm[i] > 0.5;
      const spr = near ? (warm ? SPR.bokehAmber : SPR.bokeh) : warm ? SPR.amber : SPR.white;
      let size = near ? Math.min(90, CUR.s[i] * k * 16) : Math.min(30, CUR.s[i] * k * (structural ? 14 : 13));
      if (near) a *= 0.32 / k;
      const x = CUR.sx[i], y = CUR.sy[i];
      if (!near && PREV.vis[i]) {
        const dx = x - PREV.sx[i], dy = y - PREV.sy[i];
        const d = Math.hypot(dx, dy);
        if (d > 2.2 && d < 420) {
          // motion blur: energy spread along the path → dimmer, longer
          const core = Math.max(0.9, CUR.s[i] * k * 0.95);
          bg.globalAlpha = clamp(a * Math.min(1, 6 / (d + 2)) * 1.4);
          bg.strokeStyle = warm ? 'rgb(255,224,186)' : 'rgb(232,236,242)';
          bg.lineWidth = core; bg.lineCap = 'round';
          bg.beginPath(); bg.moveTo(PREV.sx[i], PREV.sy[i]); bg.lineTo(x, y); bg.stroke();
          a *= Math.min(1, 10 / (d + 6)) + 0.25;
        }
      }
      bg.globalAlpha = clamp(a);
      bg.drawImage(spr, x - size / 2, y - size / 2, size, size);
    }
    bg.globalAlpha = 1;
  }

  // Readability pocket: gently darkens structure behind the type block.
  function drawClearing() {
    if (S.clearA <= 0.002) return;
    bg.save();
    bg.globalCompositeOperation = 'source-over';
    bg.translate(CX, CY); bg.scale(1, 0.62);
    const g = bg.createRadialGradient(0, 0, 0, 0, 0, 560);
    g.addColorStop(0, `rgba(5,5,5,${0.72 * S.clearA})`);
    g.addColorStop(0.55, `rgba(5,5,5,${0.45 * S.clearA})`);
    g.addColorStop(1, 'rgba(5,5,5,0)');
    bg.fillStyle = g; bg.fillRect(-560, -560, 1120, 1120);
    bg.restore();
  }

  function drawBG(t) {
    bg.save();   // every frame starts from the same context state (no lineCap etc. leaking between frames)
    bg.globalCompositeOperation = 'source-over';
    bg.globalAlpha = 1;
    bg.lineCap = 'butt';
    bg.fillStyle = '#050505'; bg.fillRect(0, 0, W, H);
    if (S.baseA > 0.002) { bg.globalAlpha = S.baseA; bg.drawImage(BASE, 0, 0); bg.globalAlpha = 1; }
    bg.globalCompositeOperation = 'lighter';
    drawHaze(t);
    drawHalo(t);
    drawBeam(t);
    drawRings(t);
    drawNetwork(t);
    drawTower(t);
    drawConvLines();
    drawParticles();
    drawClearing();
    bg.restore();
  }

  /* ---------- foreground (mix-blend-mode: screen) ---------- */
  const EMBERS = Array.from({ length: 64 }, () => ({
    th: rnd() * Math.PI * 2, v: 120 + rnd() * 380, d: rnd() * 0.25, s: 0.6 + rnd() * 1.4, warm: rnd() < 0.7,
  }));
  function drawFG(t) {
    fg.save();
    fg.globalCompositeOperation = 'source-over';
    fg.globalAlpha = 1;
    fg.clearRect(0, 0, W, H);

    // luminous sweep (scene 01 → 02)
    if (S.sweepA > 0.002) {
      const x = S.sweepX;
      for (const [hw, col, al] of [[420, '217,166,108', 0.1], [150, '255,232,206', 0.28], [26, '255,250,244', 0.9]]) {
        const g = fg.createLinearGradient(x - hw, 0, x + hw, 0);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${al * S.sweepA})`); g.addColorStop(1, `rgba(${col},0)`);
        fg.fillStyle = g; fg.fillRect(x - hw, 0, 2 * hw, H);
      }
      fg.globalCompositeOperation = 'destination-in';
      const v = fg.createLinearGradient(0, 0, 0, H);
      v.addColorStop(0, 'rgba(0,0,0,.15)'); v.addColorStop(0.48, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,.15)');
      fg.fillStyle = v; fg.fillRect(0, 0, W, H);
      fg.globalCompositeOperation = 'source-over';
    }

    fg.globalCompositeOperation = 'lighter';
    // the line of light (scan → precision line → seed point)
    if (S.lineA > 0.002) {
      const y = S.lineY, L = S.lineLen / 2;
      if (L > 1) {
        for (const [h, al] of [[1.6, 0.95], [7, 0.2], [34, 0.05]]) {
          const g = fg.createLinearGradient(CX - L, 0, CX + L, 0);
          g.addColorStop(0, 'rgba(255,236,214,0)'); g.addColorStop(0.18, `rgba(255,240,224,${al * S.lineA * 0.7})`);
          g.addColorStop(0.5, `rgba(255,248,240,${al * S.lineA})`); g.addColorStop(0.82, `rgba(255,240,224,${al * S.lineA * 0.7})`);
          g.addColorStop(1, 'rgba(255,236,214,0)');
          fg.fillStyle = g; fg.fillRect(CX - L, y - h / 2, 2 * L, h);
        }
      }
      if (S.pointA > 0.002) {
        const s = 70;
        fg.globalAlpha = clamp(S.pointA);
        fg.drawImage(SPR.amber, CX - s / 2, y - s / 2, s, s);
        fg.drawImage(SPR.white, CX - s / 5, y - s / 5, (2 * s) / 5, (2 * s) / 5);
        fg.globalAlpha = 1;
      }
    }

    // light leak (scene 02 crescendo)
    if (S.leakA > 0.002) {
      const g = fg.createRadialGradient(140, 1760, 0, 140, 1760, 1500);
      g.addColorStop(0, `rgba(226,150,88,${0.42 * S.leakA})`);
      g.addColorStop(0.4, `rgba(217,166,108,${0.14 * S.leakA})`);
      g.addColorStop(1, 'rgba(217,166,108,0)');
      fg.fillStyle = g; fg.fillRect(0, 0, W, H);
      const g2 = fg.createRadialGradient(980, 180, 0, 980, 180, 1100);
      g2.addColorStop(0, `rgba(255,236,214,${0.18 * S.leakA})`); g2.addColorStop(1, 'rgba(255,236,214,0)');
      fg.fillStyle = g2; fg.fillRect(0, 0, W, H);
    }

    // flash at the final reveal
    if (S.flash > 0.002) {
      const f = S.flash;
      const g = fg.createRadialGradient(CX, 914, 0, CX, 914, 640);
      g.addColorStop(0, `rgba(255,248,240,${0.8 * f})`);
      g.addColorStop(0.1, `rgba(250,222,186,${0.36 * f})`);
      g.addColorStop(0.4, `rgba(217,166,108,${0.08 * f})`);
      g.addColorStop(1, 'rgba(217,166,108,0)');
      fg.fillStyle = g; fg.fillRect(0, 0, W, H);
      const L = 380 + 520 * f;
      for (const [h, al] of [[2, 0.9], [10, 0.25], [40, 0.06]]) {
        const s = fg.createLinearGradient(CX - L, 0, CX + L, 0);
        s.addColorStop(0, 'rgba(255,226,190,0)'); s.addColorStop(0.5, `rgba(255,244,230,${al * f})`); s.addColorStop(1, 'rgba(255,226,190,0)');
        fg.fillStyle = s; fg.fillRect(CX - L, 914 - h / 2, 2 * L, h);
      }
    }

    // embers drifting out of the reveal
    if (S.embersA > 0.002) {
      for (const e of EMBERS) {
        const q = clamp((S.embers - e.d) / (1 - e.d));
        if (q <= 0) continue;
        const r = e.v * (1 - Math.exp(-q * 2.6)) + 40;
        const x = CX + Math.cos(e.th) * r * 0.85, y = 914 + Math.sin(e.th) * r * 1.15 - q * 40;
        const a = S.embersA * smoothstep(0, 0.08, q) * (1 - q) * 0.9;
        const s = e.s * 12;
        fg.globalAlpha = clamp(a);
        fg.drawImage(e.warm ? SPR.amber : SPR.white, x - s / 2, y - s / 2, s, s);
      }
      fg.globalAlpha = 1;
    }
    fg.restore();
  }

  /* ======================================================================
     TYPE — split into characters at their kerned positions
     ====================================================================== */
  const BASELINE = 0.8638; // Inter / Inter Display, line-height 1 (asc .96875, desc .2412)

  // Optical spacing for widely tracked capitals: equalise the *ink* gaps between
  // glyphs (instead of advance widths), with side corrections for open and round
  // shapes, keeping the word's overall measure. Fixes "INTEL L I GENCE".
  const OPT = off(8, 8).getContext('2d');
  const SIDE_L = { C: -0.035, G: -0.035, O: -0.035, Q: -0.035, S: -0.02, T: -0.04, A: -0.03, V: -0.03, W: -0.02, Y: -0.03, J: -0.02 };
  const SIDE_R = { D: -0.035, O: -0.035, Q: -0.035, S: -0.02, C: -0.03, E: -0.025, F: -0.04, L: -0.085, T: -0.04, P: -0.03, A: -0.03, V: -0.03, W: -0.02, Y: -0.03, K: -0.02 };
  function opticalOrigins(m, el) {
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    OPT.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    const ink = m.map((o) => {
      if (o.c === ' ') return null;
      const q = OPT.measureText(o.c);
      return { l: -q.actualBoundingBoxLeft, r: q.actualBoundingBoxRight };
    });
    const idx = m.map((o, i) => i).filter((i) => m[i].c !== ' ');
    const Lx = (i) => m[i].x + ink[i].l, Rx = (i) => m[i].x + ink[i].r;
    let inkSum = 0, fixed = 0, pairs = 0;
    const gaps = [];
    idx.forEach((i) => { inkSum += ink[i].r - ink[i].l; });
    for (let k = 1; k < idx.length; k++) {
      const a = idx[k - 1], b = idx[k];
      if (b - a > 1) { const g = Lx(b) - Rx(a); gaps.push({ word: true, g }); fixed += g; }
      else {
        const adj = ((SIDE_R[m[a].c] || 0) + (SIDE_L[m[b].c] || 0) + (m[b].c === '.' ? -0.05 : 0)) * fs;
        gaps.push({ word: false, adj }); fixed += adj; pairs++;
      }
    }
    const span = Rx(idx[idx.length - 1]) - Lx(idx[0]);
    const G = (span - inkSum - fixed) / Math.max(1, pairs);
    const x = m.map((o) => o.x);
    let cur = Lx(idx[0]);
    idx.forEach((i, k) => {
      if (k > 0) cur += gaps[k - 1].word ? gaps[k - 1].g : G + gaps[k - 1].adj;
      x[i] = cur - ink[i].l;
      cur += ink[i].r - ink[i].l;
    });
    return x;
  }

  function splitEl(el) {
    let lines = [...el.querySelectorAll(':scope > .line')];
    if (!lines.length) {
      const s = document.createElement('span'); s.className = 'line'; s.textContent = el.textContent;
      el.textContent = ''; el.appendChild(s); lines = [s];
    }
    const accentLine = el.dataset.accentLine != null ? +el.dataset.accentLine : lines.length - 1;
    const accentFrom = el.dataset.accent != null ? +el.dataset.accent : -1;
    const ls = parseFloat(getComputedStyle(el).letterSpacing) || 0;
    const out = [];
    lines.forEach((line, li) => {
      const text = line.textContent;
      line.textContent = '';
      const ln = document.createElement('span'); ln.className = 'ln';
      const ghost = document.createElement('span'); ghost.textContent = text; ghost.style.whiteSpace = 'pre';
      ln.appendChild(ghost); line.appendChild(ln);
      const node = ghost.firstChild, range = document.createRange();
      const base = ln.getBoundingClientRect();
      const m = [];
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        m.push({ c: text[i], x: r.left - base.left, w: r.width });
      }
      const x0 = m[0].x, last = m[m.length - 1];
      const ink = last.x + last.w - ls - x0;
      const origins = el.hasAttribute('data-optical') ? opticalOrigins(m, el) : m.map((o) => o.x);
      ln.removeChild(ghost);
      ln.style.width = ink + 'px';
      const fsz = parseFloat(getComputedStyle(el).fontSize);
      const chars = m.map((o, i) => {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = o.c;
        s.style.left = origins[i] - x0 + 'px';
        s._tk = (i - (text.length - 1) / 2) * fsz;   // px of offset per 1em of extra tracking
        if (li === accentLine && accentFrom >= 0 && i >= accentFrom) s.classList.add('acc');
        ln.appendChild(s);
        return s;
      });
      let sheen = null;
      if (el.hasAttribute('data-sheen')) {
        sheen = document.createElement('span'); sheen.className = 'sheen'; sheen.textContent = text;
        sheen.style.left = -x0 + 'px';
        ln.appendChild(sheen);
      }
      out.push({ line, ln, chars, sheen, text, width: ink });
    });
    el._lines = out;
    el._chars = out.flatMap((o) => o.chars.filter((c) => c.textContent !== ' '));
    return el;
  }

  function placeEl(el) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const lines = el._lines.length;
    const gap = lines > 1 ? parseFloat(getComputedStyle(el._lines[1].line).marginTop) : 0;
    const h = lines * fs + (lines - 1) * gap;
    const cy = parseFloat(el.dataset.cy || CY);
    el.style.top = cy - h / 2 + 'px';
    el._fs = fs; el._top = cy - h / 2; el._h = h; el._gap = gap;
  }

  /* ======================================================================
     TIMELINE
     ====================================================================== */
  const LBL = { awakening: 0, reveal: 4, motion: 8, creation: 13, precision: 18, final: 23, outro: 27, end: 30 };
  const master = gsap.timeline({ paused: true, defaults: { ease: 'none', lazy: false } });
  Object.entries(LBL).forEach(([k, v]) => master.addLabel(k, v));
  const pos = (label, off) => `${label}${off < 0 ? '-=' : '+='}${Math.abs(off)}`;
  const T = (label, off = 0) => +(LBL[label] + off).toFixed(4);
  const CUES = [];
  const cue = (kind, label, off, extra = {}) => CUES.push({ t: T(label, off), kind, ...extra });

  // state tween: tw('awakening', 0.45, 1.1, { coreA: [0, 1] }, 'power2.inOut')
  function tw(label, off, dur, props, ease = 'none', target = S) {
    const from = {}, to = {};
    for (const [k, [a, b]] of Object.entries(props)) { from[k] = a; to[k] = b; }
    master.fromTo(target, from, { ...to, duration: dur, ease, immediateRender: false }, pos(label, off));
  }
  // element tween with explicit from/to
  function ft(targets, label, off, dur, from, to, ease = 'none', extra = {}) {
    master.fromTo(targets, from, { ...to, duration: dur, ease, immediateRender: false, ...extra }, pos(label, off));
  }

  // Extra tracking (em) animated as each character's x, so GSAP owns every transform.
  function track(el, label, off, dur, fromEm, toEm, ease) {
    const ch = el._chars;
    master.set(ch, { x: (i, c) => c._tk * fromEm }, 0);
    master.fromTo(ch, { x: (i, c) => c._tk * fromEm },
      { x: (i, c) => c._tk * toEm, duration: dur, ease, immediateRender: false }, pos(label, off));
  }

  // Inverse of an ease: time at which `prop` (tween from a→b over [t0, t0+dur]) reaches v.
  function timeAt(t0, dur, a, b, v, ease) {
    const fn = gsap.parseEase(ease);
    const target = (v - a) / (b - a);
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fn(mid) < target) lo = mid; else hi = mid; }
    return t0 + ((lo + hi) / 2) * dur;
  }

  function buildTimeline(TX) {
    const { intel, intro, claude, opus, refl, think, solve, build, reason, create, execute, less, more, better, fin, tag } = TX;
    const gReveal = $('g-reveal'), gThink = $('g-think'), gBuild = $('g-build'), gFinal = $('g-final');
    const floor = $('floor'), gTop = $('guide-top'), gBot = $('guide-bot'), rule = $('tag-rule'), fade = $('fade');

    // char centres of INTELLIGENCE at its final tracking (needed to sync the sweep)
    const intelX = intel._chars.map((c) => { const r = c.getBoundingClientRect(); return r.left + r.width / 2; });

    /* ---- initial DOM state (time 0) ---- */
    const allChars = [intel, intro, claude, opus, refl, think, solve, build, reason, create, execute, less, more, better, fin, tag].flatMap((e) => e._chars);
    master.set(allChars, { opacity: 0 }, 0);
    master.set([floor, gTop, gBot, rule], { scaleX: 0, opacity: 0 }, 0);
    master.set(fade, { opacity: 0 }, 0);

    /* ================= SCENE 01 — THE AWAKENING (0–4 s) ================= */
    tw('awakening', 0.0, 2.6, { baseA: [0, 0.75] }, 'sine.inOut');
    tw('awakening', 0.45, 1.1, { coreA: [0, 1], coreR: [0, 1] }, 'power2.inOut');
    tw('awakening', 0.7, 0.8, { streakA: [0, 0.55] }, 'sine.inOut');
    tw('awakening', 0.7, 2.0, { streakL: [0, 520] }, 'expo.out');
    tw('awakening', 0.9, 1.6, { haloA: [0, 0.62] }, 'power2.out');
    tw('awakening', 0.9, 2.4, { haloR: [30, 860] }, 'expo.out');
    tw('awakening', 1.0, 2.0, { fogA: [0, 1], hazeA: [0, 1] }, 'sine.inOut');
    tw('awakening', 0.6, 2.2, { dustA: [0, 0.8] }, 'sine.inOut');
    tw('awakening', 1.1, 0.6, { beamA: [0, 1] }, 'sine.inOut');
    tw('awakening', 1.1, 2.3, { beamP: [0, 1] }, 'sine.inOut');
    tw('awakening', 2.9, 0.5, { beamA: [1, 0] }, 'sine.inOut');
    tw('awakening', 0.0, 4.0, { camZ: [0, 70] }, 'none');
    tw('awakening', 1.75, 0.8, { coreA: [1, 0] }, 'sine.inOut');
    tw('awakening', 1.55, 0.7, { streakA: [0.55, 0] }, 'sine.inOut');
    tw('awakening', 1.7, 1.2, { haloCore: [1, 0.22] }, 'sine.inOut');

    // INTELLIGENCE — light, wide tracking settling to its exact measure
    track(intel, 'awakening', 1.6, 1.6, 0.5, 0, 'expo.out');
    ft(intel._chars, 'awakening', 1.65, 1.2,
      { opacity: 0, filter: 'blur(14px) brightness(1)', yPercent: 18 },
      { opacity: 1, filter: 'blur(0px) brightness(1)', yPercent: 0, stagger: { each: 0.055, from: 'center' } }, 'power3.out');
    ft(intel, 'awakening', 1.9, 1.2, { filter: 'drop-shadow(0px 0px 0px rgba(217,166,108,0))' },
      { filter: 'drop-shadow(0px 0px 22px rgba(217,166,108,0.42))' }, 'sine.inOut');
    cue('drone', 'awakening', 0.15);
    cue('lightOn', 'awakening', 0.45);
    cue('beam', 'awakening', 1.1, { dur: 2.3 });
    cue('word', 'awakening', 1.65, { dur: 1.2 });

    // the luminous sweep: wipes the word away left→right and unveils scene 02
    tw('awakening', 3.02, 0.18, { sweepA: [0, 1] }, 'sine.out');
    tw('awakening', 3.1, 0.78, { sweepX: [-300, 1420] }, 'power2.inOut');
    tw('awakening', 3.72, 0.3, { sweepA: [1, 0] }, 'sine.in');
    {
      const t0 = T('awakening', 3.1);
      intel._chars.forEach((c, k) => {
        const xc = intelX[k];
        const tc = timeAt(t0, 0.78, -300, 1420, xc, 'power2.inOut') - 0.05;
        master.fromTo(c, { opacity: 1, filter: 'blur(0px) brightness(1)', x: 0 },
          { opacity: 0, filter: 'blur(9px) brightness(2.4)', x: 34, duration: 0.2, ease: 'none', immediateRender: false }, tc);
      });
    }
    tw('awakening', 3.25, 0.25, { haloBoost: [0, 0.45] }, 'sine.out');
    tw('awakening', 3.5, 0.9, { haloBoost: [0.45, 0] }, 'sine.inOut');
    tw('awakening', 3.3, 1.5, { haloR: [860, 600], haloA: [0.62, 0.34] }, 'sine.inOut');
    tw('awakening', 3.4, 1.4, { dustLit: [0, 1] }, 'sine.inOut');
    cue('sweep', 'awakening', 3.1, { dur: 0.78 });

    /* ================= SCENE 02 — THE REVEAL (4–8 s) ================= */
    tw('awakening', 3.12, 0.15, { ringsA: [0, 1] }, 'none');
    tw('awakening', 3.1, 1.9, { ringsDraw: [0.3, 1] }, 'power2.out');
    tw('awakening', 3.1, 3.9, { ringsRot: [0, 1.25] }, 'none');
    tw('reveal', 3.0, 1.0, { ringsRot: [1.25, 3.7] }, 'power2.in');
    tw('awakening', 3.1, 3.4, { ringsScale: [0.92, 1] }, 'sine.out');
    tw('reveal', 3.3, 0.85, { ringsScale: [1, 3.1] }, 'power2.in');
    tw('reveal', 1.95, 0.25, { ringsBright: [1, 1.9] }, 'power2.out');
    tw('reveal', 2.2, 0.8, { ringsBright: [1.9, 1.2] }, 'sine.inOut');
    tw('reveal', 3.0, 0.7, { ringsBright: [1.2, 2.5] }, 'power2.in');
    tw('reveal', 3.6, 0.55, { ringsA: [1, 0] }, 'power1.in');
    tw('reveal', 0.0, 4.0, { camZ: [70, 150] }, 'none');
    tw('reveal', 0.6, 1.2, { clearA: [0, 0.55] }, 'sine.inOut');
    tw('reveal', 1.95, 0.15, { haloBoost: [0, 0.32] }, 'power2.out');
    tw('reveal', 2.1, 0.9, { haloBoost: [0.32, 0] }, 'sine.out');
    tw('reveal', 3.0, 0.7, { haloBoost: [0, 0.75] }, 'power2.in');
    tw('reveal', 3.7, 0.7, { haloBoost: [0.75, 0] }, 'sine.out');
    tw('reveal', 3.2, 0.9, { haloA: [0.34, 0], dustA: [0.8, 0.5] }, 'sine.inOut');
    tw('reveal', 3.35, 0.35, { leakA: [0, 0.7] }, 'power2.in');
    tw('reveal', 3.7, 0.9, { leakA: [0.7, 0] }, 'sine.out');

    ft(intro._chars, 'reveal', 0.25, 0.85, { opacity: 0, yPercent: 105 },
      { opacity: 1, yPercent: 0, stagger: { each: 0.028, from: 'start' } }, 'expo.out');
    ft(intro, 'reveal', 1.2, 0.8, { opacity: 1 }, { opacity: 0.5 }, 'sine.inOut');
    cue('pulse', 'reveal', 0.25, { note: 0 });

    ft(claude._chars, 'reveal', 0.9, 1.15, { opacity: 0, yPercent: 110, filter: 'blur(10px)' },
      { opacity: 1, yPercent: 0, filter: 'blur(0px)', stagger: { each: 0.055, from: 'start' } }, 'expo.out');
    cue('pulse', 'reveal', 0.9, { note: 1 });
    ft([...opus._chars, ...refl._chars], 'reveal', 1.75, 1.15, { opacity: 0, yPercent: 110, filter: 'blur(10px)' },
      { opacity: 1, yPercent: 0, filter: 'blur(0px)', stagger: { each: 0.055, from: 'start' } }, 'expo.out');
    cue('impact', 'reveal', 1.95);
    ft(floor, 'reveal', 1.9, 1.1, { scaleX: 0, opacity: 0 }, { scaleX: 0.72, opacity: 1 }, 'expo.out');
    ft(gReveal, 'reveal', 0.9, 2.4, { scale: 0.975 }, { scale: 1 }, 'sine.out');
    // crescendo → zoom through the title into scene 03
    ft(gReveal, 'reveal', 3.3, 0.75, { scale: 1, opacity: 1, filter: 'blur(0px)' },
      { scale: 1.9, opacity: 0, filter: 'blur(18px)' }, 'power3.in');
    cue('riser', 'reveal', 2.95, { dur: 0.85 });
    cue('through', 'reveal', 3.55);

    /* ================= SCENE 03 — INTELLIGENCE IN MOTION (8–13 s) ================= */
    master.set(S, { mCloud: 1 }, T('reveal', 3.45));
    tw('reveal', 3.5, 1.4, { netScale: [0.04, 1] }, 'expo.out');
    tw('reveal', 3.55, 0.7, { netA: [0, 1] }, 'sine.out');
    tw('motion', 0.15, 1.2, { netEdges: [0, 1] }, 'power2.out');
    tw('reveal', 3.5, 5.5, { netRot: [0, 1.7] }, 'sine.inOut');
    tw('motion', 0.6, 1.0, { netPulse: [0, 1] }, 'sine.inOut');
    tw('motion', 1.45, 1.55, { mLat: [0, 1] }, 'none');
    tw('motion', 3.05, 1.5, { mSph: [0, 1] }, 'none');
    tw('motion', 0.0, 5.0, { camYaw: [0, 0.16] }, 'sine.inOut');
    tw('motion', 0.0, 0.8, { clearA: [0.55, 1] }, 'sine.out');
    tw('motion', 0.1, 1.2, { dustA: [0.5, 0.35] }, 'sine.inOut');

    // THINK DEEPER. — masked rise; exits by receding into depth
    think._lines.forEach((L, li) => {
      ft(L.chars, 'motion', 0.2 + li * 0.12, 0.95, { opacity: 0, yPercent: 108 },
        { opacity: 1, yPercent: 0, stagger: 0.032 }, 'expo.out');
    });
    ft(gThink, 'motion', 0.2, 1.25, { scale: 0.955 }, { scale: 1 }, 'sine.out');
    ft(gThink, 'motion', 1.45, 0.38, { scale: 1, opacity: 1, filter: 'blur(0px)' },
      { scale: 0.84, opacity: 0, filter: 'blur(10px)' }, 'power2.in');
    cue('pulse', 'motion', 0.2, { note: 2 });
    cue('recede', 'motion', 1.45);

    // SOLVE COMPLEX PROBLEMS. — characters assemble from scattered positions
    {
      const r = mulberry32(77);
      const scatter = solve._chars.map(() => ({ x: (r() * 2 - 1) * 72, y: (r() * 2 - 1) * 42, rot: (r() * 2 - 1) * 8 }));
      solve._chars.forEach((c, k) => {
        const off = 1.76 + r() * 0.22;
        master.fromTo(c, { opacity: 0, x: scatter[k].x, y: scatter[k].y, rotation: scatter[k].rot, filter: 'blur(10px)' },
          { opacity: 1, x: 0, y: 0, rotation: 0, filter: 'blur(0px)', duration: 0.85, ease: 'expo.out', immediateRender: false }, T('motion', off));
        master.fromTo(c, { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' },
          { opacity: 0, x: -scatter[k].x * 0.4, y: -scatter[k].y * 0.4, filter: 'blur(8px)', duration: 0.3, ease: 'power2.in', immediateRender: false },
          T('motion', 3.0 + r() * 0.06));
      });
    }
    cue('assemble', 'motion', 1.76, { dur: 0.5 });
    cue('scatter', 'motion', 3.0);

    // BUILD WITH PRECISION. — guides draw in, tracking snaps to the grid
    ft([gTop, gBot], 'motion', 3.3, 0.8, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, stagger: 0.08 }, 'expo.out');
    track(build, 'motion', 3.38, 1.0, 0.32, 0, 'expo.out');
    ft(build._chars, 'motion', 3.38, 0.75, { opacity: 0, filter: 'blur(6px)' },
      { opacity: 1, filter: 'blur(0px)', stagger: { each: 0.016, from: 'edges' } }, 'power2.out');
    ft([gTop, gBot], 'motion', 4.62, 0.4, { scaleX: 1, opacity: 1 }, { scaleX: 0, opacity: 0 }, 'power2.in');
    ft(gBuild, 'motion', 4.62, 0.42, { opacity: 1, y: 0 }, { opacity: 0, y: -26 }, 'power2.in');
    cue('guides', 'motion', 3.3);
    cue('pulse', 'motion', 3.38, { note: 3 });

    /* ================= SCENE 04 — FROM REASONING TO CREATION (13–18 s) ================= */
    tw('motion', 4.65, 0.55, { netEdges: [1, 0], netPulse: [1, 0] }, 'sine.in');
    tw('motion', 4.75, 1.85, { mTower: [0, 1] }, 'none');
    tw('motion', 4.8, 0.7, { archA: [0, 1] }, 'sine.out');
    tw('motion', 4.8, 1.0, { netA: [1, 0] }, 'sine.inOut');
    tw('motion', 4.75, 5.4, { towerRot: [0, 1.05] }, 'none');
    tw('creation', 0.0, 5.0, { camPitch: [0, -0.07], camYaw: [0.16, 0.05] }, 'sine.inOut');
    tw('creation', 0.0, 1.0, { dustA: [0.35, 0.42] }, 'sine.inOut');
    tw('creation', 0.0, 1.0, { clearA: [1, 0.6] }, 'sine.inOut');
    cue('gather', 'motion', 4.75, { dur: 1.6 });

    // REASON. — vertical masked rise, exits upward through the mask
    ft(reason._chars, 'creation', 0.35, 0.95, { opacity: 0, yPercent: 108, filter: 'blur(6px)' },
      { opacity: 1, yPercent: 0, filter: 'blur(0px)', stagger: 0.045 }, 'expo.out');
    ft(reason._chars, 'creation', 1.5, 0.34, { yPercent: 0, opacity: 1 }, { yPercent: -108, opacity: 0, stagger: 0.02 }, 'power2.in');
    cue('pulse', 'creation', 0.35, { note: 4 });

    // CREATE. — dimensional: characters hinge up from the baseline in 3D
    tw('creation', 1.45, 1.75, { archEdges: [0, 1] }, 'power1.inOut');
    ft(create._chars, 'creation', 1.85, 1.05, { opacity: 0, rotationX: -96 },
      { opacity: 1, rotationX: 0, stagger: 0.05 }, 'power3.out');
    ft(create._chars, 'creation', 3.05, 0.34, { opacity: 1, rotationX: 0 }, { opacity: 0, rotationX: 92, stagger: 0.028 }, 'power2.in');
    cue('pulse', 'creation', 1.85, { note: 5 });
    cue('build', 'creation', 1.45, { dur: 1.75 });

    // EXECUTE. — a rising scan line reveals it (clip computed per frame from S.lineY)
    tw('creation', 3.0, 0.25, { lineA: [0, 1] }, 'sine.out');
    tw('creation', 3.0, 0.4, { lineLen: [0, 500] }, 'expo.out');
    tw('creation', 3.05, 1.3, { lineY: [1580, 640] }, 'power2.inOut');
    tw('creation', 3.3, 1.2, { archLit: [0, 1] }, 'sine.inOut');
    master.set(execute._chars, { opacity: 1 }, T('creation', 3.0));
    {
      const fs = execute._fs, top = execute._top;
      const tMid = timeAt(T('creation', 3.05), 1.3, 1580, 640, top + 0.5 * fs, 'power2.inOut');
      ft(execute, 'creation', tMid - LBL.creation - 0.1, 0.5, { filter: 'brightness(1.9) blur(0px)' }, { filter: 'brightness(1) blur(0px)' }, 'sine.out');
      cue('scan', 'creation', 3.05, { dur: 1.3 });
      CUES.push({ t: +tMid.toFixed(3), kind: 'pulse', note: 6 });
    }
    ft(execute, 'creation', 4.5, 0.6, { opacity: 1, y: 0 }, { opacity: 0, y: -14 }, 'sine.in');
    tw('creation', 4.45, 0.95, { archA: [1, 0], dustA: [0.42, 0], clearA: [0.6, 0], baseA: [0.75, 0.22] }, 'sine.inOut');
    tw('creation', 4.5, 0.65, { lineLen: [500, 880], lineY: [640, 700] }, 'expo.inOut');
    cue('settle', 'creation', 4.55);

    /* ================= SCENE 05 — THE POWER OF PRECISION (18–23 s) ================= */
    const L0 = T('precision', 0.15), LD = 3.75;
    tw('precision', 0.15, LD, { lineY: [700, 1240] }, 'sine.inOut');
    tw('precision', 3.95, 0.5, { lineY: [1240, 1262] }, 'sine.out');
    [less, more, better].forEach((el, k) => {
      const capTop = el._top + 0.13 * el._fs;
      const tr = timeAt(L0, LD, 700, 1240, capTop, 'sine.inOut');
      master.set(el._chars, { opacity: 1 }, tr - 0.02);
      master.set(el._chars, { x: (i, c) => c._tk * 0.1 }, 0);
      master.fromTo(el._chars, { x: (i, c) => c._tk * 0.1 }, { x: 0, duration: 1.6, ease: 'expo.out', immediateRender: false }, tr);
      master.fromTo(el, { y: 10 }, { y: 0, duration: 1.6, ease: 'expo.out', immediateRender: false }, tr);
      master.fromTo(el, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)', duration: 0.9, ease: 'sine.out', immediateRender: false }, tr + 0.15);
      CUES.push({ t: +tr.toFixed(3), kind: 'quiet', note: k });
      master.fromTo(el, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'sine.in', immediateRender: false }, T('precision', 4.5 + k * 0.08));
    });
    tw('precision', 4.45, 0.55, { lineLen: [880, 0] }, 'expo.in');
    tw('precision', 4.7, 0.3, { pointA: [0, 1] }, 'sine.out');
    tw('precision', 4.95, 0.7, { lineY: [1262, 914] }, 'power2.inOut');
    cue('contract', 'precision', 4.45);

    /* ================= SCENE 06 — THE FINAL REVEAL (23–27 s) ================= */
    master.set(S, { mOut: 1 }, T('precision', 3.0));
    tw('final', 0.0, 0.5, { convA: [0, 1] }, 'sine.out');
    tw('final', 0.0, 1.42, { mConv: [0, 1] }, 'none');
    tw('final', 0.05, 1.37, { convLines: [0, 1] }, 'none');
    tw('final', 0.1, 1.0, { ringsA: [0, 0.55], baseA: [0.22, 0.6] }, 'sine.inOut');
    tw('final', 0.1, 1.32, { ringsScale: [3.1, 0.12] }, 'power2.in');
    tw('final', 0.0, 0.1, { ringsBright: [2.5, 1.3] }, 'none');
    tw('final', 0.1, 1.32, { ringsRot: [3.7, 6.2] }, 'power1.in');
    tw('final', 1.1, 0.32, { ringsA: [0.55, 0] }, 'power2.in');
    tw('final', 0.35, 1.05, { haloA: [0, 0.48], haloR: [600, 760] }, 'power2.in');
    tw('final', 0.0, 0.1, { haloY: [CY, 914] }, 'none');
    tw('final', 0.6, 0.8, { pointA: [1, 0] }, 'power2.in');
    tw('final', 1.38, 0.08, { flash: [0, 1] }, 'power2.out');
    tw('final', 1.46, 1.2, { flash: [1, 0] }, 'power2.out');
    tw('final', 1.3, 0.25, { convA: [1, 0] }, 'sine.in');
    tw('final', 0.35, 1.05, { haloCore: [0.22, 1] }, 'power2.in');
    tw('final', 1.42, 0.25, { haloA: [0.48, 0.6], haloR: [760, 820] }, 'power2.out');
    tw('final', 1.67, 2.1, { haloA: [0.6, 0] }, 'sine.inOut');
    tw('final', 1.5, 1.2, { haloCore: [1, 0.3] }, 'sine.out');
    tw('final', 1.42, 2.6, { embers: [0, 1] }, 'none');
    tw('final', 1.42, 0.2, { embersA: [0, 1] }, 'none');
    tw('final', 3.0, 1.0, { embersA: [1, 0] }, 'sine.inOut');
    tw('final', 0.0, 0.6, { fogA: [1, 0.45] }, 'sine.inOut');
    tw('final', 1.42, 2.55, { fogA: [0.45, 0.3] }, 'sine.inOut');
    cue('converge', 'final', 0.0, { dur: 1.42 });
    cue('reveal', 'final', 1.42);

    fin._lines.forEach((L, li) => {
      ft(L.chars, 'final', 1.42 + li * 0.1, 1.25,
        { opacity: 0, scale: 1.12, filter: 'blur(14px) brightness(2.4)' },
        { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)', stagger: { each: 0.03, from: 'center' } }, 'expo.out');
      // refined light sweep across the lockup
      ft(L.sheen, 'final', 2.25 + li * 0.13, 0.12, { opacity: 0 }, { opacity: 1 }, 'none');
      ft(L.sheen, 'final', 2.25 + li * 0.13, 1.35, { '--sx': '100%' }, { '--sx': '0%' }, 'sine.inOut');
      ft(L.sheen, 'final', 3.45 + li * 0.13, 0.15, { opacity: 1 }, { opacity: 0 }, 'none');
    });
    cue('sheen', 'final', 2.25, { dur: 1.35 });

    /* ================= SCENE 07 — THE OUTRO (27–30 s) ================= */
    tw('outro', 0.0, 0.9, { baseA: [0.6, 0.2], fogA: [0.3, 0], hazeA: [1, 0] }, 'sine.inOut');
    ft(fin, 'outro', 0.0, 1.0, { y: 0 }, { y: -44 }, 'power2.inOut');
    ft(gFinal, 'final', 1.42, 5.58, { scale: 1 }, { scale: 1.018 }, 'none');
    ft(rule, 'outro', 0.6, 0.8, { scaleX: 0, opacity: 0 }, { scaleX: 0.11, opacity: 1 }, 'expo.out');
    track(tag, 'outro', 0.7, 1.4, 0.3, 0, 'expo.out');
    ft(tag._chars, 'outro', 0.7, 1.0, { opacity: 0, filter: 'blur(6px)' },
      { opacity: 1, filter: 'blur(0px)', stagger: { each: 0.018, from: 'center' } }, 'power3.out');
    cue('tag', 'outro', 0.7);
    ft(fade, 'outro', 2.35, 0.6, { opacity: 0 }, { opacity: 1 }, 'sine.inOut');
    cue('end', 'outro', 2.35, { dur: 0.6 });

    // pad to exactly 30 s
    master.set({}, {}, LBL.end);
  }

  /* ---------- per-frame DOM hooks that read state (clip reveals) ---------- */
  let HOOK = null;
  function domHooks(t) {
    if (!HOOK) return;
    const { execute, quiet } = HOOK;
    // EXECUTE: visible below the rising scan line
    if (t >= LBL.creation + 2.9 && t < LBL.creation + 5.2) {
      const top = execute._top + (gsap.getProperty(execute, 'y') || 0);
      const cut = clamp(S.lineY - top, 0, execute._h);
      execute.style.clipPath = `inset(${cut}px -200px -40px -200px)`;
    } else execute.style.clipPath = t < LBL.creation + 2.9 ? 'inset(100% 0 0 0)' : 'none';
    // Scene 05: revealed top→down by the descending precision line
    for (const el of quiet) {
      if (t >= LBL.precision && t < LBL.precision + 4.4) {
        const top = el._top + (gsap.getProperty(el, 'y') || 0);
        const cut = clamp(top + el._h - S.lineY, 0, el._h);
        el.style.clipPath = `inset(-40px -200px ${cut}px -200px)`;
      } else el.style.clipPath = t < LBL.precision ? 'inset(0 0 100% 0)' : 'none';
    }
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function renderAt(t) {
    t = clamp(t, 0, DUR);
    const tp = Math.max(0, t - SHUTTER);
    master.seek(tp, true);
    computeParticles(tp, PREV);
    master.seek(t, true);
    computeParticles(t, CUR);
    drawBG(t);
    drawFG(t);
    drawGrain(t);
    domHooks(t);
  }

  /* ---------- preview player ---------- */
  const ui = { play: $('b-play'), restart: $('b-restart'), scrub: $('scrub'), tc: $('tc') };
  const audio = new Audio();
  let hasAudio = false;
  if (!RENDER) {
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', () => { hasAudio = true; }, { once: true });
    audio.addEventListener('error', () => { hasAudio = false; }, { once: true });
    audio.src = 'audio/claude-opus-5-5-sfx.wav';
  }

  let playing = false, tNow = 0, clock0 = 0, raf = 0, lastDrawn = -1;
  const listeners = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); };

  function fit() {
    const pad = 72;
    const s = Math.min(innerWidth / W, (innerHeight - pad) / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${Math.max(8, (innerHeight - pad - H * s) / 2)}px) scale(${s})`;
  }
  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
  function setTime(t) { tNow = clamp(t, 0, DUR); clock0 = performance.now() - tNow * 1000; if (hasAudio) audio.currentTime = tNow; }
  function play() {
    if (tNow >= DUR) setTime(0);
    playing = true; clock0 = performance.now() - tNow * 1000;
    if (hasAudio) { audio.currentTime = tNow; audio.play().catch(() => {}); }
    ui.play.textContent = 'Pause';
  }
  function pause() { playing = false; audio.pause(); ui.play.textContent = 'Play'; }
  function tick(now) {
    if (playing) {
      tNow = hasAudio && !audio.paused ? audio.currentTime : (now - clock0) / 1000;
      if (tNow >= DUR + 1.2) { setTime(0); if (hasAudio) audio.play().catch(() => {}); }
    }
    const tt = Math.min(tNow, DUR);
    if (tt !== lastDrawn) { renderAt(tt); lastDrawn = tt; }
    ui.scrub.value = Math.round(Math.min(tNow, DUR) * FPS);
    ui.tc.textContent = fmt(Math.min(tNow, DUR));
    raf = requestAnimationFrame(tick);
  }
  function startPreview() {
    fit();
    on(window, 'resize', fit);
    on(ui.play, 'click', () => (playing ? pause() : play()));
    on(ui.restart, 'click', () => { setTime(0); play(); });
    on(ui.scrub, 'input', () => { pause(); setTime(+ui.scrub.value / FPS); });
    on(window, 'keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
      else if (e.key === 'r' || e.key === 'R') { setTime(0); play(); }
      else if (e.key === 'ArrowRight') { pause(); setTime(tNow + 1 / FPS); }
      else if (e.key === 'ArrowLeft') { pause(); setTime(tNow - 1 / FPS); }
    });
    setTime(0); play();
    raf = requestAnimationFrame(tick);
  }

  function destroy() {
    cancelAnimationFrame(raf);
    listeners.forEach(([el, ev, fn, opt]) => el.removeEventListener(ev, fn, opt));
    listeners.length = 0;
    audio.pause(); audio.removeAttribute('src');
    master.kill();
  }

  /* ---------- development check: every state property must chain continuously ---------- */
  function validateChains() {
    const byProp = {};
    master.getChildren(false, true, false).forEach((tw) => {
      if (tw.targets()[0] !== S || !tw.vars.startAt) return;
      Object.keys(tw.vars.startAt).forEach((k) => {
        (byProp[k] = byProp[k] || []).push({ t: tw.startTime(), d: tw.duration(), from: tw.vars.startAt[k], to: tw.vars[k] });
      });
    });
    const issues = [];
    for (const [k, list] of Object.entries(byProp)) {
      list.sort((a, b) => a.t - b.t);
      if (Math.abs(list[0].from - S[k]) > 1e-6) issues.push(`${k}: initial ${S[k]} ≠ first from ${list[0].from} @${list[0].t}`);
      for (let i = 1; i < list.length; i++) {
        if (Math.abs(list[i].from - list[i - 1].to) > 1e-6) issues.push(`${k}: ${list[i - 1].to} → from ${list[i].from} @${list[i].t}`);
        if (list[i].t < list[i - 1].t + list[i - 1].d - 1e-6) issues.push(`${k}: overlap @${list[i].t}`);
      }
    }
    return issues;
  }

  /* ---------- boot ---------- */
  async function boot() {
    await Promise.all([
      document.fonts.load('100 100px "Inter Display"'), document.fonts.load('200 100px "Inter Display"'),
      document.fonts.load('300 100px "Inter Display"'), document.fonts.load('400 100px "Inter Display"'),
      document.fonts.load('500 30px "Inter Text"'),
    ]);
    await document.fonts.ready;
    stage.style.transform = 'none';
    const ids = { intel: 'w-intel', intro: 'w-intro', claude: 'w-claude', opus: 'w-opus', refl: 'refl', think: 'w-think', solve: 'w-solve', build: 'w-build', reason: 'w-reason', create: 'w-create', execute: 'w-execute', less: 'w-less', more: 'w-more', better: 'w-better', fin: 'w-final', tag: 'w-tag' };
    const TX = {};
    for (const [k, id] of Object.entries(ids)) TX[k] = splitEl($(id));
    for (const el of Object.values(TX)) placeEl(el);
    // reflection mirrors OPUS 5.5 about its baseline
    {
      const o = TX.opus;
      TX.refl.style.top = o._top + 'px';
      TX.refl.style.transformOrigin = `50% ${BASELINE * o._fs + 5}px`;
      const fl = $('floor');
      fl.style.top = o._top + BASELINE * o._fs + 14 + 'px';
    }
    // precision guides frame BUILD WITH / PRECISION.
    {
      const b = TX.build;
      $('guide-top').style.top = b._top + 0.1362 * b._fs - 26 + 'px';
      $('guide-bot').style.top = b._top + b._h - (1 - BASELINE) * b._fs + 26 + 'px';
    }
    // amber rule between the lockup and the tagline
    $('tag-rule').style.top = (TX.fin._top + TX.fin._h - 44 + TX.tag._top) / 2 + 2 + 'px';
    TX.quiet = [TX.less, TX.more, TX.better];
    // the char layers of the 3D flip need perspective; they hinge on the baseline (2D origin only)
    TX.create._lines.forEach((L) => L.ln.classList.add('persp'));
    gsap.set(TX.create._chars, { transformOrigin: '50% 86%' });
    // masked reveals clip vertically only
    [TX.intro, TX.claude, TX.opus, TX.refl, TX.think, TX.reason].forEach((el) => el._lines.forEach((L) => L.ln.classList.add('mask')));

    gsap.config({ force3D: false });
    buildTimeline(TX);
    HOOK = { execute: TX.execute, quiet: TX.quiet };
    // Canonical warm-up: render every tween once to the end and back, so each animated
    // element carries GSAP-written inline styles from t = 0. A frame then depends only
    // on t — never on which times were rendered before it (parallel workers, scrubbing).
    master.seek(DUR, true);
    master.seek(0, true);

    const issues = validateChains();
    if (issues.length) console.warn('[film] timeline chain issues:\n' + issues.join('\n'));

    CUES.sort((a, b) => a.t - b.t);
    window.__film = { duration: DUR, fps: FPS, width: W, height: H, cues: CUES, labels: LBL, issues, S };
    window.__seek = (t) => { renderAt(t); return true; };
    window.__destroy = destroy;
    window.__duration = master.duration();

    if (RENDER) { renderAt(0); window.__ready = true; }
    else { startPreview(); window.__ready = true; }
  }
  boot();
})();
