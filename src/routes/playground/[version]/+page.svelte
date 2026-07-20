<script lang="ts">
	import type { PageProps } from './$types';
	import type { SchematicSourceMap } from '@schemd/core';
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
	function initialSource(): string {
		return (shared !== null ? decodeWorkspaceState(shared) : undefined) ?? data.sample;
	}
	let source = $state(initialSource());
	const MODES = ['default', 'embedded-css', 'full'] as const;
	let mode = $state<(typeof MODES)[number]>('full');
	let view = $state<'render' | 'raw' | 'fence'>('render');
	let boundsWidth = $state(760);
	let boundsHeight = $state(440);
	let title = $state('Workspace schematic');
	let leftOpen = $state(true);
	let rightOpen = $state(true);

	interface CompileState {
		svg: string;
		metrics?: {
			sourceCharacters: number;
			components: number;
			connections: number;
			svgBytes: number;
		};
		sourceMap?: SchematicSourceMap;
		ms?: number;
		error?: { message: string; line: number | undefined };
	}

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null;
	}

	/** Defensively narrow the compiler-supplied source map from the JSON response. */
	function parseSourceMap(value: unknown): SchematicSourceMap | undefined {
		if (!isRecord(value)) return undefined;
		const rawNodes = Array.isArray(value['nodes']) ? value['nodes'] : [];
		const rawWires = Array.isArray(value['wires']) ? value['wires'] : [];
		return {
			nodes: rawNodes.flatMap((node) =>
				isRecord(node) && typeof node['id'] === 'string' && typeof node['line'] === 'number'
					? [{ id: node['id'], line: node['line'] }]
					: []
			),
			wires: rawWires.flatMap((wire) =>
				isRecord(wire) &&
				typeof wire['source'] === 'string' &&
				typeof wire['target'] === 'string' &&
				typeof wire['line'] === 'number'
					? [{ source: wire['source'], target: wire['target'], line: wire['line'] }]
					: []
			)
		};
	}

	let result = $state<CompileState>({ svg: '' });
	let compiling = $state(false);
	let caretLine = $state(0);
	let mappedLine = $state<number | undefined>();
	let previewHost = $state<HTMLElement | undefined>();
	let compileGeneration = 0;

	/* ---------- Debounced server compilation ---------- */
	$effect(() => {
		const payload = {
			source,
			width: boundsWidth,
			height: boundsHeight,
			title,
			mode
		};
		const generation = ++compileGeneration;
		const controller = new AbortController();
		compiling = true;
		const timer = setTimeout(async () => {
			try {
				const response = await fetch('/api/compile', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					signal: controller.signal
				});
				if (generation !== compileGeneration) return;
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
						sourceMap: parseSourceMap(record['sourceMap']),
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
				if (controller.signal.aborted || generation !== compileGeneration) return;
				result = {
					...result,
					error: { message: 'Compile endpoint unreachable.', line: undefined }
				};
			} finally {
				if (generation === compileGeneration) compiling = false;
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	/* ---------- State-to-URI compression ---------- */
	$effect(() => {
		const token = encodeWorkspaceState(source);
		if (!browser) return;
		const timer = setTimeout(() => {
			const url = new URL(location.href);
			if (url.searchParams.get('code') === token) return;
			url.searchParams.set('code', token);
			replaceState(url, page.state);
		}, 300);
		return () => clearTimeout(timer);
	});

	/* ---------- Source ↔ vector mapping (driven by the compiler source map) ---------- */

	/**
	 * 0-based caret line → the node or wire declared there, resolved through the
	 * compiler's own source map rather than re-parsing the DSL in the browser.
	 */
	function lineTarget(
		line: number
	): { node?: string; wire?: { source: string; target: string } } | undefined {
		const map = result.sourceMap;
		if (!map) return undefined;
		const oneBased = line + 1;
		const node = map.nodes.find((entry) => entry.line === oneBased);
		if (node) return { node: node.id };
		const wire = map.wires.find((entry) => entry.line === oneBased);
		if (wire) return { wire: { source: wire.source, target: wire.target } };
		return undefined;
	}

	/**
	 * Element under the pointer → the 0-based source line that declared it, read
	 * straight from the `data-source-line` attribute the compiler emits in full
	 * mode. No regex, no drift as the grammar grows.
	 */
	function elementLine(element: Element): number | undefined {
		const raw = element.closest('[data-source-line]')?.getAttribute('data-source-line');
		if (raw === null || raw === undefined) return undefined;
		const oneBased = Number(raw);
		return Number.isInteger(oneBased) && oneBased >= 1 ? oneBased - 1 : undefined;
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
			host
				.querySelector(`[data-node-id="${CSS.escape(target.node)}"]`)
				?.classList.add('is-selected');
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
		browser
			? `${location.origin}/playground/${data.version}?code=${encodeWorkspaceState(source)}`
			: ''
	);

	let copied = $state(false);
	async function copyShare(): Promise<void> {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	/* ---------- Fenced-markdown form (for pasting into a Markdown pipeline) ---------- */
	const fenceMarkdown = $derived(
		'```schemd bounds="' +
			boundsWidth +
			'x' +
			boundsHeight +
			'" title="' +
			title +
			'"\n' +
			source +
			'\n```'
	);
	let fenceCopied = $state(false);
	async function copyFence(): Promise<void> {
		await navigator.clipboard.writeText(fenceMarkdown);
		fenceCopied = true;
		setTimeout(() => (fenceCopied = false), 1600);
	}

	/* ---------- Insert a component template at the caret ---------- */
	function insertKind(kind: string): void {
		const next = (result.metrics?.components ?? source.split('\n').length) + 1;
		const id = `${kind[0]!.toUpperCase()}${next}`;
		const x = 90 + (next % 5) * 130;
		const y = 90 + (Math.floor(next / 5) % 4) * 110;
		const declaration =
			kind === 'ic'
				? `${kind}:${id} "${id}" at (${x}, ${y}) [left="a,b" right="y"]`
				: `${kind}:${id} "${kind}" at (${x}, ${y}) #cyan`;
		source = `${source.replace(/\s*$/, '')}\n${declaration}\n`;
		if (ui.audio) playSuccess();
	}

	/** Orientation controls always write visible source; there is no hidden model state. */
	function insertOrientation(orientation: string): void {
		const next = (result.metrics?.components ?? source.split('\n').length) + 1;
		const declaration = `resistor:R${next} "rotated ${orientation}" at (360, 220) #amber [orientation=${orientation}]`;
		source = `${source.replace(/\s*$/, '')}\n${declaration}\n`;
	}

	/* ---------- Standalone / downloadable artifact ---------- */

	/** Inline the viewer's resolved theme so an exported vector is self-contained. */
	function themedSvg(): string | undefined {
		if (!browser || result.svg === '') return undefined;
		const start = result.svg.indexOf('<svg');
		const end = result.svg.indexOf('</svg>');
		if (start < 0 || end < 0) return undefined;
		const svg = result.svg.slice(start, end + '</svg>'.length);
		const root = getComputedStyle(document.documentElement);
		const value = (name: string): string => root.getPropertyValue(name).trim();
		const colors = ['amber', 'blue', 'cyan', 'purple', 'slate', 'emerald'];
		const tokenRules = colors
			.map(
				(color) =>
					`.schematic-token--${color}{--schematic-vector:${value(`--schematic-color-${color}`)}}`
			)
			.join('');
		const rootRule =
			`.schematic-svg{background:${value('--schematic-surface') || '#fff'};` +
			`--schematic-vector-fallback:${value('--schematic-vector-fallback') || '#333'};` +
			`--schematic-grid:${value('--schematic-grid') || '#ccc'};color:${value('--ink') || '#222'}}`;
		return svg
			.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg"`)
			.replace(/(<svg[^>]*>)/, `$1<style>${rootRule}${tokenRules}</style>`);
	}

	function triggerDownload(href: string, filename: string): void {
		const anchor = document.createElement('a');
		anchor.href = href;
		anchor.download = filename;
		anchor.click();
	}

	function downloadSvg(): void {
		const svg = themedSvg();
		if (!svg) return;
		const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
		triggerDownload(url, 'schemd-schematic.svg');
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function downloadPng(): void {
		const svg = themedSvg();
		if (!svg) return;
		const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
		const image = new Image();
		image.onload = () => {
			const scale = 2;
			const canvas = document.createElement('canvas');
			canvas.width = boundsWidth * scale;
			canvas.height = boundsHeight * scale;
			const context = canvas.getContext('2d');
			if (context) {
				context.scale(scale, scale);
				context.drawImage(image, 0, 0, boundsWidth, boundsHeight);
				canvas.toBlob((blob) => {
					if (blob) {
						const pngUrl = URL.createObjectURL(blob);
						triggerDownload(pngUrl, 'schemd-schematic.png');
						setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
					}
				}, 'image/png');
			}
			URL.revokeObjectURL(url);
		};
		image.src = url;
	}

	/** Shareable read-only embed URL for the current workspace. */
	const embedUrl = $derived(
		browser
			? `${location.origin}/embed/${data.version}?code=${encodeWorkspaceState(source)}&w=${boundsWidth}&h=${boundsHeight}`
			: ''
	);
	let embedCopied = $state(false);
	async function copyEmbed(): Promise<void> {
		await navigator.clipboard.writeText(embedUrl);
		embedCopied = true;
		setTimeout(() => (embedCopied = false), 1600);
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
			<p class="microlabel">quarter-turn source controls</p>
			<div class="orientation-controls" aria-label="Insert an oriented resistor declaration">
				{#each data.orientations as orientation (orientation)}
					<button type="button" class="kind-chip" onclick={() => insertOrientation(orientation)}>
						{orientation}
					</button>
				{/each}
			</div>
			<div class="ref-head">
				<span class="microlabel">primitives</span>
				<span class="ref-count" title="component kinds in this compiler build"
					>{data.kindCount}</span
				>
			</div>
			<div class="kind-groups">
				{#each data.kindGroups as group (group.label)}
					<div class="kind-group">
						<span class="kind-label microlabel">{group.label}</span>
						<div class="kind-chips">
							{#each group.kinds as kind (kind)}
								<button
									type="button"
									class="kind-chip"
									title={`Insert a ${kind} declaration`}
									onclick={() => insertKind(kind)}>{kind}</button
								>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<p class="microlabel">colors</p>
			<div class="color-chips">
				{#each data.colors as color (color)}
					<span class="color-chip">
						<span class="swatch" style={`background: var(--schematic-color-${color})`}
						></span>{color}
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
			<a class="ref-docs" href={`/docs/${data.version}/component-reference`}
				>Full component reference →</a
			>
		</aside>
	{/snippet}

	{#snippet center()}
		<div class="editor-pane">
			<div class="editor-toolbar">
				<span class="engine-id">
					<span class="microlabel">source · engine v{data.engineVersion}</span>
					{#if data.version !== data.engineVersion}
						<span
							class="engine-note"
							title={`This playground compiles with the installed @schemd/core (v${data.engineVersion}). Historical releases are documented, not re-executed — so the preview below is v${data.engineVersion} output.`}
						>
							viewing {data.version} · compiled live
						</span>
					{/if}
				</span>
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
			<CodeEditor
				bind:value={source}
				{mappedLine}
				errorLine={result.error?.line !== undefined ? result.error.line - 1 : undefined}
				oncaretline={(line) => (caretLine = line)}
			/>
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
					<button
						type="button"
						role="radio"
						aria-checked={view === 'render'}
						onclick={() => (view = 'render')}
					>
						render
					</button>
					<button
						type="button"
						role="radio"
						aria-checked={view === 'raw'}
						onclick={() => (view = 'raw')}
					>
						raw svg
					</button>
					<button
						type="button"
						role="radio"
						aria-checked={view === 'fence'}
						onclick={() => (view = 'fence')}
					>
						fence
					</button>
				</div>
			</div>

			{#if view === 'render'}
				<div
					bind:this={previewHost}
					class="schemd-frame preview-stage"
					class:stale={result.error !== undefined}
					role="region"
					aria-label="Compiled schematic preview"
					onpointerover={onPreviewOver}
					onpointerleave={onPreviewLeave}
				>
					{@html result.svg}
				</div>
			{:else if view === 'raw'}
				<!-- Keyboard focus exposes overflowing source to Safari users. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre
					class="codeblock raw-view"
					tabindex="0"
					role="region"
					aria-label="Scrollable raw SVG"><code>{rawSvg}</code></pre>
			{:else}
				<div class="fence-view">
					<div class="fence-bar">
						<span class="microlabel">paste this into any Markdown pipeline</span>
						<button type="button" class="fence-copy" onclick={copyFence}>
							{fenceCopied ? '✓ copied' : '⧉ copy fence'}
						</button>
					</div>
					<!-- Keyboard focus exposes overflowing source to Safari users. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<pre
						class="codeblock fence-block"
						tabindex="0"
						role="region"
						aria-label="Scrollable Markdown fence"><code>{fenceMarkdown}</code></pre>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet statusExtra()}
		<span class="microlabel">mode={mode}</span>
		<button type="button" class="status-action" onclick={downloadSvg} title="Download themed SVG"
			>↓ svg</button
		>
		<button type="button" class="status-action" onclick={downloadPng} title="Download 2× PNG"
			>↓ png</button
		>
		<button type="button" class="status-action" onclick={copyEmbed} aria-live="polite">
			{embedCopied ? '✓ embed copied' : '⧉ embed'}
		</button>
		<button type="button" class="status-action" onclick={copyShare} aria-live="polite">
			{copied ? '✓ link copied' : '⧉ share'}
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

	.engine-id {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	/* Truth-in-labelling: the preview is always the installed engine's output,
	   even when the visitor navigates to a historical version in the header. */
	.engine-note {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: 0.04em;
		color: var(--accent);
		border: 1px solid var(--line-strong);
		padding: 0.05em 0.5em;
		border-radius: 999px;
		cursor: help;
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

	.status-action {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--accent);
		letter-spacing: 0.06em;

		&:hover {
			color: var(--ink);
		}
	}
</style>
