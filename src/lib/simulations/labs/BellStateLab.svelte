<script lang="ts">
	import ControlStack from '../ControlStack.svelte';
	import SimulationLab from '../SimulationLab.svelte';
	import { dispatchSimulationAudio } from '../audio';
	import { bellState, nextBellStep, type BellStep, type ComputationalBasis } from '../bell-state';
	import type { FaultMode, ProbeMetric } from '../instrumentation';
	import type { SimulationLabProps } from '../types';

	const BASIS: readonly ComputationalBasis[] = ['00', '01', '10', '11'];

	let { version, definition, svg, compileMetrics }: SimulationLabProps = $props();

	let step = $state<BellStep>(0);
	let fault = $state<FaultMode>('none');
	let measurement = $state<ComputationalBasis | undefined>();
	let shots00 = $state(0);
	let shots11 = $state(0);
	let otherShots = $state(0);

	const effectiveStep = $derived<BellStep>(
		fault === 'short-ground' ? 0 : fault === 'open-circuit' && step === 2 ? 1 : step
	);
	const bellVector = $derived(bellState(effectiveStep));
	const shotCount = $derived(shots00 + shots11 + otherShots);
	const metrics = $derived<readonly ProbeMetric[]>([
		{ label: 'State', value: bellVector.label, tone: fault === 'none' ? 'good' : 'warning' },
		{ label: 'P(00)', value: `${(bellVector.probabilities[0] * 100).toFixed(0)}%` },
		{ label: 'P(11)', value: `${(bellVector.probabilities[3] * 100).toFixed(0)}%` },
		{
			label: 'Last shot',
			value: measurement ?? '—',
			tone: measurement === '01' || measurement === '10' ? 'danger' : 'neutral'
		}
	]);

	function entropy(): number {
		const values = new Uint32Array(1);
		crypto.getRandomValues(values);
		return values[0] / 0x1_0000_0000;
	}

	function advance(event: MouseEvent): void {
		step = nextBellStep(step);
		measurement = undefined;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 440 + step * 150,
			duration: 0.07,
			source: 'bell-state:step'
		});
	}

	function measure(event: MouseEvent): void {
		const random = entropy();
		let accumulated = 0;
		let sampled: ComputationalBasis = '11';
		for (let index = 0; index < bellVector.probabilities.length; index += 1) {
			accumulated += bellVector.probabilities[index];
			if (random < accumulated) {
				sampled = BASIS[index];
				break;
			}
		}
		if (fault === 'degraded-resistor' && entropy() < 0.08) sampled = entropy() < 0.5 ? '01' : '10';
		measurement = sampled;
		if (sampled === '00') shots00 += 1;
		else if (sampled === '11') shots11 += 1;
		else otherShots += 1;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: sampled === '00' ? 510 : sampled === '11' ? 760 : 190,
			duration: 0.09,
			source: `bell-state:measure:${sampled}`
		});
	}

	function reset(event: MouseEvent): void {
		step = 0;
		measurement = undefined;
		shots00 = 0;
		shots11 = 0;
		otherShots = 0;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 350,
			duration: 0.06,
			source: 'bell-state:reset'
		});
	}
</script>

<SimulationLab
	{version}
	{definition}
	{svg}
	{compileMetrics}
	waveform="quantum"
	traceRate={0.65 + effectiveStep * 0.28}
	{metrics}
	bind:fault
>
	<ControlStack>
		<div class="control-field">
			<span class="control-label">
				<span>Gate cursor</span>
				<strong class="control-value">Step {effectiveStep} / 2</strong>
			</span>
			<div class="timeline" aria-label={`Bell preparation step ${effectiveStep} of 2`}>
				{#each [0, 1, 2, 3, 4] as marker}
					<span class:active={marker <= effectiveStep + 1}></span>
				{/each}
			</div>
			<div class="binary-readout">
				<span>State vector</span>
				<strong>{bellVector.label}</strong>
			</div>
		</div>

		<div class="probability-list" aria-label="Computational basis probabilities">
			{#each BASIS as basis, index}
				<div class="probability-row">
					<span>|{basis}⟩</span>
					<div class="probability-track">
						<div
							class="probability-fill"
							style={`width:${bellVector.probabilities[index] * 100}%`}
						></div>
					</div>
					<strong>{(bellVector.probabilities[index] * 100).toFixed(0)}%</strong>
				</div>
			{/each}
		</div>

		<div class="button-row">
			<button id="bell-step" class="primary" type="button" onclick={advance}>Apply next gate</button
			>
			<button id="bell-measure" type="button" onclick={measure}>Measure</button>
			<button id="bell-reset" type="button" onclick={reset}>Reset</button>
		</div>

		<div class="binary-readout">
			<span>{shotCount} recorded shots</span>
			<strong>00:{shots00} · 11:{shots11} · err:{otherShots}</strong>
		</div>

		<p class="notice">
			A valid Bell pair returns only 00 or 11. The drift fault adds a deliberate readout-error
			channel so diagnostics have something real to catch.
		</p>
	</ControlStack>
</SimulationLab>
