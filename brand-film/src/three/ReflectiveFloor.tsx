import {useFrame, useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {noiseTexture} from './textures';

type Props = {
	size?: number;
	color?: string;
	roughness?: number;
	/** Strength of the mirrored image. */
	reflectivity?: number;
	/** Blur radius of the reflection in screen-space UV units. */
	blur?: number;
	/** Reflection render-target scale relative to the canvas. */
	resolution?: number;
	/** Repeat of the concrete noise used for roughness / distortion. */
	textureRepeat?: number;
	/** Scale of the noise distortion of the reflected image (0 = clean mirror). */
	distortion?: number;
};

/**
 * Polished concrete floor at y = 0 with a real planar reflection: the scene is
 * re-rendered from a mirrored camera every frame (same maths as three's
 * Reflector) and blended into a MeshStandardMaterial with a blurred, slightly
 * distorted lookup and a Fresnel falloff. Lights still act on the floor.
 */
export const ReflectiveFloor: React.FC<Props> = ({
	size = 200,
	color = '#0b0b0b',
	roughness = 0.35,
	reflectivity = 0.6,
	blur = 0.006,
	resolution = 0.5,
	textureRepeat = 18,
	distortion = 1,
}) => {
	const gl = useThree((s) => s.gl);
	const canvasSize = useThree((s) => s.size);
	const mesh = useRef<THREE.Mesh>(null);

	const {rt, virtualCamera, textureMatrix, material} = useMemo(() => {
		const rt = new THREE.WebGLRenderTarget(
			Math.round(canvasSize.width * resolution),
			Math.round(canvasSize.height * resolution),
			{type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace},
		);
		const virtualCamera = new THREE.PerspectiveCamera();
		const textureMatrix = new THREE.Matrix4();
		const tex = noiseTexture(256, 8, 5, 11.3, 1.3);
		tex.repeat.set(textureRepeat, textureRepeat);
		const material = new THREE.MeshStandardMaterial({color, roughness, metalness: 0, roughnessMap: tex, bumpMap: tex, bumpScale: 0.35});
		const uniforms = {
			uRefl: {value: rt.texture},
			uTexMatrix: {value: textureMatrix},
			uReflectivity: {value: reflectivity},
			uBlur: {value: blur},
			uNoise: {value: tex},
			uRepeat: {value: textureRepeat},
			uDistort: {value: distortion},
		};
		material.onBeforeCompile = (shader) => {
			Object.assign(shader.uniforms, uniforms);
			shader.vertexShader = shader.vertexShader
				.replace('#include <common>', '#include <common>\nuniform mat4 uTexMatrix;\nvarying vec4 vReflUv;\nvarying vec2 vFloorUv;')
				.replace('#include <project_vertex>', '#include <project_vertex>\nvReflUv = uTexMatrix * vec4(transformed, 1.0);\nvFloorUv = uv;');
			shader.fragmentShader = shader.fragmentShader
				.replace(
					'#include <common>',
					`#include <common>
uniform sampler2D uRefl;
uniform sampler2D uNoise;
uniform float uReflectivity;
uniform float uBlur;
uniform float uRepeat;
uniform float uDistort;
varying vec4 vReflUv;
varying vec2 vFloorUv;
vec3 sampleRefl(vec2 uv, float r) {
	vec3 acc = vec3(0.0);
	const int N = 12;
	for (int i = 0; i < N; i++) {
		float a = float(i) * 2.39996;
		float d = sqrt((float(i) + 0.5) / float(N)) * r;
		acc += texture2D(uRefl, uv + vec2(cos(a), sin(a) * 0.55) * d).rgb;
	}
	return acc / float(N);
}`,
				)
				.replace(
					'#include <opaque_fragment>',
					`{
	vec2 ruv = vReflUv.xy / vReflUv.w;
	float n = texture2D(uNoise, vFloorUv * uRepeat).r;
	ruv += (n - 0.5) * vec2(0.002, 0.006) * uDistort;
	vec3 refl = sampleRefl(ruv, uBlur * (0.6 + n));
	vec3 V = normalize(vViewPosition);
	float fres = 0.25 + 0.75 * pow(1.0 - abs(dot(normalize(normal), -V)), 4.0);
	outgoingLight += refl * uReflectivity * fres * (1.0 + (0.3 * n - 0.15) * uDistort);
}
#include <opaque_fragment>`,
				);
		};
		return {rt, virtualCamera, textureMatrix, material};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useLayoutEffect(
		() => () => {
			rt.dispose();
			material.dispose();
		},
		[rt, material],
	);

	useLayoutEffect(() => {
		material.color.set(color);
		material.roughness = roughness;
	});

	const tmp = useMemo(
		() => ({
			plane: new THREE.Plane(),
			normal: new THREE.Vector3(),
			reflectorPos: new THREE.Vector3(),
			cameraPos: new THREE.Vector3(),
			rot: new THREE.Matrix4(),
			lookAt: new THREE.Vector3(),
			target: new THREE.Vector3(),
			view: new THREE.Vector3(),
			clip: new THREE.Vector4(),
			q: new THREE.Vector4(),
		}),
		[],
	);

	useFrame(({scene, camera}) => {
		const floor = mesh.current;
		if (!floor) return;
		const {normal, reflectorPos, cameraPos, rot, lookAt, target, view, plane, clip, q} = tmp;
		floor.updateMatrixWorld();
		reflectorPos.setFromMatrixPosition(floor.matrixWorld);
		cameraPos.setFromMatrixPosition(camera.matrixWorld);
		rot.extractRotation(floor.matrixWorld);
		normal.set(0, 0, 1).applyMatrix4(rot);
		view.subVectors(reflectorPos, cameraPos);
		if (view.dot(normal) > 0) return;
		view.reflect(normal).negate().add(reflectorPos);
		rot.extractRotation(camera.matrixWorld);
		lookAt.set(0, 0, -1).applyMatrix4(rot).add(cameraPos);
		target.subVectors(reflectorPos, lookAt).reflect(normal).negate().add(reflectorPos);
		virtualCamera.position.copy(view);
		virtualCamera.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
		virtualCamera.lookAt(target);
		virtualCamera.far = (camera as THREE.PerspectiveCamera).far;
		virtualCamera.updateMatrixWorld();
		virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
		textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
		textureMatrix.multiply(virtualCamera.projectionMatrix).multiply(virtualCamera.matrixWorldInverse).multiply(floor.matrixWorld);
		plane.setFromNormalAndCoplanarPoint(normal, reflectorPos).applyMatrix4(virtualCamera.matrixWorldInverse);
		clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
		const pm = virtualCamera.projectionMatrix.elements;
		q.x = (Math.sign(clip.x) + pm[8]) / pm[0];
		q.y = (Math.sign(clip.y) + pm[9]) / pm[5];
		q.z = -1.0;
		q.w = (1.0 + pm[10]) / pm[14];
		clip.multiplyScalar(2.0 / clip.dot(q));
		pm[2] = clip.x;
		pm[6] = clip.y;
		pm[10] = clip.z + 1.0;
		pm[14] = clip.w;

		floor.visible = false;
		const prevTarget = gl.getRenderTarget();
		const prevToneMapping = gl.toneMapping;
		gl.toneMapping = THREE.NoToneMapping;
		gl.setRenderTarget(rt);
		gl.clear();
		gl.render(scene, virtualCamera);
		gl.setRenderTarget(prevTarget);
		gl.toneMapping = prevToneMapping;
		floor.visible = true;
	});

	return (
		<mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow>
			<planeGeometry args={[size, size]} />
		</mesh>
	);
};
