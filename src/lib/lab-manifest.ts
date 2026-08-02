/**
 * The `schemd-lab` manifest: a simulation described as data rather than code.
 *
 * Thirteen laboratories were thirteen bespoke Svelte components averaging four
 * hundred lines each, and almost none of that was mathematics — the models in
 * `simulation-models.ts` were already pure and already tested. What was bespoke
 * was the *wiring*: which node lights up, which net carries which level, what a
 * fault switch breaks. That is a data structure, and this is its shape.
 *
 * The split that makes it safe and small:
 *
 * - **A model computes values.** It is code, it is whitelisted by name in
 *   `lab-models.ts`, and it knows nothing about the DOM. It returns a flat map
 *   of named signals.
 * - **A manifest maps values onto a drawing.** It is data, it names signals and
 *   node/net ids, and it can be authored without writing a component.
 *
 * Nothing here is evaluated. `model` is a key into a code-owned registry, never
 * an import path or an expression; `formula` is LaTeX that is rendered and
 * never computed. A manifest that names a model the registry does not hold is
 * rejected at load, not at render — see {@link validateLabManifest}.
 */

/** Visual states a node can carry, mirroring what `@schemd/core` styles. */
export type LabNodeState = 'off' | 'active' | 'degraded';

/**
 * Net levels the compiled SVG understands.
 *
 * Deliberately the same three words `sim-dom` already uses rather than a
 * parallel vocabulary — a manifest that says `high` and a painter that says
 * `high` cannot drift, and there is no mapping table to get wrong.
 */
export type LabNetLevel = 'off' | 'active' | 'high';

/** One control the reader can operate. */
export type LabInput =
	| {
			readonly kind: 'toggle';
			readonly key: string;
			readonly label: string;
			readonly initial?: boolean;
	  }
	| {
			readonly kind: 'slider';
			readonly key: string;
			readonly label: string;
			readonly min: number;
			readonly max: number;
			readonly step: number;
			readonly initial: number;
			readonly unit?: string;
	  }
	| {
			readonly kind: 'number';
			readonly key: string;
			readonly label: string;
			readonly min: number;
			readonly max: number;
			readonly initial: number;
	  };

/** A deliberate defect the reader diagnoses before being told what it is. */
export interface LabFault {
	readonly key: string;
	/** Shown on the switch. Never names the defect — that is the exercise. */
	readonly label: string;
	/** Revealed only after the reader has engaged it. */
	readonly reveal: string;
}

/**
 * One signal painted onto the drawing.
 *
 * `repeat` expands `{i}` in `signal`, `node`, and `wire` over an inclusive
 * range. It is index substitution and nothing else: an eight-bit adder needs
 * eight identical rows, and the alternative was either eight copied entries or
 * an expression language, which is exactly what this schema must not have.
 */
export interface LabBinding {
	readonly signal: string;
	readonly node?: string;
	readonly wire?: string;
	/** How a truthy signal presents. Defaults to `active`. */
	readonly as?: LabNodeState | LabNetLevel;
	/** Signal value at or above which the binding counts as on. Defaults to 1. */
	readonly threshold?: number;
	readonly repeat?: { readonly from: number; readonly to: number };
}

/** One panel in the instrumentation rack. */
export type LabInstrument =
	| { readonly kind: 'scope'; readonly label: string; readonly signal: string }
	| {
			readonly kind: 'readout';
			readonly label: string;
			readonly signal: string;
			readonly format?: 'integer' | 'fixed2' | 'percent';
			readonly unit?: string;
			/** Hold the last settled value while a new causal pass is in flight. */
			readonly latchUntilSettled?: boolean;
	  }
	| {
			readonly kind: 'bits';
			readonly label: string;
			readonly signal: string;
			readonly count: number;
			/**
			 * First index to read, for a family whose ids are not zero-based.
			 *
			 * The LFSR's stages are `Q1`…`Q4` because that is what the drawing
			 * calls them, and a bits panel that always started at zero read `Q0`
			 * — which no model emits — and silently displayed four zeroes beside
			 * a non-zero register value.
			 */
			readonly from?: number;
	  };

