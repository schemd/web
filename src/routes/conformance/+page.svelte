<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	/**
	 * Conformance report.
	 *
	 * Every diagram in the documentation, run through `verifyNetlist` at request
	 * time from the same sources the docs render. A rule demonstrated on toy
	 * fixtures proves nothing; this is the corpus a reader can open and check.
	 */
	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import BarSeries, { type BarTone } from '#lib/components/charts/BarSeries.svelte';

	let { data }: PageProps = $props();

	const clean = $derived(data.totals.diagrams > 0 && data.flagged.length === 0);

	/*
	 * Severity maps onto the reserved status hues, never onto a categorical slot.
	 * The palette validator puts warning and info inside the 6-8 CVD floor band
	 * for protanopia, which is legal only alongside a second channel — so every
	 * bar also prints its severity as text, and the ordering carries the rest.
	 */
	const TONE: Record<string, BarTone> = {
		error: 'danger',
		warning: 'warn',
		info: 'ok'
	};

	const ruleBars = $derived(
		data.byRule.map((rule) => ({
			label: rule.code,
			value: rule.count,
			note: rule.summary,
			tone: TONE[rule.severity] ?? 'default'
		}))
	);
</script>

<Seo
	title={t('Conformance · schemd')}
	description={t(
		"Every documented schemd diagram checked against the compiler's design rules: shorted rails, width and domain mismatches, contended drivers, and disconnected subcircuits."
	)}
/>

