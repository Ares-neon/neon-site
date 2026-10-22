import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../components/ShaderCanvas';

const FRAG = `
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }
void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float fib = fbm(vec2(a*12.0, r*40.0 - uTime));
  vec3 col = vec3(fib) * smoothstep(0.32, 0.1, r) * smoothstep(0.05, 0.08, r);
  outColor = vec4(col, 1.0);
}`;

export const GLTest: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{backgroundColor: '#050505'}}>
			<ShaderCanvas frag={FRAG} uniforms={{uTime: frame / 60}} />
			<ThreeCanvas width={1080} height={1920} style={{position: 'absolute', inset: 0}} gl={{antialias: true}} camera={{position: [0, 0, 6], fov: 35}}>
				<ambientLight intensity={0.2} />
				<directionalLight position={[3, 4, 5]} intensity={2.5} />
				<mesh rotation={[0.4, frame / 40, 0]} position={[0, -2, 0]}>
					<boxGeometry args={[1.2, 1.2, 1.2]} />
					<meshStandardMaterial color="#202020" roughness={0.35} metalness={0.1} />
				</mesh>
			</ThreeCanvas>
		</AbsoluteFill>
	);
};
