<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * Live install telemetry.
	 *
	 * The page holds one streaming connection open and re-renders whenever the
	 * server pushes a new reading. Nothing here polls, and nothing here fakes
	 * movement: npm settles a day's counts hours after the day closes, so the
	 * numbers step rather than tick, and the header says when it last looked.
	 */
	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import { liveDownloads } from './downloads.remote';
	import Seo from '#lib/components/Seo.svelte';
	import TimeSeries from '#lib/components/charts/TimeSeries.svelte';
	import BarSeries from '#lib/components/charts/BarSeries.svelte';

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
					{ label: 'Last 24 hours', value: count(snapshot.lastDay) },
					{ label: 'Last 7 days', value: count(snapshot.lastWeek) },
					{ label: 'Last 30 days', value: count(snapshot.lastMonth) },
					{
						label: 'Daily mean over 30 days',
						value: count(Math.round(snapshot.lastMonth / 30))
					}
				]
			: []
	);

	const peak = $derived(Math.max(1, ...(snapshot?.history ?? []).map((day) => day.downloads)));

	/* The chart components own their own geometry now, so this page only has to
	   say what the data means. The hand-rolled path maths, the label-pitch
	   thinning, and the per-dot `<title>` tooltips all lived here and are gone. */
	const seriesPoints = $derived(
		(snapshot?.history ?? []).map((day) => ({ label: dayLabel(day.day), value: day.downloads }))
	);

	/** Per-release share of the last week, heaviest first. */
	const versionBars = $derived.by(() => {
		const rows = snapshot?.byVersion ?? [];
		const total = rows.reduce((sum, row) => sum + row.downloads, 0) || 1;
		return rows.map((row) => ({
			label: `v${row.version}`,
			value: row.downloads,
			note: `${((row.downloads / total) * 100).toFixed(1)}% of the week`
		}));
	});
</script>

<Seo
	title={t('Install telemetry · schemd')}
	description={t(
		'Live npm download counts for @schemd/core: daily, weekly, and monthly installs, a 30-day trend, and the share carried by each published release.'
	)}
/>

<article class="downloads grid-backdrop">
	<SheetFrame label={t('Install telemetry')}>
		<header class="downloads-head sheet-head">
			<p class="microlabel stream" class:live={stream.connected}>
				<span class="stream-dot" aria-hidden="true"></span>
				{#if !stream.ready}
					{t('opening the stream…')}
				{:else if snapshot?.live}
					{t('Live, checked')} {t(clock.format(new Date(snapshot.checkedAt)))}
				{:else}
					{t('The registry did not answer; this is the last good reading')}
				{/if}
			</p>
			<h1>{t('Install telemetry')}</h1>
			<p class="lede">
				{t(
					'npm publishes counts, not a feed, so this page holds one streaming connection open and the server polls the registry once a minute on behalf of every reader. The counts step rather than tick — npm settles a day hours after it closes — so the header reports when it last looked instead of animating a number that has not moved.'
				)}
			</p>
		</header>
	</SheetFrame>

	{#if stream.error}
		<p class="notice plate" role="alert">
			{t('The telemetry stream failed:')}
			{t(stream.error.message)}
		</p>
	{:else if !stream.ready}
		<p class="notice plate">{t('Waiting for the first reading from the registry…')}</p>
	{:else if snapshot}
		<dl class="stat-band" aria-label={t('Downloads at a glance')}>
			{#each stats as stat (stat.label)}
				<div class="stat">
					<dd class="readout">{t(stat.value)}</dd>
					<dt class="microlabel">{t(stat.label)}</dt>
				</div>
			{/each}
		</dl>

		<section class="trend plate" aria-label={t('Daily downloads')}>
			<header class="panel-head">
				<p class="table-caption">
					{t('Daily installs over the last')}
					{t(snapshot.history.length)}
					{t('days')}
				</p>
				<span class="microlabel peak-note">{t('Peak')} {t(count(peak))} {t('/ day')}</span>
			</header>
			<TimeSeries
				points={seriesPoints}
				summary={t(
					'Daily installs of @schemd/core over the last {0} days, peaking at {1} per day.',
					[snapshot.history.length, count(peak)]
				)}
				format={count}
				unit="installs"
			/>
		</section>

		<section class="versions plate" aria-label={t('Downloads by release')}>
			<header class="panel-head">
				<p class="table-caption">{t('Installs last week, by release')}</p>
				<span class="microlabel peak-note"
					>{t(versionBars.length)} {t('releases with traffic')}</span
				>
			</header>
			{#if versionBars.length > 0}
				<BarSeries
					items={versionBars}
					summary={t('Installs attributed to each published release over the last week.')}
					format={count}
					unit="installs"
				/>
			{:else}
				<p class="microlabel empty">{t('No per-release breakdown in this snapshot.')}</p>
			{/if}
		</section>
	{/if}
</article>

<style>
	.downloads {
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
		padding-block: var(--space-8) var(--space-16);
	}

	.downloads-head {
		margin-block-end: var(--space-8);

		& h1 {
			font-size: var(--text-xl);
			margin-block: var(--space-2) var(--space-3);
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
			background: var(--ink);
			border-color: var(--ink);
			box-shadow: none;
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

		& .table-caption {
			margin-block-end: var(--space-4);
			flex: 1 1 20ch;
		}

		& .peak-note {
			flex: none;
		}
	}

	@media (max-width: 720px) {
		.stat-band {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
