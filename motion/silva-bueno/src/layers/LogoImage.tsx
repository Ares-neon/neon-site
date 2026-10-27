import React from 'react';
import {E, textureUrl} from '../lib/geometry';

// One brand element = its original pixels (2x texture) placed at its reference position.
export const LogoImage: React.FC<{id: string} & React.SVGProps<SVGImageElement>> = ({id, ...rest}) => {
	const e = E[id];
	return (
		<image
			href={textureUrl(id)}
			x={e.x}
			y={e.y}
			width={e.w}
			height={e.h}
			preserveAspectRatio="none"
			{...rest}
		/>
	);
};
