<script lang="ts">
	import type { PageProps } from './$types';
	import Pronounce from '$lib/components/Pronounce.svelte';

	let { data }: PageProps = $props();

	/* ---------- Interactive multi-domain hero instrument ---------- */
	let selected = $state(0);
	let paused = $state(false);
	const hero = $derived(data.heroes[selected]!);

	$effect(() => {
		if (paused || data.heroes.length < 2) return;
		const timer = setInterval(() => {
			selected = (selected + 1) % data.heroes.length;
		}, 4600);
		return () => clearInterval(timer);
	});

	const bytes = $derived(hero.metrics['svgBytes'] ?? 0);

	/* ---------- Package-manager install switcher ---------- */
	const MANAGERS = ['npm', 'pnpm', 'bun', 'yarn', 'deno'] as const;
	type Manager = (typeof MANAGERS)[number];
	const INSTALL: Record<Manager, string> = {
		npm: 'npm i @schemd/core',
		pnpm: 'pnpm add @schemd/core',
		bun: 'bun add @schemd/core',
		yarn: 'yarn add @schemd/core',
		deno: 'deno add npm:@schemd/core'
	};
	let pm = $state<Manager>('npm');
	const installCmd = $derived(INSTALL[pm]);
	let copied = $state(false);
	async function copyInstall(): Promise<void> {
		try {
			await navigator.clipboard.writeText(installCmd);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* Clipboard unavailable — the command stays visible to select. */
		}
	}

	const pipeline = [
		{
			n: '01',
			name: 'Tokenize',
			body: 'Each declaration is lexed into kind, id, label, coordinate, color, and options.'
		},
		{
			n: '02',
			name: 'Validate',
			body: 'Options are checked by name against the kind you named — unknowns fail loudly.'
		},
		{
			n: '03',
			name: 'Route',
			body: 'Orthogonal traces escape each body, avoid every obstacle, and bridge true crossings.'
		},
		{
			n: '04',
			name: 'Emit',
			body: 'A deterministic, accessible SVG — byte-identical for identical source.'
		}
	];

	const features = [
		{
			n: '01',
			span: 3,
			title: 'Two-line grammar',
			body: 'Components and connections. Everything else is bracketed options, validated by name against the kind you chose — so a typo is an error at compile time, never a silent wrong drawing.'
		},
		{
			n: '02',
			span: 3,
			title: 'Zero dependencies',
			body: 'No DOM, no browser layout pass, no Markdown parser. The compiler runs on a server or during a build — this very page compiled its own hero, four ways.'
		},
		{
			n: '03',
			span: 2,
			title: 'Deterministic output',
			body: 'Identical source yields byte-identical SVG. Diagnostics carry exact one-based line numbers.'
		},
		{
			n: '04',
			span: 2,
			title: 'Obstacle-aware routing',
			body: 'Orthogonal traces route around bodies with clearance; crossings get draftsman bridge arcs, never false junctions.'
		},
		{
			n: '05',
			span: 2,
			title: 'Three output budgets',
			body: 'default stays static; embedded-css adds theme styles; full instruments every node, port, and wire.'
		}
	];

	const limits = $derived([
		{ label: 'components', value: data.limits.components.toLocaleString('en-US') },
		{ label: 'connections', value: data.limits.connections.toLocaleString('en-US') },
		{ label: 'wire crossings', value: data.limits.wireCrossings.toLocaleString('en-US') },
		{ label: 'SVG output', value: `${(data.limits.svgOutputBytes / 1024 / 1024).toFixed(0)} MiB` }
	]);

	const jsonLd = $derived(
		JSON.stringify({
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
			author: {
				'@type': 'Person',
				name: 'John Owolabi Idogun',
				url: 'https://www.johnowolabiidogun.dev'
			}
		})
	);
	const jsonLdMarkup = $derived(`<script type="application/ld+json">${jsonLd}</${'script'}>`);
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
	{@html jsonLdMarkup}
</svelte:head>

