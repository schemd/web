import { describe, expect, test } from 'vitest';
import {
	biquadLowPass,
	classDMetrics,
	classDPwm,
	decimate,
	inBandSnr,
	lcCutoff,
	lcLowPass,
	magnitudeSpectrum,
	phaseKickback,
	pidStepResponse,
	pllCanLock,
	pllDerivatives,
	pllLockRange,
	reflectionCoefficient,
	sigmaDelta,
	sigmaDeltaTrace,
	tdrLineVoltage,
	tdrResponse,
	tdrVoltageAt,
	triangleWave,
	uartFrame,
	uartReceive
} from './simulation-models';

describe('transmission-line reflections', () => {
	test('reflection coefficients at the textbook terminations', () => {
		expect(reflectionCoefficient(50, 50)).toBe(0);
		expect(reflectionCoefficient(Number.POSITIVE_INFINITY, 50)).toBe(1);
		expect(reflectionCoefficient(0, 50)).toBe(-1);
		expect(reflectionCoefficient(150, 50)).toBeCloseTo(0.5);
	});

	test('a matched load absorbs the launched wave on its first arrival', () => {
		const response = tdrResponse(1, 50, 50, 50);
		expect(response.launched).toBeCloseTo(0.5);
		expect(tdrVoltageAt(response.loadSteps, 0.5)).toBe(0);
		expect(tdrVoltageAt(response.loadSteps, 1.5)).toBeCloseTo(0.5);
		expect(tdrVoltageAt(response.sourceSteps, 9)).toBeCloseTo(0.5);
	});

	test('an open line doubles at the far end and settles at the source voltage', () => {
		const response = tdrResponse(1, 50, 50, Number.POSITIVE_INFINITY);
		expect(tdrVoltageAt(response.loadSteps, 1.5)).toBeCloseTo(1);
		expect(tdrVoltageAt(response.sourceSteps, 2.5)).toBeCloseTo(1);
		expect(response.settled).toBe(1);
	});

	test('a mismatched source makes the line ring down to the DC divider', () => {
		const response = tdrResponse(1, 10, 50, 200, 200);
		expect(tdrVoltageAt(response.loadSteps, 400)).toBeCloseTo(response.settled, 4);
		expect(response.settled).toBeCloseTo(200 / 210);
	});
});

describe('voltage along the line', () => {
	test('agrees with both end voltages and shows the travelling front', () => {
		const response = tdrResponse(1, 25, 50, 150);
		for (const t of [0.5, 1.5, 2.5, 3.5, 6.5]) {
			expect(tdrLineVoltage(response, 0, t)).toBeCloseTo(tdrVoltageAt(response.sourceSteps, t));
			expect(tdrLineVoltage(response, 1, t)).toBeCloseTo(tdrVoltageAt(response.loadSteps, t));
		}
		/* Halfway through the first transit, the front has passed x = 0.25 but not 0.75. */
		expect(tdrLineVoltage(response, 0.25, 0.5)).toBeCloseTo(response.launched);
		expect(tdrLineVoltage(response, 0.75, 0.5)).toBe(0);
	});
});

describe('phase-locked loop', () => {
	const params = { reference: 12, freeRunning: 10, vcoGain: 4, detectorGain: 1, filterTau: 0.2 };

	test('holds a reference inside K_v·K_d and slips outside it', () => {
		expect(pllLockRange(params)).toBe(4);
		expect(pllCanLock(params)).toBe(true);
		expect(pllCanLock({ ...params, reference: 15 })).toBe(false);
		expect(pllCanLock({ ...params, filterShorted: true })).toBe(false);
	});

	test('settles to a constant phase error where sin θ_e = Δω/(K_v K_d)', () => {
		let theta = 0;
		let control = 0;
		const dt = 0.002;
		for (let step = 0; step < 20_000; step += 1) {
			const [dTheta, dControl] = pllDerivatives(theta, control, params);
			theta += dTheta * dt;
			control += dControl * dt;
		}
		expect(Math.sin(theta)).toBeCloseTo(0.5, 2);
		expect(pllDerivatives(theta, control, params)[0]).toBeCloseTo(0, 2);
	});
});

