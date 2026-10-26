<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';

	let { data }: PageProps = $props();
</script>

<Seo
	title={t('Components · schemd')}
	description={t(
		'Datasheets for all {0} schemd component kinds: their options, the values and ranges each accepts, their defaults and their pins, generated from the compiler.',
		[data.total]
	)}
	canonicalPath="/components"
/>

<article class="page index">
	<header>
		<h1>{t('Components')}</h1>
		<p class="summary">
			{t('schemd draws')}
			{t(data.total)}
			{t(
				'kinds of part. Each has a datasheet, printed from the compiler itself: the options it accepts, their ranges and defaults, and its pins.'
			)}
		</p>
	</header>

	{#each data.families as group, groupIndex (group.family)}
		<section aria-labelledby={`family-${group.family}`}>
			<h2 id={`family-${group.family}`}>
				<span class="num">{t(groupIndex + 1)}</span>
				{t(group.label)}
			</h2>
			<p class="table-caption">{t('Table')} {t(groupIndex + 1)}. {t(group.label)} {t('kinds')}</p>
			<table class="spec">
				<thead>
					<tr>
						<th scope="col">{t('Kind')}</th>
						<th scope="col" class="n">{t('Options')}</th>
						<th scope="col" class="n">{t('Variants')}</th>
						<th scope="col" class="n">{t('Pins')}</th>
					</tr>
				</thead>
				<tbody>
					{#each group.kinds as entry (entry.kind)}
						<tr>
							<td><a href={href(`/components/${entry.kind}`)}><code>{entry.kind}</code></a></td>
							<td class="n tabular">{t(entry.options)}</td>
							<td class="n tabular">{entry.variants === 0 ? t('') : t(entry.variants)}</td>
							<td class="n tabular">{t(entry.pins)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/each}
</article>

<style>
	.index {
		padding-block: var(--space-8) var(--space-16);
	}

	header {
		margin-block-end: var(--space-8);
	}

	.summary {
		max-inline-size: var(--measure);
		font-size: var(--text-md);
		line-height: 1.45;
		color: var(--ink-mute);
	}

	section + section {
		margin-block-start: var(--space-12);
	}

	h2 {
		font-size: var(--text-lg);
		padding-block-start: var(--space-2);
		border-block-start: 2px solid var(--ink);
	}

	.num {
		display: inline-block;
		min-inline-size: 2.2em;
	}

	table {
		max-inline-size: 640px;
	}

	.n {
		text-align: end;
		inline-size: 6rem;
	}

	td code {
		font-size: 0.95em;
		color: inherit;
	}
</style>
