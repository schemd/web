<script lang="ts">
	/**
	 * RC low-pass laboratory on the v2 bench.
	 *
	 * Frequency is tuned on the source, R and C on their parts; probes clip to
	 * any wire and the scope draws what they read. Current sloshes along the
	 * loop as dots whose swing follows how much current the capacitor draws,
	 * and the output wire still fades and fragments with attenuation.
	 */
	import { setNodeDegraded, styleWiresFrom, wirePaths } from '#lib/sim-dom.ts';
	import { rcLowPass } from '#lib/simulation-models.ts';
	import { reading } from '#lib/simulation-math.ts';
	import { reportSimulationEvidence } from '#lib/simulation-evidence.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
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
	let logR = $state(4);
	let logC = $state(-7);
	let logF = $state(2);
	let openCapacitor = $state(false);
	let probeA = $state<string | null>('vin');
	let probeB = $state<string | null>('vout');
	const timeline = useSimulationTimelineModel();
	const motion = createSimulationMotion('RC waveform and frequency-response animation');

	const resistance = $derived(10 ** logR);
	const capacitance = $derived(10 ** logC);
	const frequency = $derived(10 ** logF);
	const response = $derived(rcLowPass(resistance, capacitance, frequency, openCapacitor));
	const cutoff = $derived(response.cutoff);
	const magnitude = $derived(response.magnitude);
	const phaseShift = $derived(response.phase);
	const attenuationDb = $derived(response.attenuationDb);
	const frequencyRatio = $derived(Number.isFinite(cutoff) ? frequency / cutoff : 0);
	/* The loop current relative to the most it can be (Vin/R): |1 − H(jω)|. */
	const loopCurrent = $derived(
		openCapacitor ? 0 : frequencyRatio / Math.sqrt(1 + frequencyRatio * frequencyRatio)
	);
	const capacitorCurrent = $derived((0.5 * loopCurrent) / resistance);
	const normalizedFrequency = $derived((logF - 1) / 4);
	/* Two to six cycles across the scope screen, so every frequency is readable. */
	const cycles = $derived(2 + normalizedFrequency * 4);
	const visualStrength = $derived(Math.max(0.06, Math.min(1, magnitude)));
	const outputOpacity = $derived(0.1 + visualStrength * 0.9);
	const outputStrokeWidth = $derived(0.6 + visualStrength * 3.1);
	const outputDash = $derived(
		magnitude > 0.82
			? 'none'
			: `${(2 + magnitude * 18).toFixed(1)} ${(5 + (1 - magnitude) * 18).toFixed(1)}`
	);
	const status = $derived(
		frequencyRatio < 1
			? 'passband tracking'
			: frequencyRatio < 4
				? 'transition band'
				: 'stopband attenuation'
	);
	const responsePath = $derived.by(() => {
		let d = '';
		for (let index = 0; index <= 64; index += 1) {
			const localMagnitude = rcLowPass(
				resistance,
				capacitance,
				10 ** (1 + (4 * index) / 64),
				openCapacitor
			).magnitude;
			d += `${index === 0 ? 'M' : 'L'} ${(18 + (224 * index) / 64).toFixed(1)} ${(16 + (1 - localMagnitude) * 92).toFixed(1)} `;
		}
		return d;
	});
	const operatingX = $derived(18 + normalizedFrequency * 224);
	const operatingY = $derived(16 + (1 - magnitude) * 92);
	const cutoffX = $derived(
		Number.isFinite(cutoff)
			? 18 + Math.max(0, Math.min(1, (Math.log10(cutoff) - 1) / 4)) * 224
			: 242
	);

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

	function testCutoffCrossing(event: Event): void {
		const control = event.currentTarget;
		if (!(control instanceof Element)) return;
		queueMicrotask(() => {
			if (frequency >= cutoff) reportSimulationEvidence(control, 'rc', 'frequency-above-cutoff');
		});
	}

	const controls = $derived<PartControl[]>([
		{
			id: 'rc-frequency',
			node: 'VIN',
			label: 'f',
			ariaLabel: 'Stimulus frequency, 10 hertz to 100 kilohertz',
			min: 1,
			max: 5,
			step: 0.01,
			value: logF,
			display: formatSi(frequency, 'Hz'),
			set: (value) => (logF = value),
			change: testCutoffCrossing,
			place: 'below'
		},
		{
			id: 'rc-resistance',
			node: 'R1',
			label: 'R',
			ariaLabel: 'Resistance',
			min: 2,
			max: 6,
			step: 0.01,
			value: logR,
			display: formatSi(resistance, 'Ω'),
			set: (value) => (logR = value),
			place: 'above'
		},
		{
			id: 'rc-capacitance',
			node: 'C1',
			label: 'C',
			ariaLabel: 'Capacitance',
			min: -9,
			max: -5,
			step: 0.01,
			value: logC,
			display: formatSi(capacitance, 'F'),
			set: (value) => (logC = value),
			place: 'right'
		}
	]);

	const wave = (amplitude: number, offset: number) => (x: number, phase: number) =>
		amplitude * Math.sin(Math.PI * 2 * cycles * x - phase + offset);
	const nets = $derived<ProbeNet[]>([
		{
			id: 'vin',
			sources: ['VIN.positive'],
			label: 'Vin',
			unit: 'V',
			sample: wave(0.5, 0),
			summary: () => '1.000 V p-p',
			reading: () =>
				reading('rc.probe.input', `input is 1 volt peak-to-peak at ${formatSi(frequency, 'Hz')}`, {
					frequency: formatSi(frequency, 'Hz')
				})
		},
		{
			id: 'vout',
			sources: ['R1.out', 'VOUT.node'],
			label: 'Vout',
			unit: 'V',
			sample: wave(0.5 * magnitude, phaseShift),
			summary: () => `${magnitude.toFixed(3)} V p-p, ${(phaseShift * 57.2958).toFixed(1)}°`,
			reading: () =>
				reading('rc.probe.output', `output is ${magnitude.toFixed(3)} volts peak-to-peak`, {
					voltage: magnitude.toFixed(3),
					db: attenuationDb.toFixed(1),
					phase: (phaseShift * 57.2958).toFixed(1)
				})
		},
		{
			id: 'ic',
			sources: ['C1.out'],
			label: 'I_C',
			unit: 'A',
			/* The capacitor current leads its voltage by a quarter turn. */
			sample: wave(capacitorCurrent, phaseShift + Math.PI / 2),
			summary: () =>
				openCapacitor ? 'no current: branch open' : `${formatSi(capacitorCurrent * 2, 'A')} p-p`,
			reading: () =>
				reading(
					'rc.probe.cap',
					openCapacitor
						? 'capacitor branch open'
						: `capacitor current path; cutoff ${formatSi(cutoff, 'Hz')}`,
					{
						state: openCapacitor ? 'C branch OPEN (fault)' : 'I_C path',
						cutoff: formatSi(cutoff, 'Hz')
					}
				)
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));

	/* The compiled output wire still shows attenuation in its own stroke. */
	$effect(() => {
		const root = host;
		if (!root) return;
		for (const source of ['R1.out', 'VOUT.node']) {
			styleWiresFrom(root, source, 'opacity', outputOpacity.toFixed(3));
			styleWiresFrom(root, source, 'stroke-width', outputStrokeWidth.toFixed(2));
			styleWiresFrom(root, source, 'stroke-dasharray', outputDash);
			for (const path of wirePaths(root, source)) {
				const wire = path.closest('[data-wire-source]');
				if (!wire) continue;
				wire.classList.add('rc-output-trace');
				wire.classList.toggle('is-attenuated', magnitude < 0.72);
				wire.setAttribute('data-attenuation', magnitude.toFixed(3));
			}
		}
		styleWiresFrom(root, 'C1.out', 'opacity', openCapacitor ? '0.16' : '0.9');
		setNodeDegraded(root, 'C1', openCapacitor);
	});

	/* Current around the loop: source, resistor, capacitor, return. None into the output port. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const period = 1.6 - normalizedFrequency * 1.1;
		const options = { alternate: true, period };
		setFlow(root, 'VIN.positive', loopCurrent, options);
		setFlow(root, 'R1.out', loopCurrent, options);
		setFlow(root, 'VOUT.node', loopCurrent, { ...options, target: 'C1.in' });
		setFlow(root, 'VOUT.node', 0, { target: 'OUT.in' });
		setFlow(root, 'C1.out', loopCurrent, options);
		setFlow(root, 'VIN.negative', loopCurrent, options);
	});

	const revision = $derived(`${logR}:${logC}:${logF}:${openCapacitor}:${probeA}:${probeB}`);
</script>

<Bench title="RC frequency response analyzer" tone="analog" {status} {stage} {dock} {deck} />

{#snippet stage()}
	<div class="rc-canvas" class:motion-paused={motion.paused || motion.animationBlocked}>
		<div
			class="sim-stage rc-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="RC low-pass filter. Drag the value tags on the source, resistor, and capacitor; click a wire to clip a probe on."
			data-model-stage={timeline.step}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<section class="dock-block" aria-label="Oscilloscope">
		<p class="microlabel">Oscilloscope</p>
		<Scope
			{channels}
			running={!(motion.paused || motion.animationBlocked)}
			timebase={`${formatSi(cycles / (frequency * 10), 's')}/div at ${formatSi(frequency, 'Hz')}`}
			{revision}
		/>
	</section>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="rc-metrics">
			<div>
				<span>Cutoff</span>
				<strong
					><LiveMath
						id="rc.readout.fc"
						label={`cutoff frequency ${formatSi(cutoff, 'Hz')}`}
						values={{ value: formatSi(cutoff, 'Hz') }}
					/></strong
				>
			</div>
			<div>
				<span>gain</span>
				<strong
					><LiveMath
						id="rc.readout.h"
						label={`magnitude ${magnitude.toFixed(3)}, ${attenuationDb.toFixed(1)} decibels`}
						values={{ magnitude: magnitude.toFixed(3), db: attenuationDb.toFixed(1) }}
					/></strong
				>
			</div>
			<div>
				<span>phase</span>
				<strong
					><LiveMath
						id="rc.readout.phase"
						label={`phase ${(phaseShift * 57.2958).toFixed(1)} degrees`}
						values={{ value: (phaseShift * 57.2958).toFixed(1) }}
					/></strong
				>
			</div>
		</div>
	</section>
	<figure class="response-plot" aria-label="Live low-pass frequency response">
		<p class="microlabel">Frequency response</p>
		<svg
			viewBox="0 0 260 128"
			role="img"
			aria-label={`First-order low-pass response; operating point at ${formatSi(frequency, 'Hz')}, gain ${magnitude.toFixed(3)}`}
		>
			<line class="plot-grid" x1="18" x2="242" y1="108" y2="108" />
			<line class="plot-grid half" x1="18" x2="242" y1="43" y2="43" />
			<line class="cutoff" x1={cutoffX} x2={cutoffX} y1="12" y2="108" />
			<path class="response-curve" d={responsePath} />
			<circle class="operating-point" cx={operatingX} cy={operatingY} r="4" />
			<text x="18" y="123">10 Hz</text>
			<text class="end" x="242" y="123">100 kHz</text>
		</svg>
		<figcaption>|H(jω)|, dashed line at the −3 dB cutoff</figcaption>
	</figure>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">Try</span>
		<button
			class="btn"
			type="button"
			onclick={(event) => {
				logF = Math.log10(Math.min(1e5, Math.max(10, cutoff)));
				testCutoffCrossing(event);
			}}
			disabled={!Number.isFinite(cutoff)}
		>
			Set f to the cutoff
		</button>
	</div>
	<div class="deck-group">
		<SimulationMotionControl {motion} label="RC waveform and frequency-response animation" />
	</div>
	<div class="deck-group">
		<FaultSwitch label="Capacitor branch open" bind:active={openCapacitor} />
	</div>
{/snippet}

<style>
	.rc-canvas {
		position: relative;
	}

	.rc-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.rc-stage :global([data-wire-source] path) {
		transition:
			opacity 160ms var(--ease-precise),
			stroke-width 160ms var(--ease-precise);
	}

	.dock-block {
		display: grid;
		gap: var(--space-2);
	}

	.rc-metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
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

	.response-plot {
		display: grid;
		gap: var(--space-2);
		margin: 0;

		& svg {
			display: block;
			inline-size: 100%;
			max-block-size: 150px;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			background: var(--bg-inset);
		}

		& figcaption {
			font: var(--text-xs) / 1.4 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--ink-mute);
		}
	}

	.plot-grid {
		stroke: var(--line-strong);
	}

	.plot-grid.half {
		stroke-dasharray: 2 4;
	}

	.cutoff {
		stroke: var(--accent);
		stroke-width: 0.8;
		stroke-dasharray: 3 4;
	}

	.response-curve {
		fill: none;
		stroke: var(--schematic-color-cyan);
		stroke-width: 2;
	}

	.operating-point {
		fill: var(--bg-panel);
		stroke: var(--accent);
		stroke-width: 2;
		transition:
			cx 120ms linear,
			cy 120ms linear;
	}

	.response-plot text {
		fill: var(--ink-faint);
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: 7px;
	}

	.response-plot text.end {
		text-anchor: end;
	}

	.deck-group {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	@media (prefers-reduced-motion: reduce) {
		.rc-stage :global([data-wire-source] path),
		.operating-point {
			transition: none;
		}
	}
</style>
