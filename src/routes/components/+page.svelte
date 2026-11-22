<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';

	let { data }: PageProps = $props();

	let familyFilter = $state<string>('all');
	let query = $state('');
	let mode = $state<'atlas' | 'table'>('atlas');
	let selectedKind = $state<string | undefined>();
	let copied = $state(false);

	const visibleFamilies = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return data.families
			.filter((group) => familyFilter === 'all' || group.family === familyFilter)
			.map((group) => ({
				...group,
				kinds:
					needle === ''
						? group.kinds
						: group.kinds.filter(
								(entry) =>
									entry.kind.includes(needle) ||
									entry.pinNames.some((pin) => pin.toLowerCase().includes(needle))
							)
			}))
			.filter((group) => group.kinds.length > 0);
	});

	const selected = $derived(
		selectedKind === undefined
			? undefined
			: data.families.flatMap((group) => group.kinds).find((entry) => entry.kind === selectedKind)
	);

	async function copySnippet(snippet: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(snippet);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* Clipboard unavailable. */
		}
	}
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
		<div class="atlas-controls">
			<div class="family-tabs" role="tablist" aria-label={t('Component families')}>
				<button
					type="button"
					role="tab"
					aria-selected={familyFilter === 'all'}
					onclick={() => (familyFilter = 'all')}>{t('All')}</button
				>
				{#each data.families as group (group.family)}
					<button
						type="button"
						role="tab"
						aria-selected={familyFilter === group.family}
						onclick={() => (familyFilter = group.family)}>{t(group.label)}</button
					>
				{/each}
			</div>
			<div class="atlas-right">
				<input
					type="search"
					class="atlas-search"
					bind:value={query}
					placeholder={t('Filter kind or pin…')}
					aria-label={t('Filter component kinds')}
				/>
				<div class="mode-tabs" role="group" aria-label={t('Display mode')}>
					<button type="button" aria-pressed={mode === 'atlas'} onclick={() => (mode = 'atlas')}
						>{t('Atlas')}</button
					>
					<button type="button" aria-pressed={mode === 'table'} onclick={() => (mode = 'table')}
						>{t('Table')}</button
					>
				</div>
			</div>
		</div>
	</header>

	{#each visibleFamilies as group (group.family)}
		<section aria-labelledby={`family-${group.family}`}>
			<h2 id={`family-${group.family}`}>
				{t(group.label)}
			</h2>
			{#if mode === 'atlas'}
				<div class="stencil-grid">
					{#each group.kinds as entry (entry.kind)}
						<div class="stencil-cell" class:selected={selectedKind === entry.kind}>
							<button
								type="button"
								class="stencil-glyph"
								aria-pressed={selectedKind === entry.kind}
								aria-label={t('Preview {0}', [entry.kind])}
								onclick={() =>
									(selectedKind = selectedKind === entry.kind ? undefined : entry.kind)}
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
								{@html entry.svg}
							</button>
							<div class="stencil-foot">
								<a href={href(`/components/${entry.kind}`)}><code>{entry.kind}</code></a>
								<span class="stencil-meta tabular">
									{t(entry.pins)}
									{t('pins')}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="table-caption">{t(group.label)} {t('kinds')}</p>
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
			{/if}
		</section>
	{/each}

	{#if selected}
		<aside class="drawer" aria-label={t('Component preview')}>
			<div class="drawer-head">
				<h3><code>{selected.kind}</code></h3>
				<button type="button" class="drawer-close" onclick={() => (selectedKind = undefined)}
					>{t('Close')}</button
				>
			</div>
			<div class="drawer-glyph">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html selected.svg}
			</div>
			<div class="drawer-pins">
				{#each selected.pinNames as pin (pin)}
					<code>{pin}</code>
				{/each}
			</div>
			<div class="drawer-snippet">
				<code>{selected.snippet}</code>
				<button type="button" onclick={() => copySnippet(selected.snippet)}>
					{copied ? t('Copied') : t('Copy')}
				</button>
			</div>
			<a class="btn btn-solid" href={href(`/components/${selected.kind}`)}>{t('Open datasheet')}</a>
		</aside>
	{/if}
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

	.atlas-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-block-start: var(--space-6);
	}

	.family-tabs,
	.mode-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& button {
			padding: 0.3rem 0.7rem;
			border-radius: 6px;
			font-size: var(--text-sm);
			font-weight: 600;
			color: var(--ink-mute);

			&:hover {
				color: var(--ink);
				background: var(--wash);
			}

			&[aria-selected='true'],
			&[aria-pressed='true'] {
				color: var(--ink);
				background: var(--wash);
				box-shadow: inset 0 0 0 1px var(--line);
			}
		}
	}

	.atlas-right {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.atlas-search {
		min-inline-size: 200px;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--wash);
		color: var(--ink);
		font-size: var(--text-sm);
	}

	section + section {
		margin-block-start: var(--space-12);
	}

	h2 {
		font-size: var(--text-lg);
	}

	.stencil-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
		gap: var(--space-3);
		margin-block-start: var(--space-4);
	}

	.stencil-cell {
		display: grid;
		grid-template-rows: 108px auto;
		border: 1px solid var(--edge);
		border-radius: var(--radius-md);
		background: var(--wash);
		overflow: hidden;

		&.selected {
			border-color: var(--accent);
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--mark) 75%, transparent);
		}
	}

	.stencil-glyph {
		display: grid;
		place-items: center;
		padding: var(--space-2);
		background-image:
			linear-gradient(
				to right,
				color-mix(in srgb, var(--line) 28%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in srgb, var(--line) 28%, transparent) 1px,
				transparent 1px
			);
		background-size: 16px 16px;

		& :global(svg) {
			max-inline-size: 100%;
			max-block-size: 88px;
			block-size: auto;
			inline-size: auto;
		}
	}

	.stencil-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-top: 1px solid var(--edge);
		background: var(--bg);
		font-size: 0.8125rem;
	}

	.stencil-meta {
		color: var(--ink-mute);
		font-size: 0.75rem;
	}

	.drawer {
		position: fixed;
		inset-block-end: var(--space-4);
		inset-inline-end: var(--space-4);
		z-index: 30;
		inline-size: min(360px, calc(100vw - 2 * var(--space-4)));
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		background: color-mix(in srgb, var(--vellum) 96%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-overlay);
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;

		& h3 {
			margin: 0;
			font-size: var(--text-md);
		}
	}

	.drawer-close {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink-mute);
	}

	.drawer-glyph {
		display: grid;
		place-items: center;
		min-block-size: 120px;
		padding: var(--space-3);
		border: 1px solid var(--edge);
		border-radius: var(--radius-md);
		background: var(--wash);

		& :global(svg) {
			max-inline-size: 100%;
			max-block-size: 140px;
			block-size: auto;
		}
	}

	.drawer-pins {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& code {
			padding: 0.1rem 0.4rem;
			border-radius: 4px;
			background: var(--wash);
			border: 1px solid var(--edge);
			font-size: 0.75rem;
		}
	}

	.drawer-snippet {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--edge);
		border-radius: 8px;
		background: var(--wash);
		font-size: 0.8125rem;

		& code {
			overflow-wrap: anywhere;
		}

		& button {
			font-size: var(--text-sm);
			font-weight: 600;
			color: var(--accent);
		}
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
