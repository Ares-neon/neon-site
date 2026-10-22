import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {simplex3} from '../lib/noise';

export type Vec3 = [number, number, number];

export type SilkMotion = {
	/** Centre line of the ribbon, s in [-0.5, 0.5] along its length, t in seconds. */
	path: (s: number, t: number) => Vec3;
	/** Rotation of the cross-section around the centre line (radians). */
	twist: (s: number, t: number) => number;
	/** Width of the ribbon at s (world units). */
	width: (s: number, t: number) => number;
	/** Cupping of the cross-section (positive bends edges towards the normal). */
	cup?: (s: number, t: number) => number;
	/** Edge ripples. */
	flutter?: {amp: number; freq: number; speed: number; seed?: number};
};

type Props = {
	t: number;
	motion: SilkMotion;
	segU?: number;
	segV?: number;
	children?: React.ReactNode; // material
	castShadow?: boolean;
	receiveShadow?: boolean;
	position?: Vec3;
	rotation?: Vec3;
	renderOrder?: number;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
	const l = Math.hypot(a[0], a[1], a[2]) || 1;
	return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * A satin ribbon whose shape is a pure function of time: a centre curve with a
 * parallel-transported frame, a twisting cross-section, cupping and edge
 * flutter. Re-evaluated from scratch every frame (no simulation state), so
 * any frame renders identically in isolation.
 */
export const Silk: React.FC<Props> = ({
	t,
	motion,
	segU = 360,
	segV = 48,
	children,
	castShadow,
	receiveShadow,
	position,
	rotation,
	renderOrder,
}) => {
	const geometry = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const nu = segU + 1;
		const nv = segV + 1;
		const pos = new Float32Array(nu * nv * 3);
		const uv = new Float32Array(nu * nv * 2);
		const idx: number[] = [];
		for (let i = 0; i < nu; i++) {
			for (let j = 0; j < nv; j++) {
				const k = i * nv + j;
				uv[k * 2] = i / segU;
				uv[k * 2 + 1] = j / segV;
				if (i < segU && j < segV) {
					const a = k;
					const b = k + nv;
					idx.push(a, b, a + 1, b, b + 1, a + 1);
				}
			}
		}
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
		g.setIndex(idx);
		return g;
	}, [segU, segV]);

	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	useLayoutEffect(() => {
		const nu = segU + 1;
		const nv = segV + 1;
		const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
		const arr = pos.array as Float32Array;
		const ds = 1 / segU;
		const fl = motion.flutter;
		let prevN: Vec3 | null = null;
		for (let i = 0; i < nu; i++) {
			const s = i / segU - 0.5;
			const c = motion.path(s, t);
			const tan = norm(sub(motion.path(s + ds * 0.5, t), motion.path(s - ds * 0.5, t)));
			let n: Vec3;
			if (!prevN) {
				const ref: Vec3 = Math.abs(tan[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
				n = norm(cross(cross(tan, ref), tan));
			} else {
				const d = dot(prevN, tan);
				n = norm([prevN[0] - d * tan[0], prevN[1] - d * tan[1], prevN[2] - d * tan[2]]);
			}
			prevN = n;
			const b = cross(tan, n);
			const th = motion.twist(s, t);
			const ct = Math.cos(th);
			const st = Math.sin(th);
			const across: Vec3 = [ct * n[0] + st * b[0], ct * n[1] + st * b[1], ct * n[2] + st * b[2]];
			const surfN = norm(cross(tan, across));
			const w = motion.width(s, t);
			const cup = motion.cup ? motion.cup(s, t) : 0;
			for (let j = 0; j < nv; j++) {
				const v = j / segV - 0.5;
				let off = cup * v * v * w;
				if (fl) {
					const edge = Math.pow(Math.abs(v * 2), 2.2);
					off +=
						fl.amp * edge * Math.sin((s * fl.freq - t * fl.speed) * Math.PI * 2 + v * 2.1 + (fl.seed ?? 0)) +
						fl.amp * 0.6 * edge * simplex3(s * fl.freq * 0.7, v * 1.3 + (fl.seed ?? 0), t * fl.speed * 0.35);
				}
				const k = (i * nv + j) * 3;
				arr[k] = c[0] + across[0] * v * w + surfN[0] * off;
				arr[k + 1] = c[1] + across[1] * v * w + surfN[1] * off;
				arr[k + 2] = c[2] + across[2] * v * w + surfN[2] * off;
			}
		}
		pos.needsUpdate = true;
		geometry.computeVertexNormals();
		geometry.computeBoundingSphere();
	});

	return (
		<mesh
			geometry={geometry}
			castShadow={castShadow}
			receiveShadow={receiveShadow}
			position={position}
			rotation={rotation}
			renderOrder={renderOrder}
			frustumCulled={false}
		>
			{children}
		</mesh>
	);
};
