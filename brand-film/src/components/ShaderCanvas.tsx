import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, useVideoConfig} from 'remotion';

export type UniformValue = number | readonly number[];

type Props = {
	/** GLSL ES 3.00 fragment shader body. Receives `vec2 vUv` and must write `outColor`. */
	frag: string;
	uniforms: Record<string, UniformValue>;
	/** Image textures, sampled as `sampler2D` uniforms with the same name. */
	textures?: Record<string, string>;
	width?: number;
	height?: number;
	style?: React.CSSProperties;
};

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
	vUv = aPos * 0.5 + 0.5;
	gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
`;

type GLState = {
	gl: WebGL2RenderingContext;
	program: WebGLProgram;
	locations: Map<string, WebGLUniformLocation | null>;
	textures: Map<string, WebGLTexture>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		const numbered = src
			.split('\n')
			.map((l, i) => `${i + 1}: ${l}`)
			.join('\n');
		throw new Error(`Shader compile error: ${log}\n${numbered}`);
	}
	return shader;
};

const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Could not load texture ${src}`));
		img.src = src;
	});

/**
 * Full-frame fragment shader, redrawn synchronously for every Remotion frame.
 * All animation must come in through `uniforms`, so any frame can be rendered
 * in isolation (no clocks, no accumulated state).
 */
export const ShaderCanvas: React.FC<Props> = ({frag, uniforms, textures, width, height, style}) => {
	const {width: compW, height: compH} = useVideoConfig();
	const w = width ?? compW;
	const h = height ?? compH;
	const canvas = useRef<HTMLCanvasElement>(null);
	const state = useRef<GLState | null>(null);
	const [ready, setReady] = useState(!textures || Object.keys(textures).length === 0);
	const [handle] = useState(() => delayRender('ShaderCanvas init'));

	useLayoutEffect(() => {
		const c = canvas.current!;
		const gl = c.getContext('webgl2', {
			preserveDrawingBuffer: true,
			premultipliedAlpha: true,
			antialias: false,
			alpha: true,
		});
		if (!gl) {
			throw new Error('WebGL2 is not available');
		}
		const program = gl.createProgram()!;
		gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, HEADER + frag));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(program, 'aPos');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		state.current = {gl, program, locations: new Map(), textures: new Map()};

		const entries = Object.entries(textures ?? {});
		if (entries.length === 0) {
			continueRender(handle);
			return;
		}
		Promise.all(entries.map(([, src]) => loadImage(src)))
			.then((imgs) => {
				imgs.forEach((img, i) => {
					const tex = gl.createTexture()!;
					gl.bindTexture(gl.TEXTURE_2D, tex);
					gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
					gl.generateMipmap(gl.TEXTURE_2D);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					state.current!.textures.set(entries[i][0], tex);
				});
				setReady(true);
				continueRender(handle);
			})
			.catch((err) => {
				throw err;
			});
		// The program lives as long as the canvas.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useLayoutEffect(() => {
		const s = state.current;
		if (!s || !ready) {
			return;
		}
		const {gl, program, locations} = s;
		const u = (name: string) => {
			if (!locations.has(name)) {
				locations.set(name, gl.getUniformLocation(program, name));
			}
			return locations.get(name)!;
		};
		gl.viewport(0, 0, w, h);
		gl.uniform2f(u('uRes'), w, h);
		for (const [name, value] of Object.entries(uniforms)) {
			const l = u(name);
			if (l === null) {
				continue;
			}
			if (typeof value === 'number') {
				gl.uniform1f(l, value);
			} else if (value.length === 2) {
				gl.uniform2fv(l, value as number[]);
			} else if (value.length === 3) {
				gl.uniform3fv(l, value as number[]);
			} else if (value.length === 4) {
				gl.uniform4fv(l, value as number[]);
			} else {
				gl.uniform1fv(l, value as number[]);
			}
		}
		let unit = 0;
		for (const [name, tex] of s.textures) {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.uniform1i(u(name), unit);
			unit++;
		}
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	});

	return (
		<canvas
			ref={canvas}
			width={w}
			height={h}
			style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}}
		/>
	);
};
