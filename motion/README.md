# NEON — Filme de marca (15 s)

Filme de motion design da **NEON Branding & Performance** (@neoncreates), construído em código com
[Remotion](https://www.remotion.dev/). Duas versões nativas na mesma linha do tempo: **16:9 (1920×1080)**
e **9:16 (1080×1920)**, 30 fps, editado numa grade de **120 BPM** (1 batida = 15 frames).

> Conceito: **NEON transforma atenção em movimento e movimento em performance.**
> O protagonista é o **pixel verde** — o ponto final quadrado da Switzer. Ele é o pulso, a caneta que desenha
> as peças, a cabeça da linha de tráfego, o ponto final de cada palavra e, no fim, cristaliza no símbolo NEON.

## Entregas (`entregas/`)

Escopo de entrega: **somente 9:16** (a composição 16:9 continua no projeto, mas não é renderizada por padrão).

| Arquivo | Conteúdo |
|---|---|
| `NEON_Filme_15s_9x16_SFX.mp4` | Vertical 9:16 (1080×1920), com sound design |
| `NEON_Filme_15s_9x16_SemAudio.mp4` | Vertical 9:16 sem áudio |
| `NEON_ContactSheet_9x16.png` | 1 quadro por batida, com frame/timecode/seção |
| `NEON_SFX_Master_-14LUFS_-1dBTP_48k24.wav` | Master de áudio (−14 LUFS integrado, true peak ≤ −1 dBTP, 15,000 s) |

Vídeo: H.264 High, yuv420p, BT.709 (faixa limitada), CRF 14. Áudio: AAC 320 kbps, 48 kHz.

## Roteiro em batidas

| Tempo | Frames | Seção | O que acontece |
|---|---|---|---|
| 0,0–1,5 s | 0–45 | **Gancho** | Preto quase absoluto → pixel verde com régua e mira → carrega → **pulso** (anel hexagonal) → as 8 peças do símbolo oficial entram em alta velocidade e travam → o raio acende → o símbolo implode no pixel → `MARCA.` é ejetada do pixel (o pixel vira o ponto final). |
| 1,5–4,0 s | 45–120 | **Construção** | Uma onda hexagonal nasce do ponto e acende a malha de 60° (geometria do símbolo) → a malha dobra em grid → o grid inclina como prancheta → o pixel **desenha** cada peça real do site (contorno + varredura) → layouts se reconstroem → o pulso corta o bento → `CRIATIVIDADE.` → a câmera atravessa o corte. |
| 4,0–7,0 s | 120–210 | **Aceleração** | Voo por um corredor 3D de peças reais. A **linha de tráfego** costura os cards com profundidade real; cliques com cursor/alvo acendem rótulos `CTR`, `ROAS`, `LEADS`, `CONVERSÃO` (só linguagem visual, sem números). Micropausa: `TRÁFEGO.` nasce do pixel. A câmera atravessa a palavra e acelera. |
| 7,0–10,5 s | 210–315 | **Pico** | Hub hexagonal: 6 peças, raios acendendo em semicolcheias, medidor → tudo gira e implode no pixel → equação em cortes secos: `MARCA. + CRIATIVIDADE. + TRÁFEGO. = PERFORMANCE.` (o pixel vira `+` e `=`) → PERFORMANCE sobe da linha como barras de gráfico → o pulso corta a palavra a 60° → tudo explode para fora do quadro. |
| 10,5–12,5 s | 315–375 | **Impacto** | Silêncio e preto → `RESULTADO.` → o ponto final acende verde → a câmera avança no ponto → o ponto cristaliza no símbolo NEON. |
| 12,5–15,0 s | 375–450 | **Resolução** | O símbolo desliza e revela o wordmark (lockup oficial) no impacto final → `BRANDING & PERFORMANCE` → `MARCA QUE SE MOVE.` (o ponto final é o pixel) → `@NEONCREATES`. |

## Material real usado

- **Logo oficial** (`../project/uploads/Neon.PNG`) vetorizado peça por peça com potrace (`scripts/vectorize-logo.py` →
  `src/brand/logoPaths.ts`; SVGs em `public/brand/`). Nada foi redesenhado: só animado.
- **Fontes do site**: Switzer (display) e Inter (texto) — `public/fonts/`.
- **Peças**: seções reais do site publicado (`../NEON.html`) capturadas em 2×/3× por `scripts/capture-site.mjs`
  (hero, cards de serviço, método, por que NEON, CTA, versão mobile e recortes macro). Os blocos de números
  (estatísticas) foram ocultados na captura de propósito e não aparecem no filme.
- **Paleta**: `#39FF14`, `#000000`, `#FFFFFF` (e variações de opacidade). As capturas mantêm as cores reais do site.

Não existiam no projeto posts, criativos de tráfego ou peças de campanha; o Instagram exige login.
Por isso as "peças reais" do filme são as seções do site. Para trocar/adicionar peças, edite `src/brand/pieces.ts`.

## Como editar e renderizar

```bash
npm install
bash scripts/fetch-fonts.sh         # baixa a Switzer (não versionada por licença)
npx remotion studio                 # pré-visualização (sem motion blur) — composições NEON-Film-16x9 / NEON-Film-9x16
node scripts/stills.mjs 16x9 0-449:30 0.5   # folha de quadros (com motion blur) em work/stills
node scripts/render-film.mjs 9x16   # render final: sub-quadros → média em float → work/frames-9x16
bash scripts/deliver.sh             # MP4 9:16 com/sem áudio + contact sheet em entregas/ (16:9: bash scripts/deliver.sh 16x9)
```

Áudio:

```bash
pip install numpy scipy
python3 scripts/sound-design.py     # síntese procedural → public/audio/neon-sfx-raw.wav + assets-doc/cue-sheet.json
python3 scripts/master-audio.py     # −14 LUFS, true peak ≤ −1 dBTP, 15,000 s → public/audio/neon-sfx-master.wav
```

## Estrutura

```
src/
  Root.tsx            composições (NEON-Film-16x9, NEON-Film-9x16 e as de sub-quadros)
  Film.tsx            pilha de cenas + versão de sub-quadros para motion blur
  timeline.ts         grade de 120 BPM, seções e janelas de motion blur
  scenes/             Hook (gancho) · Build (construção) · Flight (aceleração + hub) · Peak (pico) · Finale (impacto + resolução)
  scenes/shared.ts    constantes de continuidade entre cenas (ângulo da marca 60°, origem da onda, câmera)
  scenes/world.ts     mundo 3D do voo (velocidade da câmera, cards, cliques, hub)
  brand/              logo vetorizado, tokens de cor/fonte, registro de peças reais
  lib/                curvas (molas, easing), câmera 3D + homografia, tipografia com kerning, cards
scripts/              captura do site, vetorização, stills, render, áudio, entrega
public/               fontes, peças do site, logo vetorial, áudio
```

### Técnica

- Toda posição é função do tempo (frames fracionários), com molas de solução fechada, antecipação e overshoot.
- **Motion blur exato**: cada quadro final é a média, em ponto flutuante, de até 24 sub-quadros dentro de um
  obturador de 180° (`scripts/accumulate.py`). Cortes secos ficam em meio-frame para o obturador nunca misturar dois planos.
- **3D real** com câmera pinhole própria: linhas projetadas em SVG e peças mapeadas por homografia (`matrix3d`),
  ordenadas por profundidade — a linha de tráfego passa na frente e atrás dos cards corretamente.
- Tipografia em SVG com kerning real (posição de cada letra medida com o kerning do par anterior).
- 9:16 recomposto cena a cena (layouts, tamanhos de tipo, câmera e área segura próprios), mesma linha do tempo.
