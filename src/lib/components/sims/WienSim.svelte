<script lang="ts">
	/**
	 * Wien-bridge oscillator on the v2 bench.
	 *
	 * The loop is a second-order system whose damping is set by the amplifier
	 * gain. In van der Pol form, ẍ − μ(1 − x²)ẋ + ω²x = 0 with μ ∝ (gain − 3),
	 * it captures what a linear model misses: below gain 3 disturbances decay,
	 * above it a limit cycle is born and (1 − x²) parks the amplitude — a Hopf
	 * bifurcation drawn live in the phase portrait. Gain is tuned on R_f (the
	 * resistor that sets it), the bridge's R and C on theirs; the scope rolls the
	 * output's history, and current sloshes through the bridge as it rings.
	 */
	import {
		delegatedNodeId,
		delegatedWireSource,
		setNodeActive,
		styleWiresFrom
	} from '#lib/sim-dom.ts';
	import { playTick } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import PhasePortrait from './PhasePortrait.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import { reading, type MathReading } from '#lib/simulation-math.ts';
	import { wienDamping, wienFrequency, wienRegime } from '#lib/simulation-models.ts';
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
	let gain = $state(3.05);
	let logR = $state(4); /* 10 kΩ */
	let logC = $state(-8); /* 10 nF */
	let x = $state(0.05); /* normalized output */
	let v = $state(0); /* dx/dt */
	let orbit = $state<{ x: number; y: number }[]>([]);
	/* The output's recent history; the scope draws it rolling. */
	let history = $state<number[]>(Array.from({ length: 240 }, () => 0));
	let faults = $state({ openGainResistor: false });
	let probeA = $state<string | null>('vout');
	let probeB = $state<string | null>('vp');
	const motion = createSimulationMotion('Wien-oscillator animation');
	const timeline = useSimulationTimelineModel();

	const resistance = $derived(10 ** logR);
	const capacitance = $derived(10 ** logC);
	const frequency = $derived(wienFrequency(resistance, capacitance));
	const mu = $derived(wienDamping(gain, faults.openGainResistor));
	const amplitude = $derived.by(() => {
		if (orbit.length < 20) return 0;
		let peak = 0;
		for (const point of orbit) peak = Math.max(peak, Math.abs(point.x));
		return peak;
	});
	const regime = $derived(wienRegime(mu, faults.openGainResistor));
	const timelineProjection = $derived([x, frequency, 1 / 3, mu, amplitude][timeline.step] ?? 0);
	/* Bridge current changes visibly only in steps; repainting it every frame buys nothing. */
	const swing = $derived(Math.round(Math.min(1, amplitude) * 20) / 20);

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
		let av = mu * (1 - px * px) * pv - px;
		if (faults.openGainResistor) {
			/* No feedback attenuation: the amp slams into ±1.2 rails. */
			if (px > 1.2) av -= 40 * (px - 1.2);
			if (px < -1.2) av -= 40 * (px + 1.2);
		}
		return [pv, av];
	}

	function reset(): void {
		x = 0.05;
		v = 0;
		orbit = [];
		history = Array.from({ length: 240 }, () => 0);
		if (ui.audio) playTick(500);
	}

	/* Fixed-step RK4 integrator driving the traces. */
	$effect(() => {
		if (motion.animationBlocked) return;
		let frame = 0;
		let stopped = false;
		const loop = (): void => {
			if (stopped) return;
			const dt = 0.05;
			for (let step = 0; step < 3; step += 1) {
				const [k1x, k1v] = derivative(x, v);
				const [k2x, k2v] = derivative(x + (dt / 2) * k1x, v + (dt / 2) * k1v);
				const [k3x, k3v] = derivative(x + (dt / 2) * k2x, v + (dt / 2) * k2v);
				const [k4x, k4v] = derivative(x + dt * k3x, v + dt * k3v);
				x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
				v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
			}
			if (!Number.isFinite(x) || Math.abs(x) > 20) reset();
			else {
				orbit = [...orbit.slice(-259), { x, y: v }];
				history = [...history.slice(1), x];
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
		return () => {
			stopped = true;
			cancelAnimationFrame(frame);
		};
	});

	/* The bridge rings: current sloshes through both arms as strongly as the output swings. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const options = { alternate: true, period: 1.1 };
		for (const [source, target] of [
			['VOUT.node', 'RS.in'],
			['RS.out', undefined],
			['CS.out', undefined],
			['VP.node', 'RP.in'],
			['RP.out', undefined],
			['VP.node', 'CP.in'],
			['CP.out', undefined],
			['VOUT.node', 'RF.in'],
			['RF.out', undefined],
			['VN.node', 'RG.in'],
			['RG.out', undefined]
		] as const) {
			setFlow(
				root,
				source,
				swing *
					(source.startsWith('RF') ||
					source.startsWith('RG') ||
					target === 'RF.in' ||
					target === 'RG.in'
						? 0.6
						: 1),
				{ ...options, target }
			);
		}
		setFlow(root, 'VOUT.node', 0, { target: 'OUT.in' });
	});

	function probe(element: Element): MathReading | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'U1.out' || wire === 'VOUT.node')
			return reading('wien.probe.output', `output ${x.toFixed(3)} normalized`, {
				value: x.toFixed(3)
			});
		if (wire?.startsWith('CS') || wire?.startsWith('RS'))
			return reading('wien.probe.feedback', `positive feedback at ${formatSi(frequency, 'Hz')}`, {
				value: formatSi(frequency, 'Hz')
			});
		const id = delegatedNodeId(element);
		if (id === 'U1')
			return reading('wien.probe.gain', `gain ${gain.toFixed(2)}; mu ${mu.toFixed(2)}`, {
				gain: gain.toFixed(2),
				mu: mu.toFixed(2)
			});
		if (id === 'RF' || id === 'RG') return reading('wien.probe.divider', 'required gain is three');
		return undefined;
	}

	const controls = $derived<PartControl[]>([
		{
			id: 'wien-gain',
			node: 'RF',
			label: 'gain',
			ariaLabel: 'Gain',
			min: 2.8,
			max: 3.2,
			step: 0.005,
			value: gain,
			display: gain.toFixed(3),
			set: (value) => (gain = value),
			place: 'left'
		},
		{
			id: 'wien-r',
			node: 'RS',
			label: 'R',
			ariaLabel: 'Bridge R',
			min: 3,
			max: 5.5,
			step: 0.01,
			value: logR,
			display: formatSi(resistance, 'Ω'),
			set: (value) => (logR = value),
			place: 'above'
		},
		{
			id: 'wien-c',
			node: 'CS',
			label: 'C',
			ariaLabel: 'Bridge C',
			min: -9,
			max: -6,
			step: 0.01,
			value: logC,
			display: formatSi(capacitance, 'F'),
			set: (value) => (logC = value),
			place: 'above'
		}
	]);

	const fromHistory = (scale: number) => (position: number) =>
		scale * (history[Math.min(history.length - 1, Math.floor(position * history.length))] ?? 0);
	const nets = $derived<ProbeNet[]>([
		{
			id: 'vout',
			sources: ['U1.out', 'VOUT.node'],
			label: 'v_o',
			unit: 'V',
			sample: fromHistory(1),
			summary: () => `${amplitude.toFixed(2)} pk (normalized)`,
			reading: () =>
				reading('wien.probe.output', `output ${x.toFixed(3)} normalized`, { value: x.toFixed(3) })
		},
		{
			id: 'vp',
			sources: ['RS.out', 'CS.out', 'VP.node'],
			label: 'v_+',
			unit: 'V',
			/* At the bridge's one frequency, it returns a third of the output, in phase. */
			sample: fromHistory(1 / 3),
			summary: () => `${(amplitude / 3).toFixed(2)} pk · ⅓ of v_o at ${formatSi(frequency, 'Hz')}`,
			reading: () =>
				reading('wien.probe.feedback', `positive feedback at ${formatSi(frequency, 'Hz')}`, {
					value: formatSi(frequency, 'Hz')
				})
		},
		{
			id: 'vn',
			sources: ['RF.out', 'VN.node'],
			label: 'v_−',
			unit: 'V',
			/* The divider returns 1/gain of the output to the inverting input. */
			sample: fromHistory(faults.openGainResistor ? 1 : 1 / gain),
			summary: () => `1/${gain.toFixed(2)} of v_o`,
			reading: () => reading('wien.probe.divider', 'required gain is three')
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));
	const revision = $derived(`${probeA}:${probeB}:${faults.openGainResistor}:${gain}`);
