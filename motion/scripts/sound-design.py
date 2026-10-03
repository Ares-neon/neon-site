"""Sound design procedural do filme NEON (15 s, 30 fps, grade 120 BPM).

Todos os sons são sintetizados aqui (nada de banco de efeitos), cada um com envelope próprio
(começa e termina em silêncio) e posicionado no frame exato da imagem.
Saída: public/audio/neon-sfx-raw.wav (float) — a masterização (-14 LUFS / -1 dBTP) é feita por
scripts/master-audio.mjs.
"""
import json
import os
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 15.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_RAW = os.path.join(ROOT, 'public', 'audio', 'neon-sfx-raw.wav')
OUT_CUES = os.path.join(ROOT, 'assets-doc', 'cue-sheet.json')

L = np.zeros(N)
R = np.zeros(N)
VL = np.zeros(N)  # envio para reverb
VR = np.zeros(N)
CUES = []
rng = np.random.default_rng(20261003)


def fr(f):
    return f / 30.0


def tvec(n):
    return np.arange(n) / SR


def fade_edges(x, a=0.002, r=0.004):
    n = len(x)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e = np.ones(n)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return x * e


def pan_gains(p):
    p = np.clip(p, -1, 1)
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def place(sig, t, pan=0.0, gain=1.0, send=0.0, name=None):
    """Soma o som mono `sig` a partir do tempo t (s). pan pode ser escalar ou vetor."""
    sig = fade_edges(sig) * gain
    i0 = int(round(t * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        if np.ndim(pan):
            pan = pan[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    sig = sig[:n]
    pl, pr = pan_gains(pan[:n] if np.ndim(pan) else pan)
    L[i0:i0 + n] += sig * pl
    R[i0:i0 + n] += sig * pr
    if send > 0:
        VL[i0:i0 + n] += sig * pl * send
        VR[i0:i0 + n] += sig * pr * send
    if name:
        CUES.append({'t': round(t, 4), 'frame': round(t * 30, 2), 'som': name})


def noise(n):
    return rng.standard_normal(n)


def bp(x, f1, f2, order=2):
    sos = butter(order, [max(20, f1), min(SR / 2 - 100, f2)], btype='bandpass', fs=SR, output='sos')
    return sosfilt(sos, x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='highpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='lowpass', fs=SR, output='sos'), x)


def svf_sweep(x, f_start, f_end, q=1.2, mode='bp'):
    """Filtro de estado variável (TPT) com frequência central varrendo exponencialmente."""
    n = len(x)
    fc = f_start * (f_end / f_start) ** (np.arange(n) / max(1, n - 1))
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    y = np.zeros(n)
    ic1 = ic2 = 0.0
    for i in range(n):
        gi = g[i]
        a1 = 1.0 / (1.0 + gi * (gi + k))
        a2 = gi * a1
        a3 = gi * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[i] = v1 * k if mode == 'bp' else (v2 if mode == 'lp' else x[i] - k * v1 - v2)
    return y


def env(n, attack, decay):
    t = tvec(n)
    a = np.clip(t / attack, 0, 1) if attack > 0 else np.ones(n)
    return a * np.exp(-t / decay)


# ------------------------------------------------------------------ vozes

def pixel_click(t, gain=0.3, pan=0.0):
    """Assinatura sonora do pixel verde: 'tik' digital nítido."""
    n = int(0.03 * SR)
    tt = tvec(n)
    s = np.sin(2 * np.pi * 4200 * tt) * np.exp(-tt / 0.0022)
    c = hp(noise(n), 3500) * np.exp(-tt / 0.0006) * 0.5
    s2 = np.sin(2 * np.pi * 8400 * tt) * np.exp(-tt / 0.0012) * 0.3
    place(s + c + s2, t, pan, gain, name='pixel (clique-assinatura)')


def tick(t, freq=6000, gain=0.15, pan=0.0, dur=0.012, name='tick UI'):
    n = int(dur * SR)
    x = bp(noise(n), freq * 0.7, freq * 1.4) * np.exp(-tvec(n) / (dur / 5))
    place(x, t, pan, gain, name=name)


def blip(t, freq=2400, gain=0.15, pan=0.0):
    n = int(0.05 * SR)
    tt = tvec(n)
    f = freq * (1 + 0.06 * np.exp(-tt / 0.006))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * env(n, 0.0008, 0.012)
    place(x, t, pan, gain, name='blip UI')


def sub(t, f0=110, f1=42, dur=0.6, gain=0.8, pan=0.0, send=0.0, name='impacto grave'):
    n = int(dur * SR)
    tt = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-tt / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * env(n, 0.0015, dur / 4.2)
    x = np.tanh(x * 1.6) / np.tanh(1.6)
    place(x, t, pan, gain, send=send, name=name)


def body(t, dur=0.18, cutoff=1800, gain=0.4, pan=0.0, send=0.0):
    n = int(dur * SR)
    x = lp(noise(n), cutoff, 2) * env(n, 0.0008, dur / 5)
    place(x, t, pan, gain, send=send)


def click(t, gain=0.35, pan=0.0, freq=5000):
    n = int(0.01 * SR)
    x = hp(noise(n), freq) * np.exp(-tvec(n) / 0.0009)
    place(x, t, pan, gain, name='clique')


def impact(t, size=1.0, pan=0.0, send=0.35, name='impacto'):
    sub(t, 105 + 20 * size, 40, 0.45 + 0.5 * size, 0.85 * size, pan, send=send * 0.5, name=name)
    body(t, 0.12 + 0.08 * size, 1500 + 800 * size, 0.45 * size, pan, send=send)
    click(t, 0.4 * size, pan)


def whoosh(t0, t1, f_start, f_end, gain=0.25, pan0=0.0, pan1=0.0, shape='swell', q=1.4, name='whoosh'):
    n = int((t1 - t0) * SR)
    if n < 64:
        return
    x = svf_sweep(noise(n), f_start, f_end, q=q)
    u = np.linspace(0, 1, n)
    if shape == 'in':
        e = u ** 2.4
    elif shape == 'out':
        e = (1 - u) ** 2.2 * np.clip(u / 0.03, 0, 1)
    else:
        e = np.sin(np.pi * u) ** 2
    pan = pan0 + (pan1 - pan0) * u
    place(x * e, t0, pan, gain, name=name)


def zap(t, dur=0.16, gain=0.4, pan=0.0, pan1=None, send=0.15, name='zap elétrico'):
    """Energia elétrica do pulso verde: zumbido modulado + estalos."""
    n = int(dur * SR)
    tt = tvec(n)
    buzz_f = 92 + 18 * rng.random()
    am = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * buzz_f * tt))
    nz = bp(noise(n), 1800, 7000) * am
    saw = ((tt * 186) % 1.0) * 2 - 1
    saw = hp(saw, 900) * 0.35
    crack = np.zeros(n)
    for _ in range(int(dur * 120)):
        i = rng.integers(0, max(1, n - 200))
        crack[i:i + 60] += hp(noise(60), 4000) * np.exp(-np.arange(60) / 9) * (0.6 + rng.random())
    x = (nz + saw + crack) * env(n, 0.001, dur / 3)
    p = pan if pan1 is None else np.linspace(pan, pan1, n)
    place(x, t, p, gain, send=send, name=name)


def riser(t_end, dur, gain=0.35, f0=400, f1=7000, pan=0.0, name='riser'):
    n = int(dur * SR)
    x = svf_sweep(noise(n), f0, f1, q=1.6)
    u = np.linspace(0, 1, n)
    x = x * u ** 3
    place(x, t_end - dur, pan, gain, name=name)


def shimmer(t0, dur, gain=0.18, pan=0.0):
    n = int(dur * SR)
    x = bp(noise(n), 6500, 13000)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * u) ** 1.5
    sp = np.zeros(n)
    for _ in range(int(dur * 40)):
        i = rng.integers(0, max(1, n - 900))
        f = 7000 + 5000 * rng.random()
        k = np.arange(900)
        sp[i:i + 900] += np.sin(2 * np.pi * f * k / SR) * np.exp(-k / 120) * 0.35
    place((x + sp) * e, t0, pan, gain, name='shimmer (cristalização)')


def pulse(t, gain=0.25, pan=0.0):
    """Pulso rítmico sutil da grade de 120 BPM."""
    sub(t, 80, 48, 0.22, gain, pan, name='pulso 120 BPM')
    click(t, gain * 0.25, pan, freq=6000)


def kick(t, gain=0.45):
    sub(t, 140, 46, 0.35, gain, 0.0, name='kick do pulso')
    click(t, gain * 0.35, 0.0, freq=4500)


def hat(t, gain=0.08, pan=0.15):
    tick(t, 9000, gain, pan, 0.02, name='hat (colcheia)')


# ------------------------------------------------------------------ cue sheet (frames do filme)

# GANCHO
pixel_click(fr(0.5), 0.32)
whoosh(fr(0), fr(7), 5000, 11000, 0.06, -0.3, 0.3, name='régua (scan)')
tick(fr(2.5), 7200, 0.14, -0.35, name='mira trava')
tick(fr(4), 6400, 0.14, 0.35, name='mira trava')
blip(fr(3), 3200, 0.1)
riser(fr(9), 0.12, 0.3, 800, 6000, name='carga do pulso')
sub(fr(9), 120, 36, 0.95, 0.5, send=0.25, name='PULSO: impacto grave')
zap(fr(9), 0.22, 0.34, -0.2, 0.2, send=0.3, name='PULSO: zap')
whoosh(fr(9), fr(9) + 0.6, 3200, 260, 0.24, 0, 0, shape='out', name='onda de choque')
whoosh(fr(9.5), fr(15), 500, 2600, 0.18, 0.6, -0.2, shape='in', name='peças entrando')
for f, p in [(14.5, 0.25), (15, -0.4), (16.2, 0.45), (17.4, 0.35), (18.6, -0.45), (19.8, 0.2), (21, -0.2)]:
    tick(fr(f), 3600 + 1400 * rng.random(), 0.2, p, 0.02, name='peça encaixa')
zap(fr(18.5), 0.12, 0.32, 0.0, send=0.2, name='raio acende')
sub(fr(18.5), 90, 50, 0.22, 0.25, name='raio acende (grave)')
sub(fr(22), 95, 55, 0.25, 0.32, name='símbolo trava')
click(fr(22), 0.25)
whoosh(fr(30), fr(33), 1200, 2400, 0.08, 0, 0, shape='in', name='antecipação')
whoosh(fr(33), fr(38.6), 500, 5000, 0.32, 0, 0, shape='in', name='implosão')
whoosh(fr(37), fr(41), 2600, 900, 0.22, 0.6, -0.6, shape='swell', name='MARCA é ejetada')
impact(fr(40), 0.62, 0.0, 0.3, name='MARCA.')
tick(fr(45), 6000, 0.08)
shimmer(fr(50), 0.32, 0.14, 0.2)
zap(fr(50), 0.1, 0.14, 0.4, send=0.1, name='onda acende a malha')
whoosh(fr(51), fr(57), 2000, 600, 0.1, 0, -0.5, shape='out', name='letras se dissolvem')

# CONSTRUÇÃO
for f in (60, 75, 90, 105):
    pulse(fr(f), 0.2)
whoosh(fr(55), fr(68), 260, 900, 0.14, -0.2, 0.2, name='prancheta inclina')
pen_starts = [55 + 3.4 * j for j in range(7)]
pen_pans = [-0.5, 0.0, 0.5, 0.0, 0.3, -0.2, -0.6]
for f, p in zip(pen_starts, pen_pans):
    whoosh(fr(f), fr(f) + 0.13, 2200, 7000, 0.1, p - 0.1, p + 0.1, shape='swell', q=2.0, name='caneta desenha')
    tick(fr(f + 7.4), 5200, 0.08, p, name='peça preenchida')
whoosh(fr(87), fr(92), 900, 2600, 0.1, -0.3, 0.3, name='layout reconstrói')
for i in range(7):
    tick(fr(89 + i * 0.45), 4200 + 300 * i, 0.12, -0.6 + 0.2 * i, 0.015, name='snap de layout')
    tick(fr(94 + i * 0.45), 4600 + 300 * i, 0.12, 0.6 - 0.2 * i, 0.015, name='snap de layout')
zap(fr(97), fr(100.5) - fr(97) + 0.05, 0.42, -0.9, 0.9, send=0.15, name='pulso corta o bento')
whoosh(fr(100), fr(109), 300, 1600, 0.22, 0, 0, shape='swell', name='bento abre')
impact(fr(105), 0.6, 0.0, 0.25, name='CRIATIVIDADE.')
riser(fr(119), 0.3, 0.32, 300, 5000, name='câmera atravessa')
whoosh(fr(119), fr(119) + 0.45, 4000, 300, 0.4, 0, 0, shape='out', name='passagem')

# ACELERAÇÃO
for f, g in [(120, 0.36), (135, 0.4), (150, 0.42), (165, 0.32), (180, 0.46), (195, 0.5)]:
    kick(fr(f), g)
for f in (127.5, 142.5, 157.5, 187.5, 202.5):
    hat(fr(f), 0.07)
zap(fr(121), 0.14, 0.22, -0.6, 0.2, send=0.1, name='linha de tráfego entra')
for f, p in [(128, 0.4), (135.5, -0.4), (143, -0.4), (150.5, 0.4)]:
    click(fr(f), 0.42, p, 3500)
    blip(fr(f), 2400, 0.14, p)
    zap(fr(f), 0.06, 0.12, p, send=0.05, name='clique: alvo atingido')
    tick(fr(f + 1.5), 7000, 0.08, p * 0.6, name='rótulo de performance')
for f, p, g in [(124, -0.7, 0.18), (131, 0.7, 0.16), (139, -0.6, 0.16), (146, 0.6, 0.16), (155, 0.8, 0.24)]:
    whoosh(fr(f) - 0.12, fr(f) + 0.22, 900, 3800, g, p * 0.3, p, shape='swell', name='card passa')
pixel_click(fr(160), 0.28, 0.4)
zap(fr(160), 0.08, 0.15, 0.4, send=0.1, name='pixel vira ponto final')
whoosh(fr(160), fr(166.5), 2400, 1100, 0.14, 0.4, -0.4, shape='swell', name='TRÁFEGO. nasce do pixel')
impact(fr(166), 0.42, 0.0, 0.2, name='TRÁFEGO.')
riser(fr(183), 0.24, 0.4, 300, 6000, name='aceleração')
whoosh(fr(183), fr(183) + 0.4, 5000, 250, 0.42, 0, 0, shape='out', name='atravessa a palavra')
for j, f in enumerate(np.arange(186, 201, 2.0)):
    p = -0.8 if j % 2 == 0 else 0.8
    whoosh(fr(f) - 0.05, fr(f) + 0.1, 1500, 5000, 0.11, p * 0.4, p, shape='swell', q=1.8, name='rajada')
whoosh(fr(200), fr(211), 2000, 400, 0.14, 0, 0, shape='out', name='desacelera no hub')
zap(fr(206), 0.12, 0.3, 0.0, send=0.15, name='pixel chega ao hub')
pixel_click(fr(206), 0.25)
for k in range(6):
    tick(fr(205 + k), 5600, 0.1, -0.7 + 0.28 * k, name='raio conecta')
kick(fr(210), 0.5)
kick(fr(225), 0.55)
for j, f in enumerate(np.arange(210, 237, 3.75)):
    tick(fr(f), 5000 + 250 * j, 0.1 + 0.02 * j, [0.6, 0.3, -0.3, -0.6, -0.3, 0.3][j % 6], 0.014, name='sequenciador (semicolcheias)')
riser(fr(239.5), 0.78, 0.42, 250, 8000, name='convergência')
whoosh(fr(236), fr(239.5), 600, 6000, 0.38, 0, 0, shape='in', name='implosão no pixel')

# PICO (cortes em meio-frame)
impact(fr(239.5), 0.72, 0.0, 0.25, name='MARCA. (corte)')
zap(fr(243.5), 0.09, 0.42, 0.0, send=0.1, name='+')
click(fr(243.5), 0.3)
impact(fr(246.5), 0.62, 0.15, 0.2, name='CRIATIVIDADE. (corte)')
zap(fr(251.5), 0.09, 0.42, 0.0, send=0.1, name='+')
click(fr(251.5), 0.3)
impact(fr(254.5), 0.66, -0.15, 0.2, name='TRÁFEGO. (corte)')
zap(fr(259.5), 0.12, 0.45, 0.0, send=0.1, name='=')
click(fr(259.5), 0.3)
click(fr(260.6), 0.25)
whoosh(fr(263.5), fr(263.5) + 0.2, 1200, 4500, 0.22, -0.8, 0.8, shape='swell', name='linha de base')
for i in range(12):
    f = 263.5 + 1.5 + i * 0.85
    tick(fr(f), 2200 + 520 * i, 0.12, -0.7 + 0.13 * i, 0.016, name='barra sobe')
kick(fr(270), 0.5)
hat(fr(277.5), 0.08)
riser(fr(284), 0.45, 0.3, 300, 7500, name='tensão antes do corte')
zap(fr(284), 0.3, 0.42, -0.7, 0.7, send=0.3, name='PULSO corta PERFORMANCE')
sub(fr(286.5), 135, 33, 1.1, 0.56, send=0.2, name='IMPACTO do corte')
body(fr(286.5), 0.3, 2600, 0.36, send=0.3)
click(fr(286.5), 0.5)
whoosh(fr(288), fr(300), 3000, 200, 0.3, 0, 0, shape='out', name='explosão para fora do quadro')

# IMPACTO + RESOLUÇÃO
sub(fr(315), 95, 48, 0.55, 0.62, name='RESULTADO.')
click(fr(315), 0.22, 0, 4500)
pixel_click(fr(330), 0.32)
zap(fr(330), 0.1, 0.26, 0.15, send=0.12, name='ponto acende')
whoosh(fr(333), fr(345), 500, 4200, 0.26, 0, 0, shape='in', name='câmera avança no ponto')
shimmer(fr(341), 0.42, 0.16)
for f, p in [(345, -0.3), (347, 0.3), (349, 0.0)]:
    tick(fr(f), 6200, 0.1, p, name='cristal encaixa')
zap(fr(350), 0.12, 0.3, 0.0, send=0.2, name='raio acende')
whoosh(fr(356), fr(369), 1400, 600, 0.1, 0.2, -0.3, shape='swell', name='símbolo desliza')
for f in (370.2, 371.8, 373.4):
    tick(fr(f), 5200, 0.09, 0.3, name='wordmark')
# impacto final — limpo
sub(fr(375), 72, 41, 1.7, 0.62, send=0.25, name='IMPACTO FINAL (logo)')
body(fr(375), 0.09, 1400, 0.35, send=0.4)
click(fr(375), 0.38, 0, 5200)
tick(fr(379), 6000, 0.08, name='filete')
tick(fr(388), 5600, 0.08, name='assinatura')
pixel_click(fr(396), 0.26)
tick(fr(398), 6600, 0.06, name='@NEONCREATES')
sub(fr(414), 60, 44, 0.6, 0.14, name='pulso final (anel)')

# ------------------------------------------------------------------ reverb (envio)
def make_ir(rt, seed):
    r = np.random.default_rng(seed)
    n = int(rt * SR)
    t = tvec(n)
    ir = r.standard_normal(n) * np.exp(-6.9 * t / rt)
    ir = lp(ir, 6500)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))