<article class="landing grid-backdrop">
	<section class="hero">
		<div class="hero-copy">
			<p class="microlabel animate-in">@schemd/core · v{data.latest} · MIT</p>
			<h1 class="animate-in">Schematics are<br />source code.</h1>
			<div class="hero-pronounce animate-in">
				<span class="hero-brand">schemd</span>
				<Pronounce />
			</div>
			<p class="hero-lede animate-in">
				We treat a schematic the way a compiler treats source. Write electrical, logic, quantum, and
				UML diagrams as plain text; the pipeline tokenizes each declaration, validates its options
				against the component kind you named, routes traces around component bodies, and emits
				deterministic, accessible SVG — on a server, with zero dependencies.
			</p>
			<div class="hero-actions animate-in">
				<a class="btn btn-solid" href={`/playground/${data.latest}`}>Open the playground</a>
				<a class="btn" href={`/docs/${data.latest}/overview`}>Read the docs</a>
				<a class="btn" href={`/simulations/${data.latest}`}>Enter the lab</a>
			</div>

			<div class="install animate-in">
				<div class="pm-tabs" role="tablist" aria-label="Package manager">
					{#each MANAGERS as manager (manager)}
						<button
							type="button"
							role="tab"
							aria-selected={pm === manager}
							class:active={pm === manager}
							onclick={() => (pm = manager)}
						>
							{manager}
						</button>
					{/each}
				</div>
				<div class="pm-line">
					<code><span class="pm-prompt" aria-hidden="true">$</span> {installCmd}</code>
					<button
						type="button"
						class="pm-copy microlabel"
						onclick={copyInstall}
						aria-label="Copy install command"
					>
						{copied ? '✓ copied' : 'copy'}
					</button>
				</div>
			</div>
		</div>

		<figure
			class="instrument panel animate-in"
			onpointerenter={() => (paused = true)}
			onpointerleave={() => (paused = false)}
		>
			<div class="instrument-tabs" role="tablist" aria-label="Example domains">
				{#each data.heroes as specimen, index (specimen.id)}
					<button
						type="button"
						role="tab"
						aria-selected={index === selected}
						class:active={index === selected}
						onclick={() => (selected = index)}
					>
						{specimen.domain}
					</button>
				{/each}
			</div>

			<div class="instrument-stage">
				{#key selected}
					<div class="stage-svg schemd-frame">
						{@html hero.svg}
					</div>
				{/key}
				<span class="stage-badge microlabel">live · mode=full</span>
			</div>

			<dl class="instrument-metrics">
				<div>
					<dt>nodes</dt>
					<dd class="readout">{hero.metrics['components'] ?? 0}</dd>
				</div>
				<div>
					<dt>wires</dt>
					<dd class="readout">{hero.metrics['connections'] ?? 0}</dd>
				</div>
				<div>
					<dt>bytes</dt>
					<dd class="readout">{bytes.toLocaleString('en-US')}</dd>
				</div>
				<div>
					<dt>compile</dt>
					<dd class="readout">{hero.ms} ms</dd>
				</div>
			</dl>

			{#key selected}
				<!-- Keyboard focus exposes overflowing source to Safari users. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre
					class="codeblock stage-src"
					tabindex="0"
					role="region"
					aria-label="Scrollable hero source"><code>{@html hero.sourceHtml}</code></pre>
			{/key}
		</figure>
	</section>

	<section class="pipeline">
		<header class="section-head">
			<p class="section-eyebrow microlabel">the pass, end to end</p>
			<h2>Text in. Vector out. Four deterministic passes.</h2>
		</header>
		<ol class="stepper">
			{#each pipeline as stage, index (stage.n)}
				<li class="step" style={`--i: ${index}`}>
					<div class="step-rail">
						<span class="step-disc">{stage.n}</span>
						<span class="step-line" aria-hidden="true"></span>
					</div>
					<h3>{stage.name}</h3>
					<p>{stage.body}</p>
				</li>
			{/each}
		</ol>
	</section>

	<section class="features">
		<header class="section-head">
			<p class="section-eyebrow microlabel">what you get</p>
			<h2>An engineering compiler, not a drawing toy.</h2>
		</header>
		<div class="feature-grid">
			{#each features as feature (feature.n)}
				<article class="feature panel" data-span={feature.span}>
					<span class="feature-n microlabel">{feature.n}</span>
					<h3>{feature.title}</h3>
					<p>{feature.body}</p>
				</article>
			{/each}
			<article class="feature panel feature-limits" data-span="6">
				<div class="limits-copy">
					<span class="feature-n microlabel">06</span>
					<h3>Bounded by design</h3>
					<p>
						Hard ceilings on everything. The writer refuses to exceed them, so a runaway document
						fails fast instead of exhausting the server.
					</p>
				</div>
				<dl class="limits-grid">
					{#each limits as limit (limit.label)}
						<div>
							<dd class="readout">{limit.value}</dd>
							<dt>{limit.label}</dt>
						</div>
					{/each}
				</dl>
			</article>
		</div>
	</section>

	<aside class="landing-foot hairline-x" aria-label="Project links">
		<span class="microlabel">{data.releaseCount} releases tracked · registry-synced</span>
		<span>
			<a href="/changelog">Changelog</a> ·
			<a href="/examples">Examples</a> ·
			<a href="/coverage">Coverage</a> ·
			<a href="https://github.com/schemd/core" rel="noopener" target="_blank">GitHub</a> ·
			<a href="https://www.npmjs.com/package/@schemd/core" rel="noopener" target="_blank">npm</a>
		</span>
	</aside>
</article>

<style>
	.landing {
		padding: clamp(1rem, 4vw, 3rem);
		display: grid;
		gap: clamp(var(--space-12), 8vw, var(--space-16));
		overflow-x: clip;
	}

	/* ---------- Hero ---------- */
	.hero {
		display: grid;
		grid-template-columns: minmax(300px, 5fr) minmax(360px, 6fr);
		gap: clamp(var(--space-6), 4vw, var(--space-12));
		align-items: start;
		padding-block-start: var(--space-6);
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
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		margin-block: var(--space-4);
		max-inline-size: 100%;

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
		max-inline-size: 54ch;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-block: var(--space-6);
	}

	/* ---------- Package-manager install ---------- */
	.install {
		inline-size: fit-content;
		max-inline-size: 100%;
		border: 1px solid var(--line);
		background: var(--bg-inset);
	}

	.pm-tabs {
		display: flex;
		border-block-end: 1px solid var(--line);

		& button {
			padding: 0.34rem 0.7rem;
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			color: var(--ink-faint);
			border-inline-end: 1px solid var(--line);
			transition: color var(--dur-fast) var(--ease-precise);

			&:hover {
				color: var(--ink-mute);
			}

			&.active {
				color: var(--accent);
				background: color-mix(in srgb, var(--accent) 9%, transparent);
			}
		}
	}

	.pm-line {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-3);

		& code {
			font-size: var(--text-sm);
			color: var(--ink);
			white-space: nowrap;
			overflow-x: auto;
		}

		& .pm-prompt {
			color: var(--ink-faint);
		}

		& .pm-copy {
			margin-inline-start: auto;
			color: var(--ink-faint);
			flex: none;
			transition: color var(--dur-fast) var(--ease-precise);

			&:hover {
				color: var(--accent);
			}
		}
	}

	/* ---------- Instrument ---------- */
	.instrument {
		display: grid;
		overflow: hidden;
	}

	.instrument-tabs {
		display: flex;
		border-block-end: 1px solid var(--line);

		& button {
			flex: 1;
			padding: var(--space-2) var(--space-3);
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: var(--tracking-wide);
			text-transform: uppercase;
			color: var(--ink-faint);
			border-inline-end: 1px solid var(--line);
			transition:
				color var(--dur-fast) var(--ease-precise),
				background-color var(--dur-fast) var(--ease-precise);

			&:last-child {
				border-inline-end: none;
			}

			&:hover {
				color: var(--ink-mute);
			}

			&.active {
				color: var(--accent);
				background: color-mix(in srgb, var(--accent) 8%, transparent);
				box-shadow: inset 0 -2px 0 var(--accent);
			}
		}
	}

	.instrument-stage {
		position: relative;
	}

	.stage-svg {
		border: none;
		padding: var(--space-4);
		animation: stage-in 460ms var(--ease-kinetic) both;
	}

	/* Entrance choreography, replayed on every switch via {#key}.
	   Opacity ONLY — the compiler positions nodes with a `transform`
	   attribute, so a CSS transform here would clobber the layout. */
	.stage-svg :global([data-node-id]) {
		animation: fade-in 560ms var(--ease-kinetic) both;
	}

	.stage-svg :global([data-wire-source]) {
		animation: fade-in 680ms var(--ease-kinetic) 140ms both;
	}

	@keyframes stage-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.99);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.stage-badge {
		position: absolute;
		inset-block-start: var(--space-3);
		inset-inline-end: var(--space-3);
		padding: 0.1rem 0.4rem;
		background: color-mix(in srgb, var(--bg-panel) 80%, transparent);
		backdrop-filter: blur(4px);
	}

	.instrument-metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin: 0;
		background: var(--line);
		border-block: 1px solid var(--line);

		& div {
			background: var(--bg-panel);
			padding: var(--space-2) var(--space-3);
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

	.stage-src {
		border: none;
		max-block-size: 208px;
		font-size: var(--text-xs);
		animation: crossfade var(--dur-med) var(--ease-precise) both;
	}

	/* ---------- Shared section chrome ---------- */
	.section-head {
		margin-block-end: var(--space-6);

		& h2 {
			font-size: var(--text-lg);
			letter-spacing: -0.02em;
			max-inline-size: 30ch;
		}
	}

	.section-eyebrow {
		display: block;
		color: var(--accent);
		margin-block-end: var(--space-2);
	}

	/* ---------- Pipeline stepper ---------- */
	.stepper {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-6) var(--space-5);
	}

	.step {
		display: grid;
		gap: var(--space-3);
		align-content: start;

		& h3 {
			font-family: var(--font-mono);
			font-size: var(--text-md);
			color: var(--ink);
		}

		& p {
			margin: 0;
			font-size: var(--text-sm);
			color: var(--ink-mute);
			max-inline-size: 30ch;
		}
	}

	.step-rail {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.step-disc {
		flex: none;
		inline-size: 2.25rem;
		block-size: 2.25rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--accent);
		background: var(--bg-inset);
		animation: disc-pop 520ms var(--ease-kinetic) backwards;
		animation-delay: calc(var(--i) * 130ms + 120ms);
	}

	/* The signal flowing through the compiler, made literal. */
	.step-line {
		flex: 1;
		block-size: 1px;
		background: linear-gradient(90deg, var(--accent), var(--line) 55%);
		background-size: 220% 100%;
		animation: signal-flow 2.6s linear infinite;
	}

	.step:last-child .step-line {
		display: none;
	}

	@keyframes disc-pop {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes signal-flow {
		from {
			background-position: 120% 0;
		}
		to {
			background-position: -120% 0;
		}
	}

	/* ---------- Features bento ---------- */
	.feature-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-3);
	}

	.feature {
		padding: clamp(var(--space-4), 2.5vw, var(--space-6));
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-block-size: 172px;
		transition:
			border-color var(--dur-kinetic) var(--ease-kinetic),
			transform var(--dur-kinetic) var(--ease-kinetic);

		&:hover {
			border-color: var(--line-strong);
			transform: translateY(-3px);
		}

		& .feature-n {
			color: var(--accent);
		}

		& h3 {
			font-size: var(--text-md);
		}

		& p {
			margin: 0;
			color: var(--ink-mute);
			font-size: var(--text-sm);
		}
	}

	.feature[data-span='3'] {
		grid-column: span 3;
	}

	.feature[data-span='2'] {
		grid-column: span 2;
	}

	.feature[data-span='6'] {
		grid-column: span 6;
	}

	.feature-limits {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		gap: clamp(var(--space-4), 3vw, var(--space-8));
		align-items: center;

		& .limits-copy {
			display: grid;
			gap: var(--space-2);
			align-content: start;
		}
	}

	.limits-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin: 0;
		background: var(--line);
		border: 1px solid var(--line);

		& div {
			background: var(--bg-inset);
			padding: var(--space-3);
			display: grid;
			gap: var(--space-1);
		}

		& dd {
			margin: 0;
			font-size: var(--text-lg);
			color: var(--accent);
			font-variant-numeric: tabular-nums;
		}

		& dt {
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			letter-spacing: var(--tracking-wide);
			text-transform: uppercase;
			color: var(--ink-faint);
		}
	}

	/* ---------- Footer ---------- */
	.landing-foot {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding-block: var(--space-6);
	}

	/* ---------- Responsive ---------- */
	@media (max-width: 960px) {
		.hero {
			grid-template-columns: 1fr;
		}

		.stepper {
			grid-template-columns: 1fr 1fr;
		}

		.step-line {
			display: none;
		}

		.feature[data-span='3'] {
			grid-column: span 3;
		}

		.feature[data-span='2'],
		.feature[data-span='6'] {
			grid-column: span 6;
		}

		.feature-limits {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 620px) {
		.stepper {
			grid-template-columns: 1fr;
		}

		.instrument-metrics,
		.limits-grid {
			grid-template-columns: 1fr 1fr;
		}

		.feature[data-span='3'],
		.feature[data-span='2'],
		.feature[data-span='6'] {
			grid-column: 1 / -1;
		}
	}
</style>
