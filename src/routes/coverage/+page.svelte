<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ratio = $derived(data.coverage.total === 0 ? 0 : data.coverage.covered / data.coverage.total);
	const percent = $derived(Math.round(ratio * 100));
</script>

<svelte:head>
	<title>Language coverage · schemd</title>
	<meta
		name="description"
		content="Which @schemd/core primitives the documentation exercises — derived from the compiler's exported vocabulary and the schemd fences in the docs corpus."
	/>
</svelte:head>

<article class="coverage grid-backdrop">
	<header class="coverage-head">
		<p class="microlabel">compiler vocabulary · v{data.latest}</p>
		<h1>Language coverage</h1>
		<p class="lede">
			This page is generated from the compiler's own <code>COMPONENT_KINDS</code> registry and the
			<code>schemd</code> fences in the documentation. When a release adds a primitive it appears here
			automatically — uncovered until an example demonstrates it.
		</p>
		<div class="summary panel">
			<div class="summary-figures">
				<span class="readout big">{data.coverage.covered} / {data.coverage.total}</span>
				<span class="microlabel">primitives exercised across {data.coverage.examples} examples</span>
			</div>
			<div class="meter" role="img" aria-label={`${percent}% of primitives covered`}>
				<span class="meter-fill" style={`transform: scaleX(${ratio})`}></span>
			</div>
			<span class="meter-value readout">{percent}%</span>
		</div>
	</header>

	<div class="groups">
		{#each data.coverage.groups as group (group.label)}
			<section class="group panel" aria-label={group.label}>
				<p class="microlabel group-label">{group.label}</p>
				<ul class="kinds">
					{#each group.kinds as entry (entry.kind)}
						<li class="kind" class:covered={entry.count > 0}>
							<code class="kind-name">{entry.kind}</code>
							<span class="kind-count microlabel">
								{entry.count > 0 ? `${entry.count}×` : 'uncovered'}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<aside class="coverage-foot hairline-x">
		<span class="microlabel">generated · registry-synced · zero manual list</span>
		<a href="/playground/{data.latest}">Exercise a primitive in the playground →</a>
	</aside>
</article>

<style>
	.coverage {
		max-inline-size: 1000px;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 3rem);
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
			letter-spacing: -0.02em;
		}
	}

	.meter {
		block-size: 8px;
		background: var(--line);
		overflow: hidden;

		& .meter-fill {
			display: block;
			block-size: 100%;
			background: var(--accent);
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
		color: var(--accent);
	}

	.kinds {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
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
			border-color: color-mix(in srgb, var(--accent) 35%, var(--line));

			& .kind-name {
				color: var(--ink);
			}

			& .kind-count {
				color: var(--accent);
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
