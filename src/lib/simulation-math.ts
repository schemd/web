/**
 * A live mathematical reading backed by a server-rendered KaTeX template.
 *
 * Simulation code may change slot text at animation speed, but it never parses
 * TeX in the browser. Template identifiers are deliberately opaque to the UI:
 * the server owns the trusted TeX catalogue and sends only rendered markup.
 */
export type MathSlotValue = string | number;
export type MathSlotValues = Readonly<Record<string, MathSlotValue>>;

export interface MathReading {
	readonly id: string;
	readonly label: string;
	readonly values?: MathSlotValues;
}

export type SimulationMathRegistry = Readonly<Record<string, string>>;
export type SimulationMathContext = () => SimulationMathRegistry;

export const SIMULATION_MATH_CONTEXT = Symbol('schemd:simulation-math');

export const reading = (id: string, label: string, values?: MathSlotValues): MathReading =>
	values === undefined ? { id, label } : { id, label, values };
