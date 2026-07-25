<script lang="ts">
	/**
	 * Conformance report.
	 *
	 * Every diagram in the documentation, run through `verifyNetlist` at request
	 * time from the same sources the docs render. A rule demonstrated on toy
	 * fixtures proves nothing; this is the corpus a reader can open and check.
	 */
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clean = $derived(data.totals.diagrams > 0 && data.flagged.length === 0);
</script>

<svelte:head>
	<title>Conformance · schemd</title>
	<meta
		name="description"
		content="Every documented schemd diagram checked against the compiler's design rules: shorted rails, width and domain mismatches, contended drivers, and disconnected subcircuits."
	/>
</svelte:head>

<main class="conformance">
	<header>
		<p class="kicker">Corpus / Design rules</p>
		<h1>Every documented diagram, checked</h1>
		<p class="lede">
			`verifyNetlist` runs over every `schemd` fence in the documentation. The rules are the
			compiler's own, so what passes here is what passes in your build.
		</p>
	</header>

	<dl class="tally">
		<div>
			<dt>Diagrams</dt>
			<dd>{data.totals.diagrams}</dd>
		</div>
		<div>
			<dt>Clean</dt>
			<dd class="ok">{data.totals.clean}</dd>
		</div>
		<div>
			<dt>Errors</dt>
			<dd class:bad={data.totals.errors > 0}>{data.totals.errors}</dd>
		</div>
		<div>
			<dt>Warnings</dt>
			<dd>{data.totals.warnings}</dd>
		</div>
		<div>
			<dt>Notes</dt>
			<dd>{data.totals.infos}</dd>
		</div>
		<div>
			<dt>Demonstrations</dt>
			<dd>{data.totals.demonstrations}</dd>
		</div>
	</dl>

	{#if data.byRule.length}
		<section aria-labelledby="rules-heading">
			<h2 id="rules-heading">Which rules fired</h2>
			<ul class="rules">
				{#each data.byRule as rule (rule.code)}
					<li>
						<span class="count">{rule.count}</span>
						<span class="code">{rule.code}</span>
						<span class="severity {rule.severity}">{rule.severity}</span>
						<span class="summary">{rule.summary}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.demonstrations.length}
		<section aria-labelledby="demo-heading">
			<h2 id="demo-heading">Deliberate demonstrations</h2>
			<p class="lede">
				Pages that teach a rule must break it. These diagrams declare the diagnostics they expect,
				so they never masquerade as defects.
			</p>
			<ul class="flagged">
				{#each data.demonstrations as entry (entry.id)}
					<li>
						<h3>
							{entry.title}
							<a href="/docs/latest/{entry.doc}">{entry.doc}</a>
						</h3>
						<ul>
							{#each entry.expected as diagnostic (diagnostic.code + diagnostic.message)}
								<li>
									<span class="severity {diagnostic.severity}">expected</span>
									<span class="code">{diagnostic.code}</span>
									<span>{diagnostic.message}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="service-heading">
		<h2 id="service-heading">Check your own diagrams</h2>
		<p class="lede">
			The same rules run as a service, so a project can gate its own build without installing the
			compiler. Nothing is stored and no source leaves the request.
		</p>
		<pre class="usage"><code
				>curl -X POST https://schemd.johnowolabiidogun.dev/api/verify \
  -H 'content-type: application/json' \
  -d '&lbrace;"source": "source:V1 \"AC\" at (100,150) #blue [type=voltage-ac]\n..."&rbrace;'

&lbrace;"ok": false, "counts": &lbrace;"errors": 1, "warnings": 0, "notes": 0&rbrace;,
 "diagnostics": [&lbrace;"code": "shorted-supply", "severity": "error", "line": 4, ...&rbrace;]&rbrace;</code
			></pre>
		<p class="lede">
			<code>ok</code> answers the only question a build asks. The badge below reports this corpus:
		</p>
		<p>
			<img src="/badge/conformance.svg" alt="schemd conformance badge" width="228" height="20" />
		</p>
	</section>

	<section aria-labelledby="flagged-heading">
		<h2 id="flagged-heading">Flagged diagrams</h2>
		{#if clean}
			<p class="clean">
				Every one of the {data.totals.diagrams} documented diagrams passes every rule.
			</p>
		{:else}
			<ul class="flagged">
				{#each data.flagged as entry (entry.id)}
					<li class={entry.verdict}>
						<h3>
							{entry.title}
							<a href="/docs/latest/{entry.doc}">{entry.doc}</a>
						</h3>
						<ul>
							{#each entry.diagnostics as diagnostic (diagnostic.code + diagnostic.message)}
								<li>
									<span class="severity {diagnostic.severity}">{diagnostic.severity}</span>
									<span class="code">{diagnostic.code}</span>
									<span>{diagnostic.message}</span>
									{#if diagnostic.line !== undefined}<span class="line">line {diagnostic.line}</span
										>{/if}
								</li>
							{/each}
						</ul>
						<a class="open" href="/playground/latest?code={entry.code}">Open in the playground</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.conformance {
		display: grid;
		gap: var(--space-6);
		max-inline-size: 68rem;
		margin-inline: auto;
		padding: var(--space-6) var(--space-4) var(--space-8);
	}
	.kicker {
		margin: 0 0 var(--space-1);
		color: var(--accent);
		font: 600 0.7rem/1 var(--font-mono);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0 0 var(--space-2);
	}
	.lede {
		max-inline-size: 62ch;
		margin: 0;
		color: var(--ink-mute);
	}
	h2 {
		margin: 0 0 var(--space-3);
		font-size: 1.1rem;
	}
	.tally {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-3);
		margin: 0;
	}
	.tally div {
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-raised);
	}
	.tally dt {
		color: var(--ink-mute);
		font: 500 0.66rem/1 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.tally dd {
		margin: var(--space-2) 0 0;
		font: 600 1.6rem/1 var(--font-mono);
	}
	.tally .ok {
		color: var(--accent);
	}
	.tally .bad {
		color: var(--danger);
	}
	.rules,
	.flagged {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rules li {
		display: grid;
		grid-template-columns: 3rem 12rem 6rem 1fr;
		gap: var(--space-3);
		align-items: baseline;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-raised);
	}
	.count {
		font: 600 1rem/1 var(--font-mono);
	}
	.code {
		font: 500 0.78rem/1.4 var(--font-mono);
		color: var(--ink-mute);
	}
	.severity {
		font: 500 0.66rem/1.4 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.severity.error {
		color: var(--danger);
	}
	.severity.warning {
		color: var(--accent-2, var(--accent));
	}
	.severity.info {
		color: var(--ink-faint);
	}
	.flagged > li {
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-inline-start: 3px solid var(--ink-faint);
		background: var(--bg-raised);
	}
	.flagged > li.error {
		border-inline-start-color: var(--danger);
	}
	.flagged > li.warning {
		border-inline-start-color: var(--accent-2, var(--accent));
	}
	.flagged h3 {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: baseline;
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	.flagged h3 a {
		color: var(--ink-mute);
		font: 500 0.7rem/1 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.flagged ul {
		display: grid;
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.flagged ul li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: baseline;
		font-size: 0.92rem;
	}
	.line {
		color: var(--ink-faint);
		font: 500 0.72rem/1.4 var(--font-mono);
	}
	.open {
		font: 500 0.7rem/1 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.clean {
		margin: 0;
		color: var(--accent);
	}
	.usage {
		overflow-x: auto;
		margin: var(--space-3) 0;
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-inset);
		font-size: 0.82rem;
		line-height: 1.6;
	}
</style>
