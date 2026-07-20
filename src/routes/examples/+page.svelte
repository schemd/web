<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: 'schemd example gallery',
		description: 'Compiled schematic and UML examples, each openable in the playground.'
	});
	const jsonLdMarkup = `<script type="application/ld+json">${jsonLd}</${'script'}>`;
</script>

<svelte:head>
	<title>Example gallery · schemd</title>
	<meta
		name="description"
		content="Every schemd documentation example, compiled to accessible SVG and openable in the playground — circuits, logic, quantum, and UML."
	/>
	<meta property="og:title" content="schemd — example gallery" />
	<meta property="og:type" content="website" />
	{@html jsonLdMarkup}
</svelte:head>

<article class="gallery grid-backdrop">
	<header class="gallery-head">
		<p class="microlabel">compiled corpus · {data.items.length} examples · v{data.latest}</p>
		<h1>Example gallery</h1>
		<p class="lede">
			Every diagram below is real engine output, compiled server-side from the documentation's own
			<code>schemd</code> fences. Open any one in the playground to take it apart.
		</p>
	</header>

	<ul class="grid" aria-label="Example schematics">
		{#each data.items as item (item.id)}
			<li class="card panel">
				<div class="thumb schemd-frame" style={`aspect-ratio: ${item.width} / ${item.height}`}>
					{@html item.svg}
				</div>
				<div class="card-foot">
					<div class="card-titles">
						<span class="card-title">{item.title}</span>
						<span class="microlabel">{item.doc}</span>
					</div>
					<a class="open" href={`/playground/${data.latest}?code=${item.code}`}>open →</a>
				</div>
			</li>
		{/each}
	</ul>
</article>

<style>
	.gallery {
		max-inline-size: 1200px;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 3rem);
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
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--accent);

		&:hover {
			color: var(--ink);
		}
	}
</style>
