"""Sound design for claude-opus-5-5 — fully synthesized (no third-party samples).

Every event time comes from audio/cues.json, which `node render.mjs check` exports
from the GSAP master timeline — the timeline is the single source of truth.

usage:  python3 sfx.py            -> audio/claude-opus-5-5-sfx.raw.wav (48 kHz, stereo, 30 s)
        (export.sh then applies limiting + loudness normalisation with FFmpeg)
"""
import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CUES = json.load(open(os.path.join(HERE, 'audio', 'cues.json')))
SR = 48000
DUR = float(CUES['duration'])
N = int(round(SR * DUR))
rng = np.random.default_rng(5505)          # deterministic

dry = np.zeros((N, 2))
send = np.zeros((N, 2))                     # reverb send bus


# ------------------------------------------------------------------ helpers
def t_axis(dur):
    return np.arange(int(round(SR * dur))) / SR


def stereo(mono, pan=0.0):
    """Equal-power pan. `pan` may be a scalar or a per-sample array in [-1, 1]."""
    p = (np.asarray(pan) + 1) * np.pi / 4
    return np.stack([mono * np.cos(p), mono * np.sin(p)], axis=1) * np.sqrt(2)


def place(sig, at, gain=1.0, pan=0.0, verb=0.2):
    if sig.ndim == 1:
        sig = stereo(sig, pan)
    i = int(round(at * SR))
    if i >= N:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    seg = sig[: N - i] * gain
    dry[i:i + len(seg)] += seg
    send[i:i + len(seg)] += seg * verb


def fades(x, a=0.003, r=0.02):
    n = len(x)
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** 2
    e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return x * (e if x.ndim == 1 else e[:, None])


