<script lang="ts">
	/** Frequency-first RC low-pass laboratory with fully derived response optics. */
	import { delegatedWireSource, setNodeDegraded, styleWiresFrom } from '$lib/sim-dom';
	import { rcLowPass } from '$lib/simulation-models';
	import { reading, type MathReading } from '$lib/simulation-math';
	import { reportSimulationEvidence } from '$lib/simulation-evidence';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import SimulationWorkbench from './SimulationWorkbench.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let logR = $state(4);
	let logC = $state(-7);
	let logF = $state(2);
	let openCapacitor = $state(false);
	let selectedTrace = $state('VOUT.node');
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
	const normalizedFrequency = $derived((logF - 1) / 4);
	const visualStrength = $derived(Math.max(0.06, Math.min(1, magnitude)));
	const outputOpacity = $derived(0.1 + visualStrength * 0.9);
	const outputStrokeWidth = $derived(0.6 + visualStrength * 3.1);
	const outputDash = $derived(
		magnitude > 0.82
			? 'none'
			: `${(2 + magnitude * 18).toFixed(1)} ${(5 + (1 - magnitude) * 18).toFixed(1)}`
	);
	const flowDuration = $derived(`${(0.65 + normalizedFrequency * 1.25).toFixed(2)}s`);
	const inputWave = $derived(wavePath(1, 0));
	const outputWave = $derived(wavePath(magnitude, phaseShift));
	const responsePath = $derived.by(() => {
		let d = '';
		for (let index = 0; index <= 64; index += 1) {
			const localLogF = 1 + (4 * index) / 64;
			const localMagnitude = rcLowPass(
				resistance,
				capacitance,
				10 ** localLogF,
				openCapacitor
			).magnitude;
			const x = 18 + (224 * index) / 64;
			const y = 16 + (1 - localMagnitude) * 92;
			d += `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
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

	function wavePath(amplitude: number, phase: number): string {
		const cycles = 2.2 + normalizedFrequency * 3.8;
		let d = '';
		for (let index = 0; index <= 96; index += 1) {
			const x = 16 + (688 * index) / 96;
			const y = 58 - amplitude * 31 * Math.sin((index / 96) * Math.PI * 2 * cycles + phase);
			d += `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
		}
		return d;
	}

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

	/** Root-SVG delegation turns every compiled wire into a selectable live probe. */
	$effect(() => {
		const root = host?.querySelector('svg');
		if (!root) return;
		const onClick = (event: Event): void => {
			if (!(event.target instanceof Element)) return;
			const source = delegatedWireSource(event.target);
			if (source) selectedTrace = source;
		};
		root.addEventListener('click', onClick);
		return () => root.removeEventListener('click', onClick);
	});

	/** `$derived` response values paint the compiler-emitted output trace immediately. */
	$effect(() => {
		const root = host;
		if (!root) return;
		for (const source of ['R1.out', 'VOUT.node']) {
			styleWiresFrom(root, source, 'opacity', outputOpacity.toFixed(3));
			styleWiresFrom(root, source, 'stroke-width', outputStrokeWidth.toFixed(2));
			styleWiresFrom(root, source, 'stroke-dasharray', outputDash);
			for (const wire of root.querySelectorAll(`[data-wire-source="${source}"]`)) {
				wire.classList.add('rc-output-trace');
				wire.classList.toggle('is-attenuated', magnitude < 0.72);
				wire.setAttribute('data-attenuation', magnitude.toFixed(3));
				if (wire instanceof SVGElement) {
					wire.style.setProperty('--trace-flow-duration', flowDuration);
				}
			}
		}
		styleWiresFrom(root, 'C1.out', 'opacity', openCapacitor ? '0.16' : '0.9');
		setNodeDegraded(root, 'C1', openCapacitor);
	});

	function probe(element: Element): MathReading | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'VIN.positive' || wire === 'VIN.negative') {
			return reading(
				'rc.probe.input',
				`input is 1 volt peak-to-peak at ${formatSi(frequency, 'Hz')}`,
				{
					frequency: formatSi(frequency, 'Hz')
				}
			);
		}
		if (wire === 'R1.out' || wire === 'VOUT.node') {
			return reading('rc.probe.output', `output is ${magnitude.toFixed(3)} volts peak-to-peak`, {
				voltage: magnitude.toFixed(3),
				db: attenuationDb.toFixed(1),
				phase: (phaseShift * 57.2958).toFixed(1)
			});
		}
		if (wire === 'C1.out') {
			return reading(
				'rc.probe.cap',
				openCapacitor
					? 'capacitor branch open'
					: `capacitor current path; cutoff ${formatSi(cutoff, 'Hz')}`,
				{
					state: openCapacitor ? 'C branch OPEN (fault)' : 'I_C path',
					cutoff: formatSi(cutoff, 'Hz')
				}
			);
		}
		return undefined;
	}
