<script lang="ts">
	/**
	 * PID motor speed control on the v2 bench.
	 *
	 * Every change re-simulates three seconds of the loop: a setpoint step at
	 * zero and a load-torque step halfway through, with a saturating driver, an
	 * armature lag, a filtered derivative, and conditional-integration
	 * anti-windup. The scope is a strip chart of that run, so clipping a probe on
	 * the K_p, K_i/s, or K_d·s wire shows exactly what each path contributed.
	 */
	import { setNodeDegraded } from '#lib/sim-dom.ts';
	import {
		pidStep,
		pidStepResponse,
		type PidParams,
		type PidState
	} from '#lib/simulation-models.ts';
	import { reading } from '#lib/simulation-math.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import ProbeLayer from './bench/ProbeLayer.svelte';
	import ProbeSelects from './bench/ProbeSelects.svelte';
	import Scope from './bench/Scope.svelte';
	import Plot from './bench/Plot.svelte';
	import { setFlow } from './bench/flow';
	import { probeChannels } from './bench/channels';
	import { signed } from './bench/format';
	import type { PartControl, ProbeNet } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let kp = $state(1);
	let ki = $state(0);
	let kd = $state(0);
	let setpoint = $state(30);
	let load = $state(1.5);
	let inverted = $state(false);
	let probeA = $state<string | null>('speed');
	let probeB = $state<string | null>('drive');
	const timeline = useSimulationTimelineModel();

	const HORIZON = 3;
	const SAMPLES = 1200;
	const MOTOR = {
		gain: 4,
		friction: 0.5,
		inertia: 0.2,
		limit: 12,
		driveLag: 0.08,
		derivativeFilter: 0.01
	} as const;
	const params = $derived<PidParams>({ ...MOTOR, kp, ki, kd, invertedFeedback: inverted });
	const response = $derived(pidStepResponse(params, setpoint, HORIZON, load, SAMPLES));

	/* The same run, replayed step by step to expose each path's contribution. */
	const paths = $derived.by(() => {
		const dt = HORIZON / SAMPLES;
		let state: PidState = { speed: 0, integral: 0, previousError: setpoint, output: 0 };
		const error: number[] = [];
		const proportional: number[] = [];
		const integral: number[] = [];
		const derivative: number[] = [];
		const drive: number[] = [];
		for (let index = 0; index <= SAMPLES; index += 1) {
			const t = index * dt;
			state = pidStep(state, setpoint, t >= HORIZON / 2 ? load : 0, params, dt);
			error.push(state.previousError);
			proportional.push(kp * state.previousError);
			integral.push(ki * state.integral);
			derivative.push(kd * (state.derivative ?? 0));
			drive.push(state.drive ?? state.output);
		}
		return { error, proportional, integral, derivative, drive };
	});

	const settling = $derived(
		Number.isFinite(response.settlingTime) ? `${response.settlingTime.toFixed(2)} s` : 'never'
	);
	const offsetPercent = $derived((100 * response.steadyStateError) / Math.max(1e-6, setpoint));
	const status = $derived(
		!response.stable
			? 'driver pinned at the rail, loop has lost control'
			: response.overshoot > 0.05
				? `overshoot ${(response.overshoot * 100).toFixed(0)} %`
				: Math.abs(offsetPercent) > 2
					? `steady-state offset ${offsetPercent.toFixed(1)} %`
					: `settled in ${settling}`
	);

	const at = (values: readonly number[]) => (x: number) =>
		values[Math.min(values.length - 1, Math.floor(x * (values.length - 1)))] ?? 0;
	const last = (values: readonly number[]) => values.at(-1) ?? 0;
	const net = (
		id: string,
		sources: string[],
		label: string,
		unit: string,
		values: readonly number[],
		name: string
	): ProbeNet => ({
		id,
		sources,
		label,
		unit,
		sample: at(values),
		summary: () => `end ${signed(last(values), 1)} ${unit}`,
		reading: () =>
			reading('pid.probe.net', `${name} ends at ${signed(last(values), 2)} ${unit}`, {
				name,
				value: `${signed(last(values), 2)} ${unit}`
			})
	});
	const nets = $derived<ProbeNet[]>([
		net(
			'setpoint',
			['SET.out'],
			'ω set',
			'rad/s',
			response.times.map(() => setpoint),
			'setpoint'
		),
		net('speed', ['M.out', 'TACH.fb'], 'ω', 'rad/s', response.speeds, 'speed'),
		net('error', ['ERR.e'], 'e', 'rad/s', paths.error, 'error'),
		net('p', ['KP.u'], 'P path', 'V', paths.proportional, 'proportional path'),
		net('i', ['KI.u'], 'I path', 'V', paths.integral, 'integral path'),
		net('d', ['KD.u'], 'D path', 'V', paths.derivative, 'derivative path'),
		net('drive', ['SUM.u', 'DRV.v'], 'drive', 'V', paths.drive, 'motor drive')
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));

	$effect(() => {
		const root = host;
		if (!root) return;
		const drive = last(paths.drive) / MOTOR.limit;
		setFlow(root, 'DRV.v', drive);
		setFlow(root, 'SUM.u', drive);
		setFlow(root, 'TACH.fb', 0.5);
		setNodeDegraded(root, 'TACH', inverted);
	});

	const controls = $derived<PartControl[]>([
		{
			id: 'pid-kp',
			node: 'KP',
			label: 'Kp',
			ariaLabel: 'Proportional gain',
			min: 0,
			max: 10,
			step: 0.05,
			value: kp,
			display: kp.toFixed(2),
			set: (value) => (kp = value),
			place: 'above'
		},
		{
			id: 'pid-ki',
			node: 'KI',
			label: 'Ki',
			ariaLabel: 'Integral gain',
			min: 0,
			max: 20,
			step: 0.1,
			value: ki,
			display: ki.toFixed(1),
			set: (value) => (ki = value),
			place: 'below'
		},
		{
			id: 'pid-kd',
			node: 'KD',
			label: 'Kd',
			ariaLabel: 'Derivative gain',
			min: 0,
			max: 0.5,
			step: 0.005,
			value: kd,
			display: kd.toFixed(3),
			set: (value) => (kd = value),
			place: 'below'
		},
		{
			id: 'pid-setpoint',
			node: 'SET',
			label: 'ω set',
			ariaLabel: 'Speed setpoint',
			min: 5,
			max: 60,
			step: 1,
			value: setpoint,
			display: `${setpoint.toFixed(0)} rad/s`,
			set: (value) => (setpoint = value),
			place: 'below'
		},
		{
			id: 'pid-load',
			node: 'M',
			label: 'load',
			ariaLabel: 'Load torque step',
			min: 0,
			max: 4,
			step: 0.1,
			value: load,
			display: `${load.toFixed(1)} N·m`,
			set: (value) => (load = value),
			place: 'above'
		}
	]);

	const revision = $derived(
		`${kp}:${ki}:${kd}:${setpoint}:${load}:${inverted}:${probeA}:${probeB}`
	);
	const plotMax = $derived(Math.max(setpoint * 1.4, ...response.speeds) * 1.05);
	const plotMin = $derived(Math.min(0, ...response.speeds));
