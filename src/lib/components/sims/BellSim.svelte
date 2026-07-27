<script lang="ts">
	/**
	 * Bell-state entanglement visualizer.
	 *
	 * Toggling the two state-preparation nodes selects which of the four Bell
	 * states H·CNOT prepares. Amplitudes and the ⟨Z⊗Z⟩ correlation index are
	 * `$derived`; the probability plot is a native SVG bar chart; sampling
	 * accumulates real Born-rule measurements and streams the empirical
	 * correlation into the oscilloscope.
	 */
	import { delegatedNodeId, setNodeActive, setWiresFrom } from '$lib/sim-dom';
	import { playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import Oscilloscope from './Oscilloscope.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';
	import { reading, type MathReading } from '$lib/simulation-math';
	import { bellAmplitudesAtStage, bellChsh } from '$lib/simulation-models';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	let q0 = $state(0);
	let q1 = $state(0);
	let counts = $state({ '00': 0, '01': 0, '10': 0, '11': 0 });
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.5));
	let hover = $state<{ x: number; y: number; math: MathReading } | undefined>();
	let faults = $state({ brokenEntangler: false });
	const timeline = useSimulationTimelineModel();

	/**
	 * Amplitudes over the computational basis after H on q0 then CNOT(q0→q1),
	 * starting from |q0 q1⟩. With a faulted entangler the CNOT is skipped —
	 * the product state that results is exactly what "no entanglement" means.
	 */
	const amplitudes = $derived(
		bellAmplitudesAtStage(
			q0 as 0 | 1,
			q1 as 0 | 1,
			Math.min(timeline.step, 2),
			faults.brokenEntangler
		)
	);

	const outcomes = ['00', '01', '10', '11'] as const;
	const probabilities = $derived({
		'00': amplitudes['00'] ** 2,
		'01': amplitudes['01'] ** 2,
		'10': amplitudes['10'] ** 2,
		'11': amplitudes['11'] ** 2
	});

	/** ⟨Z⊗Z⟩ — +1 perfectly correlated, −1 anti-correlated. */
	const correlation = $derived(
		outcomes.reduce((sum, key) => sum + probabilities[key] * (key[0] === key[1] ? 1 : -1), 0)
	);

	/**
	 * Optimized CHSH witness. Local hidden variables cap |S| ≤ 2; a maximally
	 * entangled state reaches Tsirelson's bound 2√2 ≈ 2.83.
	 */
	const chsh = $derived(bellChsh(amplitudes));
	const TSIRELSON = 2 * Math.SQRT2;
	const violatesRealism = $derived(chsh > 2 + 1e-6);

	const bellName = $derived.by(() => {
		if (timeline.step === 0) return `|${q0}${q1}⟩`;
		if (timeline.step === 1 || faults.brokenEntangler) return 'post-H product state';
		const names = { '00': 'Φ⁺', '01': 'Ψ⁺', '10': 'Φ⁻', '11': 'Ψ⁻' } as const;
		return `|${names[`${q0}${q1}` as keyof typeof names]}⟩`;
	});

	const sampleTotal = $derived(counts['00'] + counts['01'] + counts['10'] + counts['11']);

	function sample(shots: number): void {
		const next = { ...counts };
		for (let shot = 0; shot < shots; shot += 1) {
			let roll = Math.random();
			for (const key of outcomes) {
				roll -= probabilities[key];
				if (roll <= 0) {
					next[key] += 1;
					break;
				}
			}
		}
		counts = next;
		const total = next['00'] + next['01'] + next['10'] + next['11'];
		const empirical = total === 0 ? 0 : (next['00'] + next['11'] - next['01'] - next['10']) / total;
		scope = [...scope.slice(1), 0.5 + empirical / 2];
		if (ui.audio) playTick(600);
	}

	function onStageClick(event: MouseEvent): void {
		if (!(event.target instanceof Element)) return;
		toggleNode(delegatedNodeId(event.target));
	}

	function toggleNode(id: string | undefined): void {
		if (id === 'Q0') q0 ^= 1;
		else if (id === 'Q1') q1 ^= 1;
		else return;
		counts = { '00': 0, '01': 0, '10': 0, '11': 0 };
		if (ui.audio) playTick(560);
	}

	function onStageKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!(event.target instanceof Element)) return;
		event.preventDefault();
		toggleNode(delegatedNodeId(event.target));
	}

	function gateMath(id: string): MathReading | undefined {
		if (id === 'H1') return reading('bell.gate.h', `Hadamard on qubit zero`, { q0 });
		if (id === 'CX1') return reading('bell.gate.cx', 'controlled not entangler');
		if (id === 'Q0') return reading('bell.gate.q0', `qubit zero equals ${q0}`, { value: q0 });
		if (id === 'Q1') return reading('bell.gate.q1', `qubit one equals ${q1}`, { value: q1 });
		return undefined;
	}

	function onStageMove(event: PointerEvent): void {
		if (!(event.target instanceof Element)) return;
		const id = delegatedNodeId(event.target);
		const math = id ? gateMath(id) : undefined;
		hover = math ? { x: event.clientX, y: event.clientY, math } : undefined;
	}

	$effect(() => {
		const root = host;
		if (!root) return;
		setNodeActive(root, 'Q0', q0 === 1);
		setNodeActive(root, 'Q1', q1 === 1);
		setWiresFrom(root, 'Q0.out', q0 === 1);
		setWiresFrom(root, 'Q1.out', q1 === 1);
		root
			.querySelector('[data-node-id="CX1"]')
			?.classList.toggle('is-degraded', faults.brokenEntangler);
	});

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'M0' || id === 'M1') {
			return reading(
				'bell.correlation',
				`Z tensor Z correlation ${correlation.toFixed(3)} after ${sampleTotal} shots`,
				{ value: correlation.toFixed(3), shots: sampleTotal }
			);
		}
		if (id) return gateMath(id);
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Click the two state-preparation nodes in the test bed to flip
			<strong><LiveMath id="bell.symbol.q0" label="qubit zero" /></strong> /
			<strong><LiveMath id="bell.symbol.q1" label="qubit one" /></strong> and select which Bell pair
			<LiveMath id="bell.symbol.protocol" label="Hadamard then controlled not" /> prepares.
		</p>
		<button type="button" class="btn btn-solid" onclick={() => sample(64)}>measure ×64</button>
		<span class="readout"
			><LiveMath
				id="bell.correlation"
				label={`correlation ${correlation.toFixed(2)} after ${sampleTotal} shots`}
				values={{ value: correlation.toFixed(2), shots: sampleTotal }}
			/></span
		>
	</div>
	<div class="chsh" class:violates={violatesRealism}>
		<p class="microlabel">
			<LiveMath id="bell.chsh.bound" label="CHSH witness; local realism at most two" />
		</p>
		<div class="chsh-gauge" role="img" aria-label={`CHSH S = ${chsh.toFixed(3)}`}>
			<span class="chsh-fill" style={`width: ${Math.min(100, (chsh / TSIRELSON) * 100)}%`}></span>
			<span class="chsh-classical" style={`left: ${(2 / TSIRELSON) * 100}%`}></span>
		</div>
		<div class="chsh-legend">
			<strong
				><LiveMath
					id="bell.chsh.value"
					label={`CHSH S equals ${chsh.toFixed(3)}`}
					values={{ value: chsh.toFixed(3) }}
				/></strong
			>
			<span>{violatesRealism ? 'local realism violated' : 'classically explainable'}</span>
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="CNOT entangler offline" bind:active={faults.brokenEntangler} />
	</div>
{/snippet}

