<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Pronounce from '#lib/components/Pronounce.svelte';
	import { encodeWorkspaceState } from '#lib/state-uri.ts';
	import { ui, setDocsNavCollapsed } from '#lib/ui.svelte.ts';
	import 'katex/dist/katex.min.css';

	let { data }: PageProps = $props();

	/* ---------- Bi-directional scroll alignment ---------- */
	let activeSectionId = $state('intro');
	let prose = $state<HTMLElement | undefined>();
	let railOpenMobile = $state(false);
	let mobileIndexOpen = $state(false);

	/**
	 * Resolve which compiled example the rail should show for a section:
	 * the section's own first example, else the nearest preceding one.
	 */
	const exampleForSection = $derived.by(() => {
		const map = new SvelteMap<string, (typeof data.doc.examples)[number]>();
		let previous: (typeof data.doc.examples)[number] | undefined;
		for (const section of [{ id: 'intro', title: '' }, ...data.doc.sections]) {
			const own = data.doc.examples.find((example) => example.sectionId === section.id);
			if (own) previous = own;
			if (previous) map.set(section.id, previous);
		}
		return map;
	});

	const activeExample = $derived(exampleForSection.get(activeSectionId) ?? data.doc.examples[0]);

	$effect(() => {
		/* Re-arm the observer whenever the rendered document changes. */
		void data.doc;
		const root = prose;
		if (!root) return;
		const headings = Array.from(root.querySelectorAll<HTMLElement>('h2[id]'));
		activeSectionId = 'intro';
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeSectionId = entry.target.id;
				}
			},
			{ rootMargin: '-15% 0px -70% 0px' }
		);
		for (const heading of headings) observer.observe(heading);
		return () => observer.disconnect();
	});

	const groups = $derived.by(() => {
		const order: string[] = [];
		const byGroup = new SvelteMap<string, (typeof data.manifest)[number][]>();
		for (const entry of data.manifest) {
			const bucket = byGroup.get(entry.group);
			if (bucket) {
				bucket.push(entry);
			} else {
				byGroup.set(entry.group, [entry]);
				order.push(entry.group);
			}
		}
		return order.map((group) => ({ group, pages: byGroup.get(group) ?? [] }));
	});

	/* ---------- Smart previous / next document ---------- */
	const docIndex = $derived(data.manifest.findIndex((entry) => entry.slug === data.meta.slug));
	const prevDoc = $derived(docIndex > 0 ? data.manifest[docIndex - 1] : undefined);
	const nextDoc = $derived(
		docIndex >= 0 && docIndex < data.manifest.length - 1 ? data.manifest[docIndex + 1] : undefined
	);

	/* Figures are numbered in page order, as a datasheet numbers them. */
	const figureNumber = $derived(
		activeExample === undefined
			? 0
			: data.doc.examples.findIndex((example) => example.id === activeExample.id) + 1
	);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: `${data.meta.title} — schemd v${data.version}`,
			description: data.meta.summary,
			version: data.version,
			inLanguage: 'en-US',
			url: `${page.url.origin}/docs/${data.version}/${data.meta.slug}`,
			author: { '@type': 'Person', name: 'John Owolabi Idogun' },
			about: { '@type': 'SoftwareApplication', name: '@schemd/core' }
		})
	);
</script>

<Seo
	title={`${data.meta.title} · schemd v${data.version} docs`}
	description={data.meta.summary}
	canonicalPath={`/docs/${data.version}/${data.meta.slug}`}
	type="article"
	{jsonLd}
/>

