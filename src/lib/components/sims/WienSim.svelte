<script lang="ts">
	/**
	 * Wien-bridge oscillator.
	 *
	 * The loop is a second-order system whose damping is set by the amplifier
	 * gain. Modelling it in van der Pol form, ẍ − μ(1 − x²)ẋ + ω²x = 0 with
	 * μ ∝ (gain − 3), captures the physics a linear model misses: below gain 3
	 * disturbances decay (stable point), above it a limit cycle is born and the
	 * (1 − x²) term parks the amplitude — a Hopf bifurcation drawn live in the
	 * phase portrait. The compiled op-amp and its RC bridge pulse with |x|.
	 */
	import {
		setNodeActive,
		styleWiresFrom,
		delegatedNodeId,
		delegatedWireSource
	} from '$lib/sim-dom';
	import { playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import LabShell from './LabShell.svelte';
	import Oscilloscope from './Oscilloscope.svelte';
	import PhasePortrait from './PhasePortrait.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	let gain = $state(3.05);
	let logR = $state(4); /* 10 kΩ */
	let logC = $state(-8); /* 10 nF */
	let x = $state(0.05); /* normalized output */
	let v = $state(0); /* dx/dt */
	let orbit = $state<{ x: number; y: number }[]>([]);
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.5));
	let paused = $state(false);
	let faults = $state({ openGainResistor: false });

	const resistance = $derived(10 ** logR);
	const capacitance = $derived(10 ** logC);
	/** Real Barkhausen frequency f₀ = 1/(2πRC); the sim animates at a visual ω. */
	const frequency = $derived(1 / (2 * Math.PI * resistance * capacitance));
	/** Nonlinear damping coefficient. Positive ⇒ oscillation grows then limits. */
	const mu = $derived(faults.openGainResistor ? 9 : (gain - 3) * 6);
	const amplitude = $derived.by(() => {
		if (orbit.length < 20) return 0;
		let peak = 0;
		for (const point of orbit) peak = Math.max(peak, Math.abs(point.x));
		return peak;
	});

	const regime = $derived.by(() => {
		if (faults.openGainResistor) return 'CLIPPING (rail latch)';
		if (mu < -0.02) return 'DECAYING → silence';
		if (Math.abs(mu) <= 0.02) return 'MARGINAL (Barkhausen)';
		return 'OSCILLATING (limit cycle)';
	});

	function formatSi(value: number, unit: string): string {
		if (value >= 1e6) return `${(value / 1e6).toFixed(2)} M${unit}`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(2)} k${unit}`;
		if (value >= 1) return `${value.toFixed(1)} ${unit}`;
		if (value >= 1e-3) return `${(value * 1e3).toFixed(1)} m${unit}`;
		if (value >= 1e-6) return `${(value * 1e6).toFixed(1)} µ${unit}`;
		return `${(value * 1e9).toFixed(1)} n${unit}`;
	}

	/** Van der Pol derivative with a hard rail clip when the gain resistor opens. */
	function derivative(px: number, pv: number): [number, number] {
		let ax = pv;
		let av = mu * (1 - px * px) * pv - px;
		if (faults.openGainResistor) {
			/* No feedback attenuation: the amp slams into ±1.2 rails. */
			if (px > 1.2) av -= 40 * (px - 1.2);
			if (px < -1.2) av -= 40 * (px + 1.2);
		}
		return [ax, av];
	}

	function reset(): void {
		x = 0.05;
		v = 0;
		orbit = [];
		scope = Array.from({ length: 96 }, () => 0.5);
		if (ui.audio) playTick(500);
	}

	/* Fixed-step RK4 integrator driving the traces. */
	$effect(() => {
		let frame = 0;
		const loop = (): void => {
			if (!paused) {
				const dt = 0.05;
				for (let step = 0; step < 3; step += 1) {
					const [k1x, k1v] = derivative(x, v);
					const [k2x, k2v] = derivative(x + (dt / 2) * k1x, v + (dt / 2) * k1v);
					const [k3x, k3v] = derivative(x + (dt / 2) * k2x, v + (dt / 2) * k2v);
					const [k4x, k4v] = derivative(x + dt * k3x, v + dt * k3v);
					x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
					v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
				}
				if (!Number.isFinite(x) || Math.abs(x) > 20) {
					reset();
				} else {
					orbit = [...orbit.slice(-259), { x, y: v }];
					scope = [...scope.slice(1), Math.max(0.02, Math.min(0.98, 0.5 + x / 3))];
				}
			}

			const root = host;
			if (root) {
				const drive = Math.min(1, Math.abs(x));
				setNodeActive(root, 'U1', drive > 0.25);
				styleWiresFrom(root, 'U1.out', '--schematic-stroke-width', (1 + drive * 3).toFixed(2));
				styleWiresFrom(root, 'VOUT.node', '--schematic-stroke-width', (1 + drive * 3).toFixed(2));
				styleWiresFrom(root, 'CS.out', 'opacity', (0.4 + drive * 0.6).toFixed(2));
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	function probe(element: Element): string | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'U1.out' || wire === 'VOUT.node') return `v_o = ${x.toFixed(3)} (normalized)`;
		if (wire?.startsWith('CS') || wire?.startsWith('RS'))
			return `positive feedback @ f₀ = ${formatSi(frequency, 'Hz')}`;
		const id = delegatedNodeId(element);
		if (id === 'U1') return `op-amp gain = ${gain.toFixed(2)} · μ = ${mu.toFixed(2)}`;
		if (id === 'RF' || id === 'RG') return `gain-set divider · needs gain = 3 to oscillate`;
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			The Wien network passes exactly one frequency with zero phase shift and a ⅓ loss — so the
			amplifier must supply a gain of <strong>3</strong> to close the loop and sing.
		</p>
		<label>
			<span class="microlabel">amplifier gain = {gain.toFixed(2)}</span>
			<input type="range" min="2.8" max="3.2" step="0.005" bind:value={gain} aria-label="Gain" />
		</label>
		<label>
			<span class="microlabel">R = {formatSi(resistance, 'Ω')}</span>
			<input type="range" min="3" max="5.5" step="0.01" bind:value={logR} aria-label="Bridge R" />
		</label>
		<label>
			<span class="microlabel">C = {formatSi(capacitance, 'F')}</span>
			<input type="range" min="-9" max="-6" step="0.01" bind:value={logC} aria-label="Bridge C" />
		</label>
		<div class="button-row">
			<button type="button" class="btn" aria-pressed={paused} onclick={() => (paused = !paused)}>
				{paused ? 'resume' : 'pause'}
			</button>
			<button type="button" class="btn" onclick={reset}>reset (seed noise)</button>
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="gain-set resistor open (latch-up)" bind:active={faults.openGainResistor} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		aria-label="Wien-bridge oscillator circuit"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div
		class="regime"
		class:oscillating={regime.startsWith('OSC')}
		class:faulted={faults.openGainResistor}
	>
		<span class="microlabel">Barkhausen classifier</span>
		<strong>{regime}</strong>
	</div>
	<div class="readouts">
		<span class="readout">f₀ = {formatSi(frequency, 'Hz')}</span>
		<span class="readout">loop margin μ = {mu.toFixed(2)}</span>
		<span class="readout">amplitude ≈ {amplitude.toFixed(2)}</span>
	</div>
	<PhasePortrait points={orbit} label="birth of the limit cycle" xLabel="v_o" yLabel="dv_o/dt" />
	<Oscilloscope samples={scope} label="output v_o(t)" />
{/snippet}

<style>
	.stack,
	.switchboard,
	.readouts {
		display: grid;
		gap: var(--space-2);
	}

	.control-note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);

		& strong {
			color: var(--ink);
			font-weight: 600;
		}
	}

	label {
		display: grid;
		gap: 2px;
	}

	input[type='range'] {
		accent-color: var(--accent);
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.button-row .btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}

	.regime {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);

		& strong {
			font-family: var(--font-mono);
			font-size: var(--text-md);
			color: var(--accent-2);
		}

		&.oscillating {
			border-color: var(--accent);
			box-shadow: inset 3px 0 0 var(--accent);
		}

		&.faulted {
			border-color: var(--danger);

			& strong {
				color: var(--danger);
			}
		}
	}

	.readouts {
		gap: var(--space-1);
	}

	.sim-stage :global(svg) {
		min-inline-size: 1020px;
	}

	.sim-stage :global([data-node-id='U1'].is-active) {
		filter: drop-shadow(0 0 6px var(--glow));
	}
</style>
