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

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	let q0 = $state(0);
	let q1 = $state(0);
	let counts = $state({ '00': 0, '01': 0, '10': 0, '11': 0 });
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.5));
	let hover = $state<{ x: number; y: number; math: string } | undefined>();
	let faults = $state({ brokenEntangler: false });

	const INV_SQRT2 = 1 / Math.SQRT2;

	/**
	 * Amplitudes over the computational basis after H on q0 then CNOT(q0→q1),
	 * starting from |q0 q1⟩. With a faulted entangler the CNOT is skipped —
	 * the product state that results is exactly what "no entanglement" means.
	 */
	const amplitudes = $derived.by(() => {
		const state: Record<'00' | '01' | '10' | '11', number> = { '00': 0, '01': 0, '10': 0, '11': 0 };
		const sign = q0 === 1 ? -1 : 1;
		if (faults.brokenEntangler) {
			/* (|0⟩ ± |1⟩)/√2 ⊗ |q1⟩ */
			state[q1 === 0 ? '00' : '01'] = INV_SQRT2;
			state[q1 === 0 ? '10' : '11'] = sign * INV_SQRT2;
		} else {
			/* CNOT flips the target on the |1x⟩ branch. */
			state[q1 === 0 ? '00' : '01'] = INV_SQRT2;
			state[q1 === 0 ? '11' : '10'] = sign * INV_SQRT2;
		}
		return state;
	});

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
	 * CHSH correlator E(θ_a, θ_b) = ⟨ψ| M(θ_a) ⊗ M(θ_b) |ψ⟩ for the real state,
	 * where M(θ) = cos θ·Z + sin θ·X is a ±1-outcome measurement in the x–z plane.
	 */
	function correlator(thetaA: number, thetaB: number): number {
		const opA = [
			[Math.cos(thetaA), Math.sin(thetaA)],
			[Math.sin(thetaA), -Math.cos(thetaA)]
		];
		const opB = [
			[Math.cos(thetaB), Math.sin(thetaB)],
			[Math.sin(thetaB), -Math.cos(thetaB)]
		];
		const psi = [amplitudes['00'], amplitudes['01'], amplitudes['10'], amplitudes['11']];
		let expectation = 0;
		for (let i = 0; i < 2; i += 1)
			for (let j = 0; j < 2; j += 1)
				for (let k = 0; k < 2; k += 1)
					for (let l = 0; l < 2; l += 1)
						expectation += psi[i * 2 + j]! * opA[i]![k]! * opB[j]![l]! * psi[k * 2 + l]!;
		return expectation;
	}

	/**
	 * CHSH witness S at the optimal angles. Local hidden variables cap |S| ≤ 2;
	 * an entangled state reaches Tsirelson's bound 2√2 ≈ 2.83.
	 */
	const chsh = $derived.by(() => {
		const a0 = 0;
		const aPrime = Math.PI / 2;
		const b0 = Math.PI / 4;
		const bPrime = -Math.PI / 4;
		const s =
			correlator(a0, b0) +
			correlator(a0, bPrime) +
			correlator(aPrime, b0) -
			correlator(aPrime, bPrime);
		return Math.abs(s);
	});
	const TSIRELSON = 2 * Math.SQRT2;
	const violatesRealism = $derived(chsh > 2 + 1e-6);

	const bellName = $derived.by(() => {
		if (faults.brokenEntangler) return 'product state (no entanglement)';
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

	const GATE_MATH: Record<string, string> = {
		H1: 'H|q₀⟩ = (|0⟩ + (−1)^{q₀}|1⟩)/√2',
		CX1: 'CNOT: |a⟩|b⟩ → |a⟩|b ⊕ a⟩',
		Q0: 'state preparation: |q₀⟩ ∈ {|0⟩, |1⟩} — click to flip',
		Q1: 'state preparation: |q₁⟩ ∈ {|0⟩, |1⟩} — click to flip'
	};

	function onStageMove(event: PointerEvent): void {
		if (!(event.target instanceof Element)) return;
		const id = delegatedNodeId(event.target);
		const math = id ? GATE_MATH[id] : undefined;
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

	function probe(element: Element): string | undefined {
		const id = delegatedNodeId(element);
		if (id === 'M0' || id === 'M1') {
			return `⟨Z⊗Z⟩ = ${correlation.toFixed(3)} · ${sampleTotal} shots`;
		}
		if (id && id in GATE_MATH) return GATE_MATH[id];
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Click the two state-preparation nodes in the test bed to flip <strong>q₀</strong> /
			<strong>q₁</strong> and select which Bell pair H·CNOT prepares.
		</p>
		<button type="button" class="btn btn-solid" onclick={() => sample(64)}>measure ×64</button>
		<span class="readout">⟨Z⊗Z⟩ = {correlation.toFixed(2)} · {sampleTotal} shots</span>
	</div>
	<div class="chsh" class:violates={violatesRealism}>
		<p class="microlabel">CHSH witness · local realism ≤ 2</p>
		<div class="chsh-gauge" role="img" aria-label={`CHSH S = ${chsh.toFixed(3)}`}>
			<span class="chsh-fill" style={`width: ${Math.min(100, (chsh / TSIRELSON) * 100)}%`}></span>
			<span class="chsh-classical" style={`left: ${(2 / TSIRELSON) * 100}%`}></span>
		</div>
		<div class="chsh-legend">
			<strong>S = {chsh.toFixed(3)}</strong>
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
		aria-label="Bell state circuit. Click the state-preparation nodes to flip qubits."
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<p class="readout state-line">|ψ⟩ → {bellName}</p>
	<svg class="bars" viewBox="0 0 220 90" role="img" aria-label="Outcome probabilities">
		{#each outcomes as key, index (key)}
			<rect
				class="bar"
				x={14 + index * 52}
				y={80 - probabilities[key] * 64}
				width="30"
				height={probabilities[key] * 64}
			/>
			<text class="bar-label" x={29 + index * 52} y="88">|{key}⟩</text>
			<text class="bar-value" x={29 + index * 52} y={74 - probabilities[key] * 64}>
				{probabilities[key].toFixed(2)}
			</text>
		{/each}
	</svg>
	<Oscilloscope samples={scope} label="⟨Z⊗Z⟩ empirical" />
{/snippet}

{#if hover}
	<output class="math-hud" style={`transform: translate(${hover.x + 16}px, ${hover.y + 12}px)`}>
		{hover.math}
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

	.bar-label,
	.bar-value {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
		text-anchor: middle;
	}

	.bar-value {
		fill: var(--accent);
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
