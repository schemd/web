<script lang="ts">
	/**
	 * Dynamic RC low-pass filter.
	 *
	 * Sliders sweep R, C, and the stimulus frequency (10 Hz – 100 kHz). The
	 * cutoff f_c = 1/(2πRC) and the first-order magnitude response are pure
	 * `$derived` metrics; the output trace's opacity and dash pattern track the
	 * real attenuation, and the two-channel oscilloscope overlays the input
	 * reference against the attenuated, phase-shifted output.
	 */
	import { styleWiresFrom, delegatedWireSource, setNodeDegraded } from '$lib/sim-dom';
	import {
		SIMULATION_TIMELINE_EVENT,
		type SimulationTimelineDetail
	} from '$lib/simulation-timelines';
	import Oscilloscope from './Oscilloscope.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	/** log10 sliders for perceptually linear sweeps. */
	let logR = $state(4); /* 10 kΩ */
	let logC = $state(-7); /* 100 nF */
	let logF = $state(2); /* 100 Hz */
	let phase = $state(0);
	let scopeIn = $state<number[]>([]);
	let scopeOut = $state<number[]>([]);
	let faults = $state({ openCapacitor: false });

	const resistance = $derived(10 ** logR);
	const capacitance = $derived(10 ** logC);
	const frequency = $derived(10 ** logF);

	/** f_c = 1 / (2πRC), with an open capacitor faulting the pole away. */
	const cutoff = $derived(
		faults.openCapacitor ? Number.POSITIVE_INFINITY : 1 / (2 * Math.PI * resistance * capacitance)
	);
	const ratio = $derived(frequency / cutoff);
	/** |H(jω)| for a first-order low-pass. */
	const magnitude = $derived(1 / Math.sqrt(1 + ratio * ratio));
	const phaseShift = $derived(-Math.atan(ratio));

	/* The controls define the target response immediately, but the observed output
	 * advances only with the shared source → R → C → probe teaching frames. */
	const INITIAL_RATIO = 100 * 2 * Math.PI * 10_000 * 100e-9;
	const INITIAL_MAGNITUDE = 1 / Math.sqrt(1 + INITIAL_RATIO * INITIAL_RATIO);
	const INITIAL_PHASE_SHIFT = -Math.atan(INITIAL_RATIO);
	let outputMagnitude = $state(INITIAL_MAGNITUDE);
	let outputPhaseShift = $state(INITIAL_PHASE_SHIFT);
	let originMagnitude = INITIAL_MAGNITUDE;
	let originPhaseShift = INITIAL_PHASE_SHIFT;
	const attenuationDb = $derived(20 * Math.log10(outputMagnitude));

	$effect(() => {
		const onStage = (event: Event): void => {
			const detail = (event as CustomEvent<SimulationTimelineDetail>).detail;
			if (detail.simulationId !== 'rc') return;
			if (detail.step === 0) {
				originMagnitude = outputMagnitude;
				originPhaseShift = outputPhaseShift;
			}
			const progress = [0, 0.2, 0.65, 1][detail.step] ?? 1;
			outputMagnitude = originMagnitude + (magnitude - originMagnitude) * progress;
			outputPhaseShift = originPhaseShift + (phaseShift - originPhaseShift) * progress;
		};
		window.addEventListener(SIMULATION_TIMELINE_EVENT, onStage);
		return () => window.removeEventListener(SIMULATION_TIMELINE_EVENT, onStage);
	});

	/* ---------- Bode cutoff-response overlay geometry ----------
	 * A first-order magnitude curve |H(f)| across a log-frequency axis
	 * (10 Hz – 100 kHz), with the cutoff marker, the live operating point, and a
	 * "cutoff line" whose stroke-width, opacity, and dash all track the current
	 * attenuation — thinning and fading toward silence as the pole sweeps down. */
	const PLOT_W = 300;
	const PLOT_H = 164;
	const PLOT_PAD = 18;
	const F_MIN_LOG = 1; /* 10 Hz */
	const F_MAX_LOG = 5; /* 100 kHz */

	function plotX(logFrequency: number): number {
		const span = (logFrequency - F_MIN_LOG) / (F_MAX_LOG - F_MIN_LOG);
		return PLOT_PAD + Math.max(0, Math.min(1, span)) * (PLOT_W - 2 * PLOT_PAD);
	}
	function plotY(unitMagnitude: number): number {
		return PLOT_PAD + (1 - Math.max(0, Math.min(1, unitMagnitude))) * (PLOT_H - 2 * PLOT_PAD);
	}

	/** The response curve |H(f)| sampled across the visible decades. */
	const responsePath = $derived.by(() => {
		const samples = 56;
		let d = '';
		for (let index = 0; index <= samples; index += 1) {
			const logFrequency = F_MIN_LOG + ((F_MAX_LOG - F_MIN_LOG) * index) / samples;
			const localRatio = 10 ** logFrequency / cutoff;
			const localMagnitude = 1 / Math.sqrt(1 + localRatio * localRatio);
			d += `${index === 0 ? 'M' : 'L'} ${plotX(logFrequency).toFixed(1)} ${plotY(localMagnitude).toFixed(1)} `;
		}
		return d;
	});
	const cutoffX = $derived(Number.isFinite(cutoff) ? plotX(Math.log10(cutoff)) : PLOT_W - PLOT_PAD);
	const opX = $derived(plotX(logF));
	const opY = $derived(plotY(outputMagnitude));
	/** −3 dB reference row (magnitude = 1/√2). */
	const halfPowerY = plotY(1 / Math.SQRT2);

	/* The cutoff line's optics, driven entirely by the live attenuation. */
	const cutoffVisibility = $derived(Math.max(0, Math.min(1, outputMagnitude)));
	const cutoffStrokeWidth = $derived((0.18 + cutoffVisibility ** 0.7 * 4.2).toFixed(2));
	const cutoffOpacity = $derived((cutoffVisibility ** 0.9).toFixed(3));
	const cutoffDash = $derived(
		`${(1 + cutoffVisibility * 20).toFixed(1)} ${(5 + (1 - cutoffVisibility) * 24).toFixed(1)}`
	);
	const cutoffFlowDuration = $derived(`${(0.7 + (1 - cutoffVisibility) * 2.8).toFixed(2)}s`);
	const glowOpacity = $derived((cutoffVisibility ** 1.15 * 0.8).toFixed(3));

	function formatSi(value: number, unit: string): string {
		if (!Number.isFinite(value)) return `∞ ${unit}`;
		const prefixes: ReadonlyArray<readonly [number, string]> = [
			[1e9, 'G'],
			[1e6, 'M'],
			[1e3, 'k'],
			[1, ''],
			[1e-3, 'm'],
			[1e-6, 'µ'],
			[1e-9, 'n']
		];
		for (const [scale, prefix] of prefixes) {
			if (Math.abs(value) >= scale) return `${(value / scale).toFixed(2)} ${prefix}${unit}`;
		}
		return `${value.toExponential(2)} ${unit}`;
	}

	/* Attenuation → vector treatment on the compiled output path + V_out probe. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const opacity = String(0.25 + 0.75 * outputMagnitude);
		const dash =
			outputMagnitude > 0.7
				? 'none'
				: `${(outputMagnitude * 12 + 2).toFixed(1)} ${((1 - outputMagnitude) * 8 + 1).toFixed(1)}`;
		for (const source of ['R1.out', 'VOUT.node']) {
			styleWiresFrom(root, source, 'opacity', opacity);
			styleWiresFrom(root, source, 'stroke-dasharray', dash);
		}
		const capacitorOpacity = faults.openCapacitor ? '0.2' : '1';
		styleWiresFrom(root, 'C1.out', 'opacity', capacitorOpacity);
		setNodeDegraded(root, 'C1', faults.openCapacitor);
	});

	/* 60 FPS waveform: input sine reference vs. attenuated, phase-shifted output. */
	$effect(() => {
		let frame = 0;
		const loop = (): void => {
			phase += 0.045;
			const points = 96;
			const nextIn: number[] = [];
			const nextOut: number[] = [];
			for (let index = 0; index < points; index += 1) {
				const t = (index / points) * Math.PI * 4 + phase;
				nextIn.push(0.5 + 0.42 * Math.sin(t));
				nextOut.push(0.5 + 0.42 * outputMagnitude * Math.sin(t + outputPhaseShift));
			}
			scopeIn = nextIn;
			scopeOut = nextOut;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	function probe(element: Element): string | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'VIN.positive' || wire === 'VIN.negative') {
			return `V_in = 1.000 V_pp @ ${formatSi(frequency, 'Hz')}`;
		}
		if (wire === 'R1.out' || wire === 'VOUT.node') {
			return `V_out = ${outputMagnitude.toFixed(3)} V_pp · ${attenuationDb.toFixed(1)} dB · φ ${(outputPhaseShift * 57.2958).toFixed(1)}°`;
		}
		if (wire === 'C1.out') {
			return faults.openCapacitor
				? 'C branch OPEN (fault)'
				: `I_C path · f_c = ${formatSi(cutoff, 'Hz')}`;
		}
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="controls">
		<label>
			<span class="microlabel">R = {formatSi(resistance, 'Ω')}</span>
			<input type="range" min="2" max="6" step="0.01" bind:value={logR} aria-label="Resistance" />
		</label>
		<label>
			<span class="microlabel">C = {formatSi(capacitance, 'F')}</span>
			<input
				type="range"
				min="-9"
				max="-5"
				step="0.01"
				bind:value={logC}
				aria-label="Capacitance"
			/>
		</label>
		<label>
			<span class="microlabel">f = {formatSi(frequency, 'Hz')}</span>
			<input
				type="range"
				min="1"
				max="5"
				step="0.01"
				bind:value={logF}
				aria-label="Stimulus frequency, 10 hertz to 100 kilohertz"
			/>
		</label>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="capacitor branch open" bind:active={faults.openCapacitor} />
	</div>
{/snippet}

{#snippet canvas()}
	<div class="sim-stage schemd-frame" bind:this={host}>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="readouts">
		<span class="readout">f_c = {formatSi(cutoff, 'Hz')}</span>
		<span class="readout">|H| = {outputMagnitude.toFixed(3)} ({attenuationDb.toFixed(1)} dB)</span>
		<span class="readout">φ = {(outputPhaseShift * 57.2958).toFixed(1)}°</span>
	</div>
	<figure class="bode cutoff-overlay" aria-label="Animated frequency response with cutoff marker">
		<svg
			viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
			role="img"
			aria-label="First-order low-pass magnitude response"
		>
			<rect class="bode-bezel" x="0.5" y="0.5" width={PLOT_W - 1} height={PLOT_H - 1} />
			<!-- −3 dB reference row -->
			<line
				class="bode-halfpower"
				x1={PLOT_PAD}
				x2={PLOT_W - PLOT_PAD}
				y1={halfPowerY}
				y2={halfPowerY}
			/>
			<!-- Cutoff frequency marker -->
			<line
				class="bode-cutoff"
				x1={cutoffX}
				x2={cutoffX}
				y1={PLOT_PAD}
				y2={PLOT_H - PLOT_PAD}
				style={`stroke-width: ${cutoffStrokeWidth}; opacity: ${cutoffOpacity}; stroke-dasharray: ${cutoffDash}; --cutoff-flow-duration: ${cutoffFlowDuration}`}
			/>
			<!-- Glow underlay for the response curve -->
			<path class="bode-glow" d={responsePath} style={`opacity: ${glowOpacity}`} />
			<!-- The response curve, thinning and fading with attenuation -->
			<path
				class="bode-curve"
				d={responsePath}
				style={`stroke-width: ${cutoffStrokeWidth}; opacity: ${cutoffOpacity}; stroke-dasharray: ${cutoffDash}; --cutoff-flow-duration: ${cutoffFlowDuration}`}
			/>
			<!-- Live operating point at the stimulus frequency -->
			<circle class="bode-op" cx={opX} cy={opY} r="3.5" />
			<text class="bode-axis" x={PLOT_PAD} y={PLOT_H - 4}>10 Hz</text>
			<text class="bode-axis end" x={PLOT_W - PLOT_PAD} y={PLOT_H - 4}>100 kHz</text>
			<text class="bode-fc" x={Math.min(PLOT_W - 24, cutoffX + 3)} y={PLOT_PAD + 8}>f_c</text>
		</svg>
		<figcaption class="microlabel">|H(jω)| · cutoff line damps as the pole falls</figcaption>
	</figure>
	<Oscilloscope
		channels={[
			{ samples: scopeIn, name: 'V_in' },
			{ samples: scopeOut, name: 'V_out' }
		]}
		label="V_in vs V_out"
	/>
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

	.bode {
		margin: 0;
		display: grid;
		gap: 3px;
		justify-items: center;

		& svg {
			inline-size: 100%;
			max-inline-size: 320px;
			background: var(--bg-inset);
			box-shadow: inset 0 0 24px color-mix(in srgb, var(--accent) 5%, transparent);
		}
	}

	.bode-bezel {
		fill: none;
		stroke: var(--line-strong);
	}

	.bode-halfpower {
		stroke: var(--line);
		stroke-width: 0.6;
		stroke-dasharray: 2 3;
	}

	.bode-cutoff {
		stroke: var(--accent-2);
		stroke-linecap: round;
		filter: drop-shadow(0 0 5px var(--accent-2));
		animation: cutoff-flow var(--cutoff-flow-duration, 1s) linear infinite;
		/* The marker glides as R/C move the pole. */
		transition:
			x1 var(--dur-med) var(--ease-precise),
			x2 var(--dur-med) var(--ease-precise);
	}

	.bode-glow {
		fill: none;
		stroke: var(--accent);
		stroke-width: 5;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: blur(3px);
		transition: opacity var(--dur-med) var(--ease-precise);
	}

	.bode-curve {
		fill: none;
		stroke: var(--accent);
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(0 0 4px var(--glow));
		animation: cutoff-flow var(--cutoff-flow-duration, 1s) linear infinite;
		transition:
			stroke-width var(--dur-med) var(--ease-precise),
			opacity var(--dur-med) var(--ease-precise),
			stroke-dasharray var(--dur-med) var(--ease-precise);
	}

	.bode-op {
		fill: var(--accent);
		stroke: var(--bg);
		stroke-width: 1;
		filter: drop-shadow(0 0 5px var(--glow));
		transition:
			cx var(--dur-fast) var(--ease-precise),
			cy var(--dur-fast) var(--ease-precise);
	}

	.bode-axis,
	.bode-fc {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
	}

	.bode-axis.end {
		text-anchor: end;
	}

	.bode-fc {
		fill: var(--accent-2);
	}

	@keyframes cutoff-flow {
		to {
			stroke-dashoffset: -72;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bode-cutoff,
		.bode-glow,
		.bode-curve,
		.bode-op {
			transition: none;
			animation: none;
		}
	}
</style>
