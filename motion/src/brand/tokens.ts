// Paleta obrigatória NEON — nenhuma outra cor de identidade.
export const C = {
  green: '#39FF14',
  black: '#000000',
  white: '#FFFFFF',
};

/** Variações de luminosidade/transparência das três cores. */
export const a = {
  white: (o: number) => `rgba(255,255,255,${o})`,
  green: (o: number) => `rgba(57,255,20,${o})`,
  black: (o: number) => `rgba(0,0,0,${o})`,
};

export const FONT = {
  display: 'Switzer, Inter, sans-serif',
  text: 'Inter, Switzer, sans-serif',
};

export const HANDLE = '@NEONCREATES';
