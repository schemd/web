<script lang="ts">
	/**
	 * Seven stages of one compilation, scrubbable.
	 *
	 * Every panel renders data the server produced from a single `compileSchematic`
	 * call, so no stage can disagree with another about what happened. The stages a
	 * document reaches depend on how far it got: a rejected document still has a
	 * token stream and a diagnostic, which is exactly when this page is most useful.
	 */
	import Seo from '$lib/components/Seo.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { encodeWorkspaceState } from '$lib/state-uri';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const STAGES = [
		{ id: 'lex', label: 'Lex', blurb: 'Every line as the tokenizer sees it.' },
		{ id: 'parse', label: 'Parse', blurb: 'The validated AST, in source order.' },
		{ id: 'place', label: 'Place', blurb: 'Relations lowered to coordinates.' },
		{ id: 'route', label: 'Route', blurb: 'Traces, retries, and canvas pressure.' },
		{ id: 'verify', label: 'Verify', blurb: 'Connectivity against seven design rules.' },
		{ id: 'emit', label: 'Emit', blurb: 'The markup, and what it costs.' },
		{ id: 'describe', label: 'Describe', blurb: 'Prose derived from the same model.' }
	] as const;

	let stage = $state<(typeof STAGES)[number]['id']>('lex');
	let draft = $derived(untrack(() => data.source));
	let selectedLine = $state<number | undefined>();

	/* The draft follows whatever document the server compiled, so a shared link
	   never shows one source and reports on another. Reading `data.source` inside
	   the effect is what subscribes it to later navigations. */
	$effect(() => {
		draft = data.source;
	});

	const dirty = $derived(draft !== data.source);

	function run() {
		void goto(`/inspector/${data.version}?code=${encodeWorkspaceState(draft)}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	/** Peak occupancy, for scaling the heatmap. */
	const peakLoad = $derived(
		data.ok ? Math.max(1, ...data.routing.congestion.map((cell) => cell.load)) : 1
	);
</script>

<Seo
	title="Compiler inspector"
	description="Scrub through a schemd compilation stage by stage — tokens, AST, resolved placement, routing and congestion, design rules, emitted bytes, and derived prose."
/>

<div class="inspector">
	<header class="masthead">
		<p class="eyebrow">Compiler inspector · engine {data.engineVersion}</p>
		<h1>Watch it compile</h1>
		<p class="lede">
			Every stage below is the real thing: one <code>compileSchematic</code> call on the server, taken
			apart. Edit the document and run it again — the URL carries the source, so an inspector link is
			a citable bug report.
		</p>
	</header>

	<div class="workbench">
		<section class="editor" aria-label="Document">
			<div class="panel-head">
				<h2>Document</h2>
				<button type="button" class="run" onclick={run} disabled={!dirty}>
					{dirty ? 'Run' : 'Compiled'}
				</button>
			</div>
			<CodeEditor bind:value={draft} errorLine={data.ok ? undefined : data.failure.line} />
			{#if !data.ok}
				<p class="diagnostic" role="alert">
					{#if data.failure.line !== undefined}<b>Line {data.failure.line}:</b>{/if}
					{data.failure.message}
				</p>
			{/if}
		</section>

		<section class="stages" aria-label="Compilation stages">
			<nav class="stage-rail">
				{#each STAGES as entry, index (entry.id)}
					<button
						type="button"
						class="stage-tab"
						class:is-active={stage === entry.id}
						onclick={() => (stage = entry.id)}
					>
						<span class="stage-index">{index + 1}</span>
						<span class="stage-label">{entry.label}</span>
					</button>
				{/each}
			</nav>

			<div class="stage-body">
				<p class="stage-blurb">{STAGES.find((entry) => entry.id === stage)!.blurb}</p>

				{#if stage === 'lex'}
					<ol class="lex">
						{#each data.lex as line, index (index)}
							<li class:is-selected={selectedLine === index + 1}>
								<button type="button" onclick={() => (selectedLine = index + 1)}>
									<span class="gutter">{index + 1}</span>
									<span class="tokens">
										{#each line.tokens as token, tokenIndex (tokenIndex)}
											<span
												class="tok {token.cls ? `tok-${token.cls}` : ''}"
												title={token.cls ?? 'text'}>{token.text}</span
											>
										{/each}
									</span>
									<span class="line-kind">{line.kind}</span>
								</button>
							</li>
						{/each}
					</ol>
				{:else if !data.ok}
					<p class="unreached">
						This stage was never reached — the document did not get past validation. The token
						stream and the diagnostic are what there is to look at.
					</p>
				{:else if stage === 'parse'}
					<ul class="ast">
						{#each data.ast as node (node.line)}
							<li class:is-selected={selectedLine === node.line}>
								<button type="button" onclick={() => (selectedLine = node.line)}>
									<span class="gutter">{node.line}</span>
									<span class="ast-id">{node.id}</span>
									<span class="ast-kind">{node.summary}</span>
								</button>
								<dl class="fields">
									{#each node.fields as field (field.name)}
										<div>
											<dt>{field.name}</dt>
											<dd>{field.value}</dd>
										</div>
									{/each}
								</dl>
							</li>
						{/each}
					</ul>
				{:else if stage === 'place'}
					{#if data.placements.length === 0}
						<p class="unreached">
							Every declaration in this document states <code>at (x, y)</code>, so the placement
							pass had nothing to lower. Write a relation — <code>right-of R1 by 150</code> — and it will
							show its work here.
						</p>
					{:else}
						<table class="grid">
							<thead>
								<tr><th>Line</th><th>Component</th><th>Relations</th><th>Resolved</th></tr>
							</thead>
							<tbody>
								{#each data.placements as placement (placement.id)}
									<tr class:is-selected={selectedLine === placement.line}>
										<td class="num">{placement.line}</td>
										<td class="mono">{placement.id}</td>
										<td>
											{#each placement.relations as relation, index (index)}
												<span class="relation">
													{relation.kind}
													{relation.ref}{relation.port ? `.${relation.port}` : ''}{relation.gap !==
													undefined
														? ` by ${relation.gap}`
														: ''}
												</span>
											{/each}
										</td>
										<td class="mono num">({placement.resolved.x}, {placement.resolved.y})</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				{:else if stage === 'route'}
					<dl class="tiles">
						<div>
							<dt>Retries</dt>
							<dd>{data.routing.attempts}</dd>
						</div>
						<div>
							<dt>Traces torn up</dt>
							<dd>{data.routing.rippedUp.length}</dd>
						</div>
						<div>
							<dt>Occupied cells</dt>
							<dd>{data.routing.congestion.length}</dd>
						</div>
						<div>
							<dt>Peak load</dt>
							<dd>{peakLoad}</dd>
						</div>
					</dl>
					<p class="note">
						{#if data.routing.attempts === 0}
							Routed on the first pass — the greedy source-order route placed every trace, so rip-up
							was never entered.
						{:else}
							The first pass could not place every trace. Each retry tore up what had been laid,
							promoted the failed trace to the front, and reordered the rest shortest-span-first.
						{/if}
					</p>

					<h3>Congestion</h3>
					<p class="note">
						Occupancy per {data.congestionCell}-unit routing cell, read out of the hash the router
						already filled. Darker is tighter.
					</p>
					<svg
						class="heatmap"
						viewBox="0 0 {data.bounds.width} {data.bounds.height}"
						role="img"
						aria-label="Routing congestion heatmap"
					>
						<rect width={data.bounds.width} height={data.bounds.height} class="heat-bg" />
						{#each data.routing.congestion as cell, index (index)}
							<rect
								x={cell.x}
								y={cell.y}
								width={data.congestionCell}
								height={data.congestionCell}
								class="heat-cell"
								opacity={0.15 + 0.85 * (cell.load / peakLoad)}
								><title>{cell.load} spans</title></rect
							>
						{/each}
					</svg>

					<h3>Traces</h3>
					<ul class="traces">
						<!-- Keyed by position, not by endpoint: one terminal can drive several
						     traces, so `data-wire-source` is not unique. -->
						{#each data.traces as trace, index (index)}
							<li><span class="mono">{trace.endpoint}</span><code>{trace.d}</code></li>
						{/each}
					</ul>
				{:else if stage === 'verify'}
					<dl class="tiles">
						<div>
							<dt>Nodes</dt>
							<dd>{data.netlist.nodes}</dd>
						</div>
						<div>
							<dt>Nets</dt>
							<dd>{data.netlist.nets.length}</dd>
						</div>
						<div>
							<dt>Edges</dt>
							<dd>{data.netlist.edges}</dd>
						</div>
						<div>
							<dt>Findings</dt>
							<dd>{data.diagnostics.length}</dd>
						</div>
					</dl>
					<h3>Design rules</h3>
					<ul class="rules">
						{#each data.rules as rule (rule.code)}
							<li class:is-fired={rule.fired > 0}>
								<span class="rule-state">{rule.fired > 0 ? 'fired' : 'clean'}</span>
								<span class="mono">{rule.code}</span>
								<span class="rule-summary">{rule.summary}</span>
							</li>
						{/each}
					</ul>
					{#if data.diagnostics.length > 0}
						<h3>Findings</h3>
						<ul class="findings">
							{#each data.diagnostics as finding, index (index)}
								<li>
									<b>{finding.severity}</b> <span class="mono">{finding.code}</span>
									{finding.message}
								</li>
							{/each}
						</ul>
					{/if}
					<h3>Nets</h3>
					<ul class="nets">
						{#each data.netlist.nets as net (net.id)}
							<li>
								<span class="mono">{net.name ?? net.id}</span>
								<span class="net-terminals">{net.terminals.join(' · ')}</span>
							</li>
						{/each}
					</ul>
				{:else if stage === 'emit'}
					<dl class="tiles">
						<div>
							<dt>SVG bytes</dt>
							<dd>{data.metrics.svgBytes.toLocaleString('en-US')}</dd>
						</div>
						<div>
							<dt>Components</dt>
							<dd>{data.metrics.components}</dd>
						</div>
						<div>
							<dt>Connections</dt>
							<dd>{data.metrics.connections}</dd>
						</div>
						<div>
							<dt>Source chars</dt>
							<dd>{data.metrics.sourceCharacters.toLocaleString('en-US')}</dd>
						</div>
					</dl>
					<div class="preview">{@html data.svg}</div>
					<h3>Source map</h3>
					<table class="grid">
						<thead><tr><th>Line</th><th>Vector</th></tr></thead>
						<tbody>
							{#each data.sourceMap.nodes as node (node.id)}
								<tr class:is-selected={selectedLine === node.line}>
									<td class="num">{node.line}</td><td class="mono">{node.id}</td>
								</tr>
							{/each}
							{#each data.sourceMap.wires as wire, index (index)}
								<tr class:is-selected={selectedLine === wire.line}>
									<td class="num">{wire.line}</td>
									<td class="mono">{wire.source} → {wire.target}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else if stage === 'describe'}
					<p class="headline">{data.description.headline}</p>
					<p class="note">{data.description.inventory}</p>
					<ul class="connections">
						{#each data.description.connections as sentence, index (index)}
							<li>{sentence}</li>
						{/each}
					</ul>
					<p class="note">
						Derived from the netlist, not written by hand — the same connectivity the design rules
						read. This is what a screen reader is given.
					</p>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	.inspector {
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-5) var(--space-16);
	}
	.masthead {
		border-bottom: 1px solid var(--line-strong);
		padding-bottom: var(--space-6);
		margin-bottom: var(--space-6);
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-ultra);
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 var(--space-2);
	}
	h1 {
		font-size: var(--text-xl);
		margin: 0 0 var(--space-3);
	}
	.lede {
		margin: 0;
		max-width: 68ch;
		color: var(--ink-mute);
	}
	.lede code {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--ink);
	}
	.workbench {
		display: grid;
		grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	.editor,
	.stages {
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--bg-raised);
		overflow: hidden;
	}
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--line);
		background: var(--bg-panel);
	}
	.panel-head h2 {
		margin: 0;
		font-size: var(--text-sm);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
		font-weight: 500;
	}
	.run {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
		cursor: pointer;
	}
	.run:disabled {
		background: transparent;
		border-color: var(--line-strong);
		color: var(--ink-faint);
		cursor: default;
	}
	.diagnostic {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--line);
		background: color-mix(in oklab, var(--danger) 12%, var(--bg-raised));
		color: var(--ink);
		font-size: var(--text-sm);
	}
	.stage-rail {
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid var(--line-strong);
		background: var(--bg-panel);
	}
	.stage-tab {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		color: var(--ink-mute);
		cursor: pointer;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.stage-tab:hover {
		color: var(--ink);
	}
	.stage-tab.is-active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
	.stage-index {
		display: inline-grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: var(--radius-sm);
		border: 1px solid currentColor;
		font-size: var(--text-2xs);
	}
	.stage-body {
		padding: var(--space-5);
		max-height: 78vh;
		overflow: auto;
	}
	.stage-blurb {
		margin: 0 0 var(--space-5);
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}
	h3 {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
		margin: var(--space-6) 0 var(--space-3);
		font-weight: 500;
	}
	.unreached,
	.note {
		color: var(--ink-mute);
		font-size: var(--text-sm);
		margin: 0 0 var(--space-4);
		max-width: 72ch;
	}
	.unreached code {
		font-family: var(--font-mono);
		color: var(--ink);
	}
	.lex,
	.ast,
	.traces,
	.rules,
	.nets,
	.findings,
	.connections {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.lex li button,
	.ast li button {
		display: flex;
		gap: var(--space-3);
		width: 100%;
		text-align: left;
		background: none;
		border: 0;
		padding: var(--space-1) var(--space-2);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--ink);
		border-radius: var(--radius-sm);
	}
	.lex li.is-selected button,
	.ast li.is-selected button,
	tr.is-selected {
		background: color-mix(in oklab, var(--accent) 14%, transparent);
	}
	.gutter {
		color: var(--ink-faint);
		min-width: 2.5ch;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.tokens {
		white-space: pre-wrap;
		word-break: break-word;
	}
	.tok-kind,
	.tok-keyword {
		color: var(--accent);
	}
	.tok-id {
		color: var(--accent-2);
	}
	.tok-label,
	.tok-string {
		color: var(--warn);
	}
	.tok-number {
		color: var(--ok);
	}
	.tok-comment {
		color: var(--ink-faint);
		font-style: italic;
	}
	.line-kind {
		margin-left: auto;
		color: var(--ink-faint);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.ast li {
		border-bottom: 1px solid var(--line);
		padding-bottom: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.ast-id {
		color: var(--accent-2);
	}
	.ast-kind {
		color: var(--ink-faint);
	}
	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-1) 0 0 3.5ch;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
	}
	.fields div {
		display: flex;
		gap: var(--space-1);
	}
	.fields dt {
		color: var(--ink-faint);
	}
	.fields dt::after {
		content: '=';
	}
	.fields dd {
		margin: 0;
		color: var(--ink-mute);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
		margin: 0 0 var(--space-5);
	}
	.tiles div {
		background: var(--bg-panel);
		padding: var(--space-3) var(--space-4);
	}
	.tiles dt {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
		margin-bottom: var(--space-1);
	}
	.tiles dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		font-variant-numeric: tabular-nums;
	}
	.grid {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	.grid th {
		text-align: left;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
		font-weight: 500;
		padding: var(--space-2);
		border-bottom: 1px solid var(--line-strong);
	}
	.grid td {
		padding: var(--space-2);
		border-bottom: 1px solid var(--line);
	}
	.mono {
		font-family: var(--font-mono);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.relation {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		padding: 0.05rem 0.35rem;
		margin: 0 var(--space-1) var(--space-1) 0;
		color: var(--accent);
	}
	.heatmap {
		width: 100%;
		height: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg-inset);
	}
	.heat-bg {
		fill: var(--bg-inset);
	}
	.heat-cell {
		fill: var(--accent);
	}
	.traces li {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--line);
		font-size: var(--text-2xs);
	}
	.traces code {
		font-family: var(--font-mono);
		color: var(--ink-mute);
		word-break: break-all;
	}
	.rules li,
	.nets li,
	.findings li {
		display: flex;
		gap: var(--space-3);
		align-items: baseline;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--line);
		font-size: var(--text-sm);
	}
	.rule-state {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ok);
		min-width: 5ch;
	}
	li.is-fired .rule-state {
		color: var(--danger);
	}
	.rule-summary,
	.net-terminals {
		color: var(--ink-mute);
	}
	.preview {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg-inset);
		padding: var(--space-4);
		overflow-x: auto;
	}
	.preview :global(svg) {
		max-width: 100%;
		height: auto;
	}
	.headline {
		font-size: var(--text-md);
		margin: 0 0 var(--space-4);
	}
	.connections li {
		padding: var(--space-1) 0;
		color: var(--ink-mute);
		font-size: var(--text-sm);
	}
	@media (max-width: 960px) {
		.workbench {
			grid-template-columns: minmax(0, 1fr);
		}
		.stage-body {
			max-height: none;
			padding: var(--space-4);
		}
	}
</style>
