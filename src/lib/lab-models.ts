/**
 * The code-owned model registry.
 *
 * A manifest names a model with a **string key resolved here**, never an import
 * path and never an expression. This is the same guarantee the environment
 * registry already makes for laboratory components — a stored document may
 * select an id, but it can never select code — and it is what makes a
 * user-authored manifest safe to accept at all.
 *
 * Every adapter is a thin shim: it reads named inputs, calls the already-pure,
 * already-tested function in `simulation-models.ts`, and returns a flat signal
 * map. No adapter touches the DOM, and none of them re-implements physics —
 * if an adapter starts doing arithmetic of its own, that arithmetic belongs in
 * `simulation-models.ts` where the unit tests can reach it.
 */
import type { LabFrame, LabModel, LabModelInput } from './lab-manifest';
import {
	bellAmplitudesAtStage,
	bellChsh,
	lfsrFeedback,
	lfsrPeriod,
	lfsrStep,
	rippleCarry,
	type LfsrBits
} from './simulation-models';

/** Read a numeric input, falling back when a manifest omits it. */
function num(input: LabModelInput, key: string, fallback = 0): number {
	const value = input.inputs[key];
	return Number.isFinite(value) ? (value as number) : fallback;
}

/** Unpack an integer into `count` bit signals named `prefix{i}`. */
function bitSignals(
	signals: Record<string, number>,
	prefix: string,
	value: number,
	count: number
): void {
	for (let bit = 0; bit < count; bit += 1) signals[`${prefix}${bit}`] = (value >>> bit) & 1;
}

const ADDER_BITS = 8;

/**
 * Eight-bit ripple-carry adder.
 *
 * The timeline's step is the ripple frontier: cell `n` has not decided until
 * stage `n + 1`, so a reader watching the run sees the carry travel rather than
 * the answer appear. That gating is the whole teaching point of the lab, and it
 * lives here — the manifest only says which node each signal lights.
 */
const adder: LabModel = (input): LabFrame => {
	const a = num(input, 'a');
	const b = num(input, 'b');
	const carryIn = (num(input, 'carryIn') >= 1 ? 1 : 0) as 0 | 1;
	const stuckCarry = input.faults['stuckCarry'] === true;
	const result = rippleCarry(a, b, carryIn, ADDER_BITS, stuckCarry);
	/* Stage 0 samples the inputs; each later stage settles one more cell. */
	const frontier = Math.max(0, Math.min(ADDER_BITS, input.step));

	const signals: Record<string, number> = {
		sum: result.sum,
		carryOut: frontier >= ADDER_BITS ? result.carry : 0,
		frontier
	};
	bitSignals(signals, 'A', a, ADDER_BITS);
	bitSignals(signals, 'B', b, ADDER_BITS);
	signals['CIN'] = carryIn;
	for (let bit = 0; bit < ADDER_BITS; bit += 1) {
		const settled = bit < frontier;
		const stage = result.stages[bit]!;
		signals[`S${bit}`] = settled ? stage.sum : 0;
		signals[`C${bit}`] = settled ? stage.carryOut : 0;
	}
	return {
		signals,
		notes: [
			stuckCarry
				? 'A carry is not reaching the next cell; the low bits are still right.'
				: `Carry front at cell ${frontier} of ${ADDER_BITS}.`
		]
	};
};

const LFSR_SEED: LfsrBits = [1, 0, 0, 0];

/**
 * Four-bit Fibonacci LFSR over GF(2).
 *
 * One clock edge per run: the register holds its pre-edge value until the
 * timeline reaches the commit stage, so previous/next scrubs an edge rather
 * than replaying a sequence. `movedTap` breaks primitivity, which shortens the
 * period — the reader is meant to notice the sequence repeating early.
 */
const lfsr: LabModel = (input): LabFrame => {
	const movedTap = input.faults['movedTap'] === true;
	const seedValue = num(input, 'seed', 8);
	const seed = ([0, 1, 2, 3] as const).map((bit) => (seedValue >>> bit) & 1) as unknown as LfsrBits;
	const before = seed.every((bit) => bit === 0) ? LFSR_SEED : seed;
	const after = lfsrStep(before, movedTap);
	const visible = input.step >= 2 ? after : before;
	const feedback = lfsrFeedback(before, movedTap);
	const period = lfsrPeriod(before, movedTap);

	const signals: Record<string, number> = {
		feedback,
		period,
		register: visible.reduce<number>((acc, bit, index) => acc | (bit << index), 0),
		output: visible[3]
	};
	/* Stages are named for the drawing's own ids — `Q1`…`Q4`, not `Q0`-based —
	   so a binding is a one-liner instead of an off-by-one waiting to happen. */
	for (let stage = 0; stage < 4; stage += 1) signals[`Q${stage + 1}`] = visible[stage] ?? 0;
	return {
		signals,
		notes: [
			movedTap
				? `The taps are no longer primitive: the sequence closes after ${period} states.`
				: `Primitive taps — all ${period} non-zero states before repeating.`
		]
	};
};

/**
 * Two-qubit Bell pair.
 *
 * `bellAmplitudesAtStage` already takes the timeline stage, so scrubbing the
 * transport walks preparation → Hadamard → entangler → measurement rather than
 * replaying a run. A broken entangler leaves the pair separable, which shows up
 * as a CHSH value that no longer violates the classical bound of 2.
 */
const bell: LabModel = (input): LabFrame => {
	const q0 = (num(input, 'q0') >= 1 ? 1 : 0) as 0 | 1;
	const q1 = (num(input, 'q1') >= 1 ? 1 : 0) as 0 | 1;
	const broken = input.faults['brokenEntangler'] === true;
	const stage = Math.max(0, input.step);
	const amplitudes = bellAmplitudesAtStage(q0, q1, stage, broken);
	const chsh = bellChsh(amplitudes);
	return {
		signals: {
			q0,
			q1,
			hadamard: stage >= 1 ? 1 : 0,
			entangled: stage >= 2 && !broken ? 1 : 0,
			measured: stage >= 3 ? 1 : 0,
			chsh,
			p00: amplitudes['00'] ** 2,
			p11: amplitudes['11'] ** 2
		},
		notes: [
			broken
				? 'The pair never entangles: each qubit is random on its own and the correlation is classical.'
				: `CHSH ${chsh.toFixed(3)} — above 2 is a correlation no local model reproduces.`
		]
	};
};

/** Every model a manifest may name. The whole whitelist, in one place. */
const MODELS: Readonly<Record<string, LabModel>> = Object.freeze({
	adder,
	bell,
	lfsr
});

/** Names a manifest is allowed to reference. */
export const LAB_MODEL_NAMES: readonly string[] = Object.freeze(Object.keys(MODELS));

/**
 * Resolve a model by name, or `undefined` when it is not registered.
 *
 * Returning `undefined` rather than throwing is deliberate: the caller that
 * loads manifests validates them all up front and reports every problem at
 * once, which is more useful than failing on whichever one happened to load
 * first.
 */
export function resolveLabModel(name: string): LabModel | undefined {
	return Object.hasOwn(MODELS, name) ? MODELS[name] : undefined;
}
