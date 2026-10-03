// Peças REAIS da NEON: seções do site publicado (NEON.html), capturadas por scripts/capture-site.mjs.
// Sem números, estatísticas ou depoimentos. crop = [x, y, w, h] em pixels da imagem.
export type Piece = {
  id: string;
  src: string;
  iw: number;
  ih: number;
  crop: [number, number, number, number];
  dpr: number; // escala da captura (2 = desktop retina, 3 = mobile)
  r: number; // raio da borda em px CSS do site (0 = seção sem borda)
  focus?: [number, number]; // ponto de foco para recorte "cover"
};

export const PIECES = {
  hero: {id: 'hero', src: 'site/hero.png', iw: 2880, ih: 1808, crop: [0, 0, 2880, 1808], dpr: 2, r: 0, focus: [0.42, 0.5]},
  trafego: {id: 'trafego', src: 'site/servico-1.png', iw: 1074, ih: 618, crop: [0, 0, 1074, 618], dpr: 2, r: 18},
  design: {id: 'design', src: 'site/servico-2.png', iw: 1074, ih: 618, crop: [0, 0, 1074, 618], dpr: 2, r: 18},
  posicionamento: {id: 'posicionamento', src: 'site/servico-3.png', iw: 1074, ih: 616, crop: [0, 0, 1074, 616], dpr: 2, r: 18},
  autoridade: {id: 'autoridade', src: 'site/servico-4.png', iw: 1074, ih: 616, crop: [0, 0, 1074, 616], dpr: 2, r: 18},
  simbolo: {id: 'simbolo', src: 'site/porque.png', iw: 2880, ih: 2060, crop: [1590, 436, 946, 1180], dpr: 2, r: 18},
  diferentes: {id: 'diferentes', src: 'site/porque.png', iw: 2880, ih: 2060, crop: [300, 280, 1180, 1480], dpr: 2, r: 0, focus: [0.5, 0.2]},
  cta: {id: 'cta', src: 'site/cta.png', iw: 2880, ih: 1868, crop: [344, 316, 2192, 1236], dpr: 2, r: 24},
  metodo: {id: 'metodo', src: 'site/metodo.png', iw: 2880, ih: 1700, crop: [300, 280, 2280, 1140], dpr: 2, r: 0, focus: [0.3, 0.5]},
  mobile: {id: 'mobile', src: 'site/mobile-hero.png', iw: 1290, ih: 2796, crop: [0, 0, 1290, 2796], dpr: 3, r: 0, focus: [0.5, 0.8]},
  mobileCta: {id: 'mobileCta', src: 'site/mobile-cta.png', iw: 1290, ih: 1977, crop: [0, 0, 1290, 1977], dpr: 3, r: 0},
  // recortes macro (detalhes reais do site)
  servHead: {id: 'servHead', src: 'site/servicos.png', iw: 2880, ih: 2536, crop: [300, 280, 1220, 540], dpr: 2, r: 0},
  heroHead: {id: 'heroHead', src: 'site/hero.png', iw: 2880, ih: 1808, crop: [300, 300, 1140, 940], dpr: 2, r: 0},
  heroSym: {id: 'heroSym', src: 'site/hero.png', iw: 2880, ih: 1808, crop: [1640, 460, 960, 980], dpr: 2, r: 0},
  marquee: {id: 'marquee', src: 'site/marquee.png', iw: 2880, ih: 232, crop: [0, 0, 2880, 232], dpr: 2, r: 0},
  step1: {id: 'step1', src: 'site/metodo-1.png', iw: 548, ih: 400, crop: [0, 0, 548, 400], dpr: 2, r: 0},
  step2: {id: 'step2', src: 'site/metodo-2.png', iw: 548, ih: 400, crop: [0, 0, 548, 400], dpr: 2, r: 0},
  step3: {id: 'step3', src: 'site/metodo-3.png', iw: 548, ih: 400, crop: [0, 0, 548, 400], dpr: 2, r: 0},
  step4: {id: 'step4', src: 'site/metodo-4.png', iw: 548, ih: 400, crop: [0, 0, 548, 400], dpr: 2, r: 0},
  why1: {id: 'why1', src: 'site/porque-1.png', iw: 1116, ih: 254, crop: [0, 0, 1116, 254], dpr: 2, r: 0},
  why2: {id: 'why2', src: 'site/porque-2.png', iw: 1116, ih: 254, crop: [0, 0, 1116, 254], dpr: 2, r: 0},
  why3: {id: 'why3', src: 'site/porque-3.png', iw: 1116, ih: 256, crop: [0, 0, 1116, 256], dpr: 2, r: 0},
  why4: {id: 'why4', src: 'site/porque-4.png', iw: 1116, ih: 256, crop: [0, 0, 1116, 256], dpr: 2, r: 0},
} satisfies Record<string, Piece>;

export type PieceId = keyof typeof PIECES;

/** Sequência em loop para carrosséis/corredores (nunca abre buraco). */
export const LOOP: PieceId[] = [
  'hero', 'step1', 'trafego', 'servHead', 'why1', 'simbolo', 'design', 'step2', 'heroSym', 'cta', 'why2', 'posicionamento',
  'mobile', 'step3', 'metodo', 'why3', 'autoridade', 'heroHead', 'step4', 'diferentes', 'why4', 'mobileCta', 'marquee',
];

export const aspectOf = (id: PieceId) => PIECES[id].crop[3] / PIECES[id].crop[2];
