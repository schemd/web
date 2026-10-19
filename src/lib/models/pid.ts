/* ======================================================================
 * PID speed control of a DC motor
 * ====================================================================== */

export interface PidParams {
	readonly kp: number;
	readonly ki: number;
	readonly kd: number;
	/** Motor torque per volt of drive. */
	readonly gain: number;
	readonly friction: number;
	readonly inertia: number;
	/** Driver saturation, ± volts. */
	readonly limit: number;
	/** Armature (drive) time constant in seconds; 0 applies the command at once. */
	readonly driveLag?: number;
	/** Derivative filter time constant in seconds; 0 differentiates raw. */
	readonly derivativeFilter?: number;
	readonly invertedFeedback?: boolean;
}

export interface PidState {
	readonly speed: number;
	readonly integral: number;
	readonly previousError: number;
	/** Controller command after saturation. */
	readonly output: number;
	/** Filtered derivative of the error. */
	readonly derivative?: number;
	/** Voltage actually across the motor, lagging the command. */
	readonly drive?: number;
}

/**
 * One controller-and-plant step. The integrator only accumulates while the
 * actuator is not saturated in the direction it would push (conditional
 * integration), which is the anti-windup the lab teaches. The derivative is
 * low-pass filtered, as every practical PID's is, and the motor sees the
 * command through its armature lag.
 */
export function pidStep(
	state: PidState,
	setpoint: number,
	load: number,
	params: PidParams,
	dt: number
): PidState {
	const measured = params.invertedFeedback ? -state.speed : state.speed;
	const error = setpoint - measured;
	const raw = (error - state.previousError) / dt;
	const filter = params.derivativeFilter ?? 0;
	const derivative =
		filter > 0
			? (state.derivative ?? 0) + (dt / (filter + dt)) * (raw - (state.derivative ?? 0))
			: raw;
	const unclamped = params.kp * error + params.ki * state.integral + params.kd * derivative;
	const output = Math.max(-params.limit, Math.min(params.limit, unclamped));
	const saturated = output !== unclamped && Math.sign(error) === Math.sign(unclamped);
	const integral = saturated ? state.integral : state.integral + error * dt;
	const lag = params.driveLag ?? 0;
	const drive =
		lag > 0 ? (state.drive ?? 0) + (dt / (lag + dt)) * (output - (state.drive ?? 0)) : output;
	const acceleration =
		(params.gain * drive - params.friction * state.speed - load) / params.inertia;
	const speed = Math.max(-1e4, Math.min(1e4, state.speed + acceleration * dt));
	return { speed, integral, previousError: error, output, derivative, drive };
}

export interface StepResponse {
	readonly times: readonly number[];
	readonly speeds: readonly number[];
	readonly outputs: readonly number[];
	/** Peak above the setpoint, as a fraction of it. */
	readonly overshoot: number;
	/** Time to stay within 2 % of the setpoint, or Infinity. */
	readonly settlingTime: number;
	/** Setpoint minus final speed. */
	readonly steadyStateError: number;
	readonly stable: boolean;
}

/** Simulate a setpoint step (and an optional load step halfway through). */
export function pidStepResponse(
	params: PidParams,
	setpoint: number,
	horizon: number,
	loadStep = 0,
	samples = 600
): StepResponse {
	const dt = horizon / samples;
	let state: PidState = { speed: 0, integral: 0, previousError: setpoint, output: 0 };
	const times: number[] = [];
	const speeds: number[] = [];
	const outputs: number[] = [];
	for (let index = 0; index <= samples; index += 1) {
		const t = index * dt;
		times.push(t);
		speeds.push(state.speed);
		outputs.push(state.output);
		state = pidStep(state, setpoint, t >= horizon / 2 ? loadStep : 0, params, dt);
	}
	const peak = Math.max(...speeds);
	const band = Math.abs(setpoint) * 0.02;
	let settlingTime = Number.POSITIVE_INFINITY;
	for (let index = speeds.length - 1; index >= 0; index -= 1) {
		if (Math.abs(speeds[index]! - setpoint) > band) {
			settlingTime = index === speeds.length - 1 ? Number.POSITIVE_INFINITY : times[index + 1]!;
			break;
		}
		if (index === 0) settlingTime = 0;
	}
	const final = speeds.at(-1)!;
	return {
		times,
		speeds,
		outputs,
		overshoot: setpoint > 0 ? Math.max(0, (peak - setpoint) / setpoint) : 0,
		settlingTime,
		steadyStateError: setpoint - final,
		/* A loop that ends with its actuator pinned at the rail has lost control,
		   however bounded the motor's speed looks. */
		stable: Number.isFinite(final) && Math.abs(outputs.at(-1)!) < params.limit * 0.999
	};
}
