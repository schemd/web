<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

	/** Oldest-first for the chart axes; feed stays newest-first. */
	const chronological = $derived([...data.releases].reverse());

	/* ---------- Native SVG metric chart: install footprint per release ---------- */
	const CHART_W = 620;
	const CHART_H = 200;
	const PAD = 40;

	const sizePoints = $derived.by(() => {
		const sized = chronological.filter((release) => release.unpackedSize !== undefined);
		if (sized.length === 0) return [];
		const max = Math.max(...sized.map((release) => release.unpackedSize ?? 0), 1);
		const span = CHART_W - PAD * 2;
		return sized.map((release, index) => ({
			version: release.version,
			bytes: release.unpackedSize ?? 0,
			x: PAD + (index * span) / Math.max(1, sized.length - 1),
			y: CHART_H - PAD - ((release.unpackedSize ?? 0) / max) * (CHART_H - PAD * 2)
		}));
	});

	/** Line path; a single release renders as a flat baseline segment + dot. */
	const linePath = $derived.by(() => {
		if (sizePoints.length === 0) return '';
		if (sizePoints.length === 1) {
			const only = sizePoints[0]!;
			return `M ${PAD} ${only.y} L ${CHART_W - PAD} ${only.y}`;
		}
		return sizePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	});

	const areaPath = $derived(
		linePath === ''
			? ''
			: `${linePath} L ${CHART_W - PAD} ${CHART_H - PAD} L ${PAD} ${CHART_H - PAD} Z`
	);

	const gridLines = [0, 0.25, 0.5, 0.75, 1];

	/**
	 * Which release ticks get a printed label.
	 *
	 * Every release used to be labelled, so the axis turned into overlapping
	 * ink the moment the history grew past a handful. Labels are thinned to
	 * whatever the axis can actually hold — first and last always survive,
	 * because those are the two a reader looks for — while every release keeps
	 * its dot and its hover title.
	 */
	const LABEL_PITCH = 58;
	/** Per-point flag, parallel to `sizePoints`: does this release print a label? */
	const labelledTicks: readonly boolean[] = $derived.by(() => {
		const count = sizePoints.length;
		if (count === 0) return [];
		const capacity = Math.max(2, Math.floor((CHART_W - PAD * 2) / LABEL_PITCH) + 1);
		const stride = Math.max(1, Math.ceil((count - 1) / (capacity - 1)));
		const keep = Array.from({ length: count }, (_, index) => index % stride === 0);
		const last = count - 1;
		/* The final release anchors the axis. If the strided label before it
		 * lands within a label's width, that one goes rather than the anchor. */
		const pitch = (CHART_W - PAD * 2) / Math.max(1, last);
		const previous = last - (last % stride);
		if (previous !== last && (last - previous) * pitch < LABEL_PITCH) keep[previous] = false;
		keep[last] = true;
		return keep;
	});

	function formatBytes(bytes: number | undefined): string {
		if (bytes === undefined) return '—';
		if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
		return `${(bytes / 1024).toFixed(1)} KiB`;
	}

	const taggedRelease = $derived(
		data.releases.find((release) => release.version === data.latest && release.released)
	);

	const stats = $derived([
		{ label: data.live ? 'npm latest' : 'seed default', value: `v${data.latest}` },
		{ label: 'installed engine', value: `v${data.benchmark.version}` },
		{ label: 'releases tracked', value: String(data.releases.length) },
		{ label: 'median compile', value: `${data.benchmark.medianMs} ms` },
		{ label: 'workload output', value: `${data.benchmark.svgBytes.toLocaleString('en-US')} B` },
		/* An em dash reads as "zero" next to five live numbers. Until npm
		 * confirms the tagged release, say what is actually true. */
		{
			label: 'latest install',
			value:
				taggedRelease?.unpackedSize === undefined
					? 'pending'
					: formatBytes(taggedRelease.unpackedSize)
		}
	]);
</script>

<Seo
	title="Changelog · schemd"
	description="Registry-synced release timeline for @schemd/core: install footprint, file counts, publication dates, and compiler benchmarks measured on this server."
	type="article"
/>

