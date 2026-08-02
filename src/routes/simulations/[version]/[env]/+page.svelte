<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import { setContext, type Component } from 'svelte';
	import SimulationPedagogy from '$lib/components/SimulationPedagogy.svelte';
	import SimulationTimeline from '$lib/components/sims/SimulationTimeline.svelte';
	import DeclarativeLab from '$lib/components/sims/DeclarativeLab.svelte';
	import { isDeclarativeLab, loadLabManifest } from '$lib/labs';
	import { provideSimulationTimelineModel } from '$lib/components/sims/simulation-timeline.svelte';
	import 'katex/dist/katex.min.css';
	import { SIMULATION_MATH_CONTEXT, type SimulationMathContext } from '$lib/simulation-math';

	let { data }: PageProps = $props();
	setContext<SimulationMathContext>(SIMULATION_MATH_CONTEXT, () => data.math);
	const timelineModel = provideSimulationTimelineModel();

	/**
	 * One route used to statically import every laboratory, forcing visitors to
	 * download thirteen numerical models to run one. Keep the registry explicit
	 * for exhaustiveness, but split every implementation into its own chunk.
	 *
	 * Laboratories that have been migrated to a manifest are deliberately absent:
	 * they are driven by `DeclarativeLab` from `LAB_MANIFESTS`, and leaving a
	 * dead loader entry here would keep emitting a chunk nothing loads.
	 */
	type SimulationComponent = Component<{ svg: string }>;
	type SimulationModule = { default: SimulationComponent };
	const COMPONENT_LOADERS: Readonly<Record<string, () => Promise<SimulationModule>>> = {
		rc: () => import('$lib/components/sims/RcSim.svelte'),
		timer: () => import('$lib/components/sims/TimerSim.svelte'),
		teleport: () => import('$lib/components/sims/TeleportSim.svelte'),
		buck: () => import('$lib/components/sims/BuckSim.svelte'),
		statechart: () => import('$lib/components/sims/StatechartSim.svelte'),
		qec: () => import('$lib/components/sims/QecSim.svelte'),
		wien: () => import('$lib/components/sims/WienSim.svelte'),
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
	/*
	 * A laboratory runs from its manifest once it has one, and from its bespoke
	 * component until then. Both paths render into the same host and share the
	 * same timeline, so migration is per-lab and reversible rather than a
	 * flag day across all thirteen.
	 */
	const declarative = $derived(isDeclarativeLab(sim.id));
	const timeline = $derived(data.timeline);
	let simulationHost = $state<HTMLElement | undefined>();
	let interactionHost = $state<HTMLElement | undefined>();

	/* Cyclic prev/next across the environment registry. */
	const here = $derived(data.environments.findIndex((environment) => environment.id === sim.id));
	const count = $derived(data.environments.length);
	const previous = $derived(data.environments[(here - 1 + count) % count]!);
	const next = $derived(data.environments[(here + 1) % count]!);
	const prerequisites = $derived(
		sim.curriculum.prerequisites.flatMap((id) => {
			const prerequisite = data.environments.find((environment) => environment.id === id);
			return prerequisite ? [{ id: prerequisite.id, title: prerequisite.title }] : [];
		})
	);
	const curriculumNext = $derived(
		data.environments.find(
			(environment) => environment.curriculum.order === sim.curriculum.order + 1
		)
	);

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

<Seo
	title={`${sim.title} · schemd simulation lab`}
	description={sim.summary}
	canonicalPath={`/simulations/${data.latest}/${sim.id}`}
	type="article"
	{jsonLd}
/>

<div class="lab-page grid-backdrop">
	<header class="lab-head plate">
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

		<SimulationPedagogy
			id={sim.id}
			title={sim.title}
			version={data.version}
			fault={sim.fault}
			pedagogy={sim.pedagogy}
			curriculum={sim.curriculum}
			{prerequisites}
			next={curriculumNext}
			host={interactionHost}
			total={count}
		/>

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
					<span class="microlabel">diagnosis challenge</span>
					<span class="fault-note"
						>Fault identity withheld: infer it from the changed outputs first.</span
					>
				</div>
			</div>
		</div>
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

	<div id="live-laboratory" class="laboratory-interaction" bind:this={interactionHost}>
		<SimulationTimeline
			simulationId={sim.id}
			stages={timeline}
			host={simulationHost}
			model={timelineModel}
		/>
		<div class="simulation-host" bind:this={simulationHost}>
			{#key sim.id}
				{#if declarative}
					<!-- Migrated: the drawing, the controls, and the wiring are data. -->
					{@const manifest = await loadLabManifest(sim.id)}
					<DeclarativeLab {manifest} svg={sim.svg} />
				{:else}
					{@const SimComponent = await loadComponent(sim.id)}
					<SimComponent svg={sim.svg} />
				{/if}
			{/key}
		</div>
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

	.laboratory-interaction {
		display: grid;
		gap: var(--space-5);
		min-inline-size: 0;
		scroll-margin-block-start: var(--space-6);
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
