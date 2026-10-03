import React from 'react';
import {Composition} from 'remotion';
import {Film, SubFilm} from './Film';
import {buildSchedule, DUR, FPS} from './timeline';

const schedule = buildSchedule();

export const RemotionRoot: React.FC = () => (
  <>
    {/* Composições principais (pré-visualização / Studio) */}
    <Composition id="NEON-Film-16x9" component={Film} durationInFrames={DUR} fps={FPS} width={1920} height={1080} defaultProps={{audio: true}} />
    <Composition id="NEON-Film-9x16" component={Film} durationInFrames={DUR} fps={FPS} width={1080} height={1920} defaultProps={{audio: true}} />
    {/* Sub-quadros para o render final com motion blur (scripts/render-film.mjs) */}
    <Composition id="NEON-Subframes-16x9" component={SubFilm} durationInFrames={schedule.length} fps={FPS} width={1920} height={1080} defaultProps={{schedule}} />
    <Composition id="NEON-Subframes-9x16" component={SubFilm} durationInFrames={schedule.length} fps={FPS} width={1080} height={1920} defaultProps={{schedule}} />
  </>
);
