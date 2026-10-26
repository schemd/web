import type { MathReading } from '#lib/simulation-math.ts';

/**
 * A value tuned on the part itself. The tag the bench draws on the part *is*
 * the control: a native range input lies over it, so pointer drag, keyboard,
 * and assistive technology all get a real slider, and there is no second
 * control elsewhere to keep in step.
 */
export interface PartControl {
	/** Stable input id, also the label's `for` and guided-action hook. */
	readonly id: string;
	/** The compiler's `data-node-id` the tag sits on. */
	readonly node: string;
	/** Short visible label, such as `R`. */
	readonly label: string;
	/** Localized accessible name; guided actions use the stable id instead. */
	readonly ariaLabel: string;
	readonly min: number;
	readonly max: number;
	readonly step: number;
	/** Current value in slider units (often a base-10 exponent). */
	readonly value: number;
	/** The value as a reader says it: `10.0 kΩ`. */
	readonly display: string;
	readonly set: (value: number) => void;
	/** Fires once the reader lets go, for evidence and causal replays. */
	readonly change?: (event: Event) => void;
	/** Which side of the part the tag sits on. */
	readonly place?: 'above' | 'below' | 'left' | 'right';
}

/**
 * A net a probe can clip onto. Waveforms are sampled across the scope's screen:
 * `x` runs 0 → 1 left to right, `phase` advances with time so traces scroll.
 */
export interface ProbeNet {
	readonly id: string;
	/** Every wire source that belongs to this net; clicking any of them clips on. */
	readonly sources: readonly string[];
	readonly label: string;
	readonly unit: string;
	readonly sample: (x: number, phase: number) => number;
	/**
	 * AC coupling, as on a bench scope: the trace shows only the variation, so
	 * millivolts of ripple are readable on top of volts of DC.
	 */
	readonly ac?: boolean;
	/** The live reading the clip's flag shows, through server-authored KaTeX. */
	readonly reading: () => MathReading | undefined;
	/** Short legend value, such as `0.707 V pk`. */
	readonly summary: () => string;
}
