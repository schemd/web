<script lang="ts">
	/**
	 * 4-bit Fibonacci LFSR — maximal-length m-sequence.
	 *
	 * The register is four D flip-flops; each clock edge shifts right and injects
	 * the XOR of the tapped stages. With the primitive taps {4, 3} the register
	 * visits all 2⁴−1 = 15 non-zero states before repeating. The engine is the
	 * real shift over GF(2); the compiled schematic only lights up per-stage
	 * state classes as bits ripple through.
	 */
	import { setNodeActive, setWiresFrom, delegatedNodeId } from '$lib/sim-dom';
	import { playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import Oscilloscope from './Oscilloscope.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';
	import { reading, type MathReading } from '$lib/simulation-math';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	const SEED: readonly number[] = [1, 0, 0, 0];

	let host = $state<HTMLElement | undefined>();
	/** Stages 1…4 (index 0 = stage 1, the feedback entry point). */
	let bits = $state<number[]>([...SEED]);
	let steps = $state(0);
	let period = $state<number | undefined>();
	let running = $state(false);
	let logRate = $state(0.4); /* seconds per clock */
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.15));
	let faults = $state({ movedTap: false });

	/** Feedback bit: XOR of the tapped stages. Primitive taps are {3,4}. */
	const feedback = $derived(faults.movedTap ? bits[1]! ^ bits[3]! : bits[2]! ^ bits[3]!);
	const registerValue = $derived(bits.reduce((acc, bit, index) => acc | (bit << index), 0));
	const stateString = $derived(bits.map((bit) => bit).join(''));

	/** One clock edge: shift right, inject feedback at stage 1. */
	function tick(): void {
		const injected = feedback;
		bits = [injected, bits[0]!, bits[1]!, bits[2]!];
		steps += 1;
		/* Period detection: first return to the seed after ≥1 step. */
		if (period === undefined && bits.every((bit, index) => bit === SEED[index])) {
			period = steps;
		}
		scope = [...scope.slice(1), bits[3] === 1 ? 0.85 : 0.15];
		if (ui.audio) playTick(440 + feedback * 180);
	}

	function reseed(): void {
		bits = [...SEED];
		steps = 0;
		period = undefined;
		if (ui.audio) playTick(560);
	}

	/* Autorun clock. */
	$effect(() => {
		if (!running) return;
		const timer = setInterval(tick, Math.max(60, logRate * 1000));
		return () => clearInterval(timer);
	});

	/* Paint register state into the compiled schematic. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const ids = ['Q1', 'Q2', 'Q3', 'Q4'];
		for (const [index, id] of ids.entries()) {
			setNodeActive(root, id, bits[index] === 1);
			setWiresFrom(root, `${id}.q`, bits[index] === 1);
		}
		setNodeActive(root, 'FB', feedback === 1);
		setWiresFrom(root, 'FB.out', feedback === 1);
		setNodeActive(root, 'OUT', bits[3] === 1);
	});

	function onStageClick(event: MouseEvent): void {
		if (!(event.target instanceof Element)) return;
		if (delegatedNodeId(event.target) === 'CLK') tick();
	}

	function onStageKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!(event.target instanceof Element)) return;
		if (delegatedNodeId(event.target) !== 'CLK') return;
		event.preventDefault();
		tick();
	}

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'CLK') return reading('lfsr.probe.clock', `${steps} clock edges`, { value: steps });
		if (id === 'FB')
			return reading('lfsr.probe.feedback', `feedback ${feedback}`, { value: feedback });
		const stage = id?.match(/^Q(\d)$/);
		if (stage)
			return reading('lfsr.probe.stage', `stage ${stage[1]} is ${bits[Number(stage[1]) - 1]}`, {
				stage: stage[1]!,
				value: bits[Number(stage[1]) - 1]!
			});
		if (id === 'OUT')
			return reading('lfsr.probe.output', `serial output ${bits[3]} at sequence bit ${steps}`, {
				value: bits[3]!,
				step: steps
			});
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Each clock edge shifts the register right and injects
			<strong
				><LiveMath
					id="lfsr.probe.feedback"
					label={`stage three xor stage four equals ${feedback}`}
					values={{ value: feedback }}
				/></strong
			>. Click the
			<strong>clk</strong> symbol to single-step, or run it free.
		</p>
		<div class="button-row">
			<button type="button" class="btn" aria-pressed={running} onclick={() => (running = !running)}>
				{running ? 'pause' : 'run'}
			</button>
			<button type="button" class="btn" onclick={tick} disabled={running}>step</button>
			<button type="button" class="btn" onclick={reseed}>reseed 1000</button>
		</div>
		<label>
			<span class="microlabel"
				><LiveMath
					id="lfsr.control.period"
					label={`clock period ${(logRate * 1000).toFixed(0)} milliseconds`}
					values={{ value: (logRate * 1000).toFixed(0) }}
				/></span
			>
			<input
				type="range"
				min="0.06"
				max="1"
				step="0.02"
				bind:value={logRate}
				aria-label="Clock rate"
			/>
		</label>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch
			label="feedback tap moved to {'{2,4}'} (short cycle)"
			bind:active={faults.movedTap}
		/>
	</div>
{/snippet}

{#snippet canvas()}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		onclick={onStageClick}
		onkeydown={onStageKeydown}
		role="group"
		aria-label="4-bit LFSR. Click the clock to advance the register."
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="readouts">
		<span class="readout state"
			><LiveMath
				id="lfsr.readout.state"
				label={`register state ${stateString}, decimal ${registerValue}`}
				values={{ bits: stateString, value: registerValue }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="lfsr.readout.edges"
				label={`${steps} clock edges`}
				values={{ value: steps }}
			/></span
		>
		<span class="readout" class:locked={period !== undefined} class:short={faults.movedTap}>
			<LiveMath
				id="lfsr.readout.period"
				label={period === undefined ? 'period searching' : `period ${period}`}
				values={{
					value:
						period === undefined
							? 'searching…'
							: `${period}${period === 15 ? ' (maximal)' : ' (short)'}`
				}}
			/>
		</span>
	</div>
	<div class="register" aria-label="Register bits">
		{#each bits as bit, index (index)}
			<span class="cell" class:hot={bit === 1}>{bit}</span>
		{/each}
	</div>
	<Oscilloscope samples={scope} label="serial m-sequence" />
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

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.button-row .btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}

	label {
		display: grid;
		gap: 2px;
	}

	input[type='range'] {
		accent-color: var(--accent);
	}

	.readouts {
		display: grid;
		gap: var(--space-1);
	}

	.state {
		color: var(--accent-2);
		font-family: var(--font-mono);
	}

	.locked {
		color: var(--ok);
	}

	.short {
		color: var(--danger);
	}

	.register {
		display: flex;
		gap: var(--space-2);
	}

	.cell {
		inline-size: 2.2rem;
		block-size: 2.2rem;
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: var(--text-md);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
		color: var(--ink-faint);
		transition:
			color var(--dur-fast) var(--ease-precise),
			background-color var(--dur-fast) var(--ease-precise),
			border-color var(--dur-fast) var(--ease-precise);
	}

	.cell.hot {
		color: var(--accent-ink);
		background: var(--accent);
		border-color: var(--accent);
	}

	.sim-stage {
		cursor: pointer;

		:global(svg) {
			min-inline-size: 1120px;
		}

		:global([data-wire-source]),
		:global([data-node-id]) {
			opacity: 0.3;
			filter: grayscale(0.8);
			transition:
				opacity var(--dur-med) var(--ease-precise),
				filter var(--dur-med) var(--ease-precise);
		}

		:global([data-wire-source].is-active),
		:global([data-node-id].is-active) {
			opacity: 1;
			filter: drop-shadow(0 0 4px var(--glow));
		}

		:global([data-node-id='CLK']:not(.is-active)) {
			opacity: 0.6;
		}
	}
</style>
