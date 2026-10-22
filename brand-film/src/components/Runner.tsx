/**
 * Side-view running figure built from a 2D skeleton. Joint angles follow
 * published sagittal-plane running kinematics (thigh, knee, foot, arm swing),
 * keyed every 10% of the gait cycle and interpolated with periodic
 * Catmull-Rom splines. Output is SVG path data in body-height units
 * (ground at y = 0, up is negative y, facing +x).
 */

type Pt = [number, number];

// Right leg; the left leg is the same curve half a cycle later.
// p = 0 is initial contact. Degrees: thigh/foot forward-positive, knee flexion.
const THIGH = [27, 12, -4, -20, -26, -12, 14, 38, 54, 44];
const KNEE = [18, 38, 32, 16, 32, 78, 116, 104, 64, 24];
const FOOT = [8, 0, -6, -32, -46, -32, -10, 5, 10, 10];

const L = {
	thigh: 0.245,
	shin: 0.246,
	torso: 0.29,
	upperArm: 0.168,
	forearm: 0.148,
};

const deg = Math.PI / 180;

const periodic = (keys: number[], p: number) => {
	const n = keys.length;
	const x = (((p % 1) + 1) % 1) * n;
	const i = Math.floor(x);
	const t = x - i;
	const p0 = keys[(i - 1 + n) % n];
	const p1 = keys[i % n];
	const p2 = keys[(i + 1) % n];
	const p3 = keys[(i + 2) % n];
	const t2 = t * t;
	const t3 = t2 * t;
	return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

const along = (o: Pt, angleDeg: number, len: number): Pt => [o[0] + Math.sin(angleDeg * deg) * len, o[1] + Math.cos(angleDeg * deg) * len];

const f3 = (n: number) => n.toFixed(4);

/** Tapered capsule between A (radius ra) and B (radius rb). */
const capsule = (a: Pt, b: Pt, ra: number, rb: number) => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const len = Math.max(Math.hypot(dx, dy), 1e-6);
	const phi = Math.atan2(dy, dx);
	const th = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / len)));
	const a1: Pt = [a[0] + ra * Math.cos(phi + th), a[1] + ra * Math.sin(phi + th)];
	const b1: Pt = [b[0] + rb * Math.cos(phi + th), b[1] + rb * Math.sin(phi + th)];
	const b2: Pt = [b[0] + rb * Math.cos(phi - th), b[1] + rb * Math.sin(phi - th)];
	const a2: Pt = [a[0] + ra * Math.cos(phi - th), a[1] + ra * Math.sin(phi - th)];
	return (
		`M${f3(a1[0])} ${f3(a1[1])}L${f3(b1[0])} ${f3(b1[1])}` +
		`A${f3(rb)} ${f3(rb)} 0 0 0 ${f3(b2[0])} ${f3(b2[1])}` +
		`L${f3(a2[0])} ${f3(a2[1])}` +
		`A${f3(ra)} ${f3(ra)} 0 1 0 ${f3(a1[0])} ${f3(a1[1])}Z`
	);
};

/** Smooth closed path through points (Catmull-Rom to cubic Bezier). */
const smoothClosed = (pts: Pt[]) => {
	const n = pts.length;
	let d = `M${f3(pts[0][0])} ${f3(pts[0][1])}`;
	for (let i = 0; i < n; i++) {
		const p0 = pts[(i - 1 + n) % n];
		const p1 = pts[i];
		const p2 = pts[(i + 1) % n];
		const p3 = pts[(i + 2) % n];
		const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += `C${f3(c1[0])} ${f3(c1[1])} ${f3(c2[0])} ${f3(c2[1])} ${f3(p2[0])} ${f3(p2[1])}`;
	}
	return d + 'Z';
};

const transform = (pts: Pt[], origin: Pt, angleDeg: number): Pt[] => {
	const c = Math.cos(angleDeg * deg);
	const s = Math.sin(angleDeg * deg);
	return pts.map(([x, y]) => [origin[0] + x * c - y * s, origin[1] + x * s + y * c]);
};

type Leg = {hip: Pt; knee: Pt; ankle: Pt; footAngle: number; lowest: number};

const leg = (hip: Pt, p: number): Leg => {
	const th = periodic(THIGH, p);
	const kn = periodic(KNEE, p);
	const fo = periodic(FOOT, p);
	const knee = along(hip, th, L.thigh);
	const ankle = along(knee, th - kn, L.shin);
	// Foot outline in foot space (x forward, y down), ankle at origin.
	const sole: Pt[] = [
		[-0.042, 0.036],
		[0.118, 0.042],
	];
	const solePts = transform(sole, ankle, -fo);
	const lowest = Math.max(solePts[0][1], solePts[1][1]);
	return {hip, knee, ankle, footAngle: fo, lowest};
};

