import React from 'react';
import {Composition, Folder, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {Film, SceneHost} from './Film';
import {SCENES} from './scenes';
import {DURATION, FONT_FAMILY, FPS, HEIGHT, WIDTH} from './theme';

loadFont({
	family: FONT_FAMILY,
	url: staticFile('fonts/InterVariable-opsz.woff2'),
	weight: '100 900',
	format: 'woff2',
});

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition id="NeonBrandFilm" component={Film} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
			<Folder name="Cenas">
				{SCENES.map((s) => (
					<Composition
						key={s.id}
						id={`${s.id}-${s.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}`}
						component={() => <SceneHost scene={s} />}
						durationInFrames={s.pre + s.dur + s.post}
						fps={FPS}
						width={WIDTH}
						height={HEIGHT}
					/>
				))}
			</Folder>
		</>
	);
};
