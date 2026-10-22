import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {KineticText} from '../components/KineticText';
import {CameraRig, Exposure, StudioEnv} from '../three/StudioEnv';
import {GlowLine} from '../three/Glow';
import {ReflectiveFloor} from '../three/ReflectiveFloor';
import {noiseTexture} from '../three/textures';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

RectAreaLightUniformsLib.init();

const cycloFrag = `
varying vec2 vUv;
void main() {
	float h = vUv.y;
	float band = exp(-pow((h - 0.30) / 0.10, 2.0)) * 0.11 + exp(-pow((h - 0.30) / 0.32, 2.0)) * 0.035;
	gl_FragColor = vec4(vec3(band), 1.0);
}`;
const cycloVert = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Monolith with a line of green light on its leading edge, seen on a slow
// lateral travelling; the move ends behind a foreground pillar (wipe to black).
export const S04Estrategia: React.FC<SceneProps> = ({f}) => {
	const m = meta('S04');
	const grow = ramp(f, 4, 72, ease.outQuart);
	const camT = ramp(f, -30, 180, ease.inOutSine);
	const camX = mix(-1.6, 4.2, camT);
	const fadeIn = ramp(f, -30, -6);

	const mats = useMemo(() => {
		const roughBlock = noiseTexture(256, 5, 5, 7.7, 1.2);
		return {
			block: new THREE.MeshStandardMaterial({color: '#161616', roughness: 0.6, metalness: 0, roughnessMap: roughBlock, bumpMap: roughBlock, bumpScale: 0.8}),
			line: new THREE.MeshBasicMaterial({color: COLORS.green, toneMapped: false}),
			cyclo: new THREE.ShaderMaterial({vertexShader: cycloVert, fragmentShader: cycloFrag, toneMapped: false}),
		};
	}, []);

	// Monolith turned 30 degrees so two faces read; the green line runs up the
	// corner nearest to camera.
	const H = 6.0;
	const yaw = 0.52;
	const pos: [number, number, number] = [0.7, H / 2, -7];
	const half = 1.25;
	const edgeX = pos[0] + (-half * Math.cos(yaw) + half * Math.sin(yaw));
	const edgeZ = pos[2] + (half * Math.sin(yaw) + half * Math.cos(yaw));
	const lineTop = H * grow;

	// Out-of-focus foreground pillar passing the lens at the end of the move:
	// drawn as a soft-edged black band whose position follows the parallax of
	// a pillar 3 m in front of the camera.
	const camZ = 11;
	const pillarX = 4.2 - 0.95;
	const tanH = Math.tan((25 * Math.PI) / 180) * (1080 / 1920);
	const pillarScreenX = 540 + ((pillarX - camX) / 3.0 / tanH) * 540;

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: fadeIn}}>
			<ThreeCanvas width={1080} height={1920} gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={['#000000']} />
				<CameraRig position={[camX, 1.6, camZ]} target={[camX + 0.25, 2.5, -7]} fov={50} />
				<Exposure value={1.3} />
				<StudioEnv intensity={0.35} panels={[{position: [0, 9, -2], size: [10, 3], intensity: 1.2}, {position: [-9, 3, 4], size: [2, 6], intensity: 0.4}]} />
				<mesh position={[0, 12, -40]} material={mats.cyclo}>
					<planeGeometry args={[140, 40]} />
				</mesh>
				<ReflectiveFloor color="#0a0a0a" roughness={0.3} reflectivity={0.75} blur={0.008} />
				<mesh position={pos} rotation={[0, yaw, 0]} material={mats.block}>
					<boxGeometry args={[half * 2, H, half * 2]} />
				</mesh>
				<rectAreaLight position={[2.6, H + 2.2, -3.5]} rotation={[-Math.PI / 2.8, 0.5, 0]} width={4.5} height={1.6} intensity={4.5} color="#ffffff" />
				<rectAreaLight position={[0, 11, -24]} rotation={[-Math.PI / 2.2, 0, 0]} width={30} height={4} intensity={1.2} color="#ffffff" />
				{grow > 0.001 ? (
					<>
						<mesh position={[edgeX, lineTop / 2, edgeZ]} material={mats.line}>
							<boxGeometry args={[0.032, lineTop, 0.032]} />
						</mesh>
						<rectAreaLight
							position={[edgeX, lineTop / 2, edgeZ + 0.05]}
							rotation={[0, Math.PI, 0]}
							width={0.06}
							height={Math.max(lineTop, 0.01)}
							intensity={70 * Math.min(1, grow * 3)}
							color={COLORS.green}
						/>
						<GlowLine from={[edgeX, 0.0, edgeZ + 0.02]} to={[edgeX, lineTop, edgeZ + 0.02]} width={1.0} core={0.032} color={COLORS.green} intensity={0.9} fadeEnds={0.01} />
					</>
				) : null}
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={34} outAt={136} top={250} />
			<div
				style={{
					position: 'absolute',
					top: 0,
					bottom: 0,
					left: pillarScreenX - 90,
					width: 2400,
					background: 'linear-gradient(90deg, rgba(5,5,5,0) 0px, rgba(5,5,5,0.85) 70px, #050505 180px)',
				}}
			/>
		</AbsoluteFill>
	);
};
