<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

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
		/* The traced wires get the checker's highlighter: a yellow halo round
		   the copper, the way a net is yellow-lined on a paper drawing. */
		const bold =
			lit === ''
				? ''
				: `${host} :is(${lit}) .schematic-trace{stroke-width:2.6;filter:drop-shadow(0 0 2px var(--mark)) drop-shadow(0 0 3px var(--mark))}`;
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
	title={t('schemd: text-to-schematic compiler')}
	description={t(
		'schemd (pronounced “skemd”) compiles lines of text into routed, accessible, deterministic SVG drawings of electrical, digital, quantum and UML diagrams. No dependencies, Node 24 or newer.'
	)}
	canonicalPath="/"
	{jsonLd}
/>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from integer line numbers only -->
	{@html focusStyle}
</svelte:head>

<article class="front page">
	<header class="hero">
		<h1>{t('Schematics from plain text')}</h1>
		<div class="hero-side">
			<p class="lede">
				{t(
					'Write one part or one wire per line. schemd places the parts, routes the wires and draws the SVG.'
				)}
			</p>
			<div class="install">
				<div class="seg" role="tablist" aria-label={t('Package manager')}>
					{#each MANAGERS as manager (manager)}
						<button
							type="button"
							role="tab"
							aria-selected={pm === manager}
							onclick={() => (pm = manager)}>{t(manager)}</button
						>
					{/each}
				</div>
				<div class="command">
					<code>{installCmd}</code>
					<button
						type="button"
						class="copy"
						onclick={copyInstall}
						aria-label={t('Copy install command')}
					>
						{copied ? t('Copied') : t('Copy')}
					</button>
				</div>
			</div>
			<div class="actions">
				<a class="btn btn-solid" href={href(`/playground/${data.latest}`)}
					>{t('Open the playground')}</a
				>
				<a class="btn" href={href(`/docs/${data.latest}/overview`)}>{t('Read the documentation')}</a
				>
			</div>
			<Pronounce />
		</div>
	</header>

	<figure class="traced" aria-label={t('One circuit, three views')}>
		<div class="views" role="tablist" aria-label={t('Compiler views')}>
			{#each VIEWS as option (option.id)}
				<button
					type="button"
					role="tab"
					aria-selected={view === option.id}
					onclick={() => (view = option.id)}>{t(option.label)}</button
				>
			{/each}
		</div>

		{#if view === 'split'}
			<!-- The source is a sheet of vellum laid over its own drawing. -->
			<div class="overlay">
				<div class="drawing" data-hero-drawing data-schematic-host>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
					{@html data.hero.svg}
				</div>
				<ol
					class="source"
					aria-label={t('Source; hover or focus a line to trace it')}
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
								<span class="visually-hidden">{t('Trace line')}</span>
								<span class="n">{t(line.n)}</span>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- tokenizer output, escaped -->
								<code>{@html line.html}</code>
							</button>
						</li>
					{/each}
				</ol>
			</div>
		{:else if view === 'netlist'}
			<div class="inset netlist">
				<p class="table-caption">
					{t('Nets of the drawing, from')} <code>buildNetlist</code>
				</p>
				<table class="spec">
					<thead>
						<tr>
							<th scope="col">{t('Net')}</th>
							<th scope="col">{t('Terminals')}</th>
							<th scope="col">{t('Lines')}</th>
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
										aria-label={t('Trace net {0} on the drawing', [net.id])}>{t(net.id)}</button
									>
								</td>
								<td><code>{net.terminals.join(', ')}</code></td>
								<td class="tabular">{t(net.lines.join(', '))}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="note">
					{data.hero.issues === 0
						? t('verifyNetlist reports no problems with this circuit.')
						: t('verifyNetlist reports {0} findings.', [data.hero.issues])}
				</p>
			</div>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<pre
				class="inset svg-out"
				tabindex="0"
				aria-label={t('The beginning of the compiled SVG')}>{data.hero.svgHead}</pre>
		{/if}

		<figcaption>
			{t(data.hero.title)}: {t(data.hero.components)}
			{t('parts on')}
			{t(data.hero.nets.length)}
			{t('nets, compiled in')}
			{t(data.hero.ms)}
			{t('ms. Hover a line to find its wire.')}
		</figcaption>
	</figure>

	<section aria-labelledby="draws">
		<h2 id="draws">{t('What it draws')}</h2>
		<p class="section-lede">
			{t(
				'The same language draws four kinds of diagram. Each figure shows one line of its source.'
			)}
		</p>
		<div class="triple">
			{#each data.families as family (family.id)}
				<figure class="figure">
					<div class="figure-body">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
						{@html family.svg}
					</div>
					<figcaption>
						<b>{t(family.title)}</b>
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
						<p class="tag">{t(data.latest)}</p>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
						{@html data.figures['junction']}
					</div>
				</div>
				<figcaption>{t('Three wires to one junction, then and now.')}</figcaption>
			</figure>
			<figure class="figure">
				<div class="figure-body">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
					{@html data.figures['crossing']}
				</div>
				<figcaption>{t('Separate nets bridge where they cross.')}</figcaption>
			</figure>
		</div>
	</section>

	<section aria-labelledby="glance">
		<h2 id="glance">{t('At a glance')}</h2>
		<table class="spec glance">
			<tbody>
				<tr>
					<th scope="row">{t('Package')}</th>
					<td><code>@schemd/core</code> {t(data.latest)}</td>
				</tr>
				<tr>
					<th scope="row">{t('Component kinds')}</th>
					<td><a href={href('/components')}>{t(data.evidence.kinds)}</a></td>
				</tr>
				<tr>
					<th scope="row">{t('Runs on')}</th>
					<td>{t('Node.js 24 or newer, browsers, web workers')}</td>
				</tr>
				<tr>
					<th scope="row">{t('Dependencies')}</th>
					<td>{t('None')}</td>
				</tr>
				<tr>
					<th scope="row">{t('Output')}</th>
					<td>{t('The same SVG bytes on every engine')}</td>
				</tr>
				<tr>
					<th scope="row">{t('Design rules')}</th>
					<td>
						<a href={href('/conformance')}
							>{t(data.evidence.clean)} {t('of')} {t(data.evidence.diagrams)}</a
						>
						{t('documentation diagrams pass')}
					</td>
				</tr>
				<tr>
					<th scope="row">{t('Licence')}</th>
					<td>{t('MIT')}</td>
				</tr>
			</tbody>
		</table>
	</section>
</article>

<style>
	.front {
		padding-block: var(--space-8) var(--space-12);
	}

	/* ---------- Hero: the title, and what to do next beside it ---------- */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		gap: var(--space-8) var(--space-12);
		align-items: end;
		margin-block-end: var(--space-12);

		& h1 {
			font-size: var(--text-display);
			font-weight: 800;
			line-height: 1;
			letter-spacing: var(--tracking-display);
			max-inline-size: 11ch;
			text-wrap: balance;
		}
	}

	.hero-side {
		display: grid;
		gap: var(--space-4);
		justify-items: start;
	}

	.lede {
		margin: 0;
		font-size: var(--text-md);
		line-height: 1.45;
		color: var(--ink-mute);
		text-wrap: pretty;
	}

	.install {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.command {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-block-size: 38px;
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
		border: 1px solid var(--edge);
		border-radius: var(--radius-sm);
		background: var(--wash);

		& code {
			font-size: 0.9375rem;
		}
	}

	.copy {
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent);

		&:hover {
			background: var(--bg);
		}
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	/* ---------- The traced figure ---------- */
	.traced {
		margin: 0;
	}

	.views {
		display: flex;
		gap: var(--space-1);
		margin-block-end: var(--space-3);

		& button {
			padding: 0.3rem 0.75rem;
			border-radius: 6px;
			font-size: var(--text-sm);
			font-weight: 600;
			color: var(--ink-mute);

			&:hover {
				color: var(--ink);
				background: var(--wash);
			}

			&[aria-selected='true'] {
				color: var(--ink);
				background: var(--wash);
				box-shadow: inset 0 0 0 1px var(--line);
			}
		}
	}

	/* The drawing lies on an inset; the source is a sheet of vellum over its
	   left side, translucent enough that the wires beneath show through. */
	.overlay {
		position: relative;
		display: grid;
		min-block-size: 560px;
	}

	.drawing {
		display: grid;
		align-items: center;
		/* Keep the complete drawing clear of the source sheet's 46% width. */
		padding: var(--space-8) var(--space-8) var(--space-8) 48%;
		background: var(--wash);
		border: 1px solid var(--edge);
		border-radius: var(--radius-md);

		& :global(svg) {
			display: block;
			inline-size: 100%;
			block-size: auto;
		}
	}

	.source {
		position: absolute;
		inset-block-start: var(--space-6);
		inset-inline-start: calc(-1 * var(--space-4));
		inline-size: 46%;
		max-block-size: calc(100% - 2 * var(--space-6));
		margin: 0;
		padding: var(--space-3) var(--space-2);
		list-style: none;
		overflow: auto;
		background: color-mix(in srgb, var(--vellum) 84%, transparent);
		-webkit-backdrop-filter: blur(3px);
		backdrop-filter: blur(3px);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-overlay);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.55;
		/* The one orchestrated moment: on load the source sheet slides into
		   place over its drawing. Reduced motion skips it. */
		animation: lay-sheet var(--dur-sheet) var(--ease-sheet) 120ms both;
	}

	@keyframes lay-sheet {
		from {
			opacity: 0;
			transform: translate(-24px, 10px) rotate(-1deg);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.ln {
		display: flex;
		min-block-size: 24px;
		gap: var(--space-3);
		inline-size: 100%;
		padding-inline: var(--space-2);
		border-radius: 5px;
		text-align: start;
		white-space: pre;

		&.on,
		&:focus-visible {
			background: var(--mark);
			color: var(--mark-ink);
		}

		& .n {
			min-inline-size: 2ch;
			text-align: end;
			color: var(--ink-faint);
			font-variant-numeric: tabular-nums;
		}

		&.on .n {
			color: var(--mark-ink);
		}

		& code {
			font-size: inherit;
		}
	}

	.drawing :global(figure),
	.figure-body :global(figure) {
		margin: 0;
	}

	.drawing :global(figcaption),
	.figure-body :global(figure > figcaption) {
		display: none;
	}

	.inset {
		margin: 0;
		padding: var(--space-6);
		background: var(--wash);
		border: 1px solid var(--edge);
		border-radius: var(--radius-md);
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
		margin-block-end: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.svg-out {
		max-block-size: 520px;
		overflow: auto;
		font-size: 0.8125rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.traced figcaption {
		margin-block-start: var(--space-3);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	/* ---------- Sections below the fold ---------- */
	section {
		margin-block-start: var(--space-16);
	}

	h2 {
		font-size: var(--text-lg);
		margin-block-end: var(--space-2);
	}

	.section-lede {
		margin: 0 0 var(--space-6);
		max-inline-size: var(--measure);
		color: var(--ink-mute);
	}

	.triple {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-6);

		& .figure {
			margin: 0;
		}

		& figcaption b {
			display: block;
		}

		& .line {
			display: block;
			margin-block-start: var(--space-1);
			font-size: 0.8125rem;
			color: var(--ink);
			overflow-wrap: anywhere;
		}
	}

	.pair {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		gap: var(--space-6);
		margin-block-start: var(--space-6);

		& .figure {
			margin: 0;
		}
	}

	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);

		& .tag {
			display: inline-block;
			margin: 0 0 var(--space-1);
			padding: 0 0.4em;
			border-radius: var(--radius-tag);
			background: var(--bg);
			font-size: var(--text-sm);
			font-weight: 700;
		}
	}

	.figure-body :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
	}

	.glance {
		max-inline-size: 760px;

		& th {
			inline-size: 12rem;
		}
	}

	@media (max-width: 960px) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
		}

		/* On a narrow screen the source sheet lies across the top of the
		   drawing instead of beside it. */
		.overlay {
			min-block-size: 0;
		}

		.drawing {
			padding: var(--space-4);
			margin-block-start: -2.5rem;
			padding-block-start: var(--space-12);
			order: 2;
		}

		.source {
			position: relative;
			inset: auto;
			inline-size: auto;
			max-block-size: 360px;
			margin-inline: var(--space-2);
			order: 1;
			z-index: 1;
		}

		.triple,
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
