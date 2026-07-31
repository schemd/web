<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Pronounce from '$lib/components/Pronounce.svelte';
	import { encodeWorkspaceState } from '$lib/state-uri';
	import { ui, setDocsNavCollapsed } from '$lib/ui.svelte';
	import 'katex/dist/katex.min.css';

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
		let frame = 0;
		const measure = (): void => {
			frame = 0;
			const distance = el.offsetHeight - window.innerHeight;
			const scrolled = -el.getBoundingClientRect().top;
			readProgress =
				distance > 0 ? Math.min(1, Math.max(0, scrolled / distance)) : scrolled >= 0 ? 1 : 0;
		};
		const schedule = (): void => {
			if (frame === 0) frame = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	});

	/**
	 * Title-block fields.
	 *
	 * A drafting sheet identifies itself in a title block rather than a
	 * headline, and this corpus already carries every field one needs: which
	 * sheet of how many, which revision line, and what the sheet contains.
	 */
	const titleBlock = $derived([
		{ field: 'sheet', value: `${docIndex + 1} / ${data.manifest.length}` },
		{ field: 'rev', value: `v${data.version}` },
		{ field: 'sections', value: String(data.doc.sections.length) },
		{ field: 'compiled', value: String(data.doc.examples.length) }
	]);

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
	<!-- LEFT: collapsible index tree -->
	<aside class="doc-nav" class:mobile-open={mobileIndexOpen} aria-label="Documentation index">
		<div class="doc-nav-head">
			<div class="doc-nav-brandwrap">
				<span class="doc-nav-brand">schemd docs</span>
				<span class="doc-nav-meta microlabel">
					v{data.version} · {data.manifest.length} sheets
				</span>
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
		<header class="doc-header plate">
			<p class="eyebrow">{data.meta.group}</p>
			<h1>{data.meta.title}</h1>
			{#if data.meta.slug === 'overview'}
				<Pronounce />
			{/if}
			<p class="doc-summary">{data.meta.summary}</p>
			<dl class="title-block">
				{#each titleBlock as entry (entry.field)}
					<div>
						<dt class="microlabel">{entry.field}</dt>
						<dd class="readout">{entry.value}</dd>
					</div>
				{/each}
			</dl>
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
		<div class="rail-head">
			<span class="rail-lamp" aria-hidden="true"></span>
			<span class="microlabel">compiled example</span>
			<span class="microlabel rail-mode">mode=full</span>
		</div>
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

	/* ----- left: the index card ----- */
	.doc-nav {
		position: sticky;
		inset-block-start: var(--header-h);
		block-size: calc(100vh - var(--header-h));
		overflow-y: auto;
		padding: var(--space-4);
		border-inline-end: 1px solid var(--line);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent) 3.5%, transparent),
				transparent 220px
			),
			var(--bg-raised);
		scrollbar-gutter: stable;
	}

	.doc-nav-head {
		position: sticky;
		inset-block-start: calc(var(--space-4) * -1);
		z-index: 2;
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-2);
		margin-block: calc(var(--space-4) * -1) var(--space-4);
		padding-block: var(--space-4) var(--space-3);
		background: linear-gradient(180deg, var(--bg-raised) 78%, transparent);

		& .doc-nav-brand {
			display: block;
			font-family: var(--font-mono);
			font-weight: 700;
			letter-spacing: -0.01em;
		}

		& .doc-nav-meta {
			display: block;
			margin-block-start: 2px;
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
		margin-block-end: var(--space-4);

		& summary {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			cursor: pointer;
			list-style: none;
			padding-block: var(--space-1);

			&::before {
				content: '';
				inline-size: 5px;
				block-size: 5px;
				background: var(--accent);
				clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
				transition: transform var(--dur-med) var(--ease-kinetic);
			}

			/* The group header's rule runs out to the rail edge. */
			&::after {
				content: '';
				flex: 1;
				block-size: 1px;
				background: var(--line);
			}
		}

		&[open] summary::before {
			transform: rotate(90deg) scale(1.15);
		}

		& ul {
			list-style: none;
			margin: 0;
			padding-inline-start: var(--space-3);
		}

		/* Every index entry is a track; the active one lights its spine. */
		& li > a {
			position: relative;
			display: block;
			padding: 0.26rem 0.5rem;
			border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
			font-size: var(--text-sm);
			color: var(--ink-mute);
			border-inline-start: 1px solid var(--line);
			transition:
				color var(--dur-fast) var(--ease-precise),
				background-color var(--dur-fast) var(--ease-precise);

			&::before {
				content: '';
				position: absolute;
				inset-block: 0;
				inset-inline-start: -1px;
				inline-size: 2px;
				background: var(--accent-grad-v);
				transform: scaleY(0);
				transform-origin: top;
				transition: transform var(--dur-med) var(--ease-kinetic);
			}

			&:hover {
				color: var(--ink);
				background: color-mix(in srgb, var(--ink) 5%, transparent);
				text-decoration: none;
			}

			&[aria-current='page'] {
				color: var(--accent);
				background: color-mix(in srgb, var(--accent) 9%, transparent);

				&::before {
					transform: scaleY(1);
				}
			}
		}
	}

	.section-tree {
		margin-block: 2px var(--space-2);

		& a {
			font-size: var(--text-xs);
			color: var(--ink-faint);

			&.active {
				color: var(--accent);
				background: color-mix(in srgb, var(--accent) 7%, transparent);

				&::before {
					transform: scaleY(1);
				}
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
		border-radius: 2px;

		& span {
			display: block;
			block-size: 100%;
			background: var(--accent-grad);
			transform-origin: left;
			transition: transform 90ms linear;
			box-shadow: 0 0 8px var(--glow);
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
		border-radius: var(--radius-md);
		background-color: var(--bg-raised);
		background-image: var(--sheen);
		color: var(--ink-mute);
		transition:
			border-color var(--dur-kinetic) var(--ease-kinetic),
			box-shadow var(--dur-kinetic) var(--ease-kinetic),
			transform var(--dur-kinetic) var(--ease-kinetic);

		&:hover {
			border-color: var(--accent);
			transform: translateY(-2px);
			box-shadow: var(--shadow-lift);
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

	/* The document identifies itself the way a drawing does: a title block. */
	.doc-header {
		margin-block-end: var(--space-8);
		padding: var(--space-6) var(--space-6) 0;
		overflow: hidden;

		& h1 {
			font-size: var(--text-xl);
			letter-spacing: -0.025em;
			margin-block: var(--space-1) var(--space-3);
			text-wrap: balance;
		}
	}

	.doc-summary {
		margin: 0 0 var(--space-6);
		max-inline-size: 68ch;
		color: var(--ink-mute);
		font-size: var(--text-md);
	}

	.title-block {
		display: grid;
		/* Four fields, four tracks. `auto-fit` stranded the last one on a row
		   of its own the moment the column narrowed. */
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0;
		margin: 0 calc(var(--space-6) * -1);
		border-block-start: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-inset) 55%, transparent);

		& > div {
			padding: var(--space-2) var(--space-4);
			border-inline-end: 1px solid var(--line);

			&:last-child {
				border-inline-end: none;
			}
		}

		& dd {
			margin: 0;
			font-size: var(--text-sm);
		}
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

	/* ----- right rail: the scope ----- */
	.doc-rail {
		border-inline-start: 1px solid var(--line);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent) 3.5%, transparent),
				transparent 200px
			),
			var(--bg-raised);
		position: sticky;
		inset-block-start: var(--header-h);
		block-size: calc(100vh - var(--header-h));
		overflow-y: auto;
		padding: 0 var(--space-4) var(--space-4);
	}

	/* Bezel: the rail states what it is showing and that the view is live. */
	.rail-head {
		position: sticky;
		inset-block-start: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-inline: calc(var(--space-4) * -1);
		padding: var(--space-3) var(--space-4);
		border-block-end: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
		backdrop-filter: blur(6px);
		margin-block-end: var(--space-4);

		& .rail-mode {
			margin-inline-start: auto;
			color: var(--ink-faint);
		}
	}

	.rail-lamp {
		inline-size: 6px;
		block-size: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
		animation: lamp 2.6s var(--ease-precise) infinite;
	}

	@keyframes lamp {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 1;
		}
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
			/* Vertical space the floating rail toggle occupies at the foot of the
			   viewport: its own height plus the offset above and below it. */
			--rail-toggle-clearance: calc(var(--space-4) * 2 + 2.75rem);
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
			position: static;
			margin-block: 0;
			padding-block: 0;
			background: none;
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
			/*
			 * The sheet shares the foot of the viewport with the floating toggle,
			 * which is fixed and therefore does not scroll with this content. Without
			 * clearance the rail's last control — "Open in playground" — comes to rest
			 * exactly underneath it once the rail is scrolled to the end, and at 390px
			 * the two occupied identical space. This reserves the toggle's footprint
			 * so anything at the end of the rail can always be scrolled clear.
			 */
			padding-block-end: var(--rail-toggle-clearance);

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

	@media (max-width: 620px) {
		.doc-article {
			padding: var(--space-5) var(--space-3) calc(var(--space-16) + 3rem);
			overflow: hidden;
		}

		/*
		 * `overflow: hidden` above makes the article the sticky containing
		 * block, which parked the progress bar 98px inside the column — a
		 * hairline struck through the title. On a phone the bar belongs to the
		 * viewport anyway, so pin it under the header instead of to a column.
		 */
		.read-progress {
			position: fixed;
			inset-inline: 0;
			inset-block-start: var(--header-h);
			margin-block-end: 0;
			z-index: 40;
		}

		.doc-header {
			padding: var(--space-5) var(--space-4) 0;
		}

		.doc-header h1 {
			font-size: clamp(1.55rem, 9vw, var(--text-xl));
		}

		.doc-summary {
			font-size: var(--text-base);
		}

		/* Four fields; two tracks keep the block a rectangle rather than
		   stranding one label on a row of its own. */
		.title-block {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			margin-inline: calc(var(--space-4) * -1);

			& > div:nth-child(2n) {
				border-inline-end: none;
			}

			& > div:nth-child(-n + 2) {
				border-block-end: 1px solid var(--line);
			}
		}

		.docs-shell,
		.docs-shell.nav-collapsed {
			/* The toggle spans the full width here and sits closer to the edge. */
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