</script>

<Bench title="PID speed loop" tone="analog" {status} {stage} {dock} {deck} />

{#snippet stage()}
	<div class="pid-canvas">
		<div
			class="sim-stage pid-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="Motor speed loop: error junction, parallel proportional, integral, and derivative paths, driver, motor, and tachometer feedback. Drag the gain tags; click a wire to probe it."
			data-model-stage={timeline.step}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<section class="dock-block" aria-label="Strip chart">
		<p class="microlabel">Strip chart</p>
		<Scope
			{channels}
			running={false}
			timebase="0.3 s/div, setpoint step at 0 s, load step at 1.5 s"
			{revision}
		/>
	</section>
	<Plot
		label={`Step response: overshoot ${(response.overshoot * 100).toFixed(1)} percent, settling ${settling}`}
		series={[{ id: 'speed', values: response.speeds, tone: 'cyan' }]}
		min={plotMin}
		max={plotMax}
		levels={[{ at: setpoint, label: 'ω set' }]}
		markers={[{ at: 0.5, tone: 'amber', label: 'load step' }]}
		xStart="0 s"
		xEnd="3 s"
		caption="motor speed ω(t) against the setpoint"
	/>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="metrics">
			<div>
				<span>Overshoot</span>
				<strong
					><LiveMath
						id="pid.readout.overshoot"
						label={`overshoot ${(response.overshoot * 100).toFixed(1)} percent`}
						values={{ value: (response.overshoot * 100).toFixed(1) }}
					/></strong
				>
			</div>
			<div>
				<span>Settling</span>
				<strong
					><LiveMath
						id="pid.readout.settle"
						label={`settling time ${settling}`}
						values={{ value: settling }}
					/></strong
				>
			</div>
			<div>
				<span>Offset</span>
				<strong
					><LiveMath
						id="pid.readout.error"
						label={`steady-state error ${signed(response.steadyStateError)} radians per second`}
						values={{ value: signed(response.steadyStateError) }}
					/></strong
				>
			</div>
			<div>
				<span>drive</span>
				<strong
					><LiveMath
						id="pid.readout.drive"
						label={`final drive ${signed(last(paths.drive))} volts`}
						values={{ value: signed(last(paths.drive)) }}
					/></strong
				>
			</div>
		</div>
	</section>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">Try</span>
		<div class="presets">
			<button
				class="btn"
				type="button"
				data-preset="p-only"
				onclick={() => {
					kp = 3;
					ki = 0;
					kd = 0;
				}}>P only</button
			>
			<button
				class="btn"
				type="button"
				data-preset="tuned"
				onclick={() => {
					kp = 3;
					ki = 15;
					kd = 0.1;
				}}>Tuned PID</button
			>
			<button
				class="btn"
				type="button"
				data-preset="integral-heavy"
				onclick={() => {
					kp = 0.5;
					ki = 20;
					kd = 0;
				}}>Too much integral</button
			>
		</div>
	</div>
	<div class="deck-group">
		<FaultSwitch label="Tachometer feedback inverted" bind:active={inverted} />
	</div>
{/snippet}

<style>
	.pid-canvas {
		position: relative;
	}

	.pid-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.dock-block {
		display: grid;
		gap: var(--space-2);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);

		& > div {
			display: grid;
			gap: 2px;
			min-inline-size: 0;
		}

		& span {
			font: var(--text-xs) / 1.4 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--ink-mute);
		}

		& strong {
			font-size: var(--text-sm);
			font-weight: 560;
			color: var(--ink);
			overflow-wrap: anywhere;
		}
	}

	.deck-group {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
