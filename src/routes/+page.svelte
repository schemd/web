<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	import type { PageProps } from './$types';
	import type { Component } from 'svelte';
	import { browser } from '$app/env';
	import Seo from '#lib/components/Seo.svelte';
	import Pronounce from '#lib/components/Pronounce.svelte';
	import PlotterBed from '#lib/components/PlotterBed.svelte';
	import { compileInBrowser, prefetchCompiler } from '#lib/compile-client.ts';
	import { encodeWorkspaceState } from '#lib/state-uri.ts';
	import { trackInteraction } from '#lib/telemetry.ts';
	import type CodeEditorType from '#lib/components/CodeEditor.svelte';

	let { data }: PageProps = $props();

	/* ---------- Plotter Sheet views & motion controls ---------- */
	type View = 'split' | 'live' | 'netlist' | 'svg';
	const VIEWS: readonly { id: View; label: string }[] = [
		{ id: 'split', label: 'Source + drawing' },
		{ id: 'live', label: 'Edit live' },
		{ id: 'netlist', label: 'Netlist' },
		{ id: 'svg', label: 'SVG out' }
	];
	let view = $state<View>('split');
	let stage = $state(300);
	let exploded = $state(false);
	let showNets = $state(false);
	let showGrid = $state(false);
	let plotter = $state<PlotterBed | undefined>();

	const STAGES = [
		{
			id: 0,
			label: '1 · Source',
			badge: 'Stage 01 · Parse',
			detail: 'Lines tokenize with column-exact diagnostics; parts wait at the left margin.'
		},
		{
			id: 1,
			label: '2 · Draft',
			badge: 'Stage 02 · Draft',
			detail: 'BFS drafts unplaced parts from their wires and measures the tight 24u sheet.'
		},
		{
			id: 2,
			label: '3 · Route',
			badge: 'Stage 03 · Route',
			detail: 'Each net routes as one orthogonal tree with junction dots and bridge arcs.'
		},
		{
			id: 3,
			label: '4 · Ink',
			badge: 'Stage 04 · Ink',
			detail: 'Construction geometry dissolves and byte-identical SVG inks into place.'
		}
	] as const;

	const activeStageIndex = $derived(Math.min(3, Math.round(stage / 100)));
	const activeStageInfo = $derived(STAGES[activeStageIndex]!);

	function setStageStep(index: number): void {
		stage = index * 100;
	}

	/* ---------- Live 1.4 drafting presets ---------- */
	const DRAFTED_RC = `source:VS "5 V" #slate [type=voltage-dc]
resistor:RS "10 k\\Omega" #amber
capacitor:CS "100 nF" #cyan [orientation=down]
ground:GS #slate

VS.positive -> RS.in #blue [ortho]
RS.out -> CS.in #cyan [ortho]
CS.out -> GS.in #slate [ortho]
VS.negative -> GS.in #slate [ortho]`;

	const PRESETS = $derived([
		{ id: 'analog', label: 'Analog', title: 'Drafted RC filter', source: DRAFTED_RC },
		...data.families.map((family) => ({
			id: family.id,
			label: family.family,
			title: family.title,
			source: family.source
		}))
	]);

	let livePreset = $state('analog');
	let liveSource = $state(DRAFTED_RC);
	let liveTitle = $state('Drafted RC filter');
	let liveSvg = $state('');
	let liveError = $state<string | undefined>();
	let liveErrorLine = $state<number | undefined>();
	let LiveCodeEditor = $state<Component<Parameters<typeof CodeEditorType>[1]> | undefined>();
	let liveStats = $state<
		| {
				readonly ms: number;
				readonly components: number;
				readonly connections: number;
				readonly width: number;
				readonly height: number;
		  }
		| undefined
	>();
	let liveGeneration = 0;

	function selectPreset(preset: { id: string; title: string; source: string }): void {
		livePreset = preset.id;
		liveTitle = preset.title;
		liveSource = preset.source;
	}

	function openLiveEditor(): void {
		if (browser) {
			prefetchCompiler();
			if (!LiveCodeEditor) {
				void import('#lib/components/CodeEditor.svelte').then((mod) => {
					LiveCodeEditor = mod.default;
				});
			}
		}
		view = 'live';
	}

	$effect(() => {
		if (!browser || view !== 'live') return;
		const source = liveSource;
		const title = liveTitle;
		const generation = ++liveGeneration;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			const outcome = await compileInBrowser(
				{ source, width: 840, height: 600, autoBounds: true, title, mode: 'full' },
				controller.signal
			);
			if (generation !== liveGeneration || controller.signal.aborted) return;
			if (!outcome) {
				liveError = 'Compiler unavailable.';
				liveErrorLine = undefined;
				return;
			}
			if (outcome.ok) {
				liveError = undefined;
				liveErrorLine = undefined;
				liveSvg = outcome.svg;
				liveStats = {
					ms: outcome.ms,
					components: outcome.metrics.components,
					connections: outcome.metrics.connections,
					width: outcome.sheet?.width ?? 840,
					height: outcome.sheet?.height ?? 600
				};
			} else {
				liveErrorLine = outcome.line === undefined ? undefined : outcome.line - 1;
				liveError =
					outcome.line === undefined ? outcome.message : `Line ${outcome.line}: ${outcome.message}`;
			}
		}, 24);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	/* ---------- Source-line <-> copper highlighting ---------- */
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
		const bold =
			lit === ''
				? ''
				: `${host} :is(${lit}) .schematic-trace{stroke-width:2.6;filter:drop-shadow(0 0 2px var(--mark)) drop-shadow(0 0 3px var(--mark))}`;
		return `<style>${host} [data-source-line]${dim}{opacity:.14}${bold}</style>`;
	});

	function traceNet(id: string): void {
		focusLine = undefined;
		focusNet = id;
		view = 'split';
	}

	/* ---------- Keyboard shortcuts on the Plotter Sheet ---------- */
	function onWindowKeydown(event: KeyboardEvent): void {
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (
			target &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.tagName === 'SELECT' ||
				target.isContentEditable)
		) {
			return;
		}
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (view !== 'split' && view !== 'live') return;
		if (event.key.toLowerCase() === 'e') {
			exploded = !exploded;
		} else if (event.key.toLowerCase() === 'p') {
			plotter?.pulse();
		} else if (event.key >= '1' && event.key <= '4' && view === 'split') {
			setStageStep(Number(event.key) - 1);
		}
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

