import {GLSL_COMMON} from './common';

// A doorway in a black room, seen from a low camera. The opening starts as a
// hairline and widens; light pools on a polished concrete floor.
export const DOORWAY_FRAG = `${GLSL_COMMON}
uniform vec3 uColor;
uniform float uLineH;
uniform float uWidth;
uniform float uBright;
uniform float uZoom;
uniform float uDrift;
uniform float uBloom;
uniform float uExposure;

const float FPX = 2281.0;
const float CAMH = 0.9;
const float D = 10.0;
const float DOORH = 3.2;
const float YH = 1125.0;
const float CX = 540.0;

void main() {
	vec2 px = pixelCoord();
	vec2 focus = vec2(540.0, 1010.0);
	px = (px - focus) / uZoom + focus + vec2(0.0, uDrift);

	float base = YH + FPX * CAMH / D;
	float top = base - FPX * DOORH / D;
	float mid = 0.5 * (top + base);
	float halfH = 0.5 * (base - top) * uLineH;
	float halfW = max(0.5 * FPX * uWidth / D, 0.8);
	float area = clamp(halfW / 70.0, 0.0, 1.0);

	// The hairline grows from the floor line upward, then the door opens.
	vec2 c = vec2(CX, base - halfH);
	float sd = sdBox(px - c, vec2(halfW, halfH));
	float cover = clamp(0.5 - sd, 0.0, 1.0);

	vec3 col = vec3(0.0);
	// Light beyond the opening: slightly brighter towards the floor.
	float doorL = 7.0 * uBright * mix(0.85, 1.0, smoothstep(top, base, px.y));
	col += cover * doorL;

	// Lens bloom (energy scales with the visible area of the opening).
	float d = max(sd, 0.0);
	float a = uBright * (0.18 + 0.82 * area) * uBloom;
	col += a * (0.50 * exp(-d / 5.0) + 0.20 * exp(-d / 26.0) + 0.065 * exp(-d / 110.0) + 0.018 * exp(-d / 420.0));

	// Floor, below the base line.
	if (px.y > base) {
		float Z = FPX * CAMH / max(px.y - YH, 1.0);
		float X = (px.x - CX) * Z / FPX;
		float dz = max(D - Z, 0.0);
		float hw = 0.5 * uWidth * (1.0 + dz * 0.09) + dz * 0.012;
		float soft = 0.006 + dz * 0.045;
		float pool = smoothstep(hw + soft, hw - soft, abs(X)) * exp(-dz / 3.2) * (0.12 + 0.88 * area);
		float conc = 0.30 + 0.22 * fbm(vec2(X, Z) * 3.0, 5) + 0.10 * (fbm(vec2(X, Z) * 22.0, 3) - 0.5);
		col += vec3(pool * conc * uBright * 0.95);
		// Glossy reflection of the opening, blurring with distance.
		vec2 pr = vec2(px.x, 2.0 * base - px.y);
		float blur = 1.5 + (px.y - base) * 0.11;
		float sdr = sdBox(pr - c, vec2(halfW + blur, halfH));
		float refl = clamp(0.5 - sdr / (1.0 + blur), 0.0, 1.0) * (halfW / (halfW + blur));
		refl += 0.25 * exp(-max(sdr, 0.0) / (8.0 + blur * 2.0)) * (halfW / (halfW + blur));
		col += vec3(refl * uBright * 2.4 * exp(-(px.y - base) / 300.0) * (0.75 + 0.5 * conc));
		// Contact shadow line where wall meets floor.
		col *= mix(1.0, 0.35, exp(-(px.y - base) / 2.0) * (1.0 - cover));
	} else {
		// Faint bounce from the floor onto the wall around the opening.
		vec2 q = (px - vec2(CX, base)) * vec2(1.0, 1.8);
		col += vec3(0.012 * uBright * area * exp(-length(q) / 380.0));
	}

	// Haze in the beam.
	float spread = halfW * 1.3 + 30.0 + max(px.y - base, 0.0) * 0.55;
	float haze = exp(-abs(px.x - CX) / spread) * smoothstep(top - 60.0, base + 40.0, px.y) * smoothstep(1920.0, base, px.y);
	col += vec3(0.035 * uBright * area * haze);

	// Tint by the light colour; an over-exposed core drifts towards white.
	col = col * uColor + max(col - vec3(2.0), 0.0) * 0.08 * (vec3(1.0) - uColor);
	col *= uExposure;
	outColor = vec4(finalize(col), 1.0);
}`;
