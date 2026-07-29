<script lang="ts">
	/**
	 * Live install telemetry.
	 *
	 * The page holds one streaming connection open and re-renders whenever the
	 * server pushes a new reading. Nothing here polls, and nothing here fakes
	 * movement: npm settles a day's counts hours after the day closes, so the
	 * numbers step rather than tick, and the header says when it last looked.
	 */
	import { liveDownloads } from './downloads.remote';
	import type { DownloadDay } from '$lib/server/downloads';

	const stream = liveDownloads();
	const snapshot = $derived(stream.ready ? stream.current : undefined);

	const clock = new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
	const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

	function count(value: number): string {
		return value.toLocaleString('en-US');
	}

	function dayLabel(day: string): string {
		return dayFormat.format(new Date(`${day}T00:00:00Z`));
	}

	const stats = $derived(
		snapshot
			? [
					{ label: 'last 24 hours', value: count(snapshot.lastDay) },
					{ label: 'last 7 days', value: count(snapshot.lastWeek) },
					{ label: 'last 30 days', value: count(snapshot.lastMonth) },
					{
						label: 'daily mean · 30d',
						value: count(Math.round(snapshot.lastMonth / 30))
					}
				]
			: []
	);

	/* ---------- Native SVG daily series ---------- */
	const CHART_W = 720;
	const CHART_H = 210;
	const PAD_X = 46;
	const PAD_Y = 28;

	interface Plotted extends DownloadDay {
		readonly x: number;
		readonly y: number;
	}

	const peak = $derived(Math.max(1, ...(snapshot?.history ?? []).map((day) => day.downloads)));

	const points: readonly Plotted[] = $derived.by(() => {
		const history = snapshot?.history ?? [];
		if (history.length === 0) return [];
		const span = CHART_W - PAD_X * 2;
		const height = CHART_H - PAD_Y * 2;
		return history.map((day, index) => ({
			...day,
			x: PAD_X + (index * span) / Math.max(1, history.length - 1),
			y: CHART_H - PAD_Y - (day.downloads / peak) * height
		}));
	});

	const linePath = $derived(
		points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
	);
	const areaPath = $derived(
		linePath === ''
			? ''
			: `${linePath} L ${CHART_W - PAD_X} ${CHART_H - PAD_Y} L ${PAD_X} ${CHART_H - PAD_Y} Z`
	);

	/* Label only the days the axis can hold, first and last always. */
	const LABEL_PITCH = 74;
	const labelled: readonly boolean[] = $derived.by(() => {
		const total = points.length;
		if (total === 0) return [];
		const capacity = Math.max(2, Math.floor((CHART_W - PAD_X * 2) / LABEL_PITCH) + 1);
		const stride = Math.max(1, Math.ceil((total - 1) / (capacity - 1)));
		const keep = Array.from({ length: total }, (_, index) => index % stride === 0);
		keep[total - 1] = true;
		if (total > 1 && (total - 1) % stride !== 0) keep[total - 1 - ((total - 1) % stride)] = false;
		return keep;
	});

	/** Per-release share of the last week, widest bar first. */
	const shares = $derived.by(() => {
		const rows = snapshot?.byVersion ?? [];
		const top = rows[0]?.downloads ?? 1;
		const total = rows.reduce((sum, row) => sum + row.downloads, 0) || 1;
		return rows.map((row) => ({
			...row,
			width: row.downloads / top,
			percent: (row.downloads / total) * 100
		}));
	});
</script>

<svelte:head>
	<title>Install telemetry · schemd</title>
	<meta
		name="description"
		content="Live npm download counts for @schemd/core — daily, weekly, and monthly installs, a 30-day trend, and the share carried by each published release."
	/>
</svelte:head>

