<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import DocsPreview from '$lib/components/DocsPreview.svelte';
	import { breadcrumbSchema } from '$lib/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let navigationCollapsed = $state(false);
	let canonicalPath = $derived(`/docs/${data.version.id}/${data.metadata.id}`);
	let schema = $derived(
		breadcrumbSchema([
			{ name: 'Schemd', path: '/' },
			{ name: 'Documentation', path: `/docs/${data.version.id}/overview` },
			{ name: data.metadata.title, path: canonicalPath }
		])
	);
</script>

<Seo
	title={`${data.metadata.title} — Schemd ${data.version.id}`}
	description={data.metadata.summary}
	path={canonicalPath}
	structuredData={schema}
/>

<div class:nav-collapsed={navigationCollapsed} class="docs-shell page-shell">
	<aside class="docs-nav" aria-label="Documentation navigation">
		<button
			class="nav-collapse"
			type="button"
			aria-expanded={!navigationCollapsed}
			aria-controls="docs-desktop-index"
			onclick={() => (navigationCollapsed = !navigationCollapsed)}
			><span>{navigationCollapsed ? 'Open' : 'Collapse'} index</span><span aria-hidden="true"
				>{navigationCollapsed ? '→' : '←'}</span
			></button
		>
		<form class="version-form" action="/docs/select" method="get">
			<label for="docs-version">Documentation version</label>
			<input type="hidden" name="page" value={data.metadata.id} />
			<div>
				<select id="docs-version" name="version">
					{#each data.versions as version}
						<option value={version.id} selected={version.id === data.version.id}
							>{version.id} · {version.channel}</option
						>
					{/each}
				</select>
				<button type="submit">Go</button>
			</div>
		</form>

		<details class="docs-mobile-index">
			<summary>Documentation index</summary>
			<div class="docs-nav__groups">
				{#each data.navigation as group}
					<section>
						<h2>{group.label}</h2>
						<ul>
							{#each group.pages as page}
								<li>
									<a
										href={`/docs/${data.version.id}/${page.id}`}
										aria-current={page.id === data.metadata.id ? 'page' : undefined}>{page.label}</a
									>
									{#if page.id === data.metadata.id}
										<ul class="section-links">
											{#each page.sections as section}<li>
													<a href={`#${section.id}`}>{section.title}</a>
												</li>{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</details>

		<div id="docs-desktop-index" class="docs-desktop-index docs-nav__groups">
			{#each data.navigation as group}
				<section>
					<h2>{group.label}</h2>
					<ul>
						{#each group.pages as page}
							<li>
								<a
									href={`/docs/${data.version.id}/${page.id}`}
									aria-current={page.id === data.metadata.id ? 'page' : undefined}>{page.label}</a
								>
								{#if page.id === data.metadata.id}
									<ul class="section-links">
										{#each page.sections as section}<li>
												<a href={`#${section.id}`}>{section.title}</a>
											</li>{/each}
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</aside>

	<article class="doc-article">
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<ol>
				<li><a href="/">Home</a></li>
				<li><a href={`/docs/${data.version.id}/overview`}>Docs {data.version.id}</a></li>
				<li aria-current="page">{data.metadata.label}</li>
			</ol>
		</nav>
		<header class="doc-header">
			<p class="eyebrow">{data.metadata.category}</p>
			<h1>{data.metadata.title}</h1>
			<p class="lede">{data.metadata.summary}</p>
		</header>

		<details class="toc-mobile">
			<summary>On this page</summary>
			<ol>
				{#each data.toc as item}<li class:toc-child={item.depth === 3}>
						<a href={`#${item.id}`}>{item.title}</a>
					</li>{/each}
			</ol>
		</details>

		<!-- eslint-disable-next-line svelte/no-at-html-tags -- The deterministic server parser escapes all source text and sanitizes links. -->
		<div class="rendered-document">{@html data.html}</div>

		<nav class="docs-pagination" aria-label="Documentation pagination">
			{#if data.previous}<a href={`/docs/${data.version.id}/${data.previous.id}`}
					><small>Previous</small><strong>← {data.previous.label}</strong></a
				>{/if}
			{#if data.next}<a class="next" href={`/docs/${data.version.id}/${data.next.id}`}
					><small>Next</small><strong>{data.next.label} →</strong></a
				>{/if}
		</nav>
	</article>

	<DocsPreview examples={data.examples} toc={data.toc} version={data.version.id} />
</div>

<style>
	.docs-shell {
		display: grid;
		grid-template-columns: minmax(14rem, 17rem) minmax(0, 50rem) minmax(17rem, 23rem);
		align-items: start;
		justify-content: space-between;
		gap: clamp(1.25rem, 2.5vw, 3rem);
		padding-block: 2.5rem 6rem;
		transition: grid-template-columns 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.docs-shell.nav-collapsed {
		grid-template-columns: 3rem minmax(0, 54rem) minmax(17rem, 23rem);
	}
	.docs-nav {
		position: sticky;
		inset-block-start: 1.5rem;
		max-block-size: calc(100vh - 3rem);
		overflow: auto;
	}
	.nav-collapse {
		display: flex;
		align-items: center;
		justify-content: space-between;
		inline-size: 100%;
		margin-block-end: 0.75rem;
		padding-inline: 0.65rem;
		color: var(--muted);
		font-size: 0.68rem;
	}
	.nav-collapsed .nav-collapse span:first-child,
	.nav-collapsed .version-form,
	.nav-collapsed .docs-desktop-index {
		display: none;
	}
	.version-form {
		display: grid;
		gap: 0.45rem;
		border-block-end: 1px solid var(--line);
		padding-block-end: 1.25rem;
	}
	.version-form label {
		color: var(--muted);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.version-form > div {
		display: flex;
		gap: 0.35rem;
	}
	.version-form select {
		min-inline-size: 0;
		flex: 1;
	}
	.version-form button {
		padding-inline: 0.75rem;
	}
	.docs-nav__groups {
		display: grid;
		gap: 1.4rem;
		padding-block: 1.5rem;
	}
	.docs-nav__groups h2 {
		margin-block-end: 0.4rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.docs-nav__groups ul,
	.toc-mobile ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.docs-nav__groups a {
		display: block;
		border-inline-start: 2px solid transparent;
		padding: 0.35rem 0.65rem;
		color: var(--paper-soft);
		font-size: var(--step--1);
		text-decoration: none;
	}
	.docs-nav__groups a[aria-current='page'] {
		border-color: var(--signal);
		background: rgb(114 219 187 / 0.06);
		color: var(--signal-bright);
	}
	.section-links a {
		padding-inline-start: 1.25rem;
		color: var(--muted);
		font-size: 0.75rem;
	}
	.docs-mobile-index,
	.toc-mobile {
		display: none;
	}
	.doc-article {
		min-inline-size: 0;
	}
	.doc-header {
		display: grid;
		gap: 1.2rem;
		border-block-end: 1px solid var(--line);
		padding-block: 3rem;
	}
	.doc-header h1 {
		max-inline-size: 14ch;
		font-size: var(--step-3);
	}
	.rendered-document :global(.doc-section) {
		scroll-margin-block-start: 1.5rem;
		padding-block: 4.5rem;
	}
	.rendered-document :global(.doc-section + .doc-section) {
		border-block-start: 1px solid var(--line);
	}
	.rendered-document :global(.doc-section > h2) {
		max-inline-size: 19ch;
		margin-block: 0.75rem 2rem;
		font-size: var(--step-2);
	}
	.rendered-document :global(.doc-prose) {
		color: var(--paper-soft);
	}
	.rendered-document :global(.doc-prose > * + *) {
		margin-block-start: 1.2rem;
	}
	.rendered-document :global(.doc-prose > h3) {
		scroll-margin-block-start: 1.5rem;
		margin-block-start: 2.8rem;
		color: var(--paper);
	}
	.rendered-document :global(.doc-prose ul),
	.rendered-document :global(.doc-prose ol) {
		padding-inline-start: 1.4rem;
	}
	.rendered-document :global(.doc-prose li + li) {
		margin-block-start: 0.45rem;
	}
	.rendered-document :global(.doc-prose code:not(pre code)) {
		border: 1px solid var(--line);
		background: var(--ink-2);
		padding: 0.08em 0.3em;
		color: var(--signal-bright);
	}
	.rendered-document :global(.doc-callout) {
		border-inline-start: 3px solid var(--amber);
		background: rgb(225 161 92 / 0.08);
		padding: 1rem 1.2rem;
	}
	.rendered-document :global(.doc-code) {
		overflow: hidden;
		border: 1px solid var(--line);
		background: var(--ink-1);
	}
	.rendered-document :global(.doc-code__bar) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-block-end: 1px solid var(--line);
		padding: 0.45rem 0.75rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.rendered-document :global(pre) {
		overflow: auto;
		max-block-size: 34rem;
		margin: 0;
		padding: 1.1rem;
		color: var(--paper-soft);
		font-size: 0.78rem;
		line-height: 1.75;
	}
	.rendered-document :global(.tok-keyword) {
		color: var(--purple);
	}
	.rendered-document :global(.tok-string) {
		color: var(--signal-bright);
	}
	.rendered-document :global(.tok-number) {
		color: var(--amber);
	}
	.rendered-document :global(.tok-comment) {
		color: var(--muted);
	}
	.rendered-document :global(.tok-punctuation) {
		color: var(--blue);
	}
	.rendered-document :global(.doc-diagram) {
		margin: 1rem 0 2rem;
	}
	.rendered-document :global(.doc-diagram figcaption) {
		margin-block-start: 0.5rem;
		color: var(--muted);
		font-size: 0.72rem;
	}
	.rendered-document :global(.table-scroll) {
		overflow: auto;
	}
	.rendered-document :global(.unsafe-link) {
		color: var(--danger);
	}
	.toc-mobile a {
		display: block;
		border-inline-start: 1px solid var(--line);
		padding: 0.35rem 0.7rem;
		color: var(--muted);
		font-size: 0.75rem;
		line-height: 1.35;
		text-decoration: none;
	}
	.toc-mobile .toc-child a {
		padding-inline-start: 1.35rem;
	}
	.docs-pagination {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		border-block-start: 1px solid var(--line);
		padding-block-start: 2rem;
	}
	.docs-pagination a {
		display: grid;
		border: 1px solid var(--line);
		padding: 1rem;
		text-decoration: none;
	}
	.docs-pagination small {
		color: var(--muted);
	}
	.docs-pagination .next {
		grid-column: 2;
		text-align: end;
	}

	@media (max-width: 76rem) {
		.docs-shell {
			grid-template-columns: minmax(12rem, 15rem) minmax(0, 1fr);
		}
		.docs-shell.nav-collapsed {
			grid-template-columns: 3rem minmax(0, 1fr);
		}
		.toc-mobile {
			display: block;
			margin-block-start: 1.5rem;
			border: 1px solid var(--line);
		}
		.toc-mobile summary {
			min-block-size: 2.75rem;
			padding: 0.55rem 0.8rem;
			cursor: pointer;
			font-weight: 650;
		}
		.toc-mobile ol {
			padding: 0.5rem 0 0.9rem;
		}
	}

	@media (max-width: 48rem) {
		.docs-shell {
			display: block;
			padding-block-start: 1rem;
		}
		.docs-nav {
			position: static;
			max-block-size: none;
			overflow: visible;
		}
		.nav-collapse {
			display: none;
		}
		.docs-desktop-index {
			display: none;
		}
		.docs-mobile-index {
			display: block;
			margin-block-start: 1rem;
			border: 1px solid var(--line);
		}
		.docs-mobile-index summary {
			min-block-size: 2.75rem;
			padding: 0.55rem 0.8rem;
			cursor: pointer;
			font-weight: 650;
		}
		.docs-mobile-index .docs-nav__groups {
			padding-inline: 0.75rem;
		}
		.doc-header {
			padding-block-start: 2.5rem;
		}
	}
</style>
