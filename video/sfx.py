"""Sound design sintetizado para neon-reels-15s (sem samples de terceiros).

Os tempos espelham a timeline GSAP de neon-reels-15s.html.
uso: python3 sfx.py            -> gera sfx.wav (48 kHz, estéreo, 15 s)
     ffmpeg -i video-sem-audio.mp4 -i sfx.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest neon-reels-15s.mp4
"""
import wave
import numpy as np

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(39)  # determinístico

dry = np.zeros((N, 2))
send = np.zeros((N, 2))  # envio para a reverb


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def place(sig, at, gain=1.0, pan=0.0, verb=0.15):
    """Soma um sinal mono/estéreo na mixagem em `at` segundos (pan -1..1)."""
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
    i = int(at * SR)
    if i >= N:
        return
    seg = sig[: N - i] * gain
    dry[i:i + len(seg)] += seg
    send[i:i + len(seg)] += seg * verb


def fade(sig, a=0.002, r=0.01):
    n = len(sig)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    env = np.ones(n)
    env[:na] = np.linspace(0, 1, na)
    env[-nr:] *= np.linspace(1, 0, nr)
    return sig * env


def bandpass_fft(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


# ---------- vozes ----------

def riser(dur, f0, f1, harm=0.25):
    t = t_axis(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + harm * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    env = (t / dur) ** 1.6
    return fade(s * env, 0.01, 0.03)


def whoosh(dur, f0, f1, peak=0.6, width=1.4):
    """Ruído com band-pass móvel (overlap-add), envelope assimétrico."""
    n = int(SR * dur)
    noise = rng.standard_normal(n + 2048)
    out = np.zeros(n + 2048)
    hop, win = 256, np.hanning(1024)
    for s in range(0, n, hop):
        p = s / n
        fc = f0 * (f1 / f0) ** p
        fr = noise[s:s + 1024] * win
        out[s:s + 1024] += bandpass_fft(fr, fc / width, fc * width) * win
    out = out[:n]
    t = np.arange(n) / n
    env = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.5)
    out = out * env
    return fade(out / (np.abs(out).max() + 1e-9), 0.005, 0.02)


def tick(freq=2600, dur=0.03, noise=0.35):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 180)
    s += noise * bandpass_fft(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 400)
    return fade(s, 0.0005, 0.005)


def impact(f0=95, f1=42, dur=0.6, click=0.6):
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 22)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    s += click * bandpass_fft(rng.standard_normal(len(t)), 1500, 7000) * np.exp(-t * 160)
    return fade(np.tanh(s * 1.4), 0.001, 0.05)


def ping(freqs, dur=1.2, decay=4.0, attack=0.004):
    t = t_axis(dur)
    s = sum(np.sin(2 * np.pi * f * t) * (0.7 ** k) for k, f in enumerate(freqs))
    s = s * np.exp(-t * decay)
    return fade(s / len(freqs), attack, 0.05)


def blip(f0=1400, f1=900, dur=0.07):
    t = t_axis(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)
    return fade(s, 0.001, 0.01)


def mouse_click():
    def part(fc):
        t = t_axis(0.02)
        return bandpass_fft(rng.standard_normal(len(t)), fc * .6, fc * 1.6) * np.exp(-t * 650)
    s = np.zeros(int(SR * 0.09))
    a, b = part(3800), part(5200) * .6
    s[:len(a)] += a
    s[int(SR * .055):int(SR * .055) + len(b)] += b
    return fade(s / np.abs(s).max(), 0.0003, 0.005)


def shimmer(dur=0.7, base=2637, count=7):
    s = np.zeros(int(SR * dur))
    for k in range(count):
        at = int(SR * dur * k / count * 0.8)
        g = ping([base * (1.5 ** (k % 3)) * (1 + 0.01 * k)], dur=0.35, decay=12)
        s[at:at + len(g)] += g[: len(s) - at] * (1 - k / count * 0.5)
    return s


def char_ticks(at, count, stagger, gain=0.18, base=3200):
    for k in range(count):
        place(tick(base * (1 + 0.04 * rng.standard_normal()), 0.02, 0.5), at + k * stagger,
              gain * (0.75 + 0.25 * rng.random()), pan=(k / max(count - 1, 1) - .5) * .6, verb=.08)


