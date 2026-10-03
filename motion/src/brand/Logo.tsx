import React from 'react';
import {BOLT, HEX, LogoPiece, WORD} from './logoPaths';
import {C} from './tokens';

// Logo oficial NEON vetorizado (8 peças do hexágono + raio + 4 letras), coordenadas do arquivo original.
export const SYM = {cx: 340.46, cy: 513.915, w: 323.48, h: 471.67};
export const LOCK = {cx: 742.76, cy: 513.915, w: 1128.08, h: 471.67};
export const WORDBOX = {x0: 583, x1: 1306.8, y0: 428, y1: 569.5};

// Índices das peças do hexágono (ordenadas por x do centro):
// 0 colchete inf. esq · 1 colchete sup. esq · 2 arco inf. esq · 3 traço longo A (ápice -> inf. esq)
// 4 traço longo B (ponta inf. -> sup. dir) · 5 arco sup. dir · 6 colchete inf. dir · 7 colchete sup. dir
export const PIECE = {LONG_A: 3, LONG_B: 4};

export type PieceT = {tx?: number; ty?: number; rot?: number; s?: number; sx?: number; sy?: number; o?: number};

const tf = (p: {cx: number; cy: number}, a: PieceT) => {
  const s = a.s ?? 1;
  return `translate(${p.cx + (a.tx ?? 0)} ${p.cy + (a.ty ?? 0)}) rotate(${a.rot ?? 0}) scale(${s * (a.sx ?? 1)} ${s * (a.sy ?? 1)}) translate(${-p.cx} ${-p.cy})`;
};

const Pieces: React.FC<{list: LogoPiece[]; fn?: (i: number, p: LogoPiece) => PieceT; fill: string}> = ({list, fn, fill}) => (
  <>
    {list.map((p, i) => {
      const a = fn ? fn(i, p) : {};
      const o = a.o ?? 1;
      if (o <= 0.001) return null;
      return <path key={i} d={p.d} fill={fill} opacity={o} transform={tf(p, a)} />;
    })}
  </>
);

export const GlowDefs: React.FC<{id: string; std?: number; std2?: number}> = ({id, std = 5, std2 = 16}) => (
  <defs>
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={std} result="b1" />
      <feGaussianBlur in="SourceGraphic" stdDeviation={std2} result="b2" />
      <feMerge>
        <feMergeNode in="b2" />
        <feMergeNode in="b1" />
      </feMerge>
    </filter>
  </defs>
);

export type SymbolProps = {
  id: string;
  x: number;
  y: number;
  height: number;
  rot?: number;
  piece?: (i: number, p: LogoPiece) => PieceT;
  bolt?: PieceT;
  color?: string;
  boltColor?: string;
  glow?: number; // 0..1 intensidade do halo verde (como no logo oficial)
  boltGlow?: number;
  opacity?: number;
};

/** Símbolo NEON (hexágono + raio). Deve ser usado dentro de um <svg>. */
export const NeonSymbol: React.FC<SymbolProps> = ({
  id, x, y, height, rot = 0, piece, bolt = {}, color = C.green, boltColor = C.white, glow = 0, boltGlow = 0, opacity = 1,
}) => {
  const k = height / SYM.h;
  const g = `translate(${x} ${y}) rotate(${rot}) scale(${k}) translate(${-SYM.cx} ${-SYM.cy})`;
  return (
    <g opacity={opacity}>
      <GlowDefs id={`${id}-glow`} std={5} std2={18} />
      <GlowDefs id={`${id}-bglow`} std={4} std2={12} />
      <g transform={g}>
        {glow > 0.001 ? (
          <g filter={`url(#${id}-glow)`} opacity={glow}>
            <Pieces list={HEX} fn={piece} fill={color} />
          </g>
        ) : null}
        <Pieces list={HEX} fn={piece} fill={color} />
        {boltGlow > 0.001 ? (
          <g filter={`url(#${id}-bglow)`} opacity={boltGlow}>
            <Pieces list={BOLT} fn={() => bolt} fill={boltColor} />
          </g>
        ) : null}
        <Pieces list={BOLT} fn={() => bolt} fill={boltColor} />
      </g>
    </g>
  );
};

/** Wordmark NEON (4 letras oficiais). x,y = centro do lockup completo; height = altura do lockup. */
export const NeonWordmark: React.FC<{
  x: number;
  y: number;
  height: number;
  letter?: (i: number, p: LogoPiece) => PieceT;
  color?: string;
  clipId?: string;
}> = ({x, y, height, letter, color = C.white, clipId}) => {
  const k = height / LOCK.h;
  const g = `translate(${x} ${y}) scale(${k}) translate(${-LOCK.cx} ${-LOCK.cy})`;
  return (
    <g transform={g} clipPath={clipId ? `url(#${clipId})` : undefined}>
      <Pieces list={WORD} fn={letter} fill={color} />
    </g>
  );
};

/** Converte um ponto do espaço do lockup (px do arquivo original) para a tela. */
export const lockupToScreen = (x: number, y: number, height: number, px: number, py: number) => {
  const k = height / LOCK.h;
  return {x: x + (px - LOCK.cx) * k, y: y + (py - LOCK.cy) * k};
};
