<script lang="ts">
	/**
	 * Transmission-line reflections on the v2 bench.
	 *
	 * The line is drawn as its distributed L–C ladder, and the physics is the
	 * lattice diagram: every wave that reaches an end returns Γ of itself. The
	 * probes clip to the ladder's nodes and the scope draws their voltage over
	 * ten one-way delays, which is a time-domain reflectometer. A playhead runs
	 * the step down the line; the ladder's wires swell with the local voltage, so
	 * the front and its echo are visible on the drawing itself.
	 */
	import { setNodeDegraded, styleWiresFrom } from '#lib/sim-dom.ts';
	import { reflectionCoefficient, tdrLineVoltage, tdrResponse } from '#lib/simulation-models.ts';
	import { reading } from '#lib/simulation-math.ts';
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
	import Plot from './bench/Plot.svelte';
	import { setFlow } from './bench/flow';
	import { probeChannels } from './bench/channels';
	import { formatSi, signed } from './bench/format';
	import type { PartControl, ProbeNet } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let logLoad = $state(Math.log10(150));
	let logSource = $state(Math.log10(50));
	let z0 = $state(50);
	let openLoad = $state(false);
	/* Time in one-way delays; the run lasts ten. */
	let time = $state(10);
	let probeA = $state<string | null>('near');
	let probeB = $state<string | null>('far');
	const timeline = useSimulationTimelineModel();
	const motion = createSimulationMotion('Transmission-line step animation');
	const SPAN = 10;

	const load = $derived(openLoad ? Number.POSITIVE_INFINITY : 10 ** logLoad);
	const source = $derived(10 ** logSource);
	const response = $derived(tdrResponse(1, source, z0, load, 64));
	const gammaLoad = $derived(response.gammaLoad);
	const gammaSource = $derived(reflectionCoefficient(source, z0));
	const status = $derived(
		Math.abs(gammaLoad) < 0.02
			? 'matched load · no echo'
			: Math.abs(gammaSource) < 0.02
				? 'matched source · one echo, then quiet'
				: gammaLoad > 0
					? 'high load · positive echo'
					: 'low load · negative echo'
	);

	/* The playhead loops while running and holds the settled end while paused. */
	$effect(() => {
		if (motion.animationBlocked) return;
		let frame = 0;
		let last = performance.now();
		let hold = 0;
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (time >= SPAN) {
				hold += dt;
				if (hold > 1.4) {
					hold = 0;
					time = 0;
				}
			} else time = Math.min(SPAN, time + dt * 1.6);
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	const POINTS = [
		{ id: 'near', at: 0, label: 'V_near', place: 'near end', sources: ['RS.out', 'NEAR.node'] },
		{
			id: 'x1',
			at: 1 / 3,
			label: 'V(x₁)',
			place: 'one third along',
			sources: ['L1.out', 'N1.node']
		},
		{
			id: 'x2',
			at: 2 / 3,
			label: 'V(x₂)',
			place: 'two thirds along',
			sources: ['L2.out', 'N2.node']
		},
		{ id: 'far', at: 1, label: 'V_far', place: 'far end', sources: ['L3.out', 'FAR.node'] }
	] as const;

	const nets = $derived<ProbeNet[]>([
		{
			id: 'step',
			sources: ['VS.positive'],
			label: 'V_s',
			unit: 'V',
			sample: () => 1,
			summary: () => '1.000 V step',
			reading: () =>
				reading('tdr.probe.net', 'source steps to 1 volt at t equals 0', {
					place: 'source',
					time: '0.0',
					voltage: '1.000'
				})
		},
		...POINTS.map((point): ProbeNet => ({
			id: point.id,
			sources: point.sources,
			label: point.label,
			unit: 'V',
			sample: (x: number) => tdrLineVoltage(response, point.at, x * SPAN),
			summary: () => `→ ${response.settled.toFixed(3)} V`,
			reading: () => {
				const voltage = tdrLineVoltage(response, point.at, time);
				return reading(
					'tdr.probe.net',
					`${point.place}: ${voltage.toFixed(3)} volts at ${time.toFixed(1)} delays`,
					{ place: point.place, time: time.toFixed(1), voltage: voltage.toFixed(3) }
				);
			}
		}))
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));

	/* The wave on the drawing: each ladder wire swells with its local voltage. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const peak = Math.max(1, Math.abs(response.launched) * 2);
		for (const point of POINTS) {
			const level = Math.abs(tdrLineVoltage(response, point.at, time)) / peak;
			for (const wire of point.sources) {
				styleWiresFrom(root, wire, 'stroke-width', (1 + level * 4).toFixed(2));
				styleWiresFrom(root, wire, 'opacity', (0.35 + level * 0.65).toFixed(2));
			}
		}
		styleWiresFrom(root, 'FAR.node', 'opacity', openLoad ? '0.2' : '1');
		setNodeDegraded(root, 'RL', openLoad);
		const nearCurrent = (1 - tdrLineVoltage(response, 0, time)) / source;
		const farCurrent = Number.isFinite(load) ? tdrLineVoltage(response, 1, time) / load : 0;
		const scale = 1 / Math.max(1e-6, 1 / (source + z0));
		setFlow(root, 'VS.positive', nearCurrent * scale);
		setFlow(root, 'RS.out', nearCurrent * scale);
		setFlow(root, 'RL.out', farCurrent * scale);
	});

	const snapshot = $derived(
		Array.from({ length: 121 }, (_, index) => tdrLineVoltage(response, index / 120, time))
	);
	const plotMax = $derived(
		Math.max(1.05, ...snapshot.map((value) => value + 0.1), response.settled + 0.1)
	);
	const plotMin = $derived(Math.min(0, ...snapshot.map((value) => value - 0.1)));

	const controls = $derived<PartControl[]>([
		{
			id: 'tdr-load',
			node: 'RL',
			label: 'Z load',
			ariaLabel: 'Load impedance, 5 ohms to 5 kilohms',
			/* Bounds on the step grid, so every slider position is a valid value. */
			min: 0.7,
			max: 3.7,
			step: 0.01,
			value: logLoad,
			display: formatSi(10 ** logLoad, 'Ω', 1),
			set: (value) => (logLoad = value),
			place: 'left'
		},
		{
			id: 'tdr-source',
			node: 'RS',
			label: 'R source',
			ariaLabel: 'Source resistance',
			min: 0.7,
			max: 2.7,
			step: 0.01,
			value: logSource,
			display: formatSi(source, 'Ω', 1),
			set: (value) => (logSource = value),
			place: 'above'
		},
		{
			id: 'tdr-z0',
			node: 'L2',
			label: 'Z₀',
			ariaLabel: 'Line characteristic impedance',
			min: 25,
			max: 150,
			step: 1,
			value: z0,
			display: `${z0.toFixed(0)} Ω`,
			set: (value) => (z0 = value),
			place: 'above'
		}
	]);

	const revision = $derived(`${logLoad}:${logSource}:${z0}:${openLoad}:${probeA}:${probeB}`);
