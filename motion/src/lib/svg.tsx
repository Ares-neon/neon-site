import React from 'react';
import {C, FONT} from '../brand/tokens';
import {glyphBox, layoutWord} from './fonts';
import {useFmt} from './time';

export const Svg: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
  const {W, H} = useFmt();
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style}}>
      {children}
    </svg>
  );
};

/** Hexágono regular "pointy-top" (mesma orientação do símbolo NEON). */
export const hexPoints = (x: number, y: number, r: number, rot = 0) =>
  Array.from({length: 6}, (_, i) => {
    const a = ((-90 + i * 60 + rot) * Math.PI) / 180;
    return [x + r * Math.cos(a), y + r * Math.sin(a)] as [number, number];
  });
export const hexPath = (x: number, y: number, r: number, rot = 0) =>
  'M' + hexPoints(x, y, r, rot).map(([px, py]) => `${px.toFixed(2)} ${py.toFixed(2)}`).join('L') + 'Z';

export type LetterT = {dx?: number; dy?: number; s?: number; sx?: number; sy?: number; rot?: number; o?: number; fill?: string; skew?: number};

export type WordProps = {
  text: string;
  size: number;
  x: number;
  y: number; // linha de base
  anchor?: 'start' | 'middle' | 'end';
  tracking?: number; // em
  weight?: number;
  fill?: string;
  periodFill?: string;
  letter?: (i: number, n: number, ch: string) => LetterT;
  clip?: (i: number, box: {x: number; y: number; w: number; h: number}) => [number, number, number, number] | null;
  id?: string;
  opacity?: number;
};

export const capHeight = (size: number, weight = 800) => glyphBox('H', size, weight).ascent;

/** Palavra cinética em SVG: cada letra é um <text> posicionado com kerning real. */
export const Word: React.FC<WordProps> = ({
  text, size, x, y, anchor = 'middle', tracking = -0.04, weight = 800, fill = C.white, periodFill, letter, clip, id = 'w', opacity = 1,
}) => {
  const L = layoutWord(text, size, weight, tracking);
  const x0 = anchor === 'middle' ? x - L.total / 2 : anchor === 'end' ? x - L.total : x;
  const cap = capHeight(size, weight);
  const n = L.chars.length;
  return (
    <g opacity={opacity}>
      {L.chars.map((ch, i) => {
        if (ch === ' ') return null;
        const a = letter ? letter(i, n, ch) : {};
        const o = a.o ?? 1;
        if (o <= 0.001) return null;
        const lx = x0 + L.xs[i];
        const ccx = lx + L.ws[i] / 2;
        const ccy = y - cap / 2;
        const s = a.s ?? 1;
        const tr = `translate(${ccx + (a.dx ?? 0)} ${ccy + (a.dy ?? 0)}) rotate(${a.rot ?? 0}) skewX(${a.skew ?? 0}) scale(${s * (a.sx ?? 1)} ${s * (a.sy ?? 1)}) translate(${-ccx} ${-ccy})`;
        const c = clip ? clip(i, {x: lx, y: y - cap, w: L.ws[i], h: cap}) : null;
        const cid = `${id}-c${i}`;
        const color = a.fill ?? (ch === '.' && periodFill ? periodFill : fill);
        return (
          <g key={i} transform={tr} opacity={o}>
            {c ? (
              <defs>
                <clipPath id={cid}>
                  <rect x={c[0]} y={c[1]} width={Math.max(0, c[2])} height={Math.max(0, c[3])} />
                </clipPath>
              </defs>
            ) : null}
            <text x={lx} y={y} fontFamily={FONT.display} fontWeight={weight} fontSize={size} fill={color} clipPath={c ? `url(#${cid})` : undefined}>
              {ch}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** Geometria da palavra (para ancorar outros elementos às letras). */
export const wordGeom = (text: string, size: number, x: number, anchor: 'start' | 'middle' | 'end' = 'middle', tracking = -0.04, weight = 800) => {
  const L = layoutWord(text, size, weight, tracking);
  const x0 = anchor === 'middle' ? x - L.total / 2 : anchor === 'end' ? x - L.total : x;
  return {...L, x0, cap: capHeight(size, weight)};
};

/** Texto simples (rótulos/UI), com tracking em em. */
export const Label: React.FC<{
  text: string; x: number; y: number; size: number; weight?: number; fill?: string; tracking?: number; anchor?: 'start' | 'middle' | 'end'; opacity?: number; family?: string;
}> = ({text, x, y, size, weight = 600, fill = C.white, tracking = 0.18, anchor = 'start', opacity = 1, family = FONT.display}) => (
  <text x={x} y={y} fontFamily={family} fontWeight={weight} fontSize={size} fill={fill} letterSpacing={`${tracking}em`} textAnchor={anchor} opacity={opacity}>
    {text}
  </text>
);
