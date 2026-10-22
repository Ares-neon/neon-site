import React from 'react';
import {AbsoluteFill} from 'remotion';
import {KineticText} from '../components/KineticText';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

// Profile facing right, drawn once as a single silhouette. The rim light is
// the silhouette minus a copy of itself shifted towards the light's opposite
// side, so its width follows the real orientation of each contour.
const HEAD =
	'M420 80 C520 70 620 110 670 190 C715 260 735 350 732 420 C731 445 726 462 718 480 ' +
	'C712 492 712 505 718 520 C742 575 772 625 798 662 C808 676 806 694 792 702 ' +
	'C778 709 760 708 748 714 C750 732 756 748 764 760 C768 768 762 778 752 784 ' +
	'C760 794 766 808 760 822 C755 836 742 846 734 858 C738 880 752 898 754 920 ' +
	'C756 950 742 975 712 990 C680 1004 640 1010 612 1030 C592 1046 584 1080 584 1120 ' +
	'C584 1200 592 1300 604 1520 L-200 1520 C-120 1300 -60 1180 -40 1080 ' +
	'C-30 1000 -20 940 -10 860 C10 700 30 520 90 400 C170 230 290 100 420 80 Z';

export const S06Pessoas: React.FC<SceneProps> = ({f}) => {
	const m = meta('S06');
	const fadeIn = ramp(f, -16, 6, ease.inOutSine);
	// The rim light travels down the profile: forehead, nose, lips, chin.
	const sweep = mix(-200, 1500, ramp(f, -10, 70, ease.inOutSine));
	const rim = ramp(f, -10, 40, ease.inOutSine);
	const green = ramp(f, 50, 104, ease.inOutSine);
	const flood = ramp(f, 150, 198, ease.inCubic);
	const cam = ramp(f, -16, 198, ease.inOutSine);
	const scale = mix(1.04, 1.1, cam);
	const tx = mix(70, 40, cam);
	const ty = mix(400, 360, cam);
	const tilt = mix(0.6, -0.6, cam);

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: fadeIn}}>
			<svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
				<defs>
					<path id="s06-head" d={HEAD} />
					<filter id="s06-soft" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="1.1" />
					</filter>
					<filter id="s06-glow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="16" />
					</filter>
					<filter id="s06-wide" x="-80%" y="-80%" width="260%" height="260%">
						<feGaussianBlur stdDeviation="60" />
					</filter>
					<mask id="s06-rim" maskUnits="userSpaceOnUse" x="-400" y="-200" width="1800" height="2000">
						<use href="#s06-head" fill="white" />
						<use href="#s06-head" fill="black" transform="translate(-4 2.5)" />
					</mask>
					<mask id="s06-rimWide" maskUnits="userSpaceOnUse" x="-400" y="-200" width="1800" height="2000">
						<use href="#s06-head" fill="white" />
						<use href="#s06-head" fill="black" transform="translate(-16 8)" />
					</mask>
					{/* Light comes from behind-right: the face front catches it, the
					    crown and back of the head fall off into darkness. */}
					<linearGradient id="s06-falloff" gradientUnits="userSpaceOnUse" x1="420" y1="0" x2="760" y2="0">
						<stop offset="0" stopColor="white" stopOpacity="0" />
						<stop offset="0.65" stopColor="white" stopOpacity="0.55" />
						<stop offset="1" stopColor="white" stopOpacity="1" />
					</linearGradient>
					<mask id="s06-falloffMask" maskUnits="userSpaceOnUse" x="-400" y="-200" width="1800" height="2000">
						<rect x="-400" y="-200" width="1800" height="2000" fill="url(#s06-falloff)" />
					</mask>
					<mask id="s06-rimNeck" maskUnits="userSpaceOnUse" x="-400" y="-200" width="1800" height="2000">
						<use href="#s06-head" fill="white" />
						<use href="#s06-head" fill="black" transform="translate(-9 -3)" />
					</mask>
					<linearGradient id="s06-sweep" gradientUnits="userSpaceOnUse" x1="0" y1={sweep - 260} x2="0" y2={sweep}>
						<stop offset="0" stopColor="white" stopOpacity="1" />
						<stop offset="1" stopColor="white" stopOpacity="0" />
					</linearGradient>
					<linearGradient id="s06-neck" gradientUnits="userSpaceOnUse" x1="0" y1="970" x2="0" y2="1230">
						<stop offset="0" stopColor="white" stopOpacity="0" />
						<stop offset="0.3" stopColor="white" stopOpacity="1" />
						<stop offset="0.6" stopColor="white" stopOpacity="0.85" />
						<stop offset="1" stopColor="white" stopOpacity="0" />
					</linearGradient>
					<mask id="s06-sweepMask" maskUnits="userSpaceOnUse" x="-400" y="-200" width="1800" height="2000">
						<rect x="-400" y="-200" width="1800" height="2000" fill="url(#s06-sweep)" />
					</mask>
					<mask id="s06-neckMask" maskUnits="userSpaceOnUse" x="-400" y="-200" width="1800" height="2000">
						<rect x="-400" y="-200" width="1800" height="2000" fill="url(#s06-neck)" />
					</mask>
					<radialGradient id="s06-fill" cx="0.78" cy="0.36" r="0.42">
						<stop offset="0" stopColor="#0c0c0c" />
						<stop offset="1" stopColor="#050505" />
					</radialGradient>
				</defs>
				<g transform={`translate(${tx} ${ty}) rotate(${tilt} 600 700) scale(${scale})`}>
					{/* green light from below-right, kissing the throat */}
					<g opacity={0.24 * green * (1 + 3.4 * flood)}>
						<ellipse cx={660} cy={1130} rx={170 + 420 * flood} ry={260 + 520 * flood} fill={COLORS.green} filter="url(#s06-wide)" />
					</g>
					<use href="#s06-head" fill="url(#s06-fill)" />
					<g mask="url(#s06-sweepMask)" opacity={rim}>
						<g mask="url(#s06-falloffMask)">
							<g mask="url(#s06-rim)">
								<use href="#s06-head" fill="#ffffff" filter="url(#s06-soft)" />
							</g>
							<g mask="url(#s06-rimWide)" opacity={0.16} filter="url(#s06-soft)">
								<use href="#s06-head" fill="#ffffff" />
							</g>
							<g mask="url(#s06-rim)" opacity={0.5} filter="url(#s06-glow)">
								<use href="#s06-head" fill="#ffffff" />
							</g>
						</g>
					</g>
					<g mask="url(#s06-neckMask)" opacity={green}>
						<g mask="url(#s06-rimNeck)">
							<use href="#s06-head" fill={COLORS.green} filter="url(#s06-soft)" />
						</g>
						<g mask="url(#s06-rimNeck)" opacity={0.8} filter="url(#s06-glow)">
							<use href="#s06-head" fill={COLORS.green} />
						</g>
					</g>
				</g>
			</svg>
			<KineticText lines={m.lines} f={f} inAt={36} outAt={140} top={250} />
		</AbsoluteFill>
	);
};
