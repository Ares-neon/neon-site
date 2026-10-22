/**
 * Scene table. 80 BPM: one beat = 45 frames, one bar = 180 frames = 3 s,
 * so every storyboard scene is exactly one bar of the score and every cut
 * lands on a downbeat. `pre`/`post` are the overlap windows used by the
 * transitions (frames rendered before/after the nominal scene bounds).
 */
export const BEAT = 45;
export const BAR = 180;

export type SceneMeta = {
	id: string;
	name: string;
	start: number;
	dur: number;
	pre: number;
	post: number;
	z: number;
	lines: string[];
};

export const SCENE_META: SceneMeta[] = [
	{id: 'S01', name: 'Abertura', start: 0, dur: 180, pre: 0, post: 14, z: 1, lines: ['TUDO COMEÇA', 'COM UMA IDEIA.']},
	{id: 'S02', name: 'Novo olhar', start: 180, dur: 180, pre: 14, post: 0, z: 2, lines: ['ENXERGAMOS', 'ALÉM.']},
	{id: 'S03', name: 'Ideias', start: 360, dur: 180, pre: 0, post: 30, z: 4, lines: ['IDEIAS', 'GANHAM FORMA.']},
	{id: 'S04', name: 'Estratégia', start: 540, dur: 180, pre: 30, post: 0, z: 3, lines: ['VISÃO SE TORNA', 'DIREÇÃO.']},
	{id: 'S05', name: 'Criatividade', start: 720, dur: 180, pre: 0, post: 16, z: 5, lines: ['CRIATIVIDADE', 'MOVE MARCAS.']},
	{id: 'S06', name: 'Pessoas', start: 900, dur: 180, pre: 16, post: 18, z: 6, lines: ['PESSOAS', 'NO CENTRO.']},
	{id: 'S07', name: 'Processo', start: 1080, dur: 180, pre: 18, post: 10, z: 7, lines: ['NADA ACONTECE', 'POR ACASO.']},
	{id: 'S08', name: 'Movimento', start: 1260, dur: 180, pre: 10, post: 10, z: 8, lines: ['SEMPRE EM', 'MOVIMENTO.']},
	{id: 'S09', name: 'Construção', start: 1440, dur: 180, pre: 10, post: 8, z: 9, lines: ['CONSTRUÍMOS', 'COM PROPÓSITO.']},
	{id: 'S10', name: 'Relevância', start: 1620, dur: 180, pre: 8, post: 14, z: 10, lines: ['NASCEMOS', 'PARA IR ALÉM.']},
	{id: 'S11', name: 'Conexões', start: 1800, dur: 180, pre: 14, post: 26, z: 12, lines: ['CRIAMOS', 'CONEXÕES.']},
	{id: 'S12', name: 'Parceria', start: 1980, dur: 180, pre: 26, post: 12, z: 11, lines: ['JUNTOS, VAMOS', 'MAIS LONGE.']},
	{id: 'S13', name: 'Identidade', start: 2160, dur: 180, pre: 12, post: 28, z: 13, lines: ['IDENTIDADE', 'É ESSÊNCIA.']},
	{id: 'S14', name: 'Resultados', start: 2340, dur: 180, pre: 28, post: 10, z: 14, lines: ['CRIATIVIDADE', 'COM PROPÓSITO.']},
	{id: 'S15', name: 'Crescimento', start: 2520, dur: 180, pre: 10, post: 2, z: 15, lines: ['EVOLUIR', 'É ESSENCIAL.']},
	{id: 'S16', name: 'Impacto', start: 2700, dur: 180, pre: 2, post: 14, z: 16, lines: ['IDEIAS', 'DEIXAM MARCAS.']},
	{id: 'S17', name: 'Alcance', start: 2880, dur: 180, pre: 14, post: 14, z: 17, lines: ['SEM LIMITES.']},
	{id: 'S18', name: 'A marca', start: 3060, dur: 180, pre: 14, post: 20, z: 18, lines: []},
	{id: 'S19', name: 'Manifesto', start: 3240, dur: 240, pre: 20, post: 20, z: 19, lines: ['MARCAS QUE NÃO', 'PASSAM DESPERCEBIDAS.']},
	{id: 'S20', name: 'Encerramento', start: 3480, dur: 120, pre: 20, post: 0, z: 20, lines: []},
];

export const meta = (id: string) => {
	const m = SCENE_META.find((s) => s.id === id);
	if (!m) {
		throw new Error(`Unknown scene ${id}`);
	}
	return m;
};
