<script lang="ts">
	import ControlStack from '../ControlStack.svelte';
	import SimulationLab from '../SimulationLab.svelte';
	import { dispatchSimulationAudio } from '../audio';
	import { byteBinary, rippleCarry8, type BinarySignal } from '../digital-adder';
	import type { FaultMode, ProbeMetric } from '../instrumentation';
	import type { SimulationLabProps } from '../types';

	let { version, definition, svg, compileMetrics }: SimulationLabProps = $props();

	let a = $state(37);
	let b = $state(91);
	let carryIn = $state<BinarySignal>(0);
	let fault = $state<FaultMode>('none');

	const result = $derived(rippleCarry8(a, b, carryIn));
	const observedResult = $derived.by(() => {
		switch (fault) {
			case 'short-ground':
				return 0;
			case 'open-circuit':
				return result.nineBitResult & 0x0f;
			default:
				return result.nineBitResult;
		}
	});
	const activeCarries = $derived(result.stages.filter((stage) => stage.carryOut === 1).length);
	const traceRate = $derived(0.45 + activeCarries * 0.12);
	const metrics = $derived<readonly ProbeMetric[]>([
		{
			label: 'Observed sum',
			value: `${observedResult}₁₀`,
			tone: fault === 'none' ? 'good' : 'danger'
		},
		{ label: '8-bit bus', value: byteBinary(observedResult & 0xff) },
		{ label: 'Carry out', value: `${(observedResult >>> 8) & 1} bit` },
		{
			label: 'Carry depth',
			value: `${activeCarries} / 8`,
			tone: activeCarries > 5 ? 'warning' : 'neutral'
		}
	]);

	function toggleCarry(event: MouseEvent): void {
		carryIn = carryIn === 0 ? 1 : 0;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: carryIn ? 740 : 420,
			duration: 0.055,
			source: 'digital-adder:carry'
		});
	}

	function preset(event: MouseEvent, nextA: number, nextB: number): void {
		a = nextA;
		b = nextB;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 520 + ((nextA ^ nextB) % 5) * 45,
			duration: 0.06,
			source: 'digital-adder:preset'
		});
	}
</script>

<SimulationLab
	{version}
	{definition}
	{svg}
	{compileMetrics}
	waveform="logic"
	{traceRate}
	{metrics}
	bind:fault
>
	<ControlStack>
		<label class="control-field" for="adder-a">
			<span class="control-label">
				<span>Operand A</span>
				<strong class="control-value">{a}</strong>
			</span>
			<input id="adder-a" type="range" min="0" max="255" step="1" bind:value={a} />
			<span class="range-scale"><span>00000000</span><span>{byteBinary(a)}</span></span>
		</label>

		<label class="control-field" for="adder-b">
			<span class="control-label">
				<span>Operand B</span>
				<strong class="control-value">{b}</strong>
			</span>
			<input id="adder-b" type="range" min="0" max="255" step="1" bind:value={b} />
			<span class="range-scale"><span>00000000</span><span>{byteBinary(b)}</span></span>
		</label>

		<div class="control-field">
			<span class="control-label">
				<span>Carry input</span>
				<strong class="control-value">Cᵢₙ = {carryIn}</strong>
			</span>
			<div class="segmented">
				<button
					id="adder-carry"
					type="button"
					class:active={carryIn === 1}
					aria-pressed={carryIn === 1}
					onclick={toggleCarry}
				>
					Toggle carry
				</button>
			</div>
		</div>

		<div class="binary-readout">
			<span>9-bit result</span>
			<strong>{observedResult.toString(2).padStart(9, '0')}</strong>
		</div>

		<div class="control-field">
			<span class="control-label">
				<span>Carry propagation · bit 0 → 7</span>
				<strong class="control-value">{activeCarries} active</strong>
			</span>
			<div class="stage-grid" aria-label="Carry state at each full-adder stage">
				{#each result.stages as stage}
					<span
						class:active={stage.carryOut === 1}
						title={`Bit ${stage.bit}: carry ${stage.carryOut}`}
					>
						{stage.bit}
					</span>
				{/each}
			</div>
		</div>

		<div class="button-row" aria-label="Adder input presets">
			<button type="button" onclick={(event) => preset(event, 0, 0)}>Clear</button>
			<button type="button" onclick={(event) => preset(event, 85, 170)}>Pattern</button>
			<button class="primary" type="button" onclick={(event) => preset(event, 255, 1)}>
				Overflow
			</button>
		</div>
	</ControlStack>
</SimulationLab>
