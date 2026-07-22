<script lang="ts">
	import type { PageProps } from './$types';
	import { playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import 'katex/dist/katex.min.css';

	let { data }: PageProps = $props();

	const environments = $derived(data.environments);
	type TierFilter = 'All' | 'Core' | 'Advanced' | 'Frontier';
	const tiers: readonly TierFilter[] = ['All', 'Core', 'Advanced', 'Frontier'];
	let tier = $state<TierFilter>('All');
	const visibleEnvironments = $derived(
		tier === 'All' ? environments : environments.filter((environment) => environment.tier === tier)
	);
	const frontierCount = $derived(
		environments.filter((environment) => environment.tier === 'Frontier').length
	);

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
	const jsonLdMarkup = $derived(`<script type="application/ld+json">${jsonLd}</${'script'}>`);

	/* ---------- Live client canvas performance readout ---------- */
	let fps = $state(60);
	$effect(() => {
		let frame = 0;
		let last = performance.now();
		let count = 0;
		const loop = (now: number): void => {
			count += 1;
			if (now - last >= 500) {
				fps = Math.round((count * 1000) / (now - last));
				count = 0;
				last = now;
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	/* ---------- Terminal diagnostics boot sequence ---------- */
	const BOOT_LINES = [
		'· mounting @schemd/core full-compilation kernel … ok',
		'· resolving delegation attributes data-node-id / data-port-id … ok',
		'· arming diagnostic probe + multimeter bus … ok',
		'· calibrating 60 FPS oscilloscope timebase … ok',
		'· switchboard fault-injection relays … standby'
	];
	let bootIndex = $state(0);
	$effect(() => {
		const timer = setInterval(() => {
			bootIndex = (bootIndex + 1) % (BOOT_LINES.length + 1);
		}, 1600);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Simulation Laboratory · schemd v{data.version}</title>
	<meta
		name="description"
		content="Explore eight interactive circuit laboratories spanning digital logic, analog filters, quantum protocols, power electronics, nonlinear chaos, and phase-locked control systems."
	/>
	<meta property="og:title" content="schemd — simulation laboratory" />
	<meta
		property="og:description"
		content="Eight high-fidelity engineering simulations with live physics, fault injection, and instrumentation."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/brand/schemd-logo.svg" />
	{@html jsonLdMarkup}
</svelte:head>

{#snippet miniIcon(id: string)}
	<svg class="mini" viewBox="0 0 80 48" role="img" aria-hidden="true">
		{#if id === 'adder'}
			<path class="wire" d="M6 14h14M6 34h14M20 8v32M20 24h12" />
			<path class="body" d="M20 8l16 16-16 16z" />
			<circle class="body" cx="40" cy="24" r="3" />
			<path class="wire" d="M43 24h10v-8h12M53 24v8h12" />
			<path class="trace" d="M6 14h14l16 10 M46 24h8v-8h11" />
		{:else if id === 'rc'}
			<path class="wire" d="M6 18h10l3-6 5 12 5-12 5 12 3-6h6" />
			<path class="wire" d="M48 18v10M42 28h12M42 32h12M48 32v8" />
			<path class="wire" d="M44 40h8M46 43h4" />
			<path class="trace" d="M6 18h10l3-6 5 12 5-12 5 12 3-6h6" />
		{:else if id === 'bell'}
			<path class="wire" d="M6 16h68M6 34h68" />
			<rect class="body" x="20" y="9" width="14" height="14" />
			<circle class="body" cx="52" cy="16" r="3.5" />
			<path class="body" d="M52 16v18M46 34h12M52 40v-6" />
			<path class="trace" d="M6 16h14M34 16h18v18h6" />
		{:else if id === 'timer'}
			<rect class="body" x="26" y="10" width="28" height="28" />
			<path class="wire" d="M20 16h6M20 24h6M20 32h6M54 16h6M54 32h6M40 6v4M40 38v4" />
			<path class="wire" d="M14 22v10M11 24h6M11 30h6M14 32v6" />
			<path class="trace" d="M40 10v4h14v18" />
		{:else if id === 'teleport'}
			<path class="wire" d="M6 12h68M6 24h68M6 36h68" />
			<rect class="body" x="18" y="6" width="10" height="12" />
			<rect class="body" x="40" y="18" width="10" height="12" />
			<rect class="body" x="58" y="6" width="10" height="12" />
			<path class="trace" d="M6 12h12M28 12h17v6h13M62 18v-6" />
		{:else if id === 'buck'}
			<path class="wire" d="M5 16h12M27 16h9M50 16h24M58 16v13M52 29h12M52 33h12M58 33v9" />
			<path class="body" d="M17 8v16M17 12l10-4v16l-10-4M36 16c2-7 5-7 7 0s5 7 7 0" />
			<path class="trace" d="M5 16h12M27 16h9M36 16c2-7 5-7 7 0s5 7 7 0h24" />
		{:else if id === 'chua'}
			<path class="wire" d="M5 18h13l3-6 5 12 5-12 5 12 3-6h14M18 18v22M53 18v22" />
			<path class="body" d="M12 40h12M14 44h8M47 40h12M49 44h8M62 12c-10 0-10 12 0 12s10 12 0 12" />
			<path class="trace" d="M5 18h13l3-6 5 12 5-12 5 12 3-6h14" />
		{:else}
			<path class="wire" d="M5 14h13M34 14h10M58 14h17M66 14v22H22V28" />
			<rect class="body" x="18" y="7" width="16" height="14" />
			<rect class="body" x="44" y="7" width="14" height="14" />
			<path class="body" d="M22 28h10M22 32h10M27 32v8" />
			<path class="trace" d="M5 14h13M34 14h10M58 14h8v22H32" />
		{/if}
	</svg>
{/snippet}

<div class="selector grid-backdrop">
	<header class="terminal panel">
		<div class="terminal-head">
			<span class="microlabel">schemd · simulation laboratory</span>
			<span class="microlabel">v{data.version} · mode=full · adapter-node</span>
		</div>
		<h1>Enter the circuit frontier.</h1>
		<p class="terminal-lede">
			Eight live experiments now span foundational circuits and frontier systems: switched-mode
			power, deterministic chaos, phase-lock acquisition, quantum protocols, and classical logic.
			Every test bed is compiled from the same <code>@schemd/core</code> source and instrumented with
			fault injection, probes, and live numerical models.
		</p>
		<div class="diagnostics" role="status" aria-live="polite">
			<div class="diag-log">
				{#each BOOT_LINES.slice(0, bootIndex) as line (line)}
					<p>{line}</p>
				{/each}
				<p class="diag-cursor">
					{bootIndex >= BOOT_LINES.length ? '· all systems nominal' : '·'}<span class="caret"
					></span>
				</p>
			</div>
			<dl class="diag-metrics">
				<div>
					<dt>client</dt>
					<dd class="readout">{fps} FPS</dd>
				</div>
				<div>
					<dt>environments</dt>
					<dd class="readout">{environments.length}</dd>
				</div>
				<div>
					<dt>frontier labs</dt>
					<dd class="readout">{frontierCount}</dd>
				</div>
			</dl>
		</div>
	</header>

	<div class="catalog-bar panel">
		<div>
			<span class="microlabel">experiment catalogue</span>
			<p>{visibleEnvironments.length} of {environments.length} laboratories online</p>
		</div>
		<div class="tier-filters" role="group" aria-label="Filter simulations by complexity tier">
			{#each tiers as option (option)}
				<button type="button" aria-pressed={tier === option} onclick={() => (tier = option)}
					>{option}</button
				>
			{/each}
		</div>
	</div>

	<ul class="lab-list" aria-label="Simulation environments">
		{#each visibleEnvironments as environment, index (environment.id)}
			<li class="lab-row panel" style={`--i: ${index}`}>
				<a
					class="lab-icon"
					href={`/simulations/${data.version}/${environment.id}`}
					aria-label={environment.title}
				>
					{@render miniIcon(environment.id)}
					<span class="lab-index microlabel">{environment.index} · {environment.domain}</span>
				</a>

				<div class="lab-info">
					<a class="lab-titlelink" href={`/simulations/${data.version}/${environment.id}`}>
						<h2>{environment.title}</h2>
					</a>
					<p class="tagline">{environment.tagline}</p>
					<div class="model-line">
						<span class:frontier={environment.tier === 'Frontier'}>{environment.tier}</span>
						<code>{environment.model}</code>
					</div>
					<div class="lab-formula">{@html environment.formulaHtml}</div>
					<div class="lab-meta">
						<ul class="chips">
							{#each environment.inventory as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
						<p class="bounds-inline microlabel">{environment.boundaries.join(' · ')}</p>
					</div>
				</div>

				<div class="lab-action">
					<span class="fault-note" title="Switchboard fault this lab can inject"
						>⚠ {environment.fault}</span
					>
					<a
						class="init"
						href={`/simulations/${data.version}/${environment.id}`}
						onmouseenter={() => ui.audio && playTick(520 + index * 30)}
					>
						<span class="init-label">Initialize module →</span>
					</a>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.selector {
		padding: clamp(1rem, 3vw, 2.5rem);
		display: grid;
		gap: var(--space-6);
	}

	/* ---------- Terminal status banner ---------- */
	.terminal {
		padding: clamp(1rem, 3vw, var(--space-8));
		display: grid;
		gap: var(--space-3);

		& h1 {
			font-size: var(--text-xl);
			letter-spacing: -0.02em;
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
	}

	.diagnostics {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-6);
		align-items: end;
		margin-block-start: var(--space-2);
		padding: var(--space-3);
		background: var(--bg-inset);
		border: 1px solid var(--line);
	}

	.diag-log {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);
		min-block-size: 6.5em;

		& p {
			margin: 0;
			animation: sweep-in var(--dur-fast) var(--ease-precise) both;
		}

		& .diag-cursor {
			color: var(--accent);
		}
	}

	.caret {
		display: inline-block;
		inline-size: 7px;
		block-size: 1em;
		margin-inline-start: 3px;
		background: var(--accent);
		vertical-align: text-bottom;
		animation: blink 1s steps(2) infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	.diag-metrics {
		display: flex;
		gap: var(--space-6);
		margin: 0;

		& div {
			display: grid;
			gap: 2px;
		}

		& dt {
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: var(--tracking-wide);
			text-transform: uppercase;
			color: var(--ink-faint);
		}

		& dd {
			margin: 0;
			font-size: var(--text-md);
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
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: var(--tracking-wide);
			text-transform: uppercase;

			&:hover {
				color: var(--ink);
			}

			&[aria-pressed='true'] {
				background: var(--accent);
				color: var(--accent-ink);
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

	/* left: framed animated micro-schematic + index/domain */
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

	.mini {
		inline-size: 100%;
		block-size: auto;
		aspect-ratio: 80 / 48;
		border: 1px solid var(--line);
		background: var(--bg-inset);
		padding: var(--space-2);

		& .wire,
		& .body {
			fill: none;
			stroke: var(--ink-faint);
			stroke-width: 1.4;
			stroke-linejoin: round;
			stroke-linecap: round;
		}

		& .body {
			stroke: var(--ink-mute);
		}

		& .trace {
			fill: none;
			stroke: var(--accent);
			stroke-width: 1.6;
			stroke-linecap: round;
			stroke-dasharray: 6 120;
			stroke-dashoffset: 120;
			opacity: 0;
			filter: drop-shadow(0 0 2px var(--glow));
		}
	}

	.lab-row:hover .mini .trace {
		opacity: 1;
		animation: trace-run 1.4s linear infinite;
	}

	@keyframes trace-run {
		from {
			stroke-dashoffset: 120;
		}
		to {
			stroke-dashoffset: 0;
		}
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
				color: var(--accent);
			}
		}

		& h2 {
			font-family: var(--font-mono);
			font-size: var(--text-md);
			letter-spacing: -0.01em;
			transition: color var(--dur-fast) var(--ease-precise);
		}
	}

	.tagline {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
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
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: var(--tracking-wide);
			text-transform: uppercase;

			&.frontier {
				border-color: var(--accent);
				color: var(--accent);
				box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 55%, transparent);
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
			font-family: var(--font-mono);
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
		letter-spacing: normal;
	}

	/* right: fault relay + initialize CTA */
	.lab-action {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.fault-note {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--danger);
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
			border-color: var(--accent);
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

		.diagnostics {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.lab-row {
			grid-template-columns: 1fr;
			gap: var(--space-3);
		}

		.lab-icon {
			grid-template-columns: 96px 1fr;
			align-items: center;
		}

		.lab-action {
			grid-template-columns: 1fr;
		}
	}
</style>