<div class="docs-shell" class:nav-collapsed={ui.docsNavCollapsed}>
	<!-- LEFT: the contents -->
	<aside class="doc-nav" class:mobile-open={mobileIndexOpen} aria-label="Documentation index">
		<div class="doc-nav-head">
			<div class="nav-heading">
				<p class="nav-title">Contents</p>
				<p class="nav-meta">Documentation {data.version}, {data.manifest.length} pages</p>
			</div>
			<button
				type="button"
				class="collapse-toggle"
				onclick={() => setDocsNavCollapsed(true)}
				aria-expanded="true"
				aria-label="Hide contents"
			>
				Hide
			</button>
			<button
				type="button"
				class="mobile-index-toggle"
				onclick={() => (mobileIndexOpen = !mobileIndexOpen)}
				aria-expanded={mobileIndexOpen}
			>
				<span>Contents: {data.meta.label}</span>
				<span aria-hidden="true">{mobileIndexOpen ? '−' : '+'}</span>
			</button>
		</div>

		<nav class="doc-nav-tree">
			{#each groups as { group, pages } (group)}
				<details open>
					<summary>{group}</summary>
					<ul>
						{#each pages as pageMeta (pageMeta.slug)}
							<li>
								<a
									href={`/docs/${data.version}/${pageMeta.slug}`}
									aria-current={pageMeta.slug === data.meta.slug ? 'page' : undefined}
									onclick={() => (mobileIndexOpen = false)}
								>
									{pageMeta.label}
								</a>
								{#if pageMeta.slug === data.meta.slug && data.doc.sections.length > 0}
									<ol class="section-tree">
										{#each data.doc.sections as section, index (section.id)}
											<li>
												<a
													href={`#${section.id}`}
													class:active={section.id === activeSectionId}
													onclick={() => (mobileIndexOpen = false)}
												>
													<span class="snum">{index + 1}</span>
													{section.title}
												</a>
											</li>
										{/each}
									</ol>
								{/if}
							</li>
						{/each}
					</ul>
				</details>
			{/each}
		</nav>
	</aside>

	<!-- CENTER: the reading column -->
	<article class="doc-article" bind:this={prose}>
		{#if ui.docsNavCollapsed}
			<button
				type="button"
				class="show-contents"
				onclick={() => setDocsNavCollapsed(false)}
				aria-expanded="false">Show contents</button
			>
		{/if}
		<header class="doc-header">
			<p class="doc-group">{data.meta.group}</p>
			<h1>{data.meta.title}</h1>
			{#if data.meta.slug === 'overview'}
				<Pronounce />
			{/if}
			<p class="doc-summary">{data.meta.summary}</p>
		</header>
		<div class="prose">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered from the docs corpus -->
			{@html data.doc.html}
		</div>

		<nav class="doc-pager" aria-label="Adjacent documentation">
			{#if prevDoc}
				<a class="pager-link prev" href={`/docs/${data.version}/${prevDoc.slug}`}>
					<span class="pager-dir">Previous</span>
					<span class="pager-title">{prevDoc.title}</span>
				</a>
			{:else}
				<span></span>
			{/if}
			{#if nextDoc}
				<a class="pager-link next" href={`/docs/${data.version}/${nextDoc.slug}`}>
					<span class="pager-dir">Next</span>
					<span class="pager-title">{nextDoc.title}</span>
				</a>
			{/if}
		</nav>
	</article>

	<!-- RIGHT: the figure for the section being read -->
	<aside
		class="doc-rail"
		class:open={railOpenMobile}
		aria-label="Compiled example for the active section"
	>
		{#if activeExample}
			{#key activeExample.id}
				<div class="rail-body">
					<figure class="rail-figure">
						<div class="schemd-frame trace-on">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
							{@html activeExample.svg}
						</div>
						<figcaption class="rail-caption">
							<b>Figure {figureNumber}.</b>
							{activeExample.title}
						</figcaption>
					</figure>
					<!-- Keyboard focus exposes overflowing source to Safari users. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<pre
						class="codeblock rail-src"
						tabindex="0"
						role="region"
						aria-label="Scrollable active example source"><code
							><!-- eslint-disable-next-line svelte/no-at-html-tags -- tokenizer output -->{@html activeExample.sourceHtml}</code
						></pre>
					<a
						class="btn rail-open"
						href={`/playground/${data.version}?code=${encodeWorkspaceState(activeExample.source)}`}
					>
						Open in playground
					</a>
				</div>
			{/key}
		{:else}
			<p class="rail-empty">This page has no figures.</p>
		{/if}
	</aside>

	<!-- Mobile bottom-sheet toggle -->
	<button
		type="button"
		class="rail-toggle btn"
		aria-expanded={railOpenMobile}
		onclick={() => (railOpenMobile = !railOpenMobile)}
	>
		{railOpenMobile ? 'Hide compiled example' : 'Show compiled example'}
	</button>
</div>

<style>
	.docs-shell {
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr) minmax(300px, 400px);
		inline-size: min(100% - 2 * var(--space-4), 1440px);
		margin-inline: auto;
		min-block-size: calc(100vh - var(--header-h));

		&.nav-collapsed {
			grid-template-columns: 0 minmax(0, 1fr) minmax(300px, 400px);
		}
	}

	/* ----- left: contents ----- */
	.doc-nav {
		position: sticky;
		inset-block-start: 44px;
		block-size: calc(100vh - 44px);
		overflow-y: auto;
		padding: var(--space-6) var(--space-4) var(--space-6) 0;
		border-inline-end: 1px solid var(--line);
		font-stretch: var(--width-table);
		font-size: var(--text-sm);
	}

	.docs-shell.nav-collapsed .doc-nav {
		display: none;
	}

	.doc-nav-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-2);
		margin-block-end: var(--space-4);
	}

	.nav-title {
		margin: 0;
		font-weight: 700;
		font-size: var(--text-base);
	}

	.nav-meta {
		margin: 0;
		color: var(--ink-mute);
	}

	.collapse-toggle,
	.show-contents {
		font-stretch: var(--width-table);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent);
	}

	.show-contents {
		margin-block-end: var(--space-4);
	}

	.mobile-index-toggle {
		display: none;
		inline-size: 100%;
		justify-content: space-between;
		font-weight: 600;
	}

	.doc-nav details {
		margin-block-end: var(--space-4);

		& summary {
			list-style: none;
			cursor: pointer;
			font-weight: 700;
			color: var(--ink);
			margin-block-end: var(--space-1);

			&::-webkit-details-marker {
				display: none;
			}
		}

		& ul {
			list-style: none;
			margin: 0;
			padding: 0;
		}

		& li a {
			display: block;
			padding: 0.2rem 0 0.2rem var(--space-3);
			border-inline-start: 2px solid var(--line);
			color: var(--ink);

			&:hover {
				text-decoration: none;
				border-inline-start-color: var(--ink-mute);
			}

			&[aria-current='page'] {
				font-weight: 700;
				border-inline-start-color: var(--ink);
			}
		}
	}

	.section-tree {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;

		& a {
			display: flex;
			gap: var(--space-2);
			padding-inline-start: var(--space-5) !important;
			color: var(--ink-mute) !important;
			font-weight: 400 !important;

			&.active {
				color: var(--ink) !important;
				border-inline-start-color: var(--accent) !important;
			}
		}

		& .snum {
			min-inline-size: 1.4em;
			font-variant-numeric: tabular-nums;
		}
	}

	/* ----- center: the reading column ----- */
	.doc-article {
		padding: var(--space-8) var(--space-8) var(--space-16);
		min-inline-size: 0;
	}

	.doc-header {
		max-inline-size: var(--measure);
		margin-block-end: var(--space-8);

		& h1 {
			margin-block: var(--space-1) var(--space-3);
		}
	}

	.doc-group {
		margin: 0;
		font-stretch: var(--width-table);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.doc-summary {
		margin: var(--space-3) 0 0;
		font-size: var(--text-md);
		line-height: 1.45;
		color: var(--ink-mute);
	}

	/* The renderer prints each section's number beside its title. */
	.prose :global(h2 .doc-num) {
		display: inline-block;
		min-inline-size: 2em;
		font-variant-numeric: tabular-nums;
	}

	.doc-pager {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-6);
		max-inline-size: var(--measure);
		margin-block-start: var(--space-12);
		padding-block-start: var(--space-4);
		border-block-start: 2px solid var(--ink);
	}

	.pager-link {
		display: grid;
		gap: var(--space-1);
		color: var(--ink);

		&.next {
			text-align: end;
		}

		&:hover .pager-title {
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}

		&:hover {
			text-decoration: none;
		}
	}

	.pager-dir {
		font-stretch: var(--width-table);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.pager-title {
		font-stretch: var(--width-condensed);
		font-weight: 700;
		font-size: var(--text-md);
		color: var(--accent);
	}

	/* ----- right: the figure ----- */
	.doc-rail {
		position: sticky;
		inset-block-start: 44px;
		block-size: calc(100vh - 44px);
		overflow-y: auto;
		padding: var(--space-8) 0 var(--space-8) var(--space-6);
		border-inline-start: 1px solid var(--line);
	}

	.rail-figure {
		margin: 0;
	}

	/* The compiler's own caption repeats the figure title; the numbered caption
	   below the frame replaces it. */
	.rail-figure :global(.schemd-frame figcaption) {
		display: none;
	}

	.rail-caption {
		margin-block: var(--space-2) var(--space-4);
		font-stretch: var(--width-table);
		font-size: var(--text-sm);
		color: var(--ink-mute);

		& b {
			color: var(--ink);
		}
	}

	.rail-src {
		max-block-size: 40vh;
		font-size: 0.8125rem;
	}

	.rail-open {
		margin-block-start: var(--space-4);
	}

	.rail-empty {
		color: var(--ink-mute);
	}

	.rail-toggle {
		display: none;
	}

	/* ----- narrower screens: contents as a disclosure, figure as a sheet ----- */
	@media (max-width: 1080px) {
		.docs-shell,
		.docs-shell.nav-collapsed {
			grid-template-columns: minmax(0, 1fr);
			--rail-toggle-clearance: calc(var(--space-4) * 2 + 2.75rem);
		}

		.doc-nav,
		.docs-shell.nav-collapsed .doc-nav {
			display: block;
			position: static;
			block-size: auto;
			border-inline-end: none;
			border-block-end: 1px solid var(--line);
			padding: var(--space-3) 0;
			overflow: visible;
		}

		.doc-nav-head {
			margin: 0;
		}

		.nav-heading,
		.collapse-toggle,
		.show-contents {
			display: none;
		}

		.mobile-index-toggle {
			display: flex;
		}

		.doc-nav-tree {
			display: none;
			margin-block-start: var(--space-3);
			max-block-size: 60vh;
			overflow-y: auto;
		}

		.doc-nav.mobile-open .doc-nav-tree {
			display: block;
		}

		.doc-article {
			padding-inline: 0;
		}

		.doc-rail {
			position: fixed;
			inset-inline: 0;
			inset-block: auto 0;
			block-size: min(70vh, 560px);
			z-index: 60;
			padding: var(--space-4);
			padding-block-end: var(--rail-toggle-clearance);
			background: var(--bg);
			border-inline-start: none;
			border-block-start: 2px solid var(--ink);
			transform: translateY(100%);
			transition: transform var(--dur-med) var(--ease-precise);

			&.open {
				transform: translateY(0);
			}
		}

		.rail-toggle {
			display: inline-flex;
			position: fixed;
			inset-block-end: var(--space-4);
			inset-inline-end: var(--space-4);
			z-index: 61;
		}
	}

	@media (max-width: 620px) {
		.doc-article {
			padding-block: var(--space-5) calc(var(--space-16) + 3rem);
			overflow: hidden;
		}

		.doc-header h1 {
			font-size: clamp(1.75rem, 9vw, var(--text-2xl));
		}

		.doc-summary {
			font-size: var(--text-base);
		}

		.docs-shell,
		.docs-shell.nav-collapsed {
			--rail-toggle-clearance: calc(var(--space-3) * 2 + 2.75rem);
		}

		.doc-rail {
			block-size: min(82vh, 620px);
			padding: var(--space-3);
			padding-block-end: var(--rail-toggle-clearance);
		}

		.rail-toggle {
			inset-inline: var(--space-3);
			inset-block-end: var(--space-3);
			justify-content: center;
		}
	}
</style>
