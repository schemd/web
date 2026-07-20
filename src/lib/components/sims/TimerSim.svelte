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

	const VCC = 5;
	const ra = $derived(10 ** logRa);
	const rb = $derived(10 ** logRb);
	const c = $derived(10 ** logC);

	const frequency = $derived(faults.shortedThreshold ? 0 : 1.44 / ((ra + 2 * rb) * c));
	const duty = $derived((ra + rb) / (ra + 2 * rb));
	const period = $derived(frequency > 0 ? 1 / frequency : Number.POSITIVE_INFINITY);

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

	function probe(element: Element): string | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'RB.out' || wire === 'CT.in') {
			return `V_C = ${(vc * VCC).toFixed(2)} V (${charging ? 'charging' : 'discharging'})`;
		}
		if (wire === 'U1.q')
			return `OUT = ${output ? 'HIGH (≈Vcc)' : 'LOW (0 V)'} @ ${formatSi(frequency, 'Hz')}`;
		if (wire === 'VCC.out') return `V_cc = ${VCC.toFixed(1)} V`;
		const node = delegatedNodeId(element);
		if (node === 'U1')
			return `555 · f = ${formatSi(frequency, 'Hz')} · duty ${(duty * 100).toFixed(0)} %`;
		if (node === 'LED')
			return `LED ${output ? 'ON' : 'off'} · flashing at ${formatSi(frequency, 'Hz')}`;
		if (node === 'CT') return `C_T = ${formatSi(c, 'F')} · V_C = ${(vc * VCC).toFixed(2)} V`;
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="controls">
		<label>
			<span class="microlabel">R_A = {formatSi(ra, 'Ω')}</span>
			<input type="range" min="3" max="6" step="0.01" bind:value={logRa} aria-label="R A" />
		</label>
		<label>
			<span class="microlabel">R_B = {formatSi(rb, 'Ω')}</span>
			<input type="range" min="3" max="6" step="0.01" bind:value={logRb} aria-label="R B" />
		</label>
		<label>
			<span class="microlabel">C_T = {formatSi(c, 'F')}</span>
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
		<span class="readout">f = {formatSi(frequency, 'Hz')}</span>
		<span class="readout">duty = {(duty * 100).toFixed(1)} %</span>
		<span class="readout" class:on={output}>
			V_C = {(vc * VCC).toFixed(2)} V · {charging ? 'charging' : 'discharging'}
		</span>
	</div>
	<Oscilloscope samples={scope} label="pin 3 (OUT)" />
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
</style>
