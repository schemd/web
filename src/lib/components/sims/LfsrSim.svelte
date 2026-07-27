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
	import { lfsrFeedback, lfsrPeriod, lfsrStep, type LfsrBits } from '$lib/simulation-models';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	const SEED: LfsrBits = [1, 0, 0, 0];

	let host = $state<HTMLElement | undefined>();
	/** Stages 1…4 (index 0 = stage 1, the feedback entry point). */
	let bits = $state<LfsrBits>(SEED);
	let steps = $state(0);
	let period = $state<number | undefined>();
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.15));
	let faults = $state({ movedTap: false });
	let preEdge = $state<LfsrBits>(SEED);
	let postEdge = $state<LfsrBits>(lfsrStep(SEED));
	let capturedRunId = -1;
	let committedRunId = -1;
	let capturedFault = false;
	const timeline = useSimulationTimelineModel();
	const running = $derived(timeline.playing);

	/** Feedback bit: XOR of the tapped stages. Primitive taps are {3,4}. */
	const visibleBits = $derived(timeline.step >= 2 ? postEdge : preEdge);
	const feedback = $derived(lfsrFeedback(preEdge, faults.movedTap));
	const modelPeriod = $derived(lfsrPeriod(SEED, faults.movedTap));
	const registerValue = $derived(
		visibleBits.reduce<number>((acc, bit, index) => acc | (bit << index), 0)
	);
	const stateString = $derived(visibleBits.map((bit) => bit).join(''));

	/** Begin one causal edge; the shared timeline commits it at the output stage. */
	function tick(): void {
		timeline.command('reset');
		timeline.command('play');
	}

	function reseed(): void {
		bits = SEED;
		steps = 0;
		period = undefined;
		timeline.command('reset');
		if (ui.audio) playTick(560);
	}

	/* Snapshot the pre-edge register once per run. Previous/Next then derives
	 * every frame from that immutable pair, and the final stage commits once. */
	$effect(() => {
		const runId = timeline.runId;
		if (faults.movedTap !== capturedFault) {
			capturedFault = faults.movedTap;
			bits = SEED;
			steps = 0;
			period = undefined;
		}
		if (runId !== capturedRunId) {
			capturedRunId = runId;
			committedRunId = -1;
			preEdge = bits;
			postEdge = lfsrStep(bits, faults.movedTap);
		}
		if (timeline.step >= 3 && committedRunId !== runId) {
			committedRunId = runId;
			bits = postEdge;
			steps += 1;
			if (period === undefined && steps >= modelPeriod) period = modelPeriod;
			scope = [...scope.slice(1), postEdge[3] === 1 ? 0.85 : 0.15];
			if (ui.audio) playTick(440 + lfsrFeedback(preEdge, faults.movedTap) * 180);
		}
	});

	/* Paint register state into the compiled schematic. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const ids = ['Q1', 'Q2', 'Q3', 'Q4'];
		for (const [index, id] of ids.entries()) {
			setNodeActive(root, id, visibleBits[index] === 1);
			setWiresFrom(root, `${id}.q`, visibleBits[index] === 1);
		}
		setNodeActive(root, 'FB', feedback === 1);
		/* `xor.out` is a compatibility alias; full-mode metadata exposes the
		 * canonical indexed terminal used by timeline and live-state tooling. */
		setWiresFrom(root, 'FB.out1', feedback === 1);
		setNodeActive(root, 'OUT', visibleBits[3] === 1);
	});

	function onStageClick(event: MouseEvent): void {
		if (!(event.target instanceof Element)) return;
		if (delegatedNodeId(event.target) === 'CLK') {
			event.stopPropagation();
			tick();
		}
	}

	function onStageKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!(event.target instanceof Element)) return;
		if (delegatedNodeId(event.target) !== 'CLK') return;
		event.preventDefault();
		event.stopPropagation();
		tick();
	}

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'CLK') return reading('lfsr.probe.clock', `${steps} clock edges`, { value: steps });
		if (id === 'FB')
			return reading('lfsr.probe.feedback', `feedback ${feedback}`, { value: feedback });
		const stage = id?.match(/^Q(\d)$/);
		if (stage)
			return reading(
				'lfsr.probe.stage',
				`stage ${stage[1]} is ${visibleBits[Number(stage[1]) - 1]}`,
				{
					stage: stage[1]!,
					value: visibleBits[Number(stage[1]) - 1]!
				}
			);
		if (id === 'OUT')
			return reading(
				'lfsr.probe.output',
				`serial output ${visibleBits[3]} at sequence bit ${steps}`,
				{
					value: visibleBits[3]!,
					step: steps
				}
			);
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
			<button
				type="button"
				class="btn"
				aria-pressed={running}
				onclick={() => timeline.command(running ? 'pause' : 'play')}
			>
				{running ? 'pause' : 'run'}
			</button>
			<button type="button" class="btn" onclick={tick} disabled={running}>step</button>
			<button type="button" class="btn" onclick={reseed}>reseed 1000</button>
		</div>
		<p class="control-note">Clock timing follows the causal stage delay configured above.</p>
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
		data-model-stage={timeline.step}
		aria-label="LFSR register. Click the clock to advance it."
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<p class="visually-hidden" aria-live="polite" aria-atomic="true">
		LFSR {running ? 'running' : 'paused'}; feedback network {faults.movedTap
			? 'degraded with a moved tap'
			: 'nominal'}; {period === undefined
			? 'period not yet observed'
			: `observed period ${period}`}.
	</p>
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
