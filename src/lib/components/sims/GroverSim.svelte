<script lang="ts">
	/**
	 * Grover's algorithm over N = 8 basis states (3 qubits).
	 *
	 * The engine is the exact real-amplitude state vector. Each round applies the
	 * oracle (sign-flip on the marked state) then the diffusion operator
	 * (inversion about the mean). Amplitudes stay real throughout this
	 * construction, so an 8-element array is the whole simulator — the bar chart
	 * is a direct plot of |aᵢ|². The compiled schematic pulses its oracle and
	 * diffusion blocks as the rotation proceeds.
	 */
	import { setNodeActive, delegatedNodeId } from '$lib/sim-dom';
	import { playSuccess, playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	const N = 8;
	const UNIFORM = 1 / Math.sqrt(N);
	const OPTIMAL = Math.floor((Math.PI / 4) * Math.sqrt(N)); /* = 2 for N = 8 */

	let host = $state<HTMLElement | undefined>();
	let target = $state(0b101); /* the marked item; set by the 3 qubit toggles */
	let amplitudes = $state<number[]>(Array.from({ length: N }, () => UNIFORM));
	let rounds = $state(0);
	let phase = $state<'idle' | 'oracle' | 'diffuse'>('idle');
	let faults = $state({ wrongOracle: false });

	const probabilities = $derived(amplitudes.map((a) => a * a));
	const markedIndex = $derived(faults.wrongOracle ? target ^ 0b001 : target);
	const pTarget = $derived(probabilities[target]!);
	const label = (index: number): string => index.toString(2).padStart(3, '0');

	function reset(): void {
		amplitudes = Array.from({ length: N }, () => UNIFORM);
		rounds = 0;
		phase = 'idle';
	}

	/** One Grover iteration: oracle sign-flip, then inversion about the mean. */
	async function applyRound(): Promise<void> {
		phase = 'oracle';
		const oracled = amplitudes.map((a, index) => (index === markedIndex ? -a : a));
		amplitudes = oracled;
		if (ui.audio) playTick(520);
		await delay(280);
		phase = 'diffuse';
		const mean = oracled.reduce((sum, a) => sum + a, 0) / N;
		amplitudes = oracled.map((a) => 2 * mean - a);
		rounds += 1;
		await delay(280);
		phase = 'idle';
		if (ui.audio) {
			if (rounds === OPTIMAL && !faults.wrongOracle) playSuccess();
			else playTick(600);
		}
	}

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function runToOptimum(): Promise<void> {
		reset();
		for (let round = 0; round < OPTIMAL; round += 1) {
			await applyRound();
			await delay(160);
		}
	}

	/** Toggle one bit of the target and restart the search. */
	function toggleTargetBit(bit: number): void {
		target ^= 1 << bit;
		reset();
		if (ui.audio) playTick(500 + bit * 60);
	}

	/* Paint the algorithm phase into the schematic. */
	$effect(() => {
		const root = host;
		if (!root) return;
		setNodeActive(root, 'ORACLE', phase === 'oracle');
		setNodeActive(root, 'DIFF', phase === 'diffuse');
		for (let index = 0; index < 3; index += 1) {
			setNodeActive(root, `M${index}`, ((target >> (2 - index)) & 1) === 1 && pTarget > 0.5);
		}
	});

	function probe(element: Element): string | undefined {
		const id = delegatedNodeId(element);
		if (id === 'ORACLE') return `U_f marks |${label(markedIndex)}⟩ (phase flip)`;
		if (id === 'DIFF') return `diffusion: aᵢ → 2⟨a⟩ − aᵢ`;
		const measure = id?.match(/^M(\d)$/);
		if (measure) return `qubit ${measure[1]} · P(target) = ${(pTarget * 100).toFixed(1)}%`;
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Mark one of the eight states, then rotate the whole register toward it. The optimum is
			<strong>{OPTIMAL} rounds</strong> — more over-rotates past the target.
		</p>
		<div class="target-picker">
			<span class="microlabel">marked state |q₂q₁q₀⟩</span>
			<div class="qubits">
				{#each [2, 1, 0] as bit (bit)}
					<button
						type="button"
						class="qubit"
						class:on={((target >> bit) & 1) === 1}
						onclick={() => toggleTargetBit(bit)}
						aria-pressed={((target >> bit) & 1) === 1}
					>
						{(target >> bit) & 1}
					</button>
				{/each}
				<span class="target-ket">= |{label(target)}⟩</span>
			</div>
		</div>
		<div class="button-row">
			<button type="button" class="btn btn-solid" onclick={applyRound}>apply round</button>
			<button type="button" class="btn" onclick={runToOptimum}>run to optimum</button>
			<button type="button" class="btn" onclick={reset}>reset</button>
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="oracle marks the wrong state" bind:active={faults.wrongOracle} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		aria-label="Grover 3-qubit search circuit"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="readouts">
		<span class="readout">round {rounds} / optimum {OPTIMAL}</span>
		<span class="readout big" class:peak={pTarget > 0.9} class:faulted={faults.wrongOracle}>
			P(|{label(target)}⟩) = {(pTarget * 100).toFixed(1)}%
		</span>
		<span class="readout phase">phase: {phase}</span>
	</div>
	<svg class="bars" viewBox="0 0 240 130" role="img" aria-label="Amplitude probabilities">
		{#each probabilities as probability, index (index)}
			<rect
				class="bar"
				class:target={index === target}
				x={8 + index * 29}
				y={104 - probability * 96}
				width="20"
				height={Math.max(0, probability * 96)}
			/>
			<text class="bar-label" x={18 + index * 29} y="118">{label(index)}</text>
		{/each}
		<line class="uniform-line" x1="4" x2="236" y1={104 - (1 / N) * 96} y2={104 - (1 / N) * 96} />
	</svg>
	<p class="hint microlabel">dashed line = uniform 1/8 · target bar in accent</p>
{/snippet}

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

	.target-picker {
		display: grid;
		gap: var(--space-2);
	}

	.qubits {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.qubit {
		inline-size: 2.2rem;
		block-size: 2.2rem;
		font-family: var(--font-mono);
		font-size: var(--text-md);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
		color: var(--ink-faint);
		transition:
			color var(--dur-fast) var(--ease-precise),
			background-color var(--dur-fast) var(--ease-precise);

		&.on {
			color: var(--accent-ink);
			background: var(--accent);
			border-color: var(--accent);
		}
	}

	.target-ket {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--accent-2);
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.readouts {
		display: grid;
		gap: var(--space-1);
	}

	.big {
		font-size: var(--text-md);
		color: var(--accent-2);
	}

	.big.peak {
		color: var(--ok);
	}

	.big.faulted {
		color: var(--danger);
	}

	.phase {
		font-family: var(--font-mono);
		color: var(--ink-faint);
	}

	.bars {
		inline-size: 100%;
		max-inline-size: 260px;
		background: var(--bg-inset);
		border: 1px solid var(--line);
	}

	.bar {
		fill: var(--ink-faint);
		opacity: 0.7;
		transition:
			y var(--dur-med) var(--ease-precise),
			height var(--dur-med) var(--ease-precise);
	}

	.bar.target {
		fill: var(--accent);
		opacity: 1;
	}

	.bar-label {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
		text-anchor: middle;
	}

	.uniform-line {
		stroke: var(--accent-2);
		stroke-width: 0.6;
		stroke-dasharray: 3 2;
		opacity: 0.7;
	}

	.hint {
		margin: 0;
	}

	.sim-stage {
		:global(svg) {
			min-inline-size: 1180px;
		}

		:global([data-node-id='ORACLE']),
		:global([data-node-id='DIFF']) {
			transition: filter var(--dur-fast) var(--ease-precise);
		}

		:global([data-node-id].is-active) {
			filter: drop-shadow(0 0 6px var(--glow));
		}
	}
</style>