describe('class-D amplifier', () => {
	test('the triangle carrier spans ±1 and PWM follows the comparison', () => {
		expect(triangleWave(0)).toBe(-1);
		expect(triangleWave(0.5)).toBe(1);
		expect(triangleWave(0.25)).toBeCloseTo(0);
		expect(classDPwm(0.3, 0.1)).toBe(1);
		expect(classDPwm(-0.3, 0.1)).toBe(-1);
	});

	test('a Butterworth LC filter passes the tone and rejects the carrier at 40 dB/decade', () => {
		expect(lcLowPass(0, 20_000)).toBe(1);
		expect(lcLowPass(20_000, 20_000)).toBeCloseTo(Math.SQRT1_2);
		expect(20 * Math.log10(lcLowPass(200_000, 20_000))).toBeCloseTo(-40, 0);
		expect(lcCutoff(22e-6, 1e-6)).toBeCloseTo(33_932, -1);
	});

	test('an open filter leaves the carrier as loud as the switch node', () => {
		const filtered = classDMetrics({
			audioFrequency: 1000,
			carrierFrequency: 300_000,
			cutoff: 30_000,
			depth: 0.8
		});
		const open = classDMetrics({
			audioFrequency: 1000,
			carrierFrequency: 300_000,
			cutoff: 30_000,
			depth: 0.8,
			filterOpen: true
		});
		expect(filtered.cleanliness).toBeGreaterThan(30);
		expect(open.cleanliness).toBeLessThan(0);
	});
});

describe('PID speed control', () => {
	const motor = { gain: 1, friction: 0.5, inertia: 0.2, limit: 12 };

	test('proportional control alone leaves a steady-state error; integral action removes it', () => {
		const p = pidStepResponse({ ...motor, kp: 2, ki: 0, kd: 0 }, 10, 20);
		const pi = pidStepResponse({ ...motor, kp: 2, ki: 2, kd: 0 }, 10, 20);
		expect(p.steadyStateError).toBeGreaterThan(1);
		expect(Math.abs(pi.steadyStateError)).toBeLessThan(0.05);
	});

	test('more proportional gain overshoots more, and inverted feedback runs away', () => {
		const gentle = pidStepResponse({ ...motor, kp: 1, ki: 1, kd: 0 }, 10, 20);
		const hot = pidStepResponse({ ...motor, kp: 1, ki: 8, kd: 0 }, 10, 20);
		expect(hot.overshoot).toBeGreaterThan(gentle.overshoot);
		const inverted = pidStepResponse(
			{ ...motor, kp: 2, ki: 2, kd: 0, invertedFeedback: true },
			10,
			20
		);
		expect(inverted.stable).toBe(false);
	});
});

describe('sigma-delta modulation', () => {
	test('bit density tracks a DC input in both orders', () => {
		for (const order of [1, 2] as const) {
			const bits = sigmaDelta(
				Array.from({ length: 4000 }, () => 0.4),
				order
			);
			const mean = bits.reduce<number>((sum, bit) => sum + bit, 0) / bits.length;
			expect(mean).toBeCloseTo(0.4, 2);
		}
	});

	test('decimation recovers the input and second order pushes noise out of the passband', () => {
		const n = 512;
		const input = Array.from({ length: n }, (_, t) => 0.5 * Math.sin((2 * Math.PI * t) / n + 0.3));
		const recovered = decimate(sigmaDelta(input, 1), 16);
		expect(Math.abs(recovered[256]! - input[248]!)).toBeLessThan(0.2);
		/* Mean power, not mean decibels: deep nulls would bias a dB average. */
		const power = (spectrum: number[]) =>
			spectrum.slice(4, 8).reduce((sum, db) => sum + 10 ** (db / 10), 0) / 4;
		const first = power(magnitudeSpectrum(sigmaDelta(input, 1)));
		const second = power(magnitudeSpectrum(sigmaDelta(input, 2)));
		expect(10 * Math.log10(first / second)).toBeGreaterThan(8);
	});
});

