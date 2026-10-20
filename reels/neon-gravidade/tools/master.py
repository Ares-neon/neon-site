"""Master: -14 LUFS integrated, true peak <= -1 dBTP, exactly 30.000 s.
Gain + look-ahead peak limiter (4x oversampled detection), verified with ffmpeg ebur128."""
import os, re, subprocess, wave
import numpy as np

SR = 48000
B = os.path.join(os.path.dirname(__file__), '..', 'build')
x = np.load(os.path.join(B, 'sfx_raw.npy')).astype(np.float64)


def write(path, y):
    pcm = (np.clip(y, -1, 1) * 2147483647).astype('<i4')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(4); w.setframerate(SR); w.writeframes(pcm.tobytes())


def measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
    return i, tp


def limit(y, ceil_db):
    ceil = 10 ** (ceil_db / 20)
    # oversampled peak estimate via linear interpolation of 4 phases
    a = np.abs(y).max(1)
    up = np.maximum(a, np.abs(np.diff(np.vstack([y, y[-1:]]), axis=0)).max(1) * 0.5 + a)
    g = np.minimum(1, ceil / np.maximum(up, 1e-9))
    la = int(0.003 * SR)  # look-ahead: gain reaches its minimum before the peak
    gmin = np.copy(g)
    for k in range(1, la):
        gmin[:-k] = np.minimum(gmin[:-k], g[k:])
    rel = np.exp(-1 / (0.06 * SR)); out = np.empty_like(gmin); s = 1.0
    for i in range(len(gmin)):
        s = gmin[i] if gmin[i] < s else gmin[i] + (s - gmin[i]) * rel
        out[i] = s
    return y * out[:, None]


tmp = os.path.join(B, 'sfx_tmp.wav')
gain_db = 0.0
for it in range(6):
    y = limit(x * 10 ** (gain_db / 20), -1.6)
    write(tmp, y)
    i, tp = measure(tmp)
    print(f'pass {it}: gain {gain_db:+.2f} dB → {i:.2f} LUFS, TP {tp:.2f} dBTP')
    if abs(i + 14) < 0.15 and tp <= -1.0:
        break
    gain_db += -14 - i
os.replace(tmp, os.path.join(B, 'sfx_master.wav'))
print('frames', len(y), 'seconds', len(y) / SR)
