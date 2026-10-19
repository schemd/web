/**
 * The simulation curriculum, drawn as one schemd schematic.
 *
 * Each laboratory is the part that stands for it — a capacitor for the RC
 * filter, an inductor for the buck converter, a CNOT for teleportation — and
 * each prerequisite is a wire from the lab it builds on. A root lab (one with no
 * prerequisite) starts a track; its dependants branch off it, and theirs off
 * them, laid out as a tree: depth sets the column, leaves take lanes in
 * depth-first order, and every parent sits centred on its children. The source is
 * written from the curriculum data, so a new lab joins the map without anyone
 * drawing it, and the drawing is compiled by the same compiler the labs use.
 */
import { compileSchematic } from '@schemd/core';
import type { SimEnvironment } from './simulations';

interface Emblem {
	readonly kind: string;
	/** Short label under the part. */
	readonly label: string;
	readonly input: string;
	readonly output: string;
	/** Extra declaration options, such as an IC's pins. */
	readonly options?: string;
	/** Extra lane height for a part taller than the rest. */
	readonly tall?: number;
}

const EMBLEMS: Readonly<Record<string, Emblem>> = {
	adder: { kind: 'adder', label: 'Adder', input: 'in1', output: 'out1' },
	statechart: { kind: 'counter', label: 'State machine', input: 'in1', output: 'out1', tall: 28 },
	lfsr: { kind: 'flipflop', label: 'LFSR', input: 'd', output: 'q' },
	rc: { kind: 'capacitor', label: 'RC filter', input: 'in', output: 'out' },
	timer: {
		kind: 'ic',
		label: '555',
		input: 'trig',
		output: 'q',
		options: '[left="trig" right="q"]'
	},
	buck: { kind: 'inductor', label: 'Buck converter', input: 'in', output: 'out' },
	wien: { kind: 'amplifier', label: 'Wien oscillator', input: 'positive', output: 'out' },
	bell: { kind: 'hadamard', label: 'Bell pair', input: 'in', output: 'out' },
	teleport: { kind: 'cnot', label: 'Teleportation', input: 'in1', output: 'out1' },
	qec: { kind: 'measure', label: 'Error correction', input: 'in', output: 'out' },
	grover: { kind: 'phase', label: 'Grover search', input: 'in', output: 'out' },
	tdr: { kind: 'connector', label: 'Transmission line', input: 'in', output: 'out' },
	pll: {
		kind: 'resonator',
		label: 'PLL',
		input: 'in',
		output: 'out',
		options: '[type=crystal]'
	},
	classd: { kind: 'load', label: 'Class-D', input: 'in', output: 'out', options: '[type=speaker]' },
	pid: { kind: 'load', label: 'PID control', input: 'in', output: 'out', options: '[type=motor]' },
	sigmadelta: {
		kind: 'amplifier',
		label: 'Sigma-delta',
		input: 'positive',
		output: 'out',
		options: '[type=comparator]'
	},
	uart: { kind: 'ic', label: 'UART', input: 'rx', output: 'tx', options: '[left="rx" right="tx"]' },
	kickback: { kind: 'cz', label: 'Phase kickback', input: 'in1', output: 'out1' }
};

/** A lab with no drawn emblem still gets a part: a labelled block. */
function emblemFor(environment: SimEnvironment): Emblem {
	return (
		EMBLEMS[environment.id] ?? {
			kind: 'ic',
			label: environment.index,
			input: 'a',
			output: 'y',
			options: '[left="a" right="y"]'
		}
	);
}

/** Track colour and signal domain, chosen by the root lab's domain. */
function trackStyle(domain: string): { readonly color: string; readonly domain: string } {
	if (/quantum/i.test(domain)) return { color: 'cyan', domain: 'quantum' };
	if (/digital/i.test(domain)) return { color: 'purple', domain: 'digital' };
	return { color: 'amber', domain: '' };
}

export interface CurriculumMap {
	readonly svg: string;
	/** Lab id → the compiled part's `data-node-id`. */
	readonly nodes: Readonly<Record<string, string>>;
	/** Lab id → its track's root lab id, for grouping. */
	readonly tracks: Readonly<Record<string, string>>;
}

const FIRST_COLUMN = 130;
const COLUMN_PITCH = 330;
const LANE_PITCH = 100;
const TRACK_GAP = 44;
const MARGIN = 96;

let cached: CurriculumMap | null | undefined;

/**
 * Compile the map once per process. Returns `null` when the curriculum cannot
 * be drawn (an emblem's ports disagree with a new lab, say); the catalogue's
 * list still carries every lab, so the page degrades rather than fails.
 */
export function curriculumMap(environments: readonly SimEnvironment[]): CurriculumMap | null {
	if (cached !== undefined) return cached;
	const byOrder = [...environments].sort((a, b) => a.curriculum.order - b.curriculum.order);
	const childrenOf = (id: string) =>
		byOrder.filter((environment) => environment.curriculum.prerequisites[0] === id);
	const roots = byOrder.filter((environment) => environment.curriculum.prerequisites.length === 0);
	const nodes: Record<string, string> = {};
	const tracks: Record<string, string> = {};
	const parts: string[] = [];
	const wires: string[] = [];
	let lane = MARGIN;
	let deepest = 0;

	/* Depth-first: a leaf takes the next lane, a parent the middle of its children. */
	function place(
		environment: SimEnvironment,
		depth: number,
		root: SimEnvironment,
		style: ReturnType<typeof trackStyle>
	): number {
		const emblem = emblemFor(environment);
		const node = `L${environment.index}`;
		nodes[environment.id] = node;
		tracks[environment.id] = root.id;
		deepest = Math.max(deepest, depth);
		const children = childrenOf(environment.id);
		let y: number;
		if (children.length === 0) {
			y = lane;
			lane += LANE_PITCH + (emblem.tall ?? 0);
		} else {
			const ys = children.map((child) => place(child, depth + 1, root, style));
			y = (ys[0]! + ys.at(-1)!) / 2;
			for (const child of children) {
				const childEmblem = emblemFor(child);
				wires.push(
					`${node}.${emblem.output} -> L${child.index}.${childEmblem.input} #${style.color} [ortho${style.domain ? ` ${style.domain}` : ''}]`
				);
			}
		}
		parts.push(
			`${emblem.kind}:${node} "${environment.index} · ${emblem.label}" at (${FIRST_COLUMN + depth * COLUMN_PITCH}, ${Math.round(y)}) #${style.color}${emblem.options ? ` ${emblem.options}` : ''}`
		);
		return y;
	}

	roots.forEach((root, index) => {
		if (index > 0) lane += TRACK_GAP;
		place(root, 0, root, trackStyle(root.domain));
	});

	const width = FIRST_COLUMN + deepest * COLUMN_PITCH + 240;
	const height = lane - LANE_PITCH + MARGIN;
	try {
		const { svg } = compileSchematic([...parts, '', ...wires].join('\n'), {
			bounds: { width, height },
			title: 'Simulation curriculum',
			mode: 'full'
		});
		/* Full mode makes every port a focusable button, for labs that probe them.
		   The map's links are its interaction and the drawing is hidden from
		   assistive technology, so its ports must not take focus. */
		const quiet = svg.replaceAll(' tabindex="0"', '').replaceAll(' role="button"', '');
		cached = { svg: quiet, nodes, tracks };
	} catch (error) {
		console.error('The curriculum map could not be compiled:', error);
		cached = null;
	}
	return cached;
}
