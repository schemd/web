<script lang="ts">
	/**
	 * 8-bit ripple-carry adder simulation.
	 *
	 * Clicking an input port toggles its bit; a synchronous logic pass then
	 * recomputes every intermediate net and flips `is-active` on the wires the
	 * compiler emitted — active nets glow, idle nets stay muted. One click
	 * listener on the root SVG container does all delegation.
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
	let a = $state(0b0010_1011);
	let b = $state(0b0101_0110);
	let cin = $state(0);
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0));
	let faults = $state({ stuckCarry: false });

	const BITS = 8;

	/** One combinational pass, mirroring the gate network exactly. */
	const nets = $derived.by(() => {
		const values = new Map<string, number>();
		let carry = faults.stuckCarry ? 0 : cin;
		values.set('CIN.out', cin);
		for (let bit = 0; bit < BITS; bit += 1) {
			const av = (a >> bit) & 1;
			const bv = (b >> bit) & 1;
			const axb = av ^ bv;
			const sum = axb ^ carry;
			const c1 = av & bv;
			const c2 = axb & carry;
			const cout = faults.stuckCarry ? 0 : c1 | c2;
			values.set(`A${bit}.out`, av);
			values.set(`B${bit}.out`, bv);
			values.set(`X1_${bit}.out`, axb);
			values.set(`X2_${bit}.out`, sum);
			values.set(`N1_${bit}.out`, c1);
			values.set(`N2_${bit}.out`, c2);
			values.set(`O1_${bit}.out`, cout);
			carry = cout;
		}
		return values;
	});

	const sum = $derived.by(() => {
		let total = 0;
		for (let bit = 0; bit < BITS; bit += 1) {
			total |= (nets.get(`X2_${bit}.out`) ?? 0) << bit;
		}
		return total;
	});
	const carryOut = $derived(nets.get(`O1_${BITS - 1}.out`) ?? 0);

	/* Paint the logic pass into the compiled SVG's state classes. */
	$effect(() => {
		const root = host;
		if (!root) return;
		for (const [endpoint, value] of nets) {
			setWiresFrom(root, endpoint, value === 1);
			setNodeActive(root, endpoint.split('.')[0]!, value === 1);
		}
		for (let bit = 0; bit < BITS; bit += 1) {
			setNodeActive(root, `S${bit}`, ((sum >> bit) & 1) === 1);
		}
		setNodeActive(root, 'COUT', carryOut === 1);
	});

	/* Feed the oscilloscope a rolling logic trace of the sum's LSB rail. */
	$effect(() => {
		const next = [...scope.slice(1), (sum & 1) === 1 ? 0.85 : 0.15];
		const timer = setTimeout(() => (scope = next), 80);
		return () => clearTimeout(timer);
	});

	function onStageClick(event: MouseEvent): void {
		if (!(event.target instanceof Element)) return;
		const id = delegatedNodeId(event.target);
		if (!id) return;
		const bitMatch = id.match(/^([AB])(\d)$/);
		if (bitMatch) {
			const bit = Number(bitMatch[2]);
			if (bitMatch[1] === 'A') a ^= 1 << bit;
			else b ^= 1 << bit;
			if (ui.audio) playTick(500 + bit * 40);
		} else if (id === 'CIN') {
			cin ^= 1;
			if (ui.audio) playTick(460);
		}
	}

	function randomize(): void {
		a = Math.floor(Math.random() * 256);
		b = Math.floor(Math.random() * 256);
		if (ui.audio) playTick(560);
	}

	function clearInputs(): void {
		a = 0;
		b = 0;
		cin = 0;
		if (ui.audio) playTick(420);
	}

	/** Probe reading used by the lab-wide diagnostic HUD. */
	function probe(element: Element): string | undefined {
		const wire = element.closest('[data-wire-source]')?.getAttribute('data-wire-source');
		if (wire && nets.has(wire)) {
			return `${wire} = logic ${nets.get(wire)} (${nets.get(wire) === 1 ? '5.0 V' : '0.0 V'})`;
		}
		const node = delegatedNodeId(element);
		if (!node) return undefined;
		const out = nets.get(`${node}.out`);
		if (out !== undefined) return `${node}.out = logic ${out}`;
		const sumBit = node.match(/^S(\d)$/);
		if (sumBit) return `${node} = logic ${(sum >> Number(sumBit[1])) & 1}`;
		if (node === 'COUT') return `COUT = logic ${carryOut}`;
		return undefined;
	}

	function bitString(value: number): string {
		return value.toString(2).padStart(8, '0');
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Click any <strong>A</strong>, <strong>B</strong>, or <strong>C_in</strong> port in the test
			bed to toggle its bit. The combinational pass re-evaluates and the carry ripples left to right.
		</p>
		<div class="button-row">
			<button type="button" class="btn" onclick={randomize}>randomize A,B</button>
			<button type="button" class="btn" onclick={clearInputs}>clear</button>
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="carry chain stuck-at-0" bind:active={faults.stuckCarry} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		onclick={onStageClick}
		role="application"
		aria-label="Interactive 8-bit adder schematic. Click input ports to toggle bits."
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="readouts">
		<span class="readout">A = {bitString(a)} ({a})</span>
		<span class="readout">B = {bitString(b)} ({b})</span>
		<span class="readout">C_in = {cin}</span>
		<span class="readout sum" class:faulted={faults.stuckCarry}>
			Σ = {bitString(sum)}
		</span>
		<span class="readout sum" class:faulted={faults.stuckCarry}>
			= {sum + (carryOut << 8)} · C_out = {carryOut}
		</span>
	</div>
	<Oscilloscope samples={scope} label="S₀ rail" />
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

	.readouts {
		display: grid;
		gap: var(--space-1);
	}

	.sum {
		color: var(--ok);

		&.faulted {
			color: var(--danger);
		}
	}

	.sim-stage {
		cursor: pointer;

		:global(svg) {
			min-inline-size: 1040px;
		}

		/* Inactive nets/nodes recede to a dim, desaturated wash… */
		:global([data-wire-source]),
		:global([data-node-id]) {
			opacity: 0.26;
			filter: grayscale(0.85);
			transition:
				opacity var(--dur-med) var(--ease-precise),
				filter var(--dur-med) var(--ease-precise);
		}

		/* …while nets carrying a logic-1 (the live propagation) light up. */
		:global([data-wire-source].is-active) {
			opacity: 1;
			filter: drop-shadow(0 0 4px var(--glow));
		}

		:global([data-node-id].is-active) {
			opacity: 1;
			filter: drop-shadow(0 0 5px var(--glow));
		}

		/* Keep the clickable input ports discoverable even at logic 0. */
		:global([data-node-id^='A']:not(.is-active)),
		:global([data-node-id^='B']:not(.is-active)),
		:global([data-node-id='CIN']:not(.is-active)) {
			opacity: 0.5;
			filter: grayscale(0.5);
		}
	}
</style>
