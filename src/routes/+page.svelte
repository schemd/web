<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import Pronounce from '$lib/components/Pronounce.svelte';
	import SheetFrame from '$lib/components/SheetFrame.svelte';
	import { trackInteraction } from '$lib/telemetry';

	let { data }: PageProps = $props();

	/* ---------- The instrument: one circuit, three views ---------- */
	type View = 'split' | 'netlist' | 'svg';
	const VIEWS: readonly { id: View; label: string }[] = [
		{ id: 'split', label: 'Source + drawing' },
		{ id: 'netlist', label: 'Netlist' },
		{ id: 'svg', label: 'SVG out' }
	];
	let view = $state<View>('split');

	/*
	 * Linking a line to its copper uses the compiler's own source map: every
	 * part and wire in full mode carries `data-source-line`, and every wire its
	 * `data-net-id`. The drawing is the compiler's DOM, so focus is applied by
	 * toggling a class on what it emitted — nothing is redrawn.
	 */
	let focusLine = $state<number | undefined>(undefined);
	let focusNet = $state<string | undefined>(undefined);
	let drawing = $state<HTMLDivElement | undefined>(undefined);
	let replay = $state(0);

	$effect(() => {
		const root = drawing;
		const line = focusLine;
		const net = focusNet;
		void replay;
		if (root === undefined) return;
		const lines =
			net === undefined
				? undefined
				: new Set(data.hero.nets.find((entry) => entry.id === net)?.lines ?? []);
		for (const element of root.querySelectorAll<SVGElement>('[data-source-line]')) {
			const at = Number(element.dataset['sourceLine']);
			const lit =
				line === undefined && lines === undefined
					? true
					: line !== undefined
						? at === line
						: lines!.has(at);
			element.classList.toggle('is-dim', !lit);
			element.classList.toggle('is-lit', (line !== undefined || lines !== undefined) && lit);
		}
	});

	/* A net chosen in the netlist view is traced back on the drawing. */
	function traceNet(id: string): void {
		focusLine = undefined;
		focusNet = id;
		view = 'split';
	}

	/* ---------- Install line ---------- */
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
			trackInteraction('copy_install');
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* Clipboard unavailable — the command stays visible to select. */
		}
	}

	const modes = $derived([
		{
			route: `/docs/${data.latest}/overview`,
			path: '/docs',
			name: 'Read',
			body: 'Prose beside a live figure for each section, compiled from the fence you are reading.'
		},
		{
			route: `/playground/${data.latest}`,
			path: '/playground',
			name: 'Write',
			body: 'Source and drawing linked line to wire through the source map; every diagnostic underlined at once.'
		},
		{
			route: `/inspector/${data.latest}`,
			path: '/inspector',
			name: 'Inspect',
			body: "Nets, placements and per-cell congestion from the compiler's own routing report."
		},
		{
			route: `/simulations/${data.latest}`,
			path: '/simulations',
			name: 'Simulate',
			body: 'Signals travel along the routed copper; faults dim the nets they break.'
		},
		{
			route: `/diff/${data.latest}`,
			path: '/diff',
			name: 'Compare',
			body: 'Two releases overlaid from their text snapshots, so a routing change reviews as moved coordinates.'
		}
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
</script>

<Seo
	title="schemd — write the circuit, get the drawing"
	description="schemd (pronounced “skemd”, /skɛmd/) compiles plain-text schematics, logic, quantum circuits, and UML into routed, accessible, deterministic SVG. Zero dependencies, Node 24+."
	canonicalPath="/"
	{jsonLd}
/>

<article class="landing">
	<div class="wrap">
		<SheetFrame label="Introduction" scan>
			<div class="hero">
				<div class="hero-copy">
					<p class="microlabel">
						Text → schematic · <span class="copper">v{data.latest}</span> · MIT
					</p>
					<h1>Write the circuit. <em>Get the drawing.</em></h1>
					<div class="hero-pronounce">
						<span class="hero-brand">schemd</span>
						<Pronounce />
					</div>
					<p class="lede">
						A few lines of plain text become a routed, deterministic SVG schematic — electrical,
						digital, quantum and UML — on a server, in a build, or in a browser worker, with no
						dependencies.
					</p>
					<div class="actions">
						<a class="btn btn-solid" href={`/playground/${data.latest}`}>Open the playground</a>
						<a class="btn" href={`/docs/${data.latest}/overview`}>Read the docs</a>
					</div>
					<div class="install">
						<div class="pm-tabs" role="tablist" aria-label="Package manager">
							{#each MANAGERS as manager (manager)}
								<button
									type="button"
									role="tab"
									aria-selected={pm === manager}
									onclick={() => (pm = manager)}>{manager}</button
								>
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
								{copied ? 'copied' : 'copy'}
							</button>
						</div>
					</div>
				</div>

				<figure class="instrument" aria-label="One circuit, three views">
					<div class="inst-head">
						<div class="seg-tabs" role="tablist" aria-label="Compiler views">
							{#each VIEWS as option (option.id)}
								<button
									type="button"
									role="tab"
									aria-selected={view === option.id}
									onclick={() => (view = option.id)}>{option.label}</button
								>
							{/each}
						</div>
						<span class="microlabel file">filter.schemd</span>
					</div>

					{#if view === 'split'}
						<div class="split">
							<ol
								class="source"
								aria-label="Source; hover or focus a line to trace it"
								onmouseleave={() => (focusLine = undefined)}
							>
								{#each data.hero.lines as line (line.n)}
									<li>
										<button
											type="button"
											class="ln"
											class:on={focusLine === line.n}
											aria-label={`Trace line ${line.n}`}
											onmouseenter={() => ((focusNet = undefined), (focusLine = line.n))}
											onfocus={() => ((focusNet = undefined), (focusLine = line.n))}
											onblur={() => (focusLine = undefined)}
										>
											<span class="n" aria-hidden="true">{line.n}</span>
											<code>{@html line.html}</code>
										</button>
									</li>
								{/each}
							</ol>
							{#key replay}
								<div class="drawing trace-on" bind:this={drawing} data-schematic-host>
									{@html data.hero.svg}
								</div>
							{/key}
						</div>
					{:else if view === 'netlist'}
						<div class="netlist">
							<p class="microlabel">
								buildNetlist · {data.hero.nets.length} nets · verifyNetlist: {data.hero.issues === 0
									? 'no rule fired'
									: `${data.hero.issues} findings`}
							</p>
							<ul>
								{#each data.hero.nets as net (net.id)}
									<li>
										<button
											type="button"
											class="net-row"
											onclick={() => traceNet(net.id)}
											aria-label={`Trace net ${net.id} on the drawing`}
										>
											<span class="net-id">{net.id}</span>
											<span class="net-terms">{net.terminals.join(' · ')}</span>
											<span class="microlabel">lines {net.lines.join(', ')}</span>
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{:else}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<pre class="svg-out" tabindex="0" aria-label="The beginning of the compiled SVG">{data
								.hero.svgHead}</pre>
					{/if}

					<div class="strip">
						<ol class="stages" aria-label="Compiler passes">
							<li style="--s: 0">Parse</li>
							<li style="--s: 1">Place</li>
							<li style="--s: 2">Route by net</li>
							<li style="--s: 3">Emit</li>
						</ol>
						<dl class="metrics">
							<div>
								<dt>compile</dt>
								<dd>{data.hero.ms} ms</dd>
							</div>
							<div>
								<dt>parts</dt>
								<dd>{data.hero.components}</dd>
							</div>
							<div>
								<dt>nets</dt>
								<dd>{data.hero.nets.length}</dd>
							</div>
							<div>
								<dt>svg</dt>
								<dd>{(data.hero.svgBytes / 1024).toFixed(1)} KB</dd>
							</div>
						</dl>
						<button type="button" class="replay microlabel" onclick={() => (replay += 1)}
							>Replay routing</button
						>
					</div>
				</figure>
			</div>
		</SheetFrame>

		<section class="sec" aria-labelledby="routing-h">
			<p class="eyebrow">C4 · Routing</p>
			<h2 id="routing-h">Routed the way a draughtsman would route it.</h2>
			<p class="sub">
				Every net is grown as one tree on an integer lattice, contention is negotiated away, and the
				same source gives the same bytes on every engine.
			</p>
			<div class="cards">
				<article class="card plate-marks">
					<div
						class="card-fig compare"
						aria-label="The same junction drawn by 0.8 and by the current release"
					>
						<div class="old">
							<span class="microlabel tag">0.8</span>
							<div class="fig">{@html data.junction08}</div>
						</div>
						<div class="new trace-on">
							<span class="microlabel tag copper">{data.latest}</span>
							<div class="fig">{@html data.figures['junction']}</div>
						</div>
					</div>
					<div class="card-body">
						<p class="microlabel">Trees, not detours</p>
						<h3>Wires meet where you put the junction</h3>
						<p>
							Three wires written to <code>N1</code> run straight into it. 0.8 pulled each one out through
							a stub on the left first.
						</p>
					</div>
				</article>
				<article class="card plate-marks">
					<div class="card-fig"><div class="fig">{@html data.figures['crossing']}</div></div>
					<div class="card-body">
						<p class="microlabel">Contact is meaning</p>
						<h3>Bridges where nets cross, dots where they join</h3>
						<p>
							Separate nets never touch: the vertical run hops. Wires of one net that cross are one
							node, so the crossing gets a dot.
						</p>
					</div>
				</article>
				<article class="card plate-marks">
					<div class="card-fig">
						<svg
							class="negotiate"
							viewBox="0 0 320 200"
							role="img"
							aria-label="Two nets contend for a channel; one is rerouted around the part"
						>
							<rect x="128" y="74" width="64" height="52" rx="3" class="part" />
							<path d="M 30 60 H 290" class="held" />
							<path d="M 30 140 H 110 V 60 H 210 V 140 H 290" class="contest" />
							<path d="M 30 140 H 110 V 168 H 210 V 140 H 290" pathLength="1" class="settle" />
						</svg>
					</div>
					<div class="card-body">
						<p class="microlabel">Negotiated, then exact</p>
						<h3>Contention priced away, in integers</h3>
						<p>
							Nets that fight for a channel are torn up and rerouted with the price raised. Every
							coordinate is an integer milli-unit, so nothing drifts.
						</p>
					</div>
				</article>
			</div>
		</section>

		<section class="sec" aria-labelledby="families-h">
			<p class="eyebrow">D2 · Vocabulary</p>
			<h2 id="families-h">One language, four families.</h2>
			<p class="sub">
				The same declarations draw a filter, a flip-flop, a Bell pair or a class diagram. Every kind
				comes from the compiler's registry, so these pages never fall behind it.
			</p>
			<div class="families">
				<article class="card family-electrical">
					<div class="card-fig text">
						<p class="microlabel copper">Electrical</p>
						<p class="family-claim">
							Passives, sources, amplifiers, switches and junctions — drawn on the sheet above.
						</p>
					</div>
					<div class="card-body">
						<code class="snip">amplifier:U1 "OPA192" at (560, 173) #purple [type=opamp]</code>
					</div>
				</article>
				{#each data.families as family (family.id)}
					<article class="card">
						<div class="card-fig"><div class="fig">{@html family.svg}</div></div>
						<div class="card-body">
							<p class="microlabel">{family.family}</p>
							<code class="snip">{family.line}</code>
						</div>
					</article>
				{/each}
			</div>
		</section>

		<section class="sec" aria-labelledby="proof-h">
			<p class="eyebrow">E6 · Evidence</p>
			<h2 id="proof-h">Proof, not promises.</h2>
			<p class="sub">
				Every figure here is measured from the compiler this page runs, or read from the evidence
				pages.
			</p>
			<dl class="proof">
				<div>
					<dt>component kinds</dt>
					<dd>{data.evidence.kinds}</dd>
					<dd class="more"><a href="/coverage">language coverage →</a></dd>
				</div>
				<div>
					<dt>documentation diagrams pass every design rule</dt>
					<dd>{data.evidence.clean}<small>/{data.evidence.diagrams}</small></dd>
					<dd class="more"><a href="/conformance">conformance →</a></dd>
				</div>
				<div>
					<dt>to compile the filter at the top</dt>
					<dd class="copper">{data.hero.ms}<small> ms</small></dd>
				</div>
				<div>
					<dt>of SVG for it, byte-identical on every engine</dt>
					<dd>{(data.hero.svgBytes / 1024).toFixed(1)}<small> KB</small></dd>
				</div>
				<div>
					<dt>runtime dependencies; no DOM, canvas or fonts</dt>
					<dd>0</dd>
				</div>
				<div>
					<dt>releases tracked</dt>
					<dd>{data.evidence.releases}</dd>
					<dd class="more"><a href="/changelog">changelog →</a></dd>
				</div>
			</dl>
		</section>

		<section class="sec" aria-labelledby="modes-h">
			<p class="eyebrow">F3 · The site</p>
			<h2 id="modes-h">One sheet, five modes.</h2>
			<p class="sub">
				Every page shares the frame: zone rulers to find your place, a title block for state, copper
				for motion. The frame adapts to the work.
			</p>
			<nav class="modes" aria-label="Site modes">
				{#each modes as mode (mode.name)}
					<a class="mode" href={mode.route}>
						<span class="route">{mode.path}</span>
						<span class="mode-name">{mode.name}</span>
						<span class="mode-body">{mode.body}</span>
					</a>
				{/each}
			</nav>
		</section>
	</div>
</article>

<style>
	.landing {
		padding-block: var(--space-8) 0;
	}

	.wrap {
		max-inline-size: 1360px;
		margin-inline: auto;
		padding-inline: clamp(1rem, 3vw, 2.5rem);
	}

	.copper {
		color: var(--accent);
	}

	/* ---------- Hero ---------- */
	.hero {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-12) clamp(2rem, 4vw, 3.5rem);
		align-items: flex-start;
		padding: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 3.5vw, 3.5rem);
	}

	.hero-copy {
		flex: 1 1 340px;
		min-inline-size: 0;
		max-inline-size: 430px;
	}

	h1 {
		margin: var(--space-5) 0;
		font-size: clamp(2.6rem, 4.4vw, 4.25rem);
		line-height: 0.98;
		letter-spacing: -0.03em;

		& em {
			font-style: normal;
			color: var(--accent);
		}
	}

	.hero-pronounce {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
		margin-block-end: var(--space-5);
	}

	.hero-brand {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--accent);
		font-size: var(--text-md);
	}

	.lede {
		margin: 0 0 var(--space-8);
		font-size: 1.1875rem;
		line-height: 1.55;
		color: var(--ink-mute);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);

		& .btn {
			min-block-size: 48px;
		}
	}

	.install {
		margin-block-start: var(--space-8);
		max-inline-size: 380px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--bg-inset);
		overflow: hidden;
	}

	.pm-tabs {
		display: flex;
		border-block-end: 1px solid var(--line);

		& button {
			flex: 1;
			min-block-size: 36px;
			font-family: var(--font-label);
			font-size: 0.625rem;
			letter-spacing: 0.06em;
			color: var(--ink-faint);

			&[aria-selected='true'] {
				color: var(--accent);
				box-shadow: inset 0 -2px 0 var(--accent);
			}
		}
	}

	.pm-line {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);

		& code {
			flex: 1;
			font-size: var(--text-sm);
			color: var(--ink);
		}
	}

	.pm-prompt {
		color: var(--ink-faint);
	}

	.pm-copy {
		min-block-size: 36px;
		padding-inline: var(--space-3);
		border-radius: var(--radius-sm);

		&:hover {
			color: var(--accent);
		}
	}

	/* ---------- Instrument ---------- */
	.instrument {
		flex: 999 1 640px;
		min-inline-size: 0;
		margin: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-lg);
		background: var(--bg-inset);
		overflow: hidden;
		box-shadow: var(--shadow-plate);
	}

	.inst-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-block-end: 1px solid var(--line);

		& .file {
			margin-inline-start: auto;
			padding-inline-end: var(--space-2);
		}
	}

	.seg-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;

		& button {
			min-block-size: 38px;
			padding-inline: var(--space-4);
			border-radius: var(--radius-sm);
			font-family: var(--font-label);
			font-size: 0.6875rem;
			letter-spacing: 0.05em;
			text-transform: uppercase;
			color: var(--ink-faint);

			&[aria-selected='true'] {
				background: var(--bg-raised);
				color: var(--ink);
			}

			&:hover {
				color: var(--ink);
			}
		}
	}

	.split {
		display: flex;
		flex-wrap: wrap;
	}

	/* The drawing is the point; the source is its legend, scrolled sideways. */
	.source {
		flex: 1 1 240px;
		min-inline-size: 0;
		max-inline-size: 320px;
		max-block-size: 520px;
		margin: 0;
		padding: var(--space-3) 0;
		list-style: none;
		overflow: auto;
		border-inline-end: 1px solid var(--line);
	}

	/* 24 px rows: each line is a touch target as well as a legend entry. */
	.ln {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		inline-size: 100%;
		min-block-size: 24px;
		padding: 0 var(--space-4) 0 0;
		text-align: start;
		white-space: pre;
		font-size: 0.74rem;
		line-height: 1.72;
		border-inline-start: 2px solid transparent;

		&:hover,
		&:focus-visible,
		&.on {
			background: var(--bg-raised);
			border-inline-start-color: var(--accent);
			outline: none;
		}

		& .n {
			flex: none;
			inline-size: 2.4em;
			text-align: end;
			color: var(--ink-faint);
			font-family: var(--font-mono);
		}

		& code {
			font-size: inherit;
		}
	}

	.drawing {
		/* Drawn straight onto the sheet, not onto its own panel. */
		--schematic-surface: transparent;
		flex: 2 1 380px;
		min-inline-size: 0;
		display: flex;
		align-items: center;
		padding: var(--space-4) var(--space-3);

		& :global(figure.schematic-frame) {
			margin: 0;
			inline-size: 100%;
		}

		& :global(figcaption),
		& :global(.schematic-grid) {
			display: none;
		}

		& :global(svg) {
			display: block;
			inline-size: 100%;
			block-size: auto;
		}

		& :global([data-source-line]) {
			transition: opacity var(--dur-med) var(--ease-precise);
		}

		& :global(.is-dim) {
			opacity: 0.14;
		}

		& :global(.is-lit .schematic-trace) {
			stroke-width: 2.6;
			filter: drop-shadow(0 0 5px currentColor);
		}
	}

	.netlist {
		padding: var(--space-4);

		& ul {
			display: grid;
			gap: var(--space-2);
			margin: var(--space-3) 0 0;
			padding: 0;
			list-style: none;
		}
	}

	.net-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2) var(--space-4);
		inline-size: 100%;
		min-block-size: 48px;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--bg-panel);
		text-align: start;

		&:hover,
		&:focus-visible {
			border-color: var(--accent);
		}
	}

	.net-id {
		inline-size: 2.5em;
		font-family: var(--font-mono);
		color: var(--accent);
	}

	.net-terms {
		flex: 1 1 260px;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	.svg-out {
		margin: 0;
		padding: var(--space-4);
		max-block-size: 540px;
		overflow: auto;
		font-size: 0.75rem;
		line-height: 1.7;
		color: var(--ink-mute);
		white-space: pre;
	}

	.strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
		padding: var(--space-3) var(--space-4);
		border-block-start: 1px solid var(--line);
	}

	.stages {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		margin: 0;
		padding: 0;
		list-style: none;

		& li {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			font-family: var(--font-label);
			font-size: 0.65rem;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--ink-faint);

			&::before {
				content: '';
				inline-size: 7px;
				block-size: 7px;
				border-radius: 50%;
				background: var(--accent);
				animation: stage-on 900ms var(--ease-kinetic) both;
				animation-delay: calc(var(--s) * 260ms);
			}
		}
	}

	@keyframes stage-on {
		from {
			background: var(--line-strong);
			box-shadow: none;
		}
		60% {
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
		}
		to {
			background: var(--accent);
		}
	}

	.metrics {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-5);
		margin: 0 0 0 auto;

		& div {
			display: flex;
			gap: var(--space-2);
			align-items: baseline;
		}

		& dt {
			font-family: var(--font-label);
			font-size: 0.6rem;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--ink-faint);
		}

		& dd {
			margin: 0;
			font-family: var(--font-mono);
			font-size: var(--text-sm);
			color: var(--ink);
		}
	}

	.replay {
		min-block-size: 36px;
		padding-inline: var(--space-3);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);

		&:hover {
			border-color: var(--accent);
			color: var(--accent);
		}
	}

	/* ---------- Sections ---------- */
	.sec {
		padding-block-start: clamp(4.5rem, 9vw, 7.5rem);
	}

	h2 {
		max-inline-size: 820px;
		margin: var(--space-4) 0;
		font-size: clamp(2.1rem, 3.6vw, 3.25rem);
		line-height: 1.04;
	}

	.sub {
		margin: 0;
		max-inline-size: 680px;
		font-size: var(--text-md);
		line-height: 1.6;
		color: var(--ink-mute);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-5);
		margin-block-start: var(--space-12);
	}

	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-lg);
		background: var(--bg-panel);
		overflow: hidden;
	}

	.card-fig {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		block-size: 250px;
		padding: var(--space-4);
		border-block-end: 1px solid var(--line);
		background-image: radial-gradient(var(--grid-dot) 1px, transparent 1px);
		background-size: 20px 20px;

		&.text {
			flex-direction: column;
			align-items: flex-start;
			justify-content: center;
			gap: var(--space-3);
			padding: var(--space-8);
		}
	}

	.fig {
		--schematic-surface: transparent;
		inline-size: 100%;
		block-size: 100%;
		display: flex;
		align-items: center;
		justify-content: center;

		& :global(figure.schematic-frame) {
			margin: 0;
			inline-size: 100%;
			block-size: 100%;
			display: flex;
			align-items: center;
		}

		& :global(figcaption) {
			display: none;
		}

		& :global(svg) {
			display: block;
			inline-size: 100%;
			block-size: 100%;
			max-block-size: 220px;
		}
	}

	.card-body {
		padding: var(--space-5) var(--space-5) var(--space-6);

		& h3 {
			margin: var(--space-2) 0;
			font-size: 1.3rem;
			font-weight: 650;
			letter-spacing: -0.01em;
		}

		& p:not(.microlabel) {
			margin: 0;
			color: var(--ink-mute);
			line-height: 1.55;
		}

		& code {
			font-size: 0.86em;
		}
	}

	.compare {
		& .old,
		& .new {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: var(--space-4);
		}

		& .old {
			animation: compare-old 7s var(--ease-kinetic) infinite both;
		}

		& .new {
			animation: compare-new 7s var(--ease-kinetic) infinite both;
		}

		& .tag {
			position: absolute;
			inset-block-start: var(--space-3);
			inset-inline-start: var(--space-4);
		}

		& :global(svg) {
			max-block-size: 210px;
			color: var(--ink-mute);
		}
	}

	@keyframes compare-old {
		0%,
		42% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0;
		}
	}

	@keyframes compare-new {
		0%,
		44% {
			opacity: 0;
		}
		52%,
		100% {
			opacity: 1;
		}
	}

	.negotiate {
		inline-size: 100%;
		block-size: 100%;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.8;

		& .part {
			stroke: var(--line-strong);
			stroke-width: 1.4;
		}

		& .held {
			stroke: var(--schematic-color-blue);
		}

		& .contest {
			stroke: var(--danger);
			stroke-dasharray: 6 5;
			animation:
				trace-march 1s linear infinite,
				contest 6s var(--ease-kinetic) infinite both;
		}

		& .settle {
			stroke: var(--accent);
			stroke-dasharray: 1 1;
			animation: settle 6s var(--ease-kinetic) infinite both;
		}
	}

	@keyframes contest {
		0%,
		45% {
			opacity: 1;
		}
		55%,
		100% {
			opacity: 0;
		}
	}

	@keyframes settle {
		0%,
		50% {
			stroke-dashoffset: 1;
		}
		72%,
		100% {
			stroke-dashoffset: 0;
		}
	}

	.families {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-5);
		margin-block-start: var(--space-12);
	}

	.family-claim {
		margin: 0;
		max-inline-size: 420px;
		font-size: 1.6rem;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}

	.snip {
		display: block;
		margin-block-start: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--bg-inset);
		font-size: 0.8rem;
		color: var(--ink-mute);
		white-space: pre;
		overflow-x: auto;
	}

	.proof {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		margin: var(--space-12) 0 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-lg);
		background: var(--bg-panel);

		& div {
			display: flex;
			flex-direction: column;
			padding: var(--space-6) var(--space-5);
			border-inline-start: 1px solid var(--line);
		}

		& div:first-child {
			border-inline-start: 0;
		}

		& dd {
			order: -1;
			margin: 0;
			font-size: 2.6rem;
			font-weight: 650;
			letter-spacing: -0.02em;
			line-height: 1;

			& small {
				font-size: 1.1rem;
				color: var(--ink-mute);
			}
		}

		& dt {
			margin-block-start: var(--space-3);
			color: var(--ink-mute);
			font-size: var(--text-sm);
			line-height: 1.45;
		}

		& dd.more {
			order: 0;
			margin-block-start: auto;
			padding-block-start: var(--space-3);
			font-size: var(--text-sm);
			font-weight: 400;
			letter-spacing: normal;
			line-height: 1.4;
		}

		& a {
			color: var(--ink-faint);

			&:hover {
				color: var(--accent);
			}
		}
	}

	.modes {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		margin-block-start: var(--space-12);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.mode {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-5) var(--space-8);
		border-inline-start: 1px solid var(--line);
		background: var(--bg-panel);
		color: var(--ink);
		transition: background-color var(--dur-fast) var(--ease-precise);

		&:first-child {
			border-inline-start: 0;
		}

		&:hover {
			background: var(--bg-raised);
			text-decoration: none;
			box-shadow: inset 0 2px 0 var(--accent);
		}
	}

	.route {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--accent);
	}

	.mode-name {
		margin-block-start: var(--space-2);
		font-size: 1.5rem;
		font-weight: 650;
	}

	.mode-body {
		color: var(--ink-mute);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	@media (max-width: 1100px) {
		.cards {
			grid-template-columns: minmax(0, 1fr);
		}

		.proof {
			grid-template-columns: repeat(3, minmax(0, 1fr));

			& div:nth-child(4) {
				border-inline-start: 0;
			}

			& div:nth-child(n + 4) {
				border-block-start: 1px solid var(--line);
			}
		}

		.modes {
			grid-template-columns: repeat(2, minmax(0, 1fr));

			& .mode {
				border-block-start: 1px solid var(--line);
			}
		}
	}

	@media (max-width: 720px) {
		.families {
			grid-template-columns: minmax(0, 1fr);
		}

		.proof {
			grid-template-columns: repeat(2, minmax(0, 1fr));

			& div {
				border-inline-start: 0 !important;
				border-block-start: 1px solid var(--line);
			}
		}

		.modes {
			grid-template-columns: minmax(0, 1fr);

			& .mode {
				border-inline-start: 0;
			}
		}

		.metrics {
			margin-inline-start: 0;
		}

		/* On a phone the drawing leads; its source scrolls in a short well under it. */
		.drawing {
			order: -1;
			border-block-end: 1px solid var(--line);
		}

		.source {
			max-inline-size: none;
			max-block-size: 240px;
			border-inline-end: 0;
		}

		.inst-head .file {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.compare .old {
			display: none;
		}

		.compare .new,
		.stages li::before,
		.negotiate .contest,
		.negotiate .settle {
			animation: none;
		}

		.negotiate .contest {
			display: none;
		}
	}
</style>
