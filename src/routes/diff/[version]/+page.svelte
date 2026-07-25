<script lang="ts">
	/**
	 * Diagram review.
	 *
	 * Two revisions, compiled side by side in this tab, reduced to the change a
	 * reviewer actually cares about: which components appeared, which nets gained
	 * terminals, which connections were rerouted. Pixels move for a hundred
	 * uninteresting reasons; topology does not.
	 */
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { inspectInBrowser, prefetchCompiler } from '$lib/compile-client';
	import { diffNetlists, type DiagramDelta } from '$lib/diagram-diff';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	if (browser) prefetchCompiler();

	/* Seeded once: the route only changes through a full navigation. */
	let before = $state(untrack(() => data.before));
	let after = $state(untrack(() => data.after));
	let beforeSvg = $state('');
	let afterSvg = $state('');
	let beforeError = $state<string | undefined>();
	let afterError = $state<string | undefined>();
	let delta = $state<DiagramDelta | undefined>();
	let generation = 0;

	const BOUNDS = { width: 820, height: 460 };

	/** Compile one revision and return its netlist, or record the diagnostic. */
	async function compile(source: string, side: 'before' | 'after') {
		const result = await inspectInBrowser({
			source,
			width: BOUNDS.width,
			height: BOUNDS.height,
			title: side === 'before' ? 'Before' : 'After',
			mode: 'embedded-css'
		});
		if (!result || !result.ok) {
			const message = result?.ok === false ? result.message : 'Compiler unavailable.';
			if (side === 'before') beforeError = message;
			else afterError = message;
			return undefined;
		}
		if (side === 'before') {
			beforeError = undefined;
			beforeSvg = result.svg;
		} else {
			afterError = undefined;
			afterSvg = result.svg;
		}
		return result.netlist;
	}

	$effect(() => {
		const sources = { before, after };
		const mine = ++generation;
		const timer = setTimeout(async () => {
			const [left, right] = await Promise.all([
				compile(sources.before, 'before'),
				compile(sources.after, 'after')
			]);
			if (mine !== generation) return;
			delta = left && right ? diffNetlists(left, right) : undefined;
		}, 40);
		return () => clearTimeout(timer);
	});

	const badge = (kind: string) => kind.split('-')[0] ?? kind;
</script>

<svelte:head>
	<title>Review a diagram change · schemd {data.version}</title>
	<meta
		name="description"
		content="Compare two revisions of a schemd diagram and read the semantic delta: components, nets, and connections that changed."
	/>
</svelte:head>

<main class="review">
	<header>
		<p class="kicker">Review / {data.version}</p>
		<h1>What changed in this diagram?</h1>
		<p class="lede">
			Both revisions compile in this tab with the installed {data.engineVersion} engine. The delta below
			is topological: it reports the components, nets, and connections that differ, not the pixels.
		</p>
	</header>

	<section class="panes" aria-label="Revisions">
		{#each [{ side: 'before' as const, label: 'Before' }, { side: 'after' as const, label: 'After' }] as pane (pane.side)}
			<article class="pane">
				<h2>{pane.label}</h2>
				<div class="editor">
					{#if pane.side === 'before'}
						<CodeEditor bind:value={before} ariaLabel="Before revision source" />
					{:else}
						<CodeEditor bind:value={after} ariaLabel="After revision source" />
					{/if}
				</div>
				{#if pane.side === 'before' ? beforeError : afterError}
					<p class="failure" role="alert">{pane.side === 'before' ? beforeError : afterError}</p>
				{/if}
			</article>
		{/each}
	</section>

	<!--
		Side by side only. A difference-blended overlay was tried and dropped: two
		dark-themed SVGs cancel to a black rectangle, which reads as "broken"
		rather than "unchanged". The delta below is the reviewable artifact.
	-->
	<section class="stage" aria-label="Compiled revisions">
		<div class="frames">
			<figure>
				<figcaption>Before</figcaption>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html beforeSvg}
			</figure>
			<figure class="after">
				<figcaption>After</figcaption>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html afterSvg}
			</figure>
		</div>
	</section>

	<section class="delta" aria-label="Semantic delta" aria-live="polite">
		{#if beforeError || afterError}
			<p class="muted">
				No delta while a revision fails to compile — fix the
				{beforeError && afterError
					? 'revisions'
					: beforeError
						? '"before" revision'
						: '"after" revision'}
				above.
			</p>
		{:else if !delta}
			<p class="muted">Waiting for both revisions to compile.</p>
		{:else if delta.identical}
			<p class="clean">No topological change. The two revisions describe the same circuit.</p>
		{:else}
			<p class="summary">
				{delta.counts.components} component{delta.counts.components === 1 ? '' : 's'} ·
				{delta.counts.nets} net{delta.counts.nets === 1 ? '' : 's'} ·
				{delta.counts.connections} connection{delta.counts.connections === 1 ? '' : 's'}
			</p>
			<ul>
				{#each delta.changes as change (change.kind + change.subject)}
					<li class={`change ${badge(change.kind)}`}>
						<span class="tag">{change.kind.replace(/-/g, ' ')}</span>
						<span class="what">{change.summary}</span>
						{#if change.details.length}
							<span class="detail">{change.details.join(' · ')}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.review {
		display: grid;
		gap: var(--space-6);
		max-inline-size: 76rem;
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
		max-inline-size: 60ch;
		margin: 0;
		color: var(--ink-mute);
	}
	.panes {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
	}
	.pane h2 {
		margin: 0 0 var(--space-2);
		font: 600 0.72rem/1 var(--font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-mute);
	}
	.editor {
		block-size: 17rem;
		border: 1px solid var(--line);
		overflow: hidden;
	}
	.failure {
		margin: var(--space-2) 0 0;
		color: var(--danger);
		font: 500 0.8rem/1.4 var(--font-mono);
	}
	.frames {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
	}
	.frames figure {
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-raised);
	}
	.frames figcaption {
		margin-block-end: var(--space-2);
		color: var(--ink-mute);
		font: 500 0.68rem/1 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.delta ul {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-3) 0 0;
		padding: 0;
		list-style: none;
	}
	.change {
		display: grid;
		grid-template-columns: 11rem 1fr;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-inline-start: 3px solid var(--line-strong, var(--line));
		background: var(--bg-raised);
	}
	.change.component {
		border-inline-start-color: var(--accent);
	}
	.change.net {
		border-inline-start-color: var(--accent-2, var(--accent));
	}
	.change.connection {
		border-inline-start-color: var(--ink-faint);
	}
	.tag {
		color: var(--ink-faint);
		font: 500 0.66rem/1.5 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.what {
		font-weight: 500;
	}
	.detail {
		grid-column: 2;
		color: var(--ink-mute);
		font: 400 0.82rem/1.5 var(--font-mono);
	}
	.summary {
		margin: 0;
		color: var(--ink-mute);
		font: 500 0.72rem/1 var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.clean {
		margin: 0;
		color: var(--accent);
	}
	.muted {
		margin: 0;
		color: var(--ink-faint);
	}
</style>
