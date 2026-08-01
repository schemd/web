<script lang="ts">
	/**
	 * The laboratory builder.
	 *
	 * An author edits a manifest and sees the laboratory it describes, running,
	 * beside it. Nothing here can introduce code: `model` is a name resolved
	 * against the whitelist the server reports, and the server validates and
	 * compiles before this page renders anything.
	 *
	 * The preview is deliberately the *same* `DeclarativeLab` the real route
	 * uses. A builder with its own renderer would let a lab look right here and
	 * behave differently once published, which is the failure mode that makes
	 * authoring tools untrustworthy.
	 */
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import DeclarativeLab from '$lib/components/sims/DeclarativeLab.svelte';
	import { provideSimulationTimelineModel } from '$lib/components/sims/simulation-timeline.svelte';
	import SimulationTimeline from '$lib/components/sims/SimulationTimeline.svelte';
	import { encodeWorkspaceState, MAX_WORKSPACE_URL_CHARACTERS } from '$lib/state-uri';
	import { goto } from '$app/navigation';
	import { timelineFor } from '$lib/simulation-timelines';

	let { data }: PageProps = $props();
	const timelineModel = provideSimulationTimelineModel();

	let host = $state<HTMLElement | undefined>();
	let copied = $state(false);

	/*
	 * `edited` is an override, not a copy.
	 *
	 * Seeding a `$state` from `data.draft` would capture only the first value,
	 * so a navigation — applying a change, or the back button — would leave the
	 * editor showing text the preview beside it no longer describes. Holding the
	 * *local edit* instead and falling back to the server's copy means new server
	 * data wins automatically, and clearing the override is all "applied" means.
	 */
	let edited = $state<string | undefined>(undefined);
	const draft = $derived(edited ?? data.draft);

	/* The server holds the authoritative parse. Until the author applies an
	   edit, the preview keeps showing the last thing that actually compiled —
	   a preview that blanks on every keystroke is worse than a stale one. */
	const dirty = $derived(edited !== undefined && edited !== data.draft);

	const shareUrl = $derived.by(() => {
		const token = encodeWorkspaceState(draft);
		const url = new URL(`/simulations/${data.version}/new`, 'https://schemd.johnowolabiidogun.dev');
		url.searchParams.set('lab', token);
		const href = url.toString();
		return href.length > MAX_WORKSPACE_URL_CHARACTERS ? undefined : href;
	});

	async function apply(): Promise<void> {
		const url = new URL(window.location.href);
		url.searchParams.set('lab', encodeWorkspaceState(draft));
		await goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
		/* The server's copy is now the draft; drop the override so it shows. */
		edited = undefined;
	}

	async function copyLink(): Promise<void> {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* Clipboard unavailable — the field beside it is selectable. */
		}
	}

	/* The interpreter reads the shared timeline, so the preview needs one even
	   though a draft lab has no authored teaching route of its own. */
	const previewStages = $derived(data.manifest ? timelineFor(data.manifest.id) : []);
</script>

<Seo
	title="Build a simulation lab · schemd"
	description="Compose a schemd simulation laboratory as a manifest: a compiled diagram, a whitelisted model, and declarative bindings from signals onto nodes and wires."
	canonicalPath={`/simulations/${data.version}/new`}
/>

<article class="builder grid-backdrop">
	<header class="builder-head">
		<p class="microlabel">laboratory builder · v{data.version}</p>
		<h1>Describe a laboratory</h1>
		<p class="lede">
			A laboratory is a compiled diagram, a model, and a set of bindings from the model's signals
			onto the drawing's nodes and wires. Everything below is data — the
			<code>model</code> field names one of the {data.models.length} models this application ships, and
			cannot name anything else.
		</p>
	</header>

	<div class="builder-grid">
		<section class="editor plate" aria-label="Manifest editor">
			<header class="panel-head">
				<p class="eyebrow">manifest</p>
				<span class="microlabel">{data.models.join(' · ')}</span>
			</header>

			<textarea
				value={draft}
				oninput={(event) => (edited = event.currentTarget.value)}
				spellcheck="false"
				aria-label="Laboratory manifest, as JSON"></textarea>

			<div class="editor-actions">
				<button type="button" class="btn btn-solid" onclick={apply} disabled={!dirty}>
					{dirty ? 'Apply changes' : 'Applied'}
				</button>
				<button type="button" class="btn" onclick={copyLink} disabled={!shareUrl}>
					{copied ? '✓ copied' : 'Copy shareable link'}
				</button>
				{#if !shareUrl}
					<span class="microlabel too-long">Too long to share as a link.</span>
				{/if}
			</div>

			{#if data.problems.length > 0}
				<ul class="problems" aria-label="Manifest problems">
					{#each data.problems as problem (problem)}
						<li>{problem}</li>
					{/each}
				</ul>
			{:else}
				<p class="microlabel ok">Manifest is valid and its diagram compiles.</p>
			{/if}
		</section>

		<section class="preview" aria-label="Live preview">
			{#if data.manifest && data.svg}
				{#if previewStages.length > 0}
					<SimulationTimeline
						simulationId={data.manifest.id}
						stages={previewStages.map((stage) => ({
							...stage,
							labelHtml: stage.label,
							explanationHtml: stage.explanation
						}))}
						{host}
						model={timelineModel}
					/>
				{/if}
				<div class="simulation-host" bind:this={host}>
					{#key data.draft}
						<DeclarativeLab manifest={data.manifest} svg={data.svg} />
					{/key}
				</div>
			{:else}
				<p class="empty plate">
					The preview appears once the manifest is valid and its diagram compiles.
				</p>
			{/if}
		</section>
	</div>
</article>

<style>
	.builder {
		padding: clamp(1rem, 3vw, 2.5rem);
		display: grid;
		gap: var(--space-6);
	}

	.builder-head h1 {
		font-size: var(--text-xl);
		margin-block: var(--space-2);
	}

	.lede {
		max-inline-size: 70ch;
		color: var(--ink-mute);
	}

	.builder-grid {
		display: grid;
		grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}

	.editor {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		position: sticky;
		inset-block-start: calc(var(--header-h) + var(--space-3));
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	textarea {
		inline-size: 100%;
		min-block-size: 26rem;
		resize: vertical;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.55;
		color: var(--ink);
		background: var(--bg-inset);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: var(--space-3);

		&:focus-visible {
			outline: 2px solid var(--accent);
			outline-offset: -2px;
		}
	}

	.editor-actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		align-items: center;
	}

	.problems {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding-inline-start: var(--space-5);
		color: var(--danger);
		font-size: var(--text-sm);
	}

	.ok {
		color: var(--ok);
	}

	.too-long {
		color: var(--warn);
	}

	.preview {
		display: grid;
		gap: var(--space-3);
		min-inline-size: 0;
	}

	.empty {
		padding: var(--space-8);
		text-align: center;
		color: var(--ink-mute);
	}

	@media (max-width: 1100px) {
		.builder-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.editor {
			position: static;
		}
	}
</style>
