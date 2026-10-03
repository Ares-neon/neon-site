import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// Fontes do site NEON: Switzer (display) + Inter (texto). Arquivos locais em public/fonts.
let loading: Promise<void> | null = null;
let loaded = false;

const loadFonts = () => {
  if (!loading) {
    const faces = [400, 500, 600, 700, 800].map(
      (w) => new FontFace('Switzer', `url(${staticFile(`fonts/Switzer-${w}.woff2`)}) format('woff2')`, {weight: String(w)}),
    );
    faces.push(new FontFace('Inter', `url(${staticFile('fonts/Inter-latin.woff2')}) format('woff2')`, {weight: '100 900'}));
    loading = Promise.all(faces.map((f) => f.load())).then((list) => {
      list.forEach((f) => document.fonts.add(f));
      loaded = true;
    });
  }
  return loading;
};

/** Só renderiza o filme depois que as fontes estão prontas (medições tipográficas exatas). */
export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [ready, setReady] = useState(loaded);
  const [handle] = useState(() => (loaded ? null : delayRender('Carregando fontes NEON')));
  useEffect(() => {
    if (loaded) return;
    loadFonts().then(() => {
      setReady(true);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return ready ? <>{children}</> : null;
};

// ---------- Medição tipográfica (com kerning) ----------
let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();
const getCtx = () => {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!;
  return ctx;
};
export const textWidth = (text: string, size: number, weight = 800, family = 'Switzer') => {
  const key = `${family}|${weight}|${size}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = getCtx();
  c.font = `${weight} ${size}px ${family}`;
  (c as any).fontKerning = 'normal';
  const w = c.measureText(text).width;
  cache.set(key, w);
  return w;
};

export const glyphBox = (text: string, size: number, weight = 800, family = 'Switzer') => {
  const c = getCtx();
  c.font = `${weight} ${size}px ${family}`;
  const m = c.measureText(text);
  return {
    left: m.actualBoundingBoxLeft,
    right: m.actualBoundingBoxRight,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
    width: m.width,
  };
};

export type Layout = {xs: number[]; ws: number[]; total: number; chars: string[]};
/** Posição x de cada letra preservando o kerning do par anterior + tracking (em). */
export const layoutWord = (text: string, size: number, weight = 800, tracking = 0, family = 'Switzer'): Layout => {
  const chars = Array.from(text);
  const xs: number[] = [];
  const ws: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    const upto = chars.slice(0, i + 1).join('');
    const adv = textWidth(chars[i], size, weight, family);
    xs.push(textWidth(upto, size, weight, family) - adv + i * tracking * size);
    ws.push(adv);
  }
  const total = textWidth(text, size, weight, family) + (chars.length - 1) * tracking * size;
  return {xs, ws, total, chars};
};

/** Maior tamanho de fonte para a palavra caber na largura dada. */
export const fitSize = (text: string, maxWidth: number, weight = 800, tracking = 0) => {
  const ref = 100;
  const l = layoutWord(text, ref, weight, tracking);
  return (ref * maxWidth) / l.total;
};
