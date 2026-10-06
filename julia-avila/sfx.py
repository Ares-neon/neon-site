"""Sound design sintetizado (sem samples) para julia-avila-reels-15s, sincronizado à timeline GSAP.

Paleta sonora delicada: harpa/pluck, sinos suaves, sopros de ar e o traço da caneta.
uso: python3 -I sfx.py   -> sfx.wav (48 kHz, estéreo, 15 s)
"""
import wave

import numpy as np

SR, DUR = 48000, 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
dry, send = np.zeros((N, 2)), np.zeros((N, 2))

# notas (Ré maior, registro médio-agudo)
D4, Fs4, A4, B4, D5, E5, Fs5, A5, B5, D6, E6, Fs6 = 293.66, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98


def T(d):
    return np.arange(int(SR * d)) / SR


def place(sig, at, gain=1.0, pan=0.0, verb=0.35):
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    i = int(at * SR)
    seg = sig[: max(0, N - i)] * gain
    dry[i:i + len(seg)] += seg
    send[i:i + len(seg)] += seg * verb


def fade(s, a=0.003, r=0.03):
    e = np.ones(len(s))
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return s * e


def bp(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4), len(x))


def pluck(f, dur=1.6, bright=0.5):
    """Harpa suave: parciais com decaimento mais rápido nos agudos."""
    t = T(dur)
    s = sum((bright ** (k - 1)) / k * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (2.2 + 1.8 * k)) for k in range(1, 6))
    return fade(s, 0.004, 0.08)


def bell(freqs, dur=3.0, decay=1.4):
    t = T(dur)
    s = np.zeros(len(t))
    for f in freqs:
        for ratio, amp in [(1, 1), (2.0, .25), (3.01, .08)]:
            s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * decay * ratio ** .6)
    return fade(s / len(freqs), 0.012, 0.2)


def air(dur, f0, f1, peak=.55, width=1.6):
    """Sopro de ar com filtro que acompanha o movimento."""
    n = int(SR * dur)
    noise, out = rng.standard_normal(n + 2048), np.zeros(n + 2048)
    win = np.hanning(1024)
    for s in range(0, n, 256):
        fc = f0 * (f1 / f0) ** (s / n)
        out[s:s + 1024] += bp(noise[s:s + 1024] * win, fc / width, fc * width) * win
    out = out[:n]
    t = np.arange(n) / n
    out *= np.where(t < peak, np.sin(t / peak * np.pi / 2) ** 2, np.cos((t - peak) / (1 - peak) * np.pi / 2) ** 2)
    return fade(out / (np.abs(out).max() + 1e-9), 0.01, 0.03)


def pen(dur):
    """Traço de caneta: ruído agudo muito leve com micro-variações."""
    n = int(SR * dur)
    s = bp(rng.standard_normal(n), 2500, 7500)
    mod = 0.55 + 0.45 * np.abs(np.sin(np.cumsum(rng.uniform(8, 22, n)) / SR * 2 * np.pi))
    env = np.sin(np.linspace(0, np.pi, n)) ** .6
    s = s * mod * env
    return fade(s / np.abs(s).max(), 0.03, 0.08)


def tap():
    t = T(0.08)
    s = bp(rng.standard_normal(len(t)), 900, 3200) * np.exp(-t * 260)
    s += 0.6 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 60)
    return fade(s / np.abs(s).max(), 0.0005, 0.01)


# ===== CENA 01 =====
place(bell([A5], 1.6, 3.5), 0.06, .12, verb=.6)                     # a linha nasce
place(pen(1.0), 0.56, .045, pan=-.15, verb=.15)                     # desenho do rosto
for k, (f, at) in enumerate([(D5, .62), (Fs5, .86), (A5, 1.1), (D6, 1.34)]):
    place(pluck(f), at, .16, pan=-.3 + k * .2)
