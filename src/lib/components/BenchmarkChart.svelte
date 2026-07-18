<script lang="ts">
	import { CORE_METRICS, formatBytes } from '$lib/generated/core-metrics';

	const compilerBudget = 20_000;
	let rows = $derived([
		{
			label: 'Compiler gzip',
			value: CORE_METRICS.compilerBundle.gzipBytes,
			maximum: compilerBudget,
			display: formatBytes(CORE_METRICS.compilerBundle.gzipBytes)
		},
		{
			label: 'npm tarball',
			value: CORE_METRICS.npmTarballBytes,
			maximum: 50_000,
			display: formatBytes(CORE_METRICS.npmTarballBytes)
		}
	]);
	let barPath = $derived(
		rows
			.map((row, index) => {
				const y = 42 + index * 72;
				const width = Math.min(420, (row.value / row.maximum) * 420);
				return `M40 ${y}H${(40 + width).toFixed(2)}`;
			})
			.join(' ')
	);
</script>

<section class="benchmark" aria-labelledby="benchmark-title">
	<header>
		<div>
			<p class="eyebrow">Verified benchmark envelope</p>
			<h2 id="benchmark-title">One release is measured. The chart says exactly that.</h2>
		</div>
		<p>Core commit <code>{CORE_METRICS.sourceCommit}</code></p>
	</header>
	<div class="benchmark-grid">
		<svg
			viewBox="0 0 500 190"
			role="img"
			aria-labelledby="benchmark-chart-title benchmark-chart-description"
		>
			<title id="benchmark-chart-title">Current package payload measurements</title>
			<desc id="benchmark-chart-description"
				>Two horizontal bars compare compiler gzip and npm tarball byte counts against their
				displayed scales.</desc
			>
			<path class="grid" d="M40 20V165M145 20V165M250 20V165M355 20V165M460 20V165" />
			<path class="bars" d={barPath} />
			{#each rows as row, index (row.label)}
				<text x="40" y={31 + index * 72}>{row.label}</text><text
					class="value"
					x="460"
					y={31 + index * 72}
					text-anchor="end">{row.display}</text
				>
			{/each}
		</svg>
		<dl>
			<div>
				<dt>Compiler budget</dt>
				<dd>&lt; 20.0 kB gzip</dd>
			</div>
			<div>
				<dt>Compiler used</dt>
				<dd>{((CORE_METRICS.compilerBundle.gzipBytes / compilerBudget) * 100).toFixed(1)}%</dd>
			</div>
			<div>
				<dt>Coverage</dt>
				<dd>{CORE_METRICS.coverage.statements}%</dd>
			</div>
			<div>
				<dt>Core tests</dt>
				<dd>{CORE_METRICS.testCount}</dd>
			</div>
		</dl>
	</div>
	<p class="notice">
		Historical execution-time and payload series are not reconstructed from release tags that did
		not publish equivalent measurements. New points can be added only when the same benchmark
		protocol is recorded.
	</p>
</section>

<style>
	.benchmark {
		margin-block-end: 5rem;
		border: 1px solid var(--line-strong);
		background: var(--ink-1);
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		border-block-end: 1px solid var(--line);
		padding: clamp(1rem, 3vw, 2rem);
	}
	header h2 {
		max-inline-size: 22ch;
		margin-block-start: 0.5rem;
		font-size: var(--step-2);
	}
	header > p {
		align-self: start;
		color: var(--muted);
		font-size: 0.72rem;
	}
	.benchmark-grid {
		display: grid;
		grid-template-columns: minmax(20rem, 1.25fr) minmax(14rem, 0.75fr);
	}
	svg {
		inline-size: 100%;
		block-size: auto;
		border-inline-end: 1px solid var(--line);
		background: var(--ink-0);
	}
	.grid {
		fill: none;
		stroke: var(--line);
		stroke-width: 0.7;
	}
	.bars {
		fill: none;
		stroke: var(--signal);
		stroke-width: 16;
	}
	text {
		fill: var(--muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	text.value {
		fill: var(--paper-soft);
	}
	dl {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		margin: 0;
	}
	dl div {
		padding: 1rem;
	}
	dl div:nth-child(odd) {
		border-inline-end: 1px solid var(--line);
	}
	dl div:nth-child(-n + 2) {
		border-block-end: 1px solid var(--line);
	}
	dt {
		color: var(--muted);
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0.2rem 0 0;
		font-family: var(--font-mono);
	}
	.notice {
		margin: 0;
		border-block-start: 1px solid var(--line);
	}
	@media (max-width: 46rem) {
		header,
		.benchmark-grid {
			display: grid;
			grid-template-columns: 1fr;
		}
		svg {
			border-block-end: 1px solid var(--line);
			border-inline-end: 0;
		}
	}
</style>