</script>

<Bench
	title="Wien-bridge oscillator"
	tone="analog"
	status={`${regime} · ${formatSi(frequency, 'Hz')}`}
	{stage}
	{dock}
	{deck}
/>

{#snippet stage()}
	<div class="bench-canvas" class:motion-paused={motion.paused || motion.animationBlocked}>
		<div
			class="sim-stage schemd-frame wien-stage"
			bind:this={host}
			role="group"
			data-model-stage={timeline.step}
			data-model-value={timelineProjection}
			aria-label="Wien oscillator model. Drag the gain tag on R f and the bridge R and C tags; click a wire to clip a probe on."
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<div
		class="regime"
		class:oscillating={regime.startsWith('OSC')}
		class:faulted={faults.openGainResistor}
		aria-live="polite"
		aria-atomic="true"
	>
		<span class="microlabel">Barkhausen classifier</span>
		<strong>{regime}</strong>
		<span class="visually-hidden"
			>{faults.openGainResistor
				? 'Amplifier feedback degraded: gain resistor open.'
				: 'Amplifier feedback active.'}
			{motion.status}</span
		>
	</div>
	<section class="bench-block" aria-label="Oscilloscope">
		<p class="microlabel">Oscilloscope · rolling</p>
		<Scope
			{channels}
			running={!(motion.paused || motion.animationBlocked)}
			timebase="rolling history, newest on the right"
			{revision}
		/>
	</section>
	<section class="bench-block" aria-label="Phase portrait">
		<PhasePortrait
			points={orbit}
			label="birth of the limit cycle"
			xLabel="output voltage"
			yLabel="output voltage derivative"
			xMath={reading('wien.scope.vo', 'output voltage')}
			yMath={reading('wien.scope.dvo', 'output voltage derivative')}
		/>
	</section>
	<section class="bench-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="bench-readouts">
			<span
				><LiveMath
					id="wien.readout.f0"
					label={`frequency ${formatSi(frequency, 'Hz')}`}
					values={{ value: formatSi(frequency, 'Hz') }}
				/></span
			>
			<span
				><LiveMath
					id="wien.readout.mu"
					label={`loop margin ${mu.toFixed(2)}`}
					values={{ value: mu.toFixed(2) }}
				/></span
			>
			<span
				><LiveMath
					id="wien.readout.amplitude"
					label={`amplitude approximately ${amplitude.toFixed(2)}`}
					values={{ value: amplitude.toFixed(2) }}
				/></span
			>
		</div>
	</section>
	<PartReadout {host} read={probe} hint="Click the amplifier or the gain divider to read it." />
{/snippet}

{#snippet deck()}
	<div class="bench-group note">
		<span class="microlabel">Why gain 3</span>
		<p>
			The Wien network passes exactly one frequency with zero phase shift and a
			<LiveMath id="wien.control.loss" label="one-third magnitude" /> loss, so the amplifier must supply
			a gain of <strong>3</strong> to close the loop and sing.
		</p>
	</div>
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="bench-group">
		<span class="microlabel">Try</span>
		<div class="bench-row">
			<button type="button" class="btn" data-timeline-input onclick={reset}
				>reset (seed noise)</button
			>
			<button type="button" class="btn" data-timeline-input onclick={() => (gain = 3)}
				>set gain to 3</button
			>
		</div>
	</div>
	<div class="bench-group">
		<SimulationMotionControl {motion} label="Wien oscillator and waveform animation" />
	</div>
	<div class="bench-group">
		<FaultSwitch label="gain-set resistor open (latch-up)" bind:active={faults.openGainResistor} />
	</div>
{/snippet}

<style>
	.bench-canvas {
		position: relative;
	}

	.wien-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 60vh;
	}

	.wien-stage :global([data-node-id='U1'].is-active) {
		filter: drop-shadow(0 0 6px var(--glow));
	}

	.note {
		max-inline-size: 46ch;

		& p {
			margin: 0;
			font-size: var(--text-sm);
			color: var(--ink-mute);
		}

		& strong {
			color: var(--ink);
		}
	}

	.regime {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
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
</style>
