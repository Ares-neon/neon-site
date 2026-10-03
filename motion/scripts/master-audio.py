"""Masterização: -14 LUFS integrado, true peak <= -1 dBTP, duração exata de 15,000 s.
Itera ganho -> compressor suave -> limitador (com compensação de latência) e mede com ebur128.
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'audio', 'neon-sfx-raw.wav')
OUT = os.path.join(ROOT, 'public', 'audio', 'neon-sfx-master.wav')
TARGET_I, TP_MAX = -14.0, -1.0

def chain(gain_db):
    # float -> ganho -> passa-baixa (evita picos inter-amostra) ->
    # limitador com 4x oversampling (true peak) -> volta a 48 kHz -> duração exata
    return (f'aformat=sample_fmts=flt,volume={gain_db:.3f}dB,'
            'lowpass=f=17500:poles=2,'
            'aresample=192000,'
            'alimiter=limit=0.82:attack=1:release=60:asc=1:level=0:latency=1,'
            'aresample=48000,'
            'atrim=0:15,apad=whole_dur=15')

def measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    I = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summ).group(1))
    TP = float(re.search(r'Peak:\s+(-?[\d.inf]+) dBFS', summ).group(1))
    return I, TP

def render(gain_db, path):
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', SRC, '-af', chain(gain_db),
                    '-ar', '48000', '-c:a', 'pcm_s24le', path], check=True)

I0, TP0 = measure(SRC)
print(f'bruto: I={I0} LUFS  TP={TP0} dBTP')
g = TARGET_I - I0
for it in range(8):
    render(g, OUT)
    I, TP = measure(OUT)
    print(f'iter {it}: ganho {g:+.2f} dB -> I={I} LUFS  TP={TP} dBTP')
    if abs(I - TARGET_I) <= 0.1 and TP <= TP_MAX:
        break
    g += (TARGET_I - I) * 0.9
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT], capture_output=True, text=True).stdout)
print(f'final: I={I} LUFS  TP={TP} dBTP  duração={dur:.6f}s')
if not (abs(I - TARGET_I) <= 0.1 and TP <= TP_MAX):
    sys.exit('master fora da especificação')