<article class="conformance">
	<SheetFrame label={t('Conformance')}>
		<header class="sheet-head">
			<p class="kicker">{t('Corpus / Design rules')}</p>
			<h1>{t('Every documented diagram, checked')}</h1>
			<p class="lede">
				{t(
					"`verifyNetlist` runs over every `schemd` fence in the documentation. The rules are the compiler's own, so what passes here is what passes in your build."
				)}
			</p>
		</header>
	</SheetFrame>

	<dl class="tally">
		<div>
			<dt>{t('Diagrams')}</dt>
			<dd>{t(data.totals.diagrams)}</dd>
		</div>
		<div>
			<dt>{t('Clean')}</dt>
			<dd class="ok">{t(data.totals.clean)}</dd>
		</div>
		<div>
			<dt>{t('Errors')}</dt>
			<dd class:bad={data.totals.errors > 0}>{t(data.totals.errors)}</dd>
		</div>
		<div>
			<dt>{t('Warnings')}</dt>
			<dd>{t(data.totals.warnings)}</dd>
		</div>
		<div>
			<dt>{t('Notes')}</dt>
			<dd>{t(data.totals.infos)}</dd>
		</div>
		<div>
			<dt>{t('Demonstrations')}</dt>
			<dd>{t(data.totals.demonstrations)}</dd>
		</div>
	</dl>

	{#if data.byRule.length}
		<section aria-labelledby="rules-heading">
			<h2 id="rules-heading">{t('Which rules fired')}</h2>
			<BarSeries
				items={ruleBars}
				summary={t('How many documented diagrams each design rule fired on, by severity.')}
				unit="diagrams"
			/>
		</section>
	{/if}

	{#if data.demonstrations.length}
		<section aria-labelledby="demo-heading">
			<h2 id="demo-heading">{t('Deliberate demonstrations')}</h2>
			<p class="lede">
				{t(
					'Pages that teach a rule must break it. These diagrams declare the diagnostics they expect, so they never masquerade as defects.'
				)}
			</p>
			<ul class="flagged">
				{#each data.demonstrations as entry (entry.id)}
					<li>
						<h3>
							{t(entry.title)}
							<a href={href('/docs/latest/' + entry.doc)}>{t(entry.doc)}</a>
						</h3>
						<ul>
							{#each entry.expected as diagnostic (diagnostic.code + diagnostic.message)}
								<li>
									<span class="severity {diagnostic.severity}">{t('expected')}</span>
									<span class="code">{t(diagnostic.code)}</span>
									<span>{t(diagnostic.message)}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="service-heading">
		<h2 id="service-heading">{t('Check your own diagrams')}</h2>
		<p class="lede">
			{t(
				'The same rules run as a service, so a project can gate its own build without installing the compiler. Nothing is stored and no source leaves the request.'
			)}
		</p>
		<pre class="usage"><code
				>curl -X POST https://schemd.johnowolabiidogun.dev/api/verify \
  -H 'content-type: application/json' \
  -d '&lbrace;"source": "source:V1 \"AC\" at (100,150) #blue [type=voltage-ac]\n..."&rbrace;'

&lbrace;"ok": false, "counts": &lbrace;"errors": 1, "warnings": 0, "notes": 0&rbrace;,
 "diagnostics": [&lbrace;"code": "shorted-supply", "severity": "error", "line": 4, ...&rbrace;]&rbrace;</code
			></pre>
		<p class="lede">
			<code>ok</code>
			{t('answers the only question a build asks. The badge below reports this corpus:')}
		</p>
		<p>
			<img
				src="/badge/conformance.svg"
				alt={t('schemd conformance badge')}
				width="228"
				height="20"
			/>
		</p>
	</section>

	<section aria-labelledby="flagged-heading">
		<h2 id="flagged-heading">{t('Flagged diagrams')}</h2>
		{#if clean}
			<p class="clean">
				{t('Every one of the')}
				{t(data.totals.diagrams)}
				{t('documented diagrams passes every rule.')}
			</p>
		{:else}
			<ul class="flagged">
				{#each data.flagged as entry (entry.id)}
					<li class={entry.verdict}>
						<h3>
							{t(entry.title)}
							<a href={href('/docs/latest/' + entry.doc)}>{t(entry.doc)}</a>
						</h3>
						<ul>
							{#each entry.diagnostics as diagnostic (diagnostic.code + diagnostic.message)}
								<li>
									<span class="severity {diagnostic.severity}">{t(diagnostic.severity)}</span>
									<span class="code">{t(diagnostic.code)}</span>
									<span>{t(diagnostic.message)}</span>
									{#if diagnostic.line !== undefined}<span class="line"
											>{t('line')} {t(diagnostic.line)}</span
										>{/if}
								</li>
							{/each}
						</ul>
						<a class="open" href={href('/playground/latest?code=' + entry.code)}
							>{t('Open in the playground')}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</article>

<style>
	.conformance {
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
		padding-block: var(--space-8) var(--space-16);
		display: grid;
		gap: var(--space-6);
	}
	.kicker {
		margin: 0 0 var(--space-1);
		color: var(--ink);
		font: 600 0.7rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
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
		font: 500 0.66rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.tally dd {
		margin: var(--space-2) 0 0;
		font: 600 1.6rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.tally .ok {
		color: var(--ink);
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
	/* Four fixed columns need ~21rem before the summary gets a pixel, so the
	   row stacks rather than pushing its prose off a phone screen. */
	.rules li {
		display: grid;
		grid-template-columns: 3rem minmax(0, 12rem) 6rem minmax(0, 1fr);
		gap: var(--space-3);
		align-items: baseline;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg-raised);
	}

	@media (max-width: 640px) {
		.rules li {
			grid-template-columns: 3rem minmax(0, 1fr);
			row-gap: var(--space-1);
		}

		.rules .summary {
			grid-column: 1 / -1;
		}
	}
	.count {
		font: 600 1rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.code {
		font: 500 0.78rem/1.4 var(--font-mono);
		color: var(--ink-mute);
	}
	.severity {
		font: 500 0.66rem/1.4 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.severity.error {
		color: var(--danger);
	}
	.severity.warning {
		color: var(--ink);
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
		border-inline-start-color: var(--ink);
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
		font: 500 0.7rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
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
		font: 500 0.72rem/1.4 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.open {
		font: 500 0.7rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.clean {
		margin: 0;
		color: var(--ink);
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
