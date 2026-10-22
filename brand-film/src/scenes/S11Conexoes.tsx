import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {KineticText} from '../components/KineticText';
import {CameraRig, Exposure, StudioEnv} from '../three/StudioEnv';
import {GlowPoint} from '../three/Glow';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

const R = 2.1;
const TUBE = 0.36;
const FOV = 34;

// A black lacquered ring. A green line runs along its outer edge and closes
// the circle; at the end the camera moves through the ring and its opening
// becomes the window onto scene 12.
export const S11Conexoes: React.FC<SceneProps> = ({f}) => {
	const m = meta('S11');
	const draw = ramp(f, 8, 150, ease.inOutSine);
	const orbit = ramp(f, -14, 180, ease.inOutSine);
	const through = ramp(f, 150, 206, ease.inCubic);
	const dist = mix(mix(13.5, 11.5, orbit), 0.6, through);
	const yaw = mix(0.62, 0.0, ramp(f, -14, 168, ease.inOut));
	const pitch = mix(0.42, 0.0, ramp(f, -14, 168, ease.inOut));
	const camPos: [number, number, number] = [Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist];

	const mats = useMemo(
		() => ({
			ring: new THREE.MeshPhysicalMaterial({color: '#0b0b0b', roughness: 0.3, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.18}),
			line: new THREE.MeshBasicMaterial({color: COLORS.green, toneMapped: false}),
			halo: new THREE.MeshBasicMaterial({color: COLORS.green, toneMapped: false, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false}),
			halo2: new THREE.MeshBasicMaterial({color: COLORS.green, toneMapped: false, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false}),
		}),
		[],
	);

	const arc = Math.max(0.0001, draw * Math.PI * 2);
	const start = Math.PI * 0.5;
	const head: [number, number, number] = [Math.cos(start + arc) * (R + TUBE), Math.sin(start + arc) * (R + TUBE), 0];

	// Screen radius of the inner edge once the camera faces the ring.
	const innerPx = ((R - TUBE) / (Math.max(dist, 0.05) * Math.tan((FOV / 2) * (Math.PI / 180)))) * 960;
	const hole = ramp(f, 158, 176);
	const mask =
		hole > 0
			? `radial-gradient(circle at 50% 50%, rgba(0,0,0,${1 - hole}) ${Math.max(0, innerPx - 2)}px, black ${innerPx + 2}px)`
			: undefined;
	const fadeIn = ramp(f, -14, 0);

	return (
		<AbsoluteFill style={{opacity: fadeIn, WebkitMaskImage: mask, maskImage: mask}}>
			<AbsoluteFill style={{backgroundColor: COLORS.black}} />
			<ThreeCanvas width={1080} height={1920} gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={['#000000']} />
				<CameraRig position={camPos} target={[0, 0, 0]} fov={FOV} roll={mix(0.05, 0, orbit)} near={0.02} />
				<Exposure value={1.2} />
				<StudioEnv
					intensity={1.0}
					panels={[
						{position: [-5, 8, 7], size: [9, 3], intensity: 3.2},
						{position: [9, -1, 5], size: [1.6, 12], intensity: 2.0},
						{position: [-9, -3, 3], size: [1.2, 8], intensity: 1.0},
						{position: [0, -8, -6], size: [12, 2], intensity: 0.9},
					]}
				/>
				<directionalLight position={[-4, 6, 5]} intensity={0.9} />
				<directionalLight position={[3, 4, -8]} intensity={2.2} />
				<mesh material={mats.ring}>
					<torusGeometry args={[R, TUBE, 96, 360]} />
				</mesh>
				<group rotation={[0, 0, start]}>
					<mesh material={mats.line}>
						<torusGeometry args={[R + TUBE + 0.004, 0.016, 8, 480, arc]} />
					</mesh>
					<mesh material={mats.halo}>
						<torusGeometry args={[R + TUBE + 0.01, 0.05, 12, 480, arc]} />
					</mesh>
					<mesh material={mats.halo2}>
						<torusGeometry args={[R + TUBE + 0.02, 0.16, 12, 480, arc]} />
					</mesh>
				</group>
				{draw < 0.999 ? <GlowPoint position={head} size={1.6} color={COLORS.green} intensity={1.1} /> : null}
				<pointLight position={[head[0] * 1.08, head[1] * 1.08, 0.3]} intensity={9 * ramp(f, 8, 30)} distance={4.5} color={COLORS.green} />
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={30} outAt={136} bottom={1660} />
		</AbsoluteFill>
	);
};
