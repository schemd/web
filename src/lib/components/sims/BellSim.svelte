<script lang="ts">
	/** Bell-state visualizer with compiler-root operator delegation and native SVG metrics. */
	import { bellAmplitudesAtStage, bellChsh, type Basis2 } from '$lib/simulation-models';
	import { delegatedNodeId, setNodeActive, setWiresFrom } from '$lib/sim-dom';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import SimulationWorkbench from './SimulationWorkbench.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let hoveredOperator = $state<string | undefined>();
	let lastMeasurement = $state<Basis2 | undefined>();
	let shots = $state<Record<Basis2, number>>({ '00': 0, '01': 0, '10': 0, '11': 0 });
	let brokenEntangler = $state(false);
	const timeline = useSimulationTimelineModel();
	const stage = $derived(Math.max(0, Math.min(3, timeline.step)));
	const amplitudes = $derived(bellAmplitudesAtStage(0, 0, stage, brokenEntangler));
	const probabilities = $derived(
		Object.fromEntries(
			(Object.keys(amplitudes) as Basis2[]).map((basis) => [basis, amplitudes[basis] ** 2])
		) as Record<Basis2, number>
	);
	const chsh = $derived(bellChsh(amplitudes));
	const totalShots = $derived(Object.values(shots).reduce((sum, value) => sum + value, 0));
	const correlation = $derived(
		totalShots === 0 ? 1 : (shots['00'] + shots['11']) / Math.max(1, totalShots)
	);
	const stageName = $derived(
		['register prepared', 'superposition formed', 'bell pair entangled', 'measurement ready'][
			stage
		] ?? 'measurement ready'
	);

	const operators: Readonly<
		Record<
			string,
			{ eyebrow: string; title: string; input: string; output: string; matrix: string }
		>
	> = {
		H1: {
			eyebrow: 'single-qubit operator',
			title: 'Hadamard transform',
			input: '|0⟩',
			output: '(|0⟩ + |1⟩) / √2',
			matrix: 'H = 1/√2 · [ 1  1 ; 1 −1 ]'
		},
		CX1: {
			eyebrow: 'controlled two-qubit operator',
			title: 'CNOT entangler',
			input: '|+0⟩',
			output: '(|00⟩ + |11⟩) / √2',
			matrix: 'CX |a,b⟩ = |a, b ⊕ a⟩'
		},
		M0: {
			eyebrow: 'projective operator',
			title: 'Z-basis measurement',
			input: '|Φ⁺⟩',
			output: '00 ∨ 11',
			matrix: 'P(00) = P(11) = 1/2'
		},
		M1: {
			eyebrow: 'projective operator',
			title: 'Z-basis measurement',
			input: '|Φ⁺⟩',
			output: '00 ∨ 11',
			matrix: '⟨q₀ ⊕ q₁⟩ = 0'
		}
	};
	const hud = $derived(hoveredOperator ? operators[hoveredOperator] : undefined);

	function stepThrough(): void {
		lastMeasurement = undefined;
		if (stage >= 2) timeline.command('seek', 0);
		else timeline.command('next');
	}

	function sampleMeasurement(): void {
		timeline.command('seek', 3);
		const roll = Math.random();
		let accumulated = 0;
		let outcome: Basis2 = '11';
		for (const basis of ['00', '01', '10', '11'] as const) {
			accumulated += probabilities[basis];
			if (roll <= accumulated) {
				outcome = basis;
				break;
			}
		}
		lastMeasurement = outcome;
		shots = { ...shots, [outcome]: shots[outcome] + 1 };
	}

	/** Delegated hover/click behavior is attached to the compiled root SVG. */
	$effect(() => {
		const root = host?.querySelector('svg');
		if (!root) return;
		for (const id of Object.keys(operators)) {
			const node = root.querySelector(`[data-node-id="${id}"]`);
			if (!node) continue;
			node.setAttribute(
				'aria-label',
				`${operators[id]!.title}. Focus or hover a port for transformation details.`
			);
			for (const port of node.querySelectorAll('[data-port-id]')) {
				const portId = port.getAttribute('data-port-id') ?? 'operator';
				port.setAttribute(
					'aria-label',
					`${operators[id]!.title} ${portId} port. Focus or hover for transformation details${id.startsWith('M') ? '; activate to measure' : ''}.`
				);
			}
		}

		const reveal = (target: EventTarget | null): void => {
			if (!(target instanceof Element)) return;
			const id = delegatedNodeId(target);
			if (id && operators[id]) hoveredOperator = id;
		};
		const conceal = (event: Event): void => {
			if (!(event instanceof PointerEvent)) return;
			const from = event.target instanceof Element ? delegatedNodeId(event.target) : undefined;
			const to =
				event.relatedTarget instanceof Element ? delegatedNodeId(event.relatedTarget) : undefined;
			if (from && from !== to && hoveredOperator === from) hoveredOperator = undefined;
		};
		const activate = (event: Event): void => {
			if (!(event.target instanceof Element)) return;
			const id = delegatedNodeId(event.target);
			if (id === 'M0' || id === 'M1') sampleMeasurement();
		};
		const onPointerOver = (event: Event): void => reveal(event.target);
		const onFocusIn = (event: Event): void => reveal(event.target);
		const onKeyDown = (event: Event): void => {
			if (!(event instanceof KeyboardEvent)) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			const id = event.target instanceof Element ? delegatedNodeId(event.target) : undefined;
			if (!id || !operators[id]) return;
			event.preventDefault();
			hoveredOperator = id;
			if (id.startsWith('M')) sampleMeasurement();
		};

		root.addEventListener('pointerover', onPointerOver);
		root.addEventListener('pointerout', conceal);
		root.addEventListener('focusin', onFocusIn);
		root.addEventListener('click', activate);
		root.addEventListener('keydown', onKeyDown);
		return () => {
			root.removeEventListener('pointerover', onPointerOver);
			root.removeEventListener('pointerout', conceal);
			root.removeEventListener('focusin', onFocusIn);
			root.removeEventListener('click', activate);
			root.removeEventListener('keydown', onKeyDown);
		};
	});

	$effect(() => {
		const root = host;
		if (!root) return;
		setNodeActive(root, 'Q0', true);
		setNodeActive(root, 'Q1', true);
		setNodeActive(root, 'H1', stage >= 1);
		setNodeActive(root, 'CX1', stage >= 2 && !brokenEntangler);
		setNodeActive(root, 'M0', stage >= 3);
		setNodeActive(root, 'M1', stage >= 3);
		setWiresFrom(root, 'Q0.out', true);
		setWiresFrom(root, 'Q1.out', true);
		setWiresFrom(root, 'H1.out', stage >= 1);
		setWiresFrom(root, 'CX1.out1', stage >= 2 && !brokenEntangler);
		setWiresFrom(root, 'CX1.out2', stage >= 2 && !brokenEntangler);
	});
