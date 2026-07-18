<script lang="ts">
	import SimulationShell from '$lib/components/SimulationShell.svelte';
	import { byteBinary, rippleCarry8, type BinarySignal } from '$lib/simulations/digital-adder';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let a = $state(37);
	let b = $state(91);
	let carry = $state<BinarySignal>(0);
	let result = $derived(rippleCarry8(a, b, carry));
</script>

<SimulationShell version={data.version.id} slug={data.definition.id} domain={data.definition.domain} title={data.definition.title} summary={data.definition.summary} idea={data.definition.idea} docsPath={data.definition.docsPath} svg={data.svg}>
	<div class="control-stack">
		<fieldset><legend>Unsigned inputs</legend>
			<div class="field"><div class="field-line"><label for="adder-a">Operand A</label><output for="adder-a">{a} / {byteBinary(a)}</output></div><input id="adder-a" type="range" min="0" max="255" step="1" bind:value={a} /></div>
			<div class="field"><div class="field-line"><label for="adder-b">Operand B</label><output for="adder-b">{b} / {byteBinary(b)}</output></div><input id="adder-b" type="range" min="0" max="255" step="1" bind:value={b} /></div>
			<div class="simulation-actions"><button type="button" aria-pressed={carry === 1} onclick={() => carry = carry === 0 ? 1 : 0}>Carry in: {carry}</button><button type="button" onclick={() => { a = 0; b = 0; carry = 0; }}>Reset</button></div>
		</fieldset>
		<dl class="readout"><div><dt>8-bit sum</dt><dd>{result.sum}</dd></div><div><dt>Binary</dt><dd>{byteBinary(result.sum)}</dd></div><div><dt>Carry out</dt><dd>{result.carryOut}</dd></div><div><dt>Full result</dt><dd>{a + b + carry}</dd></div></dl>
		<div class="stage-scroll" role="region" aria-label="Full-adder stages"><table><thead><tr><th scope="col">Bit</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Cin</th><th scope="col">S</th><th scope="col">Cout</th></tr></thead><tbody>{#each result.stages as stage}<tr><th scope="row">{stage.bit}</th><td>{stage.a}</td><td>{stage.b}</td><td>{stage.carryIn}</td><td>{stage.sum}</td><td>{stage.carryOut}</td></tr>{/each}</tbody></table></div>
		<p class="technical-note">The table runs least-significant bit first. Each row's carry-out becomes the next row's carry-in.</p>
	</div>
</SimulationShell>

<style>.stage-scroll { overflow: auto; max-block-size: 20rem; border: 1px solid var(--line); } .stage-scroll table { min-inline-size: 28rem; } .stage-scroll td, .stage-scroll th { padding: 0.45rem; font-family: var(--font-mono); font-size: 0.72rem; text-align: center; } output { color: var(--signal); font-family: var(--font-mono); font-size: 0.72rem; }</style>
