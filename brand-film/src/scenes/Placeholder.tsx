import React from 'react';
import {AbsoluteFill} from 'remotion';
import {KineticText} from '../components/KineticText';
import type {SceneMeta} from '../timeline';
import type {SceneProps} from './types';

/** Stand-in used while a scene is being built: black frame + its headline. */
export const makePlaceholder = (m: SceneMeta): React.FC<SceneProps> => {
	const Placeholder: React.FC<SceneProps> = ({f}) => (
		<AbsoluteFill style={{backgroundColor: '#050505', opacity: f < 0 ? 0 : 1}}>
			<KineticText lines={m.lines.length ? m.lines : [m.name.toUpperCase()]} f={f} inAt={20} outAt={m.dur - 30} />
		</AbsoluteFill>
	);
	return Placeholder;
};
