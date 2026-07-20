<script lang="ts">
	import type { PageProps } from './$types';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Pronounce from '$lib/components/Pronounce.svelte';
	import { encodeWorkspaceState } from '$lib/state-uri';
	import { ui, setDocsNavCollapsed } from '$lib/ui.svelte';

	let { data }: PageProps = $props();

	/* ---------- Bi-directional scroll alignment ---------- */
	let activeSectionId = $state('intro');
	let prose = $state<HTMLElement | undefined>();
	let railOpenMobile = $state(false);
	let mobileIndexOpen = $state(false);

	/** Compact 2-char stub for the collapsed index rail. */
	function stub(label: string): string {
		const letters = label.replace(/[^A-Za-z0-9]/g, '');
		return (letters.slice(0, 2) || '··').toUpperCase();
	}

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

	/* ---------- Reading progress through the article ---------- */
	let readProgress = $state(0);
	$effect(() => {
		void data.doc;
		const el = prose;
		if (!el) return;
		const update = (): void => {
			const distance = el.offsetHeight - window.innerHeight;
			const scrolled = -el.getBoundingClientRect().top;
			readProgress =
				distance > 0 ? Math.min(1, Math.max(0, scrolled / distance)) : scrolled >= 0 ? 1 : 0;
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});

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
	const jsonLdMarkup = $derived(`<script type="application/ld+json">${jsonLd}</${'script'}>`);
</script>

<svelte:head>
	<title>{data.meta.title} · schemd v{data.version} docs</title>
	<meta name="description" content={data.meta.summary} />
	<meta property="og:title" content={`${data.meta.title} · schemd docs`} />
	<meta property="og:description" content={data.meta.summary} />
	<meta property="og:type" content="article" />
	<link rel="canonical" href={`${page.url.origin}/docs/${data.version}/${data.meta.slug}`} />
	{@html jsonLdMarkup}
</svelte:head>

<div class="docs-shell" class:nav-collapsed={ui.docsNavCollapsed}>
	<!-- LEFT: collapsible index tree -->
	<aside class="doc-nav" class:mobile-open={mobileIndexOpen} aria-label="Documentation index">
		<div class="doc-nav-head">
			<div class="doc-nav-brandwrap">
				<span class="doc-nav-brand">schemd docs</span>
				<Pronounce compact />
			</div>
			<button
				type="button"
				class="collapse-toggle"
				onclick={() => setDocsNavCollapsed(!ui.docsNavCollapsed)}
				aria-expanded={!ui.docsNavCollapsed}
				aria-label={ui.docsNavCollapsed ? 'Expand index' : 'Collapse index'}
			>
				{ui.docsNavCollapsed ? '⟩' : '⟨'}
			</button>
			<button
				type="button"
				class="mobile-index-toggle"
				onclick={() => (mobileIndexOpen = !mobileIndexOpen)}
				aria-expanded={mobileIndexOpen}
			>
				<span class="microlabel">index · {data.meta.label}</span>
				<span aria-hidden="true">{mobileIndexOpen ? '▲' : '▼'}</span>
			</button>
		</div>

		<!-- Collapsed desktop: data-driven icon stubs, one per doc, grouped -->
		<nav class="doc-nav-rail" aria-label="Documentation index (compact)">
			{#each groups as { group, pages } (group)}
				<div class="rail-group" role="group" aria-label={group}>
					{#each pages as pageMeta (pageMeta.slug)}
						<a
							class="rail-stub"
							href={`/docs/${data.version}/${pageMeta.slug}`}
							title={pageMeta.label}
							aria-label={pageMeta.label}
							aria-current={pageMeta.slug === data.meta.slug ? 'page' : undefined}
						>
							{stub(pageMeta.label)}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<!-- Expanded desktop / opened mobile: full tree -->
		<nav class="doc-nav-tree">
			{#each groups as { group, pages } (group)}
				<details open>
					<summary class="microlabel">{group}</summary>
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
									<ul class="section-tree">
										{#each data.doc.sections as section (section.id)}
											<li>
												<a
													href={`#${section.id}`}
													class:active={section.id === activeSectionId}
													onclick={() => (mobileIndexOpen = false)}
												>
													{section.title}
												</a>
											</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				</details>
			{/each}
		</nav>
	</aside>

	<!-- CENTER: long-form reading column -->
	<article class="doc-article" bind:this={prose}>
		<div class="read-progress" aria-hidden="true">
			<span style={`transform: scaleX(${readProgress})`}></span>
		</div>
		<header class="doc-header">
			<p class="microlabel">v{data.version} · {data.meta.group}</p>
			<h1>{data.meta.title}</h1>
			{#if data.meta.slug === 'overview'}
				<Pronounce />
			{/if}
			<p class="doc-summary">{data.meta.summary}</p>
		</header>
		<div class="prose">
			{@html data.doc.html}
		</div>

		<nav class="doc-pager" aria-label="Adjacent documentation">
			{#if prevDoc}
				<a class="pager-card prev" href={`/docs/${data.version}/${prevDoc.slug}`}>
					<span class="microlabel">← previous</span>
					<span class="pager-title">{prevDoc.title}</span>
					<span class="pager-group microlabel">{prevDoc.group}</span>
				</a>
			{:else}
				<span></span>
			{/if}
			{#if nextDoc}
				<a class="pager-card next" href={`/docs/${data.version}/${nextDoc.slug}`}>
					<span class="microlabel">next →</span>
					<span class="pager-title">{nextDoc.title}</span>
					<span class="pager-group microlabel">{nextDoc.group}</span>
				</a>
			{/if}
		</nav>
	</article>

	<!-- RIGHT: pinned compiled-example rail -->
	<aside
		class="doc-rail"
		class:open={railOpenMobile}
		aria-label="Compiled example for the active section"
	>
		{#if activeExample}
			{#key activeExample.id}
				<div class="rail-body">
					<p class="microlabel rail-title">{activeExample.title}</p>
					<div class="schemd-frame">
						{@html activeExample.svg}
					</div>
					<!-- Keyboard focus exposes overflowing source to Safari users. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<pre
						class="codeblock rail-src"
						tabindex="0"
						role="region"
						aria-label="Scrollable active example source"><code
							>{@html activeExample.sourceHtml}</code
						></pre>
					<a
						class="btn rail-open"
						href={`/playground/${data.version}?code=${encodeWorkspaceState(activeExample.source)}`}
					>
						Open in playground →
					</a>
				</div>
			{/key}
		{:else}
			<p class="microlabel rail-empty">This page has no compiled examples.</p>
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
		grid-template-columns: 264px minmax(0, 1fr) minmax(300px, 380px);
		min-block-size: calc(100vh - var(--header-h));

		&.nav-collapsed {
			grid-template-columns: 64px minmax(0, 1fr) minmax(300px, 380px);
		}
	}

	/* ----- left ----- */
	.doc-nav {
		border-inline-end: 1px solid var(--line);
		background: var(--bg-raised);
		position: sticky;
		inset-block-start: var(--header-h);
		block-size: calc(100vh - var(--header-h));
		overflow-y: auto;
		padding: var(--space-4);
	}

	.doc-nav-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-2);
		margin-block-end: var(--space-4);

		& .doc-nav-brand {
			display: block;
			font-family: var(--font-mono);
			font-weight: 700;
		}
	}

	.docs-shell.nav-collapsed .doc-nav-brandwrap {
		display: none;
	}

	.docs-shell.nav-collapsed .doc-nav {
		padding-inline: var(--space-2);
	}

	.collapse-toggle {
		border: 1px solid var(--line);
		padding: 0.1rem 0.45rem;
		color: var(--ink-faint);

		&:hover {
			color: var(--accent);
			border-color: var(--accent);
		}
	}

	/* Mobile disclosure toggle — hidden on desktop. */
	.mobile-index-toggle {
		display: none;
		align-items: center;
		gap: var(--space-2);
		inline-size: 100%;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
		color: var(--accent);
	}

	/* ----- which nav shows: desktop default = tree, collapsed = stubs ----- */
	.doc-nav-rail {
		display: none;
		gap: var(--space-3);
		justify-items: center;
	}

	.doc-nav-tree {
		display: block;
	}

	.docs-shell.nav-collapsed .doc-nav-rail {
		display: grid;
	}

	.docs-shell.nav-collapsed .doc-nav-tree {
		display: none;
	}

	.rail-group {
		display: grid;
		gap: var(--space-1);
		justify-items: center;
		padding-block-end: var(--space-2);
		border-block-end: 1px solid var(--line);

		&:last-child {
			border-block-end: none;
		}
	}

	.rail-stub {
		display: grid;
		place-items: center;
		inline-size: 34px;
		block-size: 34px;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: 0.02em;
		color: var(--ink-mute);
		border: 1px solid var(--line);
		background: var(--bg-inset);
		transition:
			border-color var(--dur-fast) var(--ease-precise),
			color var(--dur-fast) var(--ease-precise),
			transform var(--dur-fast) var(--ease-precise);

		&:hover {
			color: var(--ink);
			border-color: var(--line-strong);
			text-decoration: none;
			transform: translateY(-1px);
		}

		&[aria-current='page'] {
			color: var(--accent-ink);
			background: var(--accent);
			border-color: var(--accent);
		}
	}

	.doc-nav details {
		margin-block-end: var(--space-3);

		& summary {
			cursor: pointer;
			list-style: none;
			padding-block: var(--space-1);

			&::before {
				content: '▸ ';
				color: var(--accent);
			}
		}

		&[open] summary::before {
			content: '▾ ';
		}

		& ul {
			list-style: none;
			margin: 0;
			padding-inline-start: var(--space-3);
		}

		& a {
			display: block;
			padding: 0.22rem 0.4rem;
			font-size: var(--text-sm);
			color: var(--ink-mute);
			border-inline-start: 1px solid var(--line);
			transition:
				color var(--dur-fast) var(--ease-precise),
				border-color var(--dur-fast) var(--ease-precise);

			&:hover {
				color: var(--ink);
				text-decoration: none;
			}

			&[aria-current='page'] {
				color: var(--accent);
				border-inline-start-color: var(--accent);
			}
		}
	}

	.section-tree {
		& a {
			font-size: var(--text-xs);
			color: var(--ink-faint);

			&.active {
				color: var(--accent);
				border-inline-start-color: var(--accent);
			}
		}
	}

	/* ----- center ----- */
	.doc-article {
		padding: var(--space-8) clamp(1rem, 4vw, 3.5rem) var(--space-16);
		min-inline-size: 0;
	}

	/* Reading progress — sticks under the header, fills as you scroll. */
	.read-progress {
		position: sticky;
		inset-block-start: var(--header-h);
		z-index: 5;
		block-size: 2px;
		background: var(--line);
		margin-block-end: var(--space-6);
		overflow: hidden;

		& span {
			display: block;
			block-size: 100%;
			background: var(--accent);
			transform-origin: left;
			transition: transform 90ms linear;
			box-shadow: 0 0 6px var(--glow);
		}
	}

	/* Smart previous / next pager. */
	.doc-pager {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		margin-block-start: var(--space-16);
		padding-block-start: var(--space-6);
		border-block-start: 1px solid var(--line);
	}

	.pager-card {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-4);
		border: 1px solid var(--line);
		background: var(--bg-raised);
		color: var(--ink-mute);
		transition:
			border-color var(--dur-kinetic) var(--ease-kinetic),
			transform var(--dur-kinetic) var(--ease-kinetic);

		&:hover {
			border-color: var(--accent);
			transform: translateY(-2px);
			text-decoration: none;
		}

		&.next {
			text-align: end;
		}

		& .pager-title {
			font-size: var(--text-md);
			font-weight: 600;
			color: var(--ink);
		}

		& .pager-group {
			color: var(--ink-faint);
		}
	}

	@media (max-width: 620px) {
		.doc-pager {
			grid-template-columns: 1fr;
		}
	}

	.doc-header {
		margin-block-end: var(--space-6);

		& h1 {
			font-size: var(--text-xl);
			letter-spacing: -0.02em;
			margin-block: var(--space-2) var(--space-3);
		}
	}

	.doc-summary {
		margin: 0;
		max-inline-size: 68ch;
		color: var(--ink-mute);
		font-size: var(--text-md);
	}

	/* Section eyebrow injected before each h2 by the markdown pipeline. */
	.prose :global(h2 .doc-eyebrow) {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		font-weight: 500;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--accent);
		margin-block-end: var(--space-1);
	}

	/* ----- right rail: rigid sticky context ----- */
	.doc-rail {
		border-inline-start: 1px solid var(--line);
		background: var(--bg-raised);
		position: sticky;
		inset-block-start: var(--header-h);
		block-size: calc(100vh - var(--header-h));
		overflow-y: auto;
		padding: var(--space-4);
	}

	.rail-body {
		display: grid;
		gap: var(--space-3);
		animation: rail-align var(--dur-med) var(--ease-precise) both;
	}

	@keyframes rail-align {
		from {
			transform: translateY(4px);
		}
		to {
			transform: translateY(0);
		}
	}

	.rail-title {
		color: var(--accent);
	}

	.rail-src {
		font-size: var(--text-2xs);
		max-block-size: 300px;
	}

	.rail-open {
		justify-self: start;
		font-size: var(--text-xs);
	}

	.rail-empty {
		padding: var(--space-4);
	}

	.rail-toggle {
		display: none;
	}

	/* ----- responsive: rail becomes a bottom sheet ----- */
	@media (max-width: 1080px) {
		.docs-shell,
		.docs-shell.nav-collapsed {
			grid-template-columns: 1fr;
		}

		.doc-nav,
		.docs-shell.nav-collapsed .doc-nav {
			position: static;
			block-size: auto;
			border-inline-end: none;
			border-block-end: 1px solid var(--line);
			padding: var(--space-2) var(--space-3);
			overflow: visible;
		}

		.doc-nav-head {
			margin-block-end: 0;
		}

		/* On mobile the index is a compact disclosure, closed by default. */
		.doc-nav-brandwrap,
		.collapse-toggle {
			display: none;
		}

		.mobile-index-toggle {
			display: flex;
		}

		.doc-nav-rail {
			display: none !important;
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

		.doc-rail {
			position: fixed;
			inset-inline: 0;
			inset-block-end: 0;
			inset-block-start: auto;
			block-size: min(70vh, 560px);
			z-index: 60;
			border-block-start: 1px solid var(--line-strong);
			transform: translateY(100%);
			transition: transform var(--dur-med) var(--ease-precise);

			&.open {
				transform: translateY(0);
				box-shadow: 0 -12px 40px rgb(0 0 0 / 0.4);
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
</style>
