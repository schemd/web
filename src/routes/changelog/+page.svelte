<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import MetricChart from '$lib/components/MetricChart.svelte';

	let { data }: PageProps = $props();

	function date(value: string | null): string {
		if (!value) return 'Date unavailable';
		return new Intl.DateTimeFormat('en', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			timeZone: 'UTC'
		}).format(new Date(value));
	}
</script>

<Seo
	title="schemd changelog — registry timeline and compiler benchmarks"
	description="The npm and GitHub synchronized release history for @schemd/core, with archived native SVG benchmark metrics."
	canonical="https://schemd.johnowolabiidogun.dev/changelog"
	type="article"
/>

<article class="changelog-page">
	<header class="changelog-hero">
		<div>
			<p class="eyebrow">REGISTRY CHANNEL / {data.registry.source}</p>
			<h1>The compiler’s<br />material history.</h1>
		</div>
		<div class="registry-readout">
			<span class="status-light"></span>
			<dl>
				<div>
					<dt>npm latest</dt>
					<dd>v{data.registry.registryLatest}</dd>
				</div>
				<div>
					<dt>site contract</dt>
					<dd>v{data.registry.supportedLatest}</dd>
				</div>
				<div>
					<dt>synced</dt>
					<dd>{date(data.registry.generatedAt)}</dd>
				</div>
			</dl>
			{#if data.registry.compatibilityNotice}<p>{data.registry.compatibilityNotice}</p>{/if}
		</div>
	</header>

	<section class="benchmark-section">
		<header>
			<p class="eyebrow">REPRODUCIBLE BENCHMARK ARCHIVE</p>
			<h2>Measured vectors, not decorative telemetry.</h2>
			<p>{data.benchmarkMethod}</p>
		</header>
		<div class="benchmark-grid">
			<MetricChart
				rows={data.benchmarks}
				metric="meanMilliseconds"
				label="Mean compile pass"
				unit="ms"
			/>
			<MetricChart
				rows={data.benchmarks}
				metric="installKibibytes"
				label="Installed package footprint"
				unit="KiB"
				color="var(--amber)"
			/>
			<MetricChart
				rows={data.benchmarks}
				metric="svgBytes"
				label="Canonical SVG output"
				unit="bytes"
				color="var(--blue)"
			/>
		</div>
	</section>

	<section class="timeline-section">
		<header>
			<p class="eyebrow">AUTOMATED RELEASE FEED</p>
			<h2>{data.timeline.length} registry milestones</h2>
		</header>
		<ol class="release-timeline">
			{#each data.timeline as release, index}
				<li id={`v${release.version}`}>
					<div class="timeline-axis"><span>{String(index + 1).padStart(2, '0')}</span><i></i></div>
					<article>
						<header>
							<div>
								<small>{date(release.publishedAt)}</small>
								<h3>v{release.version}</h3>
							</div>
							<div class="release-links">
								{#if release.githubUrl}<a href={release.githubUrl} rel="external">GitHub ↗</a>{/if}
								{#if release.npmTarball}<a href={release.npmTarball} rel="external">Tarball ↗</a
									>{/if}
							</div>
						</header>
						<ul>
							{#each release.notes as note}<li>{note}</li>{/each}
						</ul>
						<footer>
							<a
								href={release.version === data.registry.supportedLatest
									? `/docs/v${release.version}/overview`
									: `/changelog#v${release.version}`}>Release context</a
							>
							<code>{release.gitHash?.slice(0, 10) ?? 'hash pending'}</code>
							{#if release.npmUnpackedBytes}<span
									>{Math.round(release.npmUnpackedBytes / 1024)} KiB unpacked</span
								>{/if}
						</footer>
					</article>
				</li>
			{/each}
		</ol>
	</section>
</article>
