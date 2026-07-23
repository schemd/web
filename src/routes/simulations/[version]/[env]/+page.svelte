<script lang="ts">
	import type { PageProps } from './$types';
	import { setContext, type Component } from 'svelte';
	import SimulationTimeline from '$lib/components/sims/SimulationTimeline.svelte';
	import 'katex/dist/katex.min.css';
	import { SIMULATION_MATH_CONTEXT, type SimulationMathContext } from '$lib/simulation-math';

	let { data }: PageProps = $props();
	setContext<SimulationMathContext>(SIMULATION_MATH_CONTEXT, () => data.math);

	/**
	 * One route used to statically import every laboratory, forcing visitors to
	 * download thirteen numerical models to run one. Keep the registry explicit
	 * for exhaustiveness, but split every implementation into its own chunk.
	 */
	type SimulationComponent = Component<{ svg: string }>;
	type SimulationModule = { default: SimulationComponent };
	const COMPONENT_LOADERS: Readonly<Record<string, () => Promise<SimulationModule>>> = {
		adder: () => import('$lib/components/sims/AdderSim.svelte'),
		rc: () => import('$lib/components/sims/RcSim.svelte'),
		bell: () => import('$lib/components/sims/BellSim.svelte'),
		timer: () => import('$lib/components/sims/TimerSim.svelte'),
		teleport: () => import('$lib/components/sims/TeleportSim.svelte'),
		buck: () => import('$lib/components/sims/BuckSim.svelte'),
		chua: () => import('$lib/components/sims/ChuaSim.svelte'),
		pll: () => import('$lib/components/sims/PllSim.svelte'),
		statechart: () => import('$lib/components/sims/StatechartSim.svelte'),
		qec: () => import('$lib/components/sims/QecSim.svelte'),
		wien: () => import('$lib/components/sims/WienSim.svelte'),
		lfsr: () => import('$lib/components/sims/LfsrSim.svelte'),
		grover: () => import('$lib/components/sims/GroverSim.svelte')
	};
	const loadedComponents = Object.create(null) as Record<
		string,
		Promise<SimulationComponent> | undefined
	>;

	function loadComponent(id: string): Promise<SimulationComponent> {
		const cached = loadedComponents[id];
		if (cached) return cached;
		const loader = COMPONENT_LOADERS[id];
		const pending = loader
			? loader().then((module) => module.default)
			: Promise.reject(new Error(`No simulation component registered for ${id}.`));
		loadedComponents[id] = pending;
		return pending;
	}

	const sim = $derived(data.simulation);
	const simComponent = $derived(loadComponent(sim.id));
	const timeline = $derived(data.timeline);
	let simulationHost = $state<HTMLElement | undefined>();

	/* Cyclic prev/next across the environment registry. */
	const here = $derived(data.environments.findIndex((environment) => environment.id === sim.id));
	const count = $derived(data.environments.length);
	const previous = $derived(data.environments[(here - 1 + count) % count]!);
	const next = $derived(data.environments[(here + 1) % count]!);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: `${sim.title} — schemd simulation`,
			about: sim.domain,
			description: sim.summary
		})
	);
	const jsonLdMarkup = $derived(`<script type="application/ld+json">${jsonLd}</${'script'}>`);
</script>

<svelte:head>
	<title>{sim.title} · schemd simulation v{data.version}</title>
	<meta name="description" content={sim.summary} />
	<meta property="og:title" content={`${sim.title} — schemd simulation`} />
	<meta property="og:description" content={sim.tagline} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/brand/schemd-logo.svg" />
	{@html jsonLdMarkup}
</svelte:head>

