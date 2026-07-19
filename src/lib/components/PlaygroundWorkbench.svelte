<script lang="ts">
	import { onMount } from 'svelte';
	import WorkspaceShell from './WorkspaceShell.svelte';
	import SyntaxEditor from './SyntaxEditor.svelte';
	import { emitTone } from '$lib/audio';
	import {
		decodeWorkspace,
		encodeWorkspace,
		MAX_SHARE_URL_CHARACTERS,
		type SharedWorkspace
	} from '$lib/playground/share-state';
	import { sourceLineForNode } from '$lib/playground/tokenizer';

	type Mode = SharedWorkspace['mode'];
	type View = 'render' | 'raw';

	interface CompileMetrics {
		readonly sourceCharacters: number;
		readonly components: number;
		readonly connections: number;
		readonly svgBytes: number;
	}

	interface Compilation {
		readonly svg: string;
		readonly metrics: CompileMetrics;
	}

	let {
		version,
		initialSource,
		initialCode
	}: {
		version: string;
		initialSource: string;
		initialCode?: string;
	} = $props();

	function startingSource(): string {
		return initialSource;
	}

	let source = $state(startingSource());
	let mode = $state<Mode>('full');
	let view = $state<View>('render');
	let title = $state('Precision signal chain');
	let bounds = $state<`${number}x${number}`>('880x520');
	let compilation = $state<Compilation>();
	let error = $state<string>();
	let errorLine = $state<number>();
	let compiling = $state(false);
	let activeLine = $state<number>();
	let previewRoot: HTMLElement;
	let shareStatus = $state('URI sync ready');
	let hydrated = $state(false);
	let controller: AbortController | undefined;
	let compileTimer: ReturnType<typeof setTimeout> | undefined;
	let shareTimer: ReturnType<typeof setTimeout> | undefined;
	let revision = 0;
	let compilationRevision = 0;

	const rawSvg = $derived(compilation?.svg.replaceAll('><', '>\n<') ?? '');

	function isCompilation(value: unknown): value is Compilation {
		if (typeof value !== 'object' || value === null || !('svg' in value) || !('metrics' in value)) {
			return false;
		}
		return (
			typeof value.svg === 'string' && typeof value.metrics === 'object' && value.metrics !== null
		);
	}

	async function compile(workspace: SharedWorkspace): Promise<void> {
		const requestRevision = ++compilationRevision;
		controller?.abort();
		controller = new AbortController();
		compiling = true;
		error = undefined;
		errorLine = undefined;
		try {
			const response = await fetch('/api/compile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify(workspace)
			});
			const payload: unknown = await response.json();
			if (requestRevision !== compilationRevision) return;
			if (
				response.ok &&
				typeof payload === 'object' &&
				payload !== null &&
				'ok' in payload &&
				payload.ok === true &&
				isCompilation(payload)
			) {
				compilation = payload;
				if (localStorage.getItem('schemd:audio') === 'true') emitTone('success');
				return;
			}
			if (typeof payload === 'object' && payload !== null && 'error' in payload) {
				error = typeof payload.error === 'string' ? payload.error : 'Compilation failed';
				if ('line' in payload && typeof payload.line === 'number') errorLine = payload.line;
			} else {
				error = 'The compiler returned an invalid response.';
			}
			if (localStorage.getItem('schemd:audio') === 'true') emitTone('error');
		} catch (reason) {
			if (reason instanceof DOMException && reason.name === 'AbortError') return;
			if (requestRevision !== compilationRevision) return;
			error = reason instanceof Error ? reason.message : 'Compilation request failed.';
		} finally {
			if (requestRevision === compilationRevision) compiling = false;
		}
	}

	async function syncQuery(expectedRevision: number, workspace: SharedWorkspace): Promise<void> {
		const token = await encodeWorkspace(workspace);
		if (expectedRevision !== revision) return;
		const url = new URL(window.location.href);
		url.searchParams.set('code', token);
		if (url.href.length > MAX_SHARE_URL_CHARACTERS) {
			shareStatus = 'Source exceeds safe share-URL budget';
			return;
		}
		history.replaceState(history.state, '', url);
		shareStatus = `${Math.round(url.href.length / 1024)} KiB share state synced`;
	}

	function nodeForLine(line: number): string | undefined {
		const text = source.split('\n')[line - 1] ?? '';
		return /^\s*[a-z][\w-]*:([\w-]+)/iu.exec(text)?.[1];
	}

	function clearVectorHighlight(): void {
		for (const item of previewRoot?.querySelectorAll('.source-linked') ?? []) {
			item.classList.remove('source-linked');
		}
	}

	function highlightVector(line: number): void {
		clearVectorHighlight();
		const id = nodeForLine(line);
		if (!id) return;
		for (const item of previewRoot?.querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`) ?? []) {
			item.classList.add('source-linked');
		}
	}

	function previewPointer(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const node = target.closest<SVGGElement>('[data-node-id]');
		const nodeId = node?.dataset.nodeId;
		if (nodeId) activeLine = sourceLineForNode(source, nodeId);
	}

	function previewClick(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const selectable = target.closest<SVGGElement>('[data-node-id], [data-wire-source]');
		if (!selectable) return;
		for (const element of previewRoot.querySelectorAll('.is-selected')) {
			element.classList.remove('is-selected');
		}
		selectable.classList.add('is-selected');
		if (localStorage.getItem('schemd:audio') === 'true') emitTone('lock');
	}

	function previewKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		const target = event.target;
		if (!(target instanceof Element) || target === previewRoot) return;
		event.preventDefault();
		const selectable = target.closest<SVGGElement>('[data-node-id], [data-wire-source]');
		if (!selectable) return;
		for (const element of previewRoot.querySelectorAll('.is-selected')) {
			element.classList.remove('is-selected');
		}
		selectable.classList.add('is-selected');
	}

	async function copyLink(): Promise<void> {
		await navigator.clipboard.writeText(window.location.href);
		shareStatus = 'Share link copied';
	}

	function downloadSource(): void {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
		link.download = 'schematic.schemd';
		link.click();
		URL.revokeObjectURL(link.href);
	}

	onMount(() => {
		void (async () => {
			const hashSource = location.hash.startsWith('#source=')
				? decodeURIComponent(location.hash.slice('#source='.length))
				: undefined;
			const decoded = initialCode ? await decodeWorkspace(initialCode) : undefined;
			const workspace = decoded ?? (hashSource ? await decodeWorkspace(hashSource) : undefined);
			if (workspace) {
				source = workspace.source;
				mode = workspace.mode;
				title = workspace.title;
				bounds = workspace.bounds;
			} else if (initialCode) {
				shareStatus = 'Shared state was invalid or over budget';
			}
			hydrated = true;
		})();
	});

	$effect(() => {
		const workspace: SharedWorkspace = { source, mode, title, bounds };
		if (!hydrated) return;
		clearTimeout(compileTimer);
		compileTimer = setTimeout(() => void compile(workspace), 120);
		revision += 1;
		const expectedRevision = revision;
		clearTimeout(shareTimer);
		shareTimer = setTimeout(() => void syncQuery(expectedRevision, workspace), 650);
		return () => {
			clearTimeout(compileTimer);
			clearTimeout(shareTimer);
		};
	});

	$effect(() => {
		const root = previewRoot;
		if (!root) return;
		root.addEventListener('pointerover', previewPointer);
		root.addEventListener('click', previewClick);
		root.addEventListener('keydown', previewKeydown);
		return () => {
			root.removeEventListener('pointerover', previewPointer);
			root.removeEventListener('click', previewClick);
			root.removeEventListener('keydown', previewKeydown);
		};
	});
</script>

<WorkspaceShell>
	{#snippet navigation()}
		<div class="pane-title">
			<span>EXPLORER</span><small>{version}</small>
		</div>
		<div class="explorer-section">
			<p>SCHEMATIC</p>
			<button class="file-row active" type="button"><span>◇</span>main.schemd</button>
		</div>
		<div class="explorer-section">
			<p>COMPILER PASSES</p>
			{#each ['default', 'embedded-css', 'full'] as compilerMode}
				<label class="mode-row">
					<input type="radio" bind:group={mode} value={compilerMode} />
					<span>{compilerMode}</span>
				</label>
			{/each}
		</div>
		<div class="explorer-section">
			<p>DOCUMENT</p>
			<label class="field-row">
				<span>Title</span>
				<input bind:value={title} maxlength="80" />
			</label>
			<label class="field-row">
				<span>Bounds</span>
				<input bind:value={bounds} pattern={'\\d{2,4}x\\d{2,4}'} />
			</label>
		</div>
		<div class="explorer-section share-panel">
			<p>PORTABLE STATE</p>
			<small aria-live="polite">{shareStatus}</small>
			<button type="button" onclick={copyLink}>Copy link</button>
			<button type="button" onclick={downloadSource}>Export .schemd</button>
		</div>
	{/snippet}

	{#snippet editor()}
		<header class="pane-title editor-tabbar">
			<span>main.schemd</span>
			<small>{source.length.toLocaleString()} chars</small>
		</header>
		<SyntaxEditor
			bind:value={source}
			{activeLine}
			onLineEnter={highlightVector}
			onLineLeave={clearVectorHighlight}
		/>
		<footer class="diagnostic-bar" class:error>
			{#if error}
				<button type="button" onclick={() => (activeLine = errorLine)}>
					ERR{errorLine ? ` · L${errorLine}` : ''}
					{error}
				</button>
			{:else}
				<span>{compiling ? 'COMPILING' : 'READY'} · {mode}</span>
			{/if}
		</footer>
	{/snippet}

	{#snippet preview()}
		<header class="pane-title preview-tabs">
			<div role="tablist" aria-label="Preview mode">
				<button
					type="button"
					role="tab"
					aria-selected={view === 'render'}
					onclick={() => (view = 'render')}>Render</button
				>
				<button
					type="button"
					role="tab"
					aria-selected={view === 'raw'}
					onclick={() => (view = 'raw')}>Raw SVG</button
				>
			</div>
			{#if compilation}
				<small
					>{Math.round(compilation.metrics.svgBytes / 1024)} KiB · {compilation.metrics.components} nodes</small
				>
			{/if}
		</header>
		<section
			bind:this={previewRoot}
			class="preview-surface"
			aria-label="Compiled schematic preview"
		>
			{#if view === 'render'}
				{#if compilation}
					{@html compilation.svg}
				{:else}
					<div class="empty-state">Compiler channel initializing…</div>
				{/if}
			{:else}
				<pre class="raw-svg"><code>{rawSvg}</code></pre>
			{/if}
		</section>
	{/snippet}
</WorkspaceShell>
