"""NEON — "Gravidade": rhythmic sound design, synthesized from scratch (no samples, no melody, no voice).

Cue times mirror src/film.js (120 BPM grid, 1 beat = 0.5 s). Every sound starts and ends in silence.
Writes build/sfx_raw.wav (48 kHz, stereo, float → 32-bit PCM). Mastering happens in tools/master.py.
"""
import wave, os
import numpy as np

SR = 48000
DUR = 30.0
N = int(SR * DUR)
L = np.zeros(N); Rr = np.zeros(N)
rng = np.random.default_rng(2026)
OUT = os.path.join(os.path.dirname(__file__), '..', 'build')


def place(sig, t0, pan=0.0):
    """Add mono signal at t0 with equal-power pan (-1 left … 1 right). pan may be an array."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    sig = sig[: N - i0]
    p = (np.asarray(pan) + 1) * np.pi / 4
    gl, gr = np.cos(p), np.sin(p)
    if np.ndim(pan):
        gl, gr = gl[: len(sig)], gr[: len(sig)]
    L[i0 : i0 + len(sig)] += sig * gl
    Rr[i0 : i0 + len(sig)] += sig * gr


def edge(sig, a=0.004, r=0.01):
    """Guarantee silence at both ends."""
    n = len(sig); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    sig[:na] *= np.linspace(0, 1, na); sig[n - nr :] *= np.linspace(1, 0, nr)
    return sig


def onepole_lp(x, fc):
    """Time-varying one-pole low-pass (fc scalar or per-sample array)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def band(x, fc, q=2.5):
    lo = onepole_lp(onepole_lp(x, fc * 1.6), fc * 1.6)
    return lo - onepole_lp(lo, fc / q)


def sub(t0, dur, f0, f1, amp, attack=0.004, pan=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = (1 - np.exp(-t / attack)) * np.exp(-t / (dur * 0.32))
    s = np.sin(ph) + 0.18 * np.sin(2 * ph)  # a touch of 2nd harmonic so phones reproduce it
    place(edge(s * env * amp, 0.002, 0.03), t0, pan)


def click(t0, f, amp, pan=0.0):
    n = int(0.012 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.0022)
    nz = np.diff(rng.standard_normal(n + 1)) * np.exp(-t / 0.0007) * 0.35
    place(edge((s + nz) * amp, 0.0003, 0.002), t0, pan)


def crackle(t0, dur, amp, density=420, pan=0.0):
    n = int(dur * SR); out = np.zeros(n)
    k = int(density * dur)
    for p in rng.integers(0, max(1, n - 200), k):
        m = int(rng.integers(20, 140)); tt = np.arange(m) / SR
        burst = np.diff(rng.standard_normal(m + 1)) * np.exp(-tt / (m / SR / 4))
        out[p : p + m] += burst * rng.uniform(0.2, 1)
    env = np.exp(-np.arange(n) / SR / (dur * 0.45))
    place(edge(out * env * amp * 0.5, 0.001, 0.01), t0, pan)


def whoosh(t0, dur, f0, f1, amp, pan0=0.0, pan1=0.0, shape='bell'):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** t
    x = band(rng.standard_normal(n), fc)
    if shape == 'bell':
        env = np.sin(np.pi * t) ** 2
    elif shape == 'rise':  # reverse / suction: swells and stops dead
        env = t ** 2.6
    else:  # 'fall': fast attack, long tail
        env = (1 - np.exp(-t * 60)) * (1 - t) ** 2
    x = x / (np.abs(x).max() + 1e-9)
    place(edge(x * env * amp, 0.003, 0.012), t0, np.linspace(pan0, pan1, n))


def thump(t0, amp=0.55, f=2600, pan=0.0):
    sub(t0, 0.32, 95, 48, amp)
    click(t0, f, amp * 0.55, pan)


def zap(t0, dur, f0, f1, amp):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t / (dur * 0.4))
    place(edge(onepole_lp(s, 6000) * amp, 0.001, 0.01), t0)


# ---------------- cues ----------------
# 0.0–0.5: one beat of silence (the point contracts)
# 0.5 BIG BANG
sub(0.5, 1.4, 72, 28, 1.0)
crackle(0.5, 0.28, 0.55)
click(0.5, 2400, 0.6)
whoosh(0.5, 0.9, 7000, 700, 0.55, 0, 0, 'fall')
# 1.47 MARCA locks
thump(1.47, 0.55, 3200)
# 2.0 gravity switches on: the scene is pulled in
whoosh(2.0, 1.0, 500, 3200, 0.38, -0.6, 0.6, 'rise')
sub(2.0, 1.2, 46, 36, 0.5, attack=0.09)
crackle(2.0, 0.12, 0.18)
# formation: big stars open into real pieces
for i, tr in enumerate([2.55, 3.3, 4.05, 4.8, 5.55]):
    s = 0.6 if i % 2 else -0.6
    whoosh(tr - 0.12, 0.5, 1400, 5200, 0.22, s, -s * 0.3)
    click(tr, 4200, 0.22, s)
