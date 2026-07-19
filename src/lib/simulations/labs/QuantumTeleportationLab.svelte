<script lang="ts">
	import ControlStack from '../ControlStack.svelte';
	import SimulationLab from '../SimulationLab.svelte';
	import { dispatchSimulationAudio } from '../audio';
	import type { FaultMode, ProbeMetric } from '../instrumentation';
	import {
		normalizeQubit,
		qubitFromDegrees,
		teleport,
		type ClassicalBit,
		type RealQubit
	} from '../teleportation';
	import type { SimulationLabProps } from '../types';

	type ProtocolStage = 0 | 1 | 2 | 3 | 4;

	let { version, definition, svg, compileMetrics }: SimulationLabProps = $props();

	let angleDegrees = $state(58);
	let measurementZ = $state<ClassicalBit>(0);
	let measurementX = $state<ClassicalBit>(0);
	let stage = $state<ProtocolStage>(0);
	let fault = $state<FaultMode>('none');

	const input = $derived(qubitFromDegrees(angleDegrees));
	const result = $derived(teleport(input, measurementZ, measurementX));
	const observed = $derived.by<RealQubit>(() => {
		switch (fault) {
			case 'short-ground':
				return { alpha: 1, beta: 0 };
			case 'open-circuit':
				return result.rawReceiver;
			case 'degraded-resistor':
				return normalizeQubit({
					alpha: result.recovered.alpha * 0.97 + result.rawReceiver.alpha * 0.03,
					beta: result.recovered.beta * 0.97 + result.rawReceiver.beta * 0.03
				});
			default:
				return result.recovered;
		}
	});
	const fidelity = $derived(Math.pow(input.alpha * observed.alpha + input.beta * observed.beta, 2));
	const metrics = $derived<readonly ProbeMetric[]>([
		{
			label: 'Fidelity',
			value: `${(fidelity * 100).toFixed(3)}%`,
			tone: fidelity > 0.999 ? 'good' : fidelity > 0.94 ? 'warning' : 'danger'
		},
		{ label: 'Classical mZ', value: `${measurementZ} bit` },
		{ label: 'Classical mX', value: `${measurementX} bit` },
		{ label: 'Protocol', value: stage === 4 ? 'RECOVERED' : `STAGE ${stage}/4` }
	]);

	function entropyBit(): ClassicalBit {
		const random = new Uint32Array(1);
		crypto.getRandomValues(random);
		return (random[0] & 1) === 0 ? 0 : 1;
	}

	function advance(event: MouseEvent): void {
		switch (stage) {
			case 0:
				stage = 1;
				break;
			case 1:
				stage = 2;
				break;
			case 2:
				stage = 3;
				break;
			case 3:
				stage = 4;
				break;
			case 4:
				stage = 0;
				break;
		}
		if (stage === 3) {
			measurementZ = entropyBit();
			measurementX = entropyBit();
		}
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 390 + stage * 105,
			duration: 0.075,
			source: `quantum-teleportation:stage:${stage}`
		});
	}

	function randomizeMeasurement(event: MouseEvent): void {
		measurementZ = entropyBit();
		measurementX = entropyBit();
		stage = 3;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 610 + (measurementZ * 2 + measurementX) * 65,
			duration: 0.085,
			source: `quantum-teleportation:measure:${measurementZ}${measurementX}`
		});
	}

	function reset(event: MouseEvent): void {
		stage = 0;
		measurementZ = 0;
		measurementX = 0;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 330,
			duration: 0.06,
			source: 'quantum-teleportation:reset'
		});
	}
</script>

<SimulationLab
	{version}
	{definition}
	{svg}
	{compileMetrics}
	waveform="quantum"
	traceRate={0.58 + stage * 0.17}
	{metrics}
	bind:fault
>
	<ControlStack>
		<label class="control-field" for="qubit-angle">
			<span class="control-label">
				<span>Message qubit polar angle</span>
				<strong class="control-value">{angleDegrees.toFixed(0)}°</strong>
			</span>
			<input id="qubit-angle" type="range" min="0" max="360" step="1" bind:value={angleDegrees} />
			<span class="range-scale"><span>|0⟩</span><span>real-amplitude great circle</span></span>
		</label>

		<div class="binary-readout">
			<span>|ψ⟩ input</span>
			<strong>{input.alpha.toFixed(3)}|0⟩ + {input.beta.toFixed(3)}|1⟩</strong>
		</div>

		<div class="control-field">
			<span class="control-label">
				<span>Protocol cursor</span>
				<strong class="control-value">Stage {stage} / 4</strong>
			</span>
			<div class="timeline" aria-label={`Teleportation protocol stage ${stage} of 4`}>
				{#each [0, 1, 2, 3, 4] as marker}
					<span class:active={marker <= stage}></span>
				{/each}
			</div>
		</div>

		<div class="segmented" aria-label="Classical measurement bits">
			<button
				id="measure-z"
				type="button"
				class:active={measurementZ === 1}
				aria-pressed={measurementZ === 1}
				onclick={() => (measurementZ = measurementZ === 0 ? 1 : 0)}
			>
				mZ = {measurementZ}
			</button>
			<button
				id="measure-x"
				type="button"
				class:active={measurementX === 1}
				aria-pressed={measurementX === 1}
				onclick={() => (measurementX = measurementX === 0 ? 1 : 0)}
			>
				mX = {measurementX}
			</button>
		</div>

		<div class="button-row">
			<button id="teleport-step" class="primary" type="button" onclick={advance}>Advance</button>
			<button id="teleport-measure" type="button" onclick={randomizeMeasurement}>Measure</button>
			<button id="teleport-reset" type="button" onclick={reset}>Reset</button>
		</div>

		<div class="binary-readout">
			<span>Receiver |ψ′⟩</span>
			<strong>{observed.alpha.toFixed(3)}|0⟩ + {observed.beta.toFixed(3)}|1⟩</strong>
		</div>

		<p class="notice">
			The two classical bits choose X and Z recovery. They carry no amplitudes; entanglement and the
			corrections reconstruct the state.
		</p>
	</ControlStack>
</SimulationLab>
