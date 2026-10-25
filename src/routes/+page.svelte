<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import Pronounce from '#lib/components/Pronounce.svelte';
	import { trackInteraction } from '#lib/telemetry.ts';

	let { data }: PageProps = $props();

	/* ---------- Figure 1: one circuit, three views ---------- */
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
	 * `data-net-id`. The drawing is the compiler's markup, which Svelte cannot
	 * bind into, so focus is state turned into a stylesheet keyed on those
	 * attributes: nothing is queried, nothing is redrawn, and it holds whether or
	 * not the drawing is mounted.
	 */
	let focusLine = $state<number | undefined>(undefined);
	let focusNet = $state<string | undefined>(undefined);

	const focusLines = $derived(
		focusLine !== undefined
			? [focusLine]
			: focusNet === undefined
				? undefined
				: (data.hero.nets.find((entry) => entry.id === focusNet)?.lines ?? [])
	);
	const focusStyle = $derived.by(() => {
		if (focusLines === undefined) return '';
		const lit = focusLines
			.filter(Number.isInteger)
			.map((line) => `[data-source-line="${line}"]`)
			.join(',');
		const host = '[data-hero-drawing]';
		const dim = lit === '' ? '' : `:not(${lit})`;
		const bold = lit === '' ? '' : `${host} :is(${lit}) .schematic-trace{stroke-width:2.6}`;
		return `<style>${host} [data-source-line]${dim}{opacity:.14}${bold}</style>`;
	});

	/* A net chosen in the netlist view is traced back on the drawing. */
	function traceNet(id: string): void {
		focusLine = undefined;
		focusNet = id;
		view = 'split';
	}

	/* ---------- Installation ---------- */
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
			/* Clipboard unavailable: the command stays visible to select. */
		}
	}

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: '@schemd/core',
			alternateName: 'schemd',
			description:
				'A text-to-schematic compiler with no dependencies. It turns lines of text into routed, accessible, deterministic SVG drawings of electrical, digital, quantum and UML diagrams.',
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
	title="schemd: text-to-schematic compiler"
	description="schemd (pronounced “skemd”) compiles lines of text into routed, accessible, deterministic SVG drawings of electrical, digital, quantum and UML diagrams. No dependencies, Node 24 or newer."
	canonicalPath="/"
	{jsonLd}
/>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from integer line numbers only -->
	{@html focusStyle}
</svelte:head>