thump(3.36, 0.45, 3000)               # BRANDING.
whoosh(4.66, 0.42, 900, 4200, 0.2)     # word → word
thump(5.14, 0.45, 3400)               # CRIATIVIDADE.
whoosh(6.7, 0.6, 3500, 700, 0.18, 0.4, -0.4)
# 7.0 NEON core
sub(7.0, 1.7, 62, 30, 1.0)
crackle(7.0, 0.35, 0.6)
click(7.0, 1800, 0.55)
# pieces captured into orbit
for i, te in enumerate([7.2, 7.4, 7.6, 7.8, 8.0, 8.2]):
    s = -0.8 if i % 2 else 0.8
    whoosh(te - 0.05, 0.7, 700, 2600, 0.24, s, -s)
# constellations: creative ↔ data
for t0 in [9.0, 9.5, 10.0, 10.5]:
    click(t0, 3000, 0.3, -0.3)
    click(t0 + 0.42, 5200, 0.42, 0.3)
    crackle(t0 + 0.42, 0.05, 0.12)
for i, t0 in enumerate([11.0, 11.25, 11.5, 11.75]):
    click(t0, 2600 + i * 300, 0.24, (-1) ** i * 0.5)
thump(11.06, 0.5, 2800)               # TRÁFEGO
# 13.0 COLLAPSE → dead stop → micro-silence
whoosh(13.0, 0.76, 300, 7500, 0.6, 0, 0, 'rise')
sub(13.12, 0.64, 85, 30, 0.6, attack=0.2)
# 14.4–15.0 charge
whoosh(14.4, 0.6, 1800, 9000, 0.22, 0, 0, 'rise')
crackle(14.62, 0.37, 0.2, density=900)
# 15.0 release → hyperspace
sub(15.0, 1.9, 78, 25, 1.0)
crackle(15.0, 0.3, 0.7)
click(15.0, 2000, 0.6)
whoosh(15.0, 2.0, 7500, 600, 0.5, -0.2, 0.2, 'fall')
whoosh(17.0, 0.9, 600, 3000, 0.28)
# growth steps: a hit per beat, cuts on the grid
for i, tb in enumerate([17.5, 18.0, 18.5, 19.0, 19.5, 20.0]):
    sub(tb, 0.22, 110, 55, 0.5)
    click(tb, 3500, 0.42, (-1) ** i * 0.25)
    if i in (1, 4):  # macro crops
        sub(tb, 0.4, 70, 40, 0.45)
whoosh(20.5, 0.5, 1500, 11000, 0.42, 0, 0, 'rise')
# 21.0 SUPERNOVA
sub(21.0, 0.6, 90, 40, 0.7)
crackle(21.0, 0.15, 0.4)
whoosh(21.02, 0.8, 2200, 800, 0.4, 0.9, -0.9)
whoosh(21.45, 0.45, 900, 3500, 0.22, -0.5, 0.5)
sub(21.8, 0.95, 66, 34, 0.9)
click(21.8, 1500, 0.6)
for k in range(5):
    click(21.9 + k * 0.05, 6000, 0.12, (-1) ** k * 0.7)
for k in range(6):
    click(22.3 + k * 0.04, 2800, 0.18, (-1) ** k * 0.6)
crackle(22.75, 0.36, 0.9, density=700)
zap(22.75, 0.13, 3200, 180, 0.35)
sub(23.25, 0.7, 82, 28, 1.0)
whoosh(23.25, 0.68, 9000, 500, 0.75, 0, 0, 'fall')
crackle(23.25, 0.3, 0.5)
# 24.0–24.25 black silence; 24.25 RESULTADO
sub(24.25, 0.38, 72, 45, 0.55)
click(24.25, 2200, 0.35)
# 25.0 neon ignites (frames 750, 751, 753, 756)
for f in (750, 751, 753, 756):
    crackle(f / 30, 0.03, 0.45, density=2500)
n = int(0.45 * SR); tt = np.arange(n) / SR
hum = np.sign(np.sin(2 * np.pi * 120 * tt)) * np.exp(-tt / 0.12)
place(edge(onepole_lp(hum, 1800) * 0.07, 0.002, 0.02), 756 / 30)
# 26.0 the word is pulled into the point
whoosh(26.0, 0.6, 600, 5200, 0.32, 0.4, 0, 'rise')
for k in range(9):
    click(26.05 + k * 0.045, 4800 - k * 200, 0.08, 0.5 - k * 0.06)
# 26.65 logo
sub(26.65, 1.2, 56, 34, 0.85)
click(26.65, 1600, 0.5)
for t0 in (26.85, 26.98, 27.1):
    click(t0, 4500, 0.18)
# 29.58 loop collapse — ends in silence before 30.0
whoosh(29.58, 0.34, 500, 6000, 0.35, 0, 0, 'rise')
sub(29.74, 0.2, 80, 40, 0.3, attack=0.05)

os.makedirs(OUT, exist_ok=True)
st = np.stack([L, Rr], 1)
st[-int(0.02 * SR):] = 0  # exact 30.000 s, silent tail
np.save(os.path.join(OUT, 'sfx_raw.npy'), st.astype(np.float32))
print('peak', np.abs(st).max())
