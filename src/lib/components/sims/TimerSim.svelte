<script lang="ts">
	/**
	 * 555 astable multivibrator.
	 *
	 * A real charge/discharge state loop: the timing capacitor integrates
	 * between ⅓·V_cc and ⅔·V_cc, the timing-branch line thickness scales with
	 * the instantaneous capacitor voltage, and the LED flashes at the exact
	 * calculated frequency (time-scaled for visibility above a few hertz).
	 * f = 1.44 / ((R_A + 2·R_B)·C) · duty = (R_A + R_B)/(R_A + 2·R_B).
	 */
	import {
		setNodeActive,
		delegatedNodeId,
		delegatedWireSource,
		styleWiresFrom
	} from '$lib/sim-dom';
	import { playPulse } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import Oscilloscope from './Oscilloscope.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import { reading, type MathReading } from '$lib/simulation-math';
	import {
		timer555,
		timer555AstableWaveform,
		timer555MonostableCapacitor,
		timer555PresentationFrequency
	} from '$lib/simulation-models';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';

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
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.1));
	let faults = $state({ shortedThreshold: false });
	let mode = $state<'astable' | 'monostable'>('astable');
	/** In monostable mode: true while the single output pulse is in flight. */
	let oneShot = $state(false);
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
	 * Physical state loop with a presentation-only frequency ceiling.
	 *
	 * The normalized waveform remains the exact exponential charge/discharge
	 * solution. Only the phase clock is slowed above 1.5 Hz so a 48 kHz setting
	 * remains inspectable instead of aliasing into arbitrary frame-rate pulses.
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
					} else {
						output = true;
					}
				} else {
					output = false;
					vc = 0;
				}
			} else {
				const visualFrequency = timer555PresentationFrequency(frequency);
				cyclePhase = (cyclePhase + dtReal * visualFrequency) % 1;
				const previousCharging = charging;
				const waveform = timer555AstableWaveform(cyclePhase, ra, rb);
				vc = waveform.capacitorRatio;
				charging = waveform.charging;
				output = waveform.outputHigh;
				if (previousCharging && !charging && ui.audio) playPulse(frequency);
			}
			scope = [...scope.slice(1), output ? 0.85 : 0.15];

			const root = host;
			if (root) {
				setNodeActive(root, 'LED', output);
				root.querySelector('[data-node-id="LED"]')?.classList.toggle('is-selected', output);
				styleWiresFrom(root, 'RB.out', '--schematic-stroke-width', (1 + vc * 3.2).toFixed(2));
				styleWiresFrom(root, 'CT.in', '--schematic-stroke-width', (1 + vc * 3.2).toFixed(2));
				styleWiresFrom(root, 'U1.q', 'opacity', output ? '1' : '0.35');
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => {
			stopped = true;
			cancelAnimationFrame(frame);
		};
	});

	function probe(element: Element): MathReading | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'RB.out' || wire === 'CT.in') {
			return reading('timer.probe.vc', `capacitor voltage ${(vc * VCC).toFixed(2)} volts`, {
				value: (vc * VCC).toFixed(2),
				state: charging ? 'charging' : 'discharging'
			});
		}
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
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="mode-row" role="radiogroup" aria-label="Timer mode">
		<button
			type="button"
			data-timeline-input
			role="radio"
			aria-checked={mode === 'astable'}
			class="mode"
			onclick={() => (mode = 'astable')}
		>
			astable
		</button>
		<button
			type="button"
			data-timeline-input
			role="radio"
			aria-checked={mode === 'monostable'}
			class="mode"
			onclick={() => (mode = 'monostable')}
		>
			monostable
		</button>
	</div>
	{#if mode === 'monostable'}
		<button
			type="button"
			class="btn btn-solid trigger"
			data-timeline-input
			onclick={trigger}
			disabled={oneShot}
		>
			{oneShot ? 'pulse in flight…' : 'trigger one-shot'}
		</button>
	{/if}
	<div class="controls">
		<label>
			<span class="microlabel"
				><LiveMath
					id="timer.control.ra"
					label={`R A ${formatSi(ra, 'Ω')}`}
					values={{ value: formatSi(ra, 'Ω') }}
				/></span
			>
			<input type="range" min="3" max="6" step="0.01" bind:value={logRa} aria-label="R A" />
		</label>
		<label>
			<span class="microlabel"
				><LiveMath
					id="timer.control.rb"
					label={`R B ${formatSi(rb, 'Ω')}`}
					values={{ value: formatSi(rb, 'Ω') }}
				/></span
			>
			<input type="range" min="3" max="6" step="0.01" bind:value={logRb} aria-label="R B" />
		</label>
		<label>
			<span class="microlabel"
				><LiveMath
					id="timer.control.ct"
					label={`timing capacitor ${formatSi(c, 'F')}`}
					values={{ value: formatSi(c, 'F') }}
				/></span
			>
			<input
				type="range"
				min="-8"
				max="-4"
				step="0.01"
				bind:value={logC}
				aria-label="Timing capacitor"
			/>
		</label>
	</div>
	<SimulationMotionControl {motion} label="555 timer state and waveform animation" />
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="THRES shorted to ground" bind:active={faults.shortedThreshold} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		data-model-stage={timeline.step}
		data-model-value={timelineProjection}
		aria-label="555 timer model"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<p class="visually-hidden" aria-live="polite" aria-atomic="true">
		{faults.shortedThreshold
			? 'Timer degraded: threshold input is shorted to ground.'
			: `Timer ${mode} mode active.`}
		{motion.status}
	</p>
	<div class="readouts">
		{#if mode === 'astable'}
			<span class="readout"
				><LiveMath
					id="timer.readout.f"
					label={`frequency ${formatSi(frequency, 'Hz')}`}
					values={{ value: formatSi(frequency, 'Hz') }}
				/></span
			>
			<span class="readout"
				><LiveMath
					id="timer.readout.duty"
					label={`duty ${(duty * 100).toFixed(1)} percent`}
					values={{ value: (duty * 100).toFixed(1) }}
				/></span
			>
		{:else}
			<span class="readout"
				><LiveMath
					id="timer.readout.pulse"
					label={`pulse width ${formatSi(pulseWidth, 's')}`}
					values={{ value: formatSi(pulseWidth, 's') }}
				/></span
			>
			<span class="readout" class:on={oneShot}>{oneShot ? 'HIGH (timing)' : 'idle (LOW)'}</span>
		{/if}
		<span class="readout" class:on={output}>pin 3 output: {output ? 'HIGH' : 'LOW'}</span>
		<span class="readout" class:on={output}>
			<LiveMath
				id="timer.probe.vc"
				label={`capacitor voltage ${(vc * VCC).toFixed(2)} volts`}
				values={{ value: (vc * VCC).toFixed(2), state: charging ? 'charging' : 'discharging' }}
			/>
		</span>
	</div>
	<Oscilloscope samples={scope} label={mode === 'astable' ? 'pin 3 (OUT)' : 'one-shot pulse'} />
{/snippet}

<style>
	.controls,
	.switchboard {
		display: grid;
		gap: var(--space-2);

		& label {
			display: grid;
			gap: 2px;
		}

		& input[type='range'] {
			accent-color: var(--accent);
		}
	}

	.readouts {
		display: grid;
		gap: var(--space-1);
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
		padding: 0.35rem 0.5rem;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);
		background: var(--bg-raised);

		&[aria-checked='true'] {
			color: var(--accent-ink);
			background: var(--accent);
		}
	}

	.trigger {
		inline-size: 100%;
	}
</style>
