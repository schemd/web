<script lang="ts">
	import type { PageProps } from './$types';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import WorkspaceShell from '$lib/components/WorkspaceShell.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { decodeWorkspaceState, encodeWorkspaceState } from '$lib/state-uri';
	import { playError, playSuccess } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';

	let { data }: PageProps = $props();

	/* ---------- Workspace state ---------- */
	const shared = browser ? page.url.searchParams.get('code') : null;
	let source = $state(
		(shared !== null ? decodeWorkspaceState(shared) : undefined) ?? data.sample
	);
	const MODES = ['default', 'embedded-css', 'full'] as const;
	let mode = $state<(typeof MODES)[number]>('full');
	let view = $state<'render' | 'raw' | 'fence'>('render');
	let boundsWidth = $state(760);
	let boundsHeight = $state(380);
	let title = $state('Workspace schematic');
	let leftOpen = $state(true);
	let rightOpen = $state(true);

	interface CompileState {
		svg: string;
		metrics?: { sourceCharacters: number; components: number; connections: number; svgBytes: number };
		ms?: number;
		error?: { message: string; line: number | undefined };
	}

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null;
	}

	let result = $state<CompileState>({ svg: '' });
	let compiling = $state(false);
	let caretLine = $state(0);
	let mappedLine = $state<number | undefined>();
	let previewHost = $state<HTMLElement | undefined>();

	/* ---------- Debounced server compilation ---------- */
	$effect(() => {
		const payload = {
			source,
			width: boundsWidth,
			height: boundsHeight,
			title,
			mode
		};
		compiling = true;
		const timer = setTimeout(async () => {
			try {
				const response = await fetch('/api/compile', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const body: unknown = await response.json();
				const record = isRecord(body) ? body : {};
				if (record['ok'] === true) {
					const raw = isRecord(record['metrics']) ? record['metrics'] : {};
					result = {
						svg: String(record['svg'] ?? ''),
						metrics: {
							sourceCharacters: Number(raw['sourceCharacters'] ?? 0),
							components: Number(raw['components'] ?? 0),
							connections: Number(raw['connections'] ?? 0),
							svgBytes: Number(raw['svgBytes'] ?? 0)
						},
						ms: Number(record['ms'] ?? 0)
					};
					if (ui.audio) playSuccess();
				} else {
					result = {
						...result,
						error: {
							message: String(record['message'] ?? 'Compilation failed.'),
							line: typeof record['line'] === 'number' ? record['line'] : undefined
						}
					};
					if (ui.audio) playError();
				}
			} catch {
				result = { ...result, error: { message: 'Compile endpoint unreachable.', line: undefined } };
			} finally {
				compiling = false;
			}
		}, 220);
		return () => clearTimeout(timer);
	});

	/* ---------- State-to-URI compression ---------- */
	$effect(() => {
		const token = encodeWorkspaceState(source);
		if (!browser) return;
		const timer = setTimeout(() => {
			const url = new URL(location.href);
			url.searchParams.set('code', token);
			replaceState(url, page.state);
		}, 300);
		return () => clearTimeout(timer);
	});

	/* ---------- Source ↔ vector mapping ---------- */
	const COMPONENT_LINE = /^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z][A-Za-z0-9_-]*)\s+"/;
	const CONNECTION_LINE =
		/^([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z][A-Za-z0-9_-]*)\s*->\s*([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z][A-Za-z0-9_-]*)/;

	/** 0-based line → the node ID or wire endpoints it declares. */
	function lineTarget(
		line: number
	): { node?: string; wire?: { source: string; target: string } } | undefined {
		const text = source.split('\n')[line]?.trim();
		if (!text) return undefined;
		const component = text.match(COMPONENT_LINE);
		if (component) return { node: component[2]! };
		const connection = text.match(CONNECTION_LINE);
		if (connection) {
			return {
				wire: {
					source: `${connection[1]}.${connection[2]}`,
					target: `${connection[3]}.${connection[4]}`
				}
			};
		}
		return undefined;
	}

	/** Element under the pointer → the 0-based source line that declared it. */
	function elementLine(element: Element): number | undefined {
		const node = element.closest('[data-node-id]');
		const lines = source.split('\n');
		if (node) {
			const id = node.getAttribute('data-node-id');
			const index = lines.findIndex((line) => line.trim().match(COMPONENT_LINE)?.[2] === id);
			return index >= 0 ? index : undefined;
		}
		const wire = element.closest('[data-wire-source]');
		if (wire) {
			const wireSource = wire.getAttribute('data-wire-source');
			const wireTarget = wire.getAttribute('data-wire-target');
			const index = lines.findIndex((line) => {
				const match = line.trim().match(CONNECTION_LINE);
				return (
					match !== undefined &&
					match !== null &&
					`${match[1]}.${match[2]}` === wireSource &&
					`${match[3]}.${match[4]}` === wireTarget
				);
			});
			return index >= 0 ? index : undefined;
		}
		return undefined;
	}

	/** Caret line → highlight the matching vector via the full-mode classes. */
	$effect(() => {
		const host = previewHost;
		void result.svg;
		if (!host) return;
		for (const previous of host.querySelectorAll('.is-selected')) {
			previous.classList.remove('is-selected');
		}
		const target = lineTarget(caretLine);
		if (!target) return;
		if (target.node) {
			host.querySelector(`[data-node-id="${CSS.escape(target.node)}"]`)?.classList.add('is-selected');
		} else if (target.wire) {
			host
				.querySelector(
					`[data-wire-source="${CSS.escape(target.wire.source)}"][data-wire-target="${CSS.escape(target.wire.target)}"]`
				)
				?.classList.add('is-selected');
		}
	});

	function onPreviewOver(event: PointerEvent): void {
		if (!(event.target instanceof Element)) return;
		mappedLine = elementLine(event.target);
	}

	function onPreviewLeave(): void {
		mappedLine = undefined;
	}

	/* ---------- Raw SVG formatting ---------- */
	const rawSvg = $derived.by(() => {
		if (view !== 'raw' || result.svg === '') return '';
		let depth = 0;
		return result.svg
			.replace(/></g, '>\n<')
			.split('\n')
			.map((tag) => {
				if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
				const indented = '  '.repeat(depth) + tag;
				if (/^<[^/!?][^>]*[^/]>$/.test(tag) && !/^<(text|title|tspan)/.test(tag)) depth += 1;
				return indented;
			})
			.join('\n');
	});

	const shareUrl = $derived(
		browser ? `${location.origin}/playground/${data.version}?code=${encodeWorkspaceState(source)}` : ''
	);

	let copied = $state(false);
	async function copyShare(): Promise<void> {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	/* ---------- Fenced-markdown form (for pasting into a Markdown pipeline) ---------- */
	const fenceMarkdown = $derived(
		'```schemd bounds="' + boundsWidth + 'x' + boundsHeight + '" title="' + title + '"\n' + source + '\n```'
	);
	let fenceCopied = $state(false);
	async function copyFence(): Promise<void> {
		await navigator.clipboard.writeText(fenceMarkdown);
		fenceCopied = true;
		setTimeout(() => (fenceCopied = false), 1600);
	}
</script>

<svelte:head>
	<title>Playground · schemd v{data.version}</title>
	<meta
		name="description"
		content="Compile schemd source to SVG live: three output modes, raw markup view, and shareable workspace links."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<WorkspaceShell
	leftLabel="Reference"
	rightLabel="Preview"
	leftInitial={230}
	rightInitial={Math.min(560, browser ? window.innerWidth * 0.45 : 560)}
	bind:leftOpen
	bind:rightOpen
>
	{#snippet left()}
		<aside class="ref">
			<p class="microlabel">grammar</p>
			<div class="grammar">
				<div class="grammar-row">
					<span class="grammar-tag microlabel">node</span>
					<code>kind:ID "label" at (x, y) #color [options]</code>
				</div>
				<div class="grammar-row">
					<span class="grammar-tag microlabel">wire</span>
					<code>A.port -&gt; B.port #color [line|bezier|ortho]</code>
				</div>
			</div>
			<div class="ref-head">
				<span class="microlabel">primitives</span>
				<span class="ref-count" title="component kinds in this compiler build">{data.kindCount}</span>
			</div>
			<div class="kind-groups">
				{#each data.kindGroups as group (group.label)}
					<div class="kind-group">
						<span class="kind-label microlabel">{group.label}</span>
						<div class="kind-chips">
							{#each group.kinds as kind (kind)}
								<code class="kind-chip">{kind}</code>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<p class="microlabel">colors</p>
			<div class="color-chips">
				{#each data.colors as color (color)}
					<span class="color-chip">
						<span class="swatch" style={`background: var(--schematic-color-${color})`}></span>{color}
					</span>
				{/each}
			</div>
			<p class="color-note microlabel">+ hex · rgb()/hsl() · custom aliases</p>
			<p class="microlabel">fence</p>
			<div class="fence-controls">
				<label>
					<span class="microlabel">w</span>
					<input type="number" min="64" max="4096" bind:value={boundsWidth} />
				</label>
				<label>
					<span class="microlabel">h</span>
					<input type="number" min="64" max="4096" bind:value={boundsHeight} />
				</label>
				<label class="fence-title">
					<span class="microlabel">title</span>
					<input type="text" maxlength="512" bind:value={title} />
				</label>
			</div>
			<a class="ref-docs" href={`/docs/${data.version}/language`}>Full language reference →</a>
		</aside>
	{/snippet}

	{#snippet center()}
		<div class="editor-pane">
			<div class="editor-toolbar">
				<span class="microlabel">source · v{data.version}</span>
				{#if result.error}
					<span class="diagnostic" role="alert">
						{result.error.message}
					</span>
				{:else if compiling}
					<span class="microlabel">compiling…</span>
				{:else if result.metrics}
					<span class="readout">
						{result.metrics.components} nodes · {result.metrics.connections} wires ·
						{result.metrics.svgBytes.toLocaleString('en-US')} B · {result.ms} ms
					</span>
				{/if}
			</div>
			<CodeEditor bind:value={source} {mappedLine} oncaretline={(line) => (caretLine = line)} />
		</div>
	{/snippet}

	{#snippet right()}
		<div class="preview-pane">
			<div class="preview-toolbar">
				<div class="seg" role="radiogroup" aria-label="Compiler mode">
					{#each MODES as candidate (candidate)}
						<button
							type="button"
							role="radio"
							aria-checked={mode === candidate}
							onclick={() => (mode = candidate)}
						>
							{candidate}
						</button>
					{/each}
				</div>
				<div class="seg" role="radiogroup" aria-label="Preview channel">
					<button type="button" role="radio" aria-checked={view === 'render'} onclick={() => (view = 'render')}>
						render
					</button>
					<button type="button" role="radio" aria-checked={view === 'raw'} onclick={() => (view = 'raw')}>
						raw svg
					</button>
					<button type="button" role="radio" aria-checked={view === 'fence'} onclick={() => (view = 'fence')}>
						fence
					</button>
				</div>
			</div>

			{#if view === 'render'}
				<div
					bind:this={previewHost}
					class="schemd-frame preview-stage"
					class:stale={result.error !== undefined}
					onpointerover={onPreviewOver}
					onpointerleave={onPreviewLeave}
				>
					{@html result.svg}
				</div>
			{:else if view === 'raw'}
				<pre class="codeblock raw-view"><code>{rawSvg}</code></pre>
			{:else}
				<div class="fence-view">
					<div class="fence-bar">
						<span class="microlabel">paste this into any Markdown pipeline</span>
						<button type="button" class="fence-copy" onclick={copyFence}>
							{fenceCopied ? '✓ copied' : '⧉ copy fence'}
						</button>
					</div>
					<pre class="codeblock fence-block"><code>{fenceMarkdown}</code></pre>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet statusExtra()}
		<span class="microlabel">mode={mode}</span>
		<button type="button" class="share" onclick={copyShare} aria-live="polite">
			{copied ? '✓ link copied' : '⧉ share workspace'}
		</button>
	{/snippet}
</WorkspaceShell>

<style>
	.ref {
		padding: var(--space-4);
		overflow-y: auto;
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.grammar {
		display: grid;
		gap: var(--space-2);
		background: var(--bg-inset);
		border: 1px solid var(--line);
		padding: var(--space-3);
	}

	.grammar-row {
		display: grid;
		gap: 2px;
	}

	.grammar-tag {
		color: var(--ink-faint);
	}

	.grammar code {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		line-height: 1.6;
		color: var(--ink);
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.fence-view {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-block-size: 0;
	}

	.fence-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-block-end: 1px solid var(--line);
		background: var(--bg-raised);
	}

	.fence-copy {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--accent);
		letter-spacing: 0.04em;

		&:hover {
			color: var(--ink);
		}
	}

	.fence-block {
		border: none;
		overflow: auto;
		white-space: pre;
		font-size: var(--text-xs);
	}

	.ref-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-block-start: var(--space-2);
	}

	.ref-count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent);
		border: 1px solid var(--line-strong);
		padding: 0.05em 0.5em;
		border-radius: 999px;
	}

	.kind-groups {
		display: grid;
		gap: var(--space-3);
		margin-block-end: var(--space-3);
	}

	.kind-group {
		display: grid;
		gap: var(--space-1);
	}

	.kind-label {
		color: var(--ink-faint);
	}

	.kind-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.kind-chip {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);
		background: var(--bg-inset);
		border: 1px solid var(--line);
		padding: 0.1em 0.45em;
		transition:
			color var(--dur-fast) var(--ease-precise),
			border-color var(--dur-fast) var(--ease-precise);

		&:hover {
			color: var(--accent);
			border-color: var(--line-strong);
		}
	}

	.color-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin-block-end: var(--space-1);
	}

	.color-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);

		& .swatch {
			inline-size: 11px;
			block-size: 11px;
			border: 1px solid var(--line-strong);
		}
	}

	.color-note {
		margin-block: 0 var(--space-3);
		color: var(--ink-faint);
	}

	.fence-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);

		& label {
			display: flex;
			align-items: center;
			gap: var(--space-1);
		}

		& input {
			background: var(--bg-inset);
			border: 1px solid var(--line-strong);
			color: var(--ink);
			font-family: var(--font-mono);
			font-size: var(--text-xs);
			padding: 0.2rem 0.4rem;
			inline-size: 5.5ch;
		}

		& .fence-title {
			flex: 1 1 100%;

			& input {
				flex: 1;
				inline-size: auto;
			}
		}
	}

	.ref-docs {
		font-size: var(--text-xs);
		margin-block-start: var(--space-2);
	}

	.editor-pane,
	.preview-pane {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-block-size: 0;
	}

	.editor-toolbar,
	.preview-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-block-end: 1px solid var(--line);
		background: var(--bg-raised);
		min-block-size: 42px;
		flex-wrap: wrap;
	}

	.diagnostic {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--danger);
	}

	.preview-stage {
		border: none;
		overflow: auto;
		padding: var(--space-4);
		transition: opacity var(--dur-fast) var(--ease-precise);

		&.stale {
			opacity: 0.45;
		}
	}

	.raw-view {
		border: none;
		border-radius: 0;
		overflow: auto;
		font-size: var(--text-2xs);
	}

	.share {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--accent);
		letter-spacing: 0.06em;

		&:hover {
			color: var(--ink);
		}
	}
</style>
