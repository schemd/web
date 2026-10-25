<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import { setContext, type Component } from 'svelte';
	import SimulationPedagogy from '#lib/components/SimulationPedagogy.svelte';
	import SimulationTimeline from '#lib/components/sims/SimulationTimeline.svelte';
	import DeclarativeLab from '#lib/components/sims/DeclarativeLab.svelte';
	import { isDeclarativeLab, loadLabManifest } from '#lib/labs/index.ts';
	import { provideSimulationTimelineModel } from '#lib/components/sims/simulation-timeline.svelte.ts';
	import 'katex/dist/katex.min.css';
	import { SIMULATION_MATH_CONTEXT, type SimulationMathContext } from '#lib/simulation-math.ts';

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
		adder: () => import('#lib/components/sims/AdderSim.svelte'),
		rc: () => import('#lib/components/sims/RcSim.svelte'),
		bell: () => import('#lib/components/sims/BellSim.svelte'),
		timer: () => import('#lib/components/sims/TimerSim.svelte'),
		teleport: () => import('#lib/components/sims/TeleportSim.svelte'),
		buck: () => import('#lib/components/sims/BuckSim.svelte'),
		statechart: () => import('#lib/components/sims/StatechartSim.svelte'),
		qec: () => import('#lib/components/sims/QecSim.svelte'),
		wien: () => import('#lib/components/sims/WienSim.svelte'),
		grover: () => import('#lib/components/sims/GroverSim.svelte'),
		tdr: () => import('#lib/components/sims/TdrSim.svelte'),
		pll: () => import('#lib/components/sims/PllSim.svelte'),
		classd: () => import('#lib/components/sims/ClassDSim.svelte'),
		pid: () => import('#lib/components/sims/PidSim.svelte'),
		sigmadelta: () => import('#lib/components/sims/SigmaDeltaSim.svelte'),
		uart: () => import('#lib/components/sims/UartSim.svelte'),
		kickback: () => import('#lib/components/sims/KickbackSim.svelte')
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
	const bespokeFeaturedLabs = new Set(['adder', 'bell']);
	const declarative = $derived(isDeclarativeLab(sim.id) && !bespokeFeaturedLabs.has(sim.id));
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

