<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';

	let { data }: PageProps = $props();

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: 'schemd example gallery',
		description: 'Compiled schematic and UML examples, each openable in the playground.'
	});
</script>

<Seo
	title={t('Example gallery · schemd')}
	description={t(
		'Every schemd documentation example compiled to accessible SVG and openable in the playground — circuits, logic, quantum, and UML.'
	)}
	{jsonLd}
/>

<article class="gallery grid-backdrop">
	<SheetFrame label={t('Example gallery')}>
		<header class="gallery-head sheet-head">
			<p class="microlabel">
				{t(data.items.length)}
				{t('examples, compiled by revision')}
				{t(data.latest)}
			</p>
			<h1>{t('Example gallery')}</h1>
			<p class="lede">
				{t(
					"Every diagram below is real engine output, compiled server-side from the documentation's own"
				)}
				<code>schemd</code>
				{t('fences. Open any one in the playground to take it apart.')}
			</p>
		</header>
	</SheetFrame>

	<ul class="grid" aria-label={t('Example schematics')}>
		{#each data.items as item (item.id)}
			<li class="card plate">
				<div class="thumb schemd-frame" style={`aspect-ratio: ${item.width} / ${item.height}`}>
					{@html item.svg}
				</div>
				<div class="card-foot">
					<div class="card-titles">
						<span class="card-title">{t(item.title)}</span>
						<span class="microlabel">{t(item.doc)}</span>
					</div>
					<a
						class="open"
						href={href(
							`/playground/${data.latest}?code=${item.code}&w=${item.width}&h=${item.height}&t=${encodeURIComponent(item.title)}`
						)}
					>
						{t('Open')}
					</a>
				</div>
			</li>
		{/each}
	</ul>
</article>

<style>
	.gallery {
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
		padding-block: var(--space-8) var(--space-16);
		display: grid;
		gap: var(--space-6);
	}

	.gallery-head h1 {
		font-size: var(--text-xl);
		margin-block: var(--space-2);
	}

	.lede {
		color: var(--ink-mute);
		max-inline-size: 70ch;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
		gap: var(--space-4);
	}

	.card {
		display: grid;
		grid-template-rows: 1fr auto;
		overflow: hidden;
		transition:
			border-color var(--dur-kinetic) var(--ease-kinetic),
			transform var(--dur-kinetic) var(--ease-kinetic);

		&:hover {
			border-color: var(--line-strong);
			transform: translateY(-3px);
		}
	}

	.thumb {
		border: none;
		border-block-end: 1px solid var(--line);
		padding: var(--space-3);
		display: grid;
		place-items: center;
		min-block-size: 0;
		overflow: hidden;
	}

	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3);
	}

	.card-titles {
		display: grid;
		gap: 2px;
		min-inline-size: 0;

		& .card-title {
			font-size: var(--text-sm);
			font-weight: 560;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.open {
		flex: none;
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-2xs);
		color: var(--ink);

		&:hover {
			color: var(--ink);
		}
	}
</style>
