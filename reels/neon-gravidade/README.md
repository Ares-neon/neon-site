# NEON — "Gravidade" · Reels 9:16

> A NEON é a força gravitacional que transforma atenção dispersa em órbita, e órbita em performance.

30 s · 1080×1920 · 30 fps · 900 quadros · grade de 120 BPM (60 batidas de 0,5 s = 15 quadros).
Paleta fechada: `#000000` · `#FFFFFF` · `#39FF14`. O logo oficial e as peças reais do site entram sem alteração.

## Entregas (`out/`)

| Arquivo | Conteúdo |
|---|---|
| `neon-gravidade_9x16_som.mp4` | H.264 High, 1080×1920, 30 fps, AAC 48 kHz, −14 LUFS, TP ≤ −1 dBTP, 30,000 s |
| `neon-gravidade_9x16_mudo.mp4` | Mesmo vídeo, sem trilha |
| `neon-gravidade_capa.png` | Capa do Reels 1080×1920 (assinatura final; legível no recorte 3:4) |
| `neon-gravidade_capa_3x4.png` | Prévia do recorte 3:4 da grade do perfil |
| `neon-gravidade_contact-sheet.jpg` | Folha de contato: 1 quadro por batida (60 quadros) |
| `neon-gravidade_sfx.wav` | Sound design masterizado (PCM 32-bit, 48 kHz) |

## Material usado (folhas de contato em `contact/`)

O repositório **não tem** criativos de clientes, posts de feed nem anúncios de tráfego. O filme usa só material real da NEON:

- `assets/brand/neon-symbol.png`: símbolo oficial (`project/assets/neon-symbol.png`).
- `assets/brand/neon-lockup.png`: logo oficial (`project/uploads/Neon.PNG`), recortado do fundo cinza por chave de luminância. O desenho e as proporções do símbolo e do lettering não foram alterados.
- `assets/cards/*.png`: peças reais do site da NEON (`NEON.html` e `Diagnostico.html`), capturadas em 3× por `tools/capture-cards.cjs`. Ficaram de fora a seção de depoimentos (fictícia), os números do hero e das estatísticas (não auditados) e o botão flutuante.
- Fontes do projeto: Switzer 600/700/800 (títulos) e Inter (rótulos), em `assets/fonts/`.

**Para trocar pelos criativos reais:** coloque os PNG/JPG em `assets/cards/` e troque os nomes em `FORM`, `ORBIT` e `SUPCARDS` (`src/film.js`). Depois rode o render de novo.

## Roteiro em batidas

| Batidas | Tempo | Cena | O que acontece |
|---|---|---|---|
| 1 | 0,0–0,5 | Big Bang | Preto. Ponto verde. Batida de silêncio: o ponto se contrai (antecipação) e solta um anel de respiro. |
| 2–4 | 0,5–2,0 | Big Bang | Explosão: 7 mil estrelas disparam para a câmera, com motion blur. Em ~1 s a poeira se condensa em **MARCA**, com mola e overshoot. |
| 5–14 | 2,0–7,0 | Formação | O núcleo verde liga a gravidade: uma onda no plano do disco e estrelas puxadas em espiral, as mais próximas primeiro. Câmera mergulha e inclina. As estrelas maiores incham e se abrem em peças reais que voam em paralaxe. A poeira vira **BRANDING.**, que se reorganiza em **CRIATIVIDADE.** |
| 15–26 | 7,0–13,0 | Órbita | O símbolo NEON nasce no núcleo com overshoot. A onda gravitacional empurra as estrelas vizinhas e a câmera recua para revelar a escala. Seis peças são capturadas em dois anéis inclinados (um vertical, para usar o 9:16). Constelações ligam peças a **CTR · ROAS · LEADS · CONVERSÃO**, só rótulos e sem números. Pulso verde em cada conexão. **TRÁFEGO**. |
| 27–30 | 13,0–15,0 | Colapso | Antecipação (expande) e tudo sugado para o núcleo. Corte seco: ~0,65 s só do ponto verde no preto (reset de retenção). O ponto carrega. |
| 31–42 | 15,0–21,0 | Hiperespaço | Salto: warp radial. As linhas giram para a vertical e sobem. Uma linha de crescimento sobe em degraus, um por batida, com quedas e a ponta energizada. Cortes no grid: **ATENÇÃO.** (inteira, macro, alto) e **DESEJO.** (inteira, macro, alto, saída com a linha). |
| 43–48 | 21,0–24,0 | Supernova | Pan macro por **PERFORMANCE** gigante, com as letras vazando as bordas, e recuo com mola até a palavra ocupar a largura. Repetições em contorno preenchem o quadro. Peças e constelações convergem. O pulso verde rasga a palavra, que explode para fora com estilhaços. |
| 49–52 | 24,0–26,0 | Silêncio | Preto. **RESULTADO.** O ponto final acende como tubo de neon (quadros 750–756). |
| 53–60 | 26,0–30,0 | Resolução | As letras caem no ponto, que vira o núcleo de uma galáxia mínima atrás do logo. Logo oficial, *Branding & Performance*, **SUA MARCA EM ÓRBITA.** e **@NEONCREATES** ficam parados e legíveis de 27,4 a 29,58 s. No último quadro, tudo colapsa no ponto verde, idêntico ao quadro 0 (loop). |

## Como renderizar

```bash
# dependências: node 18+, playwright (Chromium), ffmpeg, python3 + numpy
node tools/capture-cards.cjs                       # (re)captura as peças do site
node tools/render.cjs --out build/frames           # 900 PNG 1080×1920
node tools/render.cjs --scale 0.5 --step 15 --out build/preview   # prévia rápida
python3 tools/sound.py && python3 tools/master.py  # trilha → build/sfx_master.wav
bash tools/encode.sh                               # MP4s, capa, contact sheet
```

Para ver um quadro no navegador: sirva a pasta (`npx http-server .`) e abra `src/film.html?frame=420&scale=0.5&hud=1`.
Cada quadro é uma função pura do índice (`FILM.render(f)`), por isso o render é determinístico e pode ser paralelizado.
