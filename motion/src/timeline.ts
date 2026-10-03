// Linha do tempo do filme NEON — 15 s, 30 fps, grade de 120 BPM (1 batida = 15 frames).
export const FPS = 30;
export const DUR = 450;
export const SHUTTER = 0.5; // obturador de 180°

export const SECTIONS = {
  gancho: [0, 45],
  construcao: [45, 120],
  aceleracao: [120, 210],
  pico: [210, 315],
  impacto: [315, 375],
  resolucao: [375, 450],
} as const;

// Sub-quadros por quadro final (motion blur). Só onde há movimento rápido.
// [primeiro frame, último frame, amostras]
export const BLUR_WINDOWS: [number, number, number][] = [
  [9, 20, 24], // pulso + montagem do símbolo
  [21, 25, 10],
  [33, 44, 18], // implosão + MARCA.
  [47, 51, 10], // onda + dissolução de MARCA.
  [52, 88, 16], // caneta desenhando as peças (saltos rápidos)
  [88, 101, 12], // reconstrução de layouts + corte
  [102, 108, 8], // abertura + palavra
  [111, 124, 16], // câmera atravessa o corte
  [125, 134, 12], // desaceleração no corredor
  [135, 159, 8], // cliques
  [160, 175, 6], // micropausa TRÁFEGO.
  [176, 200, 14], // aceleração através da palavra
  [201, 235, 8], // hub
  [236, 240, 14], // implosão
  [241, 263, 10], // equação: cortes rápidos
  [264, 283, 6], // PERFORMANCE sobe
  [284, 302, 16], // pulso corta + explosão
  [315, 322, 6], // RESULTADO. sobe
  [333, 356, 10], // câmera avança no ponto + cristalização
  [357, 377, 8], // símbolo desliza + wordmark
  [378, 404, 4], // assinatura
];

export const samplesAt = (f: number) => {
  let n = 1;
  for (const [a, b, s] of BLUR_WINDOWS) if (f >= a && f <= b) n = Math.max(n, s);
  return n;
};

export type Sub = [number, number, number, number]; // [frame final, índice, total, tempo]
export const buildSchedule = (dur = DUR): Sub[] => {
  const out: Sub[] = [];
  for (let f = 0; f < dur; f++) {
    const n = samplesAt(f);
    for (let i = 0; i < n; i++) out.push([f, i, n, n === 1 ? f : f + SHUTTER * (i / (n - 1) - 0.5)]);
  }
  return out;
};
