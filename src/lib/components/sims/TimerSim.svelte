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
	import { reading, type MathReading } from '$lib/simulation-math';

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

	const VCC = 5;
	const ra = $derived(10 ** logRa);
	const rb = $derived(10 ** logRb);
	const c = $derived(10 ** logC);

	const frequency = $derived(faults.shortedThreshold ? 0 : 1.44 / ((ra + 2 * rb) * c));
	const duty = $derived((ra + rb) / (ra + 2 * rb));
	const period = $derived(frequency > 0 ? 1 / frequency : Number.POSITIVE_INFINITY);
	/** Monostable output pulse width t = 1.1·R_A·C. */
	const pulseWidth = $derived(1.1 * ra * c);

	/** Fire the one-shot: only starts a pulse if the timer is idle. */
	function trigger(): void {
		if (mode !== 'monostable' || oneShot || faults.shortedThreshold) return;
		vc = 1 / 3;
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

	/* The state loop. Simulation time is scaled so ≥2 visual cycles/s max. */
	$effect(() => {
		let frame = 0;
		let last = performance.now();
		const loop = (now: number): void => {
			const dtReal = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (faults.shortedThreshold) {
				/* Threshold shorted to ground: the comparator latches, C charges to Vcc. */
				vc = Math.min(1, vc + dtReal * 0.4);
				output = false;
			} else if (mode === 'monostable') {
				/* One-shot: charge to ⅔·Vcc exactly once per trigger, then rest low. */
				if (oneShot) {
					const rate = dtReal / Math.max(pulseWidth * 0.6, 0.02);
					vc += rate;
					if (vc >= 2 / 3) {
						vc = 1 / 3;
						oneShot = false;
						output = false;
					} else {
						output = true;
					}
				} else {
					output = false;
					vc = 1 / 3;
				}
			} else {
				const timeScale = Math.max(1, frequency / 1.5);
				const dt = (dtReal * timeScale) / Math.max(period, 1e-9);
				/* Piecewise-linear approximation of the RC segments, per period share. */
				if (charging) {
					vc += dt / Math.max(duty, 0.05);
					if (vc >= 2 / 3) {
						vc = 2 / 3;
						charging = false;
						if (ui.audio) playPulse(frequency);
					}
				} else {
					vc -= dt / Math.max(1 - duty, 0.05);
					if (vc <= 1 / 3) {
						vc = 1 / 3;
						charging = true;
					}
				}
				output = charging;
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
		return () => cancelAnimationFrame(frame);
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
			role="radio"
			aria-checked={mode === 'astable'}
			class="mode"
			onclick={() => (mode = 'astable')}
		>
			astable
		</button>
		<button
			type="button"
			role="radio"
			aria-checked={mode === 'monostable'}
			class="mode"
			onclick={() => (mode = 'monostable')}
		>
			monostable
		</button>
	</div>
	{#if mode === 'monostable'}
		<button type="button" class="btn btn-solid trigger" onclick={trigger} disabled={oneShot}>
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
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="THRES shorted to ground" bind:active={faults.shortedThreshold} />
	</div>
{/snippet}

{#snippet canvas()}
	<div class="sim-stage schemd-frame" bind:this={host}>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
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
