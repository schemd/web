<script lang="ts">
	/** Interactive 8-bit ripple-carry adder driven by compiler delegation hooks. */
	import { rippleCarry } from '$lib/simulation-models';
	import { delegatedNodeId, setNodeActive, setWireSignalFrom } from '$lib/sim-dom';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import SimulationWorkbench from './SimulationWorkbench.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let operandA = $state(43);
	let operandB = $state(86);
	let carryIn = $state<0 | 1>(0);
	let stuckCarry = $state(false);
	const timeline = useSimulationTimelineModel();

	const result = $derived(rippleCarry(operandA, operandB, carryIn, 8, stuckCarry));
	const total = $derived(result.sum + (result.carry << 8));
	const aBits = $derived(toBits(operandA));
	const bBits = $derived(toBits(operandB));
	const sumBits = $derived(toBits(result.sum));
	const binaryResult = $derived(`${result.carry}${sumBits.toReversed().join('')}`);
	const highNetCount = $derived(
		result.stages.reduce<number>(
			(count, cell) => count + cell.a + cell.b + cell.xor + cell.sum + cell.carryIn + cell.carryOut,
			carryIn
		)
	);

	function toBits(value: number): Array<0 | 1> {
		return Array.from({ length: 8 }, (_, bit) => ((Math.trunc(value) >>> bit) & 1) as 0 | 1);
	}

	function clampByte(value: number): number {
		return Math.max(0, Math.min(255, Number.isFinite(value) ? Math.trunc(value) : 0));
	}

	function toggleNode(nodeId: string): void {
		const match = /^([AB])(\d)$/.exec(nodeId);
		if (match) {
			const bit = Number(match[2]);
			const mask = 1 << bit;
			if (match[1] === 'A') operandA = operandA ^ mask;
			else operandB = operandB ^ mask;
			return;
		}
		if (nodeId === 'CIN') carryIn = carryIn === 1 ? 0 : 1;
	}

	/** One vanilla delegated listener owns every current and future input port. */
	$effect(() => {
		const root = host?.querySelector('svg');
		if (!root) return;

		const activate = (target: EventTarget | null): void => {
			if (!(target instanceof Element)) return;
			const id = delegatedNodeId(target);
			if (id && /^(?:A\d|B\d|CIN)$/.test(id)) toggleNode(id);
		};
		const onClick = (event: Event): void => activate(event.target);
		const onKeyDown = (event: Event): void => {
			if (!(event instanceof KeyboardEvent) || (event.key !== 'Enter' && event.key !== ' ')) return;
			const id = event.target instanceof Element ? delegatedNodeId(event.target) : undefined;
			if (!id || !/^(?:A\d|B\d|CIN)$/.test(id)) return;
			event.preventDefault();
			toggleNode(id);
		};

		root.addEventListener('click', onClick);
		root.addEventListener('keydown', onKeyDown);
		return () => {
			root.removeEventListener('click', onClick);
			root.removeEventListener('keydown', onKeyDown);
		};
	});

	/** Instant combinational paint pass over canonical `data-wire-source` nets. */
	$effect(() => {
		const root = host;
		if (!root) return;
		for (let bit = 0; bit < 8; bit += 1) {
			const cell = result.stages[bit]!;
			const generated = (cell.a & cell.b) as 0 | 1;
			const propagated = (cell.xor & cell.carryIn) as 0 | 1;
			const values: ReadonlyArray<readonly [string, 0 | 1]> = [
				[`A${bit}.out`, cell.a],
				[`B${bit}.out`, cell.b],
				[`X1_${bit}.out1`, cell.xor],
				[`N1_${bit}.out1`, generated],
				[`X2_${bit}.out1`, cell.sum],
				[`N2_${bit}.out1`, propagated],
				[`O1_${bit}.out1`, cell.carryOut]
			];
			for (const [source, value] of values) setWireSignalFrom(root, source, value === 1);

			setNodeActive(root, `A${bit}`, cell.a === 1);
			setNodeActive(root, `B${bit}`, cell.b === 1);
			setNodeActive(root, `X1_${bit}`, cell.xor === 1);
			setNodeActive(root, `N1_${bit}`, generated === 1);
			setNodeActive(root, `X2_${bit}`, cell.sum === 1);
			setNodeActive(root, `N2_${bit}`, propagated === 1);
			setNodeActive(root, `O1_${bit}`, cell.carryOut === 1);
			setNodeActive(root, `S${bit}`, cell.sum === 1);
		}
		setWireSignalFrom(root, 'CIN.out', carryIn === 1);
		setNodeActive(root, 'CIN', carryIn === 1);
		setNodeActive(root, 'COUT', result.carry === 1);

		for (const input of root.querySelectorAll('[data-node-id]')) {
			const id = input.getAttribute('data-node-id');
			if (!id) continue;
			const match = /^([AB])(\d)$/.exec(id);
			const value =
				id === 'CIN'
					? carryIn
					: match
						? match[1] === 'A'
							? aBits[Number(match[2])]
							: bBits[Number(match[2])]
						: undefined;
			if (value === undefined) continue;
			input.setAttribute(
				'aria-label',
				`${id} input node, current value ${value}. Activate either port to toggle.`
			);
			input.setAttribute('data-logic-state', String(value));
			for (const port of input.querySelectorAll('[data-port-id]')) {
				port.setAttribute('aria-pressed', value === 1 ? 'true' : 'false');
			}
		}
	});
