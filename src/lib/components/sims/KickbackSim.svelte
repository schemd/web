<script lang="ts">
	/**
	 * Phase kickback on the v2 bench.
	 *
	 * The control's reduced Bloch vector after the controlled phase is drawn on
	 * a sphere: with an eigenstate target it turns around the equator by exactly
	 * φ and keeps unit length; with any other target it shortens, because the
	 * control is now entangled. A stage strip follows the timeline through
	 * prepare, H, CP, H, and measure, and a shot histogram samples the final
	 * Born-rule probability.
	 */
	import { delegatedNodeId, setNodeActive, setNodeDegraded } from '#lib/sim-dom.ts';
	import { phaseKickback, type KickbackTarget } from '#lib/simulation-models.ts';
	import { playTick } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { reading, type MathReading } from '#lib/simulation-math.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import PartReadout from './bench/PartReadout.svelte';
	import type { PartControl } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let degrees = $state(90);
	let target = $state<KickbackTarget>('1');
	let offEigen = $state(false);
	let shots = $state({ zero: 0, one: 0 });
	const timeline = useSimulationTimelineModel();

	const TARGETS = [
		{ id: 'zero', value: '0', label: '|0⟩' },
		{ id: 'one', value: '1', label: '|1⟩' },
		{ id: 'plus', value: '+', label: '|+⟩' },
		{ id: 'minus', value: '-', label: '|−⟩' }
	] as const;
	const phi = $derived((degrees * Math.PI) / 180);
	const effective = $derived<KickbackTarget>(offEigen ? '+' : target);
	const result = $derived(phaseKickback(phi, effective));
	const bloch = $derived(result.bloch);
	const purity = $derived(result.purity);
	const probabilityOne = $derived(result.probabilityOne);
	const targetLabel = $derived(TARGETS.find((entry) => entry.value === target)!.label);
	const status = $derived(
		purity > 0.99
			? `clean kickback · P(1) = ${probabilityOne.toFixed(3)}`
			: `entangled · control purity ${purity.toFixed(2)}`
	);

	/* The control's Bloch vector at each timeline stage. */
	const stages = $derived([
		{ name: 'prepare', vector: { x: 0, y: 0, z: 1 } },
		{ name: 'H', vector: { x: 1, y: 0, z: 0 } },
		{ name: 'CP(φ)', vector: bloch },
		{ name: 'H', vector: { x: bloch.z, y: -bloch.y, z: bloch.x } },
		{ name: 'measure', vector: { x: bloch.z, y: -bloch.y, z: bloch.x } }
	]);
	const vec = (v: { x: number; y: number; z: number }) =>
		`(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;

	/* Oblique sphere: x toward the viewer (lower left), y right, z up. */
	const C = 80;
	const R = 58;
	const project = (x: number, y: number, z: number) => ({
		x: C + R * (0.94 * y - 0.38 * x),
		y: C + R * (0.3 * x - 0.95 * z)
	});
	const tip = $derived(project(bloch.x, bloch.y, bloch.z));
	const shadow = $derived(project(bloch.x, bloch.y, 0));
	const equator = Array.from({ length: 65 }, (_, index) => {
		const a = (2 * Math.PI * index) / 64;
		const p = project(Math.cos(a), Math.sin(a), 0);
		return `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
	}).join(' ');
	const axes = [
		{ label: 'x', at: project(1.18, 0, 0) },
		{ label: 'y', at: project(0, 1.18, 0) },
		{ label: '|0⟩', at: project(0, 0, 1.22) },
		{ label: '|1⟩', at: project(0, 0, -1.3) }
	];

	function measure(): void {
		let one = 0;
		for (let shot = 0; shot < 200; shot += 1) if (Math.random() < probabilityOne) one += 1;
		shots = { zero: shots.zero + 200 - one, one: shots.one + one };
		if (ui.audio) playTick(620);
	}
	$effect(() => {
		void phi;
		void effective;
		shots = { zero: 0, one: 0 };
	});
	const total = $derived(shots.zero + shots.one);

	$effect(() => {
		const root = host;
		if (!root) return;
		const active = ['C0', 'H1', 'CP', 'H2', 'M'][timeline.step];
		for (const id of ['C0', 'H1', 'CP', 'H2', 'M']) setNodeActive(root, id, id === active);
		setNodeDegraded(root, 'T0', offEigen);
	});

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'CP')
			return reading('kick.probe.part', `controlled phase ${degrees.toFixed(0)} degrees`, {
				name: 'CP',
				value: `multiplies |11⟩ by e^(i·${degrees.toFixed(0)}°)`
			});
		if (id === 'H1' || id === 'H2')
			return reading('kick.probe.part', 'Hadamard on the control', {
				name: 'H',
				value: id === 'H1' ? 'control to |+⟩' : 'relative phase to population'
			});
		if (id === 'T0' || id === 'TOUT')
			return reading('kick.probe.part', `target prepared in ${targetLabel}`, {
				name: 'target',
				value: `prepared ${targetLabel}`
			});
		if (id === 'M' || id === 'C0')
			return reading('kick.probe.part', `probability of 1 is ${probabilityOne.toFixed(3)}`, {
				name: 'control',
				value: `P(1) = ${probabilityOne.toFixed(3)}`
			});
		return undefined;
	}

	const controls = $derived<PartControl[]>([
		{
			id: 'kick-phi',
			node: 'CP',
			label: 'φ',
			ariaLabel: 'Controlled phase angle, 0 to 360 degrees',
			min: 0,
			max: 360,
			step: 1,
			value: degrees,
			display: `${degrees.toFixed(0)}°`,
			set: (value) => (degrees = value),
			place: 'below'
		}
	]);
