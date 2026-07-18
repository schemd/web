<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { breadcrumbSchema } from '$lib/seo';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let path = $derived(`/simulations/${data.version.id}`);
	let schema = $derived(
		breadcrumbSchema([
			{ name: 'Schemd', path: '/' },
			{ name: 'Simulations', path }
		])
	);
</script>

<Seo
	title={`Simulation bench — Schemd ${data.version.id}`}
	description="Five focused, keyboard-operable circuit and quantum simulations using Schemd-generated diagrams and independently tested mathematics."
	{path}
	structuredData={schema}
/>

<div class="sim-index page-shell">
	<header class="sim-hero">
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<ol>
				<li><a href="/">Home</a></li>
				<li aria-current="page">Simulations {data.version.id}</li>
			</ol>
		</nav>
		<p class="eyebrow">Five instruments / one idea each</p>
		<h1>Move a control. Read the system.</h1>
		<p class="lede">
			These are small teaching models, not general-purpose solvers. Each route loads only its own
			controls and domain mathematics while its diagram comes from the selected Schemd compiler.
		</p>
		<form action="/simulations/select" method="get">
			<label for="simulation-version">Compiler version</label>
			<div>
				<select id="simulation-version" name="version"
					>{#each data.versions as version}<option
							value={version.id}
							selected={version.id === data.version.id}>{version.id} · {version.channel}</option
						>{/each}</select
				><button type="submit">Load</button>
			</div>
		</form>
	</header>

	<ol class="instrument-list">
		{#each data.simulations as simulation, index}
			<li>
				<a href={`/simulations/${data.version.id}/${simulation.id}`}>
					<span class="instrument-number">{String(index + 1).padStart(2, '0')}</span>
					<div>
						<p>{simulation.domain}</p>
						<h2>{simulation.title}</h2>
					</div>
					<p>{simulation.summary}</p>
					<strong>Open instrument <span aria-hidden="true">→</span></strong>
				</a>
			</li>
		{/each}
	</ol>

	<aside class="notice">
		<strong>Model boundary:</strong> digital and quantum state transitions are exact for the stated teaching
		model. Analog results use ideal first-order or textbook timing equations and do not include component
		tolerance, parasitics, saturation, or temperature.
	</aside>
</div>

<style>
	.sim-index {
		padding-block: 3rem 7rem;
	}
	.sim-hero {
		display: grid;
		grid-template-columns: minmax(20rem, 1fr) minmax(12rem, 18rem);
		gap: 1.2rem 4rem;
		align-items: end;
		padding-block: 2rem 5rem;
	}
	.sim-hero > :not(form) {
		grid-column: 1;
	}
	.sim-hero h1 {
		max-inline-size: 12ch;
	}
	.sim-hero form {
		display: grid;
		grid-column: 2;
		grid-row: 3 / span 2;
		gap: 0.4rem;
	}
	.sim-hero form label {
		color: var(--muted);
		font-size: 0.72rem;
		text-transform: uppercase;
	}
	.sim-hero form > div {
		display: flex;
		gap: 0.4rem;
	}
	.sim-hero select {
		min-inline-size: 0;
		flex: 1;
	}
	.sim-hero button {
		padding-inline: 0.8rem;
	}
	.instrument-list {
		margin: 0 0 3rem;
		padding: 0;
		border-block: 1px solid var(--line);
		list-style: none;
	}
	.instrument-list li + li {
		border-block-start: 1px solid var(--line);
	}
	.instrument-list a {
		display: grid;
		grid-template-columns: 3rem minmax(12rem, 0.65fr) minmax(18rem, 1fr) auto;
		align-items: center;
		gap: clamp(1rem, 3vw, 3rem);
		min-block-size: 9rem;
		padding: 1.2rem;
		text-decoration: none;
	}
	.instrument-list a:hover {
		background: var(--ink-1);
	}
	.instrument-number {
		color: var(--amber);
		font-family: var(--font-mono);
	}
	.instrument-list h2 {
		margin-block-start: 0.25rem;
		font-size: var(--step-2);
	}
	.instrument-list div p {
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
	}
	.instrument-list > li > a > p {
		color: var(--muted);
	}
	.instrument-list strong {
		color: var(--signal);
		white-space: nowrap;
	}
	@media (max-width: 58rem) {
		.sim-hero {
			grid-template-columns: 1fr;
		}
		.sim-hero form {
			grid-column: 1;
			grid-row: auto;
			max-inline-size: 20rem;
		}
		.instrument-list a {
			grid-template-columns: 2.5rem 1fr;
		}
		.instrument-list > li > a > p,
		.instrument-list strong {
			grid-column: 2;
		}
	}
</style>
