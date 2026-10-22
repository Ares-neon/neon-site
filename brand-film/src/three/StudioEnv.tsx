import {useThree} from '@react-three/fiber';
import {useLayoutEffect} from 'react';
import * as THREE from 'three';

export type Panel = {
	/** Centre of the light panel in world units (scene is a 20-unit room). */
	position: [number, number, number];
	size: [number, number];
	color?: string;
	intensity?: number;
};

/**
 * Builds a reflection environment out of emissive "softbox" panels in a black
 * room and pre-filters it (PMREM). Gives glossy materials studio-style
 * highlights without any image asset.
 */
export const StudioEnv: React.FC<{panels: Panel[]; intensity?: number}> = ({panels, intensity = 1}) => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);

	useLayoutEffect(() => {
		const envScene = new THREE.Scene();
		envScene.background = new THREE.Color(0x000000);
		const meshes: THREE.Mesh[] = [];
		for (const p of panels) {
			const geo = new THREE.PlaneGeometry(p.size[0], p.size[1]);
			const mat = new THREE.MeshBasicMaterial({
				color: new THREE.Color(p.color ?? '#ffffff').multiplyScalar(p.intensity ?? 1),
				side: THREE.DoubleSide,
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(...p.position);
			mesh.lookAt(0, 0, 0);
			envScene.add(mesh);
			meshes.push(mesh);
		}
		const pmrem = new THREE.PMREMGenerator(gl);
		const rt = pmrem.fromScene(envScene, 0.02);
		scene.environment = rt.texture;
		scene.environmentIntensity = intensity;
		return () => {
			scene.environment = null;
			rt.dispose();
			pmrem.dispose();
			meshes.forEach((m) => {
				m.geometry.dispose();
				(m.material as THREE.Material).dispose();
			});
		};
		// Panels are static per scene.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gl, scene]);

	useLayoutEffect(() => {
		scene.environmentIntensity = intensity;
	}, [scene, intensity]);

	return null;
};

/** Sets the R3F default camera from props every frame. */
export const CameraRig: React.FC<{
	position: [number, number, number];
	target: [number, number, number];
	fov?: number;
	roll?: number;
	near?: number;
	far?: number;
}> = ({position, target, fov = 30, roll = 0, near = 0.1, far = 400}) => {
	const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
	useLayoutEffect(() => {
		camera.position.set(...position);
		camera.up.set(Math.sin(roll), Math.cos(roll), 0);
		camera.lookAt(...target);
		camera.fov = fov;
		camera.near = near;
		camera.far = far;
		camera.updateProjectionMatrix();
	});
	return null;
};

/** Exposure / tone mapping control. */
export const Exposure: React.FC<{value: number}> = ({value}) => {
	const gl = useThree((s) => s.gl);
	useLayoutEffect(() => {
		gl.toneMapping = THREE.ACESFilmicToneMapping;
		gl.toneMappingExposure = value;
	});
	return null;
};
