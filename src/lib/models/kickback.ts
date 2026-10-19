/* ======================================================================
 * Phase kickback
 * ====================================================================== */

export type KickbackTarget = '0' | '1' | '+' | '-';

export interface KickbackResult {
	/** P(control reads 1) after the final Hadamard. */
	readonly probabilityOne: number;
	/** The control's Bloch vector just before the final Hadamard. */
	readonly bloch: { readonly x: number; readonly y: number; readonly z: number };
	/** Bloch-vector length: 1 when the control is pure, less when it is entangled. */
	readonly purity: number;
}

/**
 * H on the control, controlled-phase(φ) onto the target, H on the control.
 * When the target is an eigenstate of the phase gate (|0⟩ or |1⟩), the phase
 * kicks back onto the control intact and P(1) = sin²(φ/2) for |1⟩. Any other
 * target entangles with the control, which shortens its Bloch vector.
 */
export function phaseKickback(phi: number, target: KickbackTarget): KickbackResult {
	const s = Math.SQRT1_2;
	const t0 = target === '0' ? [1, 0] : target === '1' ? [0, 1] : target === '+' ? [s, s] : [s, -s];
	/* Amplitudes for |c t⟩ as [re, im], after H on the control (|+⟩ ⊗ target). */
	const amp: [number, number][] = [
		[s * t0[0]!, 0],
		[s * t0[1]!, 0],
		[s * t0[0]!, 0],
		[s * t0[1]!, 0]
	];
	/* Controlled phase multiplies |11⟩ by e^{iφ}. */
	const [re11, im11] = amp[3]!;
	amp[3] = [
		re11 * Math.cos(phi) - im11 * Math.sin(phi),
		re11 * Math.sin(phi) + im11 * Math.cos(phi)
	];
	/* Control's reduced density matrix ρ = Tr_t |ψ⟩⟨ψ|. */
	const mul = (a: [number, number], b: [number, number]): [number, number] => [
		a[0] * b[0] + a[1] * b[1],
		a[1] * b[0] - a[0] * b[1]
	];
	let rho00 = 0;
	let rho11 = 0;
	let rho10: [number, number] = [0, 0];
	for (const t of [0, 1]) {
		const a0 = amp[t]!;
		const a1 = amp[2 + t]!;
		rho00 += a0[0] ** 2 + a0[1] ** 2;
		rho11 += a1[0] ** 2 + a1[1] ** 2;
		const term = mul(a1, a0); /* a1 · conj(a0) */
		rho10 = [rho10[0] + term[0], rho10[1] + term[1]];
	}
	const bloch = { x: 2 * rho10[0], y: 2 * rho10[1], z: rho00 - rho11 };
	/* The final H maps the x component to z: P(1) = (1 − x)/2. */
	const probabilityOne = Math.min(1, Math.max(0, (1 - bloch.x) / 2));
	return { probabilityOne, bloch, purity: Math.hypot(bloch.x, bloch.y, bloch.z) };
}
