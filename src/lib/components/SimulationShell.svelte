<script lang="ts">
	import type { Snippet } from 'svelte';
	import Seo from './Seo.svelte';
	import { breadcrumbSchema } from '$lib/seo';

	interface Props {
		version: string;
		slug: string;
		domain: string;
		title: string;
		summary: string;
		idea: string;
		docsPath: string;
		svg: string;
		children: Snippet;
	}

	let { version, slug, domain, title, summary, idea, docsPath, svg, children }: Props = $props();
	let path = $derived(`/simulations/${version}/${slug}`);
	let schema = $derived(breadcrumbSchema([
		{ name: 'Schemd', path: '/' },
		{ name: 'Simulations', path: `/simulations/${version}` },
		{ name: title, path }
	]));
</script>

<Seo title={`${title} — Schemd ${version}`} description={summary} {path} structuredData={schema} />

<div class="simulation-page page-shell">
	<header class="simulation-header">
		<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href={`/simulations/${version}`}>Simulations {version}</a></li><li aria-current="page">{title}</li></ol></nav>
		<p class="eyebrow">{domain} / {version}</p>
		<h1>{title}</h1>
		<p class="lede">{summary}</p>
		<div class="idea"><strong>One idea</strong><p>{idea}</p></div>
	</header>
	<div class="simulation-grid">
		<section class="simulation-controls" aria-label={`${title} controls and readout`}>
			{@render children()}
		</section>
		<figure class="simulation-diagram">
			<div class="instrument-bar"><span>Schemd output</span><span>server compiled</span></div>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pinned Schemd compiler output from trusted, server-owned source. -->
			<div class="schematic-host">{@html svg}</div>
			<figcaption>The diagram is compiled by {version}; the controls operate a separate deterministic domain model.</figcaption>
		</figure>
	</div>
	<nav class="simulation-footer" aria-label="Related simulation links"><a href={`/simulations/${version}`}>← All simulations</a><a href={docsPath}>Relevant documentation →</a></nav>
</div>

<style>
	.simulation-page { padding-block: 3rem 6rem; }
	.simulation-header { display: grid; gap: 1.15rem; max-inline-size: 68rem; padding-block: 2rem 4rem; }
	.simulation-header h1 { max-inline-size: 13ch; font-size: var(--step-3); }
	.idea { display: grid; grid-template-columns: 7rem 1fr; gap: 1rem; max-inline-size: 52rem; border-inline-start: 3px solid var(--amber); background: rgb(225 161 92 / 0.07); padding: 1rem; color: var(--paper-soft); }
	.idea strong { color: var(--amber); font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; }
	.simulation-grid { display: grid; grid-template-columns: minmax(20rem, 0.75fr) minmax(28rem, 1.25fr); align-items: start; border: 1px solid var(--line-strong); background: var(--ink-1); }
	.simulation-controls { min-inline-size: 0; padding: clamp(1.25rem, 3vw, 2.5rem); }
	.simulation-diagram { min-inline-size: 0; border-inline-start: 1px solid var(--line-strong); background: var(--ink-1); }
	.instrument-bar { display: flex; justify-content: space-between; gap: 1rem; border-block-end: 1px solid var(--line); padding: 0.55rem 0.75rem; color: var(--muted); font-family: var(--font-mono); font-size: 0.68rem; }
	.simulation-diagram .schematic-host { border: 0; }
	.simulation-diagram figcaption { border-block-start: 1px solid var(--line); padding: 0.65rem 0.8rem; color: var(--muted); font-size: 0.7rem; }
	.simulation-footer { display: flex; justify-content: space-between; gap: 1rem; border-block-end: 1px solid var(--line); padding-block: 1.2rem; }
	.simulation-footer a { color: var(--signal); font-weight: 650; }
	:global(.simulation-controls .control-stack) { display: grid; gap: 1.5rem; }
	:global(.simulation-controls fieldset) { display: grid; gap: 1rem; margin: 0; border: 1px solid var(--line); padding: 1rem; }
	:global(.simulation-controls legend) { padding-inline: 0.4rem; color: var(--signal); font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; }
	:global(.simulation-controls .field) { display: grid; gap: 0.35rem; }
	:global(.simulation-controls .field-line) { display: flex; justify-content: space-between; gap: 1rem; }
	:global(.simulation-controls input[type='range']) { inline-size: 100%; accent-color: var(--signal); }
	:global(.simulation-controls input[type='number']) { inline-size: 100%; }
	:global(.simulation-controls .readout) { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; border: 1px solid var(--line); background: var(--line); }
	:global(.simulation-controls .readout div) { background: var(--ink-2); padding: 0.75rem; }
	:global(.simulation-controls .readout dt) { color: var(--muted); font-size: 0.65rem; text-transform: uppercase; }
	:global(.simulation-controls .readout dd) { margin: 0.2rem 0 0; color: var(--paper); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
	:global(.simulation-controls .simulation-actions) { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	:global(.simulation-controls .simulation-actions button) { padding-inline: 0.9rem; }
	:global(.simulation-controls .technical-note) { color: var(--muted); font-size: 0.74rem; }
	@media (max-width: 64rem) { .simulation-grid { grid-template-columns: 1fr; } .simulation-diagram { border-block-start: 1px solid var(--line-strong); border-inline-start: 0; } }
	@media (max-width: 38rem) { .simulation-page { padding-inline: 0; } .simulation-header, .simulation-footer { margin-inline: var(--gutter); } .idea { grid-template-columns: 1fr; } }
</style>
