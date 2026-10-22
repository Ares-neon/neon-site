import type React from 'react';
import {SCENE_META, type SceneMeta} from '../timeline';
import {S01Abertura} from './S01Abertura';
import {S02NovoOlhar} from './S02NovoOlhar';
import {S03Ideias} from './S03Ideias';
import {S04Estrategia} from './S04Estrategia';
import {S05Criatividade} from './S05Criatividade';
import {S06Pessoas} from './S06Pessoas';
import {S07Processo} from './S07Processo';
import {S08Movimento} from './S08Movimento';
import {S09Construcao} from './S09Construcao';
import {S10Relevancia} from './S10Relevancia';
import {S11Conexoes} from './S11Conexoes';
import {S12Parceria} from './S12Parceria';
import {S13Identidade} from './S13Identidade';
import {S14Resultados} from './S14Resultados';
import {S15Crescimento} from './S15Crescimento';
import {S16Impacto} from './S16Impacto';
import {S17Alcance} from './S17Alcance';
import {S18Marca} from './S18Marca';
import {S19Manifesto} from './S19Manifesto';
import {S20Encerramento} from './S20Encerramento';
import type {SceneProps} from './types';

const COMPONENTS: Record<string, React.FC<SceneProps>> = {
	S01: S01Abertura,
	S02: S02NovoOlhar,
	S03: S03Ideias,
	S04: S04Estrategia,
	S05: S05Criatividade,
	S06: S06Pessoas,
	S07: S07Processo,
	S08: S08Movimento,
	S09: S09Construcao,
	S10: S10Relevancia,
	S11: S11Conexoes,
	S12: S12Parceria,
	S13: S13Identidade,
	S14: S14Resultados,
	S15: S15Crescimento,
	S16: S16Impacto,
	S17: S17Alcance,
	S18: S18Marca,
	S19: S19Manifesto,
	S20: S20Encerramento,
};

export type SceneEntry = SceneMeta & {Component: React.FC<SceneProps>};

export const SCENES: SceneEntry[] = SCENE_META.map((m) => {
	const Component = COMPONENTS[m.id];
	if (!Component) {
		throw new Error(`No component for scene ${m.id}`);
	}
	return {...m, Component};
});
