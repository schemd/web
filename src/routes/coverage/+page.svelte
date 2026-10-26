<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import BarSeries from '#lib/components/charts/BarSeries.svelte';

	let { data }: PageProps = $props();

	/** Anchor-safe id for a family label, so a bar can jump to its section. */
	function slug(label: string): string {
		return `family-${label.replace(/\s+/g, '-')}`;
	}

	/*
	 * Coverage answered "is every primitive exercised" and nothing else, so the
	 * one question the corpus can actually settle — where its examples are
	 * concentrated — had no surface. Sorting families by usage puts that first,
	 * and each bar is a link into the section it measures.
	 */
	const familyUsage = $derived(
		data.coverage.groups
			.map((group) => ({
				label: group.label,
				value: group.kinds.reduce((sum, kind) => sum + kind.count, 0),
				note: `${group.kinds.length} primitives`,
				href: `#${slug(group.label)}`
			}))
			.sort((left, right) => right.value - left.value)
	);

	const ratio = $derived(
		data.coverage.total === 0 ? 0 : data.coverage.covered / data.coverage.total
	);
	const percent = $derived(Math.round(ratio * 100));
</script>

<Seo
	title={t('Language coverage · schemd')}
	description={t(
		"Which @schemd/core primitives the documentation exercises, derived from the compiler's own exported vocabulary and every schemd fence in the docs corpus."
	)}
/>

<article class="coverage grid-backdrop">
	<SheetFrame label={t('Language coverage')}>
		<header class="coverage-head sheet-head">
			<p class="microlabel">{t('Compiler vocabulary, revision')} {t(data.latest)}</p>
			<h1>{t('Language coverage')}</h1>
			<p class="lede">
				{t("This page is generated from the compiler's own")} <code>COMPONENT_KINDS</code>
				{t(
					"registry. Every primitive carries a canonical, compiling example, so coverage is a genuine 100% — and the documentation's"
				)} <code>schemd</code>
				{t(
					'fences add real-world usages on top. Open any primitive to take it apart in the playground.'
				)}
			</p>
			<div class="summary plate">
				<div class="summary-figures">
					<span class="readout big">{t(data.coverage.covered)} / {t(data.coverage.total)}</span>
					<span class="microlabel"
						>{t('Primitives exercised across')} {t(data.coverage.examples)} {t('examples')}</span
					>
				</div>
				<div class="meter" role="img" aria-label={t('{0}% of primitives covered', [percent])}>
					<span class="meter-fill" style={`transform: scaleX(${ratio})`}></span>
				</div>
				<span class="meter-value readout">{t(percent)}%</span>
			</div>
		</header>
	</SheetFrame>

	<section class="usage plate" aria-label={t('Corpus usage by family')}>
		<p class="microlabel group-label">{t('Where the corpus spends its examples')}</p>
		<BarSeries
			items={familyUsage}
			summary={t(
				'Documented usages of each component family, across the docs corpus and the canonical catalog.'
			)}
			unit="usages"
		/>
	</section>

	<div class="groups">
		{#each data.coverage.groups as group (group.label)}
			<section class="group plate" id={slug(group.label)} aria-label={t(group.label)}>
				<p class="microlabel group-label">{t(group.label)}</p>
				<ul class="kinds">
					{#each group.kinds as entry (entry.kind)}
						<li>
							<a
								class="kind"
								class:covered={entry.count > 0}
								href={href(
									`/playground/${data.latest}?code=${entry.code}&w=${entry.width}&h=${entry.height}&t=${entry.kind}`
								)}
								title={t('Open the {0} primitive in the playground', [entry.kind])}
							>
								<code class="kind-name">{entry.kind}</code>
								<span class="kind-count microlabel">
									{entry.count > 0 ? t(`${entry.count}×`) : t('uncovered')}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<aside class="coverage-foot hairline-x">
		<span class="microlabel"
			>{t('Generated from the compiler; nothing here is listed by hand.')}</span
		>
		<a href={href('/playground/' + data.latest)}>{t('Try a part in the playground')}</a>
	</aside>
</article>

<style>
	.coverage {
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
		padding-block: var(--space-8) var(--space-16);
		display: grid;
		gap: var(--space-6);
	}

	.coverage-head h1 {
		font-size: var(--text-xl);
		margin-block: var(--space-2);
	}

	.lede {
		color: var(--ink-mute);
		max-inline-size: 74ch;
	}

	.summary {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4);
		margin-block-start: var(--space-4);
	}

	.summary-figures {
		display: grid;
		gap: 2px;

		& .big {
			font-size: var(--text-xl);
		}
	}

	.meter {
		block-size: 8px;
		background: var(--line);
		overflow: hidden;

		& .meter-fill {
			display: block;
			block-size: 100%;
			background: var(--ink);
			transform-origin: left;
			box-shadow: 0 0 8px var(--glow);
			transition: transform var(--dur-kinetic) var(--ease-kinetic);
		}
	}

	.meter-value {
		font-size: var(--text-lg);
	}

	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: var(--space-3);
	}

	.group {
		padding: var(--space-4);
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.group-label {
		color: var(--ink);
	}

	.kinds {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}

	.kinds > li {
		display: grid;
	}

	.kind {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--line);
		background: var(--bg-inset);
		opacity: 0.55;
		transition:
			border-color var(--dur-fast) var(--ease-precise),
			transform var(--dur-fast) var(--ease-precise);

		&:hover {
			text-decoration: none;
			transform: translateX(2px);
		}

		& .kind-name {
			font-family: var(--font-mono);
			font-size: var(--text-xs);
			color: var(--ink-mute);
		}

		& .kind-count {
			color: var(--ink-faint);
		}

		&.covered {
			opacity: 1;
			border-color: var(--line-strong);

			& .kind-name {
				color: var(--ink);
			}

			& .kind-count {
				color: var(--ink);
			}

			&:hover {
				border-color: var(--ink);
			}
		}
	}

	.coverage-foot {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding-block: var(--space-6);
	}

	@media (max-width: 620px) {
		.summary {
			grid-template-columns: 1fr;
		}
	}
</style>
