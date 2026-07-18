<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<Seo title="Search Schemd documentation" description="Search the server-rendered Schemd documentation index." path="/search" noindex={true} />

<div class="search-page page-shell">
	<header class="flow">
		<p class="eyebrow">Documentation search</p>
		<h1>Find the contract you need.</h1>
		<p class="lede">Search runs on the server. It works without JavaScript and sends no documentation index to the browser.</p>
	</header>
	<form action="/search" method="get" role="search">
		<label for="search-query">Search documentation</label>
		<div><input id="search-query" name="q" type="search" value={data.query} maxlength="80" /><button type="submit">Search</button></div>
	</form>

	<section aria-labelledby="results-title">
		<h2 id="results-title">{data.query ? `${data.results.length} result${data.results.length === 1 ? '' : 's'} for “${data.query}”` : 'Search by API, component, or concept'}</h2>
		{#if data.query && data.results.length === 0}
			<div class="empty-state flow"><p>No documentation page matched every search term.</p><p>Try a component name such as <code>resistor</code>, a route such as <code>ortho</code>, or a broader term such as <code>SVG</code>.</p></div>
		{:else if data.results.length > 0}
			<ol class="results">
				{#each data.results as result}
					<li><p>{result.category}</p><h3><a href={result.path}>{result.title}</a></h3><span>{result.summary}</span></li>
				{/each}
			</ol>
		{/if}
	</section>
</div>

<style>
	.search-page { min-block-size: 70vh; padding-block: clamp(4rem, 8vw, 7rem); }
	.search-page header { max-inline-size: 54rem; }
	.search-page header h1 { font-size: var(--step-3); }
	.search-page > form { display: grid; gap: 0.5rem; max-inline-size: 48rem; margin-block: 3rem 5rem; }
	.search-page > form > div { display: flex; gap: 0.5rem; }
	.search-page input { min-inline-size: 0; flex: 1; }
	.search-page button { padding-inline: 1.2rem; }
	.search-page section { max-inline-size: 60rem; }
	.search-page section > h2 { font-size: var(--step-1); }
	.results { margin-block-start: 1.5rem; padding: 0; list-style: none; }
	.results li { display: grid; grid-template-columns: 9rem 1fr; gap: 0.2rem 1rem; border-block-start: 1px solid var(--line); padding-block: 1.25rem; }
	.results p { grid-row: 1 / span 2; color: var(--muted); font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; }
	.results span { color: var(--muted); }
	.empty-state { margin-block-start: 1.5rem; border-inline-start: 3px solid var(--amber); background: var(--ink-1); padding: 1.2rem; color: var(--paper-soft); }
	@media (max-width: 36rem) { .results li { grid-template-columns: 1fr; } .results p { grid-row: auto; } }
</style>