irl, irr = make_ir(1.4, 1), make_ir(1.4, 2)
L += fftconvolve(VL, irl)[:N] * 0.6
R += fftconvolve(VR, irr)[:N] * 0.6

# silêncio garantido antes de RESULTADO. (micropausa) e no fim
def gate(t0, t1, fade=0.03):
    i0, i1 = int(t0 * SR), int(t1 * SR)
    nf = int(fade * SR)
    for ch in (L, R):
        ch[i0:i0 + nf] *= np.linspace(1, 0, nf)
        ch[i0 + nf:i1] = 0

gate(fr(304), fr(314.5))
fin = int(fr(447) * SR)
for ch in (L, R):
    ch[fin:] *= np.linspace(1, 0, N - fin) ** 2
    ch[-1] = 0

# DC / subsônico
L[:] = hp(L, 25, 2)
R[:] = hp(R, 25, 2)

os.makedirs(os.path.dirname(OUT_RAW), exist_ok=True)
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
stereo = np.stack([L, R], axis=1) / peak * 0.5
with wave.open(OUT_RAW, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(3)
    w.setframerate(SR)
    data = np.clip(np.round(stereo * (2 ** 23 - 1)), -(2 ** 23), 2 ** 23 - 1).astype(np.int32)
    b = data.astype('<i4').tobytes()
    b = b''.join(b[i:i + 3] for i in range(0, len(b), 4))
    w.writeframes(b)
os.makedirs(os.path.dirname(OUT_CUES), exist_ok=True)
CUES.sort(key=lambda c: c['t'])
json.dump({'sample_rate': SR, 'duracao_s': DUR, 'fps': 30, 'bpm': 120, 'cues': CUES}, open(OUT_CUES, 'w'), ensure_ascii=False, indent=1)
print('ok', OUT_RAW, len(CUES), 'cues')