<div class="lab-page">
	<!-- The circuit comes first. A slim bar names the lab; everything a reader
	     studies about it sits in the notebook under the bench. -->
	<header class="lab-bar">
		<div class="lab-name">
			<a href={`/simulations/${data.version}`} class="back">All labs</a>
			<span class="zone is-current">{sim.index}</span>
			<h1>{sim.title}</h1>
			<span class="domain-badge">{sim.domain}</span>
		</div>
		<nav class="lab-steps" aria-label="Neighbouring labs">
			<a href={`/simulations/${data.version}/${previous.id}`} title={previous.title}
				><span class="visually-hidden">Previous lab: </span><span aria-hidden="true">Previous</span>
				{previous.index}</a
			>
			<a href="#notebook" class="notebook-link">Notebook</a>
			<a href={`/simulations/${data.version}/${next.id}`} title={next.title}
				><span class="visually-hidden">Next lab: </span><span aria-hidden="true">Next</span>
				{next.index}</a
			>
		</nav>
		<p class="lab-summary">{@html sim.summaryHtml}</p>
	</header>

	<div id="live-laboratory" class="laboratory-interaction" bind:this={interactionHost}>
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
		<SimulationTimeline
			simulationId={sim.id}
			stages={timeline}
			host={simulationHost}
			model={timelineModel}
		/>
	</div>

	<section class="notebook" id="notebook" aria-labelledby="notebook-title">
		<h2 class="microlabel" id="notebook-title">
			Notebook: {sim.components} parts and {sim.connections} wires, modelled as {@html sim.modelHtml}
		</h2>
		<div class="notebook-grid">
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
					<span class="microlabel">Governing model</span>
					<!-- Keyboard focus exposes horizontally overflowing equations to Safari users. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div class="lab-formula" role="region" aria-label="Governing model" tabindex="0">
						{@html sim.formulaHtml}
					</div>
				</div>
				<div class="spec-group">
					<span class="microlabel">Parts</span>
					<ul class="chips">
						{#each sim.inventoryHtml as item, index (sim.inventory[index])}
							<li>{@html item}</li>
						{/each}
					</ul>
				</div>
				<div class="spec-group">
					<span class="microlabel">Limits of the model</span>
					<ul class="bounds">
						{#each sim.boundariesHtml as bound, index (sim.boundaries[index])}
							<li>{@html bound}</li>
						{/each}
					</ul>
				</div>
				<div class="spec-group">
					<span class="microlabel">Diagnosis challenge</span>
					<span class="fault-note"
						>The fault is hidden. Work it out from the changed outputs first.</span
					>
				</div>
			</div>
		</div>
	</section>

	<nav class="env-nav" aria-label="Simulation environments">
		<a class="env-step prev" href={`/simulations/${data.version}/${previous.id}`}>
			<span class="microlabel">Previous, {previous.index}</span>
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
			<span class="microlabel">Next, {next.index}</span>
			<span class="env-step-title">{next.title}</span>
		</a>
	</nav>
</div>

<style>
	.lab-page {
		padding: clamp(1rem, 2.4vw, 2rem);
		padding-block-end: 96px; /* clearance for the base HUD */
		display: grid;
		gap: var(--space-5);
	}

	.lab-bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2) var(--space-5);
	}

	.lab-name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-inline-size: 0;

		& h1 {
			margin: 0;
			font-size: clamp(1.35rem, 2.6vw, 1.9rem);
			line-height: 1.15;
			text-wrap: balance;
		}
	}

	.back {
		font: var(--text-sm) / 1.3 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		color: var(--ink-mute);
		text-decoration: none;

		&:hover {
			color: var(--accent);
		}
	}

	.domain-badge {
		padding: 2px 8px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		font: var(--text-xs) / 1.4 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		color: var(--ink-mute);
	}

	.lab-steps {
		display: flex;
		align-items: center;
		gap: var(--space-2);

		& a {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			min-block-size: 32px;
			padding: 4px 10px;
			border: 1px solid var(--line-strong);
			border-radius: var(--radius-sm);
			font: var(--text-sm) / 1.3 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--ink);
			text-decoration: none;

			&:hover {
				border-color: var(--accent);
				color: var(--accent);
			}
		}
	}

	.lab-summary {
		grid-column: 1 / -1;
		margin: 0;
		max-inline-size: 90ch;
		color: var(--ink-mute);
	}

	.simulation-host {
		min-inline-size: 0;
	}

	.laboratory-interaction {
		display: grid;
		gap: var(--space-4);
		min-inline-size: 0;
		scroll-margin-block-start: var(--space-6);
	}

	.notebook {
		display: grid;
		gap: var(--space-4);
		padding-block-start: var(--space-5);
		border-block-start: 1px solid var(--line-strong);
		scroll-margin-block-start: var(--space-6);

		& > h2 {
			margin: 0;
		}
	}

	.notebook-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-6);
	}

	@media (min-width: 1100px) {
		.notebook-grid {
			grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
			align-items: start;
		}
	}

	.lab-model {
		display: grid;
		gap: var(--space-4);
		min-inline-size: 0;
	}

	.model-card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg-panel);
	}

	.lab-formula {
		overflow-x: auto;
		padding-block: var(--space-2);
	}

	.spec-group {
		display: grid;
		gap: var(--space-2);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;

		& li {
			padding: 3px 9px;
			border: 1px solid var(--line);
			border-radius: 999px;
			font-size: var(--text-sm);
		}
	}

	.bounds {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
		font: var(--text-sm) / 1.5 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		color: var(--ink-mute);
	}

	.fault-note {
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.env-nav {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-4);
		padding-block-start: var(--space-4);
		border-block-start: 1px solid var(--line);
	}

	.env-step {
		display: grid;
		gap: 2px;
		min-inline-size: 0;
		text-decoration: none;
		color: var(--ink);

		&.next {
			text-align: end;
		}

		&:hover .env-step-title {
			color: var(--accent);
		}
	}

	.env-step-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.env-tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px;

		& a {
			display: grid;
			place-items: center;
			min-inline-size: 30px;
			min-block-size: 30px;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			font: var(--text-xs) / 1 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--ink-mute);
			text-decoration: none;

			&[aria-current='page'] {
				border-color: var(--accent);
				color: var(--accent);
			}

			&:hover {
				color: var(--ink);
			}
		}
	}

	@media (max-width: 720px) {
		.lab-bar {
			grid-template-columns: minmax(0, 1fr);
		}

		.env-nav {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}

		.env-tabs {
			grid-column: 1 / -1;
			order: 3;
		}
	}
</style>