<div class="lab-page grid-backdrop">
	<header class="lab-head panel">
		<div class="lab-crumbs">
			<a href={`/simulations/${data.version}`} class="back">← all environments</a>
			<span class="microlabel">{sim.index} · {sim.tier} · {sim.domain} · v{data.version}</span>
		</div>

		<div class="lab-identity">
			<div class="lab-title-row">
				<h1>{sim.title}</h1>
				<span class="domain-badge">{sim.domain}</span>
			</div>
			<p class="lab-summary">{@html sim.summaryHtml}</p>
			<p class="microlabel lab-metrics">
				{sim.components} components · {sim.connections} connections · {@html sim.modelHtml}
			</p>
		</div>

		<!-- The aha: the one realization this lab is built to deliver. -->
		<blockquote class="aha">
			<span class="aha-mark microlabel">the aha</span>
			<p>{@html sim.pedagogy.ahaHtml}</p>
		</blockquote>

		<div class="lab-grid">
			<div class="principle">
				<span class="microlabel">why it works</span>
				<div class="prose">{@html sim.pedagogy.principleHtml}</div>
			</div>

			<div class="lab-model">
				<div class="model-card">
					<span class="microlabel">governing model</span>
					<!-- Keyboard focus exposes horizontally overflowing equations to Safari users. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div class="lab-formula" role="region" aria-label="Governing model" tabindex="0">
						{@html sim.formulaHtml}
					</div>
				</div>
				<div class="lab-spec">
					<div class="spec-group">
						<span class="microlabel">structural inventory</span>
						<ul class="chips">
							{#each sim.inventoryHtml as item, index (sim.inventory[index])}
								<li>{@html item}</li>
							{/each}
						</ul>
					</div>
					<div class="spec-group">
						<span class="microlabel">boundaries</span>
						<ul class="bounds">
							{#each sim.boundariesHtml as bound, index (sim.boundaries[index])}
								<li>{@html bound}</li>
							{/each}
						</ul>
					</div>
					<div class="spec-group">
						<span class="microlabel">fault relay</span>
						<span class="fault-note">{@html sim.faultHtml}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Guided walk-through: earn the aha through direct interaction. -->
		<ol class="guided" aria-label="Guided walk-through">
			{#each sim.pedagogy.steps as step, index (step.label)}
				<li class="guided-step">
					<span class="step-index" aria-hidden="true">{index + 1}</span>
					<div class="step-body">
						<p class="step-label">{@html step.labelHtml}</p>
						<div class="prose step-detail">{@html step.detailHtml}</div>
					</div>
				</li>
			{/each}
		</ol>
	</header>

	<nav class="env-nav" aria-label="Simulation environments">
		<a class="env-step prev" href={`/simulations/${data.version}/${previous.id}`}>
			<span class="microlabel">← {previous.index}</span>
			<span class="env-step-title">{previous.title}</span>
		</a>
		<div class="env-tabs">
			{#each data.environments as environment (environment.id)}
				<a
					href={`/simulations/${data.version}/${environment.id}`}
					aria-current={environment.id === sim.id ? 'page' : undefined}
					title={environment.title}
				>
					{environment.index}
				</a>
			{/each}
		</div>
		<a class="env-step next" href={`/simulations/${data.version}/${next.id}`}>
			<span class="microlabel">{next.index} →</span>
			<span class="env-step-title">{next.title}</span>
		</a>
	</nav>

	<SimulationTimeline simulationId={sim.id} stages={timeline} host={simulationHost} />
	<div class="simulation-host" bind:this={simulationHost}>
		{#key sim.id}
			{#await simComponent}
				<div class="simulation-loading panel" role="status">
					<span class="loading-pulse" aria-hidden="true"></span>
					<span>Loading {sim.title} model…</span>
				</div>
			{:then SimComponent}
				<SimComponent svg={sim.svg} />
			{:catch}
				<div class="simulation-loading simulation-error panel" role="alert">
					The interactive model could not load. Reload this laboratory to retry.
				</div>
			{/await}
		{/key}
	</div>
</div>

<style>
	.lab-page {
		padding: clamp(1rem, 3vw, 2.5rem);
		padding-block-end: 96px; /* clearance for the base HUD */
		display: grid;
		gap: var(--space-5);
	}

	.simulation-host {
		min-inline-size: 0;
	}

	.simulation-loading {
		min-block-size: min(62vh, 680px);
		display: grid;
		place-content: center;
		grid-auto-flow: column;
		align-items: center;
		gap: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.loading-pulse {
		inline-size: 0.7rem;
		block-size: 0.7rem;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--glow);
		animation: loading-pulse 900ms ease-in-out infinite alternate;
	}

	.simulation-error {
		color: var(--danger);
	}

	@keyframes loading-pulse {
		to {
			opacity: 0.35;
			transform: scale(0.7);
		}
	}

	.lab-head {
		display: grid;
		gap: var(--space-3);
		padding: clamp(var(--space-4), 3vw, var(--space-6));
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

	.lab-title-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;

		& h1 {
			font-size: var(--text-xl);
			letter-spacing: -0.02em;
		}
	}

	.domain-badge {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--accent);
		border: 1px solid var(--line-strong);
		padding: 0.15em 0.6em;
		border-radius: 999px;
	}

	/* ---------- The aha callout ---------- */
	.aha {
		position: relative;
		margin: 0;
		padding: var(--space-4) var(--space-5);
		background: color-mix(in srgb, var(--accent) 8%, var(--bg-inset));
		border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line));
		border-inline-start: 3px solid var(--accent);
		display: grid;
		gap: var(--space-2);
	}

	.aha-mark {
		color: var(--accent);
	}

	.aha p {
		margin: 0;
		font-size: var(--text-lg);
		line-height: 1.4;
		letter-spacing: -0.01em;
		color: var(--ink);
		text-wrap: balance;
	}

	/* KaTeX governing model card. */
	.model-card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--bg-inset);
		border: 1px solid var(--line);
	}

	.lab-formula {
		overflow-x: auto;
		font-size: var(--text-md);
		color: var(--ink);
	}

	/* Rendered author prose with typeset math. */
	.prose {
		color: var(--ink-mute);
		line-height: 1.7;
		font-size: var(--text-sm);

		& :global(strong) {
			color: var(--ink);
			font-weight: 600;
		}

		& :global(code) {
			font-family: var(--font-mono);
			font-size: 0.9em;
			padding: 0.05em 0.35em;
			background: var(--bg-inset);
			border: 1px solid var(--line);
			border-radius: 4px;
		}

		& :global(.katex-display) {
			margin: var(--space-3) 0;
			overflow-x: auto;
			overflow-y: hidden;
		}
	}

	.principle {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	/* Two-column body: principle prose left, model + specs right. */
	.lab-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: clamp(var(--space-4), 3vw, var(--space-8));
		align-items: start;
	}

	.lab-identity {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.lab-model {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	/* ---------- Guided walk-through ---------- */
	.guided {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.guided-step {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--bg-panel);
		transition: background-color var(--dur-fast) var(--ease-precise);

		&:hover {
			background: var(--bg-raised);
		}
	}

	.step-index {
		display: grid;
		place-items: center;
		inline-size: 1.6rem;
		block-size: 1.6rem;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent-ink);
		background: var(--accent);
		border-radius: 999px;
	}

	.step-body {
		display: grid;
		gap: 2px;
		min-inline-size: 0;
	}

	.step-label {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink);
	}

	.step-detail {
		font-size: var(--text-xs);
	}

	.lab-summary {
		margin: 0;
		color: var(--ink-mute);
	}

	.lab-metrics {
		margin: 0;
	}

	.lab-spec {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--line);
	}

	.lab-spec .spec-group:last-child {
		grid-column: 1 / -1;
	}

	@media (max-width: 860px) {
		.lab-grid {
			grid-template-columns: 1fr;
		}
	}

	.spec-group {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& li {
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			padding: 0.1em 0.5em;
			border: 1px solid var(--line);
			background: var(--bg-inset);
			color: var(--ink-mute);
		}
	}

	.bounds {
		margin: 0;
		padding-inline-start: 1.1em;
		font-size: var(--text-xs);
		color: var(--ink-mute);

		& li {
			margin-block: 1px;
		}
	}

	.fault-note {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--danger);
	}

	/* ---------- Prev / next environment navigation ---------- */
	.env-nav {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: var(--space-3);
		align-items: center;
	}

	.env-step {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-panel);
		color: var(--ink-mute);
		transition:
			border-color var(--dur-kinetic) var(--ease-kinetic),
			transform var(--dur-kinetic) var(--ease-kinetic);

		&:hover {
			border-color: var(--accent);
			color: var(--ink);
			text-decoration: none;
			transform: translateY(-2px);
		}

		&.next {
			text-align: end;
		}

		& .env-step-title {
			font-size: var(--text-sm);
			font-weight: 560;
			color: var(--ink);
		}
	}

	.env-tabs {
		display: flex;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);

		& a {
			padding: 0.4rem 0.7rem;
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			color: var(--ink-mute);
			background: var(--bg-raised);
			transition:
				color var(--dur-fast) var(--ease-precise),
				background-color var(--dur-fast) var(--ease-precise);

			&:hover {
				color: var(--ink);
				text-decoration: none;
			}

			&[aria-current='page'] {
				color: var(--accent-ink);
				background: var(--accent);
			}
		}
	}

	@media (max-width: 720px) {
		.lab-page {
			padding: var(--space-3);
			padding-block-end: 90px;
			gap: var(--space-3);
		}

		.lab-head {
			padding: var(--space-3);
		}

		.lab-title-row h1 {
			font-size: clamp(1.5rem, 8.5vw, var(--text-xl));
		}

		.aha {
			padding: var(--space-3);
		}

		.aha p {
			font-size: var(--text-md);
		}

		.lab-spec {
			grid-template-columns: 1fr;
		}

		.lab-spec .spec-group:last-child {
			grid-column: auto;
		}

		.env-nav {
			grid-template-columns: 1fr;
			min-inline-size: 0;
		}

		.env-tabs {
			order: -1;
			justify-content: flex-start;
			overflow-x: auto;
			max-inline-size: 100%;
		}

		.env-step.next {
			text-align: start;
		}
	}
</style>