<article class="downloads grid-backdrop">
	<header class="downloads-head">
		<p class="microlabel stream" class:live={stream.connected}>
			<span class="stream-dot" aria-hidden="true"></span>
			{#if !stream.ready}
				opening the stream…
			{:else if snapshot?.live}
				streaming · checked {clock.format(new Date(snapshot.checkedAt))}
			{:else}
				registry unreachable · showing the last good reading
			{/if}
		</p>
		<h1>Install telemetry</h1>
		<p class="lede">
			npm publishes counts, not a feed, so this page holds one streaming connection open and the
			server polls the registry once a minute on behalf of every reader. The counts step rather than
			tick — npm settles a day hours after it closes — so the header reports when it last looked
			instead of animating a number that has not moved.
		</p>
	</header>

	{#if stream.error}
		<p class="notice plate" role="alert">
			The telemetry stream failed: {stream.error.message}
		</p>
	{:else if !stream.ready}
		<p class="notice plate">Waiting for the first reading from the registry…</p>
	{:else if snapshot}
		<dl class="stat-band" aria-label="Downloads at a glance">
			{#each stats as stat (stat.label)}
				<div class="stat">
					<dd class="readout">{stat.value}</dd>
					<dt class="microlabel">{stat.label}</dt>
				</div>
			{/each}
		</dl>

		<section class="trend plate" aria-label="Daily downloads">
			<header class="panel-head">
				<p class="eyebrow">daily installs · last {snapshot.history.length} days</p>
				<span class="microlabel peak-note">peak {count(peak)} / day</span>
			</header>
			{#if points.length > 1}
				<svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Daily installs">
					<defs>
						<linearGradient id="installs-fill" x1="0" y1="0" x2="0" y2="1">
							<stop class="fill-top" offset="0%" />
							<stop class="fill-bottom" offset="100%" />
						</linearGradient>
					</defs>
					{#each [0, 0.25, 0.5, 0.75, 1] as level (level)}
						<line
							class="grid"
							x1={PAD_X}
							x2={CHART_W - PAD_X}
							y1={PAD_Y + level * (CHART_H - PAD_Y * 2)}
							y2={PAD_Y + level * (CHART_H - PAD_Y * 2)}
						/>
					{/each}
					<path class="area" d={areaPath} />
					<path class="series" d={linePath} />
					{#each points as point, index (point.day)}
						<circle class="dot" cx={point.x} cy={point.y} r="3">
							<title>{dayLabel(point.day)} — {count(point.downloads)} installs</title>
						</circle>
						{#if labelled[index]}
							<text class="tick" x={point.x} y={CHART_H - PAD_Y + 16}>{dayLabel(point.day)}</text>
						{/if}
					{/each}
					<text class="peak" x={PAD_X} y={PAD_Y - 8}>{count(peak)}</text>
				</svg>
			{:else}
				<p class="microlabel empty">npm has not published a daily series for this window.</p>
			{/if}
		</section>

		<section class="versions plate" aria-label="Downloads by release">
			<header class="panel-head">
				<p class="eyebrow">where last week's installs landed</p>
				<span class="microlabel peak-note">{shares.length} releases with traffic</span>
			</header>
			{#if shares.length > 0}
				<ol class="share-list">
					{#each shares as share (share.version)}
						<li class="share">
							<code class="share-version">v{share.version}</code>
							<span class="share-track" aria-hidden="true">
								<span class="share-fill" style={`transform: scaleX(${share.width})`}></span>
							</span>
							<span class="share-count readout">{count(share.downloads)}</span>
							<span class="share-percent microlabel">{share.percent.toFixed(1)}%</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="microlabel empty">No per-release breakdown in this snapshot.</p>
			{/if}
		</section>
	{/if}
</article>

<style>
	.downloads {
		max-inline-size: 62rem;
		margin-inline: auto;
		padding: clamp(1.5rem, 4vw, var(--space-12)) clamp(1rem, 4vw, var(--space-8)) var(--space-16);
	}

	.downloads-head {
		margin-block-end: var(--space-8);

		& h1 {
			font-size: var(--text-xl);
			margin-block: var(--space-2) var(--space-3);
			letter-spacing: -0.025em;
		}
	}

	.lede {
		color: var(--ink-mute);
		max-inline-size: 68ch;
		margin: 0;
	}

	/* A stream indicator that tells the truth: filled while the connection is
	   open, hollow the moment it is not. */
	.stream {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);

		& .stream-dot {
			inline-size: 7px;
			block-size: 7px;
			border-radius: 50%;
			border: 1px solid var(--ink-faint);
		}

		&.live .stream-dot {
			background: var(--accent);
			border-color: var(--accent);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
			animation: stream-pulse 2.4s var(--ease-precise) infinite;
		}
	}

	@keyframes stream-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	.notice {
		padding: var(--space-5);
		color: var(--ink-mute);
	}

	.stat-band {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
		margin-block: 0 var(--space-6);
		background: var(--line);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		overflow: hidden;
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

	.trend,
	.versions {
		padding: var(--space-5);
		margin-block-end: var(--space-6);
	}

	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;

		& .eyebrow {
			margin-block-end: var(--space-4);
			flex: 1 1 20ch;
		}

		& .peak-note {
			flex: none;
		}
	}

	svg {
		inline-size: 100%;
		block-size: auto;
		overflow: visible;
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}

	.fill-top {
		stop-color: var(--accent);
		stop-opacity: 0.28;
	}

	.fill-bottom {
		stop-color: var(--accent);
		stop-opacity: 0;
	}

	.area {
		fill: url(#installs-fill);
	}

	.series {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.dot {
		fill: var(--bg-panel);
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.tick,
	.peak {
		font-family: var(--font-mono);
		font-size: 10px;
		fill: var(--ink-faint);
		text-anchor: middle;
	}

	.peak {
		text-anchor: start;
		fill: var(--accent);
	}

	.empty {
		margin: 0;
		padding-block: var(--space-4);
	}

	.share-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}

	.share {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr) 4.5rem 3.5rem;
		align-items: center;
		gap: var(--space-3);
	}

	.share-version {
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.share-track {
		block-size: 8px;
		background: var(--bg-inset);
		border: 1px solid var(--line);
		border-radius: 2px;
		overflow: hidden;
	}

	.share-fill {
		display: block;
		block-size: 100%;
		background: var(--accent-grad);
		transform-origin: left;
		transition: transform var(--dur-kinetic) var(--ease-kinetic);
	}

	.share-count {
		text-align: end;
		font-size: var(--text-sm);
	}

	.share-percent {
		text-align: end;
	}

	@media (max-width: 720px) {
		.stat-band {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.share {
			grid-template-columns: 4.5rem minmax(0, 1fr) 3.5rem;
		}

		.share-percent {
			display: none;
		}
	}
</style>
