<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { RELEASES } from '$lib/content/releases';
	import { ROADMAP_SOURCE, TIMELINE_ITEMS, type TimelineStatus } from '$lib/generated/timeline';
	import { breadcrumbSchema } from '$lib/seo';

	const statusGroups = [
		{ status: 'planned', label: 'Planned work', note: 'Ordered by the current core roadmap.' },
		{ status: 'active', label: 'Active work', note: 'No roadmap item is publicly claimed right now.' },
		{ status: 'blocked', label: 'Blocked work', note: 'No roadmap item is recorded as blocked right now.' }
	] as const satisfies readonly { status: TimelineStatus; label: string; note: string }[];
	const schema = breadcrumbSchema([
		{ name: 'Schemd', path: '/' },
		{ name: 'Implementation timeline', path: '/timeline' }
	]);
</script>

<Seo
	title="Implementation timeline — Schemd"
	description="The public @schemd/core work queue, current status, priorities, dependencies, and completed releases."
	path="/timeline"
	structuredData={schema}
/>

<div class="timeline-page page-shell">
	<header class="timeline-hero">
		<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Timeline</li></ol></nav>
		<p class="eyebrow">Public implementation timeline</p>
		<h1>Known limits, in working order.</h1>
		<p class="lede">This is an active engineering queue, not a set of release promises. Priorities describe correctness and leverage; expected releases stay unset until the work is understood.</p>
		<div class="timeline-source"><span class="status-dot"></span><p>Generated from <a href={`${ROADMAP_SOURCE.repository}/blob/${ROADMAP_SOURCE.commit}/${ROADMAP_SOURCE.path}`}>core ROADMAP.md at {ROADMAP_SOURCE.commit}</a> on {ROADMAP_SOURCE.generatedAt}.</p></div>
	</header>

	<section class="phase-map" aria-labelledby="phase-title">
		<h2 id="phase-title" class="visually-hidden">Roadmap phases</h2>
		<ol>
			<li><span>Now</span><strong>Topology + routing</strong><small>Correctness foundation</small></li>
			<li><span>Next</span><strong>Visual precision</strong><small>Professional output</small></li>
			<li><span>Later</span><strong>Language + footprint</strong><small>Measured expansion</small></li>
		</ol>
	</section>

	{#each statusGroups as group}
		{@const items = TIMELINE_ITEMS.filter((item) => item.status === group.status)}
		<section class="status-section" aria-labelledby={`${group.status}-title`}>
			<header><p class="eyebrow">{group.status}</p><h2 id={`${group.status}-title`}>{group.label}</h2><p>{group.note}</p></header>
			{#if items.length > 0}
				<div class="roadmap-table" role="region" aria-label={`${group.label} table`}>
					<table>
						<thead><tr><th scope="col">ID</th><th scope="col">Work</th><th scope="col">Phase</th><th scope="col">Expected</th><th scope="col">Claim</th></tr></thead>
						<tbody>
							{#each items as item}
								<tr>
									<td><span class:priority-two={item.priority === 'P2'}>{item.id}</span></td>
									<td><strong>{item.title}</strong><small>{item.scope}</small>{#if item.dependsOn.length}<small>Depends on {item.dependsOn.join(', ')}.</small>{/if}</td>
									<td>{item.phase}</td>
									<td>{item.expectedRelease ?? 'Unscheduled'}</td>
									<td><a href={item.issueUrl}>Open issue</a></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="empty-status"><span aria-hidden="true">○</span><p>{group.note}</p></div>
			{/if}
		</section>
	{/each}

	<section class="status-section completed" aria-labelledby="completed-title">
		<header><p class="eyebrow">completed</p><h2 id="completed-title">Completed releases</h2><p>Finished roadmap defects leave the active queue. Tags, merged work, and Git history keep the record.</p></header>
		<ol class="release-line">
			{#each RELEASES as release}
				<li><time datetime={release.date}>{release.date}</time><span aria-hidden="true"></span><div><h3><a href={release.tagUrl}>{release.version} · {release.title}</a></h3><p>{release.summary}</p></div></li>
			{/each}
		</ol>
	</section>

	<section class="contribute">
		<p class="eyebrow">Before a large change</p>
		<h2>Claim the item and agree on the shape.</h2>
		<p>That keeps parallel work from colliding. A proposal must preserve zero runtime dependencies, the 20 KiB compiler gzip budget, deterministic output, and full meaningful core coverage.</p>
		<a class="button button--signal" href="https://github.com/schemd/core/issues">Browse core issues</a>
	</section>
</div>

<style>
	.timeline-page { padding-block: 3rem 8rem; }
	.timeline-hero { display: grid; gap: 1.3rem; max-inline-size: 66rem; padding-block: 3rem 5rem; }
	.timeline-hero h1 { max-inline-size: 12ch; }
	.timeline-source { display: flex; align-items: center; gap: 0.8rem; border-block-start: 1px solid var(--line); padding-block-start: 1rem; color: var(--muted); font-size: var(--step--1); }
	.phase-map { border-block: 1px solid var(--line); }
	.phase-map ol { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; padding: 0; list-style: none; }
	.phase-map li { display: grid; position: relative; gap: 0.25rem; padding: 1.4rem; }
	.phase-map li + li { border-inline-start: 1px solid var(--line); }
	.phase-map li:not(:last-child)::after { position: absolute; z-index: 1; inset-block-start: 50%; inset-inline-end: -0.35rem; inline-size: 0.65rem; block-size: 0.65rem; rotate: 45deg; border-block-start: 1px solid var(--signal); border-inline-end: 1px solid var(--signal); background: var(--ink-0); content: ''; }
	.phase-map span { color: var(--signal); font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; }
	.phase-map small { color: var(--muted); }
	.status-section { padding-block: 5rem; }
	.status-section + .status-section { border-block-start: 1px solid var(--line); }
	.status-section > header { display: grid; grid-template-columns: minmax(12rem, 0.65fr) minmax(18rem, 1fr); gap: 0.5rem 3rem; margin-block-end: 2rem; }
	.status-section > header .eyebrow { grid-column: 1; }
	.status-section > header h2 { grid-column: 1; font-size: var(--step-2); }
	.status-section > header > p:last-child { grid-column: 2; grid-row: 1 / span 2; align-self: end; color: var(--muted); }
	.roadmap-table { overflow: auto; border-block: 1px solid var(--line); }
	.roadmap-table table { min-inline-size: 54rem; }
	.roadmap-table td:first-child span { display: inline-block; border: 1px solid var(--amber); padding: 0.2rem 0.45rem; color: var(--amber); font-family: var(--font-mono); font-size: 0.72rem; }
	.roadmap-table td:first-child .priority-two { border-color: var(--signal); color: var(--signal); }
	.roadmap-table td:nth-child(2) { inline-size: 52%; }
	.roadmap-table td strong, .roadmap-table td small { display: block; }
	.roadmap-table td small { margin-block-start: 0.25rem; color: var(--muted); }
	.roadmap-table a { color: var(--signal); }
	.empty-status { display: flex; align-items: center; gap: 1rem; border: 1px dashed var(--line-strong); padding: 1.2rem; color: var(--muted); }
	.empty-status span { color: var(--signal); font-size: 1.4rem; }
	.release-line { margin: 0; padding: 0; list-style: none; }
	.release-line li { display: grid; grid-template-columns: 8rem 1rem 1fr; gap: 1.2rem; }
	.release-line li + li { padding-block-start: 1.5rem; }
	.release-line time { padding-block-start: 0.2rem; color: var(--muted); font-family: var(--font-mono); font-size: 0.72rem; }
	.release-line li > span { position: relative; border-inline-start: 1px solid var(--line); }
	.release-line li > span::before { position: absolute; inset-block-start: 0.35rem; inset-inline-start: -0.3rem; inline-size: 0.55rem; block-size: 0.55rem; border-radius: 50%; background: var(--signal); content: ''; }
	.release-line h3 { font-size: var(--step-1); }
	.release-line p { max-inline-size: 65ch; margin-block-start: 0.35rem; color: var(--muted); }
	.contribute { display: grid; gap: 1rem; max-inline-size: 62rem; border-inline-start: 3px solid var(--signal); background: var(--ink-1); padding: clamp(1.5rem, 4vw, 3rem); }
	.contribute h2 { font-size: var(--step-2); }
	.contribute p:not(.eyebrow) { color: var(--paper-soft); }
	.contribute .button { justify-self: start; margin-block-start: 0.5rem; }
	@media (max-width: 46rem) { .phase-map ol { grid-template-columns: 1fr; } .phase-map li + li { border-block-start: 1px solid var(--line); border-inline-start: 0; } .phase-map li::after { display: none; } .status-section > header { display: block; } .status-section > header h2 { margin-block: 0.5rem 1rem; } .release-line li { grid-template-columns: 1fr; gap: 0.35rem; } .release-line li > span { display: none; } }
</style>
