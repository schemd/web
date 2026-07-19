<script lang="ts">
	import type { PageProps } from './$types';
	import Pronounce from '$lib/components/Pronounce.svelte';

	let { data }: PageProps = $props();

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: '@schemd/core',
		alternateName: 'schemd',
		description:
			'Zero-dependency text-to-SVG compiler for schematics and UML. Write declarations; get accessible, deterministic vectors.',
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Node.js 24+',
		softwareVersion: data.latest,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		author: { '@type': 'Person', name: 'John Owolabi Idogun', url: 'https://www.johnowolabiidogun.dev' }
	});

	const features = [
		{
			title: 'Two-line grammar',
			body: 'Components and connections. Everything else is bracketed options, validated by name against the kind you chose.'
		},
		{
			title: 'Zero dependencies',
			body: 'No DOM, no browser layout pass, no Markdown parser. The compiler runs on a server or during a build — this page compiled its own hero.'
		},
		{
			title: 'Deterministic output',
			body: 'Identical source yields byte-identical SVG. Diagnostics carry exact one-based line numbers, prefixed once, everywhere.'
		},
		{
			title: 'Obstacle-aware routing',
			body: 'Orthogonal traces route around component bodies with clearance, and crossings get draftsman bridge arcs — never false junctions.'
		},
		{
			title: 'Three output budgets',
			body: 'default stays compact and static; embedded-css adds theme-aware styles; full instruments every node, port, and wire for delegation.'
		},
		{
			title: 'Bounded by design',
			body: `Hard ceilings on everything: ${data.limits.components} components, ${data.limits.connections.toLocaleString('en-US')} connections, ${(data.limits.svgOutputBytes / 1024 / 1024).toFixed(0)} MiB of output. The writer refuses to exceed them.`
		}
	];
</script>

<svelte:head>
	<title>schemd — the vector schematic compiler</title>
	<meta
		name="description"
		content="schemd (pronounced “skemd”, /skɛmd/) compiles plain-text schematics and UML into accessible, deterministic SVG. Zero dependencies. Node 24+."
	/>
	<meta property="og:title" content="schemd — the vector schematic compiler" />
	<meta
		property="og:description"
		content="Write schematics and UML as text. Get accessible, deterministic SVG."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/brand/schemd-logo.svg" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<article class="landing grid-backdrop">
	<section class="hero">
		<div class="hero-copy">
			<p class="microlabel animate-in">@schemd/core · v{data.latest} · MIT</p>
			<h1 class="animate-in">
				Schematics are<br />source code.
			</h1>
			<p class="hero-pronounce animate-in">
				<span class="hero-brand">schemd</span>
				<Pronounce />
			</p>
			<p class="hero-lede animate-in">
				Write electrical, logic, quantum, and UML diagrams as text. The compiler parses,
				validates, routes, and emits deterministic, accessible SVG — on a server, with zero
				dependencies. No canvas. No dragging. No pixels.
			</p>
			<div class="hero-actions animate-in">
				<a class="btn btn-solid" href={`/playground/${data.latest}`}>Open the playground</a>
				<a class="btn" href={`/docs/${data.latest}/overview`}>Read the docs</a>
				<a class="btn" href={`/simulate/${data.latest}`}>Enter the lab</a>
			</div>
			<pre class="codeblock install animate-in"><code>npm i @schemd/core</code></pre>
		</div>

		<figure class="hero-stage panel">
			<figcaption class="stage-head">
				<span class="microlabel">live engine output · mode=full</span>
				<span class="readout">
					{data.hero.metrics['components']} nodes · {data.hero.metrics['connections']} wires ·
					{data.hero.metrics['svgBytes']?.toLocaleString('en-US')} B · {data.hero.ms} ms
				</span>
			</figcaption>
			<div class="schemd-frame stage-svg">
				{@html data.hero.svg}
			</div>
			<pre class="codeblock stage-src"><code>{@html data.hero.sourceHtml}</code></pre>
		</figure>
	</section>

	<section class="features" aria-label="Why schemd">
		{#each features as feature (feature.title)}
			<div class="feature panel">
				<h2>{feature.title}</h2>
				<p>{feature.body}</p>
			</div>
		{/each}
	</section>

	<aside class="landing-foot hairline-x" aria-label="Project links">
		<span class="microlabel">{data.releaseCount} releases tracked · registry-synced</span>
		<span>
			<a href="/changelog">Changelog</a> ·
			<a href="https://github.com/schemd/core" rel="noopener" target="_blank">GitHub</a> ·
			<a href="https://www.npmjs.com/package/@schemd/core" rel="noopener" target="_blank">npm</a>
		</span>
	</aside>
</article>

<style>
	.landing {
		padding: clamp(1rem, 4vw, 3rem);
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(320px, 5fr) minmax(360px, 6fr);
		gap: var(--space-8);
		align-items: start;
		padding-block: var(--space-8) var(--space-12);
	}

	.hero-copy h1 {
		font-size: var(--text-2xl);
		font-weight: 700;
		letter-spacing: -0.03em;
		margin-block: var(--space-3);
	}

	.hero-pronounce {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		margin-block: var(--space-4);

		& .hero-brand {
			font-family: var(--font-mono);
			font-size: var(--text-lg);
			font-weight: 700;
			color: var(--accent);
		}
	}

	.hero-lede {
		color: var(--ink-mute);
		font-size: var(--text-md);
		max-inline-size: 52ch;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-block: var(--space-6);
	}

	.install {
		inline-size: fit-content;
		color: var(--accent);
	}

	.hero-stage {
		display: grid;
	}

	.stage-head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		padding: var(--space-2) var(--space-3);
		border-block-end: 1px solid var(--line);
	}

	.stage-svg {
		border: none;
		padding: var(--space-3);
	}

	.stage-src {
		border: none;
		border-block-start: 1px solid var(--line);
		max-block-size: 240px;
		font-size: var(--text-xs);
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.feature {
		border: none;
		padding: var(--space-6);

		& h2 {
			font-size: var(--text-md);
			margin-block-end: var(--space-2);
		}

		& p {
			margin: 0;
			color: var(--ink-mute);
			font-size: var(--text-sm);
		}
	}

	.landing-foot {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding-block: var(--space-6);
		margin-block-start: var(--space-8);
	}

	@media (max-width: 900px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
</style>
