/**
 * The simulation curriculum, drawn as one schemd schematic.
 *
 * Each laboratory is the part that stands for it — a capacitor for the RC
 * filter, an inductor for the buck converter, a CNOT for teleportation — and
 * each prerequisite is a wire from the lab it builds on. A root lab (one with no
 * prerequisite) starts a track; its dependants branch off it. The source is
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
}

const EMBLEMS: Readonly<Record<string, Emblem>> = {
	adder: { kind: 'adder', label: 'Adder', input: 'in1', output: 'out1' },
	statechart: { kind: 'counter', label: 'State machine', input: 'in1', output: 'out1' },
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
	grover: { kind: 'phase', label: 'Grover search', input: 'in', output: 'out' }
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

const ROW_PITCH = 180;
const CHILD_PITCH = 240;
const FIRST_ROW = 130;

let cached: CurriculumMap | null | undefined;

/**
 * Compile the map once per process. Returns `null` when the curriculum cannot
 * be drawn (an emblem's ports disagree with a new lab, say); the catalogue's
 * list still carries every lab, so the page degrades rather than fails.
 */
export function curriculumMap(environments: readonly SimEnvironment[]): CurriculumMap | null {
	if (cached !== undefined) return cached;
	const byOrder = [...environments].sort((a, b) => a.curriculum.order - b.curriculum.order);
	const roots = byOrder.filter((environment) => environment.curriculum.prerequisites.length === 0);
	const nodes: Record<string, string> = {};
	const tracks: Record<string, string> = {};
	const parts: string[] = [];
	const wires: string[] = [];
	let widest = 1;

	roots.forEach((root, row) => {
		const y = FIRST_ROW + row * ROW_PITCH;
		const style = trackStyle(root.domain);
		const rootEmblem = emblemFor(root);
		const rootNode = `L${root.index}`;
		nodes[root.id] = rootNode;
		tracks[root.id] = root.id;
		parts.push(
			`${rootEmblem.kind}:${rootNode} "${rootEmblem.label}" at (130, ${y}) #${style.color}${rootEmblem.options ? ` ${rootEmblem.options}` : ''}`
		);
		const children = byOrder.filter(
			(environment) => environment.curriculum.prerequisites[0] === root.id
		);
		widest = Math.max(widest, children.length);
		children.forEach((child, index) => {
			const emblem = emblemFor(child);
			const node = `L${child.index}`;
			nodes[child.id] = node;
			tracks[child.id] = root.id;
			/* Alternate above and below the track, so every branch has its own lane. */
			const childY = y + (index % 2 === 0 ? -40 : 40);
			parts.push(
				`${emblem.kind}:${node} "${emblem.label}" at (${470 + index * CHILD_PITCH}, ${childY}) #${style.color}${emblem.options ? ` ${emblem.options}` : ''}`
			);
			wires.push(
				`${rootNode}.${rootEmblem.output} -> ${node}.${emblem.input} #${style.color} [ortho${style.domain ? ` ${style.domain}` : ''}]`
			);
		});
	});

	const width = 470 + (widest - 1) * CHILD_PITCH + 240;
	const height = FIRST_ROW + (roots.length - 1) * ROW_PITCH + 130;
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
