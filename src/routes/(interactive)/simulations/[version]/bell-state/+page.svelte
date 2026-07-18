<script lang="ts">
	import SimulationShell from '$lib/components/SimulationShell.svelte';
	import { bellState, measureBell, nextBellStep, type BellStep } from '$lib/simulations/bell-state';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let step = $state<BellStep>(0);
	let measurement = $state<'00' | '11' | undefined>();
	let bellStatus = $derived(bellState(step));
	function sample(): void { const values = new Uint32Array(1); crypto.getRandomValues(values); measurement = measureBell((values[0] ?? 0) / 4_294_967_296); }
</script>

<SimulationShell version={data.version.id} slug={data.definition.id} domain={data.definition.domain} title={data.definition.title} summary={data.definition.summary} idea={data.definition.idea} docsPath={data.definition.docsPath} svg={data.svg}>
	<div class="control-stack">
		<fieldset><legend>Protocol step</legend><div class="step-readout"><span>0{step + 1} / 03</span><strong>{bellStatus.label}</strong><code>{bellStatus.ket}</code></div><div class="simulation-actions"><button type="button" onclick={() => { step = nextBellStep(step); measurement = undefined; }}>Next step</button><button type="button" onclick={() => { step = 0; measurement = undefined; }}>Reset</button><button type="button" onclick={sample} disabled={step !== 2}>Measure Bell pair</button></div></fieldset>
		<div class="probabilities" aria-label="Basis-state probabilities"><div><span>00</span><i style={`--probability:${bellStatus.probability00}`}></i><output>{(bellStatus.probability00 * 100).toFixed(0)}%</output></div><div><span>11</span><i style={`--probability:${bellStatus.probability11}`}></i><output>{(bellStatus.probability11 * 100).toFixed(0)}%</output></div><div><span>other</span><i style={`--probability:${bellStatus.otherProbability}`}></i><output>{(bellStatus.otherProbability * 100).toFixed(0)}%</output></div></div>
		<div class="measurement" aria-live="polite">{#if measurement}<p>Measured <strong>|{measurement}⟩</strong>. Ideal Bell measurements are correlated, so 01 and 10 never occur.</p>{:else}<p>{step === 2 ? 'The pair is ready to measure.' : 'Complete entanglement before measuring.'}</p>{/if}</div>
		<p class="technical-note">Sampling uses a uniform cryptographic random value only after the exact 50/50 state has been prepared.</p>
	</div>
</SimulationShell>

<style>.step-readout { display: grid; gap: 0.5rem; } .step-readout span { color: var(--amber); font-family: var(--font-mono); font-size: 0.7rem; } .step-readout code { color: var(--signal-bright); } .probabilities { display: grid; gap: 0.7rem; } .probabilities div { display: grid; grid-template-columns: 4rem 1fr 3rem; align-items: center; gap: 0.6rem; } .probabilities span, .probabilities output { font-family: var(--font-mono); font-size: 0.72rem; } .probabilities i { display: block; block-size: 0.65rem; background: linear-gradient(90deg, var(--signal) calc(var(--probability) * 100%), var(--ink-3) 0); } .measurement { border-inline-start: 3px solid var(--signal); background: var(--ink-2); padding: 1rem; } button:disabled { opacity: 0.45; cursor: not-allowed; }</style>
