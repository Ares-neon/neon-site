import React, {createContext, useContext} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

// Tempo contínuo (frames fracionários). Todos os componentes leem o tempo por aqui.
// O motion blur é feito fora do navegador: cada quadro final é a média, em ponto flutuante,
// de N sub-quadros renderizados dentro do obturador (ver timeline.ts e scripts/render-film.mjs).
const TimeCtx = createContext<number | null>(null);
const BaseCtx = createContext<{t: number; shutter: number} | null>(null);

export const useT = (): number => {
  const frame = useCurrentFrame();
  const t = useContext(TimeCtx);
  return t === null ? frame : t;
};

/**
 * Tempo central do quadro final + obturador (em frames).
 * Para elementos com blur analítico próprio (desenhados iguais em todos os sub-quadros).
 */
export const useT0 = (): {t: number; shutter: number} => {
  const frame = useCurrentFrame();
  const b = useContext(BaseCtx);
  const t = useContext(TimeCtx);
  return b ?? {t: t === null ? frame : t, shutter: 0};
};

export const FrameTime: React.FC<{t: number; base: number; shutter: number; children: React.ReactNode}> = ({t, base, shutter, children}) => (
  <BaseCtx.Provider value={{t: base, shutter}}>
    <TimeCtx.Provider value={t}>{children}</TimeCtx.Provider>
  </BaseCtx.Provider>
);

export const useFmt = () => {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  return {W: width, H: height, cx: width / 2, cy: height / 2, portrait, diag: Math.hypot(width, height)};
};
export type Fmt = ReturnType<typeof useFmt>;
