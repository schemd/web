<script lang="ts">
	import SimulationShell from '$lib/components/SimulationShell.svelte';
	import { logarithmicFrequency, rcLowPass } from '$lib/simulations/rc-low-pass';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let position = $state(550);
	let inputVolts = $state(5);
	let frequency = $derived(logarithmicFrequency(position / 1000));
	let response = $derived(rcLowPass(frequency, 10_000, 100e-9, inputVolts));
	let attenuationDb = $derived(20 * Math.log10(response.gain));
</script>

<SimulationShell version={data.version.id} slug={data.definition.id} domain={data.definition.domain} title={data.definition.title} summary={data.definition.summary} idea={data.definition.idea} docsPath={data.definition.docsPath} svg={data.svg}>
	<div class="control-stack">
		<fieldset><legend>Ideal source</legend><div class="field"><div class="field-line"><label for="frequency">Frequency</label><output for="frequency">{frequency < 1000 ? frequency.toFixed(1) + ' Hz' : (frequency / 1000).toFixed(2) + ' kHz'}</output></div><input id="frequency" type="range" min="0" max="1000" step="1" bind:value={position} /></div><div class="field"><div class="field-line"><label for="input-voltage">Input amplitude</label><output for="input-voltage">{inputVolts.toFixed(1)} V</output></div><input id="input-voltage" type="range" min="0.5" max="10" step="0.1" bind:value={inputVolts} /></div></fieldset>
		<dl class="readout"><div><dt>Cutoff</dt><dd>{response.cutoffHz.toFixed(1)} Hz</dd></div><div><dt>Gain</dt><dd>{response.gain.toFixed(4)}</dd></div><div><dt>Attenuation</dt><dd>{attenuationDb.toFixed(2)} dB</dd></div><div><dt>Phase</dt><dd>{response.phaseDegrees.toFixed(1)}°</dd></div><div><dt>Output</dt><dd>{response.outputVolts.toFixed(3)} V</dd></div><div><dt>R · C</dt><dd>10 kΩ · 100 nF</dd></div></dl>
		<div class="gain-gauge" aria-hidden="true"><span style={`--gain:${response.gain}`}></span></div>
		<p class="technical-note">Ideal transfer: |H(jω)| = 1 / √(1 + (f/fc)²). This model omits loading, ESR, tolerance, and parasitics.</p>
	</div>
</SimulationShell>

<style>output { color: var(--signal); font-family: var(--font-mono); font-size: 0.72rem; } .gain-gauge { block-size: 1.4rem; border: 1px solid var(--line); padding: 0.25rem; } .gain-gauge span { display: block; inline-size: calc(var(--gain) * 100%); block-size: 100%; background: var(--signal); }</style>