describe('UART', () => {
	test('frames a byte LSB first between a start and a stop bit, with parity', () => {
		expect(uartFrame(0x41)).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 1]);
		expect(uartFrame(0x41, 'even')).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1]);
		expect(uartFrame(0x41, 'odd')).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1]);
	});

	test('a matched receiver decodes; enough baud skew corrupts the frame', () => {
		const frame = uartFrame(0x5a, 'even');
		expect(uartReceive(frame, 0, 'even')).toMatchObject({
			byte: 0x5a,
			framingError: false,
			parityError: false
		});
		expect(uartReceive(frame, 0.03, 'even').byte).toBe(0x5a);
		const skewed = uartReceive(frame, 0.12, 'even');
		expect(skewed.byte !== 0x5a || skewed.framingError || skewed.parityError).toBe(true);
	});

	test('an inverted line fails framing immediately', () => {
		expect(uartReceive(uartFrame(0x41), 0, 'none', true).framingError).toBe(true);
	});
});

describe('phase kickback', () => {
	test('an eigenstate target kicks its phase back intact: P(1) = sin²(φ/2)', () => {
		for (const phi of [0, Math.PI / 3, Math.PI / 2, Math.PI]) {
			const result = phaseKickback(phi, '1');
			expect(result.probabilityOne).toBeCloseTo(Math.sin(phi / 2) ** 2);
			expect(result.purity).toBeCloseTo(1);
		}
	});

	test('a |0⟩ target leaves the control alone', () => {
		expect(phaseKickback(Math.PI, '0').probabilityOne).toBeCloseTo(0);
	});

	test('a superposed target entangles and shortens the control’s Bloch vector', () => {
		const result = phaseKickback(Math.PI, '+');
		expect(result.purity).toBeCloseTo(0);
		expect(phaseKickback(Math.PI / 2, '+').purity).toBeCloseTo(Math.SQRT1_2);
	});
});

describe('sigma-delta instruments', () => {
	test('the trace carries the same bits as the plain modulator', () => {
		const input = Array.from({ length: 300 }, (_, t) => 0.6 * Math.sin(t / 9));
		for (const order of [1, 2] as const) {
			const trace = sigmaDeltaTrace(input, order, 0.01);
			expect(trace.bits).toEqual(sigmaDelta(input, order, 0.01));
			expect(trace.first).toHaveLength(300);
		}
	});

	test('the FFT path agrees with a direct transform', () => {
		const signal = Array.from(
			{ length: 64 },
			(_, t) => Math.sin(t * 0.7) + 0.3 * Math.cos(t * 2.1)
		);
		const window = (t: number) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 63);
		const direct = Array.from({ length: 33 }, (_, k) => {
			let re = 0;
			let im = 0;
			for (let t = 0; t < 64; t += 1) {
				re += signal[t]! * window(t) * Math.cos((2 * Math.PI * k * t) / 64);
				im -= signal[t]! * window(t) * Math.sin((2 * Math.PI * k * t) / 64);
			}
			return 20 * Math.log10(Math.max(1e-9, Math.hypot(re, im) / 16));
		});
		const fast = magnitudeSpectrum(signal);
		for (let k = 0; k <= 32; k += 1) expect(fast[k]).toBeCloseTo(direct[k]!, 6);
	});

	test('in-band SNR rewards the second order and punishes a leaky integrator', () => {
		const n = 4096;
		const input = Array.from({ length: n }, (_, t) => 0.5 * Math.sin((2 * Math.PI * 17 * t) / n));
		const snr = (order: 1 | 2, leak = 0) =>
			inBandSnr(magnitudeSpectrum(sigmaDelta(input, order, leak)), 17, n / 64);
		expect(snr(2)).toBeGreaterThan(snr(1) + 6);
		expect(snr(2, 0.2)).toBeLessThan(snr(2) - 10);
	});
});

describe('LC filter in the time domain', () => {
	const tone = (frequency: number, rate: number) =>
		Array.from({ length: 4000 }, (_, t) => Math.sin((2 * Math.PI * frequency * t) / rate));
	const peak = (values: number[]) => Math.max(...values.slice(2000).map(Math.abs));

	test('matches the analytic LC response below, at, and above the cutoff', () => {
		const rate = 400_000;
		for (const ratio of [0.1, 1, 10]) {
			const filtered = biquadLowPass(tone(1000 * ratio, rate), rate, 1000);
			expect(peak(filtered)).toBeCloseTo(lcLowPass(1000 * ratio, 1000), 2);
		}
	});
});
