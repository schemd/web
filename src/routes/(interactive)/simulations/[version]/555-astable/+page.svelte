<script lang="ts">
	import SimulationShell from '$lib/components/SimulationShell.svelte';
	import { astableTiming } from '$lib/simulations/astable-555';
	import type { FaultMode } from '$lib/simulations/instrumentation';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let r1KiloOhms = $state(10);
	let r2KiloOhms = $state(47);
	let capacitanceMicrofarads = $state(10);
	let fault = $state<FaultMode>('none');
	let modelR1 = $derived((fault === 'degraded-resistor' ? r1KiloOhms * 1.5 : r1KiloOhms) * 1000);
	let modelR2 = $derived((fault === 'open-circuit' ? r2KiloOhms * 1000 : r2KiloOhms) * 1000);
	let modelCapacitance = $derived(
		(fault === 'short-ground' ? 0.01 : capacitanceMicrofarads) / 1_000_000
	);
	let timing = $derived(astableTiming(modelR1, modelR2, modelCapacitance));
	let probeMetrics = $derived([
		{ label: 'Frequency', value: `${timing.frequencyHz.toFixed(2)} Hz` },
		{ label: 'Duty', value: `${(timing.dutyCycle * 100).toFixed(1)}%` },
		{ label: 'Capacitor', value: `${(modelCapacitance * 1_000_000).toFixed(2)} µF` }
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
	waveform="square"
	traceRate={0.8}
	pulseTargetId="LED1"
	pulsePeriodSeconds={timing.periodSeconds}
	{probeMetrics}
>
	<div class="control-stack">
		<fieldset>
			<legend>Timing network</legend>
			<div class="field">
				<div class="field-line">
					<label for="r1">R1</label><output for="r1">{r1KiloOhms} kΩ</output>
				</div>
				<input id="r1" type="range" min="1" max="100" step="1" bind:value={r1KiloOhms} />
			</div>
			<div class="field">
				<div class="field-line">
					<label for="r2">R2</label><output for="r2">{r2KiloOhms} kΩ</output>
				</div>
				<input id="r2" type="range" min="1" max="220" step="1" bind:value={r2KiloOhms} />
			</div>
			<div class="field">
				<div class="field-line">
					<label for="capacitance">C</label><output for="capacitance"
						>{capacitanceMicrofarads.toFixed(1)} µF</output
					>
				</div>
				<input
					id="capacitance"
					type="range"
					min="0.1"
					max="100"
					step="0.1"
					bind:value={capacitanceMicrofarads}
				/>
			</div>
		</fieldset>
		<dl class="readout">
			<div>
				<dt>Frequency</dt>
				<dd>{timing.frequencyHz.toFixed(2)} Hz</dd>
			</div>
			<div>
				<dt>Period</dt>
				<dd>{(timing.periodSeconds * 1000).toFixed(2)} ms</dd>
			</div>
			<div>
				<dt>High</dt>
				<dd>{(timing.highSeconds * 1000).toFixed(2)} ms</dd>
			</div>
			<div>
				<dt>Low</dt>
				<dd>{(timing.lowSeconds * 1000).toFixed(2)} ms</dd>
			</div>
			<div>
				<dt>Duty</dt>
				<dd>{(timing.dutyCycle * 100).toFixed(1)}%</dd>
			</div>
			<div>
				<dt>Thresholds</dt>
				<dd>⅓ VCC / ⅔ VCC</dd>
			</div>
		</dl>
		<div
			class="duty"
			aria-label={`Output is high ${(timing.dutyCycle * 100).toFixed(1)} percent of each period`}
		>
			<span style={`--duty:${timing.dutyCycle}`}>high</span><i>low</i>
		</div>
		<p class="technical-note">
			Textbook bipolar-555 approximation using ln(2). Real frequency changes with tolerances,
			leakage, supply, and threshold variation.
		</p>
	</div>
</SimulationShell>

<style>
	output {
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}
	.duty {
		display: flex;
		block-size: 2rem;
		color: var(--ink-0);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-align: center;
	}
	.duty span {
		inline-size: calc(var(--duty) * 100%);
		background: var(--signal);
		padding: 0.35rem;
	}
	.duty i {
		flex: 1;
		background: var(--amber);
		padding: 0.35rem;
		font-style: normal;
	}
</style>
