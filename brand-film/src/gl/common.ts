/** Shared GLSL helpers for the full-frame shader scenes. */
export const GLSL_COMMON = `
#define PI 3.14159265359
float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
	p3 = fract(p3 * 0.1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
	           mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float vnoise3(vec3 p) {
	vec3 i = floor(p), f = fract(p);
	vec3 u = f * f * (3.0 - 2.0 * f);
	float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
	float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
	return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
	           mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm(vec2 p, int oct) {
	float a = 0.5, s = 0.0, n = 0.0;
	for (int i = 0; i < 8; i++) {
		if (i >= oct) break;
		s += a * vnoise(p);
		n += a;
		p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31;
		a *= 0.5;
	}
	return s / n;
}
float fbm3(vec3 p, int oct) {
	float a = 0.5, s = 0.0, n = 0.0;
	for (int i = 0; i < 8; i++) {
		if (i >= oct) break;
		s += a * vnoise3(p);
		n += a;
		p = p * 2.03 + vec3(3.1, 7.7, 1.3);
		a *= 0.5;
	}
	return s / n;
}
// Filmic tone map (ACES fit, Narkowicz) + display gamma.
vec3 tonemap(vec3 c) {
	c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
	return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
vec3 srgb2lin(vec3 c) { return pow(c, vec3(2.2)); }
// Tone map, lift to the brand black (#050505) and dither against banding.
vec3 finalize(vec3 hdr) {
	vec3 o = tonemap(hdr);
	o = 5.0 / 255.0 + o * (1.0 - 5.0 / 255.0);
	return o + (hash12(gl_FragCoord.xy + fract(uRes.x * 0.37)) - 0.5) / 255.0;
}
float sdBox(vec2 p, vec2 b) {
	vec2 d = abs(p) - b;
	return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
// Pixel coordinates with y down (0..W, 0..H).
vec2 pixelCoord() { return vec2(vUv.x, 1.0 - vUv.y) * uRes; }
`;
