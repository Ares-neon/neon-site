import * as THREE from 'three';
import {fbm3} from '../lib/noise';

const cache = new Map<string, THREE.DataTexture>();

/**
 * Tileable grey noise (fbm sampled on a torus), used as roughness / bump map
 * for concrete, stone and paper surfaces. Generated once per page.
 */
export const noiseTexture = (size = 256, freq = 4, octaves = 5, seed = 0, contrast = 1): THREE.DataTexture => {
	const key = `${size}:${freq}:${octaves}:${seed}:${contrast}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const data = new Uint8Array(size * size * 4);
	const R = freq / (2 * Math.PI);
	for (let y = 0; y < size; y++) {
		const a = (y / size) * Math.PI * 2;
		for (let x = 0; x < size; x++) {
			const b = (x / size) * Math.PI * 2;
			// Torus mapping keeps the texture seamless in both directions.
			const n = fbm3(R * Math.cos(b) + seed, R * Math.sin(b) + R * Math.cos(a), R * Math.sin(a) - seed, octaves);
			const v = Math.max(0, Math.min(255, Math.round((0.5 + 0.5 * n * contrast) * 255)));
			const k = (y * size + x) * 4;
			data[k] = data[k + 1] = data[k + 2] = v;
			data[k + 3] = 255;
		}
	}
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.generateMipmaps = true;
	tex.needsUpdate = true;
	cache.set(key, tex);
	return tex;
};
