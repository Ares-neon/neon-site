import React from 'react';
import {LOCK, lockupToScreen, NeonSymbol, NeonWordmark, SYM, WORDBOX} from '../brand/Logo';
import {a, C, FONT, HANDLE} from '../brand/tokens';
import {E, lerp, prog, spring, track} from '../lib/ease';
import {fitSize, glyphBox, textWidth} from '../lib/fonts';
import {hexPath, Svg, Word, wordGeom} from '../lib/svg';
import {useFmt, useT} from '../lib/time';

// IMPACTO 10,5 → 12,5 s e RESOLUÇÃO 12,5 → 15 s.
// Silêncio → RESULTADO. → o ponto acende → a câmera avança no ponto → o ponto cristaliza no símbolo NEON →
// o símbolo desliza e revela o wordmark (lockup oficial) → assinatura.

export const FIN = {RES: 315, IGNITE: 330, PAN0: 333, PAN1: 345, CRY0: 341, CRY1: 353, SLIDE0: 356, SLIDE1: 369, WORD0: 367, TAG: 379, SIG: 388, HANDLE: 398};

export const finaleLayout = (W: number, H: number, portrait: boolean) => {
  const lockH = portrait ? 392 : 318;
  const lockY = portrait ? 735 : 374;
  const k = lockH / LOCK.h;
  const sym = lockupToScreen(W / 2, lockY, lockH, SYM.cx, SYM.cy);
  const symRight = lockupToScreen(W / 2, lockY, lockH, 502.2, SYM.cy).x;
  return {
    lockH,
    lockY,
    k,
    sym,
    symRight,
    tagY: lockY + lockH / 2 + (portrait ? 120 : 92),
    tagSize: portrait ? 34 : 30,
    sigY: lockY + lockH / 2 + (portrait ? 262 : 214),
    sigSize: portrait ? 76 : 66,
    handleY: portrait ? 1490 : 948,
    handleSize: portrait ? 34 : 30,
  };
};

