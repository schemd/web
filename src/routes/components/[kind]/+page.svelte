<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import { encodeWorkspaceState } from '#lib/state-uri.ts';

	let { data }: PageProps = $props();
	const sheet = $derived(data.sheet);

	const variantFigures = $derived(sheet.variants?.specimens ?? []);
	const hasPins = $derived(sheet.pins.length > 0);
	const hasOptions = $derived(sheet.options.length > 0);

	const playground = $derived(
		`/playground/${data.latest}?code=${encodeWorkspaceState(sheet.specimen.source)}`
	);
</script>

<Seo
	title={t('{0}: schemd component datasheet', [sheet.kind])}
	description={t(
		'The schemd {0} ({1}): {2} options with their ranges and defaults, {3} pins, and every variant drawn by the compiler.',
		[sheet.kind, t(sheet.familyLabel.toLowerCase()), sheet.options.length, sheet.pins.length]
	)}
	canonicalPath={`/components/${sheet.kind}`}
/>

<article class="page sheet">
	<header class="sheet-title">
		<p class="crumb">
			<a href={href('/components')}>{t('Components')}</a>, {t(sheet.familyLabel.toLowerCase())}
		</p>
		<h1><code>{sheet.kind}</code></h1>
		<p class="summary">
			{t('Every option, pin and variant of')} <code>{sheet.kind}</code>{t(', as release')}
			{t(data.latest)}
			{t('of the compiler states them.')}
		</p>
	</header>

	<section aria-labelledby="pins">
		<h2 id="pins">{t('Pins')}</h2>
		<div class="pins">
			<figure class="figure">
				<div class="figure-body specimen">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
					{@html sheet.specimen.svg}
				</div>
				<figcaption>
					<code>{sheet.kind}</code>
					{t('with its default options, pins named.')}
				</figcaption>
			</figure>
			<div>
				<p class="table-caption">{t('Pin functions')}</p>
				{#if hasPins}
					<table class="spec">
						<thead>
							<tr>
								<th scope="col">{t('Pin')}</th>
								<th scope="col">{t('Side')}</th>
							</tr>
						</thead>
						<tbody>
							{#each sheet.pins as pin (pin.name)}
								<tr>
									<td><code>{pin.name}</code></td>
									<td>{t(pin.side)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="note">
						{t('A wire names a pin as')} <code>ID.pin</code>{t(
							'. Rotating the part moves the pins with it; their names stay the same.'
						)}
					</p>
				{:else}
					<p class="note">{t('This kind has no pins; it is drawn but not wired.')}</p>
				{/if}
			</div>
		</div>
	</section>

	{#if hasOptions}
		<section aria-labelledby="options">
			<h2 id="options">{t('Options')}</h2>
			<p>
				{t('Options go in square brackets after the colour, as')} <code>name=value</code>{t(
					'. Any option not listed here is an error.'
				)}
			</p>
			<p class="table-caption">{t('Options')}</p>
			<table class="spec options">
				<thead>
					<tr>
						<th scope="col">{t('Option')}</th>
						<th scope="col">{t('Accepts')}</th>
						<th scope="col">{t('Default')}</th>
					</tr>
				</thead>
				<tbody>
					{#each sheet.options as option (option.name)}
						<tr>
							<td><code>{option.name}</code></td>
							<td>
								{t(option.accepts)}{#if option.values.length > 1}:{/if}
								{#if option.values.length > 0}
									<span class:values={option.values.length > 1}>
										{#each option.values as value, index (value)}<code>{value}</code>{index <
											option.values.length - 1
												? t(', ')
												: t('')}{/each}
									</span>
								{/if}
							</td>
							<td>
								{#if option.defaultValue !== undefined}<code>{option.defaultValue}</code>{:else}{t(
										'None'
									)}{/if}
								{#each option.defaultsByType as extra (extra)}
									<span class="extra">{t(extra)}</span>
								{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if sheet.requiresOneOf.length > 0}
				<p class="note">
					{t('At least one of')}
					{#each sheet.requiresOneOf as name, index (name)}<code>{name}</code>{index <
						sheet.requiresOneOf.length - 1
							? t(', ')
							: t('')}{/each}
					{t('must be written.')}
				</p>
			{/if}
			{#each sheet.conflicts as [first, second] (first + second)}
				<p class="note">
					<code>{first}</code>
					{t('and')} <code>{second}</code>
					{t('cannot be written together.')}
				</p>
			{/each}
		</section>
	{/if}

	{#if variantFigures.length > 0}
		<section aria-labelledby="variants">
			<h2 id="variants">{t('Variants')}</h2>
			<p>
				{t('Pin names depend on the selected variant. Each drawing labels its own pins.')}
			</p>
			<div class="variants">
				{#each variantFigures as variant (variant.value)}
					<figure class="figure">
						<div class="figure-body specimen">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
							{@html variant.svg}
						</div>
						<figcaption>
							<code>{sheet.variants?.option}={variant.value}</code>
							<p class="variant-pins">
								{#each variant.pins as pin, pinIndex (pin.name)}<code>{pin.name}</code> ({t(
										pin.side
									)}){pinIndex < variant.pins.length - 1 ? t(', ') : t('')}{/each}
							</p>
						</figcaption>
					</figure>
				{/each}
			</div>
		</section>
	{/if}

	<section aria-labelledby="writing">
		<h2 id="writing">{t('Writing one')}</h2>
		<pre class="codeblock"><code>{sheet.specimen.source}</code></pre>
		<div class="actions">
			<a class="btn btn-solid" href={href(playground)}>{t('Open in playground')}</a>
		</div>
	</section>

	<nav class="pager" aria-label={t('Adjacent components')}>
		{#if data.previous}
			<a href={href(`/components/${data.previous}`)}
				><span>{t('Previous')}</span> <code>{data.previous}</code></a
			>
		{:else}
			<span></span>
		{/if}
		{#if data.next}
			<a class="next" href={href(`/components/${data.next}`)}
				><span>{t('Next')}</span> <code>{data.next}</code></a
			>
		{/if}
	</nav>
</article>

<style>
	.sheet {
		padding-block: var(--space-8) var(--space-16);
	}

	.sheet-title {
		margin-block-end: var(--space-8);

		& h1 code {
			font-family: var(--font-sans);
			font-size: inherit;
		}
	}

	.crumb {
		margin: 0 0 var(--space-1);
		font-size: var(--text-sm);
		color: var(--ink-mute);
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
		margin-block-end: var(--space-3);
	}

	p {
		max-inline-size: var(--measure);
	}

	.pins {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: var(--space-8);
		align-items: start;

		& .table-caption {
			margin-block-start: var(--space-6);
		}
	}

	.specimen {
		display: grid;
		place-items: center;
		min-block-size: 160px;

		& :global(svg) {
			display: block;
			max-inline-size: 100%;
			block-size: auto;
		}

		& :global(figure) {
			margin: 0;
		}

		& :global(figure > figcaption) {
			display: none;
		}

		& :global(.pin-label) {
			fill: var(--ink);
			font-family: var(--font-mono);
			font-weight: 400;
		}
	}

	.options {
		max-inline-size: 960px;

		& td:first-child {
			inline-size: 9rem;
		}

		& td:last-child {
			inline-size: 11rem;
		}
	}

	.values {
		display: block;
	}

	.extra {
		display: block;
		color: var(--ink-mute);
	}

	.note {
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.variants {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-4) var(--space-6);

		& .figure {
			margin: 0;
		}
	}

	.actions {
		margin-block-start: var(--space-4);
	}

	.pager {
		display: flex;
		justify-content: space-between;
		gap: var(--space-6);
		margin-block-start: var(--space-12);
		padding-block-start: var(--space-4);
		border-block-start: 1px solid var(--line);

		& span {
			color: var(--ink-mute);
		}

		& a:hover {
			text-decoration: none;

			& code {
				text-decoration: underline;
			}
		}
	}

	@media (max-width: 760px) {
		.pins {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
