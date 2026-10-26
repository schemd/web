<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import { onMount } from 'svelte';
	import { playTick } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import {
		SIMULATION_PROGRESS_EVENT,
		browserSimulationProgressStorage,
		completedLabCount,
		emptySimulationProgress,
		isLabComplete,
		readSimulationProgress,
		type SimulationProgress
	} from '#lib/simulation-progress.ts';
	import 'katex/dist/katex.min.css';
	import CurriculumMap, { type MapLab } from '#lib/components/sims/CurriculumMap.svelte';

	let { data }: PageProps = $props();

	const environments = $derived(data.environments);
	type TierFilter = 'All' | 'Core' | 'Advanced' | 'Frontier';
	const tiers: readonly TierFilter[] = ['All', 'Core', 'Advanced', 'Frontier'];
	let tier = $state<TierFilter>('All');
	const visibleEnvironments = $derived(
		tier === 'All' ? environments : environments.filter((environment) => environment.tier === tier)
	);
	const environmentIds = $derived(environments.map((environment) => environment.id));
	let progress = $state<SimulationProgress>(emptySimulationProgress());
	const completionCount = $derived(completedLabCount(progress, environmentIds));

	function titleFor(id: string): string {
		return environments.find((environment) => environment.id === id)?.title ?? id;
	}

	onMount(() => {
		const storage = browserSimulationProgressStorage();
		progress = readSimulationProgress(storage, data.version);
		const refresh = (event: Event): void => {
			if (event instanceof StorageEvent && event.key && !event.key.endsWith(`:${data.version}`)) {
				return;
			}
			progress = readSimulationProgress(storage, data.version);
		};
		window.addEventListener('storage', refresh);
		window.addEventListener(SIMULATION_PROGRESS_EVENT, refresh);
		return () => {
			window.removeEventListener('storage', refresh);
			window.removeEventListener(SIMULATION_PROGRESS_EVENT, refresh);
		};
	});

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'ItemList',
			name: 'schemd simulation laboratory',
			itemListElement: environments.map((environment, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: environment.title,
				url: `/simulations/${data.version}/${environment.id}`
			}))
		})
	);

	/* ---------- The map ---------- */
	const mapLabs = $derived<MapLab[]>(
		data.map
			? environments.flatMap((environment) => {
					const node = data.map!.nodes[environment.id];
					return node
						? [
								{
									id: environment.id,
									node,
									index: environment.index,
									title: environment.title,
									tagline: environment.tagline,
									objective: environment.curriculum.objective,
									tier: environment.tier,
									domain: environment.domain,
									href: `/simulations/${data.version}/${environment.id}`,
									done: isLabComplete(progress, environment.id)
								}
							]
						: [];
				})
			: []
	);
	/* Next: the first lab, in curriculum order, not done but whose prerequisites are. */
	const nextLab = $derived(
		[...environments]
			.sort((a, b) => a.curriculum.order - b.curriculum.order)
			.find(
				(environment) =>
					!isLabComplete(progress, environment.id) &&
					environment.curriculum.prerequisites.every((id) => isLabComplete(progress, id))
			)?.id
	);
</script>

<Seo
	title={t('Simulation laboratory · schemd v{0}', [data.version])}
	description={t(
		'{0} interactive circuit laboratories spanning digital logic, analog filters, quantum protocols, power electronics, error correction, and power electronics — each compiled from schemd source and instrumented with fault injection.',
		[environments.length]
	)}
	canonicalPath={`/simulations/${data.latest}`}
	{jsonLd}
/>