place(air(.8, 300, 1400), 1.52, .1, pan=.3)                        # vira círculo
place(bell([D5, Fs5, A5, D6], 3.2, 1.1), 1.94, .3, verb=.6)        # logo
# ===== CENA 02 =====
place(air(.6, 1800, 400, .7), 2.45, .1)                            # iris fecha
place(air(.9, 300, 1600, .5), 2.68, .12, pan=-.2)                  # iris abre
place(pluck(B4, 2.0, .35), 2.8, .14, pan=.2)
for k, f in enumerate([Fs6, A5, D6, E6]):                          # BELEZA
    place(bell([f], 1.4, 3.2), 3.3 + k * .07, .07, pan=-.3 + k * .2, verb=.7)
place(pluck(D5, 2.0, .4), 3.32, .16)
place(air(.6, 2400, 900, .4), 4.36, .08)                           # máscara vertical
place(air(.6, 1600, 400, .6), 4.5, .08, pan=.2)
# ===== CENA 03 =====
place(air(.8, 3000, 6000, .5), 4.98, .04)
place(pluck(A4, 1.6, .4), 5.08, .17, pan=-.2)                      # SUA
place(bell([D5, A5, Fs6], 2.4, 1.6), 5.3, .2, verb=.6)             # Beleza,
for k, f in enumerate([Fs5, A5, D6]):                              # DO SEU JEITO.
    place(pluck(f, 1.4, .45), 5.72 + k * .14, .13, pan=-.2 + k * .2)
place(air(.5, 1200, 400, .6), 6.62, .07)
# ===== CENA 04 =====
for k, (f, chime) in enumerate([(D5, Fs6), (E5, A5 * 2), (Fs5, D6 * 2)]):
    t0 = 7.08 + k * 1.12
    place(air(1.0, 2000, 5000, .5), t0, .035, pan=.2)              # linha desenhando
    place(pluck(f, 1.8, .4), t0 + .34, .17, pan=-.15 + k * .15)    # palavra
    place(bell([chime], 1.0, 4.5), t0 + .72, .06, pan=.3, verb=.6)  # ponto
place(air(.6, 1400, 400, .6), 10.52, .08)
# ===== CENA 05 =====
place(pen(1.05), 11.02, .045, pan=-.15, verb=.15)
for k, (f, at) in enumerate([(D5, 11.08), (Fs5, 11.32), (A5, 11.56), (D6, 11.8)]):
    place(pluck(f), at, .15, pan=-.3 + k * .2)
place(bell([D4 * 2, Fs5, A5, D6], 3.0, 1.1), 11.88, .3, verb=.6)   # assinatura
place(air(.8, 3000, 7000, .5), 12.26, .04)
# ===== CENA 06 =====
place(air(.75, 500, 1500, .5), 12.95, .08)
place(pluck(A5, 1.4, .4), 13.32, .11, pan=-.1)                     # @handle
place(pluck(D6, 1.4, .4), 13.44, .1, pan=.1)                       # botão
place(air(.5, 900, 2200, .5), 13.58, .04, pan=.4)                  # cursor
place(tap(), 14.16, .32, pan=.05, verb=.1)                         # toque
place(bell([A5, D6, Fs6], 1.6, 2.6), 14.22, .18, verb=.7)          # onda dourada
place(bell([D4, A4, D5, Fs5], 1.6, 1.0), 14.42, .22, verb=.7)      # final

# ===== reverb de sala (IR sintética) + master =====
ir_t = T(2.2)
ir = np.stack([bp(rng.standard_normal(len(ir_t)), 250, 7000) * np.exp(-ir_t * 2.6) for _ in range(2)], 1)
ir /= np.sqrt((ir ** 2).sum(0))
nfft = 1 << (N + len(ir_t) - 1).bit_length()
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N] for c in range(2)], 1)
mix = dry + wet * 0.8
mix = np.stack([bp(mix[:, c], 40, 16000) for c in range(2)], 1)
mix = mix / (np.abs(mix).max() + 1e-9) * 1.1
mix = np.tanh(mix) / np.tanh(1.1) * 0.84 * 10 ** (-6.3 / 20)       # ~-17 LUFS (delicado)
tail = int(SR * .5)
mix[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 2
with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
print('sfx.wav ok')