/** A complete, self-describing laboratory. */
export interface LabManifest {
	readonly id: string;
	readonly title: string;
	readonly domain: 'electrical' | 'digital' | 'quantum' | 'control' | 'uml';
	/** schemd DSL, compiled in `full` mode so every hook exists. */
	readonly source: string;
	/** LaTeX governing model. Rendered by KaTeX; never evaluated. */
	readonly formula?: string;
	readonly inputs: readonly LabInput[];
	/** Key into the code-owned model registry. Never a path. */
	readonly model: string;
	readonly bindings: readonly LabBinding[];
	readonly faults: readonly LabFault[];
	readonly instruments: readonly LabInstrument[];
}

/** Everything a model is handed for one evaluation. */
export interface LabModelInput {
	readonly inputs: Readonly<Record<string, number>>;
	readonly faults: Readonly<Record<string, boolean>>;
	/** Timeline stage, so a model can reveal a ripple one cell at a time. */
	readonly step: number;
}

/** What a model returns: named values, and nothing that knows about the DOM. */
export interface LabFrame {
	readonly signals: Readonly<Record<string, number>>;
	/** Optional prose the rack shows, already resolved by the model. */
	readonly notes?: readonly string[];
}

/** A whitelisted model: pure, DOM-free, and referenced only by name. */
export type LabModel = (input: LabModelInput) => LabFrame;

/** Substitute `{i}` in a template. The only templating this schema has. */
export function fillIndex(template: string, index: number): string {
	return template.replaceAll('{i}', String(index));
}

/** One binding after `repeat` expansion, with every template resolved. */
export interface ResolvedBinding {
	readonly signal: string;
	readonly node?: string;
	readonly wire?: string;
	readonly as: LabNodeState | LabNetLevel;
	readonly threshold: number;
}

/**
 * Expand every binding to its concrete rows.
 *
 * A `repeat` whose range runs backwards yields nothing rather than throwing:
 * an empty family paints nothing, which is a visible and debuggable outcome,
 * where a thrown error during a paint effect would take the whole lab down.
 */
export function expandBindings(bindings: readonly LabBinding[]): readonly ResolvedBinding[] {
	const rows: ResolvedBinding[] = [];
	for (const binding of bindings) {
		const as = binding.as ?? 'active';
		const threshold = binding.threshold ?? 1;
		if (!binding.repeat) {
			rows.push({
				signal: binding.signal,
				...(binding.node === undefined ? {} : { node: binding.node }),
				...(binding.wire === undefined ? {} : { wire: binding.wire }),
				as,
				threshold
			});
			continue;
		}
		for (let index = binding.repeat.from; index <= binding.repeat.to; index += 1) {
			rows.push({
				signal: fillIndex(binding.signal, index),
				...(binding.node === undefined ? {} : { node: fillIndex(binding.node, index) }),
				...(binding.wire === undefined ? {} : { wire: fillIndex(binding.wire, index) }),
				as,
				threshold
			});
		}
	}
	return rows;
}

/**
 * Reject a manifest that cannot possibly run, naming what is wrong.
 *
 * This is deliberately structural rather than exhaustive. It catches the
 * mistakes an author actually makes — a model that is not registered, a
 * binding that paints nothing, a duplicate control key — and leaves anything
 * requiring a compile or a DOM to the surfaces that have one.
 */
export function validateLabManifest(
	manifest: LabManifest,
	knownModels: readonly string[]
): readonly string[] {
	const problems: string[] = [];
	if (!knownModels.includes(manifest.model)) {
		problems.push(
			`${manifest.id}: model "${manifest.model}" is not registered. Add it to lab-models.ts; a manifest cannot name arbitrary code.`
		);
	}
	if (manifest.source.trim() === '') problems.push(`${manifest.id}: source is empty.`);

	const inputKeys = new Set<string>();
	for (const input of manifest.inputs) {
		if (inputKeys.has(input.key))
			problems.push(`${manifest.id}: duplicate input key "${input.key}".`);
		inputKeys.add(input.key);
	}
	const faultKeys = new Set<string>();
	for (const fault of manifest.faults) {
		if (faultKeys.has(fault.key))
			problems.push(`${manifest.id}: duplicate fault key "${fault.key}".`);
		if (inputKeys.has(fault.key)) {
			problems.push(`${manifest.id}: "${fault.key}" is both an input and a fault.`);
		}
		faultKeys.add(fault.key);
	}
	for (const binding of expandBindings(manifest.bindings)) {
		if (binding.node === undefined && binding.wire === undefined) {
			problems.push(
				`${manifest.id}: binding on "${binding.signal}" names neither a node nor a wire.`
			);
		}
	}
	return problems;
}