</script>

<SimulationWorkbench
	eyebrow="simulation 02 · analog"
	title="RC frequency response analyzer"
	status={frequencyRatio < 1
		? 'passband tracking'
		: frequencyRatio < 4
			? 'transition band'
			: 'stopband attenuation'}
	tone="analog"
	{canvas}
	{controls}
	{readouts}
/>
<ProbeHud read={probe} />

{#snippet canvas()}
	<div class="rc-canvas" class:motion-paused={motion.paused || motion.animationBlocked}>
		<div
			class="sim-stage rc-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="RC low-pass filter model. Click a compiled wire to select its trace."
			data-model-stage={timeline.step}
		>
			{@html svg}
			<div class="trace-badge">
				<span>selected compiler trace</span>
				<code>{selectedTrace}</code>
			</div>
		</div>
		<figure class="waveform" aria-label="Input and attenuated output vector traces">
			<svg viewBox="0 0 720 116" role="img" aria-label="Animated input and output sine-wave traces">
				<line class="zero" x1="16" x2="704" y1="58" y2="58" />
				<path class="wave-input" d={inputWave} />
				<path
					class="wave-output"
					d={outputWave}
					style={`opacity:${outputOpacity.toFixed(3)};stroke-width:${outputStrokeWidth.toFixed(2)};stroke-dasharray:${outputDash};--trace-flow-duration:${flowDuration}`}
				/>
				<text x="18" y="18">Vᵢₙ · 1.000 V</text>
				<text class="out-label" x="702" y="102">Vₒᵤₜ · {magnitude.toFixed(3)} V</text>
			</svg>
			<figcaption>
				<span><i class="input"></i>input</span>
				<span><i class="output"></i>output · {attenuationDb.toFixed(1)} dB</span>
			</figcaption>
		</figure>
	</div>
{/snippet}

{#snippet controls()}
	<div class="frequency-control">
		<div class="frequency-heading">
			<label for="rc-frequency">Input Frequency <span>(Hz)</span></label>
			<output for="rc-frequency">{formatSi(frequency, 'Hz')}</output>
		</div>
		<input
			id="rc-frequency"
			type="range"
			min="1"
			max="5"
			step="0.01"
			bind:value={logF}
			onchange={testCutoffCrossing}
			aria-label="Stimulus frequency, 10 hertz to 100 kilohertz"
		/>
		<div class="frequency-ticks" aria-hidden="true">
			<span>10</span><span>100</span><span>1k</span><span>10k</span><span>100k</span>
		</div>
		<div
			class="cutoff-marker"
			style={`--cutoff-position:${Math.max(0, Math.min(1, (Math.log10(cutoff) - 1) / 4)) * 100}%`}
		>
			<span>f<sub>c</sub> {formatSi(cutoff, 'Hz')}</span>
		</div>
	</div>

	<details class="component-calibration">
		<summary>Component calibration</summary>
		<div>
			<label>
				<span>Resistance · {formatSi(resistance, 'Ω')}</span>
				<input type="range" min="2" max="6" step="0.01" bind:value={logR} aria-label="Resistance" />
			</label>
			<label>
				<span>Capacitance · {formatSi(capacitance, 'F')}</span>
				<input
					type="range"
					min="-9"
					max="-5"
					step="0.01"
					bind:value={logC}
					aria-label="Capacitance"
				/>
			</label>
		</div>
	</details>

	<div class="rc-utilities">
		<SimulationMotionControl {motion} label="RC waveform and frequency-response animation" />
		<FaultSwitch label="capacitor branch open" bind:active={openCapacitor} />
	</div>
{/snippet}

{#snippet readouts()}
	<div class="rc-metrics">
		<div>
			<span>cutoff frequency</span>
			<strong
				><LiveMath
					id="rc.readout.fc"
					label={`cutoff frequency ${formatSi(cutoff, 'Hz')}`}
					values={{ value: formatSi(cutoff, 'Hz') }}
				/></strong
			>
		</div>
		<div>
			<span>voltage gain</span>
			<strong
				><LiveMath
					id="rc.readout.h"
					label={`magnitude ${magnitude.toFixed(3)}, ${attenuationDb.toFixed(1)} decibels`}
					values={{ magnitude: magnitude.toFixed(3), db: attenuationDb.toFixed(1) }}
				/></strong
			>
		</div>
		<div>
			<span>phase shift</span>
			<strong
				><LiveMath
					id="rc.readout.phase"
					label={`phase ${(phaseShift * 57.2958).toFixed(1)} degrees`}
					values={{ value: (phaseShift * 57.2958).toFixed(1) }}
				/></strong
			>
		</div>
	</div>
	<figure class="response-plot" aria-label="Live low-pass frequency response">
		<svg
			viewBox="0 0 260 128"
			role="img"
			aria-label="First-order low-pass response curve with live operating point"
		>
			<line class="plot-grid" x1="18" x2="242" y1="108" y2="108" />
			<line class="plot-grid half" x1="18" x2="242" y1="43" y2="43" />
			<line class="cutoff" x1={cutoffX} x2={cutoffX} y1="12" y2="108" />
			<path class="response-curve" d={responsePath} />
			<circle class="operating-point" cx={operatingX} cy={operatingY} r="4" />
			<text x="18" y="123">10 Hz</text>
			<text class="end" x="242" y="123">100 kHz</text>
		</svg>
		<figcaption>|H(jω)| · −3 dB pole marked</figcaption>
	</figure>
{/snippet}

<style>
	.rc-canvas {
		display: grid;
		grid-template-rows: minmax(300px, auto) auto;
	}

	.rc-stage {
		position: relative;
		display: grid;
		align-content: center;
		min-block-size: 330px;
		border: 0;
		border-radius: 0;
		background: transparent;
	}

	.rc-stage :global(figure) {
		margin: 0;
	}

	.rc-stage :global(svg) {
		inline-size: 100%;
		max-block-size: 440px;
		background: transparent !important;
	}

	.rc-stage :global(figcaption) {
		display: none;
	}

	.rc-stage :global([data-wire-source]) {
		cursor: crosshair;
	}

	.rc-stage :global([data-wire-source] path) {
		transition:
			opacity 140ms linear,
			stroke-width 140ms linear,
			stroke-dasharray 140ms linear;
	}

	.rc-stage :global([data-wire-source].rc-output-trace path) {
		stroke: #61d4ff;
		filter: drop-shadow(0 0 6px rgb(97 212 255 / 0.55));
		animation: trace-flow var(--trace-flow-duration, 1s) linear infinite;
	}

	.rc-stage :global([data-wire-source].rc-output-trace.is-attenuated path) {
		filter: drop-shadow(0 0 2px rgb(97 212 255 / 0.25));
	}

	.trace-badge {
		position: absolute;
		inset: var(--space-4) var(--space-4) auto auto;
		display: grid;
		justify-items: end;
		gap: 2px;
		padding: 0.45rem 0.65rem;
		border: 1px solid rgb(97 212 255 / 0.22);
		border-radius: 5px;
		background: rgb(7 10 12 / 0.78);
	}

	.trace-badge span,
	.frequency-ticks,
	.frequency-heading label span,
	.rc-metrics span,
	.response-plot figcaption,
	.waveform figcaption,
	.component-calibration,
	.component-calibration label span {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.trace-badge code {
		font-size: var(--text-xs);
		color: #aeeaff;
	}

	.waveform {
		margin: 0;
		padding: var(--space-3) var(--space-4) var(--space-2);
		border-block-start: 1px solid rgb(97 212 255 / 0.14);
		background: rgb(5 9 12 / 0.72);
	}

	.waveform svg {
		display: block;
		inline-size: 100%;
		block-size: 116px;
		overflow: visible;
	}

	.waveform path {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.zero {
		stroke: rgb(151 180 194 / 0.12);
		stroke-dasharray: 2 6;
	}

	.wave-input {
		stroke: #74828e;
		stroke-width: 1.2;
		opacity: 0.55;
	}

	.wave-output {
		stroke: #61d4ff;
		filter: drop-shadow(0 0 5px rgb(97 212 255 / 0.55));
		animation: trace-flow var(--trace-flow-duration, 1s) linear infinite;
		transition:
			opacity 180ms linear,
			stroke-width 180ms linear,
			stroke-dasharray 180ms linear;
	}

	.waveform text {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 8px;
	}

	.waveform .out-label {
		fill: #8ce1ff;
		text-anchor: end;
	}

	.waveform figcaption {
		display: flex;
		gap: var(--space-4);
		justify-content: flex-end;
		letter-spacing: 0.04em;
	}

	.waveform figcaption span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.waveform figcaption i {
		inline-size: 16px;
		block-size: 2px;
		background: #74828e;
	}

	.waveform figcaption i.output {
		background: #61d4ff;
		box-shadow: 0 0 6px #61d4ff;
	}

	.frequency-control {
		position: relative;
		padding-block-end: var(--space-4);
	}

	.frequency-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		margin-block-end: var(--space-3);
	}

	.frequency-heading label {
		font-size: var(--text-md);
		font-weight: 620;
	}

	.frequency-heading output {
		font-family: var(--font-mono);
		font-size: 1.2rem;
		color: #aeeaff;
		font-variant-numeric: tabular-nums;
	}

	.frequency-control input[type='range'],
	.component-calibration input[type='range'] {
		inline-size: 100%;
		accent-color: #61d4ff;
		cursor: ew-resize;
	}

	.frequency-control input[type='range'] {
		block-size: 24px;
	}

	.frequency-ticks {
		display: flex;
		justify-content: space-between;
		letter-spacing: 0;
		margin-block-start: 1px;
	}

	.cutoff-marker {
		position: absolute;
		inset-inline-start: var(--cutoff-position);
		inset-block-end: 0;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.cutoff-marker::before {
		content: '';
		display: block;
		inline-size: 1px;
		block-size: 18px;
		margin-inline: auto;
		background: var(--warn);
		box-shadow: 0 0 5px color-mix(in srgb, var(--warn) 65%, transparent);
	}

	.cutoff-marker span {
		display: block;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 0.5625rem;
		color: var(--warn);
	}

	.component-calibration {
		padding-block: var(--space-3);
		border-block: 1px solid var(--line);
	}

	.component-calibration summary {
		cursor: pointer;
		color: var(--ink-mute);
	}

	.component-calibration > div {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-4);
		padding-block-start: var(--space-3);
	}

	.component-calibration label {
		display: grid;
		gap: var(--space-1);
	}

	.rc-utilities {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-block-start: var(--space-3);
	}

	.rc-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-3);
	}

	.rc-metrics > div {
		display: grid;
		gap: 2px;
	}

	.rc-metrics strong {
		font-size: var(--text-sm);
		font-weight: 560;
		color: #bdefff;
		white-space: nowrap;
	}

	.response-plot {
		margin: var(--space-4) 0 0;
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);
	}

	.response-plot svg {
		display: block;
		inline-size: 100%;
		max-block-size: 150px;
		background: var(--bg-inset);
	}

	.plot-grid {
		stroke: var(--line-strong);
	}

	.plot-grid.half {
		stroke-dasharray: 2 4;
	}

	.cutoff {
		stroke: var(--warn);
		stroke-width: 0.8;
		stroke-dasharray: 3 4;
		transition:
			x1 180ms var(--ease-precise),
			x2 180ms var(--ease-precise);
	}

	.response-curve {
		fill: none;
		stroke: #61d4ff;
		stroke-width: 2;
		filter: drop-shadow(0 0 4px rgb(97 212 255 / 0.42));
	}

	.operating-point {
		fill: #d9f6ff;
		stroke: #61d4ff;
		stroke-width: 2;
		filter: drop-shadow(0 0 6px #61d4ff);
		transition:
			cx 120ms linear,
			cy 120ms linear;
	}

	.response-plot text {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
	}

	.response-plot text.end {
		text-anchor: end;
	}

	.response-plot figcaption {
		margin-block-start: var(--space-1);
		text-align: end;
		letter-spacing: 0.04em;
	}

	.motion-paused :global(.rc-output-trace path),
	.motion-paused .wave-output {
		animation-play-state: paused;
	}

	@keyframes trace-flow {
		to {
			stroke-dashoffset: -72;
		}
	}

	@media (max-width: 700px) {
		.component-calibration > div,
		.rc-metrics {
			grid-template-columns: 1fr;
		}

		.rc-utilities {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rc-stage :global([data-wire-source].rc-output-trace path),
		.wave-output {
			animation: none;
		}

		.rc-stage :global([data-wire-source] path),
		.response-curve,
		.operating-point {
			transition: none;
		}
	}
</style>