<article class="changelog grid-backdrop">
	<header class="changelog-head">
		<p class="microlabel sync" class:live={data.live}>
			<span class="sync-dot" aria-hidden="true"></span>
			{data.live
				? `registry synced ${dateFormat.format(new Date(data.syncedAt))}`
				: 'serving seed — registry refresh runs in the background'}
		</p>
		<h1>Changelog</h1>
		<p class="lede">
			The server returns a deterministic snapshot immediately, then refreshes npm and GitHub in the
			background. npm’s <code>latest</code> tag identifies the public release after a live refresh; the
			installed engine version is read independently from its package manifest. Unpublished local builds
			and cold-start seeds remain explicitly marked as publication-unconfirmed.
		</p>
	</header>

	<dl class="stat-band" aria-label="Compiler at a glance">
		{#each stats as stat (stat.label)}
			<div class="stat">
				<dd class="readout">{stat.value}</dd>
				<dt class="microlabel">{stat.label}</dt>
			</div>
		{/each}
	</dl>

	<section class="metrics plate" aria-label="Compiler metrics">
		<div class="metrics-grid">
			<figure class="metric">
				<figcaption class="microlabel">unpacked install footprint by release</figcaption>
				{#if sizePoints.length > 0}
					<svg
						viewBox={`0 0 ${CHART_W} ${CHART_H}`}
						role="img"
						aria-label="Install footprint per release"
					>
						<defs>
							<linearGradient id="footprint-fill" x1="0" y1="0" x2="0" y2="1">
								<stop class="fill-top" offset="0%" />
								<stop class="fill-bottom" offset="100%" />
							</linearGradient>
						</defs>
						{#each gridLines as level (level)}
							<line
								class="grid"
								x1={PAD}
								x2={CHART_W - PAD}
								y1={PAD + level * (CHART_H - PAD * 2)}
								y2={PAD + level * (CHART_H - PAD * 2)}
							/>
						{/each}
						<path class="area" d={areaPath} />
						<path class="series" d={linePath} />
						{#each sizePoints as point, index (point.version)}
							<circle class="dot" cx={point.x} cy={point.y} r="4">
								<title>v{point.version} — {formatBytes(point.bytes)}</title>
							</circle>
							{#if labelledTicks[index]}
								<text class="tick" x={point.x} y={CHART_H - PAD + 16}>v{point.version}</text>
							{/if}
						{/each}
						<text class="peak" x={PAD} y={PAD - 10}
							>{formatBytes(Math.max(...sizePoints.map((p) => p.bytes)))}</text
						>
					</svg>
				{:else}
					<p class="microlabel empty">npm dist metadata unavailable in this snapshot.</p>
				{/if}
			</figure>

			<dl class="bench">
				<div>
					<dt class="microlabel">engine processing speed</dt>
					<dd class="readout big">{data.benchmark.medianMs} ms</dd>
					<dd class="bench-note">
						median of 9 passes over an 11-declaration workload, measured live on this server against
						the installed compiler (v{data.benchmark.version})
					</dd>
				</div>
				<div>
					<dt class="microlabel">workload output weight</dt>
					<dd class="readout big">{data.benchmark.svgBytes.toLocaleString('en-US')} B</dd>
					<dd class="bench-note">exact UTF-8 bytes reported by the compiler's own metrics</dd>
				</div>
			</dl>
		</div>
	</section>

	<ol class="timeline" aria-label="Release history">
		{#each data.releases as release (release.version)}
			<li class="milestone" class:is-latest={release.version === data.latest}>
				<div class="milestone-marker" aria-hidden="true"></div>
				<div class="milestone-body plate">
					<header class="milestone-head">
						<h2>
							v{release.version}
							{#if release.version === data.latest}
								<span class="latest-tag">{data.live ? 'npm latest' : 'seed default'}</span>
							{/if}
							{#if !release.released}
								<span class="latest-tag">publication unconfirmed</span>
							{/if}
						</h2>
						<span class="microlabel">
							{release.publishedAt.startsWith('1970')
								? release.released
									? 'publish metadata unavailable in seed'
									: 'publication not confirmed'
								: dateFormat.format(new Date(release.publishedAt))}
							{#if release.gitHead}
								· <code>{release.gitHead}</code>
							{/if}
						</span>
					</header>
					<dl class="milestone-metrics">
						<div>
							<dt class="microlabel">install</dt>
							<dd class="readout">{formatBytes(release.unpackedSize)}</dd>
						</div>
						<div>
							<dt class="microlabel">files</dt>
							<dd class="readout">{release.fileCount ?? '—'}</dd>
						</div>
					</dl>
					{#if release.notes}
						<p class="notes">{release.notes.slice(0, 400)}</p>
					{/if}
					<nav class="milestone-links" aria-label={`Version ${release.version} destinations`}>
						<a href={`/docs/${release.version}/overview`}>docs →</a>
						<a href={`/playground/${release.version}`}>playground →</a>
						<a href={`/simulations/${release.version}`}>lab →</a>
					</nav>
				</div>
			</li>
		{/each}
	</ol>
</article>

<style>
	.changelog {
		max-inline-size: 940px;
		margin-inline: auto;
		padding: clamp(1rem, 4vw, 3rem);
	}

	.changelog-head h1 {
		font-size: var(--text-xl);
		margin-block: var(--space-2);
	}

	.sync {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-faint);

		& .sync-dot {
			inline-size: 7px;
			block-size: 7px;
			border-radius: 50%;
			background: var(--ink-faint);
		}

		&.live .sync-dot {
			background: var(--ok);
			box-shadow: 0 0 6px var(--ok);
			animation: sync-pulse 2.4s ease-in-out infinite;
		}
	}

	@keyframes sync-pulse {
		50% {
			opacity: 0.4;
		}
	}

	.lede {
		color: var(--ink-mute);
		max-inline-size: 68ch;
	}

	/* ---------- Stat band ----------
	   Six readouts inside a reading-width column. `auto-fit` picked whatever
	   count fit the viewport — not this column — and stranded the remainder on
	   a half-empty row. The track count is stated explicitly instead, and every
	   value divides six exactly, so the band is always a full rectangle. */
	.stat-band {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		overflow: hidden;
		margin-block: var(--space-6);
		box-shadow: var(--shadow-plate);
	}

	.stat {
		background-color: var(--bg-panel);
		background-image: var(--sheen);
		padding: var(--space-4);
		display: grid;
		gap: 2px;
		align-content: start;

		& .readout {
			font-size: var(--text-lg);
			white-space: nowrap;
		}

		& dt {
			color: var(--ink-faint);
		}
	}

	/* ---------- Metrics ---------- */
	.metrics {
		padding: var(--space-5);
		margin-block: var(--space-6);
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(220px, 2fr);
		gap: var(--space-6);
		align-items: start;
	}

	.metric {
		margin: 0;

		& svg {
			inline-size: 100%;
			block-size: auto;
			background: var(--bg-inset);
			border: 1px solid var(--line);
			margin-block-start: var(--space-2);
		}
	}

	.grid {
		stroke: var(--line);
		stroke-width: 0.5;
	}

	.area {
		fill: url(#footprint-fill);
		stroke: none;
	}

	.fill-top {
		stop-color: var(--accent);
		stop-opacity: 0.28;
	}

	.fill-bottom {
		stop-color: var(--accent);
		stop-opacity: 0;
	}

	.series {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.75;
		filter: drop-shadow(0 0 3px var(--glow));
	}

	.dot {
		fill: var(--accent);
		stroke: var(--bg-inset);
		stroke-width: 1.5;
	}

	.tick {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 9px;
		text-anchor: middle;
	}

	.peak {
		fill: var(--ink-mute);
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.empty {
		padding: var(--space-4);
	}

	.bench {
		display: grid;
		gap: var(--space-5);
		margin: 0;

		& dd {
			margin: 0;
		}

		& .big {
			font-size: var(--text-xl);
			letter-spacing: -0.02em;
		}
	}

	.bench-note {
		font-size: var(--text-xs);
		color: var(--ink-faint);
		margin-block-start: var(--space-1);
	}

	/* ---------- Vertical chronology ---------- */
	.timeline {
		list-style: none;
		margin: var(--space-8) 0 0;
		padding: 0;
		position: relative;

		&::before {
			content: '';
			position: absolute;
			inset-block: 0;
			inset-inline-start: 7px;
			inline-size: 1px;
			background: var(--line-strong);
		}
	}

	.milestone {
		display: grid;
		grid-template-columns: 16px minmax(0, 1fr);
		gap: var(--space-4);
		margin-block-end: var(--space-5);
	}

	.milestone-marker {
		inline-size: 15px;
		block-size: 15px;
		margin-block-start: var(--space-4);
		border: 1px solid var(--accent);
		background: var(--bg);
		box-shadow:
			inset 0 0 0 3px var(--bg),
			inset 0 0 0 15px var(--accent);
	}

	.milestone-body {
		padding: var(--space-4);
	}

	.milestone-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;

		& h2 {
			font-family: var(--font-mono);
			font-size: var(--text-md);
		}
	}

	.latest-tag {
		font-size: var(--text-2xs);
		font-family: var(--font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent-ink);
		background: var(--accent);
		padding: 0.05rem 0.45rem;
		vertical-align: middle;
	}

	.milestone-metrics {
		display: flex;
		gap: var(--space-8);
		margin-block: var(--space-3);

		& dd {
			margin: 0;
		}
	}

	.notes {
		color: var(--ink-mute);
		font-size: var(--text-sm);
		white-space: pre-line;
	}

	.milestone-links {
		display: flex;
		gap: var(--space-4);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		border-block-start: 1px solid var(--line);
		padding-block-start: var(--space-2);
	}

	@media (max-width: 720px) {
		.stat-band {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
