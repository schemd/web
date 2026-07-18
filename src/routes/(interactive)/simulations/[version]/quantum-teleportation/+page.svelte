<script lang="ts">
	import SimulationShell from '$lib/components/SimulationShell.svelte';
	import { qubitFromDegrees, teleport, type BinarySignal } from '$lib/simulations/teleportation';
	import type { FaultMode } from '$lib/simulations/instrumentation';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let degrees = $state(60);
	let zBit = $state<BinarySignal>(0);
	let xBit = $state<BinarySignal>(0);
	let step = $state(0);
	let fault = $state<FaultMode>('none');
	const steps = [
		'Initialize message and ancillas',
		'Create the shared Bell pair',
		'Bell-encode Alice’s qubits',
		'Measure and send two classical bits',
		'Apply X/Z recovery at Bob'
	];
	let modelDegrees = $derived(fault === 'short-ground' ? 0 : degrees);
	let input = $derived(qubitFromDegrees(modelDegrees));
	let modelZ = $derived<BinarySignal>(fault === 'open-circuit' ? 0 : zBit);
	let modelX = $derived<BinarySignal>(fault === 'degraded-resistor' ? 0 : xBit);
	let result = $derived(teleport(input, modelZ, modelX));
	let probeMetrics = $derived([
		{ label: 'α', value: input.alpha.toFixed(3) },
		{ label: 'β', value: input.beta.toFixed(3) },
		{ label: 'Fidelity', value: result.fidelity.toFixed(6) }
	]);
</script>

<SimulationShell
	version={data.version.id}
	slug={data.definition.id}
	domain={data.definition.domain}
	title={data.definition.title}
	summary={data.definition.summary}
	idea={data.definition.idea}
	docsPath={data.definition.docsPath}
	svg={data.svg}
	bind:fault
	waveform="quantum"
	traceRate={0.2}
	{probeMetrics}
>
	<div class="control-stack">
		<fieldset>
			<legend>Message qubit</legend>
			<div class="field">
				<div class="field-line">
					<label for="qubit-angle">Bloch meridian angle</label><output for="qubit-angle"
						>{degrees}°</output
					>
				</div>
				<input id="qubit-angle" type="range" min="0" max="180" step="1" bind:value={degrees} />
			</div>
			<code>|ψ⟩ = {input.alpha.toFixed(3)}|0⟩ + {input.beta.toFixed(3)}|1⟩</code>
		</fieldset>
		<fieldset>
			<legend>Protocol</legend>
			<div class="protocol-step"><span>0{step + 1} / 05</span><strong>{steps[step]}</strong></div>
			<div class="simulation-actions">
				<button type="button" onclick={() => (step = step === 4 ? 0 : step + 1)}>Next step</button
				><button type="button" onclick={() => (step = 0)}>Reset step</button>
			</div>
			<div class="simulation-actions">
				<button type="button" aria-pressed={zBit === 1} onclick={() => (zBit = zBit === 0 ? 1 : 0)}
					>mZ: {zBit}</button
				><button type="button" aria-pressed={xBit === 1} onclick={() => (xBit = xBit === 0 ? 1 : 0)}
					>mX: {xBit}</button
				>
			</div>
		</fieldset>
		<dl class="readout">
			<div>
				<dt>Branch probability</dt>
				<dd>{(result.outcomeProbability * 100).toFixed(0)}%</dd>
			</div>
			<div>
				<dt>Final fidelity</dt>
				<dd>{result.fidelity.toFixed(6)}</dd>
			</div>
			<div>
				<dt>Before recovery α</dt>
				<dd>{result.beforeRecovery.alpha.toFixed(3)}</dd>
			</div>
			<div>
				<dt>Before recovery β</dt>
				<dd>{result.beforeRecovery.beta.toFixed(3)}</dd>
			</div>
			<div>
				<dt>Recovered α</dt>
				<dd>{result.afterRecovery.alpha.toFixed(3)}</dd>
			</div>
			<div>
				<dt>Recovered β</dt>
				<dd>{result.afterRecovery.beta.toFixed(3)}</dd>
			</div>
		</dl>
		<p class="technical-note">
			This constrained model uses real amplitudes on one Bloch-sphere meridian. Every two-bit result
			has probability ¼, and conditional Pauli recovery restores unit fidelity.
		</p>
	</div>
</SimulationShell>

<style>
	output {
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}
	fieldset > code {
		overflow: auto;
		color: var(--signal-bright);
	}
	.protocol-step {
		display: grid;
		gap: 0.4rem;
	}
	.protocol-step span {
		color: var(--amber);
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
</style>
