import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {C} from './brand/tokens';
import {FontGate} from './lib/fonts';
import {FrameTime, useT} from './lib/time';
import {SHUTTER, Sub} from './timeline';
import {Build} from './scenes/Build';
import {Flight} from './scenes/Flight';
import {Finale} from './scenes/Finale';
import {Hook} from './scenes/Hook';
import {Peak} from './scenes/Peak';

type SceneDef = {from: number; to: number; C: React.FC};

export const SCENES: SceneDef[] = [
  {from: 0, to: 66, C: Hook},
  {from: 49, to: 125, C: Build},
  {from: 116, to: 241, C: Flight},
  {from: 238, to: 312, C: Peak},
  {from: 314, to: 450, C: Finale},
];

const Body: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: C.black}}>
      {SCENES.filter((s) => t >= s.from - 1 && t <= s.to + 1).map((s, i) => (
        <AbsoluteFill key={i}>
          <s.C />
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

/** Pré-visualização (Studio): quadro a quadro, sem motion blur. */
export const Film: React.FC<{audio?: boolean}> = ({audio = false}) => (
  <AbsoluteFill style={{background: C.black}}>
    <FontGate>
      <Body />
    </FontGate>
    {audio ? <Audio src={staticFile('audio/neon-sfx-master.wav')} /> : null}
  </AbsoluteFill>
);

/** Sub-quadros para o motion blur acumulado fora do navegador. */
export const SubFilm: React.FC<{schedule: Sub[]}> = ({schedule}) => {
  const frame = useCurrentFrame();
  const [f, , , t] = schedule[Math.min(frame, schedule.length - 1)];
  return (
    <AbsoluteFill style={{background: C.black}}>
      <FontGate>
        <FrameTime t={t} base={f} shutter={SHUTTER}>
          <Body />
        </FrameTime>
      </FontGate>
    </AbsoluteFill>
  );
};
