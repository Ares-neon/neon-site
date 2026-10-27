"""Sonic signature for Silva & Bueno — synthesised from scratch (no samples, no libraries).

Every event is placed on the same frame timeline as the picture (src/timeline.ts, 60 fps):
  0.40 s  sub pulse as the first point of light appears
  0.4–2.1 air texture that widens with the datum line; faint glass tone with the axis
  2.0–3.4 the fold: a low, breathing swell
  3.3–4.8 the gold pour: fine metallic shimmer; one glass tick as the front crosses the window
  5.0–7.0 the towers rise: refined whooshes panned to each tower, a soft settle under the gold one
  6.6–8.0 the ring: one continuous swoosh travelling left -> over the top -> right
  9.1–9.6 the name opens from the ampersand: E5 - B5 - E6 bells over an E-major-9 bed
 10.2     ampersand glint;  10.3 IMÓVEIS: the warm third (G#5) resolves the figure
 11.6–13  reflection shimmer travelling with the light;  13.0 a breath for the handle
 13–15    ambient tail decaying into silence

Usage: python scripts/make_audio.py   -> public/audio/signature_raw.wav (then loudness-normalised)
"""
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DUR = 15.0
N = int(SR * DUR)
FPS = 60
rng = np.random.default_rng(20261027)
t = np.arange(N) / SR


def sec(frame):
    return frame / FPS


# ------------------------------------------------------------------ helpers
def cubic_bezier(x1, y1, x2, y2):
    """CSS-style easing, same curves as src/lib/motion.ts."""
    def f(x):
        x = np.clip(np.asarray(x, float), 0, 1)
        s = x.copy()
        for _ in range(12):  # Newton on x(s) = x
            xs = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s ** 2 * x2 + s ** 3 - x
            dx = 3 * (1 - s) ** 2 * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s ** 2 * (1 - x2)
            s = np.clip(s - xs / np.where(np.abs(dx) < 1e-6, 1e-6, dx), 0, 1)
        return 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s ** 2 * y2 + s ** 3
    return f


EASE_DRAW = cubic_bezier(0.55, 0, 0.18, 1)
EASE_RISE = cubic_bezier(0.3, 0.75, 0.2, 1)
EASE_GLIDE = cubic_bezier(0.42, 0, 0.58, 1)


def progress(f0, f1, ease):
    return ease((t - sec(f0)) / (sec(f1) - sec(f0)))


def speed_env(f0, f1, ease, smooth=0.02):
    """Normalised |d progress / dt| — sounds follow how fast things actually move."""
    p = progress(f0, f1, ease)
    v = np.abs(np.gradient(p)) * SR
    k = int(smooth * SR) | 1
    v = np.convolve(v, np.hanning(k) / np.hanning(k).sum(), mode="same")
    return v / (v.max() + 1e-12)


