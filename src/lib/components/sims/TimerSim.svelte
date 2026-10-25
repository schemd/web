<script lang="ts">
	/**
	 * 555 timer on the v2 bench.
	 *
	 * A real charge/discharge state loop: the timing capacitor integrates between
	 * ⅓·V_cc and ⅔·V_cc and the LED flashes at the calculated frequency
	 * (time-scaled above a few hertz so it stays readable). R_A, R_B and C_T are
	 * tuned on their parts; the scope draws the capacitor's exponential against
	 * pin 3, and current charges C_T through R_A and R_B, then drains back
	 * through R_B into the discharge pin.
	 * f = 1.44 / ((R_A + 2·R_B)·C) · duty = (R_A + R_B)/(R_A + 2·R_B).
	 */
	import {
		delegatedNodeId,
		delegatedWireSource,
		setNodeActive,
		setNodeClass,
		styleWiresFrom
	} from '#lib/sim-dom.ts';
	import { playPulse } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import { reading, type MathReading } from '#lib/simulation-math.ts';
	import {
		timer555,
		timer555AstableWaveform,
		timer555MonostableCapacitor,
		timer555PresentationFrequency
	} from '#lib/simulation-models.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import PartReadout from './bench/PartReadout.svelte';
	import ProbeLayer from './bench/ProbeLayer.svelte';
	import ProbeSelects from './bench/ProbeSelects.svelte';
	import Scope from './bench/Scope.svelte';
	import { setFlow } from './bench/flow';
	import { probeChannels } from './bench/channels';
	import type { PartControl, ProbeNet } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let logRa = $state(3.7); /* ~5 kΩ */
	let logRb = $state(4); /* 10 kΩ */
	let logC = $state(-5); /* 10 µF */
	let vc = $state(1 / 3);
	let charging = $state(true);
	let output = $state(true);
	let faults = $state({ shortedThreshold: false });
	let mode = $state<'astable' | 'monostable'>('astable');
	/** In monostable mode: true while the single output pulse is in flight. */
	let oneShot = $state(false);
	let probeA = $state<string | null>('vc');
	let probeB = $state<string | null>('out');
	let oneShotElapsed = 0;
	let cyclePhase = 0;
	const motion = createSimulationMotion('555 timer animation');
	const timeline = useSimulationTimelineModel();

	const VCC = 5;
	const ra = $derived(10 ** logRa);
	const rb = $derived(10 ** logRb);
	const c = $derived(10 ** logC);
	const timing = $derived(timer555(ra, rb, c, faults.shortedThreshold));
	const frequency = $derived(timing.frequency);
	const duty = $derived(timing.duty);
	const pulseWidth = $derived(timing.pulseWidth);
	const timelineProjection = $derived(
		[VCC, vc * VCC, vc * VCC, output ? VCC : 0][timeline.step] ?? 0
	);
	const status = $derived(
		faults.shortedThreshold
			? 'threshold latched: output stuck low'
			: mode === 'astable'
				? `astable, ${formatSi(frequency, 'Hz')}, ${(duty * 100).toFixed(0)} % duty`
				: oneShot
					? 'monostable, pulse in flight'
					: 'monostable, waiting for a trigger'
	);

	/** Fire the one-shot: only starts a pulse if the timer is idle. */
	function trigger(): void {
		if (mode !== 'monostable' || oneShot || faults.shortedThreshold) return;
		vc = 0;
		oneShotElapsed = 0;
		oneShot = true;
		output = true;
		if (ui.audio) playPulse(1 / Math.max(pulseWidth, 1e-6));
	}

	function formatSi(value: number, unit: string): string {
		if (!Number.isFinite(value)) return `— ${unit}`;
		if (value >= 1e6) return `${(value / 1e6).toFixed(2)} M${unit}`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(2)} k${unit}`;
		if (value >= 1) return `${value.toFixed(2)} ${unit}`;
		if (value >= 1e-3) return `${(value * 1e3).toFixed(2)} m${unit}`;
		if (value >= 1e-6) return `${(value * 1e6).toFixed(2)} µ${unit}`;
		return `${(value * 1e9).toFixed(2)} n${unit}`;
	}

	/*
	 * Physical state loop with a presentation-only frequency ceiling. The
	 * normalized waveform is the exact exponential solution; only the phase
	 * clock slows above 1.5 Hz, so 48 kHz stays inspectable.
	 */
	$effect(() => {
		if (motion.animationBlocked) return;
		let frame = 0;
		let stopped = false;
		let last = performance.now();
		const loop = (now: number): void => {
			if (stopped) return;
			const dtReal = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (faults.shortedThreshold) {
				/* Threshold shorted to ground: the comparator latches, C charges to Vcc. */
				vc = 1 - (1 - vc) * Math.exp(-dtReal * 0.4);
				output = false;
			} else if (mode === 'monostable') {
				/* One-shot: Vc=Vcc(1-e^-t/RC), ending at t≈ln(3)RC=1.1RC. */
				if (oneShot) {
					oneShotElapsed += dtReal;
					vc = timer555MonostableCapacitor(oneShotElapsed, ra, c);
					if (oneShotElapsed >= pulseWidth) {
						vc = 0;
						oneShot = false;
						output = false;
					} else output = true;
				} else {
					output = false;
					vc = 0;
				}
			} else {
				cyclePhase = (cyclePhase + dtReal * timer555PresentationFrequency(frequency)) % 1;
				const previousCharging = charging;
				const waveform = timer555AstableWaveform(cyclePhase, ra, rb);
				vc = waveform.capacitorRatio;
				charging = waveform.charging;
				output = waveform.outputHigh;
				if (previousCharging && !charging && ui.audio) playPulse(frequency);
			}
			const root = host;
			if (root) {
				styleWiresFrom(root, 'RB.out', '--schematic-stroke-width', (1 + vc * 3.2).toFixed(2));
				styleWiresFrom(root, 'CT.in', '--schematic-stroke-width', (1 + vc * 3.2).toFixed(2));
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => {
			stopped = true;
			cancelAnimationFrame(frame);
		};
	});

	/* The LED and the current change only on a comparator edge, not every frame. */
	$effect(() => {
		const root = host;
		if (!root) return;
		setNodeActive(root, 'LED', output);
		setNodeClass(root, 'LED', 'is-selected', output);
		styleWiresFrom(root, 'U1.q', 'opacity', output ? '1' : '0.35');
		const filling = !faults.shortedThreshold && (mode === 'astable' ? charging : oneShot);
		const draining = !faults.shortedThreshold && mode === 'astable' && !charging;
		setFlow(root, 'VCC.out', filling ? 0.7 : 0, { target: 'RA.in' });
		setFlow(root, 'VCC.out', 0.25, { target: 'U1.vcc' });
		setFlow(root, 'RA.out', filling ? 0.7 : 0);
		setFlow(root, 'RB.out', filling ? 0.7 : draining ? -0.7 : 0, { target: 'CT.in' });
		setFlow(root, 'RB.in', draining ? -0.7 : 0, { target: 'U1.dis' });
		setFlow(root, 'U1.q', output ? 0.8 : 0);
		setFlow(root, 'LED.cathode', output ? 0.8 : 0);
	});

	function probe(element: Element): MathReading | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'RB.out' || wire === 'CT.in')
			return reading('timer.probe.vc', `capacitor voltage ${(vc * VCC).toFixed(2)} volts`, {
				value: (vc * VCC).toFixed(2),
				state: charging ? 'charging' : 'discharging'
			});
		if (wire === 'U1.q')
			return reading(
				'timer.probe.out',
				`output ${output ? 'high' : 'low'} at ${formatSi(frequency, 'Hz')}`,
				{ state: output ? 'HIGH (≈Vcc)' : 'LOW (0 V)', frequency: formatSi(frequency, 'Hz') }
			);
		if (wire === 'VCC.out')
			return reading('timer.probe.vcc', `supply ${VCC.toFixed(1)} volts`, {
				value: VCC.toFixed(1)
			});
		const node = delegatedNodeId(element);
		if (node === 'U1')
			return reading(
				'timer.probe.ic',
				`frequency ${formatSi(frequency, 'Hz')}, duty ${(duty * 100).toFixed(0)} percent`,
				{ frequency: formatSi(frequency, 'Hz'), duty: (duty * 100).toFixed(0) }
			);
		if (node === 'LED')
			return reading(
				'timer.probe.out',
				`LED ${output ? 'on' : 'off'} at ${formatSi(frequency, 'Hz')}`,
				{ state: output ? 'LED ON' : 'LED off', frequency: formatSi(frequency, 'Hz') }
			);
		if (node === 'CT')
			return reading(
				'timer.probe.ct',
				`timing capacitance ${formatSi(c, 'F')}; capacitor voltage ${(vc * VCC).toFixed(2)} volts`,
				{ capacitance: formatSi(c, 'F'), voltage: (vc * VCC).toFixed(2) }
			);
		return undefined;
	}

	const controls = $derived<PartControl[]>([
		{
			id: 'timer-ra',
			node: 'RA',
			label: 'R_A',
			ariaLabel: 'R A',
			min: 3,
			max: 6,
			step: 0.01,
			value: logRa,
			display: formatSi(ra, 'Ω'),
			set: (v) => (logRa = v),
			place: 'left'
		},
		{
			id: 'timer-rb',
			node: 'RB',
			label: 'R_B',
			ariaLabel: 'R B',
			min: 3,
			max: 6,
			step: 0.01,
			value: logRb,
			display: formatSi(rb, 'Ω'),
			set: (v) => (logRb = v),
			place: 'left'
		},
		{
			id: 'timer-ct',
			node: 'CT',
			label: 'C_T',
			ariaLabel: 'Timing capacitor',
			min: -8,
			max: -4,
			step: 0.01,
			value: logC,
			display: formatSi(c, 'F'),
			set: (v) => (logC = v),
			place: 'left'
		}
	]);

	/* Astable: two and a half cycles across the screen. Monostable: the pulse and its tail. */
	const CYCLES = 2.5;
	const astableAt = (x: number, phase: number) =>
		timer555AstableWaveform((((x * CYCLES - phase / (Math.PI * 2) / 2) % 1) + 1) % 1, ra, rb);
	const monoAt = (x: number) => {
		const t = x * pulseWidth * 1.5;
		return t < pulseWidth
			? { vc: timer555MonostableCapacitor(t, ra, c), high: true }
			: { vc: 0, high: false };
	};
	const nets = $derived<ProbeNet[]>([
		{
			id: 'vc',
			sources: ['RB.out', 'CT.in'],
			label: 'V_C',
			unit: 'V',
			sample: (x, phase) =>
				faults.shortedThreshold
					? VCC * vc
					: mode === 'astable'
						? astableAt(x, phase).capacitorRatio * VCC
						: monoAt(x).vc * VCC,
			summary: () => `${(vc * VCC).toFixed(2)} V, ${charging ? 'charging' : 'discharging'}`,
			reading: () =>
				reading('timer.probe.vc', `capacitor voltage ${(vc * VCC).toFixed(2)} volts`, {
					value: (vc * VCC).toFixed(2),
					state: charging ? 'charging' : 'discharging'
				})
		},
		{
			id: 'out',
			sources: ['U1.q'],
			label: 'pin 3',
			unit: 'V',
			sample: (x, phase) =>
				faults.shortedThreshold
					? 0
					: (mode === 'astable' ? astableAt(x, phase).outputHigh : monoAt(x).high)
						? VCC
						: 0,
			summary: () =>
				mode === 'astable'
					? `${formatSi(frequency, 'Hz')}, ${(duty * 100).toFixed(0)} % high`
					: `${formatSi(pulseWidth, 's')} pulse`,
			reading: () =>
				reading(
					'timer.probe.out',
					`output ${output ? 'high' : 'low'} at ${formatSi(frequency, 'Hz')}`,
					{ state: output ? 'HIGH (≈Vcc)' : 'LOW (0 V)', frequency: formatSi(frequency, 'Hz') }
				)
		},
		{
			id: 'vcc',
			sources: ['VCC.out'],
			label: 'V_cc',
			unit: 'V',
			sample: () => VCC,
			summary: () => `${VCC.toFixed(1)} V DC`,
			reading: () =>
				reading('timer.probe.vcc', `supply ${VCC.toFixed(1)} volts`, { value: VCC.toFixed(1) })
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));
	const revision = $derived(
		`${logRa}:${logRb}:${logC}:${mode}:${faults.shortedThreshold}:${probeA}:${probeB}:${oneShot}`
	);
	const timebase = $derived(
		mode === 'astable'
			? `${formatSi(CYCLES / frequency / 10, 's')}/div, time-scaled`
			: `${formatSi((pulseWidth * 1.5) / 10, 's')}/div`
	);
</script>

<Bench title="555 timer" tone="analog" {status} {stage} {dock} {deck} />

{#snippet stage()}
	<div class="bench-canvas" class:motion-paused={motion.paused || motion.animationBlocked}>
		<div
			class="sim-stage schemd-frame timer-stage"
			bind:this={host}
			role="group"
			data-model-stage={timeline.step}
			data-model-value={timelineProjection}
			aria-label="555 timer model. Drag the value tags on R A, R B and the timing capacitor; click a wire to clip a probe on."
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<p class="visually-hidden" aria-live="polite" aria-atomic="true">
		{faults.shortedThreshold
			? 'Timer degraded: threshold input is shorted to ground.'
			: `Timer ${mode} mode active.`}
		{motion.status}
	</p>
	<section class="bench-block" aria-label="Oscilloscope">
		<p class="microlabel">Oscilloscope</p>
		<Scope {channels} running={!(motion.paused || motion.animationBlocked)} {timebase} {revision} />
	</section>
	<section class="bench-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="bench-readouts">
			{#if mode === 'astable'}
				<span
					><LiveMath
						id="timer.readout.f"
						label={`frequency ${formatSi(frequency, 'Hz')}`}
						values={{ value: formatSi(frequency, 'Hz') }}
					/></span
				>
				<span
					><LiveMath
						id="timer.readout.duty"
						label={`duty ${(duty * 100).toFixed(1)} percent`}
						values={{ value: (duty * 100).toFixed(1) }}
					/></span
				>
			{:else}
				<span
					><LiveMath
						id="timer.readout.pulse"
						label={`pulse width ${formatSi(pulseWidth, 's')}`}
						values={{ value: formatSi(pulseWidth, 's') }}
					/></span
				>
				<span class:on={oneShot}>{oneShot ? 'HIGH (timing)' : 'idle (LOW)'}</span>
			{/if}
			<span class:on={output}>pin 3 output: {output ? 'HIGH' : 'LOW'}</span>
		</div>
	</section>
	<PartReadout
		{host}
		read={probe}
		hint="Click the 555, the LED, or the timing capacitor to read it."
	/>
{/snippet}

{#snippet deck()}
	<div class="bench-group">
		<span class="microlabel">Mode</span>
		<div class="mode-row" role="radiogroup" aria-label="Timer mode">
			<button
				type="button"
				data-timeline-input
				role="radio"
				aria-checked={mode === 'astable'}
				class="mode"
				onclick={() => (mode = 'astable')}>Astable</button
			>
			<button
				type="button"
				data-timeline-input
				role="radio"
				aria-checked={mode === 'monostable'}
				class="mode"
				onclick={() => (mode = 'monostable')}>Monostable</button
			>
		</div>
		{#if mode === 'monostable'}
			<button
				type="button"
				class="btn btn-solid"
				data-timeline-input
				onclick={trigger}
				disabled={oneShot}>{oneShot ? 'pulse in flight…' : 'trigger one-shot'}</button
			>
		{/if}
	</div>
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="bench-group">
		<SimulationMotionControl {motion} label="555 timer state and waveform animation" />
	</div>
	<div class="bench-group">
		<FaultSwitch label="THRES shorted to ground" bind:active={faults.shortedThreshold} />
	</div>
{/snippet}

<style>
	.bench-canvas {
		position: relative;
	}

	.timer-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.on {
		color: var(--ok);
	}

	.mode-row {
		display: flex;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.mode {
		flex: 1;
		min-block-size: 32px;
		padding: 0.35rem 0.75rem;
		border: 0;
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-xs);
		color: var(--ink-mute);
		background: var(--bg-raised);
		cursor: pointer;

		&[aria-checked='true'] {
			color: var(--accent-ink);
			background: var(--accent);
		}
	}
</style>