const legPaths = (lg: Leg) => {
	const {hip, knee, ankle, footAngle} = lg;
	// Calf bulge: a point a third of the way down the shin, pushed backwards.
	const sx = ankle[0] - knee[0];
	const sy = ankle[1] - knee[1];
	const sl = Math.hypot(sx, sy);
	const nx = -sy / sl;
	const ny = sx / sl;
	const calf: Pt = [knee[0] + sx * 0.32 - nx * 0.012, knee[1] + sy * 0.32 - ny * 0.012];
	const foot = transform(
		[
			[-0.046, 0.016],
			[-0.03, 0.04],
			[0.06, 0.042],
			[0.12, 0.04],
			[0.122, 0.026],
			[0.07, 0.012],
			[0.018, -0.012],
			[-0.02, -0.018],
		],
		ankle,
		-footAngle,
	);
	return [
		capsule(hip, knee, 0.066, 0.042),
		capsule(knee, calf, 0.041, 0.044),
		capsule(calf, ankle, 0.043, 0.024),
		smoothClosed(foot),
	];
};

const armPaths = (shoulder: Pt, p: number) => {
	// Arm swing mirrors the opposite leg: forward when the same-side leg is back.
	const a = -32 * Math.cos(2 * Math.PI * p) + 6;
	const e = 88 + 14 * Math.cos(2 * Math.PI * (p - 0.5));
	const elbow = along(shoulder, a, L.upperArm);
	const wrist = along(elbow, a + e, L.forearm);
	const hand = along(wrist, a + e + 10, 0.03);
	return [capsule(shoulder, elbow, 0.036, 0.027), capsule(elbow, wrist, 0.027, 0.02), capsule(wrist, hand, 0.022, 0.024)];
};

/** All body parts for a phase of the gait cycle (0..1, right foot contact at 0). */
export const runnerPaths = (p: number): string[] => {
	const lean = 12 + 1.5 * Math.sin(4 * Math.PI * p);
	// Pelvis: lowest at mid-stance, highest in flight.
	const bob = 0.506 + 0.019 * Math.cos((2 * Math.PI * (p - 0.42)) / 0.5);
	let hip: Pt = [0, -bob];
	let right = leg(hip, p);
	let left = leg(hip, p + 0.5);
	// Keep the stance foot on the ground, faded in and out over the stance.
	const stanceW = (q: number) => {
		const x = ((q % 1) + 1) % 1;
		return x < 0.36 ? Math.sin((x / 0.36) * Math.PI) : 0;
	};
	const wr = stanceW(p);
	const wl = stanceW(p + 0.5);
	let dy = wr + wl > 0 ? (-(wr * right.lowest + wl * left.lowest) / (wr + wl)) * Math.max(wr, wl) : 0;
	// Never let a foot sink below the ground.
	const sink = Math.max(right.lowest, left.lowest) + dy;
	if (sink > 0) dy -= sink;
	hip = [0, hip[1] + dy];
	right = leg(hip, p);
	left = leg(hip, p + 0.5);

	const shoulder = along(hip, 180 - lean, L.torso);
	// Torso outline in torso space (u up the spine, v forward), then placed.
	const torsoLocal: Pt[] = [
		[0.0, 0.075],
		[0.12, 0.062],
		[0.3, 0.058],
		[0.55, 0.078],
		[0.78, 0.074],
		[0.97, 0.05],
		[1.04, 0.0],
		[0.97, -0.052],
		[0.72, -0.07],
		[0.42, -0.058],
		[0.18, -0.07],
		[0.02, -0.088],
		[-0.06, -0.04],
		[-0.06, 0.04],
	];
	const ux = shoulder[0] - hip[0];
	const uy = shoulder[1] - hip[1];
	const ul = Math.hypot(ux, uy);
	const ex: Pt = [ux / ul, uy / ul];
	const fwd: Pt = [-ex[1], ex[0]];
	const fwdSign = fwd[0] >= 0 ? 1 : -1;
	const torso = torsoLocal.map(([u, v]): Pt => [hip[0] + ex[0] * u * ul + fwd[0] * v * fwdSign, hip[1] + ex[1] * u * ul + fwd[1] * v * fwdSign]);

	const neckBase: Pt = [shoulder[0] + 0.012, shoulder[1] + 0.01];
	const headC: Pt = along(shoulder, 180 - lean + 4, 0.115);
	headC[0] += 0.014;
	const headLocal: Pt[] = [
		[-0.056, 0.0],
		[-0.05, -0.045],
		[-0.012, -0.072],
		[0.03, -0.066],
		[0.056, -0.036],
		[0.06, -0.01],
		[0.067, 0.008],
		[0.06, 0.018],
		[0.058, 0.036],
		[0.044, 0.056],
		[0.018, 0.062],
		[-0.012, 0.052],
		[-0.046, 0.036],
	];
	const head = transform(headLocal, headC, 4);

	return [
		...armPaths(shoulder, p + 0.5), // far arm
		...legPaths(left),
		smoothClosed(torso),
		capsule(neckBase, headC, 0.034, 0.03),
		smoothClosed(head),
		...legPaths(right),
		...armPaths(shoulder, p), // near arm
	];
};