</script>

<SimulationWorkbench
	eyebrow="simulation 03 · quantum"
	title="Bell-state execution field"
	status={stageName}
	tone="quantum"
	{canvas}
	{controls}
	{readouts}
/>

{#snippet canvas()}
	<div class="quantum-canvas">
		<div
			class="sim-stage quantum-stage schemd-frame net-optics"
			bind:this={host}
			role="group"
			aria-label="Bell-state quantum circuit. Hover or focus an operator for its transformation."
			data-model-stage={timeline.step}
		>
			{@html svg}
			{#if hud}
				<aside class="operator-hud" aria-live="polite">
					<span>{hud.eyebrow}</span>
					<strong>{hud.title}</strong>
					<div class="transformation">
						<code>{hud.input}</code><i>→</i><code>{hud.output}</code>
					</div>
					<p>{hud.matrix}</p>
				</aside>
			{:else}
				<p class="hover-prompt">Hover an active operator to inspect its transform</p>
			{/if}
		</div>

		<section class="probability-panel" aria-label="Live basis-state probability distribution">
			<div class="probability-heading">
				<span>state vector · Z basis</span>
				<strong
					>{brokenEntangler
						? 'separable'
						: stage >= 2
							? '|Φ⁺⟩'
							: stage === 1
								? '|+0⟩'
								: '|00⟩'}</strong
				>
			</div>
			<svg
				viewBox="0 0 260 238"
				role="img"
				aria-label="Probability bar graph for basis states 00, 01, 10, and 11"
			>
				<defs>
					<linearGradient id="bell-probability-fill" x1="0" y1="1" x2="0" y2="0">
						<stop offset="0" stop-color="#7164d9" />
						<stop offset="1" stop-color="#c5baff" />
					</linearGradient>
				</defs>
				{#each ['00', '01', '10', '11'] as basis, index (basis)}
					{@const probability = probabilities[basis as Basis2]}
					{@const barHeight = probability * 150}
					<line class="guide" x1={26 + index * 58} x2={26 + index * 58} y1="24" y2="188" />
					<rect class="bar-well" x={10 + index * 58} y="38" width="32" height="150" rx="3" />
					<rect
						class="probability-bar"
						x={10 + index * 58}
						y={188 - barHeight}
						width="32"
						height={barHeight}
						rx="3"
					/>
					<text class="value" x={26 + index * 58} y={Math.max(29, 181 - barHeight)}
						>{Math.round(probability * 100)}%</text
					>
					<text class="basis" x={26 + index * 58} y="211">|{basis}⟩</text>
				{/each}
			</svg>
			<div class="probability-footer">
				<span><i></i>theoretical amplitude²</span>
				<span
					>ΣP = {Object.values(probabilities)
						.reduce((sum, value) => sum + value, 0)
						.toFixed(2)}</span
				>
			</div>
		</section>
	</div>
{/snippet}

{#snippet controls()}
	<div class="execution-deck">
		<div class="stage-track" aria-label="Execution progress">
			{#each ['INIT', 'H', 'CNOT', 'MEASURE'] as label, index (label)}
				<span class:active={index <= stage} class:current={index === stage}>
					<i>{String(index + 1).padStart(2, '0')}</i>{label}
				</span>
			{/each}
		</div>
		<div class="quantum-actions">
			<button type="button" class="btn-ghost" onclick={stepThrough}>
				<span>{stage >= 2 ? '↺' : '→'}</span>
				{stage >= 2 ? 'Reset execution' : 'Step through execution'}
			</button>
			<button type="button" class="btn-solid" onclick={sampleMeasurement}>
				<span>⌁</span> Measure state
			</button>
		</div>
	</div>
	<div class="fault-row">
		<FaultSwitch label="detune the two-qubit gate" bind:active={brokenEntangler} />
		<p>
			{brokenEntangler
				? 'CNOT coupling offline · cross states permitted'
				: 'coherent coupling · nominal'}
		</p>
	</div>
{/snippet}

{#snippet readouts()}
	<div class="quantum-metrics">
		<div>
			<span>CHSH witness</span>
			<strong>{chsh.toFixed(3)}</strong>
			<small>{chsh > 2 ? 'non-classical' : 'classical bound'}</small>
		</div>
		<div>
			<span>correlation</span>
			<strong>{(correlation * 100).toFixed(1)}%</strong>
			<small>same-bit outcomes</small>
		</div>
		<div>
			<span>measurements</span>
			<strong>{totalShots}</strong>
			<small>{lastMeasurement ? `last · |${lastMeasurement}⟩` : 'awaiting sample'}</small>
		</div>
	</div>
	<p class="measurement-note" aria-live="polite">
		{lastMeasurement
			? `Projection complete: the register collapsed to |${lastMeasurement}⟩.`
			: 'Measurement leaves the 50/50 theoretical distribution intact until sampled.'}
	</p>
{/snippet}

<style>
	.quantum-canvas {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(250px, 0.34fr);
		min-block-size: 430px;
	}

	.quantum-stage {
		position: relative;
		display: grid;
		align-content: center;
		border: 0;
		border-radius: 0;
		background: transparent;
		overflow: hidden;
	}

	.quantum-stage :global(figure) {
		margin: 0;
	}

	.quantum-stage :global(svg) {
		inline-size: 100%;
		background: transparent !important;
	}

	.quantum-stage :global(figcaption) {
		display: none;
	}

	.quantum-stage :global([data-node-id='H1']),
	.quantum-stage :global([data-node-id='CX1']),
	.quantum-stage :global([data-node-id^='M']) {
		cursor: crosshair;
		outline: none;
	}

	.quantum-stage :global([data-wire-source].is-active) {
		opacity: 1;
		filter: drop-shadow(0 0 6px rgb(169 151 255 / 0.62));
	}

	.quantum-stage :global([data-wire-source].is-active path) {
		stroke: #b8a9ff;
		stroke-width: 2.4;
	}

	.quantum-stage :global([data-node-id]:focus-within),
	.quantum-stage :global([data-node-id]:hover) {
		opacity: 1;
		filter: drop-shadow(0 0 8px rgb(197 186 255 / 0.86));
	}

	.operator-hud,
	.hover-prompt {
		position: absolute;
		inset: var(--space-4) var(--space-4) auto auto;
		z-index: 3;
		max-inline-size: min(330px, calc(100% - var(--space-8)));
	}

	.operator-hud {
		display: grid;
		gap: 5px;
		padding: var(--space-3);
		border: 1px solid rgb(169 151 255 / 0.35);
		border-radius: 7px;
		background: rgb(10 9 18 / 0.9);
		box-shadow: 0 16px 48px -24px rgb(169 151 255 / 0.5);
		backdrop-filter: blur(12px);
		animation: hud-in 160ms var(--ease-kinetic) both;
	}

	.operator-hud > span,
	.hover-prompt,
	.probability-heading span,
	.probability-footer,
	.quantum-metrics span,
	.quantum-metrics small {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.operator-hud strong {
		font-size: var(--text-sm);
		color: #ddd7ff;
	}

	.transformation {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-2);
		color: #c5baff;
	}

	.transformation code {
		font-size: var(--text-xs);
		white-space: nowrap;
	}

	.transformation i {
		color: #8d7cff;
		font-style: normal;
	}

	.operator-hud p {
		margin: 0;
		padding-block-start: var(--space-2);
		border-block-start: 1px solid rgb(169 151 255 / 0.18);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.hover-prompt {
		margin: 0;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 10 12 / 0.78);
	}

	.probability-panel {
		display: grid;
		grid-template-rows: auto 1fr auto;
		padding: var(--space-4);
		border-inline-start: 1px solid rgb(169 151 255 / 0.18);
		background: rgb(10 9 18 / 0.68);
	}

	.probability-heading,
	.probability-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.probability-heading strong {
		font-family: var(--font-mono);
		color: #c5baff;
	}

	.probability-panel svg {
		align-self: center;
		inline-size: 100%;
		overflow: visible;
	}

	.guide {
		stroke: rgb(169 151 255 / 0.12);
		stroke-dasharray: 2 5;
	}

	.bar-well {
		fill: rgb(169 151 255 / 0.055);
		stroke: rgb(169 151 255 / 0.13);
	}

	.probability-bar {
		fill: url(#bell-probability-fill);
		filter: drop-shadow(0 0 7px rgb(169 151 255 / 0.5));
		transition:
			y 280ms var(--ease-kinetic),
			height 280ms var(--ease-kinetic);
	}

	.value,
	.basis {
		fill: #c5baff;
		font-family: var(--font-mono);
		font-size: 9px;
		text-anchor: middle;
	}

	.basis {
		fill: var(--ink-mute);
		font-size: 11px;
	}

	.probability-footer {
		padding-block-start: var(--space-3);
		border-block-start: 1px solid rgb(169 151 255 / 0.13);
		letter-spacing: 0.06em;
	}

	.probability-footer span:first-child {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.probability-footer i {
		inline-size: 6px;
		block-size: 6px;
		border-radius: 50%;
		background: #a997ff;
		box-shadow: 0 0 7px #a997ff;
	}

	.execution-deck {
		display: grid;
		gap: var(--space-4);
	}

	.stage-track {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.stage-track > span {
		position: relative;
		display: grid;
		gap: 2px;
		padding: 0.55rem 0.65rem;
		background: var(--bg-inset);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}

	.stage-track > span i {
		font-style: normal;
		color: var(--ink-faint);
	}

	.stage-track > span.active {
		color: #c5baff;
		background: rgb(169 151 255 / 0.07);
	}

	.stage-track > span.active i {
		color: #b9adff;
	}

	.stage-track > span.current::after {
		content: '';
		position: absolute;
		inset: auto 0 0;
		block-size: 2px;
		background: #a997ff;
		box-shadow: 0 0 8px #a997ff;
	}

	.quantum-actions {
		display: flex;
		gap: var(--space-2);
	}

	.quantum-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-block-size: 42px;
		padding: 0.65rem 1rem;
		border: 1px solid rgb(169 151 255 / 0.28);
		border-radius: 5px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
	}

	.btn-ghost {
		background: transparent;
		color: #c5baff;
	}

	.btn-solid {
		background: #a997ff;
		color: #100d20;
		font-weight: 650;
	}

	.quantum-actions button:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 24px -14px rgb(169 151 255 / 0.8);
	}

	.fault-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-block-start: var(--space-4);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);
	}

	.fault-row p,
	.measurement-note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		color: var(--ink-faint);
	}

	.quantum-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-3);
	}

	.quantum-metrics > div {
		display: grid;
		gap: 1px;
	}

	.quantum-metrics strong {
		font-family: var(--font-mono);
		font-size: 1.35rem;
		color: #d8d1ff;
		font-variant-numeric: tabular-nums;
	}

	.quantum-metrics small {
		letter-spacing: 0;
		text-transform: none;
	}

	.measurement-note {
		margin-block-start: var(--space-4);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);
		line-height: 1.55;
		color: var(--ink-mute);
	}

	@keyframes hud-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
	}

	@media (max-width: 900px) {
		.quantum-canvas {
			grid-template-columns: 1fr;
		}

		.probability-panel {
			border-inline-start: 0;
			border-block-start: 1px solid rgb(169 151 255 / 0.18);
		}

		.probability-panel svg {
			max-block-size: 260px;
		}
	}

	@media (max-width: 600px) {
		.stage-track,
		.quantum-metrics {
			grid-template-columns: repeat(2, 1fr);
		}

		.quantum-actions,
		.fault-row {
			align-items: stretch;
			flex-direction: column;
		}

		.quantum-actions button {
			inline-size: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.operator-hud,
		.probability-bar {
			animation: none;
			transition: none;
		}
	}
</style>
