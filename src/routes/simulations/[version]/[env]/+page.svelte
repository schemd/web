<script lang="ts">
	import type { PageProps } from './$types';
	import type { Component } from 'svelte';
	import AdderSim from '$lib/components/sims/AdderSim.svelte';
	import RcSim from '$lib/components/sims/RcSim.svelte';
	import BellSim from '$lib/components/sims/BellSim.svelte';
	import TimerSim from '$lib/components/sims/TimerSim.svelte';
	import TeleportSim from '$lib/components/sims/TeleportSim.svelte';

	let { data }: PageProps = $props();

	/** id → sim component. One place; the route just resolves and mounts. */
	const COMPONENTS: Record<string, Component<{ svg: string }>> = {
		adder: AdderSim,
		rc: RcSim,
		bell: BellSim,
		timer: TimerSim,
		teleport: TeleportSim
	};

	const sim = $derived(data.simulation);
	const SimComponent = $derived(COMPONENTS[sim.id]);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: `${sim.title} — schemd simulation`,
			about: sim.domain,
			description: sim.summary
		})
	);
</script>

<svelte:head>
	<title>{sim.title} · schemd simulation v{data.version}</title>
	<meta name="description" content={sim.summary} />
	<meta property="og:title" content={`${sim.title} — schemd simulation`} />
	<meta property="og:description" content={sim.tagline} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/brand/schemd-logo.svg" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="lab-page grid-backdrop">
	<header class="lab-head">
		<div class="lab-crumbs">
			<a href={`/simulations/${data.version}`} class="back">← all environments</a>
			<span class="microlabel">{sim.index} · {sim.domain} · v{data.version}</span>
		</div>
		<h1>{sim.title}</h1>
		<p class="lab-formula readout">{sim.formula}</p>
		<p class="lab-summary">{sim.summary}</p>
		<p class="microlabel lab-metrics">
			{sim.components} components · {sim.connections} connections · full-mode compile
		</p>

		<nav class="env-tabs" aria-label="Simulation environments">
			{#each data.environments as environment (environment.id)}
				<a
					href={`/simulations/${data.version}/${environment.id}`}
					aria-current={environment.id === sim.id ? 'page' : undefined}
				>
					{environment.index} · {environment.title}
				</a>
			{/each}
		</nav>
	</header>

	{#key sim.id}
		<SimComponent svg={sim.svg} />
	{/key}
</div>

<style>
	.lab-page {
		padding: clamp(1rem, 3vw, 2.5rem);
		padding-block-end: 96px; /* clearance for the base HUD */
		display: grid;
		gap: var(--space-6);
	}

	.lab-head {
		display: grid;
		gap: var(--space-2);
	}

	.lab-crumbs {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		align-items: baseline;
	}

	.back {
		font-size: var(--text-sm);
		font-weight: 560;
	}

	.lab-head h1 {
		font-size: var(--text-xl);
		letter-spacing: -0.02em;
	}

	.lab-formula {
		margin: 0;
		font-size: var(--text-sm);
	}

	.lab-summary {
		margin: 0;
		max-inline-size: 78ch;
		color: var(--ink-mute);
	}

	.lab-metrics {
		margin: 0;
	}

	.env-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-block-start: var(--space-2);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);

		& a {
			padding: 0.3rem 0.7rem;
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: 0.04em;
			color: var(--ink-mute);
			border: 1px solid var(--line);
			background: var(--bg-raised);
			transition:
				border-color var(--dur-fast) var(--ease-precise),
				color var(--dur-fast) var(--ease-precise);

			&:hover {
				color: var(--ink);
				border-color: var(--line-strong);
				text-decoration: none;
			}

			&[aria-current='page'] {
				color: var(--accent-ink);
				background: var(--accent);
				border-color: var(--accent);
			}
		}
	}
</style>
