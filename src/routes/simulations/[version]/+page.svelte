<script lang="ts">
	import type { PageData } from './$types';
	import Seo from '$lib/components/Seo.svelte';

	let { data }: { data: PageData } = $props();
</script>

<Seo
	title="Simulation laboratory — schemd"
	description="Five instrumented, zero-dependency circuit and quantum simulations compiled by @schemd/core."
	canonical={`https://schemd.johnowolabiidogun.dev/simulations/${data.version.id}`}
/>

<article class="simulation-index">
	<nav aria-label="Breadcrumb">
		<a href="/">schemd</a>
		<span aria-hidden="true">/</span>
		<strong>simulations</strong>
		<small>{data.version.label}</small>
	</nav>

	<header>
		<p>Interactive systems laboratory · server-compiled SVG</p>
		<h1>Inspect the signal.<br />Break the machine.</h1>
		<div class="header-foot">
			<p>
				Five focused experiments pair deterministic <code>@schemd/core</code> output with browser-native
				instrumentation. No canvas runtime. No simulation framework. No hidden DOM replica.
			</p>
			<div aria-label="Laboratory summary">
				<span>05</span>
				<small>live benches</small>
			</div>
		</div>
	</header>

	<section class="lab-grid" aria-label="Available simulations">
		{#each data.simulations as simulation, index}
			<a
				class="lab-card"
				href={`/simulations/${data.version.id}/${simulation.id}`}
				data-domain={simulation.domain}
			>
				<div class="card-top">
					<span>{String(index + 1).padStart(2, '0')}</span>
					<i aria-hidden="true"></i>
					<small>{simulation.domain}</small>
				</div>
				<div class="signal-glyph" aria-hidden="true">
					{#if simulation.id === 'digital-adder'}
						<svg viewBox="0 0 240 72">
							<path d="M0 48H34V19H72V48H108V19H145V48H184V19H240" />
							<circle cx="72" cy="48" r="4" />
							<circle cx="184" cy="19" r="4" />
						</svg>
					{:else if simulation.id === 'rc-low-pass'}
						<svg viewBox="0 0 240 72">
							<path d="M0 36C18 6 38 6 56 36S94 66 112 36s38-30 56 0 38 30 56 0 12-15 16-16" />
						</svg>
					{:else if simulation.id === '555-astable'}
						<svg viewBox="0 0 240 72">
							<path d="M0 53H35V15H91V53H147V15H203V53H240" />
						</svg>
					{:else}
						<svg viewBox="0 0 240 72">
							<path d="M0 36H50M50 36C70 2 88 2 108 36s38 34 58 0 38-34 58 0h16" />
							<circle cx="50" cy="36" r="4" />
							<circle cx="224" cy="36" r="4" />
						</svg>
					{/if}
				</div>
				<div class="card-copy">
					<h2>{simulation.title}</h2>
					<p>{simulation.summary}</p>
				</div>
				<footer>
					<span>Open laboratory</span>
					<b aria-hidden="true">↗</b>
				</footer>
			</a>
		{/each}
	</section>

	<footer class="page-foot">
		<span>Compiler target · {data.version.packageVersion}</span>
		<span>SSR-safe · SVG-native · pointer-coalesced</span>
	</footer>
</article>

<style>
	.simulation-index {
		--bg: #070b0e;
		--panel: #0c1216;
		--line: #26343b;
		--text: #edf5f1;
		--muted: #84968e;
		--signal: #78e1bd;
		min-height: 100dvh;
		padding: 0 clamp(18px, 4vw, 64px) 40px;
		background:
			linear-gradient(rgba(120, 225, 189, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(120, 225, 189, 0.045) 1px, transparent 1px),
			radial-gradient(circle at 78% 0%, rgba(120, 225, 189, 0.1), transparent 30%), var(--bg);
		background-size:
			36px 36px,
			36px 36px,
			auto,
			auto;
		color: var(--text);
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	nav,
	header,
	.lab-grid,
	.page-foot {
		width: min(1440px, 100%);
		margin-inline: auto;
	}

	nav {
		min-height: 68px;
		display: flex;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font:
			10px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	nav a {
		color: var(--signal);
		text-decoration: none;
	}

	nav strong {
		color: var(--text);
	}

	nav small {
		margin-left: auto;
	}

	header {
		padding-block: clamp(55px, 9vw, 124px) clamp(48px, 7vw, 90px);
	}

	header > p {
		margin: 0 0 18px;
		color: var(--signal);
		font:
			700 10px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 1150px;
		margin: 0;
		font-size: clamp(3.5rem, 9.5vw, 9.3rem);
		font-weight: 520;
		letter-spacing: -0.075em;
		line-height: 0.84;
	}

	.header-foot {
		margin-top: clamp(32px, 5vw, 62px);
		display: grid;
		grid-template-columns: minmax(0, 650px) auto;
		justify-content: space-between;
		align-items: end;
		gap: 40px;
	}

	.header-foot > p {
		margin: 0;
		color: var(--muted);
		font-size: clamp(0.96rem, 1.5vw, 1.18rem);
		line-height: 1.65;
	}

	code {
		color: var(--text);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.header-foot > div {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.header-foot span {
		color: var(--signal);
		font:
			400 clamp(2.6rem, 5vw, 5rem) ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: -0.1em;
	}

	.header-foot small,
	.page-foot {
		color: var(--muted);
		font:
			9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.lab-grid {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		border-top: 1px solid var(--line);
		border-left: 1px solid var(--line);
	}

	.lab-card {
		grid-column: span 4;
		min-height: 440px;
		padding: clamp(20px, 2.6vw, 36px);
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		background: rgba(12, 18, 22, 0.82);
		color: var(--text);
		text-decoration: none;
		transition:
			background-color 180ms ease,
			transform 180ms ease;
	}

	.lab-card:nth-child(4),
	.lab-card:nth-child(5) {
		grid-column: span 6;
	}

	.lab-card:hover {
		z-index: 1;
		background: #10191d;
		transform: translateY(-3px);
		box-shadow: 0 16px 45px rgba(0, 0, 0, 0.2);
	}

	.card-top {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 12px;
		color: var(--muted);
		font:
			9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.card-top i {
		height: 1px;
		background: var(--line);
	}

	.signal-glyph {
		height: 118px;
		display: grid;
		align-items: center;
	}

	.signal-glyph svg {
		width: 100%;
		height: 72px;
		overflow: visible;
	}

	.signal-glyph path,
	.signal-glyph circle {
		fill: var(--panel);
		stroke: var(--signal);
		stroke-width: 1.7;
		vector-effect: non-scaling-stroke;
	}

	.signal-glyph path {
		fill: none;
		filter: drop-shadow(0 0 5px rgba(120, 225, 189, 0.25));
	}

	.card-copy h2 {
		margin: 0 0 13px;
		font-size: clamp(1.45rem, 2.2vw, 2.25rem);
		font-weight: 530;
		letter-spacing: -0.045em;
		line-height: 1.05;
	}

	.card-copy p {
		margin: 0;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.6;
	}

	.lab-card footer {
		margin-top: auto;
		padding-top: 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--signal);
		font:
			700 9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.lab-card footer b {
		font-size: 16px;
		font-weight: 400;
		transition: transform 180ms ease;
	}

	.lab-card:hover footer b {
		transform: translate(3px, -3px);
	}

	.page-foot {
		min-height: 78px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		border-bottom: 1px solid var(--line);
	}

	a:focus-visible {
		outline: 2px solid var(--signal);
		outline-offset: 4px;
	}

	@media (max-width: 900px) {
		.lab-card {
			grid-column: span 6;
		}

		.lab-card:nth-child(5) {
			grid-column: span 12;
		}
	}

	@media (max-width: 620px) {
		.simulation-index {
			padding-inline: 13px;
		}

		h1 {
			font-size: clamp(3.25rem, 17vw, 5.3rem);
		}

		.header-foot {
			grid-template-columns: 1fr;
		}

		.lab-card,
		.lab-card:nth-child(4),
		.lab-card:nth-child(5) {
			grid-column: span 12;
		}

		.lab-card {
			min-height: 380px;
		}

		.page-foot {
			align-items: flex-start;
			padding-block: 20px;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lab-card,
		.lab-card footer b {
			transition: none;
		}

		.lab-card:hover {
			transform: none;
		}
	}
</style>
