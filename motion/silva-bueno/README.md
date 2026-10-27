# Silva & Bueno Imóveis — Signature Reveal (motion)

Assinatura de marca em motion graphics, 15 s, 60 fps, construída em **React + Remotion + SVG**.
Formatos: **1080×1920 (9:16, master)** e **1080×1080 (1:1)**, MP4 H.264 (yuv420p, BT.709) + AAC 48 kHz.

## Entregáveis

| Arquivo | Conteúdo |
|---|---|
| `deliverables/silva-bueno-9x16.mp4` | Master vertical para Reels/Stories |
| `deliverables/silva-bueno-1x1.mp4` | Versão quadrada (re-enquadrada, não recortada) |
| `deliverables/silva-bueno-9x16-last-frame.png` / `-1x1-last-frame.png` | Último frame (peça estática institucional) |
| `deliverables/contact-sheet-9x16.jpg` | Folha de contato da animação inteira |

## Rodar / renderizar

```bash
npm install
npm run studio            # prévia interativa (Remotion Studio), timeline navegável frame a frame
npm run render:9x16       # -> out/silva-bueno-9x16.mp4
npm run render:1x1        # -> out/silva-bueno-1x1.mp4
npm run still:9x16        # -> out/silva-bueno-9x16-last.png (frame 899)
```

Para usar um Chrome Headless Shell local: `REMOTION_BROWSER=/caminho/chrome-headless-shell npm run render:9x16`.
Licença: o Remotion é gratuito para pessoas físicas e empresas com até 3 colaboradores; acima disso exige licença
de empresa (remotion.pro).

## Como a marca foi preservada

A referência é um raster (mockup com relevo), sem vetor mestre e com tipografia não identificável com segurança.
Por isso **nada foi redesenhado nem substituído por fonte**:

1. `scripts/extract_logo.py` — modela a parede de fundo, extrai um matte suave (known-colour matting) e separa
   os 34 elementos da marca (anel em 2 crescentes, torre dourada, 3 prédios prata, linhas internas, telhado,
   4 vidros da janela, 11 glifos de “SILVA & BUENO”, 7 de “IMÓVEIS”, 2 fios). Cada elemento vira uma textura RGBA 2×
   **com os pixels originais** + o contorno sub-pixel (iso-linha 0,5) em SVG.
2. `scripts/analyze_geometry.py` — deriva as guias de animação dos próprios contornos: vértices do telhado,
   eixo de simetria, círculo do anel, folga prédio↔telhado (≈19,5 px na referência).
3. O Remotion só **move, mascara e ilumina** essas camadas. O último frame reproduz a referência
   (verificação numérica em `scripts/qa_video.py`).

## Linguagem de movimento (timeline em `src/timeline.ts`)

| Tempo | Cena | O que acontece |
|---|---|---|
| 0–2 s | 01 Foundation | Silêncio; um ponto de luz vira uma linha de datum que se expande do centro; o eixo de simetria nasce dela (T invertido, com marcas de cota). |
| 2–5 s | 02 Structure | O datum **dobra como uma régua rígida** (comprimentos preservados, antecipação discreta) e vira a aresta do telhado; o ouro “escorre” da aresta e preenche telhado e, na mesma frente, a janela. Câmera se aproxima. |
| 5–8 s | 03 Architecture | A torre dourada sobe ao longo do eixo; os prédios prata emergem de trás do telhado com stagger; linhas internas desenhadas por máscara; o anel é traçado num único gesto (inferior-esquerdo → topo → inferior-direito); luz de estúdio percorre o metal. |
| 8–11 s | 04 Signature | A câmera reenquadra primeiro; “SILVA & BUENO” abre a partir do “&” para fora (máscaras verticais, tracking controlado); glint dourado no “&”; “IMÓVEIS” e os fios se abrem do centro. |
| 11–15 s | 05 Final Reveal | Um único reflexo metálico (núcleo claro + ombros escurecidos, como em metal real); push-in de 1,2 %; `@silvaebuenoimoveis` sobe 12 px com fade (13,0–13,8 s); **1,13 s final 100 % estático**. |

Easing único (curvas bezier em `src/lib/motion.ts`), câmera por interpolação monotônica C1 (sem micro-paradas).

## Verificação (medida nos MP4 finais — `scripts/qa_video.py`, `scripts/qa_handle.py`, `scripts/check_framing.ts`)

| Item | 9:16 | 1:1 |
|---|---|---|
| Saltos isolados entre frames (900 frames) | nenhum | nenhum |
| Fidelidade do último frame vs. referência (110 mil px da marca) | Δ médio 2,4/255 | Δ médio 2,5/255 |
| @: deslocamento ainda por percorrer quando a opacidade chega a ~14 % | +12,0 px | +11,9 px |
| @: centro vs. letras de “IMÓVEIS” | −1,7 px | −1,6 px |
| Hold final (render idêntico frame a frame) | 13,87–15,0 s | 13,87–15,0 s |
| Resíduo do encoder H.264 no hold | ≤ 4 níveis em ≤ 4 px | ≤ 5 níveis em ≤ 21 px |
| Menor margem da marca até a borda (todos os frames) | 72 px | 121 px |

Cada troca de máscara e cada início/fim de passagem de luz também foi conferido em PNG sem perdas.

## Som (`scripts/make_audio.py` → `scripts/master_audio.sh`)

Sintetizado do zero (sem samples): pulso sub-grave no primeiro ponto de luz, textura de ar que alarga com a linha,
respiração grave na dobra, brilho metálico no preenchimento, whooshes filtrados panoramizados por prédio, swoosh
que percorre o anel (pan acompanha o ângulo), assinatura E5–B5–E6 abrindo com o nome + terça (G#5) em “IMÓVEIS”,
cama Emaj9 discreta e cauda de reverb sintética. Master linear: −15 LUFS integrado, true peak −2,2 dBTP.
Validado por análise (espectrograma, LUFS, true peak, sincronia com os frames), não por audição.

## Estrutura

```
assets/reference/   logo de referência (fonte da extração)
public/logo/        34 texturas RGBA extraídas      public/bg/  fundos de estúdio (dither)
public/audio/       assinatura sonora masterizada   public/fonts/ Montserrat (OFL) do @ do Instagram
src/                composição Remotion (camera.ts, timeline.ts, layers/*)
scripts/            extração, geometria, fundo, áudio, preview/contact sheet, QA
```