</script>

<Bench
	title="Phase kickback"
	tone="quantum"
	{status}
	{stage}
	{dock}
	{deck}
	hint="Drag φ on the controlled-phase gate and choose the target state. Step the timeline to follow the control; click a gate to read it."
/>

{#snippet stage()}
	<div class="kick-canvas">
		<div
			class="sim-stage kick-stage schemd-frame net-optics"
			bind:this={host}
			role="group"
			aria-label="Phase kickback circuit: control qubit through H, a controlled phase onto the target, H, and measurement. Drag the phase tag on the controlled-phase gate."
			data-model-stage={timeline.step}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
	</div>
{/snippet}

{#snippet dock()}
	<figure class="bloch">
		<p class="microlabel">Control qubit after CP(φ)</p>
		<svg
			viewBox="0 0 160 160"
			role="img"
			aria-label={`Bloch vector of the control ${vec(bloch)}, length ${purity.toFixed(2)}`}
		>
			<circle class="sphere" cx={C} cy={C} r={R} />
			<path class="equator" d={equator} />
			<line
				class="axis"
				x1={project(0, 0, 1).x}
				y1={project(0, 0, 1).y}
				x2={project(0, 0, -1).x}
				y2={project(0, 0, -1).y}
			/>
			{#each axes as axis (axis.label)}
				<text x={axis.at.x} y={axis.at.y}>{axis.label}</text>
			{/each}
			<line class="drop" x1={tip.x} y1={tip.y} x2={shadow.x} y2={shadow.y} />
			<line class="vector" class:mixed={purity < 0.99} x1={C} y1={C} x2={tip.x} y2={tip.y} />
			<circle class="tip" class:mixed={purity < 0.99} cx={tip.x} cy={tip.y} r="3.4" />
		</svg>
		<figcaption>a shorter arrow means the control is entangled with the target</figcaption>
	</figure>
	<ol class="stages" aria-label="Control Bloch vector at each stage">
		{#each stages as entry, index (index)}
			<li class:current={index === timeline.step}>
				<span>{entry.name}</span>
				<output>{vec(entry.vector)}</output>
			</li>
		{/each}
	</ol>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="metrics">
			<div>
				<span>outcome</span>
				<strong
					><LiveMath
						id="kick.readout.p1"
						label={`probability of measuring 1 is ${probabilityOne.toFixed(3)}`}
						values={{ value: probabilityOne.toFixed(3) }}
					/></strong
				>
			</div>
			<div>
				<span>purity</span>
				<strong
					><LiveMath
						id="kick.readout.purity"
						label={`Bloch vector length ${purity.toFixed(3)}`}
						values={{ value: purity.toFixed(3) }}
					/></strong
				>
			</div>
			<div>
				<span>ideal</span>
				<strong
					><LiveMath
						id="kick.readout.ideal"
						label={`ideal kickback gives ${(Math.sin(phi / 2) ** 2).toFixed(3)}`}
						values={{ value: (Math.sin(phi / 2) ** 2).toFixed(3) }}
					/></strong
				>
			</div>
			<div>
				<span>shots</span>
				<strong
					><LiveMath
						id="kick.readout.shots"
						label={`${shots.one} ones in ${total} shots`}
						values={{ ones: String(shots.one), total: String(total) }}
					/></strong
				>
			</div>
		</div>
	</section>
	<div class="histogram" aria-hidden="true">
		{#each [['0', shots.zero, 1 - probabilityOne], ['1', shots.one, probabilityOne]] as const as [label, count, expected] (label)}
			<div class="bar-row">
				<span>{label}</span>
				<i style={`inline-size:${total ? (100 * count) / total : 0}%`}></i>
				<b style={`inset-inline-start:${100 * expected}%`}></b>
			</div>
		{/each}
	</div>
	<PartReadout {host} read={probe} hint="Click a gate or qubit in the drawing to read it here." />
{/snippet}

{#snippet deck()}
	<div class="deck-group">
		<span class="microlabel">Target state</span>
		<div class="presets" role="group" aria-label="Target state">
			{#each TARGETS as entry (entry.id)}
				<button
					class="btn"
					type="button"
					data-target={entry.id}
					aria-pressed={target === entry.value}
					onclick={() => (target = entry.value)}>{entry.label}</button
				>
			{/each}
		</div>
	</div>
	<div class="deck-group">
		<span class="microlabel">Measure</span>
		<button class="btn btn-solid" type="button" data-measure onclick={measure}
			>Measure 200 shots</button
		>
	</div>
	<div class="deck-group">
		<FaultSwitch label="target prepared off its eigenstate" bind:active={offEigen} />
	</div>
{/snippet}

<style>
	.kick-canvas {
		position: relative;
	}

	.kick-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.bloch {
		display: grid;
		gap: var(--space-2);
		margin: 0;

		& svg {
			display: block;
			inline-size: min(100%, 240px);
			justify-self: center;
		}

		& figcaption {
			font: var(--text-xs) / 1.4 var(--font-mono);
			color: var(--ink-mute);
		}
	}

	.sphere {
		fill: color-mix(in srgb, var(--schematic-color-cyan) 6%, transparent);
		stroke: var(--line-strong);
	}

	.equator,
	.axis {
		fill: none;
		stroke: var(--line-strong);
		stroke-dasharray: 2 3;
	}

	.drop {
		stroke: var(--ink-faint);
		stroke-dasharray: 1 2;
	}

	.vector {
		stroke: var(--accent);
		stroke-width: 2.2;

		&.mixed {
			stroke: var(--schematic-color-purple);
		}
	}

	.tip {
		fill: var(--accent);

		&.mixed {
			fill: var(--schematic-color-purple);
		}
	}

	.bloch text {
		font-family: var(--font-mono);
		font-size: 8px;
		fill: var(--ink-faint);
		text-anchor: middle;
	}

	.stages {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
		font: var(--text-xs) / 1.5 var(--font-mono);
		color: var(--ink-mute);

		& li {
			display: flex;
			justify-content: space-between;
			gap: var(--space-2);
			padding-inline: var(--space-2);
			border-inline-start: 2px solid transparent;

			&.current {
				border-color: var(--accent);
				color: var(--ink);
			}
		}

		& output {
			font-variant-numeric: tabular-nums;
		}
	}

	.histogram {
		display: grid;
		gap: 4px;
	}

	.bar-row {
		position: relative;
		display: grid;
		grid-template-columns: 1.2em 1fr;
		align-items: center;
		gap: var(--space-2);
		font: var(--text-xs) / 1 var(--font-mono);
		color: var(--ink-mute);

		& i {
			display: block;
			block-size: 10px;
			background: var(--schematic-color-cyan);
			transition: inline-size var(--dur-med) var(--ease-precise);
		}

		& b {
			position: absolute;
			inset-block: -2px;
			margin-inline-start: 1.2em;
			inline-size: 2px;
			background: var(--accent);
		}
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

	.btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.bar-row i {
			transition: none;
		}
	}
</style>
