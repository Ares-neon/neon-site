# NEON — Brand Film · *The Power of Ideas*

Filme de marca de 60 segundos em 9:16 para a NEON, construído em código com
[Remotion](https://www.remotion.dev) (React), Three.js e shaders GLSL. Cada
frame é uma função pura do número do frame: qualquer frame pode ser
renderizado isoladamente e duas renderizações produzem o mesmo resultado.

| Especificação | Valor |
| --- | --- |
| Formato | 9:16, 1080 × 1920 |
| Duração | 60,000 s · 3.600 frames · 60 fps |
| Vídeo | MP4 H.264 (yuv420p, CRF 17, preset slow) |
| Áudio | AAC 320 kbps, trilha original sintetizada (−16 LUFS, pico −1,2 dBTP) |
| Cores | Preto `#050505` · Branco `#FFFFFF` · Verde `#00E63B` |
| Tipografia | Inter Variable (eixo `opsz` em 32 = Inter Display), pesos 100–900 |

## Executar

Requisitos: Node 18+ (testado com 22) e npm. O Remotion baixa sozinho o
Chrome Headless Shell na primeira renderização.

```bash
cd brand-film
npm install
npm run studio          # pré-visualização interativa no navegador (Remotion Studio)
npm run render:preview  # prévia 540 × 960 → out/neon-brand-film-preview.mp4
npm run render          # versão final 1080 × 1920 · 60 fps → out/neon-brand-film.mp4
```

- A configuração (codec, CRF, áudio, renderizador WebGL) está em `remotion.config.ts`.
- O WebGL usa SwiftShader (`--gl=swangle`): funciona em qualquer máquina, sem GPU.
  Num Mac com GPU, `npx remotion render NeonBrandFilm out/neon-brand-film.mp4 --gl=angle` é mais rápido.
- Para usar um Chrome já instalado: `REMOTION_BROWSER_EXECUTABLE=/caminho/headless_shell npm run render`.
- Tempo de referência (4 vCPUs, sem GPU): ~0,9 s por frame nas cenas 3D, ~40 min para o filme inteiro.

No Studio, a pasta **Cenas** tem uma composição por cena (com as sobreposições de
transição), útil para revisar cada uma isoladamente.

### Regenerar assets (opcional)

Os assets gerados já estão versionados. Para regenerá-los é preciso Python 3.10+
com `numpy scipy pillow opencv-python-headless potracer` e o `ffmpeg` no PATH.

```bash
npm run logo    # vetoriza a logo, mede a fidelidade e gera o SDF do relevo
npm run score   # sintetiza a trilha e os efeitos → public/audio/neon-score.wav
node scripts/stills.mjs 0-3599:180          # frames avulsos em out/stills
python3 scripts/contact_sheet.py sheet.png out/stills/*.png   # folha de contato
```

## Estrutura

```
brand-film/
├── remotion.config.ts        configuração de renderização
├── src/
│   ├── Root.tsx              composições (filme + uma por cena)
│   ├── Film.tsx              sequência das 20 cenas, grão, vinheta e trilha
│   ├── timeline.ts           tabela de cenas: início, duração, sobreposições, textos
│   ├── theme.ts              cores, grade tipográfica, especificações
│   ├── scenes/               S01Abertura.tsx … S20Encerramento.tsx (uma cena por arquivo)
│   ├── components/           KineticText, Grain/Vignette, ShaderCanvas, Runner, NeonLogo
│   ├── three/                Silk (tecido), ReflectiveFloor, Glow, StudioEnv, texturas
│   ├── gl/                   GLSL comum e o shader da porta de luz (cenas 01 e 20)
│   ├── lib/                  easings e ruído determinístico
│   └── logo/logoData.ts      geometria vetorial da logo (gerada)
├── public/
│   ├── audio/neon-score.wav  trilha final (gerada)
│   ├── fonts/                Inter Variable (OFL)
│   ├── logo/                 neon-logo.svg, neon-symbol.svg (gerados)
│   └── textures/             SDF do símbolo para o baixo-relevo (gerado)
├── assets/source/            logo original, cópia enviada no briefing, storyboard, relatório do traçado
└── scripts/                  trace_logo.py, compose_score.py, stills.mjs, contact_sheet.py
```

## Roteiro técnico

Ritmo: 80 BPM. Um tempo = 45 frames; um compasso = 180 frames = 3 s = uma cena.
Todo corte cai num tempo forte e os eventos visuais (passos, encaixes, blocos,
palavras do manifesto) caem na grade de colcheias da trilha.

| # | Tempo | Cena | Técnica | Transição para a próxima |
| --- | --- | --- | --- | --- |
| 01 | 0–3 s | Abertura | shader: porta de luz, piso de concreto com reflexo e névoa | a luz inunda o quadro |
| 02 | 3–6 s | Novo olhar | shader: íris em relevo (fibras, colarete, criptas); o reflexo na córnea é a porta da cena 01 | a íris vira um anel limpo e a câmera atravessa a pupila |
| 03 | 6–9 s | Ideias | Three.js: tecido de cetim preto/branco + faixa verde (malha deformada por frame) | o tecido passa pela lente e revela a arquitetura |
| 04 | 9–12 s | Estratégia | Three.js: monólito, linha verde, piso espelhado real | pilar fora de foco em primeiro plano cobre a lente |
| 05 | 12–15 s | Criatividade | shader: limbo de uma esfera monumental, luz verde percorre a borda | dissolve casado com a luz de recorte da 06 |
| 06 | 15–18 s | Pessoas | SVG: perfil com luz de recorte (silhueta menos cópia deslocada) | a luz verde do pescoço cresce |
| 07 | 18–21 s | Processo | Three.js: cetim verde que se alinha e vira linha horizontal | a linha é o piso da 08 |
| 08 | 21–24 s | Movimento | SVG: corredor em silhueta com ciclo de corrida biomecânico, travelling com paralaxe | só a linha verde permanece |
| 09 | 24–27 s | Construção | Three.js: placas que se encaixam nos tempos | feixe vertical sobe da pilha |
| 10 | 27–30 s | Relevância | Three.js: montanha procedural (cristas, couloirs, neve), dolly-out | o feixe colapsa num ponto |
| 11 | 30–33 s | Conexões | Three.js: anel laqueado, linha verde fecha o círculo | a câmera atravessa o anel; a abertura revela a 12 |
| 12 | 33–36 s | Parceria | shader: superfícies branca e preta com bisel, encontro no tempo 3 | a superfície preta toma o quadro |
| 13 | 36–39 s | Identidade | shader: superfície texturizada com o símbolo oficial em baixo-relevo (SDF), luz rasante | tecido verde cobre o quadro |
| 14 | 39–42 s | Resultados | Three.js: tecido verde desacelera até parar e vira escultura | corte de movimento vertical |
| 15 | 42–45 s | Crescimento | Three.js: monólitos sobem um por colcheia, luz verde escala o mais alto | corte seco no tempo forte do clímax (45 s) |
| 16 | 45–48 s | Impacto | Three.js: arco monumental, luz atravessando, câmera avança | a luz estoura em branco |
| 17 | 48–51 s | Alcance | shader: horizonte planetário, linha verde percorre o limbo, câmera recua | tudo colapsa numa linha horizontal |
| 18 | 51–54 s | A marca | SVG: abertura hexagonal revela o símbolo; máscara horizontal revela NEON | a logo esmaece sob o manifesto |
| 19 | 54–58 s | Manifesto | tipografia: uma palavra por colcheia, linha verde abaixo | a linha gira e vira vertical |
| 20 | 58–60 s | Encerramento | shader da cena 01 em verde: fenda de luz, apagamento, silêncio | — |

## Logo

A logo não foi redesenhada. `scripts/trace_logo.py` vetoriza o arquivo original
(`assets/source/neon-logo-original.png`, a mesma arte do JPG enviado no briefing)
com supersampling 6× e potrace, e mede o resultado contra o raster:

| Parte | IoU vs. original | Desvio médio de borda | Desvio p99 |
| --- | --- | --- | --- |
| Símbolo (verde) | 0,9942 | 0,15 px | 0,5 px |
| Raio (branco) | 0,9932 | 0,15 px | 0,5 px |
| Wordmark NEON | 0,9967 | 0,13 px | 0,5 px |

Contra o JPG do briefing (escala 0,833, com artefatos de compressão): IoU 0,92
(símbolo) e 0,96 (branco). Relatório completo em `assets/source/trace-report.json`.

Na cena 18 o símbolo e o wordmark aparecem empilhados, como no storyboard,
com a mesma escala entre si que têm no lockup original. O verde usado é o
`#00E63B` do briefing; o raster original tem um verde um pouco mais claro (~`#37F547`).

## Trilha e efeitos

`scripts/compose_score.py` gera tudo por síntese (sem samples de terceiros):
piano com parciais inarmônicos e três cordas por nota, cordas em ensemble
(serras polyBLEP), baixo, percussão grave tipo taiko, e efeitos de tecido, ar,
passos, encaixes e impactos por ruído filtrado no domínio espectral. Reverb por
convolução com resposta impulsiva sintética. Estrutura em ré menor:

- 0–15 s contemplação · 15–30 s construção · 30–45 s crescimento · 45–54 s clímax · 54–60 s assinatura e silêncio (os últimos 0,35 s são silêncio digital).
- Pontos de sincronia: abertura da porta (1,5 s), passos nas colcheias da cena 08, encaixes das placas, encontro das superfícies (34,5 s), blocos (42–43,5 s), impactos em 45 s e 48 s, revelação do símbolo (51 s) e do wordmark (52,4 s), cada palavra do manifesto.

## Limitações conhecidas

- **Sem filmagem real.** Nenhum material de vídeo licenciado foi fornecido. Seguindo
  o briefing, olho, rosto, corredor, tecidos e montanha foram construídos de forma
  procedural/abstrata (shaders, malhas e silhuetas). Para trocar por filmagem real,
  substitua o conteúdo do componente da cena por `<OffthreadVideo>` mantendo o texto
  e as transições.
- **Fontes.** Helvetica Neue e Neue Haas Grotesk são licenciadas e não estavam
  disponíveis; foi usada a Inter (SIL Open Font License), alternativa indicada no briefing.
- **Trilha.** É uma composição sintetizada, funcional e sincronizada, mas não substitui
  um compositor ou uma faixa licenciada para veiculação. Basta trocar
  `public/audio/neon-score.wav` (60 s) para usar outra trilha.
- **GSAP não foi usado.** As animações usam interpolação determinística do Remotion
  com curvas Bézier próprias; GSAP não acrescentaria nada e adicionaria um runtime.
- **Licença do Remotion.** O Remotion é gratuito para pessoas físicas e empresas com
  até 3 funcionários; acima disso exige licença de empresa (remotion.pro). Verifique
  antes do uso comercial pela agência.
