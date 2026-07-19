<script lang="ts">
	import type { PageProps } from './$types';
	import { goto } from '$app/navigation';
	import { playSuccess, playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';

	let { data }: PageProps = $props();

	const environments = $derived(data.environments);

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

	/* ---------- Progress-bar module initialization ---------- */
	let launching = $state<string | undefined>();
	function initialize(id: string): void {
		if (launching) return;
		launching = id;
		if (ui.audio) playSuccess();
		setTimeout(() => goto(`/simulations/${data.version}/${id}`), 640);
	}
</script>

<svelte:head>
	<title>Simulation Laboratory · schemd v{data.version}</title>
	<meta
		name="description"
		content="Select from five interactive engineering laboratories running on live @schemd/core full-mode compilations: an 8-bit adder, an RC low-pass filter, Bell states, a 555 astable, and quantum teleportation."
	/>
	<meta property="og:title" content="schemd — simulation laboratory" />
	<meta
		property="og:description"
		content="Five high-fidelity engineering simulations, compiled server-side and driven by native event delegation."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/brand/schemd-logo.svg" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
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
		{:else}
			<path class="wire" d="M6 12h68M6 24h68M6 36h68" />
			<rect class="body" x="18" y="6" width="10" height="12" />
			<rect class="body" x="40" y="18" width="10" height="12" />
			<rect class="body" x="58" y="6" width="10" height="12" />
			<path class="trace" d="M6 12h12M28 12h17v6h13M62 18v-6" />
		{/if}
	</svg>
{/snippet}

<div class="selector grid-backdrop">
	<header class="terminal panel">
		<div class="terminal-head">
			<span class="microlabel">schemd · simulation laboratory</span>
			<span class="microlabel">v{data.version} · mode=full · adapter-node</span>
		</div>
		<h1>Choose a testing ground.</h1>
		<p class="terminal-lede">
			Every laboratory below is real engine output — compiled server-side by <code
				>@schemd/core</code
			> in <code>full</code> mode — and every interaction is vanilla event delegation on the
			compiler's own <code>data-*</code> attributes. The client never draws; it only flips state
			classes and custom properties.
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
				<div><dt>client</dt><dd class="readout">{fps} FPS</dd></div>
				<div><dt>environments</dt><dd class="readout">{environments.length}</dd></div>
				<div><dt>compile</dt><dd class="readout">server</dd></div>
			</dl>
		</div>
	</header>

	<ul class="grid" aria-label="Simulation environments">
		{#each environments as environment, index (environment.id)}
			<li class="card panel" class:featured={index === 0} style={`--i: ${index}`}>
				<a class="card-open" href={`/simulations/${data.version}/${environment.id}`}>
					<div class="card-head">
						{@render miniIcon(environment.id)}
						<div class="card-titles">
							<span class="microlabel">{environment.index} · {environment.domain}</span>
							<h2>{environment.title}</h2>
							<p class="tagline">{environment.tagline}</p>
						</div>
					</div>
				</a>

				<p class="summary">{environment.summary}</p>

				<dl class="specs">
					<dt>governing model</dt>
					<dd class="formula readout">{environment.formula}</dd>
					<dt>structural inventory</dt>
					<dd>
						<ul class="chips">
							{#each environment.inventory as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
					</dd>
					<dt>boundaries</dt>
					<dd>
						<ul class="bounds">
							{#each environment.boundaries as bound (bound)}
								<li>{bound}</li>
							{/each}
						</ul>
					</dd>
					<dt>fault relay</dt>
					<dd class="fault-note">{environment.fault}</dd>
				</dl>

				<button
					type="button"
					class="init"
					class:go={launching === environment.id}
					disabled={launching !== undefined}
					onmouseenter={() => ui.audio && playTick(520 + index * 30)}
					onclick={() => initialize(environment.id)}
				>
					<span class="init-label"
						>{launching === environment.id ? 'initializing…' : 'Initialize Laboratory Module'}</span
					>
					<span class="init-progress" aria-hidden="true"></span>
				</button>
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

	/* ---------- Selection cards ---------- */
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
		gap: var(--space-4);
	}

	.card {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		align-content: start;
		transition:
			border-color var(--dur-kinetic) var(--ease-kinetic),
			transform var(--dur-kinetic) var(--ease-kinetic);
		animation: sweep-in var(--dur-med) var(--ease-precise) both;
		animation-delay: calc(var(--i) * 40ms);

		&:hover {
			border-color: var(--line-strong);
			transform: translateY(-2px);
		}
	}

	@media (min-width: 1180px) {
		.card.featured {
			grid-column: span 2;
		}
	}

	.card-open {
		color: inherit;

		&:hover {
			text-decoration: none;
		}
	}

	.card-head {
		display: flex;
		gap: var(--space-3);
		align-items: start;
	}

	.card-titles {
		display: grid;
		gap: 2px;

		& h2 {
			font-family: var(--font-mono);
			font-size: var(--text-md);
			letter-spacing: -0.01em;
		}
	}

	.tagline {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	/* Mini schematic icon with a hover-animated current trace. */
	.mini {
		inline-size: 80px;
		block-size: 48px;
		flex: none;
		border: 1px solid var(--line);
		background: var(--bg-inset);
		padding: 2px;

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

	.card:hover .mini .trace {
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

	.summary {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.specs {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding-block-start: var(--space-2);
		border-block-start: 1px solid var(--line);

		& dt {
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: var(--tracking-wide);
			text-transform: uppercase;
			color: var(--ink-faint);
			margin-block-start: var(--space-2);
		}

		& dd {
			margin: 0;
		}
	}

	.formula {
		font-size: var(--text-xs);
		line-height: 1.6;
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

	/* ---------- Initialize button with progress bar ---------- */
	.init {
		position: relative;
		overflow: hidden;
		margin-block-start: var(--space-2);
		padding: 0.55rem 0.95rem;
		border: 1px solid var(--line-strong);
		background: var(--bg-raised);
		color: var(--ink);
		font-size: var(--text-sm);
		font-weight: 560;
		text-align: center;
		transition: border-color var(--dur-fast) var(--ease-precise);

		&:hover:not(:disabled) {
			border-color: var(--accent);
		}

		&:disabled {
			cursor: default;
		}
	}

	.init-label {
		position: relative;
		z-index: 1;
	}

	.init-progress {
		position: absolute;
		inset: 0;
		transform: scaleX(0);
		transform-origin: left;
		background: color-mix(in srgb, var(--accent) 28%, transparent);
		border-inline-end: 2px solid var(--accent);
	}

	.init.go .init-progress {
		transform: scaleX(1);
		transition: transform var(--dur-kinetic) var(--ease-kinetic);
	}

	@media (max-width: 720px) {
		.diagnostics {
			grid-template-columns: 1fr;
			align-items: start;
		}
	}
</style>