export const Finale: React.FC = () => {
  const t = useT();
  const {W, H, cx, cy, portrait} = useFmt();
  if (t < FIN.RES - 1) return null;
  const F = finaleLayout(W, H, portrait);

  // ---------------- RESULTADO. ----------------
  const fs = fitSize('RESULTADO.', portrait ? W * 0.86 : W * 0.68, 800, -0.045);
  const g = wordGeom('RESULTADO.', fs, cx, 'middle', -0.045);
  const base = cy + g.cap / 2;
  const pb = glyphBox('.', fs, 800);
  const pS = pb.right + pb.left;
  const pI = 9;
  const pX = g.x0 + g.xs[pI] - pb.left + pS / 2;
  const pY = base - (pb.ascent - pb.descent) / 2;

  const pan = E.inOutCubic(prog(t, FIN.PAN0, FIN.PAN1));
  const zoom = 1 + 1.1 * E.inCubic(prog(t, FIN.PAN0 + 1, FIN.PAN1));
  const fx = lerp(pX, cx, pan);
  const fy = lerp(pY, cy, pan);
  const wordO = 1 - prog(t, FIN.PAN0 + 4, FIN.PAN1);
  const settle = 1 - E.outCubic(prog(t, FIN.RES, FIN.RES + 16));

  // ---------------- ponto → símbolo ----------------
  const ignite = prog(t, FIN.IGNITE, FIN.IGNITE + 1);
  const bump = Math.sin(Math.PI * prog(t, FIN.IGNITE, FIN.IGNITE + 6)) * 0.35;
  const dotSize = pS * zoom * (1 + bump) * (1 + 0.6 * E.inCubic(prog(t, FIN.CRY0 - 2, FIN.CRY0 + 2)));
  const dotO = t < FIN.CRY0 + 1 ? 1 : 1 - prog(t, FIN.CRY0 + 1, FIN.CRY0 + 3);
  const symOn = t >= FIN.CRY0;
  const slide = E.inOutCubic(prog(t, FIN.SLIDE0, FIN.SLIDE1));
  const symX = lerp(fx, F.sym.x, slide);
  const symY = lerp(fy, F.sym.y, slide);
  const zoomAt = (tt: number) => 1 + 1.1 * E.inCubic(prog(tt, FIN.PAN0 + 1, FIN.PAN1));
  const symH0 = pS * zoomAt(FIN.CRY0) * 1.75;
  const symH = track(t, [[FIN.CRY0, symH0], [FIN.CRY1, F.lockH, E.outCubic]]);
  const cry = E.outBack(1.3)(prog(t, FIN.CRY0 + 1, FIN.CRY1));
  const pieceS = lerp(1.5, 1, cry);
  const symRot = lerp(-30, 0, E.outCubic(prog(t, FIN.CRY0, FIN.CRY1)));
  const boltS = spring(t, FIN.CRY1 - 3, {f: 3.4, z: 0.55});
  const breath = 0.06 * Math.sin(Math.PI * prog(t, 412, 446));
  const glow = 0.55 * prog(t, FIN.CRY1 - 4, FIN.CRY1 + 6) + breath;
  const boltGlow = track(t, [[FIN.CRY1 - 3, 0], [FIN.CRY1 - 1, 1.3], [FIN.CRY1 + 10, 0.45]]);

  // ---------------- wordmark NEON ----------------
  const lockX = cx;
  const symRightNow = F.symRight + (symX - F.sym.x);
  const letterT = (i: number) => E.outExpo(prog(t, FIN.WORD0 + i * 1.6, FIN.WORD0 + i * 1.6 + 7.5));

  // ---------------- assinatura ----------------
  const tagP = E.outCubic(prog(t, FIN.TAG, FIN.TAG + 9));
  const tagTxt = 'BRANDING & PERFORMANCE';
  const tagLs = 0.42;
  const tagW = textWidth(tagTxt, F.tagSize, 600) + tagTxt.length * F.tagSize * tagLs;
  const hairP = E.inOutCubic(prog(t, FIN.TAG - 2, FIN.TAG + 8));
  const sigFs = F.sigSize;
  const sigG = wordGeom('MARCA QUE SE MOVE.', sigFs, cx, 'middle', -0.02, 800);
  const sigDotI = 'MARCA QUE SE MOVE.'.length - 1;
  const spb = glyphBox('.', sigFs, 800);
  const sdS = spb.right + spb.left;
  const sdX = sigG.x0 + sigG.xs[sigDotI] - spb.left + sdS / 2;
  const sdY = F.sigY - (spb.ascent - spb.descent) / 2;
  const sigDot = spring(t, FIN.SIG + 8, {f: 3.6, z: 0.5});
  const handleP = E.outCubic(prog(t, FIN.HANDLE, FIN.HANDLE + 10));

  // vida sutil no quadro final
  const hold = 1 + 0.014 * E.inOutSine(prog(t, 405, 450));
  const ring = prog(t, 414, 440);

  return (
    <Svg>
      {/* RESULTADO. (com câmera avançando no ponto) */}
      {t < FIN.PAN1 + 1 ? (
        <g transform={`translate(${fx} ${fy}) scale(${zoom}) translate(${-pX} ${-pY})`} opacity={wordO}>
          <Word
            text="RESULTADO."
            id="fin-r"
            size={fs}
            x={cx}
            y={base}
            tracking={-0.045}
            letter={(i, n) => {
              if (i === pI) return {o: 0};
              return {dx: (i - (n - 1) / 2) * fs * 0.03 * settle};
            }}
            clip={(i, box) => {
              const r = E.outExpo(prog(t, FIN.RES + i * 0.45, FIN.RES + i * 0.45 + 6));
              const hh = (box.h + 60) * r;
              return [box.x - 40, base + 6 - hh, box.w + 80, hh];
            }}
          />
        </g>
      ) : null}
      {/* o ponto (branco → acende verde) */}
      {t >= FIN.RES + 4 && dotO > 0.01 ? (
        <g opacity={dotO}>
          <defs>
            <filter id="fin-dotglow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation={Math.max(6, dotSize * 0.5)} />
            </filter>
          </defs>
          {ignite > 0 ? (
            <rect x={fx - dotSize} y={fy - dotSize} width={dotSize * 2} height={dotSize * 2} fill={C.green} opacity={0.7 * ignite * (0.5 + bump)} filter="url(#fin-dotglow)" />
          ) : null}
          <rect x={fx - dotSize / 2} y={fy - dotSize / 2} width={dotSize} height={dotSize} fill={ignite > 0.5 ? C.green : C.white} />
        </g>
      ) : null}

      <g transform={`translate(${cx} ${H / 2}) scale(${hold}) translate(${-cx} ${-H / 2})`}>
        {/* símbolo */}
        {symOn ? (
          <NeonSymbol
            id="fin-sym"
            x={symX}
            y={symY}
            height={symH}
            rot={symRot}
            piece={() => ({s: pieceS})}
            bolt={{s: boltS, o: t >= FIN.CRY1 - 3 ? 1 : 0}}
            glow={glow}
            boltGlow={boltGlow}
          />
        ) : null}
        {ring > 0 && ring < 1 ? (
          <path d={hexPath(F.sym.x, F.sym.y, F.lockH * (0.62 + 0.9 * E.outCubic(ring)))} fill="none" stroke={C.green} strokeWidth={1.5} opacity={0.3 * (1 - ring)} />
        ) : null}

        {/* wordmark sai de trás do símbolo */}
        {t >= FIN.WORD0 ? (
          <>
            <defs>
              <clipPath id="fin-wm">
                <rect x={symRightNow + 6} y={0} width={W} height={H} />
              </clipPath>
            </defs>
            <g clipPath="url(#fin-wm)">
              <NeonWordmark
                x={lockX}
                y={F.lockY}
                height={F.lockH}
                letter={(i, p) => {
                  const k = letterT(i);
                  const startDx = WORDBOX.x0 - 60 - p.cx;
                  return {tx: startDx * (1 - k), o: k > 0 ? 1 : 0};
                }}
              />
            </g>
          </>
        ) : null}

        {/* filete + BRANDING & PERFORMANCE */}
        {hairP > 0 ? (
          <line
            x1={cx - (tagW / 2 + 40) * hairP}
            x2={cx + (tagW / 2 + 40) * hairP}
            y1={F.tagY - F.tagSize * 1.9}
            y2={F.tagY - F.tagSize * 1.9}
            stroke={C.white}
            strokeWidth={1}
            opacity={0.22}
          />
        ) : null}
        {tagP > 0 ? (
          <text
            x={cx + (F.tagSize * tagLs) / 2}
            y={F.tagY + 8 * (1 - tagP)}
            textAnchor="middle"
            fontFamily={FONT.display}
            fontWeight={600}
            fontSize={F.tagSize}
            letterSpacing={`${tagLs}em`}
            fill={C.white}
            opacity={0.78 * tagP}
          >
            {tagTxt}
          </text>
        ) : null}

        {/* MARCA QUE SE MOVE. — o ponto final é o pixel verde */}
        {t >= FIN.SIG ? (
          <>
            <Word
              text="MARCA QUE SE MOVE."
              id="fin-sig"
              size={sigFs}
              x={cx}
              y={F.sigY}
              tracking={-0.02}
              letter={(i, n, ch) => (ch === '.' ? {o: 0} : {})}
              clip={(i, box) => {
                const r = E.outExpo(prog(t, FIN.SIG + i * 0.35, FIN.SIG + i * 0.35 + 6));
                const hh = (box.h + 30) * r;
                return [box.x - 20, F.sigY + 6 - hh, box.w + 40, hh];
              }}
            />
            {sigDot > 0.001 ? <rect x={sdX - (sdS * sigDot) / 2} y={sdY - (sdS * sigDot) / 2} width={sdS * sigDot} height={sdS * sigDot} fill={C.green} /> : null}
          </>
        ) : null}

        {/* @NEONCREATES */}
        {handleP > 0 ? (
          <text
            x={cx + (F.handleSize * 0.24) / 2}
            y={F.handleY + 10 * (1 - handleP)}
            textAnchor="middle"
            fontFamily={FONT.display}
            fontWeight={600}
            fontSize={F.handleSize}
            letterSpacing="0.24em"
            fill={C.white}
            opacity={0.6 * handleP}
          >
            {HANDLE}
          </text>
        ) : null}
      </g>
    </Svg>
  );
};
