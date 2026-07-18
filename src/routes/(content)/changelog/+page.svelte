<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { RELEASES } from '$lib/content/releases';
	import { breadcrumbSchema } from '$lib/seo';
	const schema = breadcrumbSchema([{ name: 'Schemd', path: '/' }, { name: 'Changelog', path: '/changelog' }]);
</script>

<Seo title="Changelog — Schemd" description="Verified @schemd/core release tags and compatibility notes." path="/changelog" structuredData={schema} />

<div class="changelog page-shell">
	<header class="flow">
		<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Changelog</li></ol></nav>
		<p class="eyebrow">Release history</p>
		<h1>What changed, and what is documented.</h1>
		<p class="lede">This record follows repository tags and commit history. Only v0.2.1 has a reproducible website documentation snapshot; older tags remain visible without pretending current docs describe them.</p>
	</header>

	<ol class="releases">
		{#each RELEASES as release, index}
			<li id={release.version} class:current={index === 0}>
				<div class="release-meta"><time datetime={release.date}>{release.date}</time><span>{release.documentationAvailable ? 'Documented' : 'Archive only'}</span></div>
				<div class="release-body">
					<p class="eyebrow">{release.version}</p>
					<h2>{release.title}</h2>
					<p>{release.summary}</p>
					<div class="release-links"><a href={release.tagUrl}>Inspect tag</a>{#if release.documentationAvailable}<a href={`/docs/${release.version}/overview`}>Read versioned docs</a><a href={`/playground/${release.version}`}>Use this compiler</a>{/if}</div>
				</div>
			</li>
		{/each}
	</ol>
</div>

<style>
	.changelog { padding-block: 4rem 8rem; }
	.changelog > header { max-inline-size: 66rem; padding-block-end: 5rem; }
	.changelog > header h1 { max-inline-size: 14ch; }
	.releases { margin: 0; padding: 0; list-style: none; }
	.releases > li { display: grid; grid-template-columns: minmax(10rem, 0.45fr) minmax(20rem, 1fr); gap: clamp(2rem, 8vw, 8rem); border-block-start: 1px solid var(--line); padding-block: 4rem; }
	.release-meta { display: grid; align-content: start; gap: 0.55rem; font-family: var(--font-mono); font-size: 0.72rem; }
	.release-meta time { color: var(--muted); }
	.release-meta span { justify-self: start; border: 1px solid var(--line-strong); padding: 0.2rem 0.45rem; color: var(--muted); }
	.current .release-meta span { border-color: var(--signal); color: var(--signal); }
	.release-body { display: grid; gap: 1rem; }
	.release-body h2 { font-size: var(--step-2); }
	.release-body > p:not(.eyebrow) { max-inline-size: 65ch; color: var(--paper-soft); }
	.release-links { display: flex; flex-wrap: wrap; gap: 1.2rem; margin-block-start: 0.5rem; }
	.release-links a { color: var(--signal); font-weight: 650; }
	@media (max-width: 42rem) { .releases > li { grid-template-columns: 1fr; gap: 1.5rem; } }
</style>