{#snippet canvas()}
	<!-- The group owns delegation only; the compiler-emitted port buttons remain the interactive controls. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		onclick={onStageClick}
		onkeydown={onStageKeydown}
		onpointermove={onStageMove}
		onpointerleave={() => (hover = undefined)}
		role="group"
		data-model-stage={timeline.step}
		aria-label="Bell-state model. Click the state-preparation nodes to flip qubits."
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<p class="visually-hidden" aria-live="polite" aria-atomic="true">
		Bell laboratory {faults.brokenEntangler
			? 'degraded: entangler offline and state is separable'
			: 'nominal: entangler online'}; prepared state {bellName}; CHSH value {chsh.toFixed(3)};
		{sampleTotal} measurement samples.
	</p>
	<p class="readout state-line">
		<LiveMath id="bell.state" label={`state becomes ${bellName}`} values={{ state: bellName }} />
	</p>
	<svg class="bars" viewBox="0 0 220 90" role="img" aria-label="Outcome probabilities">
		{#each outcomes as key, index (key)}
			<rect
				class="bar"
				x={14 + index * 52}
				y={80 - probabilities[key] * 64}
				width="30"
				height={probabilities[key] * 64}
			/>
			<foreignObject x={14 + index * 52} y="78" width="30" height="12">
				<div class="bar-math">
					<LiveMath id="bell.ket" label={`basis state ${key}`} values={{ value: key }} />
				</div>
			</foreignObject>
			<text class="bar-value" x={29 + index * 52} y={74 - probabilities[key] * 64}>
				{probabilities[key].toFixed(2)}
			</text>
		{/each}
	</svg>
	<Oscilloscope
		samples={scope}
		label="empirical Z tensor Z correlation"
		labelMath={reading('bell.scope.correlation', 'empirical Z tensor Z correlation')}
	/>
{/snippet}

{#if hover}
	<output class="math-hud" style={`transform: translate(${hover.x + 16}px, ${hover.y + 12}px)`}>
		<LiveMath id={hover.math.id} label={hover.math.label} values={hover.math.values} />
	</output>
{/if}

<style>
	.stack,
	.switchboard {
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

	.state-line {
		margin: 0;
	}

	.chsh {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);

		&.violates {
			border-color: var(--accent);
			box-shadow: inset 3px 0 0 var(--accent);
		}
	}

	.chsh-gauge {
		position: relative;
		block-size: 10px;
		background: var(--bg-panel);
		border: 1px solid var(--line);
		overflow: hidden;
	}

	.chsh-fill {
		display: block;
		block-size: 100%;
		background: var(--ink-faint);
		transition: width var(--dur-med) var(--ease-precise);
	}

	.chsh.violates .chsh-fill {
		background: var(--accent);
	}

	/* The classical bound S = 2 marked as a hard line on the gauge. */
	.chsh-classical {
		position: absolute;
		inset-block: -1px;
		inline-size: 2px;
		background: var(--danger);
	}

	.chsh-legend {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);

		& strong {
			color: var(--accent-2);
		}
	}

	.chsh.violates .chsh-legend strong {
		color: var(--accent);
	}

	.bars {
		inline-size: 100%;
		max-inline-size: 220px;
		background: var(--bg-inset);
		border: 1px solid var(--line);
	}

	.bar {
		fill: var(--accent);
		opacity: 0.85;
	}

	.bar-value {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
		text-anchor: middle;
	}

	.bar-value {
		fill: var(--accent);
	}

	.bar-math {
		display: grid;
		place-items: center;
		block-size: 100%;
		font-size: 7px;
		color: var(--ink-faint);
	}

	.sim-stage {
		cursor: pointer;
	}

	.math-hud {
		position: fixed;
		inset-block-start: 0;
		inset-inline-start: 0;
		z-index: 80;
		pointer-events: none;
		padding: 0.35rem 0.65rem;
		background: var(--bg-panel);
		border: 1px solid var(--accent-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent-2);
		white-space: nowrap;
		will-change: transform;
	}
</style>
