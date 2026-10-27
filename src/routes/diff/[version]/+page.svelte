<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * Diagram review.
	 *
	 * Two revisions, compiled side by side in this tab, reduced to the change a
	 * reviewer actually cares about: which components appeared, which nets gained
	 * terminals, which connections were rerouted. Pixels move for a hundred
	 * uninteresting reasons; topology does not.
	 */
	import SheetFrame from '#lib/components/SheetFrame.svelte';
	import { browser } from '$app/env';
	import Seo from '#lib/components/Seo.svelte';
	import { untrack } from 'svelte';
	import CodeEditor from '#lib/components/CodeEditor.svelte';
	import { inspectInBrowser, prefetchCompiler } from '#lib/compile-client.ts';
	import { COMPILE_LIMITS } from '#lib/compile-contract.ts';
	import { diffNetlists, type DiagramDelta } from '#lib/diagram-diff.ts';
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
	async function compile(source: string, side: 'before' | 'after', signal: AbortSignal) {
		const result = await inspectInBrowser(
			{
				source,
				width: BOUNDS.width,
				height: BOUNDS.height,
				title: side === 'before' ? 'Before' : 'After',
				mode: 'embedded-css'
			},
			signal
		);
		if (signal.aborted) return undefined;
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
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			const [left, right] = await Promise.all([
				compile(sources.before, 'before', controller.signal),
				compile(sources.after, 'after', controller.signal)
			]);
			if (mine !== generation) return;
			delta = left && right ? diffNetlists(left, right) : undefined;
		}, 40);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	const badge = (kind: string) => kind.split('-')[0] ?? kind;
</script>

<Seo
	title={t('Review a diagram change · schemd v{0}', [data.version])}
	description={t(
		'Compare two revisions of a schemd diagram and read the semantic delta: the components, nets, and connections that changed.'
	)}
	canonicalPath={`/diff/${data.latest ?? data.version}`}
	noindex
/>

<div class="review">
	<SheetFrame label={t('Diagram diff')}>
		<header class="sheet-head">
			<p class="kicker">{t('Review /')} {t(data.version)}</p>
			<h1>{t('What changed in this diagram?')}</h1>
			<p class="lede">
				{t('Both revisions compile in this tab with the installed')}
				{t(data.engineVersion)}
				{t(
					'engine. The delta below is topological: it reports the components, nets, and connections that differ, not the pixels.'
				)}
			</p>
		</header>
	</SheetFrame>

	<section class="panes" aria-label={t('Revisions')}>
		{#each [{ side: 'before' as const, label: 'Before' }, { side: 'after' as const, label: 'After' }] as pane (pane.side)}
			<article class="pane">
				<h2>{t(pane.label)}</h2>
				<div class="editor">
					{#if pane.side === 'before'}
						<CodeEditor
							bind:value={before}
							ariaLabel="Before revision source"
							maxLength={COMPILE_LIMITS.maxSourceCharacters}
						/>
					{:else}
						<CodeEditor
							bind:value={after}
							ariaLabel="After revision source"
							maxLength={COMPILE_LIMITS.maxSourceCharacters}
						/>
					{/if}
				</div>
				{#if pane.side === 'before' ? beforeError : afterError}
					<p class="failure" role="alert">
						{pane.side === 'before' ? t(beforeError) : t(afterError)}
					</p>
				{/if}
			</article>
		{/each}
	</section>

	<!--
		Side by side only. A difference-blended overlay was tried and dropped: two
		dark-themed SVGs cancel to a black rectangle, which reads as "broken"
		rather than "unchanged". The delta below is the reviewable artifact.
	-->
	<section class="stage" aria-label={t('Compiled revisions')}>
		<div class="frames">
			<figure>
				<figcaption>{t('Before')}</figcaption>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html beforeSvg}
			</figure>
			<figure class="after">
				<figcaption>{t('After')}</figcaption>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html afterSvg}
			</figure>
		</div>
	</section>

	<section class="delta" aria-label={t('Semantic delta')} aria-live="polite">
		{#if beforeError || afterError}
			<p class="muted">
				{t('No delta while a revision fails to compile — fix the')}
				{beforeError && afterError
					? t('revisions')
					: beforeError
						? t('"before" revision')
						: t('"after" revision')}
				{t('above.')}
			</p>
		{:else if !delta}
			<p class="muted">{t('Waiting for both revisions to compile.')}</p>
		{:else if delta.identical}
			<p class="clean">
				{t('No topological change. The two revisions describe the same circuit.')}
			</p>
		{:else}
			<p class="summary">
				{t(delta.counts.components)}
				{t('component')}{delta.counts.components === 1 ? t('') : t('s')} ·
				{t(delta.counts.nets)}
				{t('net')}{delta.counts.nets === 1 ? t('') : t('s')} ·
				{t(delta.counts.connections)}
				{t('connection')}{delta.counts.connections === 1 ? t('') : t('s')}
			</p>
			<ul>
				{#each delta.changes as change (change.kind + change.subject)}
					<li class={`change ${badge(change.kind)}`}>
						<span class="tag">{t(change.kind.replace(/-/g, ' '))}</span>
						<span class="what">{t(change.summary)}</span>
						{#if change.details.length}
							<span class="detail">{t(change.details.join('; '))}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.review {
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
		font: 600 0.72rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
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
		font: 500 0.8rem/1.4 var(--font-sans);
		font-variant-numeric: tabular-nums;
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
		font: 500 0.68rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
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
		border-inline-start-color: var(--ink);
	}
	.change.net {
		border-inline-start-color: var(--ink);
	}
	.change.connection {
		border-inline-start-color: var(--ink-faint);
	}
	.tag {
		color: var(--ink-faint);
		font: 500 0.66rem/1.5 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.what {
		font-weight: 500;
	}
	.detail {
		grid-column: 2;
		color: var(--ink-mute);
		font: 400 0.82rem/1.5 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.summary {
		margin: 0;
		color: var(--ink-mute);
		font: 500 0.72rem/1 var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
	.clean {
		margin: 0;
		color: var(--ink);
	}
	.muted {
		margin: 0;
		color: var(--ink-faint);
	}
</style>
