import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Grain, Vignette} from './components/Grain';
import {SCENES, type SceneEntry} from './scenes';
import {COLORS} from './theme';

export const SceneHost: React.FC<{scene: SceneEntry}> = ({scene}) => {
	const frame = useCurrentFrame();
	const C = scene.Component;
	return <C f={frame - scene.pre} />;
};

export const Film: React.FC = () => {
	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black}}>
			{SCENES.map((s) => (
				<Sequence
					key={s.id}
					name={`${s.id} · ${s.name}`}
					from={s.start - s.pre}
					durationInFrames={s.pre + s.dur + s.post}
					style={{zIndex: s.z}}
				>
					<SceneHost scene={s} />
				</Sequence>
			))}
			{/* Not wrapped in a z-indexed group: the grain must blend with the scenes. */}
			<Vignette />
			<Grain />
			<Html5Audio src={staticFile('audio/neon-score.wav')} />
		</AbsoluteFill>
	);
};
