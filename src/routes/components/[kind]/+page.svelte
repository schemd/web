<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import { encodeWorkspaceState } from '#lib/state-uri.ts';

	let { data }: PageProps = $props();
	const sheet = $derived(data.sheet);

	/* Figures and tables are numbered in page order. */
	const variantFigures = $derived(sheet.variants?.specimens ?? []);
	const hasPins = $derived(sheet.pins.length > 0);
	const hasOptions = $derived(sheet.options.length > 0);

	const sections = $derived(
		[
			{ id: 'pins', title: 'Pins', show: true },
			{ id: 'options', title: 'Options', show: hasOptions },
			{ id: 'variants', title: 'Variants', show: variantFigures.length > 0 },
			{ id: 'writing', title: 'Writing one', show: true }
		].filter((section) => section.show)
	);
	const number = (id: string): number => sections.findIndex((section) => section.id === id) + 1;

	const playground = $derived(
		`/playground/${data.latest}?code=${encodeWorkspaceState(sheet.specimen.source)}`
	);
</script>

<Seo
	title={`${sheet.kind}: schemd component datasheet`}
	description={`The schemd ${sheet.kind} (${sheet.familyLabel.toLowerCase()}): ${sheet.options.length} options with their ranges and defaults, ${sheet.pins.length} pins, and every variant drawn by the compiler.`}
	canonicalPath={`/components/${sheet.kind}`}
/>

<article class="page sheet">
	<header class="sheet-title">
		<p class="crumb"><a href="/components">Components</a>, {sheet.familyLabel.toLowerCase()}</p>
		<h1><code>{sheet.kind}</code></h1>
		<p class="summary">
			Every option, pin and variant of <code>{sheet.kind}</code>, as release {data.latest} of the compiler
			states them.
		</p>
	</header>

	<section aria-labelledby="pins">
		<h2 id="pins"><span class="num">{number('pins')}</span> Pins</h2>
		<div class="pins">
			<figure class="figure">
				<div class="figure-body specimen">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
					{@html sheet.specimen.svg}
				</div>
				<figcaption>
					<b>Figure 1.</b> <code>{sheet.kind}</code> with its default options, pins named.
				</figcaption>
			</figure>
			<div>
				<p class="table-caption">Table 1. Pin functions</p>
				{#if hasPins}
					<table class="spec">
						<thead>
							<tr>
								<th scope="col">Pin</th>
								<th scope="col">Side</th>
							</tr>
						</thead>
						<tbody>
							{#each sheet.pins as pin (pin.name)}
								<tr>
									<td><code>{pin.name}</code></td>
									<td>{pin.side}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="note">
						A wire names a pin as <code>ID.pin</code>. Rotating the part moves the pins with it;
						their names stay the same.
					</p>
				{:else}
					<p class="note">This kind has no pins; it is drawn but not wired.</p>
				{/if}
			</div>
		</div>
	</section>

	{#if hasOptions}
		<section aria-labelledby="options">
			<h2 id="options"><span class="num">{number('options')}</span> Options</h2>
			<p>
				Options go in square brackets after the colour, as <code>name=value</code>. Any option not
				listed here is an error.
			</p>
			<p class="table-caption">Table 2. Options</p>
			<table class="spec options">
				<thead>
					<tr>
						<th scope="col">Option</th>
						<th scope="col">Accepts</th>
						<th scope="col">Default</th>
					</tr>
				</thead>
				<tbody>
					{#each sheet.options as option (option.name)}
						<tr>
							<td><code>{option.name}</code></td>
							<td>
								{option.accepts}{#if option.values.length > 1}:{/if}
								{#if option.values.length > 0}
									<span class:values={option.values.length > 1}>
										{#each option.values as value, index (value)}<code>{value}</code>{index <
											option.values.length - 1
												? ', '
												: ''}{/each}
									</span>
								{/if}
							</td>
							<td>
								{#if option.defaultValue !== undefined}<code>{option.defaultValue}</code
									>{:else}None{/if}
								{#each option.defaultsByType as extra (extra)}
									<span class="extra">{extra}</span>
								{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if sheet.requiresOneOf.length > 0}
				<p class="note">
					At least one of
					{#each sheet.requiresOneOf as name, index (name)}<code>{name}</code>{index <
						sheet.requiresOneOf.length - 1
							? ', '
							: ''}{/each} must be written.
				</p>
			{/if}
			{#each sheet.conflicts as [first, second] (first + second)}
				<p class="note">
					<code>{first}</code> and <code>{second}</code> cannot be written together.
				</p>
			{/each}
		</section>
	{/if}

	{#if variantFigures.length > 0}
		<section aria-labelledby="variants">
			<h2 id="variants"><span class="num">{number('variants')}</span> Variants</h2>
			<p>
				<code>{sheet.variants?.option}</code> changes the symbol and keeps the pins. Each value is drawn
				below.
			</p>
			<div class="variants">
				{#each variantFigures as variant, index (variant.value)}
					<figure class="figure">
						<div class="figure-body specimen">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
							{@html variant.svg}
						</div>
						<figcaption>
							<b>Figure {index + 2}.</b>
							<code>{sheet.variants?.option}={variant.value}</code>
						</figcaption>
					</figure>
				{/each}
			</div>
		</section>
	{/if}

	<section aria-labelledby="writing">
		<h2 id="writing"><span class="num">{number('writing')}</span> Writing one</h2>
		<pre class="codeblock"><code>{sheet.specimen.source}</code></pre>
		<div class="actions">
			<a class="btn btn-solid" href={playground}>Open in playground</a>
		</div>
	</section>

	<nav class="pager" aria-label="Adjacent components">
		{#if data.previous}
			<a href={`/components/${data.previous}`}><span>Previous</span> <code>{data.previous}</code></a
			>
		{:else}
			<span></span>
		{/if}
		{#if data.next}
			<a class="next" href={`/components/${data.next}`}
				><span>Next</span> <code>{data.next}</code></a
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
		font-stretch: var(--width-table);
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
		padding-block-start: var(--space-2);
		border-block-start: 2px solid var(--ink);
		margin-block-end: var(--space-3);
	}

	.num {
		display: inline-block;
		min-inline-size: 2.2em;
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
		border-block-start: 2px solid var(--ink);
		font-stretch: var(--width-table);

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
