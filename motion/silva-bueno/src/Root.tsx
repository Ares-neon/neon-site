import React from 'react';
import {Composition} from 'remotion';
import {SilvaBueno} from './SilvaBueno';
import {DURATION, FPS} from './timeline';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition
			id="SilvaBueno-9x16"
			component={SilvaBueno}
			durationInFrames={DURATION}
			fps={FPS}
			width={1080}
			height={1920}
			defaultProps={{format: '9x16' as const}}
		/>
		<Composition
			id="SilvaBueno-1x1"
			component={SilvaBueno}
			durationInFrames={DURATION}
			fps={FPS}
			width={1080}
			height={1080}
			defaultProps={{format: '1x1' as const}}
		/>
	</>
);