<svelte:window onkeydown={onWindowKeydown} />

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
	<!-- ======================================================================
	     PLOTTER SHEET WORKSPACE: Left Marginalia | Right Mechanical Plotter Bed
	     ====================================================================== -->
	<section class="plotter-hero" aria-label={t('One circuit, three views')}>
		<!-- Left Drafting Margin: Statement + Bare Hairline Source Listing -->
		<div class="margin-col">
			<header class="margin-head">
				<h1>{t('Schematics from plain text')}</h1>
				<p class="lede">
					{t(
						'Write one part or one wire per line. schemd places the parts, routes the wires and draws the SVG.'
					)}
				</p>
			</header>

			{#if view === 'live'}
				<div class="live-margin">
					<div class="live-head">
						<div class="presets" role="group" aria-label={t('Starter examples')}>
							{#each PRESETS as preset (preset.id)}
								<button
									type="button"
									aria-pressed={livePreset === preset.id}
									onclick={() => selectPreset(preset)}>{t(preset.label)}</button
								>
							{/each}
						</div>
						<a
							class="live-open"
							href={href(`/playground/${data.latest}?code=${encodeWorkspaceState(liveSource)}`)}
							>{t('Open in playground')}</a
						>
					</div>
					<div class="live-editor-host">
						{#if LiveCodeEditor}
							<LiveCodeEditor
								bind:value={liveSource}
								errorLine={liveErrorLine}
								ariaLabel={t('Live schemd source')}
								compact={true}
							/>
						{:else}
							<p class="live-loading">{t('Loading editor…')}</p>
						{/if}
					</div>
					{#if liveError}
						<p class="live-error" role="alert">{liveError}</p>
					{/if}
				</div>
			{:else}
				<div class="source-plate">
					<div class="source-head">
						<span class="mono-tag">{t(data.hero.title)}</span>
						<span class="mono-hint">{t('Hover a line to find its wire.')}</span>
					</div>
					<ol
						class="source source-list"
						aria-label={t('Source; hover or focus a line to trace it')}
						onmouseleave={() => (focusLine = undefined)}
					>
						{#each data.hero.lines as line (line.n)}
							<li>
								<button
									type="button"
									class="ln"
									class:on={focusLines?.includes(line.n) ?? false}
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
			{/if}

			<div class="stage-note">
				<span class="stage-pill">{t(activeStageInfo.badge)}</span>
				<p>{t(activeStageInfo.detail)}</p>
			</div>
		</div>

		<!-- Right 8-Column Plotter Bed & Instrument Controls -->
		<div class="bed-col">
			<div class="instrument-bar">
				<div class="views" role="tablist" aria-label={t('Compiler views')}>
					{#each VIEWS as option (option.id)}
						<button
							type="button"
							role="tab"
							aria-selected={view === option.id}
							onclick={() => (option.id === 'live' ? openLiveEditor() : (view = option.id))}
							>{t(option.label)}</button
						>
					{/each}
				</div>

				{#if view === 'split' || view === 'live'}
					<div class="motion-controls" role="group" aria-label={t('Plotter controls')}>
						<button type="button" onclick={() => plotter?.plot()}>{t('Plot')}</button>
						<button type="button" class="tabular" onclick={() => plotter?.flashRealSpeed()}>
							{t(view === 'live' && liveStats ? liveStats.ms : data.hero.ms)}
							{t('ms')}
						</button>
						<button type="button" aria-pressed={exploded} onclick={() => (exploded = !exploded)}>
							{t('Explode')}
						</button>
						<button type="button" aria-pressed={showGrid} onclick={() => (showGrid = !showGrid)}>
							{t('Geometry')}
						</button>
						{#if view === 'split'}
							<button type="button" aria-pressed={showNets} onclick={() => (showNets = !showNets)}>
								{t('Nets')}
							</button>
						{/if}
						<button type="button" class="pulse-btn" onclick={() => plotter?.pulse()}>
							{t('Pulse')}
						</button>
					</div>
				{/if}
			</div>

			{#if view === 'split'}
				<PlotterBed
					bind:this={plotter}
					bind:stage
					bind:exploded
					grid={showGrid}
					heroHost={true}
					autoPlot={true}
					svg={data.hero.svg}
					sheetWidth={data.hero.sheet.width}
					sheetHeight={data.hero.sheet.height}
					ms={data.hero.ms}
					onfocusline={(line) => {
						focusNet = undefined;
						focusLine = line;
					}}
				/>
				{#if showNets}
					<div class="net-strip" role="group" aria-label={t('Highlight a net on the drawing')}>
						{#each data.hero.nets as net (net.id)}
							<button
								type="button"
								class="net-pill"
								aria-pressed={focusNet === net.id}
								onclick={() => {
									focusLine = undefined;
									focusNet = focusNet === net.id ? undefined : net.id;
								}}
							>
								{t(net.id)}
							</button>
						{/each}
					</div>
				{/if}
			{:else if view === 'live'}
				{#if liveSvg}
					<PlotterBed
						bind:this={plotter}
						bind:stage
						bind:exploded
						grid={showGrid}
						svg={liveSvg}
						sheetWidth={liveStats?.width}
						sheetHeight={liveStats?.height}
						ms={liveStats?.ms}
					/>
				{:else}
					<div class="inset live-waiting">
						<p class="note">{t('Compiling in this tab…')}</p>
					</div>
				{/if}
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

			<p class="bed-caption tabular">
				{#if view === 'live' && liveStats}
					{t(liveTitle)}: {t(liveStats.components)}
					{t('parts')} · {t(liveStats.connections)}
					{t('wires')} · {t('auto')}
					{t(liveStats.width)}×{t(liveStats.height)} · {t(liveStats.ms)}
					{t('ms')}
				{:else}
					{t(data.hero.title)}: {t(data.hero.components)}
					{t('parts on')}
					{t(data.hero.nets.length)}
					{t('nets, compiled in')}
					{t(data.hero.ms)}
					{t('ms. Hover a line to find its wire.')}
				{/if}
			</p>
		</div>
	</section>

	<!-- ======================================================================
	     BOTTOM INSTRUMENT STRIP: 4-Stage Compiler Vernier + Draftsman's Title Block
	     ====================================================================== -->
	<section class="instrument-strip" aria-label={t('Compiler pipeline and title block')}>
		<div class="vernier-panel">
			<div class="vernier-head">
				<span class="vernier-title">{t('Compiler pipeline')}</span>
				<div class="stage-stops" role="group" aria-label={t('Pipeline stages')}>
					{#each STAGES as stop (stop.id)}
						<button
							type="button"
							aria-pressed={activeStageIndex === stop.id}
							onclick={() => {
								if (view !== 'split' && view !== 'live') view = 'split';
								setStageStep(stop.id);
							}}>{t(stop.label)}</button
						>
					{/each}
				</div>
			</div>
			<div class="vernier-track vernier-rail">
				<input
					type="range"
					min="0"
					max="300"
					bind:value={stage}
					aria-label={t('Scrub compiler stages from source to inked SVG')}
				/>
			</div>
		</div>

		<!-- Draftsman's Title Block -->
		<div class="title-block">
			<div class="tb-top">
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
				<div class="tb-actions">
					<a class="btn btn-solid" href={href(`/playground/${data.latest}`)}
						>{t('Open the playground')}</a
					>
					<a class="btn" href={href(`/docs/${data.latest}/overview`)}
						>{t('Read the documentation')}</a
					>
				</div>
			</div>
			<div class="tb-foot tabular">
				<span><Pronounce /></span>
				<span class="tb-meta"
					>REV {t(data.latest)} · {t(data.evidence.kinds)} {t('kinds')} · 0 {t('deps')}</span
				>
			</div>
		</div>
	</section>

	<!-- ======================================================================
	     SPECIMEN PLATES BELOW THE FOLD
	     ====================================================================== -->
	<section aria-labelledby="draws">
		<h2 id="draws">{t('What it draws')}</h2>
		<p class="section-lede">
			{t(
				'The same language draws four kinds of diagram. Each figure shows one line of its source.'
			)}
		</p>
		<div class="triple">
			{#each data.families as family (family.id)}
				<figure class="figure specimen-plate">
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
			<figure class="figure specimen-plate">
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
			<figure class="figure specimen-plate">
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
		padding-block: var(--space-4) var(--space-12);
	}

	/* ---------- Main Plotter Sheet Grid ---------- */
	.plotter-hero {
		display: grid;
		grid-template-columns: minmax(0, 4.5fr) minmax(0, 7.5fr);
		gap: var(--space-6);
		align-items: start;
	}

	.margin-col {
		display: grid;
		gap: var(--space-4);
	}

	.margin-head h1 {
		font-size: clamp(2.1rem, 4.1vw, 3.25rem);
		font-weight: 800;
		line-height: 1.03;
		letter-spacing: var(--tracking-display);
		text-wrap: balance;
	}

	.lede {
		margin: var(--space-2) 0 0;
		font-size: var(--text-base);
		line-height: 1.5;
		color: var(--ink-mute);
	}

	/* Bare hairline-ruled source plate (no puffy card chrome) */
	.source-plate {
		border-block: 1px solid var(--line-strong);
		padding-block: var(--space-2);
	}

	.source-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-block-end: var(--space-2);
		font-size: 0.75rem;
		color: var(--ink-mute);
	}

	.mono-tag {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--ink);
	}

	.source-list {
		margin: 0;
		padding: 0;
		list-style: none;
		max-block-size: 300px;
		overflow: auto;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.ln {
		display: flex;
		min-block-size: 22px;
		gap: var(--space-2);
		inline-size: 100%;
		padding-inline: var(--space-1);
		border-radius: 3px;
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

	.stage-note {
		display: grid;
		gap: var(--space-1);

		& p {
			margin: 0;
			font-size: var(--text-sm);
			color: var(--ink-mute);
			line-height: 1.45;
		}
	}

	.stage-pill {
		justify-self: start;
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--mark);
		color: var(--mark-ink);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
	}

	/* Live margin editor */
	.live-margin {
		display: grid;
		gap: var(--space-2);
		border-block: 1px solid var(--line-strong);
		padding-block: var(--space-3);
	}

	.live-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& button {
			padding: 0.18rem 0.5rem;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			font-size: 0.78rem;
			font-weight: 600;
			color: var(--ink-mute);

			&[aria-pressed='true'] {
				background: var(--mark);
				color: var(--mark-ink);
				border-color: var(--mark);
			}
		}
	}

	.live-open {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--accent);
	}

	.live-editor-host {
		block-size: 248px;
		min-block-size: 220px;
	}

	.live-loading {
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--wash);
		color: var(--ink-mute);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.live-error {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--danger);
	}

	/* Right Bed Column */
	.bed-col {
		display: grid;
		gap: var(--space-2);
	}

	.instrument-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.views,
	.motion-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& button {
			padding: 0.25rem 0.6rem;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			background: var(--bg);
			font-size: 0.8rem;
			font-weight: 600;
			color: var(--ink-mute);

			&:hover {
				color: var(--ink);
				border-color: var(--line-strong);
			}

			&[aria-selected='true'],
			&[aria-pressed='true'] {
				background: var(--mark);
				color: var(--mark-ink);
				border-color: var(--mark);
			}
		}

		& .pulse-btn {
			background: var(--ink);
			border-color: var(--ink);
			color: var(--bg);

			&:hover {
				color: var(--bg);
				background: color-mix(in srgb, var(--ink) 86%, var(--bg));
			}
		}
	}

	.net-strip {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.net-pill {
		padding: 0.18rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink-mute);
		background: var(--wash);

		&[aria-pressed='true'] {
			background: var(--mark);
			color: var(--mark-ink);
			border-color: var(--mark);
		}
	}

	.bed-caption {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.inset {
		margin: 0;
		padding: var(--space-5);
		background: var(--wash);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
	}

	.live-waiting {
		min-block-size: 320px;
		display: grid;
		place-items: center;
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
		max-block-size: 460px;
		overflow: auto;
		font-size: 0.8rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	/* ---------- Bottom Instrument Strip: Vernier + Draftsman Title Block ---------- */
	.instrument-strip {
		display: grid;
		grid-template-columns: minmax(0, 6fr) minmax(0, 6fr);
		gap: var(--space-4);
		margin-block-start: var(--space-6);
		padding-block-start: var(--space-4);
		border-block-start: 1px solid var(--line-strong);
		align-items: stretch;
	}

	.vernier-panel {
		display: grid;
		gap: var(--space-2);
		align-content: center;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--wash);
	}

	.vernier-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.vernier-title {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--ink-mute);
	}

	.stage-stops {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);

		& button {
			padding: 0.15rem 0.5rem;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			background: var(--bg);
			font-family: var(--font-mono);
			font-size: 0.74rem;
			color: var(--ink-mute);

			&[aria-pressed='true'] {
				background: var(--mark);
				color: var(--mark-ink);
				border-color: var(--mark);
				font-weight: 700;
			}
		}
	}

	.vernier-track {
		display: flex;
		align-items: center;
		block-size: 34px;
		padding-inline: var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background-color: var(--bg);

		& input {
			inline-size: 100%;
			accent-color: var(--accent);
			cursor: ew-resize;
		}
	}

	/* Authentic ruled draftsman's title block */
	.title-block {
		display: grid;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--bg);
		overflow: hidden;
	}

	.tb-top {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-block-end: 1px solid var(--line);
	}

	.install {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.command {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-block-size: 34px;
		padding: 0.15rem var(--space-2) 0.15rem var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--wash);

		& code {
			font-size: 0.875rem;
		}
	}

	.copy {
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent);

		&:hover {
			background: var(--bg);
		}
	}

	.tb-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);

		& .btn {
			min-block-size: 36px;
			padding: 0.3rem 0.85rem;
			font-size: var(--text-sm);
		}
	}

	.tb-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--wash);
		font-size: 0.75rem;
		color: var(--ink-mute);
	}

	.tb-meta {
		font-family: var(--font-mono);
	}

	/* ---------- Specimen plates below the fold ---------- */
	section + section {
		margin-block-start: var(--space-12);
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
		gap: var(--space-5);

		& .figure {
			margin: 0;
		}

		& figcaption b {
			display: block;
		}

		& .line {
			display: block;
			margin-block-start: var(--space-1);
			font-size: 0.8rem;
			color: var(--ink);
			overflow-wrap: anywhere;
		}
	}

	.pair {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		gap: var(--space-5);
		margin-block-start: var(--space-5);

		& .figure {
			margin: 0;
		}
	}

	.specimen-plate > .figure-body {
		border-color: var(--line-strong);
	}

	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);

		& .tag {
			display: inline-block;
			margin: 0 0 var(--space-1);
			padding: 0 0.4em;
			border: 1px solid var(--line);
			border-radius: var(--radius-tag);
			background: var(--bg);
			font-family: var(--font-mono);
			font-size: var(--text-xs);
			font-weight: 700;
		}
	}

	.figure-body :global(figure) {
		margin: 0;
	}

	.figure-body :global(figure > figcaption) {
		display: none;
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
		.plotter-hero,
		.instrument-strip,
		.triple,
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
