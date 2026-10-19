/* ======================================================================
 * UART
 * ====================================================================== */

export type UartParity = 'none' | 'even' | 'odd';

/** Line levels for one frame: start 0, eight data bits LSB first, parity, stop 1. */
export function uartFrame(byte: number, parity: UartParity = 'none'): (0 | 1)[] {
	if (!Number.isInteger(byte) || byte < 0 || byte > 255)
		throw new RangeError('A UART frame carries one byte.');
	const data = Array.from({ length: 8 }, (_, bit) => ((byte >> bit) & 1) as 0 | 1);
	const frame: (0 | 1)[] = [0, ...data];
	if (parity !== 'none') {
		const ones = data.reduce<number>((sum, bit) => sum + bit, 0);
		frame.push((parity === 'even' ? ones % 2 : (ones + 1) % 2) as 0 | 1);
	}
	frame.push(1);
	return frame;
}

export interface UartDecode {
	readonly byte: number;
	/** Where the receiver sampled, in transmitter bit times from the start edge. */
	readonly samples: readonly number[];
	readonly bits: readonly (0 | 1)[];
	readonly framingError: boolean;
	readonly parityError: boolean;
}

/**
 * Receive one frame: find the start edge, then sample at the middle of each
 * bit by the receiver's own clock, whose bit time is (1 + skew) of the
 * transmitter's. Drift accumulates across the frame, which is why a few
 * percent of mismatch corrupts the last bits first.
 */
export function uartReceive(
	frame: readonly (0 | 1)[],
	skew: number,
	parity: UartParity = 'none',
	inverted = false
): UartDecode {
	const level = (t: number): 0 | 1 => {
		const index = Math.floor(t);
		const bit = index < 0 ? 1 : index >= frame.length ? 1 : frame[index]!;
		return (inverted ? 1 - bit : bit) as 0 | 1;
	};
	const bitTime = 1 + skew;
	const count = frame.length;
	const samples = Array.from({ length: count }, (_, index) => (index + 0.5) * bitTime);
	const bits = samples.map(level);
	const data = bits.slice(1, 9);
	const byte = data.reduce<number>((sum, bit, index) => sum + (bit << index), 0);
	const stop = bits.at(-1)!;
	let parityError = false;
	if (parity !== 'none') {
		const expected = uartFrame(byte, parity)[9]!;
		parityError = bits[9] !== expected;
	}
	return { byte, samples, bits, framingError: bits[0] !== 0 || stop !== 1, parityError };
}