def spectral(x, lo=None, hi=None, order=4):
    """Smooth static band-pass in the frequency domain."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m /= 1 + (lo / np.maximum(f, 1e-3)) ** order
    if hi:
        m /= 1 + (f / hi) ** order
    return np.fft.irfft(X * m, len(x))


def moving_band(n, f0, f1, width=0.5, curve=None, noise=None):
    """Noise through a band-pass whose centre glides f0→f1 (STFT overlap-add).
    width = band half-width in octaves. curve(p)→[0,1] shapes the glide."""
    hop, win = 256, 1024
    src = noise if noise is not None else rng.standard_normal(n + win)
    src = np.pad(src, (0, max(0, n + win - len(src))))
    w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    out = np.zeros(n + win)
    norm = np.zeros(n + win)
    for s in range(0, n, hop):
        p = s / max(1, n - 1)
        q = curve(p) if curve else p
        fc = f0 * (f1 / f0) ** q
        oct_ = np.log2(np.maximum(f, 1) / fc)
        mask = np.exp(-0.5 * (oct_ / width) ** 2)
        fr = np.fft.irfft(np.fft.rfft(src[s:s + win] * w) * mask, win) * w
        out[s:s + win] += fr
        norm[s:s + win] += w * w
    out = out[:n] / np.maximum(norm[:n], 1e-3)
    return out / (np.abs(out).max() + 1e-9)


def env(n, attack, peak_at=None, decay_pow=1.5):
    """Asymmetric swell: rises to 1 at `peak_at` (fraction), then decays."""
    t = np.linspace(0, 1, n)
    pk = peak_at if peak_at is not None else attack
    return np.where(t < pk, (t / max(pk, 1e-6)) ** 2, ((1 - t) / max(1 - pk, 1e-6)) ** decay_pow)


def sine(freq, dur, phase=0.0):
    t = t_axis(dur)
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * t + phase)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR + phase)


# ------------------------------------------------------------------ voices
SCALE = [587.33, 698.46, 880.0, 1046.5, 1174.66, 1318.51, 1396.91]   # D5 F5 A5 C6 D6 E6 F6


def pulse(freq, dur=0.9, bright=1.0):
    """Delicate electronic pulse: soft FM sine with a short shimmer."""
    t = t_axis(dur)
    idx = 1.6 * bright * np.exp(-t * 18)
    mod = np.sin(2 * np.pi * freq * 2.0 * t) * idx
    s = np.sin(2 * np.pi * freq * t + mod)
    s += 0.18 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t * 26)
    a = np.minimum(1, t / 0.004) * np.exp(-t * 5.2)
    return fades(s * a, 0.002, 0.08)


def glass(freq, dur=2.2):
    """Restrained glassy tone (scene 05): sine + inharmonic partial, long bloom."""
    t = t_axis(dur)
    s = np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(2 * np.pi * freq * 2.756 * t) * np.exp(-t * 3)
    a = np.minimum(1, t / 0.012) * np.exp(-t * 2.1)
    return fades(s * a, 0.004, 0.2)


def sub_impact(f0=92, f1=38, dur=2.6, click=0.35, body=0.6):
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += body * np.sin(2 * np.pi * 61 * t) * np.exp(-t * 9)
    nz = spectral(rng.standard_normal(len(t)), 60, 1400) * np.exp(-t * 55)
    s += click * nz / (np.abs(nz).max() + 1e-9)
    return fades(np.tanh(1.3 * s) / np.tanh(1.3), 0.0015, 0.3)


def deep_tone(dur=5.0):
    """Opening tone: D1/D2 swelling out of silence with a slight downward settle."""
    t = t_axis(dur)
    glide = 1 + 0.03 * np.exp(-t * 1.2)
    s = np.sin(2 * np.pi * np.cumsum(36.71 * glide) / SR) + 0.55 * np.sin(2 * np.pi * np.cumsum(73.42 * glide) / SR)
    s += 0.12 * np.sin(2 * np.pi * np.cumsum(146.83 * glide) / SR) * np.exp(-t * 0.6)
    a = (1 - np.exp(-t / 0.55)) * np.exp(-t * 0.42)
    return fades(s * a, 0.01, 0.6)


def whoosh(dur, f0, f1, peak=0.55, width=0.55, curve=None, decay=1.4):
    n = int(SR * dur)
    return fades(moving_band(n, f0, f1, width, curve) * env(n, 0, peak, decay), 0.01, 0.05)


def riser(dur, f0, f1):
    n = int(SR * dur)
    t = np.linspace(0, 1, n)
    tone = sine(f0 * (f1 / f0) ** (t ** 1.3), dur) * 0.5 + sine(2 * f0 * (f1 / f0) ** (t ** 1.3), dur) * 0.15
    air = moving_band(n, 400, 5200, 0.7, lambda p: p ** 1.6)
    return fades((tone + 0.9 * air) * t ** 2.4, 0.02, 0.012)


def ticks(dur, count, f_lo=3500, f_hi=8000, conv=True, seed=1):
    r = np.random.default_rng(seed)
    n = int(SR * dur)
    out = np.zeros((n, 2))
    for k in range(count):
        p = r.random() ** (1.7 if conv else 0.7)
        at = int(p * (n - 2000))
        tt = t_axis(0.012)
        fq = r.uniform(f_lo, f_hi)
        c = np.sin(2 * np.pi * fq * tt) * np.exp(-tt * 520) * r.uniform(0.35, 1.0)
        pan = r.uniform(-0.85, 0.85) * ((1 - p) if conv else 1)
        out[at:at + len(c)] += stereo(c, pan)
    return out


def shimmer(freqs, dur, sweep=None):
    """Bell-like chord shimmer; optional stereo sweep (-1→1)."""
    t = t_axis(dur)
    s = np.zeros(len(t))
    for k, f in enumerate(freqs):
        vib = 1 + 0.002 * np.sin(2 * np.pi * (4.3 + k) * t)
        s += np.sin(2 * np.pi * np.cumsum(f * vib) / SR) * (0.8 ** k)
        s += 0.15 * np.sin(2 * np.pi * f * 2.0 * t) * (0.8 ** k)
    a = np.minimum(1, t / 0.02) * np.exp(-t * 1.25)
    s = fades(s * a / len(freqs), 0.005, 0.3)
    if sweep is None:
        return s
    return stereo(s, np.linspace(sweep[0], sweep[1], len(s)))


# ------------------------------------------------------------------ tonal bed
def chord_layer(freqs, t0, t1, att=1.5, rel=1.0, gain=1.0, bright=0.35):
    dur = t1 - t0
    t = t_axis(dur)
    mono = np.zeros(len(t))
    sides = np.zeros((len(t), 2))
    for k, f in enumerate(freqs):
        for det, pan in ((-0.0025, -0.6), (0.0, 0.0), (0.0025, 0.6)):
            ff = f * (1 + det) * (1 + 0.0012 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + k))
            ph = 2 * np.pi * np.cumsum(ff) / SR
            v = np.sin(ph) + bright * 0.5 * np.sin(2 * ph) + bright * 0.2 * np.sin(3 * ph)
            sides += stereo(v / 3, pan)
    e = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel)
    e = e * e * (3 - 2 * e)
    sides *= (e / len(freqs))[:, None]
    sides[:, 0] = spectral(sides[:, 0], 30, 2400, 2)
    sides[:, 1] = spectral(sides[:, 1], 30, 2400, 2)
    place(sides, t0, gain, verb=0.35)


D1, A1, D2, E2, F2, A2, Bb1, C3, D3, F3, Fs3, G3, A3, E4, A4 = (
    36.71, 55.0, 73.42, 82.41, 87.31, 110.0, 58.27, 130.81, 146.83, 174.61, 185.0, 196.0, 220.0, 329.63, 440.0)

# sub drone: present from the darkness, absent in the restraint of scene 05
chord_layer([D1, D2], 0.15, 18.4, att=3.0, rel=0.9, gain=0.5, bright=0.05)
chord_layer([D1, D2], 22.9, 29.95, att=1.4, rel=0.6, gain=0.42, bright=0.05)
# harmonic pad, changing with each scene
chord_layer([D2, A2], 0.4, 4.6, att=2.6, rel=0.8, gain=0.34)
chord_layer([Bb1, F2, D3, F3], 3.9, 8.4, att=0.9, rel=0.7, gain=0.30)
chord_layer([D2, A2, F3, E4], 7.8, 13.4, att=0.8, rel=0.8, gain=0.26)
chord_layer([F2, C3, G3, A3], 12.8, 18.3, att=0.9, rel=0.7, gain=0.26)
chord_layer([D2, A2, Fs3, E4, A4], 24.3, 29.95, att=0.5, rel=0.6, gain=0.30, bright=0.45)
# scene 05: near silence — a single high line and the faintest air
chord_layer([880.0], 18.2, 22.9, att=1.2, rel=0.9, gain=0.05, bright=0.0)
air = moving_band(int(SR * 4.8), 5200, 6400, 0.6) * 0.02
place(fades(air * env(len(air), 0, 0.5, 1.0), 0.4, 0.6), 18.1, 1.0, verb=0.3)


# ------------------------------------------------------------------ events
def cue_list(kind):
    return [c for c in CUES['cues'] if c['kind'] == kind]


for c in CUES['cues']:
    k, at = c['kind'], c['t']
    if k == 'drone':
        place(deep_tone(5.0), at, 0.3, verb=0.35)
    elif k == 'lightOn':
        place(shimmer([2349.3, 3520.0], 2.4), at, 0.10, verb=0.6)
        sw = whoosh(1.6, 300, 1400, 0.65, 0.8)
        place(sw, at, 0.07, verb=0.5)
    elif k == 'beam':
        n = int(SR * c['dur'])
        b = moving_band(n, 700, 2200, 0.5, lambda p: np.sin(np.pi * p) ** 0.8) * env(n, 0, 0.5, 1.3)
        place(stereo(fades(b, 0.2, 0.3), np.linspace(-0.8, 0.8, n)), at, 0.09, verb=0.45)
    elif k == 'word':
        r = np.random.default_rng(12)
        for j in range(12):
            off = abs(j - 5.5) * 0.055
            place(pulse(SCALE[(j * 3) % 5] * 2, 0.5, 0.4), at + off, 0.018, pan=(j - 5.5) / 6.5, verb=0.6)
    elif k == 'sweep':
        n = int(SR * c['dur'])
        s = moving_band(n, 380, 5200, 0.55, lambda p: p ** 1.4) * env(n, 0, 0.58, 1.2)
        place(stereo(fades(s, 0.02, 0.05), np.linspace(-0.95, 0.95, n)), at, 0.32, verb=0.35)
        place(shimmer([1760.0, 2637.0], 1.2, sweep=(-0.6, 0.8)), at + 0.25, 0.05, verb=0.6)
    elif k == 'pulse':
        f = SCALE[c.get('note', 0) % len(SCALE)]
        place(pulse(f, 1.0), at, 0.11, pan=0.0, verb=0.45)
        place(pulse(f / 2, 1.0, 0.5), at, 0.05, verb=0.3)
    elif k == 'impact':
        place(sub_impact(), at, 0.66, verb=0.32)
        place(shimmer([D3 * 4, A3 * 4, F3 * 8], 3.0), at, 0.07, verb=0.7)
    elif k == 'riser':
        place(riser(c['dur'] + 0.05, 180, 900), at, 0.22, verb=0.25)
    elif k == 'through':
        s = whoosh(0.9, 3800, 300, 0.2, 0.6, lambda p: p ** 0.7, 1.8)
        place(s, at, 0.42, verb=0.35)
        place(sub_impact(70, 34, 1.6, click=0.15, body=0.3), at + 0.18, 0.34, verb=0.3)
    elif k == 'recede':
        place(whoosh(0.45, 2200, 500, 0.3, 0.5), at, 0.12, verb=0.4)
    elif k == 'assemble':
        place(ticks(c['dur'] + 0.15, 46, 3000, 7000, True, 7), at, 0.13, verb=0.25)
    elif k == 'scatter':
        place(whoosh(0.3, 1500, 4500, 0.25, 0.6), at, 0.07, verb=0.35)
    elif k == 'guides':
        for j, pn in enumerate((-0.55, 0.55)):
            tt = t_axis(0.02)
            cl = np.sin(2 * np.pi * 4200 * tt) * np.exp(-tt * 420)
            place(cl, at + j * 0.08, 0.10, pan=pn, verb=0.2)
        place(fades(sine(3951.1, 0.35) * np.exp(-t_axis(0.35) * 9), 0.005, 0.05), at + 0.05, 0.012, verb=0.5)
    elif k == 'gather':
        n = int(SR * c['dur'])
        g = moving_band(n, 900, 2600, 0.6) * env(n, 0, 0.55, 1.2)
        place(stereo(fades(g, 0.1, 0.1), 0.4 * np.sin(np.linspace(0, 3 * np.pi, n))), at, 0.06, verb=0.4)
        place(ticks(c['dur'], 30, 2500, 6000, True, 9), at, 0.06, verb=0.3)
    elif k == 'build':
        steps = 9
        for j in range(steps):
            f = [D3, F3, A3, C3 * 2, D3 * 2, F3 * 2, A3 * 2, C3 * 4, D3 * 4][j]
            tt = t_axis(0.5)
            kn = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 11) + 0.4 * np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 22)
            place(fades(kn, 0.002, 0.05), at + 0.05 + j * c['dur'] / (steps + 0.6), 0.045, pan=(j % 3 - 1) * 0.35, verb=0.35)
    elif k == 'scan':
        n = int(SR * c['dur'])
        t = np.linspace(0, 1, n)
        f = 300 * (1500 / 300) ** (0.5 - 0.5 * np.cos(np.pi * t))
        tone = sine(f, c['dur']) * (0.7 + 0.3 * np.sin(2 * np.pi * 14 * t * c['dur']))
        scan_air = moving_band(n, 600, 4200, 0.45, lambda p: 0.5 - 0.5 * np.cos(np.pi * p))
        place(fades((0.35 * tone + 0.65 * scan_air) * np.sin(np.pi * t) ** 0.7, 0.02, 0.05), at, 0.12, verb=0.35)
    elif k == 'settle':
        place(whoosh(1.1, 1800, 220, 0.25, 0.7, None, 1.6), at, 0.14, verb=0.5)
    elif k == 'quiet':
        place(glass([1174.66, 1046.5, 880.0][c.get('note', 0)], 2.6), at, 0.075, pan=0.0, verb=0.7)
    elif k == 'contract':
        n = int(SR * 0.55)
        sw = moving_band(n, 4800, 900, 0.5) * np.linspace(0, 1, n) ** 2.2
        place(fades(sw, 0.05, 0.01), at, 0.10, verb=0.3)
    elif k == 'converge':
        place(riser(c['dur'], 146.83, 1174.66), at, 0.26, verb=0.3)
        # accelerating ticks pulled into the centre
        n_t, tt0 = 22, 0.0
        for j in range(n_t):
            p = 1 - (1 - j / n_t) ** 1.9
            tk = t_axis(0.012)
            cl = np.sin(2 * np.pi * (2600 + 2400 * p) * tk) * np.exp(-tk * 480)
            place(cl, at + p * (c['dur'] - 0.04), 0.05 + 0.06 * p, pan=(0.8 if j % 2 else -0.8) * (1 - p), verb=0.25)
    elif k == 'reveal':
        place(sub_impact(84, 36.7, 3.0, click=0.22, body=0.45), at, 0.56, verb=0.35)
        place(shimmer([D3 * 4, Fs3 * 4, A3 * 4, E4 * 4], 3.4, sweep=(-0.3, 0.3)), at, 0.085, verb=0.7)
    elif k == 'sheen':
        place(shimmer([2793.8, 3520.0, 4186.0], c['dur'] + 0.6, sweep=(-0.85, 0.85)), at, 0.035, verb=0.6)
    elif k == 'tag':
        place(pulse(587.33, 1.6, 0.5), at, 0.08, verb=0.6)
        place(pulse(880.0, 1.6, 0.4), at + 0.06, 0.05, verb=0.6)


# ------------------------------------------------------------------ reverb (convolution)
def impulse_response(rt_low=3.4, rt_mid=2.7, rt_high=1.5, length=4.0, predelay=0.024):
    n = int(SR * length)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for ch in range(2):
        nz = np.random.default_rng(100 + ch).standard_normal(n)
        lo = spectral(nz, None, 700, 2) * np.exp(-6.91 * t / rt_low)
        mid = spectral(nz, 700, 3500, 2) * np.exp(-6.91 * t / rt_mid)
        hi = spectral(nz, 3500, None, 2) * np.exp(-6.91 * t / rt_high)
        x = lo + mid + 0.6 * hi
        x *= np.minimum(1, t / 0.06)                        # soft onset
        er = np.zeros(n)                                     # sparse early reflections
        for d, g in ((0.011, 0.5), (0.019, 0.35), (0.031, 0.28), (0.047, 0.2), (0.063, 0.15)):
            er[int((d + 0.003 * ch) * SR)] += g * (1 if ch == 0 else -1) ** int(d * 1000)
        ir[:, ch] = np.concatenate([np.zeros(int(predelay * SR)), (x / np.abs(x).max() * 0.6 + er)])[:n]
    return ir / np.sqrt((ir ** 2).sum(axis=0)).max()


def convolve(x, h):
    L = len(x) + len(h) - 1
    nfft = 1 << (L - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:len(x)]


IR = impulse_response()
wet = np.stack([convolve(send[:, ch], IR[:, ch]) for ch in range(2)], axis=1)
mix = dry + 0.85 * wet

# tame sub-sonic energy and harsh extreme highs on the master
for ch in range(2):
    mix[:, ch] = spectral(mix[:, ch], 26, 15500, 2)

# picture fades to black by 29.95 s: the sound resolves with it
t = np.arange(N) / SR
mix *= np.clip((29.95 - t) / 0.6, 0, 1)[:, None] ** 1.5
mix *= np.clip(t / 0.05, 0, 1)[:, None]

peak = np.abs(mix).max()
mix = mix / peak * 0.5                                      # headroom; loudness is set in export.sh
out = os.path.join(HERE, 'audio', 'claude-opus-5-5-sfx.raw.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(3)
    w.setframerate(SR)
    pcm = np.clip(mix, -1, 1) * (2 ** 23 - 1)
    pcm = pcm.astype('<i4')
    b = pcm.astype('<i4').tobytes()
    # pack 32-bit little-endian ints into 24-bit
    a = np.frombuffer(b, dtype=np.uint8).reshape(-1, 4)[:, :3]
    w.writeframes(a.tobytes())
print(out, f'{N / SR:.3f}s', 'events', len(CUES['cues']))
