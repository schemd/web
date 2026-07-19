<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import Pronunciation from '$lib/components/Pronunciation.svelte';

	let { data }: PageProps = $props();
	function firstSection(): string {
		return data.page.sections[0]?.id ?? '';
	}

	let activeSection = $state(firstSection());
	let navigationOpen = $state(true);
	let mobileDialog: HTMLDialogElement;
	let navigationAdapted = false;

	const active = $derived(
		data.page.sections.find((section) => section.id === activeSection) ?? data.page.sections[0]
	);

	function scrollToSection(id: string): void {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		activeSection = id;
		mobileDialog?.close();
	}

	$effect(() => {
		if (navigationAdapted) return;
		navigationAdapted = true;
		if (window.matchMedia('(max-width: 900px)').matches) navigationOpen = false;
	});

	$effect(() => {
		const sections = [...document.querySelectorAll<HTMLElement>('[data-doc-section]')];
		let frame = 0;
		const update = (): void => {
			frame = 0;
			const focusLine = window.innerHeight * 0.28;
			const candidate = sections
				.map((section) => ({
					id: section.id,
					distance: Math.abs(section.getBoundingClientRect().top - focusLine)
				}))
				.sort((left, right) => left.distance - right.distance)[0];
			if (candidate?.id) activeSection = candidate.id;
		};
		const queue = (): void => {
			if (frame === 0) frame = requestAnimationFrame(update);
		};
		window.addEventListener('scroll', queue, { passive: true });
		window.addEventListener('resize', queue, { passive: true });
		update();
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', queue);
			window.removeEventListener('resize', queue);
		};
	});
</script>

<Seo
	title={`${data.page.title} — schemd ${data.version} documentation`}
	description={data.page.description}
	canonical={`https://schemd.johnowolabiidogun.dev/docs/${data.version}/${data.page.slug}`}
	type="article"
	structuredData={{
		'@context': 'https://schema.org',
		'@type': 'TechArticle',
		headline: data.page.title,
		description: data.page.description,
		version: data.version,
		isPartOf: {
			'@type': 'APIReference',
			name: '@schemd/core documentation'
		}
	}}
/>

<div class="docs-route-header">
	<p><span>REFERENCE</span> / @schemd/core / {data.version}</p>
	<button
		type="button"
		aria-expanded={navigationOpen}
		onclick={() => (navigationOpen = !navigationOpen)}
	>
		{navigationOpen ? 'Collapse index' : 'Open index'}
	</button>
</div>

<div class="docs-shell" class:navigation-collapsed={!navigationOpen}>
	<aside class="docs-navigation" aria-label="Documentation navigation">
		<header>
			<a href={`/docs/${data.version}/overview`}>schemd / reference</a>
			<Pronunciation compact />
		</header>
		<nav>
			{#each data.navigation as item, itemIndex}
				<a class:active={item.slug === data.page.slug} href={`/docs/${data.version}/${item.slug}`}>
					<span>{String(itemIndex + 1).padStart(2, '0')}</span>
					<div><small>{item.group}</small><strong>{item.label}</strong></div>
				</a>
			{/each}
		</nav>
	</aside>

	<article class="docs-article">
		<header class="docs-intro">
			<p class="eyebrow">{data.page.group} / {data.page.label}</p>
			<h1>{data.page.title}</h1>
			<p>{data.page.description}</p>
			{#if data.page.slug === 'overview'}
				<Pronunciation />
			{/if}
			<dl>
				<div>
					<dt>Version</dt>
					<dd>{data.version}</dd>
				</div>
				<div>
					<dt>Runtime</dt>
					<dd>Node ≥24</dd>
				</div>
				<div>
					<dt>Dependencies</dt>
					<dd>0</dd>
				</div>
			</dl>
		</header>

		{#each data.page.sections as section}
			<section
				id={section.id}
				class="docs-section"
				class:active={activeSection === section.id}
				data-doc-section
			>
				<p class="section-index">
					{String(data.page.sections.indexOf(section) + 1).padStart(2, '0')}
				</p>
				<div class="section-prose">
					<p class="eyebrow">{section.eyebrow}</p>
					<h2>{section.title}</h2>
					<div class="rendered-markdown">{@html section.html}</div>
				</div>
			</section>
		{/each}

		<nav class="docs-pagination" aria-label="Adjacent documentation">
			{#if data.previous}
				<a href={`/docs/${data.version}/${data.previous.slug}`}
					><small>Previous</small><strong>← {data.previous.label}</strong></a
				>
			{:else}<span></span>{/if}
			{#if data.next}
				<a href={`/docs/${data.version}/${data.next.slug}`}
					><small>Next</small><strong>{data.next.label} →</strong></a
				>
			{/if}
		</nav>
	</article>

	<aside class="docs-output" aria-label="Synchronized schematic example">
		{#if active}
			{#key active.id}
				<div class="output-panel">
					<header>
						<div><span>LIVE OUTPUT</span><small>{active.id}</small></div>
						<button type="button" onclick={() => scrollToSection(active.id)}>Align section</button>
					</header>
					{#if active.example}
						<div class="docs-example-vector">{@html active.example.svg}</div>
						<div class="docs-example-meta">
							<strong>{active.example.title}</strong>
							<span
								>{active.example.metrics.components} nodes · {active.example.metrics.svgBytes} bytes</span
							>
						</div>
						<pre><code>{active.example.source}</code></pre>
					{:else}
						<div class="output-placeholder">
							<span>NO VECTOR PAYLOAD</span>
							<p>This section defines a host-side contract and intentionally emits no diagram.</p>
						</div>
					{/if}
				</div>
			{/key}
		{/if}
	</aside>
</div>

<button class="mobile-output-trigger" type="button" onclick={() => mobileDialog.showModal()}>
	<span>LIVE</span> Inspect synchronized output
</button>
<dialog bind:this={mobileDialog} class="mobile-output-sheet" aria-label="Synchronized output">
	<header>
		<strong>{active?.title}</strong>
		<button type="button" onclick={() => mobileDialog.close()}>Close</button>
	</header>
	{#if active?.example}
		<div class="docs-example-vector">{@html active.example.svg}</div>
		<pre><code>{active.example.source}</code></pre>
	{:else}
		<p>This section has no vector payload.</p>
	{/if}
</dialog>