def pan(mono, p):
    """Equal-power pan, p in [-1, 1] (scalar or per-sample)."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1)


def noise(n=N):
    return rng.standard_normal(n)


def bandpass_sweep(x, f_center, q):
    """Time-varying band-pass (RBJ biquad, block-updated with carried state)."""
    out = np.zeros_like(x)
    zi = np.zeros(2)
    blk = 64
    fc = np.broadcast_to(f_center, x.shape)
    for i in range(0, len(x), blk):
        f = float(np.clip(fc[i], 20, SR * 0.45))
        w0 = 2 * np.pi * f / SR
        alpha = np.sin(w0) / (2 * q)
        b = np.array([alpha, 0, -alpha])
        a = np.array([1 + alpha, -2 * np.cos(w0), 1 - alpha])
        out[i:i + blk], zi = signal.lfilter(b / a[0], a / a[0], x[i:i + blk], zi=zi)
    return out


def bandpass4(x, f_center, q):
    """Two cascaded sweeps: 4th-order skirts, so whooshes stay airy instead of hissy."""
    return bandpass_sweep(bandpass_sweep(x, f_center, q), f_center, q)


def band(x, lo, hi, order=4):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x)


def lowpass(x, fc, order=2):
    sos = signal.butter(order, fc, btype="low", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x, axis=0)


def highpass(x, fc, order=2):
    sos = signal.butter(order, fc, btype="high", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x, axis=0)


def gate(t0, attack, decay, hold=0.0):
    """Attack (raised cosine) -> optional hold -> exponential decay, starting at t0 seconds."""
    x = t - t0
    e = np.zeros(N)
    on = (x >= 0) & (x < attack)
    e[on] = 0.5 - 0.5 * np.cos(np.pi * x[on] / attack)
    h = (x >= attack) & (x < attack + hold)
    e[h] = 1
    d = x >= attack + hold
    e[d] = np.exp(-(x[d] - attack - hold) / decay)
    return e


def swell(t0, t1, peak_at=0.5, curve=2.0):
    """Smooth rise and fall between t0 and t1 (seconds)."""
    x = (t - t0) / (t1 - t0)
    e = np.zeros(N)
    m = (x > 0) & (x < 1)
    xp = x[m]
    up = xp < peak_at
    v = np.where(up, xp / peak_at, (1 - xp) / (1 - peak_at))
    e[m] = (0.5 - 0.5 * np.cos(np.pi * np.clip(v, 0, 1))) ** curve
    return e


def db(v):
    return 10 ** (v / 20)


def bell(f0, t0, level_db, decay=2.6, bright=1.0, detune_cents=0.0):
    """Soft struck metal bar: tuned partials with frequency-dependent decay, felt-mallet attack."""
    partials = [(1.0, 1.0, decay), (2.0, 0.18 * bright, decay * 0.45), (3.0, 0.05 * bright, decay * 0.3),
                (4.07, 0.11 * bright, decay * 0.22), (6.8, 0.03 * bright, decay * 0.1)]
    x = t - t0
    on = x >= 0
    out = np.zeros(N)
    f = f0 * 2 ** (detune_cents / 1200)
    for ratio, amp, dk in partials:
        ph = 2 * np.pi * f * ratio * x[on] + rng.random() * 2 * np.pi
        out[on] += amp * np.sin(ph) * np.exp(-x[on] / dk)
    att = np.clip(x / 0.004, 0, 1)
    out *= 0.5 - 0.5 * np.cos(np.pi * att)
    click = band(noise(), 1800, 5200) * gate(t0, 0.001, 0.012)
    return (out / 1.2 + click * 0.03) * db(level_db)


def additive_saw(f, voices_cents=(-5, 0, 6), harmonics=14):
    out = np.zeros(N)
    for c in voices_cents:
        fv = f * 2 ** (c / 1200)
        ph0 = rng.random() * 2 * np.pi
        for h in range(1, harmonics + 1):
            if fv * h > 9000:
                break
            out += np.sin(2 * np.pi * fv * h * t + ph0 * h) / h
    return out / len(voices_cents)


# ------------------------------------------------------------------ reverb (synthetic hall)
def make_ir(rt60=2.9, length=3.6, predelay=0.018):
    n = int(length * SR)
    ti = np.arange(n) / SR
    ir = np.zeros((n, 2))
    bands = [(20, 400, 1.15), (400, 2500, 1.0), (2500, 8000, 0.62), (8000, 20000, 0.38)]
    for ch in range(2):
        acc = np.zeros(n)
        for lo, hi, k in bands:
            nz = rng.standard_normal(n)
            sos = signal.butter(2, [lo, min(hi, SR * 0.49)], btype="band", fs=SR, output="sos")
            nz = signal.sosfilt(sos, nz)
            acc += nz * np.exp(-6.91 * ti / (rt60 * k))
        acc *= np.clip(ti / 0.06, 0, 1) ** 1.5  # soft onset: no slap
        ir[:, ch] = acc
    pd = int(predelay * SR)
    ir = np.vstack([np.zeros((pd, 2)), ir])[:n]
    return ir / np.sqrt((ir ** 2).sum(0).mean())


IR = make_ir()


def reverb(stereo):
    wet = np.stack([signal.fftconvolve(stereo[:, c], IR[:, c])[:N] for c in range(2)], 1)
    return highpass(wet, 120)


# ------------------------------------------------------------------ the score
dry = np.zeros((N, 2))
send = np.zeros((N, 2))  # reverb send bus

# 01 — sub pulse with the first point of light (frame 24)
t_pulse = sec(24) - 0.012
x = t - t_pulse
on = x >= 0
freq = 44 + 18 * np.exp(-np.clip(x, 0, None) / 0.07)
phase = 2 * np.pi * np.cumsum(np.where(on, freq, 0)) / SR
sub = np.sin(phase) + 0.22 * np.sin(2 * phase)
sub = np.tanh(1.4 * sub) / np.tanh(1.4)
sub *= gate(t_pulse, 0.009, 0.45)
dry += pan(sub * db(-13), 0)

# datum: air widening with the line (mid -> side), intensity follows the drawing speed
v_datum = speed_env(24, 100, EASE_DRAW)
length = progress(24, 100, EASE_DRAW)
air_m = band(noise(), 2400, 7500)
air_s = band(noise(), 2400, 7500)
air_env = (0.35 + 0.65 * v_datum) * swell(sec(24), sec(124), 0.45, 1.2)
mid = air_m * air_env * db(-25)
side = air_s * air_env * length * db(-23)
dry += np.stack([mid + side, mid - side], 1)
send += np.stack([mid + side, mid - side], 1) * 0.6

# axis: a faint glass tone rising with the second line (E6 -> B6 harmonic pair, almost subliminal)
glass_env = swell(sec(64), sec(170), 0.55, 1.5)
glass = (np.sin(2 * np.pi * 1318.51 * t) + 0.35 * np.sin(2 * np.pi * 1975.53 * t + 1.3)) * glass_env
dry += pan(glass * db(-38), 0.05)
send += pan(glass * db(-31), 0.05)

# 02 — the fold: low breathing swell (filtered noise + soft E2/B2 body)
fold_env = swell(sec(118), sec(222), 0.62, 1.6)
fold_air = bandpass4(noise(), 260 + 700 * progress(122, 206, EASE_DRAW), 1.2) * fold_env
body = (np.sin(2 * np.pi * 82.41 * t) + 0.5 * np.sin(2 * np.pi * 123.47 * t + 0.7)) * fold_env
dry += pan(fold_air * db(-16), 0) + pan(body * db(-33), 0)
send += pan(fold_air * db(-22), 0)

# pour: fine metallic shimmer (granular high band) while gold fills the roof
pour_env = swell(sec(198), sec(268), 0.35, 1.4)
grains = band(noise(), 5200, 10000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 23 * t)))
sparkle = sum(np.sin(2 * np.pi * f * t + k) * (0.5 + 0.5 * np.sin(2 * np.pi * r * t + k)) for k, (f, r) in enumerate([(5274.0, 7.1), (6644.9, 9.3), (7902.1, 5.7)]))
pour_l = (grains * db(-33) + sparkle * db(-41)) * pour_env
pour_r = (np.roll(grains, 311) * db(-33) + np.roll(sparkle, 173) * db(-41)) * pour_env
dry += np.stack([pour_l, pour_r], 1)
send += np.stack([pour_l, pour_r], 1) * 1.6
# window: one glass tick as the front crosses the panes
win = bell(3135.96, sec(238), -31, decay=0.35, bright=0.4)  # pour front at mid-window
dry += pan(win, 0)
send += pan(win * 1.6, 0)

# 03 — towers rise: refined whooshes, panned to each tower's screen position
for f0, f1, p, lvl, fhi in [(298, 372, 0.0, -12, 2600), (320, 394, -0.42, -17, 2200),
                             (332, 406, 0.18, -18, 2400), (344, 418, 0.5, -19, 2300)]:
    sp = speed_env(f0, f1, EASE_RISE)
    fc = 280 + (fhi - 280) * progress(f0, f1, EASE_RISE)
    w = bandpass4(noise(), fc, 0.9) * sp ** 1.3
    dry += pan(w * db(lvl), p)
    send += pan(w * db(lvl - 4), p)
# soft settle under the gold tower (no impact: a warm felt tone)
settle = bell(82.41, sec(336), -27, decay=1.0, bright=0.25) + bell(164.81, sec(336), -33, decay=0.8, bright=0.2)  # tower at ~92 %
dry += pan(settle, 0)
send += pan(settle * 0.8, 0)
# inner lines: three tiny metallic glints
for f, p in [(384, -0.08), (392, 0.12), (398, 0.18)]:
    g = bell(2637.02, sec(f) + 0.05, -37, decay=0.22, bright=0.3)
    dry += pan(g, p)
    send += pan(g * 1.8, p)

# ring: one continuous swoosh following the pen around the circle (pan = cos of the angle)
ring_p = progress(394, 480, EASE_DRAW)
ang = np.radians(134.7 + (399.1 - 134.7) * ring_p)
ring_pan = np.clip(np.cos(ang) * 0.85, -0.85, 0.85)
ring_v = speed_env(394, 480, EASE_DRAW)
ring_sw = bandpass4(noise(), 900 + 1600 * np.sin(np.pi * ring_p), 1.3) * ring_v ** 1.1
dry += pan(ring_sw * db(-13), ring_pan)
send += pan(ring_sw * db(-19), ring_pan)

# studio light: barely-there air
sl = band(noise(), 6000, 12000) * swell(sec(436), sec(530), 0.5, 1.5)
dry += pan(sl * db(-39), 0)
send += pan(sl * db(-34), 0)

# 04 — camera reframes: low air
cam = band(noise(), 180, 900) * swell(sec(480), sec(584), 0.5, 1.8)
dry += pan(cam * db(-28), 0)

# the signature: E5 - B5 - E6 opening with the name (from the ampersand outwards)
t_name = sec(546 + 35 * 0.065)
sig = [(659.26, t_name, -19, -0.05), (987.77, t_name + 0.21, -21, 0.12), (1318.51, t_name + 0.47, -23.5, -0.1)]
for f, t0, lvl, p in sig:
    b = bell(f, t0, lvl, decay=2.9, bright=1.0) + bell(f, t0 + 0.004, lvl - 9, decay=2.4, bright=0.6, detune_cents=4)
    dry += pan(b, p)
    send += pan(b * 0.9, p)
bass = bell(82.41, t_name - 0.01, -23, decay=2.8, bright=0.35) + bell(41.2, t_name - 0.01, -32, decay=1.8, bright=0.1)
dry += pan(bass, 0)
send += pan(bass * 0.4, 0)
# ampersand glint
amp = bell(1975.53, sec(612), -29, decay=0.6, bright=0.5)
dry += pan(amp, -0.04)
send += pan(amp * 1.5, -0.04)
# IMÓVEIS: the warm third resolves the figure
third = bell(830.61, sec(620), -25, decay=2.6, bright=0.55)
dry += pan(third, 0.08)
send += pan(third * 1.1, 0.08)

# E-major-9 bed under the signature, breathing out into the tail
chord = [82.41, 123.47, 164.81, 207.65, 311.13, 369.99]
weights = [1.0, 0.75, 0.6, 0.45, 0.32, 0.26]
pad_env = np.clip((t - t_name + 0.2) / 1.8, 0, 1) ** 1.5
pad_env *= np.clip((14.95 - t) / 2.6, 0, 1) ** 1.6
pad_st = np.stack([
    lowpass(sum(additive_saw(f, (-6, 3), 6) * w for f, w in zip(chord, weights)), 900) * pad_env,
    lowpass(sum(additive_saw(f, (-3, 7), 6) * w for f, w in zip(chord, weights)), 900) * pad_env,
], 1)  # independent voices per side: wide, no comb wobble
dry += pad_st * db(-45)
send += pad_st * db(-39)

# 05 — reflection: shimmer travelling with the light band
refl_p = progress(694, 782, EASE_GLIDE)
refl = band(noise(), 4500, 12000) * swell(sec(694), sec(782), 0.5, 1.4)
dry += pan(refl * db(-30), -0.7 + 1.4 * refl_p)
send += pan(refl * db(-28), -0.7 + 1.4 * refl_p)
glint = bell(2959.96, sec(738), -29, decay=0.9, bright=0.4)
dry += pan(glint, 0.1)
send += pan(glint * 1.5, 0.1)

# handle: a breath
breath = band(noise(), 900, 3200) * swell(sec(778), sec(812), 0.4, 1.6)
dry += pan(breath * db(-31), 0)
send += pan(breath * db(-31), 0)

# ------------------------------------------------------------------ mix
wet = reverb(send) * db(-6)
mix = highpass(dry + wet, 28, order=2)
fade = np.clip((DUR - 0.03 - t) / 0.6, 0, 1) ** 2  # final 0.6 s into true silence
mix *= fade[:, None]
mix /= np.abs(mix).max() / db(-3)
out = ROOT / "public/audio/signature_raw.wav"
out.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, mix.astype(np.float32))
print("wrote", out, f"{DUR}s @ {SR} Hz")