</script>

<Bench
	title="Time-domain reflectometer"
	tone="analog"
	{status}
	{stage}
	{dock}
	{deck}
	hint="Drag a value tag to change that part. Click a node on the line to clip a probe on; the scope shows ten one-way delays."
/>

{#snippet stage()}
	<div class="tdr-canvas" class:motion-paused={motion.paused || motion.animationBlocked}>
		<div
			class="sim-stage tdr-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="Transmission line drawn as an L C ladder between a step source and a load. Drag the tags on R_s, the line, and Z_L; click a line node to probe it."
			data-model-stage={timeline.step}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<section class="dock-block" aria-label="Reflectometer">
		<p class="microlabel">Reflectometer</p>
		<Scope {channels} running={false} timebase="1 t_d/div · 0 – 10 one-way delays" {revision} />
	</section>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="metrics">
			<div>
				<span>load</span>
				<strong
					><LiveMath
						id="tdr.readout.gamma"
						label={`load reflection coefficient ${signed(gammaLoad)}`}
						values={{ value: signed(gammaLoad) }}
					/></strong
				>
			</div>
			<div>
				<span>source</span>
				<strong
					><LiveMath
						id="tdr.readout.source"
						label={`source reflection coefficient ${signed(gammaSource)}`}
						values={{ value: signed(gammaSource) }}
					/></strong
				>
			</div>
			<div>
				<span>launched</span>
				<strong
					><LiveMath
						id="tdr.readout.launch"
						label={`launched step ${response.launched.toFixed(3)} volts`}
						values={{ value: response.launched.toFixed(3) }}
					/></strong
				>
			</div>
			<div>
				<span>settles</span>
				<strong
					><LiveMath
						id="tdr.readout.settle"
						label={`settles at ${response.settled.toFixed(3)} volts`}
						values={{ value: response.settled.toFixed(3) }}
					/></strong
				>
			</div>
		</div>
	</section>
	<Plot
		label={`Voltage along the line at ${time.toFixed(1)} one-way delays`}
		series={[{ id: 'line', values: snapshot, tone: 'cyan' }]}
		min={plotMin}
		max={plotMax}
		levels={[
			{ at: response.launched, label: 'V₁' },
			{ at: response.settled, label: 'V∞' }
		]}
		xStart="near end"
		xEnd="far end"
		caption={`V(x) along the line at t = ${time.toFixed(1)} t_d`}
	/>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">Try</span>
		<div class="presets">
			<button
				class="btn"
				type="button"
				data-preset="match-load"
				onclick={() => (logLoad = Math.log10(z0))}>Match the load</button
			>
			<button
				class="btn"
				type="button"
				data-preset="match-source"
				onclick={() => (logSource = Math.log10(z0))}>Match the source</button
			>
			<button class="btn" type="button" data-preset="short-load" onclick={() => (logLoad = 0.7)}
				>Near-short the load</button
			>
		</div>
	</div>
	<div class="deck-group">
		<label class="microlabel" for="tdr-time"
			><LiveMath
				id="tdr.readout.time"
				label={`time ${time.toFixed(1)} one-way delays`}
				values={{ value: time.toFixed(1) }}
			/></label
		>
		<input
			id="tdr-time"
			type="range"
			min="0"
			max={SPAN}
			step="0.1"
			value={time}
			aria-label="Time along the run, in one-way delays"
			oninput={(event) => (time = Number(event.currentTarget.value))}
		/>
		<SimulationMotionControl {motion} label="Transmission-line step animation" />
	</div>
	<div class="deck-group">
		<FaultSwitch label="load connector open" bind:active={openLoad} />
	</div>
{/snippet}

<style>
	.tdr-canvas {
		position: relative;
	}

	.tdr-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.tdr-stage :global([data-wire-source] path) {
		transition:
			opacity 90ms linear,
			stroke-width 90ms linear;
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
			font: var(--text-xs) / 1.4 var(--font-mono);
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

	input[type='range'] {
		inline-size: min(260px, 100%);
		accent-color: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.tdr-stage :global([data-wire-source] path) {
			transition: none;
		}
	}
</style>