def count_ticks(t0, dur, steps, f0, f1, gain=0.2):
    """Um tick sempre que o valor (ease power2.inOut) cruza um degrau."""
    def ease(p):
        return np.where(p < .5, 2 * p * p, 1 - (-2 * p + 2) ** 2 / 2)
    p = np.linspace(0, 1, 4000)
    v = ease(p) * steps
    idx = np.searchsorted(v, np.arange(1, steps + 1))
    for k, i in enumerate(idx):
        place(tick(f0 + (f1 - f0) * k / steps, 0.025, 0.3), t0 + p[min(i, 3999)] * dur, gain, verb=.05)


# ================= CENA 01 =================
place(riser(0.5, 180, 720), 0.0, .22, verb=.25)                 # linha nasce
place(impact(70, 40, .35, .2), 0.05, .25)
place(whoosh(.45, 500, 2200, .55), .40, .20, pan=-.2)            # curva → pílula
place(whoosh(.6, 300, 1600, .5), .72, .26, pan=.25)              # gira e expande
place(tick(3400, .03), .98, .22, pan=-.4)                        # marcações
place(tick(3600, .03), 1.02, .18, pan=.4)
place(whoosh(.48, 2600, 400, .85, 1.3), 1.28, .30)               # encolhe para o "O"
place(impact(110, 44, .7, .7), 1.74, .62, verb=.25)              # trava no "O"
place(ping([1318.5, 1975.5, 2637], 1.1, 5), 1.74, .16, verb=.4)
char_ticks(1.58, 3, .06, .16, 2400)                              # N E N
place(shimmer(.6), 1.9, .10, verb=.45)                           # subtítulo
place(whoosh(.45, 300, 3000, .6), 2.13, .34, pan=0)              # wipe vertical

# ================= CENA 02 =================
place(riser(.8, 400, 900, .1), 2.2, .07, verb=.4)                # anel desenha
place(whoosh(.65, 200, 1800, .7, 1.6), 2.40, .30, pan=-.15)      # iris
place(impact(80, 46, .45, .25), 2.98, .28)
char_ticks(2.95, 12, .022, .14)                                  # MOUHAMED ALI
place(whoosh(.5, 1500, 5000, .5), 3.2, .10, pan=.3)              # cargo
place(ping([987.8, 1480, 2217], 1.6, 3), 3.45, .2, verb=.5)      # CRIATIVIDADE
place(shimmer(.5, 3136, 6), 3.48, .08, verb=.5)
place(whoosh(.55, 400, 2800, .6), 4.64, .34, pan=-.6)            # wipe diagonal
place(whoosh(.55, 400, 2800, .6), 4.66, .22, pan=.6)

# ================= CENA 03 =================
for k, f in enumerate([95, 100, 106, 112]):                      # SUA MARCA PODE SER
    place(impact(f, 48, .35, .5), 4.94 + k * .07, .28, pan=(k - 1.5) * .15, verb=.12)
place(impact(120, 38, 1.0, .9), 5.22, .7, verb=.3)               # MAIS.
place(ping([659.3, 987.8, 1318.5], 1.4, 3), 5.22, .17, verb=.5)
place(whoosh(.45, 3000, 7000, .5), 5.58, .07, pan=-.5)           # hairline
for k, (f, p) in enumerate([(2093, -.3), (2349, 0), (2637, .3)]):  # BRANDING. PERFORMANCE. RESULTADO.
    place(impact(100 + k * 8, 50, .32, .6), 5.80 + k * .2, .34, pan=p)
    place(ping([f], .35, 14), 5.98 + k * .2, .12, pan=p)
place(whoosh(.35, 600, 3500, .7), 6.58, .2)                      # saída
place(whoosh(.45, 3000, 300, .45), 6.78, .32)                    # wipe para baixo

# ================= CENA 04 =================
for t0, p in [(6.88, -.3), (7.80, 0), (8.62, .3)]:               # hairlines dos blocos
    place(whoosh(.55, 2500, 8000, .5), t0, .09, pan=p)
    place(impact(85, 50, .25, .4), t0 + .22, .18, pan=p)
