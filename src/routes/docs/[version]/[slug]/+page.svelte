<script lang="ts">
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import Pronounce from '$lib/components/Pronounce.svelte';

	let { data }: PageProps = $props();

	/* ---------- Bi-directional scroll alignment ---------- */
	let activeSectionId = $state('intro');
	let prose = $state<HTMLElement | undefined>();
	let railOpenMobile = $state(false);
	let navCollapsed = $state(false);

	/**
	 * Resolve which compiled example the rail should show for a section:
	 * the section's own first example, else the nearest preceding one.
	 */
	const exampleForSection = $derived.by(() => {
		const map = new Map<string, (typeof data.doc.examples)[number]>();
		let previous: (typeof data.doc.examples)[number] | undefined;
		for (const section of [{ id: 'intro', title: '' }, ...data.doc.sections]) {
			const own = data.doc.examples.find((example) => example.sectionId === section.id);
			if (own) previous = own;
			if (previous) map.set(section.id, previous);
		}
		return map;
	});

	const activeExample = $derived(
		exampleForSection.get(activeSectionId) ?? data.doc.examples[0]
	);

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
		const byGroup = new Map<string, (typeof data.manifest)[number][]>();
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

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: `${data.meta.title} — schemd v${data.version}`,
			description: data.meta.summary,
			version: data.version,
			author: { '@type': 'Person', name: 'John Owolabi Idogun' },
			about: { '@type': 'SoftwareApplication', name: '@schemd/core' }
		})
	);
</script>

<svelte:head>
	<title>{data.meta.title} · schemd v{data.version} docs</title>
	<meta name="description" content={data.meta.summary} />
	<meta property="og:title" content={`${data.meta.title} · schemd docs`} />
	<meta property="og:description" content={data.meta.summary} />
	<meta property="og:type" content="article" />
	{#if data.version !== data.latest}
		<link rel="canonical" href={`${page.url.origin}/docs/${data.latest}/${data.meta.slug}`} />
	{/if}
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="docs-shell" class:nav-collapsed={navCollapsed}>
	<!-- LEFT: collapsible index tree -->
	<aside class="doc-nav" aria-label="Documentation index">
		<div class="doc-nav-head">
			<div>
				<span class="doc-nav-brand">schemd docs</span>
				<Pronounce compact />
			</div>
			<button
				type="button"
				class="collapse-toggle"
				onclick={() => (navCollapsed = !navCollapsed)}
				aria-expanded={!navCollapsed}
				aria-label={navCollapsed ? 'Expand index' : 'Collapse index'}
			>
				{navCollapsed ? '⟩' : '⟨'}
			</button>
		</div>
		{#if !navCollapsed}
			<nav>
				{#each groups as { group, pages } (group)}
					<details open>
						<summary class="microlabel">{group}</summary>
						<ul>
							{#each pages as pageMeta (pageMeta.slug)}
								<li>
									<a
										href={`/docs/${data.version}/${pageMeta.slug}`}
										aria-current={pageMeta.slug === data.meta.slug ? 'page' : undefined}
									>
										{pageMeta.title}
									</a>
									{#if pageMeta.slug === data.meta.slug && data.doc.sections.length > 0}
										<ul class="section-tree">
											{#each data.doc.sections as section (section.id)}
												<li>
													<a
														href={`#${section.id}`}
														class:active={section.id === activeSectionId}
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
		{/if}
	</aside>

	<!-- CENTER: long-form reading column -->
	<article class="doc-article" bind:this={prose}>
		<header class="doc-header">
			<p class="microlabel">v{data.version} · {data.meta.group}</p>
		</header>
		<div class="prose">
			{@html data.doc.html}
		</div>
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
					<pre class="codeblock rail-src"><code>{@html activeExample.sourceHtml}</code></pre>
					<a
						class="btn rail-open"
						href={`/playground/${data.version}?code=${encodeURIComponent(
							btoa(unescape(encodeURIComponent(activeExample.source)))
								.replace(/\+/g, '-')
								.replace(/\//g, '_')
								.replace(/=+$/, '')
						)}`}
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
			grid-template-columns: 48px minmax(0, 1fr) minmax(300px, 380px);
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

	.docs-shell.nav-collapsed .doc-nav-head > div {
		display: none;
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

	.doc-header {
		margin-block-end: var(--space-2);
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
		animation: crossfade var(--dur-med) var(--ease-precise) both;
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

		.doc-nav {
			position: static;
			block-size: auto;
			border-inline-end: none;
			border-block-end: 1px solid var(--line);
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
