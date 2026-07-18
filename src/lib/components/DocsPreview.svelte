<script lang="ts">
	import type { DocumentationExample } from '$lib/server/docs-registry';
	import type { TocEntry } from '$lib/docs/parser';

	interface Props {
		readonly examples: readonly DocumentationExample[];
		readonly toc: readonly TocEntry[];
		readonly version: string;
	}

	let { examples, toc, version }: Props = $props();
	let activeId = $state('');
	let mobileDialog = $state<HTMLDialogElement>();
	let active = $derived(examples.find((example) => example.id === activeId) ?? examples[0]);

	function selectExample(id: string): void {
		activeId = id;
	}

	function openMobilePreview(): void {
		mobileDialog?.showModal();
	}

	$effect(() => {
		const sources = [...document.querySelectorAll<HTMLElement>('[data-doc-example]')];
		if (sources.length === 0) return;
		const ratios: Record<string, number> = {};
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = entry.target.getAttribute('data-doc-example');
					if (id) ratios[id] = entry.isIntersecting ? entry.intersectionRatio : 0;
				}
				let bestId = activeId;
				let bestRatio = -1;
				for (const source of sources) {
					const id = source.dataset.docExample;
					if (!id) continue;
					const ratio = ratios[id] ?? 0;
					if (ratio > bestRatio) {
						bestId = id;
						bestRatio = ratio;
					}
				}
				if (bestRatio > 0) activeId = bestId;
			},
			{ rootMargin: '-12% 0px -52% 0px', threshold: [0, 0.15, 0.35, 0.6, 1] }
		);
		for (const source of sources) observer.observe(source);
		return () => observer.disconnect();
	});
</script>

<aside class="docs-preview" aria-label="Synchronized example preview">
	<div class="preview-heading">
		<p>Live reference</p>
		<span>{version}</span>
	</div>
	{#if active}
		<div class="example-tabs" role="tablist" aria-label="Documentation examples">
			{#each examples as example (example.id)}
				<button
					type="button"
					role="tab"
					aria-selected={example.id === active.id}
					onclick={() => selectExample(example.id)}>{example.title}</button
				>
			{/each}
		</div>
		<div class="preview-vector" aria-live="polite">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Server-compiled SVG from trusted versioned documentation source. -->
			<div class="schematic-host">{@html active.svg}</div>
			<details>
				<summary>Source · {active.id}</summary>
				<textarea
					class="source-scroll"
					aria-label={`${active.title} source`}
					value={active.source}
					readonly
					spellcheck="false"></textarea>
			</details>
		</div>
	{:else}
		<p class="no-example">
			This article has no compiled diagram. Its section index remains available below.
		</p>
	{/if}
	<nav aria-label="On this page">
		<p>On this page</p>
		<ol>
			{#each toc as item (item.id)}<li class:toc-child={item.depth === 3}>
					<a href={`#${item.id}`}>{item.title}</a>
				</li>{/each}
		</ol>
	</nav>
</aside>

{#if active}
	<button class="mobile-preview-trigger" type="button" onclick={openMobilePreview}
		>Inspect active schematic <span aria-hidden="true">↑</span></button
	>
	<dialog bind:this={mobileDialog} class="mobile-preview" aria-labelledby="mobile-preview-title">
		<header>
			<div>
				<p class="eyebrow">Compiled reference</p>
				<h2 id="mobile-preview-title">{active.title}</h2>
			</div>
			<button
				type="button"
				onclick={() => mobileDialog?.close()}
				aria-label="Close schematic preview">Close</button
			>
		</header>
		<div class="mobile-preview__body">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Server-compiled SVG from trusted versioned documentation source. -->
			<div class="schematic-host">{@html active.svg}</div>
			<textarea
				class="source-scroll"
				aria-label={`${active.title} source`}
				value={active.source}
				readonly
				spellcheck="false"></textarea>
		</div>
	</dialog>
{/if}

<style>
	.docs-preview {
		position: sticky;
		inset-block-start: 1rem;
		overflow: auto;
		max-block-size: calc(100dvh - 2rem);
		border: 1px solid var(--line);
		background: var(--ink-1);
	}
	.preview-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-block-end: 1px solid var(--line);
		padding: 0.65rem 0.75rem;
	}
	.preview-heading p,
	.preview-heading span,
	nav > p {
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.preview-heading span {
		color: var(--signal);
	}
	.example-tabs {
		display: flex;
		overflow: auto;
		border-block-end: 1px solid var(--line);
		padding: 0.4rem;
	}
	.example-tabs button {
		min-block-size: 2.25rem;
		flex: none;
		border: 0;
		background: transparent;
		padding-inline: 0.6rem;
		color: var(--muted);
		font-size: 0.68rem;
	}
	.example-tabs button[aria-selected='true'] {
		background: var(--ink-3);
		color: var(--signal-bright);
	}
	.preview-vector .schematic-host {
		border: 0;
		padding: 0.65rem;
	}
	.preview-vector :global(svg) {
		min-inline-size: 0;
	}
	details {
		border-block: 1px solid var(--line);
	}
	details summary {
		min-block-size: 2.5rem;
		padding: 0.55rem 0.7rem;
		cursor: pointer;
		color: var(--paper-soft);
		font-size: 0.7rem;
	}
	.source-scroll {
		display: block;
		overflow: auto;
		inline-size: 100%;
		min-block-size: 11rem;
		max-block-size: 16rem;
		resize: vertical;
		border: 0;
		border-radius: 0;
		background: var(--ink-0);
		padding: 0.75rem;
		color: var(--paper-soft);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		line-height: 1.6;
	}
	.no-example {
		padding: 1rem;
		color: var(--muted);
		font-size: 0.75rem;
	}
	nav {
		padding: 1rem 0;
	}
	nav > p {
		padding-inline: 0.75rem;
	}
	nav ol {
		margin: 0.55rem 0 0;
		padding: 0;
		list-style: none;
	}
	nav a {
		display: block;
		border-inline-start: 1px solid var(--line);
		padding: 0.32rem 0.75rem;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.35;
		text-decoration: none;
	}
	nav .toc-child a {
		padding-inline-start: 1.35rem;
	}
	.mobile-preview-trigger,
	.mobile-preview {
		display: none;
	}
	@media (max-width: 76rem) {
		.docs-preview {
			display: none;
		}
		.mobile-preview-trigger {
			display: flex;
			position: sticky;
			z-index: 12;
			inset-block-end: 0.75rem;
			justify-content: space-between;
			inline-size: 100%;
			margin-block-start: 2rem;
			border-color: var(--signal);
			background: var(--ink-1);
			padding-inline: 1rem;
			color: var(--signal-bright);
		}
		.mobile-preview {
			inline-size: min(48rem, 100%);
			max-inline-size: none;
			max-block-size: 88dvh;
			margin: auto 0 0;
			border: 1px solid var(--line-strong);
			background: var(--ink-1);
			padding: 0;
			color: var(--paper);
		}
		.mobile-preview[open] {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
		}
		.mobile-preview::backdrop {
			background: rgb(2 5 4 / 0.76);
		}
		.mobile-preview header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			border-block-end: 1px solid var(--line);
			padding: 1rem;
		}
		.mobile-preview h2 {
			margin-block-start: 0.2rem;
			font-size: var(--step-1);
		}
		.mobile-preview header button {
			padding-inline: 0.8rem;
		}
		.mobile-preview__body {
			overflow: auto;
			padding: 0.75rem;
		}
		.mobile-preview__body .source-scroll {
			max-block-size: 20rem;
		}
	}
</style>