# 01 BRANDING — construção
for k, at in enumerate([7.12, 7.22, 7.36, 7.50]):
    place(blip(1100 + k * 160, 800, .08), at, .14, pan=.45, verb=.25)
for k in range(6):
    place(tick(3000 + k * 180, .02), 7.72 + k * .04, .14, pan=.5)
place(blip(2200, 1600, .12), 7.92, .2, pan=.45, verb=.35)
# 02 PERFORMANCE — gráfico + count-up
place(riser(1.0, 300, 1200, .15), 8.12, .08, verb=.3)
count_ticks(8.12, 1.05, 16, 1800, 3400, .17)
place(ping([1568, 2349.3], .9, 5), 9.08, .2, pan=.45, verb=.4)
# 03 CONVERSÃO — funil + count-up
for k in range(3):
    place(blip(900 - k * 120, 700 - k * 100, .08), 8.85 + k * .14, .16, pan=.4)
place(riser(.75, 1800, 500, .05), 9.2, .08, pan=.4)              # ponto desce
count_ticks(8.95, 1.05, 12, 1500, 2800, .17)
place(impact(100, 44, .55, .6), 9.95, .45)                       # AÇÃO + 3X
place(ping([1046.5, 1568, 2093], 1.3, 3.5), 9.95, .2, verb=.5)
place(whoosh(.45, 800, 4000, .6), 10.58, .26)                    # saída

# ================= CENA 05 =================
place(riser(.45, 180, 720), 10.92, .2, verb=.25)                 # mesma linha da cena 01
place(whoosh(.55, 300, 1600, .5), 11.25, .24, pan=.25)
place(whoosh(.65, 200, 1800, .7, 1.6), 11.42, .26, pan=-.15)     # iris
char_ticks(11.72, 12, .022, .14)
place(impact(80, 46, .45, .25), 11.75, .25)
place(shimmer(.6), 12.02, .09, verb=.45)
place(whoosh(.5, 2600, 300, .8, 1.3), 12.55, .26)                # iris fecha
place(whoosh(.55, 2600, 400, .85, 1.3), 12.72, .26)              # anel → "O"

# ================= CENA 06 =================
place(impact(110, 44, .7, .7), 13.22, .62, verb=.25)             # "O" trava
place(ping([1318.5, 1975.5, 2637], 1.1, 5), 13.22, .14, verb=.4)
char_ticks(12.98, 3, .06, .16, 2400)
char_ticks(13.25, 12, .02, .12)                                  # @NEONCREATES
place(whoosh(.5, 1200, 5000, .55), 13.46, .12)                   # botão abre
place(whoosh(.5, 600, 1800, .5, 1.8), 13.62, .08, pan=.5)        # cursor desliza
place(mouse_click(), 14.15, .55, pan=.1, verb=.05)               # CLIQUE
place(impact(75, 38, .6, .3), 14.19, .5, verb=.2)                # botão comprime
place(ping([1568, 2349.3, 3136], 1.0, 4.5), 14.21, .24, verb=.45)  # pulso neon
place(riser(.55, 500, 1000, .1), 14.42, .06, verb=.4)            # assinatura final
place(ping([523.3, 784, 1046.5], .9, 2.5, .03), 14.5, .1, verb=.5)

# ---------- reverb (IR sintética estéreo) + master ----------
ir_t = t_axis(1.4)
ir = np.stack([bandpass_fft(rng.standard_normal(len(ir_t)), 200, 9000) * np.exp(-ir_t * 4.2) for _ in range(2)], 1)
ir /= np.sqrt((ir ** 2).sum(0))
L = N + len(ir_t)
nfft = 1 << (L - 1).bit_length()
wet = np.stack([np.fft.irfft(np.fft.rfft(send[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N] for c in range(2)], 1)
mix = dry + wet * 0.9

# high-pass suave (remove DC/sub inaudível) e limiter
mix = np.stack([bandpass_fft(mix[:, c], 28, 18000) for c in range(2)], 1)
mix = mix / (np.abs(mix).max() + 1e-9) * 1.25
mix = np.tanh(mix) / np.tanh(1.25) * 0.89            # pico ≈ -1 dBFS
tail = int(SR * .25)
mix[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 1.5  # termina exatamente em 15 s

pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('sfx.wav', N / SR, 's, pico', float(np.abs(mix).max()))
