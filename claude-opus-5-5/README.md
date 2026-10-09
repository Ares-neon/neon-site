# CLAUDE OPUS 5.5 — "Intelligence in Motion"

Filme de motion design vertical (9:16), 30 s, 1080 × 1920, 60 fps, construído em
HTML + CSS + Canvas 2D + GSAP (uma única timeline mestre) e exportado para MP4 por
captura determinística quadro a quadro.

> Peça conceitual (spec). Não é material oficial da Anthropic e não usa a marca
> gráfica da empresa. "Claude" é marca da Anthropic — publique deixando isso claro.

## Arquivos

| arquivo | função |
|---|---|
| `claude-opus-5-5.html` | palco 1080 × 1920, tipografia e CSS; abre em modo preview |
| `film.js` | estado, partículas, desenho dos canvas e a timeline mestre GSAP |
| `render.mjs` | Playwright: `check` (cadeias/área segura/cues), `stills`, `frames` |
| `sfx.py` | sound design 100 % sintetizado (numpy), sincronizado aos cues da timeline |
| `export.sh` | pipeline completo: cues → 1800 quadros → áudio → MP4 |
| `claude-opus-5-5.mp4` | master (H.264 High@4.2, CRF 15, yuv420p, BT.709, AAC 256k) — 51,6 MB |
| `claude-opus-5-5-share.mp4` | cópia de envio (2 passes, 7 Mbps, AAC 192k) — 26,8 MB, PSNR 44,5 dB vs. fonte |
| `claude-opus-5-5-contact-sheet.png` | 1 quadro/s decodificado do MP4 final |
| `audio/cues.json` | tempos dos eventos sonoros exportados da timeline |
| `vendor/` | GSAP 3.13.0 + CustomEase (licença "no charge" da GreenSock) |
| `fonts/` | Inter / Inter Display em subconjunto woff2 (SIL OFL 1.1) |

## Preview

```bash
python3 -m http.server 8000   # nesta pasta
# abra http://localhost:8000/claude-opus-5-5.html
```

Toca sozinho e em loop. Controles: **Espaço** play/pause · **R** recomeça ·
**← / →** quadro a quadro · barra de tempo para navegar. O áudio entra quando
você clica em Play (política de autoplay dos navegadores).

## Exportar

```bash
./export.sh               # ~5 min de render + ~2,5 min de encode (4 CPUs)
WORKERS=4 ./export.sh     # mais páginas em paralelo
```

Requisitos: Node + Playwright (Chromium), Python 3 + numpy, FFmpeg com libx264.
O render é retomável: quadros já existentes em `frames/` são pulados.

Cópia menor (≈ 27 MB) a partir dos mesmos quadros:

```bash
VF='scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'
ffmpeg -y -framerate 60 -i frames/f%05d.png -vf "$VF" -c:v libx264 -preset slow -tune film \
  -profile:v high -level:v 4.2 -b:v 7000k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -framerate 60 -i frames/f%05d.png -i audio/claude-opus-5-5-sfx.wav -map 0:v -map 1:a \
  -vf "$VF" -c:v libx264 -preset slow -tune film -profile:v high -level:v 4.2 -b:v 7000k -pass 2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 192k \
  -movflags +faststart -shortest claude-opus-5-5-share.mp4
```

Trocar a trilha por outra:

```bash
ffmpeg -i claude-opus-5-5.mp4 -i trilha.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 256k -shortest saida.mp4
```

## Roteiro (labels da timeline)

| tempo | label | cena |
|---|---|---|
| 0–4 s | `awakening` | ponto de luz âmbar → halo, poeira, feixe diagonal, **INTELLIGENCE**; varredura luminosa |
| 4–8 s | `reveal` | giroscópio de anéis de luz; **INTRODUCING / CLAUDE / OPUS 5.5** com reflexo; crescendo e zoom-through |
| 8–13 s | `motion` | rede de nós e linhas (nuvem → treliça → esfera); **THINK DEEPER. / SOLVE COMPLEX PROBLEMS. / BUILD WITH PRECISION.** |
| 13–18 s | `creation` | partículas montam uma torre-treliça; **REASON.** (máscara) · **CREATE.** (flip 3D) · **EXECUTE.** (revelada pela linha de varredura) |
| 18–23 s | `precision` | quase preto; uma linha de luz desce e revela **LESS NOISE. / MORE CLARITY. / BETTER WORKFLOWS.** |
| 23–27 s | `final` | partículas, linhas e anéis convergem; flash anamórfico; **CLAUDE OPUS 5.5** + sheen + halo |
| 27–30 s | `outro` | fundo some, **INTELLIGENCE IN MOTION.**, hold e fade para preto |

## Como o determinismo é garantido

- A timeline fica sempre pausada; cada quadro é `renderAt(t)`: busca na timeline e
  redesenha todos os canvas a partir do estado — nada acumula entre quadros.
- Todo tween é `fromTo` com `immediateRender: false`, e cada propriedade forma uma
  cadeia contínua (`node render.mjs check` falha se houver sobreposição ou salto).
- Aquecimento canônico no boot (vai ao fim e volta a 0) para que todo elemento
  animado tenha estilos inline desde t = 0; sem `will-change`; contexto 2D
  isolado com `save()/restore()` por quadro.
- Motion blur das partículas: posições avaliadas em `t − 1/120 s` e `t` (obturador 180°).
- Verificado: quadros renderizados em paralelo são idênticos pixel a pixel a
  re-renders independentes em ordem embaralhada.

## Áudio

Sintetizado em `sfx.py` (sem samples): tom grave de abertura, drone e pads por cena,
whooshes que acompanham a direção das varreduras (pan L→R), pulsos eletrônicos
nas revelações, impacto grave contido em **OPUS 5.5** e no reveal final, risers
nas transições, silêncio quase total na cena 5 e resolução limpa no fim.
Master: ≈ −15 LUFS integrado, true peak ≈ −2 dBTP.
