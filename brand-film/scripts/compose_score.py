#!/usr/bin/env python3
"""NEON brand film: original score and sound design, synthesized from code.

Everything is generated here (no samples, no third-party audio), seeded, so a
re-run produces the same file bit for bit.

Grid: 80 BPM, beat = 0.75 s, bar = 3 s = one storyboard scene. Key: D minor.
  bars 1-5   contemplation  sparse felt piano, sub drone, air
  bars 6-10  construction   strings enter, heartbeat, bass, footsteps, plates
  bars 11-15 growth         piano arpeggios, taiko, pulse, riser
  bars 16-18 climax         full strings, impacts, logo resolution on F major
  bars 19-20 signature      manifesto notes, final low D, silence

Output: public/audio/neon-score.wav (48 kHz, 16-bit, stereo, exactly 60.000 s)
Run:    python3 scripts/compose_score.py
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio/neon-score.wav"
SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.75
BAR = 3.0
rng = np.random.default_rng(20260522)

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def midi(name):
    pitch, octave = (name[:-1], int(name[-1]))
    return 12 * (octave + 1) + NOTE[pitch]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def at(bar, beat=1.0):
    """Time in seconds of a bar (1-based) and beat (1-based, fractional)."""
    return (bar - 1) * BAR + (beat - 1) * BEAT


# ----------------------------------------------------------------------------
# buses
# ----------------------------------------------------------------------------
BUS = {k: np.zeros((2, N)) for k in ("piano", "strings", "bass", "perc", "sfx", "dry")}


def place(bus, sig, t0, pan=0.0, gain=1.0):
    """Mix a mono (L,) or stereo (2, L) signal into a bus at time t0 (s)."""
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        lg = np.cos((pan + 1) * np.pi / 4)
        rg = np.sin((pan + 1) * np.pi / 4)
        sig = np.vstack([sig * lg, sig * rg]) * np.sqrt(2)
    s0 = max(0, -i0)
    i0 = max(0, i0)
    L = min(sig.shape[1] - s0, N - i0)
    if L > 0:
        BUS[bus][:, i0:i0 + L] += sig[:, s0:s0 + L] * gain


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


# ----------------------------------------------------------------------------
# instruments
# ----------------------------------------------------------------------------
def piano(m, dur, vel):
    """Felt piano: inharmonic partials, three slightly detuned strings,
    two-stage decay, soft hammer, damper at note-off."""
    f0 = hz(m)
    tail = 2.6 if m < 60 else 2.0
    L = int((dur + tail) * SR)
    t = np.arange(L) / SR
    B = 0.00016 * (f0 / 261.6) ** 0.5
    out = np.zeros(L)
    hard = 0.62 - 0.38 * vel
    tau0 = 3.4 * (261.6 / f0) ** 0.42
    for n in range(1, 20):
        fn = n * f0 * np.sqrt(1 + B * n * n)
        if fn > 10000:
            break
        an = n ** -1.1 * np.exp(-(n - 1) * hard)
        taun = tau0 / (1 + 0.3 * (n - 1))
        env = 0.6 * np.exp(-t / (taun * 0.3)) + 0.4 * np.exp(-t / taun)
        for cents in ((-0.4, 0.0, 0.35) if n < 6 else (0.0,)):
            fd = fn * 2 ** (cents / 1200)
            out += an * env * np.sin(2 * np.pi * fd * t + rng.uniform(0, 2 * np.pi)) / (3 if n < 6 else 1)
    out *= np.minimum(1.0, t / 0.003)
    off = int(dur * SR)
    out[off:] *= np.exp(-(t[off:] - dur) / 0.35)
    thump = lowpass(rng.standard_normal(L), 300) * np.exp(-t / 0.012) * 0.25
    out = out + thump
    out = lowpass(out, 2800 + 4500 * vel)
    return out * vel * 0.32


def saw(freq, L, phase0):
    """Band-limited sawtooth (polyBLEP); freq may be an array."""
    freq = np.broadcast_to(freq, (L,)).astype(float)
    dt = freq / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt[m2]
    y[m2] -= x * x + x + x + 1
    return y


def strings(m, dur, amp, attack=0.9, release=1.2, bright=1.0):
    """Ensemble pad: 6 detuned saws with delayed vibrato, slow envelope,
    low-passed; returns stereo."""
    L = int((dur + release + 0.1) * SR)
    t = np.arange(L) / SR
    f0 = hz(m)
    vib = 1 + 0.0022 * np.sin(2 * np.pi * 5.1 * t + rng.uniform(0, 6)) * np.minimum(1, t / 1.2)
    out = np.zeros((2, L))
    for k in range(6):
        det = 2 ** ((rng.uniform(-11, 11)) / 1200)
        v = saw(f0 * det * vib, L, rng.uniform())
        pan = -0.7 + 1.4 * k / 5
        out[0] += v * np.cos((pan + 1) * np.pi / 4)
        out[1] += v * np.sin((pan + 1) * np.pi / 4)
    fc = min(9000, (900 + 2.2 * f0) * bright)
    out = np.vstack([lowpass(out[0], fc, 2), lowpass(out[1], fc, 2)])
    env = np.minimum(1, t / attack) ** 1.5
    rel = np.clip((t - dur) / release, 0, 1)
    env *= 1 - rel * rel * (3 - 2 * rel)
    return out * env * amp / 6


def bass(m, dur, amp, attack=0.06, release=0.5, pulse=False):
    L = int((dur + release) * SR)
    t = np.arange(L) / SR
    f0 = hz(m)
    y = np.sin(2 * np.pi * f0 * t) + 0.18 * np.sin(4 * np.pi * f0 * t + 0.3)
    y = np.tanh(1.4 * y) / np.tanh(1.4)
    env = np.minimum(1, t / attack)
    if pulse:
        # eighth-note breathing of the bass line
        ph = (t / (BEAT / 2)) % 1
        env *= 0.42 + 0.58 * np.exp(-ph * 4.5)
    rel = np.clip((t - dur) / release, 0, 1)
    env *= 1 - rel
    return y * env * amp


def boom(amp, decay=0.7, f_hi=92, f_lo=40, click=0.25, sweep=0.06):
    L = int((decay * 5 + 0.2) * SR)
    t = np.arange(L) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / sweep)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    hit = bandpass(rng.standard_normal(L), 180, 1600) * np.exp(-t / 0.01)
    return amp * (body + click * hit)


def tom(amp):
    return boom(amp, decay=0.22, f_hi=170, f_lo=96, click=0.35, sweep=0.03)


def kick_soft(amp):
    return boom(amp, decay=0.2, f_hi=72, f_lo=44, click=0.08, sweep=0.04)


def bell(m, amp, decay=2.6):
    f0 = hz(m)
    L = int(decay * 4 * SR)
    t = np.arange(L) / SR
    y = np.zeros(L)
    for ratio, a, d in ((1.0, 1.0, 1.0), (2.0, 0.42, 0.6), (3.01, 0.22, 0.42), (4.17, 0.12, 0.3), (5.43, 0.07, 0.22)):
        y += a * np.sin(2 * np.pi * f0 * ratio * t + rng.uniform(0, 6)) * np.exp(-t / (decay * d))
    return y * np.minimum(1, t / 0.004) * amp


def shaped_noise(dur, fc, bw_oct, env, flutter=0.0, seed=None):
    """Noise shaped in the STFT domain: a log-gaussian band around fc(t)
    with width bw_oct(t) octaves, amplitude env(t). fc, bw, env are callables
    of normalised time u in [0, 1]. Returns stereo (decorrelated)."""
    L = int(dur * SR)
    g = np.random.default_rng(seed if seed is not None else int(rng.integers(1 << 30)))
    out = np.zeros((2, L))
    for ch in range(2):
        x = g.standard_normal(L + 2048)
        f, tt, Z = signal.stft(x, fs=SR, nperseg=1024, noverlap=768)
        u = np.clip(tt / dur, 0, 1)
        logf = np.log2(np.maximum(f, 1.0))[:, None]
        c = np.log2(np.array([fc(v) for v in u]))[None, :]
        w = np.array([bw_oct(v) for v in u])[None, :]
        Z *= np.exp(-0.5 * ((logf - c) / (w / 2.355)) ** 2)
        _, y = signal.istft(Z, fs=SR, nperseg=1024, noverlap=768)
        y = y[:L]
        out[ch, :len(y)] = y
    t = np.arange(L) / SR
    e = np.array([env(v) for v in t / dur])
    if flutter > 0:
        fl = lowpass(g.standard_normal(L), 14, 2)
        fl /= np.max(np.abs(fl)) + 1e-9
        e = e * (1 + flutter * fl)
    out *= e
    peak = np.max(np.abs(out)) + 1e-9
    return out / peak


def adsr(a, r, shape=2.0):
    def f(u):
        return min(1.0, u / max(a, 1e-4)) ** shape * min(1.0, (1 - u) / max(r, 1e-4))
    return f


def whoosh(t0, dur, f0, f1, f2, amp, pan0=0.0, pan1=0.0, bw=1.4, flutter=0.3):
    sig = shaped_noise(
        dur,
        lambda u: f0 * (f1 / f0) ** min(1, u / 0.5) if u < 0.5 else f1 * (f2 / f1) ** ((u - 0.5) / 0.5),
        lambda u: bw,
        lambda u: np.sin(np.pi * u) ** 1.6,
        flutter=flutter,
    )
    L = sig.shape[1]
    p = np.linspace(pan0, pan1, L)
    lg = np.cos((p + 1) * np.pi / 4) * np.sqrt(2)
    rg = np.sin((p + 1) * np.pi / 4) * np.sqrt(2)
    mono = (sig[0] + sig[1]) * 0.5
    side = (sig[0] - sig[1]) * 0.5
    st = np.vstack([mono * lg + side * 0.6, mono * rg - side * 0.6])
    place("sfx", st, t0, gain=amp)


def riser(t0, dur, f0, f1, amp, curve=2.5):
    sig = shaped_noise(dur, lambda u: f0 * (f1 / f0) ** u, lambda u: 1.0 + 0.6 * u, lambda u: u ** curve * (1 - max(0, u - 0.97) / 0.03))
    place("sfx", sig, t0, gain=amp)


def footstep(t0, amp, pan):
    L = int(0.18 * SR)
    t = np.arange(L) / SR
    thud = lowpass(rng.standard_normal(L), 240) * np.exp(-t / 0.035) * 3.0
    body = np.sin(2 * np.pi * 78 * t) * np.exp(-t / 0.05)
    grit = bandpass(rng.standard_normal(L), 1800, 4200) * np.exp(-t / 0.006) * 0.25
    s = (thud + body + grit) * amp * rng.uniform(0.85, 1.1)
    place("sfx", s, t0, pan=pan)


def click(t0, amp, pan=0.0):
    L = int(0.25 * SR)
    t = np.arange(L) / SR
    k = bandpass(rng.standard_normal(L), 1500, 5000) * np.exp(-t / 0.005) * 0.6
    th = np.sin(2 * np.pi * 135 * t) * np.exp(-t / 0.06)
    place("sfx", (k + th) * amp, t0, pan=pan)


# ----------------------------------------------------------------------------
# reverb
# ----------------------------------------------------------------------------
def impulse(seconds=4.6, rt60=3.4, predelay=0.022):
    L = int(seconds * SR)
    t = np.arange(L) / SR
    ir = np.zeros((2, L))
    for ch in range(2):
        n = rng.standard_normal(L)
        lo = lowpass(n, 1800, 2)
        hi = n - lo
        ir[ch] = lo * np.exp(-6.91 * t / rt60) + 0.5 * hi * np.exp(-6.91 * t / (rt60 * 0.4))
        ir[ch] *= np.minimum(1, t / 0.03)
        for k in range(14):
            d = int(rng.uniform(0.006, 0.07) * SR)
            ir[ch, d] += rng.uniform(0.3, 0.8) * (-1) ** k
        ir[ch] = np.roll(ir[ch], int(predelay * SR))
        ir[ch, : int(predelay * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


def reverb(x, ir, wet):
    y = np.vstack([signal.fftconvolve(x[c], ir[c])[:N] for c in range(2)])
    return x * (1 - wet * 0.35) + y * wet


# ----------------------------------------------------------------------------
# score
# ----------------------------------------------------------------------------
def p(bus_t, name, beats, vel):
    place("piano", piano(midi(name), beats * BEAT, vel), bus_t, pan=float(np.clip((midi(name) - 62) / 40, -0.45, 0.45)))


# Bars 1-5: contemplation -------------------------------------------------
p(1.55, "D5", 3.0, 0.22)                      # the door opens
for bar, notes in (
    (2, (("D5", 1, 1.5, 0.34), ("A4", 2.5, 1.5, 0.27), ("F5", 4, 2.0, 0.31))),
    (3, (("D5", 1, 1.5, 0.33), ("Bb4", 2.5, 1.5, 0.27), ("F5", 4, 2.0, 0.30))),
    (4, (("C5", 1, 1.5, 0.33), ("A4", 2.5, 1.0, 0.27), ("F5", 3.5, 1.0, 0.29), ("E5", 4.5, 1.5, 0.29))),
    (5, (("E5", 1, 1.5, 0.33), ("C5", 2.5, 1.5, 0.27), ("G4", 4, 2.0, 0.29))),
):
    for name, beat, dur, vel in notes:
        p(at(bar, beat), name, dur, vel)

# Bars 6-10: construction --------------------------------------------------
for bar, notes, lh in (
    (6, (("D5", 1), ("A4", 2), ("F5", 3), ("E5", 4)), "D3"),
    (7, (("D5", 1), ("Bb4", 2), ("F5", 3), ("D5", 4)), "Bb2"),
    (8, (("C5", 1), ("A4", 2), ("F5", 3), ("A5", 4)), "F2"),
    (9, (("E5", 1), ("G4", 2), ("C5", 3), ("E5", 4)), "C3"),
):
    for i, (name, beat) in enumerate(notes):
        p(at(bar, beat), name, 1.0, 0.36 + 0.02 * (bar - 6) - 0.04 * (i % 2))
    p(at(bar, 1), lh, 4.0, 0.3)
p(at(10, 1), "D5", 2.0, 0.42)
p(at(10, 3), "A5", 2.0, 0.40)
p(at(10, 1), "D2", 4.0, 0.36)
p(at(10, 1), "A2", 4.0, 0.3)

# Bars 11-15: growth: arpeggios -------------------------------------------
ARP = {
    "Bb": ["Bb3", "F4", "Bb4", "D5", "F4", "Bb4", "D5", "F5"],
    "F": ["F3", "C4", "F4", "A4", "C4", "F4", "A4", "C5"],
    "C": ["C4", "G4", "C5", "E5", "G4", "C5", "E5", "G5"],
    "Dm": ["D4", "A4", "D5", "F5", "A4", "D5", "F5", "A5"],
}
ROOTS = {"Bb": "Bb1", "F": "F2", "C": "C2", "Dm": "D2"}
for bar, chord, vel in ((11, "Bb", 0.30), (12, "F", 0.34), (13, "C", 0.38), (14, "Dm", 0.42)):
    for i, name in enumerate(ARP[chord]):
        p(at(bar, 1 + i * 0.5), name, 0.7, vel + (0.05 if i % 4 == 0 else 0))
    p(at(bar, 1), ROOTS[chord].replace("1", "2") if chord == "Bb" else ROOTS[chord].replace("2", "3"), 2.0, 0.34)
    p(at(bar, 3), ROOTS[chord].replace("1", "2") if chord == "Bb" else ROOTS[chord].replace("2", "3"), 2.0, 0.3)
for i, name in enumerate(ARP["Bb"][:4] + ARP["C"][4:]):
    p(at(15, 1 + i * 0.5), name, 0.7, 0.46 + 0.02 * i)
p(at(15, 1), "Bb2", 2.0, 0.38)
p(at(15, 3), "C3", 2.0, 0.4)

# Bars 16-18: climax ------------------------------------------------------
for name in ("D3", "A3", "D4", "F4", "A4", "D5"):
    p(at(16, 1), name, 4.0, 0.62)
for i, name in enumerate(ARP["Dm"]):
    p(at(16, 1 + i * 0.5), name, 0.7, 0.5)
for name in ("Bb2", "F3", "Bb3", "D4", "F4"):
    p(at(17, 1), name, 4.0, 0.64)
for name, beat in (("F5", 1), ("A5", 2), ("G5", 3), ("F5", 4)):
    p(at(17, beat), name, 1.0, 0.56)
for name in ("F3", "C4", "F4", "A4", "C5"):
    p(at(18, 1) + 0.05, name, 4.0, 0.46)      # symbol opens
p(52.42, "C6", 2.5, 0.26)                     # wordmark

# Bars 19-20: signature ---------------------------------------------------
for t0, name in ((54.1, "A4"), (54.475, "D5"), (54.85, "E5"), (55.6, "F5"), (55.975, "A5"), (56.725, "D6")):
    p(t0, name, 1.6, 0.25)
for name in ("D2", "A2", "D3"):
    p(at(20, 1), name, 2.0, 0.26)

# Strings ------------------------------------------------------------------
CHORDS = {
    6: (["D3", "A3", "F4"], 0.10), 7: (["Bb2", "F3", "D4"], 0.12), 8: (["F2", "C3", "A3"], 0.13),
    9: (["C3", "G3", "E4"], 0.14), 10: (["D3", "A3", "E4"], 0.16), 11: (["Bb2", "F3", "D4", "F4"], 0.18),
    12: (["F2", "C3", "A3", "C4"], 0.20), 13: (["C3", "G3", "E4", "G4"], 0.22), 14: (["D3", "A3", "F4", "A4"], 0.25),
    16: (["D3", "A3", "D4", "F4", "A4"], 0.34), 17: (["Bb2", "F3", "Bb3", "D4", "F4", "D5"], 0.36),
    18: (["F2", "C3", "A3", "C4", "F4"], 0.26),
}
def low_cut(n):
    # Keep the low register of the pad light; the bass owns that space.
    return 0.45 if midi(n) < 48 else (0.75 if midi(n) < 55 else 1.0)


for bar, (notes, amp) in CHORDS.items():
    for n in notes:
        place("strings", strings(midi(n), BAR + 0.25, amp * low_cut(n), attack=1.1 if bar < 16 else 0.35, bright=0.8 + 0.06 * (bar - 6)), at(bar))
for n in ["Bb2", "F3", "D4", "F4"]:
    place("strings", strings(midi(n), 1.6, 0.28 * low_cut(n), attack=0.6), at(15, 1))
for n in ["C3", "G3", "E4", "G4"]:
    place("strings", strings(midi(n), 1.7, 0.32 * low_cut(n), attack=0.5, bright=1.4), at(15, 3))
for n in ("A4", "D5"):
    place("strings", strings(midi(n), 5.0, 0.05, attack=0.8, release=2.0), at(19))

# Bass -------------------------------------------------------------------
place("bass", bass(midi("D1"), 14.5, 0.030, attack=4.0, release=1.5), 0.5)
place("bass", bass(midi("D2"), 14.5, 0.018, attack=5.0, release=1.5), 0.5)
for bar, root, pulse in ((6, "D2", False), (7, "Bb1", False), (8, "F1", False), (9, "C2", False), (10, "D2", False),
                         (11, "Bb1", True), (12, "F1", True), (13, "C2", True), (14, "D2", True), (16, "D2", True), (17, "Bb1", True), (18, "F1", False)):
    place("bass", bass(midi(root), BAR, (0.07 if bar < 11 else 0.10 + 0.01 * (bar - 11)) if bar < 16 else 0.16, pulse=pulse), at(bar))
place("bass", bass(midi("Bb1"), 1.5, 0.14, pulse=True), at(15, 1))
place("bass", bass(midi("C2"), 1.5, 0.15, pulse=True), at(15, 3))
place("bass", bass(midi("D1"), 1.9, 0.06, attack=0.05, release=1.2), at(20))

# Percussion ---------------------------------------------------------------
for bar in range(6, 11):
    for beat in ((1,) if bar == 8 else (1, 3)):
        place("perc", kick_soft(0.20), at(bar, beat))
for bar in range(11, 16):
    place("perc", boom(0.30 + 0.05 * (bar - 11)), at(bar, 1))
    place("perc", tom(0.16 + 0.02 * (bar - 11)), at(bar, 3), pan=0.15)
for i in range(8):                                    # roll into the climax
    place("perc", tom(0.10 + 0.05 * i), at(15, 3 + i * 0.25), pan=-0.1 + 0.03 * i)
place("perc", boom(0.95, decay=1.1), at(16))
place("perc", boom(0.5), at(16, 3))
for bar in (16, 17):
    for i in range(8):
        if i % 4 != 0:
            place("perc", tom(0.18 if i % 2 else 0.26), at(bar, 1 + i * 0.5), pan=0.2 * ((i % 3) - 1))
place("perc", boom(1.0, decay=1.3), at(17))
place("perc", boom(0.55), at(17, 3))
place("perc", boom(0.7, decay=1.6, f_hi=70, f_lo=34), at(18) + 0.05)
place("perc", boom(0.22, decay=1.4, f_hi=60, f_lo=32, click=0.05), at(20))

# Sound design (times follow the picture) -----------------------------------
whoosh(0.15, 1.3, 5500, 8000, 6500, 0.020, -0.2, 0.2, bw=1.2, flutter=0.0)   # the line of light
whoosh(1.15, 1.8, 300, 700, 500, 0.060, 0.0, 0.0, bw=1.6, flutter=0.1)       # the door opens
riser(2.25, 0.75, 700, 3200, 0.10)                                             # light floods
place("perc", boom(0.22, decay=0.9), 3.0)
place("sfx", bell(midi("A5"), 0.03), 3.0)
whoosh(5.45, 0.6, 180, 90, 60, 0.11, 0, 0, bw=1.2, flutter=0.0)               # into the pupil
whoosh(6.25, 1.6, 450, 1100, 600, 0.060, -0.35, 0.3)                          # cloth
whoosh(7.55, 1.2, 600, 1300, 700, 0.045, 0.3, -0.2)
whoosh(8.35, 0.95, 280, 1500, 450, 0.130, 0.6, -0.6, bw=1.8)                  # cloth across the lens
place("sfx", bell(midi("A5"), 0.025, decay=3.5), 9.1)                         # green line wakes
whoosh(10.95, 1.15, 200, 750, 300, 0.120, 0.7, -0.7, bw=1.6, flutter=0.0)     # pillar passes the lens
whoosh(12.4, 2.3, 4500, 5200, 4800, 0.018, -0.5, 0.5, bw=0.7, flutter=0.0)    # light along the curve
whoosh(15.0, 1.4, 1200, 1600, 1100, 0.020, 0.1, 0.1, bw=2.2, flutter=0.15)    # breath
whoosh(17.55, 0.9, 600, 1200, 900, 0.07, -0.3, 0.3)
whoosh(18.2, 1.4, 500, 1150, 650, 0.070, -0.6, 0.2)                           # green cloth
whoosh(19.5, 1.2, 700, 1300, 500, 0.060, 0.2, 0.6)
whoosh(20.25, 0.8, 1300, 600, 280, 0.060, 0.4, -0.2, bw=1.2)                  # cloth becomes a line
for k in range(8):                                                             # footfalls on eighths
    footstep(at(8, 1 + k * 0.5), 0.22, 0.12 if k % 2 else -0.12)
whoosh(23.55, 0.8, 400, 900, 500, 0.04, 0.2, -0.2)
for k, t0 in enumerate((24.75, 25.125, 25.5, 25.875)):                         # plates seat
    whoosh(t0 - 0.32, 0.36, 500, 1400, 900, 0.035, (-1) ** k * 0.4, 0)
    click(t0, 0.20, pan=(-1) ** k * 0.15)
riser(26.35, 0.65, 900, 4200, 0.06)                                            # the beam rises
place("sfx", shaped_noise(3.2, lambda u: 380 + 180 * np.sin(u * 7), lambda u: 1.8, lambda u: np.sin(np.pi * u) ** 0.8, flutter=0.5), 27.0, gain=0.07)  # wind
whoosh(29.45, 0.6, 2500, 1200, 500, 0.05, 0, 0)
for k in range(10):                                                            # light running round the ring
    t0 = 30.15 + k * 0.24
    ang = np.pi / 2 + 2 * np.pi * (k / 10)
    whoosh(t0, 0.5, 3600, 4400, 3900, 0.010, float(np.cos(ang)) * 0.7, float(np.cos(ang + 0.6)) * 0.7, bw=0.8, flutter=0.0)
whoosh(32.45, 0.9, 300, 1300, 500, 0.12, -0.3, 0.3, bw=1.6, flutter=0.0)     # through the ring
whoosh(33.05, 1.45, 180, 320, 260, 0.05, -0.4, 0.4, bw=1.0, flutter=0.05)    # surfaces slide
place("perc", boom(0.30, decay=0.8), at(12, 3))                               # they meet
place("sfx", bell(midi("D6"), 0.035, decay=2.0), at(12, 3))
place("bass", bass(midi("D3"), 2.6, 0.035, attack=0.8, release=1.0), 36.2)   # resonance under the relief
whoosh(38.5, 0.95, 350, 1400, 600, 0.12, -0.6, 0.4, bw=1.8)                  # cloth sweeps in
whoosh(39.4, 1.8, 600, 1000, 300, 0.06, 0.3, -0.3)
for k in range(5):                                                             # monoliths rise
    place("perc", boom(0.16 + 0.05 * k, decay=0.5, f_hi=80, f_lo=42, click=0.15), at(15, 1 + k * 0.5))
    whoosh(at(15, 1 + k * 0.5) - 0.02, 0.5, 120, 260, 160, 0.03 + 0.01 * k, 0, 0, bw=1.2, flutter=0.2)
riser(43.7, 1.3, 500, 5200, 0.17)
whoosh(45.0, 2.9, 90, 160, 120, 0.06, 0, 0, bw=1.4, flutter=0.4)             # rumble towards the arch
riser(47.2, 0.8, 600, 4000, 0.18)                                              # into the light
whoosh(48.0, 2.6, 5000, 7000, 3000, 0.04, -0.2, 0.2, bw=1.6, flutter=0.0)    # air after the impact
whoosh(48.4, 2.2, 3800, 4400, 4000, 0.016, -0.7, 0.7, bw=0.7, flutter=0.0)   # line along the horizon
whoosh(50.55, 0.5, 2200, 900, 400, 0.06, 0, 0, bw=1.2, flutter=0.0)          # collapse to a line
place("sfx", bell(midi("D6"), 0.05, decay=3.0), at(18) + 0.08)
place("sfx", bell(midi("A6"), 0.025, decay=2.2), 52.42)
whoosh(52.35, 1.3, 5000, 7500, 6000, 0.012, -0.4, 0.4, bw=0.8, flutter=0.0)  # light across the wordmark
place("sfx", bell(midi("D7"), 0.012, decay=2.5), 56.725)
whoosh(57.85, 0.6, 2500, 4000, 3000, 0.012, 0, 0, bw=0.8, flutter=0.0)

# ----------------------------------------------------------------------------
# mix
# ----------------------------------------------------------------------------
ir_hall = impulse(4.8, 3.6)
ir_room = impulse(2.0, 1.2, predelay=0.01)
mix = (
    reverb(BUS["piano"], ir_hall, 0.42) * 1.0
    + reverb(BUS["strings"], ir_hall, 0.38) * 0.9
    + BUS["bass"] * 1.0
    + reverb(BUS["perc"], ir_room, 0.30) * 0.95
    + reverb(BUS["sfx"], ir_room, 0.22) * 1.0
)
mix = np.vstack([highpass(mix[c], 24, 2) for c in range(2)])
mix /= np.max(np.abs(mix)) + 1e-12
mix *= 10 ** (-3 / 20)

# Gentle bus compression (2:1 above -20 dBFS RMS, 25 ms attack, 350 ms release).
env = np.sqrt(lowpass(np.mean(mix ** 2, axis=0), 8, 1).clip(1e-12))
lvl = 20 * np.log10(env + 1e-12)
gr_db = np.where(lvl > -20, (lvl + 20) * (1 - 1 / 2.0), 0.0)
gr = 10 ** (-gr_db / 20)
a_att = np.exp(-1 / (0.025 * SR))
a_rel = np.exp(-1 / (0.35 * SR))
sm = np.empty_like(gr)
g = 1.0
for i in range(0, len(gr), 64):  # block-wise smoothing is enough at this rate
    tgt = gr[i:i + 64].min()
    coef = a_att ** 64 if tgt < g else a_rel ** 64
    g = tgt + (g - tgt) * coef
    sm[i:i + 64] = g
mix *= sm

# Dramatic arc from the brief: contemplation, construction, growth, climax,
# signature. Applied after the compressor so it is not flattened.
t = np.arange(N) / SR
ARC_T = [0.0, 14.5, 15.5, 29.5, 30.5, 44.6, 45.0, 53.6, 54.4, 57.6, 58.0, 60.0]
ARC_G = [0.42, 0.46, 0.58, 0.64, 0.74, 0.86, 1.0, 1.0, 0.62, 0.62, 0.55, 0.55]
mix *= np.interp(t, ARC_T, ARC_G)

# Ending: complete silence for the last 0.35 s.
fade = np.clip((59.65 - t) / 1.3, 0, 1) ** 2
mix *= fade


def write(path, x, peak_dbfs=-1.0):
    x = x / (np.max(np.abs(x)) + 1e-12) * 10 ** (peak_dbfs / 20)
    pcm = np.clip(np.round(x.T * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


OUT.parent.mkdir(parents=True, exist_ok=True)
tmp = OUT.with_suffix(".tmp.wav")
write(tmp, mix, -1.0)

# Loudness: measure with ffmpeg's EBU R128 meter and set -16 LUFS integrated,
# keeping true peak under -1 dBTP with a soft limiter.
def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    txt = r.stderr
    i_lufs = float(txt.split("I:")[-1].split("LUFS")[0].strip())
    tp = float(txt.split("Peak:")[-1].split("dBFS")[0].strip())
    return i_lufs, tp


i_lufs, tp = measure(tmp)
TARGET = -16.0
gain = 10 ** ((TARGET - i_lufs) / 20)
x = mix / (np.max(np.abs(mix)) + 1e-12) * 10 ** (-1.0 / 20) * gain
ceiling = 10 ** (-1.2 / 20)
x = np.where(np.abs(x) > ceiling * 0.8, np.sign(x) * (ceiling * 0.8 + (ceiling * 0.2) * np.tanh((np.abs(x) - ceiling * 0.8) / (ceiling * 0.2))), x)
pcm = np.clip(np.round(x.T * 32767), -32768, 32767).astype("<i2")
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
tmp.unlink()
i2, tp2 = measure(OUT)
print(json.dumps({"file": str(OUT.relative_to(ROOT)), "seconds": N / SR, "integrated_lufs": i2, "true_peak_dbtp": tp2}, indent=2))