<article class="front page">
	<header class="title">
		<h1>Schematics from plain text</h1>
		<p class="lede">
			Write one part or one wire per line. schemd places the parts, routes the wires and draws the
			SVG.
		</p>
		<Pronounce />
	</header>

	<figure class="figure instrument" aria-label="One circuit, three views">
		<div class="views" role="tablist" aria-label="Compiler views">
			{#each VIEWS as option (option.id)}
				<button
					type="button"
					role="tab"
					aria-selected={view === option.id}
					onclick={() => (view = option.id)}>{option.label}</button
				>
			{/each}
		</div>

		<div class="figure-body">
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
									onmouseenter={() => ((focusNet = undefined), (focusLine = line.n))}
									onfocus={() => ((focusNet = undefined), (focusLine = line.n))}
									onblur={() => (focusLine = undefined)}
								>
									<span class="visually-hidden">Trace line</span>
									<span class="n">{line.n}</span>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -- tokenizer output, escaped -->
									<code>{@html line.html}</code>
								</button>
							</li>
						{/each}
					</ol>
					<div class="drawing" data-hero-drawing data-schematic-host>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
						{@html data.hero.svg}
					</div>
				</div>
			{:else if view === 'netlist'}
				<div class="netlist">
					<p class="table-caption">
						Table 2. Nets of the figure, from <code>buildNetlist</code>
					</p>
					<table class="spec">
						<thead>
							<tr>
								<th scope="col">Net</th>
								<th scope="col">Terminals</th>
								<th scope="col">Lines</th>
							</tr>
						</thead>
						<tbody>
							{#each data.hero.nets as net (net.id)}
								<tr>
									<td>
										<button
											type="button"
											class="net-id"
											onclick={() => traceNet(net.id)}
											aria-label={`Trace net ${net.id} on the drawing`}>{net.id}</button
										>
									</td>
									<td><code>{net.terminals.join(', ')}</code></td>
									<td class="tabular">{net.lines.join(', ')}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="note">
						{data.hero.issues === 0
							? 'verifyNetlist reports no problems with this circuit.'
							: `verifyNetlist reports ${data.hero.issues} findings.`}
					</p>
				</div>
			{:else}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre class="svg-out" tabindex="0" aria-label="The beginning of the compiled SVG">{data.hero
						.svgHead}</pre>
			{/if}
		</div>

		<figcaption>
			<b>Figure 1.</b>
			{data.hero.title}: {data.hero.components} parts on {data.hero.nets.length} nets, compiled in {data
				.hero.ms} ms. Hover a line to find its wire.
		</figcaption>
	</figure>

	<div class="start">
		<div class="install">
			<div class="seg" role="tablist" aria-label="Package manager">
				{#each MANAGERS as manager (manager)}
					<button
						type="button"
						role="tab"
						aria-selected={pm === manager}
						onclick={() => (pm = manager)}>{manager}</button
					>
				{/each}
			</div>
			<div class="command">
				<code>{installCmd}</code>
				<button type="button" class="copy" onclick={copyInstall} aria-label="Copy install command">
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>
		<div class="actions">
			<a class="btn btn-solid" href={`/playground/${data.latest}`}>Open the playground</a>
			<a class="btn" href={`/docs/${data.latest}/overview`}>Read the documentation</a>
		</div>
	</div>

	<section aria-labelledby="draws">
		<h2 id="draws"><span class="num">1</span> What it draws</h2>
		<div class="triple">
			{#each data.families as family, index (family.id)}
				<figure class="figure">
					<div class="figure-body">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
						{@html family.svg}
					</div>
					<figcaption>
						<b>Figure {index + 2}.</b>
						{family.title}.
						<code class="line">{family.line}</code>
					</figcaption>
				</figure>
			{/each}
		</div>
		<div class="pair">
			<figure class="figure">
				<div class="figure-body compare">
					<div>
						<p class="tag">0.8</p>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- archived compiler output -->
						{@html data.junction08}
					</div>
					<div>
						<p class="tag">{data.latest}</p>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
						{@html data.figures['junction']}
					</div>
				</div>
				<figcaption>
					<b>Figure {data.families.length + 2}.</b> Three wires to one junction, then and now.
				</figcaption>
			</figure>
			<figure class="figure">
				<div class="figure-body">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
					{@html data.figures['crossing']}
				</div>
				<figcaption>
					<b>Figure {data.families.length + 3}.</b> Separate nets bridge where they cross.
				</figcaption>
			</figure>
		</div>
	</section>

	<section aria-labelledby="glance">
		<h2 id="glance"><span class="num">2</span> At a glance</h2>
		<table class="spec glance">
			<tbody>
				<tr>
					<th scope="row">Package</th>
					<td><code>@schemd/core</code> {data.latest}</td>
				</tr>
				<tr>
					<th scope="row">Component kinds</th>
					<td><a href="/components">{data.evidence.kinds}</a></td>
				</tr>
				<tr>
					<th scope="row">Runs on</th>
					<td>Node.js 24 or newer, browsers, web workers</td>
				</tr>
				<tr>
					<th scope="row">Dependencies</th>
					<td>None</td>
				</tr>
				<tr>
					<th scope="row">Output</th>
					<td>The same SVG bytes on every engine</td>
				</tr>
				<tr>
					<th scope="row">Design rules</th>
					<td>
						<a href="/conformance">{data.evidence.clean} of {data.evidence.diagrams}</a> documentation
						diagrams pass
					</td>
				</tr>
				<tr>
					<th scope="row">Licence</th>
					<td>MIT</td>
				</tr>
			</tbody>
		</table>
	</section>
</article>

<style>
	.front {
		padding-block: var(--space-8) var(--space-16);
	}

	.title {
		margin-block-end: var(--space-8);

		/* Measured in the heading's own characters, so it breaks as a title. */
		& h1 {
			max-inline-size: 24ch;
			margin-block-end: var(--space-3);
		}

		& .lede {
			margin: 0 0 var(--space-2);
			font-size: var(--text-md);
			line-height: 1.45;
			color: var(--ink-mute);
		}
	}

	section {
		margin-block-start: var(--space-12);
	}

	h2 {
		font-size: var(--text-lg);
		padding-block-start: var(--space-2);
		border-block-start: 2px solid var(--ink);
		margin-block-end: var(--space-3);
	}

	/* Section numbers are the datasheet's own sequence. */
	.num {
		display: inline-block;
		min-inline-size: 2.2em;
		font-variant-numeric: tabular-nums;
	}

	p {
		max-inline-size: var(--measure);
	}

	/* ---------- Figure 1 ---------- */
	.views {
		display: flex;
		gap: var(--space-6);
		margin-block-end: var(--space-2);

		& button {
			font-stretch: var(--width-table);
			font-weight: 600;
			color: var(--ink-mute);
			padding-block-end: var(--space-1);
			border-block-end: 3px solid transparent;

			&[aria-selected='true'] {
				color: var(--ink);
				border-block-end-color: var(--ink);
			}
		}
	}

	.split {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: var(--space-4);
		align-items: start;
	}

	.source {
		list-style: none;
		margin: 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.55;
		overflow-x: auto;
	}

	.ln {
		display: flex;
		min-block-size: 24px;
		gap: var(--space-3);
		inline-size: 100%;
		text-align: start;
		padding-inline: var(--space-1);
		white-space: pre;

		&.on,
		&:focus-visible {
			background: var(--bg);
		}

		& .n {
			min-inline-size: 2ch;
			text-align: end;
			color: var(--ink-mute);
			font-variant-numeric: tabular-nums;
		}

		& code {
			font-size: inherit;
		}
	}

	.drawing :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
	}

	.drawing :global(figure),
	.figure-body :global(figure) {
		margin: 0;
	}

	.drawing :global(figcaption),
	.figure-body :global(figure > figcaption) {
		display: none;
	}

	.netlist .table-caption {
		margin-block-start: 0;
	}

	.net-id {
		font-weight: 700;
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.note {
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.svg-out {
		margin: 0;
		max-block-size: 420px;
		overflow: auto;
		font-size: 0.8125rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	/* ---------- What it draws ---------- */
	.pair {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		gap: var(--space-6);
		margin-block-start: var(--space-6);
	}

	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);

		& .tag {
			margin: 0 0 var(--space-1);
			font-stretch: var(--width-table);
			font-size: var(--text-sm);
			font-weight: 700;
		}
	}

	.figure-body :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
	}

	.triple {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-6);

		& .line {
			display: block;
			margin-block-start: var(--space-1);
			font-size: 0.8125rem;
			color: var(--ink);
			overflow-wrap: anywhere;
		}
	}

	.glance {
		max-inline-size: 760px;

		& th {
			inline-size: 12rem;
			font-weight: 600;
		}
	}

	/* ---------- Install, under Figure 1 ---------- */
	.install {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
		margin-block: var(--space-4);
	}

	.command {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		background: var(--wash);

		& code {
			font-size: 0.9375rem;
		}
	}

	.copy {
		font-stretch: var(--width-table);
		font-weight: 600;
		color: var(--accent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-block: var(--space-6) var(--space-4);
	}

	@media (max-width: 900px) {
		.split,
		.pair {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}

		.triple {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
