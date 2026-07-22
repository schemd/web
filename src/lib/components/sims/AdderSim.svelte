<script lang="ts">
	/**
	 * 8-bit ripple-carry adder simulation.
	 *
	 * Clicking an input port toggles its bit; a synchronous logic pass then
	 * recomputes every net and lights it through the 0.3.2 `data-net-id` hooks —
	 * high-signal nets glow via the shared `.net-optics` system, idle nets stay
	 * muted. One click listener on the root SVG container does all delegation.
	 */
	import { delegatedNodeId, setNetLevels, setNodeActive } from '$lib/sim-dom';
	import {
		SIMULATION_TIMELINE_EVENT,
		type SimulationTimelineDetail
	} from '$lib/simulation-timelines';
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
	const INITIAL_A = 0b0010_1011;
	const INITIAL_B = 0b0101_0110;
	let a = $state(INITIAL_A);
	let b = $state(INITIAL_B);
	let cin = $state(0);
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0));
	let faults = $state({ stuckCarry: false });
	/** How many bit positions have settled since the last input change. */
	let frontier = $state(8);
	/** Last result that reached the output register; pending inputs cannot jump it. */
	let committedSum = $state(INITIAL_A + INITIAL_B);
	let committedCarry = $state(0);

	const BITS = 8;
	/** Worst-case critical path: two gate delays of carry per cell, plus the final sum. */
	const MODEL_GATE_DELAY_NS = 6;
	const criticalNs = (2 * BITS + 1) * MODEL_GATE_DELAY_NS;
	const settling = $derived(frontier < BITS);

	/** One combinational pass, mirroring the gate network exactly. */
	const nets = $derived.by(() => {
		const values: Record<string, number> = {};
		let carry = faults.stuckCarry ? 0 : cin;
		values['CIN.out'] = cin;
		for (let bit = 0; bit < BITS; bit += 1) {
			const av = (a >> bit) & 1;
			const bv = (b >> bit) & 1;
			const axb = av ^ bv;
			const sum = axb ^ carry;
			const c1 = av & bv;
			const c2 = axb & carry;
			const cout = faults.stuckCarry ? 0 : c1 | c2;
			values[`A${bit}.out`] = av;
			values[`B${bit}.out`] = bv;
			values[`X1_${bit}.out`] = axb;
			values[`X2_${bit}.out`] = sum;
			values[`N1_${bit}.out`] = c1;
			values[`N2_${bit}.out`] = c2;
			values[`O1_${bit}.out`] = cout;
			carry = cout;
		}
		return values;
	});

	const sum = $derived.by(() => {
		let total = 0;
		for (let bit = 0; bit < BITS; bit += 1) {
			total |= (nets[`X2_${bit}.out`] ?? 0) << bit;
		}
		return total;
	});
	const carryOut = $derived(nets[`O1_${BITS - 1}.out`] ?? 0);
	const settledMask = $derived(frontier <= 0 ? 0 : (1 << Math.min(frontier, BITS)) - 1);
	const visibleSum = $derived((sum & settledMask) | (committedSum & ~settledMask & 0xff));
	const visibleCarry = $derived(frontier >= BITS ? carryOut : committedCarry);

	/** Which bit position an endpoint belongs to, for the ripple front gate. */
	function endpointBit(endpoint: string): number {
		const indexed = endpoint.match(/(?:_|^[ABS])(\d)/);
		return indexed ? Number(indexed[1]) : 0;
	}

	/* The shared causal timeline is the only animation clock. This keeps manual
	 * Previous/Next, autoplay, the delay slider, SVG lighting, and numerical state
	 * on the exact same frame boundary. */
	$effect(() => {
		const onStage = (event: Event): void => {
			const detail = (event as CustomEvent<SimulationTimelineDetail>).detail;
			if (detail.simulationId !== 'adder') return;
			frontier = detail.step >= BITS + 1 ? BITS : Math.min(detail.step, BITS - 1);
			if (detail.step >= BITS + 1) {
				committedSum = sum;
				committedCarry = carryOut;
			}
		};
		window.addEventListener(SIMULATION_TIMELINE_EVENT, onStage);
		return () => window.removeEventListener(SIMULATION_TIMELINE_EVENT, onStage);
	});

	/* Paint the settled portion of the logic pass into the compiled SVG by
	 * lighting first-class nets (data-net-id): a logic-1 net that has reached the
	 * ripple frontier glows high-signal; everything else stays muted. */
	$effect(() => {
		const root = host;
		if (!root) return;
		setNetLevels(root, (_netId, source) => {
			const value = source === undefined ? undefined : nets[source];
			const input = source ? /^(?:A|B)\d\.out$|^CIN\.out$/.test(source) : false;
			return value === 1 && (input || endpointBit(source ?? '') < frontier) ? 'high' : 'off';
		});
		for (const [endpoint, value] of Object.entries(nets)) {
			const input = /^(?:A|B)\d\.out$|^CIN\.out$/.test(endpoint);
			setNodeActive(
				root,
				endpoint.split('.')[0]!,
				value === 1 && (input || endpointBit(endpoint) < frontier)
			);
		}
		for (let bit = 0; bit < BITS; bit += 1) {
			setNodeActive(root, `S${bit}`, ((visibleSum >> bit) & 1) === 1 && bit < frontier);
		}
		setNodeActive(root, 'COUT', visibleCarry === 1 && frontier >= BITS);
	});

	/* Feed the oscilloscope a rolling logic trace of the sum's LSB rail. */
	$effect(() => {
		const sample = (visibleSum & 1) === 1 ? 0.85 : 0.15;
		const timer = setInterval(() => (scope = [...scope.slice(1), sample]), 80);
		return () => clearInterval(timer);
	});

	function preserveVisibleResult(): void {
		committedSum = visibleSum;
		committedCarry = visibleCarry;
		frontier = 0;
	}

	function onStageClick(event: MouseEvent): void {
		if (!(event.target instanceof Element)) return;
		toggleNode(delegatedNodeId(event.target));
	}

	function toggleNode(id: string | undefined): void {
		if (!id) return;
		const bitMatch = id.match(/^([AB])(\d)$/);
		if (bitMatch) {
			preserveVisibleResult();
			const bit = Number(bitMatch[2]);
			if (bitMatch[1] === 'A') a ^= 1 << bit;
			else b ^= 1 << bit;
			if (ui.audio) playTick(500 + bit * 40);
		} else if (id === 'CIN') {
			preserveVisibleResult();
			cin ^= 1;
			if (ui.audio) playTick(460);
		}
	}

	function onStageKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!(event.target instanceof Element)) return;
		event.preventDefault();
		toggleNode(delegatedNodeId(event.target));
	}

	function randomize(): void {
		preserveVisibleResult();
		a = Math.floor(Math.random() * 256);
		b = Math.floor(Math.random() * 256);
		if (ui.audio) playTick(560);
	}

	function clearInputs(): void {
		preserveVisibleResult();
		a = 0;
		b = 0;
		cin = 0;
		if (ui.audio) playTick(420);
	}

	/** Probe reading used by the lab-wide diagnostic HUD. */
	function probe(element: Element): string | undefined {
		const wire = element.closest('[data-wire-source]')?.getAttribute('data-wire-source');
		if (wire && wire in nets) {
			return `${wire} = logic ${nets[wire]} (${nets[wire] === 1 ? '5.0 V' : '0.0 V'})`;
		}
		const node = delegatedNodeId(element);
		if (!node) return undefined;
		const out = nets[`${node}.out`];
		if (out !== undefined) return `${node}.out = logic ${out}`;
		const sumBit = node.match(/^S(\d)$/);
		if (sumBit) return `${node} = logic ${(sum >> Number(sumBit[1])) & 1}`;
		if (node === 'COUT') return `COUT = logic ${carryOut}`;
		return undefined;
	}

	function bitString(value: number): string {
		return value.toString(2).padStart(8, '0');
	}

	/** Clamp a typed operand into a byte. */
	function clampByte(raw: string): number {
		const value = Number(raw);
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(255, Math.trunc(value)));
	}

	function setOperand(which: 'a' | 'b', raw: string): void {
		preserveVisibleResult();
		if (which === 'a') a = clampByte(raw);
		else b = clampByte(raw);
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Type two operands, or click any <strong>A</strong>/<strong>B</strong>/<strong>C_in</strong>
			port to toggle a bit. Watch the carry <strong>ripple</strong> upward over real gate delay — that
			travel time is why fast adders exist.
		</p>
		<div class="operands">
			<label>
				<span class="microlabel">A (0–255)</span>
				<input
					type="number"
					min="0"
					max="255"
					value={a}
					oninput={(event) => setOperand('a', event.currentTarget.value)}
				/>
			</label>
			<label>
				<span class="microlabel">B (0–255)</span>
				<input
					type="number"
					min="0"
					max="255"
					value={b}
					oninput={(event) => setOperand('b', event.currentTarget.value)}
				/>
			</label>
		</div>
		<p class="microlabel">
			physical model · {MODEL_GATE_DELAY_NS} ns/gate · critical path ≈ {criticalNs} ns
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
	<!-- The group owns delegation only; the compiler-emitted port buttons remain the interactive controls. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="sim-stage schemd-frame net-optics"
		bind:this={host}
		onclick={onStageClick}
		onkeydown={onStageKeydown}
		role="group"
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
			Σ = {bitString(visibleSum)}
		</span>
		<span class="readout sum" class:faulted={faults.stuckCarry}>
			= {visibleSum + (visibleCarry << 8)} · C_out = {visibleCarry}
		</span>
		<span class="readout ripple" class:settling>
			{settling ? `carry front @ bit ${frontier}…` : `settled · ${criticalNs} ns worst case`}
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

	.operands {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.stack label {
		display: grid;
		gap: 2px;
	}

	.stack input[type='number'] {
		inline-size: 100%;
		padding: 0.3rem 0.5rem;
		font-family: var(--font-mono);
		background: var(--bg-inset);
		border: 1px solid var(--line);
		color: var(--ink);
	}

	.readouts {
		display: grid;
		gap: var(--space-1);
	}

	.ripple {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-faint);

		&.settling {
			color: var(--accent);
		}
	}

	.sum {
		color: var(--ok);

		&.faulted {
			color: var(--danger);
		}
	}

	/* Muting, active, and high-signal optics come from the shared `.net-optics`
	   system (app.css); this stage only sets its scroll width and keeps the
	   clickable input ports a touch more visible at logic 0. */
	.sim-stage {
		cursor: pointer;

		:global(svg) {
			min-inline-size: 1040px;
		}

		:global([data-node-id^='A']:not(.is-active)),
		:global([data-node-id^='B']:not(.is-active)),
		:global([data-node-id='CIN']:not(.is-active)) {
			opacity: 0.55;
		}
	}
</style>