<div class="selector grid-backdrop">
	<SheetFrame label={t('Simulation laboratory')}>
		<header class="terminal sheet-head">
			<div class="terminal-head">
				<span class="microlabel">{t('Revision')} {t(data.version)}</span>
				<span class="microlabel">{t(environments.length)} {t('labs')}</span>
			</div>
			<h1>{t('Simulation labs')}</h1>
			<p class="terminal-lede">
				{t(environments.length)}
				{t(
					'live circuits on three tracks: digital, analog, and quantum. Start at the left of a track; every lab to its right builds on the one it is wired to. Each is compiled from'
				)}
				<code>@schemd/core</code>
				{t('source and runs a real numerical model you tune on the parts themselves.')}
				<a href={href(`/simulations/${data.version}/new`)}>{t('Describe one of your own')}</a>
			</p>
			{#if data.map}
				<CurriculumMap svg={data.map.svg} labs={mapLabs} next={nextLab} />
			{/if}
		</header>
	</SheetFrame>

	<div class="catalog-bar plate">
		<div>
			<span class="microlabel">{t('Recommended order, with progress kept on this device')}</span>
			<p>
				{t(visibleEnvironments.length)}
				{t('of')}
				{t(environments.length)}
				{t('laboratories online')}
			</p>
			<p class="completion-summary" role="status" aria-live="polite">
				{t(completionCount)}
				{t('of')}
				{t(environments.length)}
				{t('experiments completed on this device')}
			</p>
		</div>
		<div class="tier-filters" role="group" aria-label={t('Filter simulations by complexity tier')}>
			{#each tiers as option (option)}
				<button type="button" aria-pressed={tier === option} onclick={() => (tier = option)}
					>{t(option)}</button
				>
			{/each}
		</div>
	</div>

	<ul class="lab-list" aria-label={t('Simulation environments')}>
		{#each visibleEnvironments as environment, index (environment.id)}
			<li class="lab-row plate" style={`--i: ${index}`}>
				<a class="lab-icon" href={href(`/simulations/${data.version}/${environment.id}`)}>
					<span class="lab-index microlabel">{t(environment.index)}, {t(environment.domain)}</span>
					<!-- Named by what it shows, then the lab it opens. -->
					<span class="visually-hidden">{t(environment.title)}</span>
				</a>

				<div class="lab-info">
					<a class="lab-titlelink" href={href(`/simulations/${data.version}/${environment.id}`)}>
						<h2>{t(environment.title)}</h2>
					</a>
					<p class="tagline">{t(environment.tagline)}</p>
					<p class="curriculum-objective">
						<span>{t('Lab')} {t(environment.curriculum.order)} {t('objective:')}</span>
						{t(environment.curriculum.objective)}
					</p>
					<p class="curriculum-prerequisites">
						{#if environment.curriculum.prerequisites.length === 0}
							{t('No prerequisite')}
						{:else}
							{t('Builds on')}
							{t(environment.curriculum.prerequisites.map(titleFor).join(', '))}
						{/if}
					</p>
					<div class="model-line">
						<span class:frontier={environment.tier === 'Frontier'}>{t(environment.tier)}</span>
						<code>{environment.model}</code>
					</div>
					<div class="lab-formula">{@html environment.formulaHtml}</div>
					<div class="lab-meta">
						<ul class="chips">
							{#each environment.inventory as item (item)}
								<li>{t(item)}</li>
							{/each}
						</ul>
						<p class="bounds-inline microlabel">{t(environment.boundaries.join('; '))}</p>
					</div>
				</div>

				<div class="lab-action">
					<span
						class="completion-state"
						class:is-complete={isLabComplete(progress, environment.id)}
					>
						{isLabComplete(progress, environment.id)
							? t('Completed on this device')
							: t('Not completed')}
					</span>
					<span class="fault-note">{t('Diagnosis challenge: the fault is hidden')}</span>
					<a
						class="init"
						href={href(`/simulations/${data.version}/${environment.id}`)}
						onmouseenter={() => ui.audio && playTick(520 + index * 30)}
					>
						<span class="init-label"
							>{isLabComplete(progress, environment.id)
								? t('Revisit the lab')
								: t('Open the lab')}</span
						>
					</a>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.selector {
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
		padding-block: var(--space-8) var(--space-16);
		display: grid;
		gap: var(--space-6);
	}

	/* ---------- Terminal status banner ---------- */
	.terminal {
		display: grid;
		gap: var(--space-3);

		& h1 {
			font-size: var(--text-xl);
		}
	}

	.terminal-head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		padding-block-end: var(--space-2);
		border-block-end: 1px solid var(--line);
	}

	.terminal-lede {
		max-inline-size: 74ch;
		margin: 0;
		color: var(--ink-mute);

		/* A link inside a sentence is underlined; colour alone is not enough. */
		& a {
			text-decoration: underline;
			text-decoration-thickness: 1px;
			text-underline-offset: 0.2em;
		}
	}

	.catalog-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);

		& p {
			margin: 2px 0 0;
			color: var(--ink-mute);
			font-size: var(--text-sm);
		}
	}

	.tier-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1px;
		padding: 1px;
		background: var(--line);

		& button {
			padding: 0.45rem 0.8rem;
			background: var(--bg-raised);
			color: var(--ink-mute);
			font-family: var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			font-size: var(--text-2xs);

			&:hover {
				color: var(--ink);
			}

			&[aria-pressed='true'] {
				background: var(--ink);
				color: var(--bg);
			}
		}
	}

	/* ---------- Selection catalog rows ---------- */
	.lab-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-4);
	}

	.lab-row {
		display: grid;
		grid-template-columns: 172px minmax(0, 1fr) minmax(200px, 240px);
		gap: clamp(var(--space-4), 3vw, var(--space-8));
		padding: clamp(var(--space-5), 2.4vw, var(--space-7));
		align-items: start;
		transition: border-color var(--dur-kinetic) var(--ease-kinetic);
		animation: sweep-in var(--dur-med) var(--ease-precise) both;
		animation-delay: calc(var(--i) * 50ms);

		&:hover {
			border-color: var(--line-strong);
		}
	}

	/* left: the lab's index and domain */
	.lab-icon {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		color: inherit;

		&:hover {
			text-decoration: none;
		}
	}

	.lab-index {
		color: var(--ink-faint);
	}

	/* middle: identity + governing model + meta */
	.lab-info {
		display: grid;
		gap: var(--space-2);
		min-inline-size: 0;
	}

	.lab-titlelink {
		color: inherit;

		&:hover {
			text-decoration: none;

			& h2 {
				color: var(--ink);
			}
		}

		& h2 {
			font-family: var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			font-size: var(--text-md);
			transition: color var(--dur-fast) var(--ease-precise);
		}
	}

	.tagline {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.curriculum-objective,
	.curriculum-prerequisites,
	.completion-summary {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.curriculum-objective {
		display: grid;
		gap: 2px;
		padding-inline-start: var(--space-3);
		border-inline-start: 2px solid var(--ink);

		& span {
			font-family: var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			font-size: var(--text-2xs);
			color: var(--ink);
		}
	}

	.curriculum-prerequisites {
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-2xs);
		color: var(--ink-faint);
	}

	.model-line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;

		& span {
			padding: 0.12rem 0.5rem;
			border: 1px solid var(--line-strong);
			color: var(--ink-mute);
			font-family: var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			font-size: var(--text-2xs);

			&.frontier {
				border-color: var(--ink);
				color: var(--ink);
				box-shadow: none;
			}
		}

		& code {
			color: var(--ink-faint);
			font-size: var(--text-2xs);
		}
	}

	.lab-formula {
		font-size: var(--text-sm);
		color: var(--ink);
		overflow-x: auto;
		padding-block: var(--space-2);
		border-block: 1px solid var(--line);
		margin-block: var(--space-1);
	}

	.lab-meta {
		display: grid;
		gap: var(--space-2);
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& li {
			font-family: var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			font-size: var(--text-2xs);
			padding: 0.1em 0.5em;
			border: 1px solid var(--line);
			background: var(--bg-inset);
			color: var(--ink-mute);
		}
	}

	.bounds-inline {
		margin: 0;
		font-size: var(--text-2xs);
		color: var(--ink-mute);
		text-transform: none;
	}

	/* right: fault relay + initialize CTA */
	.lab-action {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.fault-note {
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-2xs);
		color: var(--ink-faint);
	}

	.completion-state {
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-2xs);
		color: var(--ink-faint);

		&.is-complete {
			color: var(--ok);
		}
	}

	/* A real link keeps catalogue navigation functional before hydration. */
	.init {
		display: block;
		padding: 0.55rem 0.95rem;
		border: 1px solid var(--line-strong);
		background: var(--bg-raised);
		color: var(--ink);
		font-size: var(--text-sm);
		font-weight: 560;
		text-align: center;
		transition: border-color var(--dur-fast) var(--ease-precise);

		&:hover {
			border-color: var(--ink);
		}
	}

	.init-label {
		position: relative;
		z-index: 1;
	}

	@media (max-width: 940px) {
		.lab-row {
			grid-template-columns: 140px minmax(0, 1fr);
		}

		.lab-action {
			grid-column: 1 / -1;
			grid-template-columns: 1fr auto;
			align-items: center;
			padding-block-start: var(--space-3);
			border-block-start: 1px solid var(--line);
		}
	}

	@media (max-width: 620px) {
		.catalog-bar {
			align-items: stretch;
			flex-direction: column;
		}

		.tier-filters {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
		}

		.lab-row {
			grid-template-columns: 1fr;
			gap: var(--space-3);
		}

		.lab-action {
			grid-template-columns: 1fr;
		}
	}
</style>