</script>

<SimulationWorkbench
	eyebrow="simulation 01 · digital"
	title="Interactive ripple-carry matrix"
	status="logic network online"
	tone="digital"
	{canvas}
	{controls}
	{readouts}
/>

{#snippet canvas()}
	<div
		class="sim-stage adder-stage schemd-frame"
		bind:this={host}
		role="group"
		aria-label="Interactive 8-Bit Digital Adder schematic. Activate A, B, or carry input ports to toggle them."
		data-model-stage={timeline.step}
	>
		{@html svg}
		<div class="canvas-instruction">
			<span>direct manipulation enabled</span>
			<strong>Click any A, B, or C<sub>in</sub> port in the schematic</strong>
		</div>
	</div>
{/snippet}

{#snippet controls()}
	<div class="register-console">
		<label>
			<span>A register</span>
			<input
				type="number"
				data-lab-input="a"
				min="0"
				max="255"
				value={operandA}
				oninput={(event) => (operandA = clampByte(event.currentTarget.valueAsNumber))}
				aria-label="operand A"
			/>
			<code>0x{operandA.toString(16).padStart(2, '0').toUpperCase()}</code>
		</label>
		<div class="bit-bank" aria-label="Operand A bits, most significant first">
			{#each aBits.toReversed() as bit, index (index)}
				<span class:high={bit === 1}>{bit}</span>
			{/each}
		</div>
		<label>
			<span>B register</span>
			<input
				type="number"
				data-lab-input="b"
				min="0"
				max="255"
				value={operandB}
				oninput={(event) => (operandB = clampByte(event.currentTarget.valueAsNumber))}
				aria-label="operand B"
			/>
			<code>0x{operandB.toString(16).padStart(2, '0').toUpperCase()}</code>
		</label>
		<div class="bit-bank" aria-label="Operand B bits, most significant first">
			{#each bBits.toReversed() as bit, index (index)}
				<span class:high={bit === 1}>{bit}</span>
			{/each}
		</div>
	</div>
	<div class="aux-controls">
		<label class="carry-toggle">
			<input
				type="checkbox"
				data-lab-input="carryIn"
				checked={carryIn === 1}
				onchange={(event) => (carryIn = event.currentTarget.checked ? 1 : 0)}
			/>
			<span>carry in</span>
			<strong>{carryIn}</strong>
		</label>
		<FaultSwitch label="interrupt the carry chain" bind:active={stuckCarry} />
	</div>
{/snippet}

{#snippet readouts()}
	<div class="result-readout">
		<div>
			<span>Σ decimal</span>
			<output data-lab-signal="total" aria-label={`nine-bit result equals ${total}`}>{total}</output
			>
		</div>
		<div>
			<span>binary result</span>
			<code>{binaryResult}</code>
		</div>
		<div>
			<span>carry out</span>
			<output data-lab-signal="carryOut" aria-label={`carry out equals ${result.carry}`}
				>{result.carry}</output
			>
		</div>
	</div>
	<div class="signal-health">
		<span><i class="high"></i>{highNetCount} high paths</span>
		<span><i></i>low paths muted</span>
		<span class:warning={stuckCarry}
			>{stuckCarry ? 'carry chain interrupted' : 'propagation nominal'}</span
		>
	</div>
{/snippet}

<style>
	.adder-stage {
		position: relative;
		min-inline-size: 760px;
		border: 0;
		border-radius: 0;
		background: transparent;
		overflow: visible;
	}

	.adder-stage :global(figure) {
		margin: 0;
	}

	.adder-stage :global(svg) {
		display: block;
		inline-size: 100%;
		min-inline-size: 760px;
		background: transparent !important;
	}

	.adder-stage :global(figcaption) {
		display: none;
	}

	.adder-stage :global([data-wire-source]) {
		opacity: 0.28;
		transition:
			opacity 100ms linear,
			filter 100ms linear;
	}

	.adder-stage :global([data-wire-source] path) {
		stroke: #64717d;
		stroke-width: 1.15;
		transition:
			stroke 100ms linear,
			stroke-width 100ms linear;
	}

	.adder-stage :global([data-wire-source].signal-high) {
		opacity: 1;
		filter: drop-shadow(0 0 4px rgb(98 246 207 / 0.95)) drop-shadow(0 0 12px rgb(98 246 207 / 0.5));
	}

	.adder-stage :global([data-wire-source].signal-high path) {
		stroke: #62f6cf;
		stroke-width: 2.65;
	}

	.adder-stage :global([data-node-id]) {
		opacity: 0.42;
		transition:
			opacity 100ms linear,
			filter 100ms linear;
	}

	.adder-stage :global([data-node-id].is-active) {
		opacity: 1;
		filter: drop-shadow(0 0 6px rgb(98 246 207 / 0.66));
	}

	.adder-stage :global([data-node-id^='A']),
	.adder-stage :global([data-node-id^='B']),
	.adder-stage :global([data-node-id='CIN']) {
		cursor: pointer;
		outline: none;
	}

	.adder-stage :global([data-node-id]:focus-within) {
		filter: drop-shadow(0 0 8px #fff) drop-shadow(0 0 16px #62f6cf);
		opacity: 1;
	}

	.canvas-instruction {
		position: sticky;
		inset-inline-start: var(--space-4);
		inset-block-end: var(--space-4);
		inline-size: max-content;
		max-inline-size: calc(100% - var(--space-8));
		display: grid;
		gap: 2px;
		padding: 0.55rem 0.75rem;
		border: 1px solid rgb(98 246 207 / 0.25);
		border-radius: 6px;
		background: rgb(7 10 12 / 0.88);
		backdrop-filter: blur(8px);
		pointer-events: none;
	}

	.canvas-instruction span,
	.register-console label span,
	.result-readout span {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.canvas-instruction strong {
		font-size: var(--text-xs);
		font-weight: 540;
		color: #bfffee;
	}

	.register-console {
		display: grid;
		grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.3fr);
		gap: var(--space-2) var(--space-3);
	}

	.register-console label {
		display: grid;
		grid-template-columns: 1fr 72px 54px;
		align-items: center;
		gap: var(--space-2);
	}

	.register-console input {
		inline-size: 72px;
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: var(--bg-inset);
		color: var(--ink);
		font-family: var(--font-mono);
	}

	.register-console code {
		font-size: var(--text-xs);
		color: #62f6cf;
	}

	.bit-bank {
		display: grid;
		grid-template-columns: repeat(8, minmax(22px, 1fr));
		gap: 4px;
	}

	.bit-bank span {
		padding: 0.35rem 0;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--bg-inset);
		text-align: center;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-faint);
	}

	.bit-bank span.high {
		border-color: rgb(98 246 207 / 0.42);
		background: rgb(98 246 207 / 0.12);
		color: #bfffee;
		box-shadow: inset 0 -2px 0 #62f6cf;
	}

	.aux-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-block-start: var(--space-4);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);
	}

	.carry-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.carry-toggle input {
		accent-color: #62f6cf;
	}

	.carry-toggle strong {
		color: #62f6cf;
	}

	.result-readout {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}

	.result-readout > div {
		display: grid;
		gap: 2px;
	}

	.result-readout output,
	.result-readout code {
		font-family: var(--font-mono);
		font-size: clamp(1rem, 2.2vw, 1.45rem);
		font-variant-numeric: tabular-nums;
		color: #bfffee;
		white-space: nowrap;
	}

	.signal-health {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin-block-start: var(--space-4);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}

	.signal-health span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.signal-health i {
		inline-size: 16px;
		block-size: 2px;
		background: #64717d;
	}

	.signal-health i.high {
		background: #62f6cf;
		box-shadow: 0 0 6px #62f6cf;
	}

	.signal-health .warning {
		color: var(--danger);
	}

	@media (max-width: 700px) {
		.register-console {
			grid-template-columns: 1fr;
		}

		.register-console label,
		.result-readout {
			grid-template-columns: 1fr 72px 54px;
		}

		.result-readout {
			grid-template-columns: 1fr;
		}

		.aux-controls {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.adder-stage :global([data-wire-source]),
		.adder-stage :global([data-wire-source] path),
		.adder-stage :global([data-node-id]) {
			transition: none;
		}
	}
</style>
