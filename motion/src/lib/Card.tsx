import React from 'react';
import {Img, staticFile} from 'remotion';
import {Piece} from '../brand/pieces';
import {P2, quadMatrix} from './project';

export type CardProps = {
  piece: Piece;
  w: number; // tamanho de layout do elemento (px CSS)
  h: number;
  quad: {x: number; y: number}[]; // TL, TR, BR, BL na tela
  reveal?: number; // 0..1 (máscara de revelação)
  revealFrom?: 'left' | 'top' | 'bottom';
  o?: number;
  z?: number;
  dim?: number; // escurecimento por profundidade 0..1
  radius?: number; // raio em px do elemento
  border?: string; // cor da borda (opcional)
};

/** Peça real mapeada num quadrilátero (perspectiva verdadeira via homografia). */
export const Card: React.FC<CardProps> = ({piece, w, h, quad, reveal = 1, revealFrom = 'left', o = 1, z = 0, dim = 0, radius, border}) => {
  if (o <= 0.002 || w < 1 || h < 1) return null;
  const [cx0, cy0, cw, ch] = piece.crop;
  const k = Math.max(w / cw, h / ch);
  const [fx, fy] = piece.focus ?? [0.5, 0.5];
  const left = -cx0 * k - (cw * k - w) * fx;
  const top = -cy0 * k - (ch * k - h) * fy;
  const r = radius ?? (piece.r * w) / (cw / piece.dpr);
  const cut = (1 - Math.max(0, Math.min(1, reveal))) * 100;
  const inset =
    revealFrom === 'left' ? `0 ${cut}% 0 0` : revealFrom === 'top' ? `0 0 ${cut}% 0` : `${cut}% 0 0 0`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        transformOrigin: '0 0',
        transform: quadMatrix(w, h, quad),
        clipPath: `inset(${inset} round ${r}px)`,
        opacity: o,
        zIndex: z,
        overflow: 'hidden',
        backfaceVisibility: 'hidden',
      }}
    >
      <Img src={staticFile(piece.src)} style={{position: 'absolute', left, top, width: piece.iw * k, height: piece.ih * k, maxWidth: 'none'}} />
      {dim > 0.002 ? <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${dim})`}} /> : null}
      {border ? <div style={{position: 'absolute', inset: 0, borderRadius: r, boxShadow: `inset 0 0 0 ${Math.max(1, w / 400)}px ${border}`}} /> : null}
    </div>
  );
};

export const rectQuad = (x: number, y: number, w: number, h: number): P2[] => [
  {x, y, z: 0},
  {x: x + w, y, z: 0},
  {x: x + w, y: y + h, z: 0},
  {x, y: y + h, z: 0},
];

export type Rect = [number, number, number, number];
export const lerpRect = (a: Rect, b: Rect, p: number): Rect => [
  a[0] + (b[0] - a[0]) * p,
  a[1] + (b[1] - a[1]) * p,
  a[2] + (b[2] - a[2]) * p,
  a[3] + (b[3] - a[3]) * p,
];
