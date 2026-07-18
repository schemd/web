<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { acceptsCompilation, createCoordinatorState, nextCompilation, type CompilationCoordinatorState } from '$lib/playground/coordinator';
	import { fenceInfo, getPlaygroundExample } from '$lib/playground/examples';
	import { isCompilerWorkerResponse, type CompileRequest } from '$lib/playground/protocol';
	import { decodeSharedSource, encodeSharedSource, svgFileName } from '$lib/playground/share';
	import { createVersionWorker } from '$lib/playground/workers';
	import { breadcrumbSchema } from '$lib/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// svelte-ignore state_referenced_locally
	let source = $state<string>(data.initialExample.source);
	// svelte-ignore state_referenced_locally
	let selectedExample = $state<string>(data.initialExample.id);
	// svelte-ignore state_referenced_locally
	let previewSvg = $state<string>(data.initialSvg);
	let previewScale = $state<'fit' | '100' | '200'>('fit');
	let worker = $state<Worker | undefined>();
	let debounceTimer = $state<ReturnType<typeof setTimeout> | undefined>();
	let coordinator = $state<CompilationCoordinatorState>(createCoordinatorState());
	let compiling = $state(false);
	let composing = $state(false);
	let diagnostic = $state<{ message: string; line?: number } | undefined>();
	let workerFailed = $state(false);
	let announcement = $state('Initial diagram compiled.');
	// svelte-ignore state_referenced_locally
	let metrics = $state(data.initialMetrics);
	let editor = $state<HTMLTextAreaElement>();

	let activeExample = $derived(getPlaygroundExample(selectedExample) ?? data.initialExample);
	let sourceNearLimit = $derived(source.length > data.maximumCharacters * 0.8);
	let sourceEmpty = $derived(source.trim().length === 0);
	let canonicalPath = $derived(`/playground/${data.version.id}`);
	let schema = $derived(breadcrumbSchema([{ name: 'Schemd', path: '/' }, { name: `Playground ${data.version.id}`, path: canonicalPath }]));

	function clearTimer(): void {
		if (debounceTimer !== undefined) clearTimeout(debounceTimer);
		debounceTimer = undefined;
	}

	function sendCompilation(): void {
		clearTimer();
		if (sourceEmpty) {
			compiling = false;
			diagnostic = undefined;
			previewSvg = '';
			announcement = 'Editor is empty. Add a component to compile.';
			return;
		}
		const next = nextCompilation(coordinator, source);
		if (!next) return;
		coordinator = next.state;
		compiling = true;
		diagnostic = undefined;
		announcement = 'Compiling diagram.';
		const request: CompileRequest = {
			kind: 'compile', id: next.requestId, version: data.version.id, source, fence: fenceInfo(activeExample)
		};
		worker?.postMessage(request);
	}

	function scheduleCompilation(): void {
		if (composing) return;
		clearTimer();
		debounceTimer = setTimeout(sendCompilation, 180);
	}

	async function startWorker(): Promise<void> {
		worker?.terminate();
		workerFailed = false;
		worker = await createVersionWorker(data.version.id);
		worker.addEventListener('message', (event: MessageEvent<unknown>) => {
			if (!isCompilerWorkerResponse(event.data)) return;
			if (event.data.kind === 'ready') { sendCompilation(); return; }
			if (!acceptsCompilation(coordinator, event.data)) return;
			compiling = false;
			if (event.data.kind === 'success') {
				previewSvg = event.data.svg;
				metrics = event.data.metrics;
				diagnostic = undefined;
				announcement = `Compiled ${event.data.metrics.components} components and ${event.data.metrics.connections} connections.`;
			} else {
				diagnostic = event.data.diagnostic;
				announcement = event.data.diagnostic.message;
			}
		});
		worker.addEventListener('error', () => {
			compiling = false;
			workerFailed = true;
			announcement = 'The compiler worker stopped. Restart it to continue.';
		});
	}

	function loadExample(): void {
		const example = getPlaygroundExample(selectedExample);
		if (!example) return;
		source = example.source;
		coordinator = createCoordinatorState();
		scheduleCompilation();
	}

	function resetExample(): void {
		source = activeExample.source;
		coordinator = createCoordinatorState();
		scheduleCompilation();
		announcement = `Reset to ${activeExample.label}.`;
	}

	async function copyText(value: string, label: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			announcement = `${label} copied.`;
		} catch {
			announcement = `${label} could not be copied. Select it manually.`;
		}
	}

	function downloadSvg(): void {
		if (!previewSvg) return;
		const url = URL.createObjectURL(new Blob([previewSvg], { type: 'image/svg+xml;charset=utf-8' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = svgFileName(activeExample.title);
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
		announcement = 'SVG download started.';
	}

	async function shareSource(): Promise<void> {
		const hash = encodeSharedSource(source);
		history.replaceState(null, '', hash);
		await copyText(location.href, 'Share link');
	}

	function focusDiagnosticLine(): void {
		if (!editor || diagnostic?.line === undefined) return;
		const lines = source.split('\n');
		let start = 0;
		for (let index = 1; index < diagnostic.line; index += 1) start += (lines[index - 1] ?? '').length + 1;
		const end = start + (lines[diagnostic.line - 1] ?? '').length;
		editor.focus();
		editor.setSelectionRange(start, end);
	}

	$effect(() => {
		const shared = decodeSharedSource(location.hash, data.maximumCharacters);
		if (shared !== undefined) {
			source = shared;
			selectedExample = data.initialExample.id;
			announcement = 'Loaded source from the shared link.';
		}
		startWorker();
		return () => { clearTimer(); worker?.terminate(); };
	});
</script>

<Seo title={`Playground ${data.version.id} — Schemd`} description="Edit Schemd source, compile in an isolated worker, inspect diagnostics, and export deterministic SVG." path={canonicalPath} structuredData={schema} />

<div class="playground-page page-shell">
	<header class="playground-header">
		<div class="flow"><nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Playground {data.version.id}</li></ol></nav><p class="eyebrow">Worker-isolated compiler</p><h1>Write the source. Inspect the vector.</h1><p class="lede">The textarea stays light. Compilation is debounced, bounded, and moved off the main thread.</p></div>
		<form action="/playground/select" method="get"><label for="playground-version">Compiler version</label><div><select id="playground-version" name="version">{#each data.versions as version}<option value={version.id} selected={version.id === data.version.id}>{version.id} · {version.channel}</option>{/each}</select><button type="submit">Load</button></div></form>
	</header>

	<section class="workbench" aria-label="Schemd workbench">
		<div class="editor-panel">
			<div class="panel-bar"><div><span class="panel-index">01</span><strong>Source</strong></div><span>{source.length.toLocaleString()} / {data.maximumCharacters.toLocaleString()}</span></div>
			<div class="editor-tools">
				<label for="example-select">Example</label>
				<select id="example-select" bind:value={selectedExample} onchange={loadExample}>{#each data.examples as example}<option value={example.id}>{example.label}</option>{/each}</select>
				<button type="button" onclick={resetExample}>Reset</button>
				<button type="button" onclick={() => copyText(source, 'Source')}>Copy source</button>
			</div>
			<label class="visually-hidden" for="schemd-editor">Schemd source</label>
			<textarea id="schemd-editor" bind:this={editor} bind:value={source} maxlength={data.maximumCharacters} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="editor-help editor-diagnostic" aria-invalid={diagnostic ? 'true' : undefined} oninput={scheduleCompilation} oncompositionstart={() => composing = true} oncompositionend={() => { composing = false; scheduleCompilation(); }}></textarea>
			<div id="editor-help" class="editor-help"><span>{sourceNearLimit ? 'Approaching the source limit.' : 'Coordinates use the selected example bounds.'}</span><span>{compiling ? 'Compiling…' : '180 ms debounce'}</span></div>
			<div id="editor-diagnostic" class:has-error={diagnostic} class="diagnostic">
				{#if diagnostic}<button type="button" onclick={focusDiagnosticLine}><strong>{diagnostic.line ? `Line ${diagnostic.line}` : 'Compiler error'}</strong><span>{diagnostic.message}</span></button>{:else if sourceEmpty}<p>Add at least one component declaration.</p>{:else}<p><span class="status-dot"></span> No compiler diagnostics.</p>{/if}
			</div>
		</div>

		<div class="preview-panel">
			<div class="panel-bar"><div><span class="panel-index">02</span><strong>SVG preview</strong></div><span>{metrics.svgBytes.toLocaleString()} bytes</span></div>
			<div class="preview-tools">
				<label for="preview-scale">Preview size</label><select id="preview-scale" bind:value={previewScale}><option value="fit">Fit</option><option value="100">100%</option><option value="200">200%</option></select>
				<button type="button" onclick={() => copyText(previewSvg, 'SVG')} disabled={!previewSvg}>Copy SVG</button>
				<button type="button" onclick={downloadSvg} disabled={!previewSvg}>Download</button>
				<button type="button" onclick={shareSource}>Share</button>
			</div>
			<div class:scale-100={previewScale === '100'} class:scale-200={previewScale === '200'} class="preview-stage">
				{#if workerFailed}<div class="preview-state"><p>The compiler worker stopped before it could return a result.</p><button type="button" onclick={startWorker}>Restart worker</button></div>{:else if sourceEmpty}<div class="preview-state"><p>The preview is empty because the editor has no component declarations.</p></div>{:else if previewSvg}<iframe title={`SVG preview: ${activeExample.title}`} sandbox="" srcdoc={previewSvg}></iframe>{:else}<div class="preview-state"><p>{compiling ? 'Loading the versioned compiler…' : 'No SVG is available.'}</p></div>{/if}
			</div>
			<dl class="preview-metrics"><div><dt>Components</dt><dd>{metrics.components}</dd></div><div><dt>Connections</dt><dd>{metrics.connections}</dd></div><div><dt>Source</dt><dd>{metrics.sourceCharacters} chars</dd></div><div><dt>Output</dt><dd>{metrics.svgBytes} B</dd></div></dl>
		</div>
	</section>
	<p class="playground-note">Preview content is compiler output rendered inside a sandboxed frame. <a href={`/docs/${data.version.id}/grammar`}>Read the grammar and diagnostics contract.</a></p>
	<p class="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</p>
</div>

<style>
	.playground-page { padding-block: 2.5rem 5rem; }
	.playground-header { display: grid; grid-template-columns: minmax(20rem, 1fr) minmax(12rem, 18rem); align-items: end; gap: 3rem; padding-block: 1.5rem 3rem; }
	.playground-header h1 { max-inline-size: 14ch; font-size: var(--step-3); }
	.playground-header form { display: grid; gap: 0.4rem; }
	.playground-header form label { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; }
	.playground-header form > div { display: flex; gap: 0.4rem; }
	.playground-header select { min-inline-size: 0; flex: 1; }
	.playground-header button { padding-inline: 0.8rem; }
	.workbench { display: grid; grid-template-columns: minmax(20rem, 0.9fr) minmax(24rem, 1.1fr); min-block-size: 46rem; border: 1px solid var(--line-strong); background: var(--ink-1); }
	.editor-panel, .preview-panel { display: grid; min-inline-size: 0; grid-template-rows: auto auto 1fr auto; }
	.preview-panel { border-inline-start: 1px solid var(--line-strong); }
	.panel-bar, .editor-tools, .preview-tools, .editor-help { display: flex; align-items: center; gap: 0.6rem; }
	.panel-bar { justify-content: space-between; min-block-size: 3rem; border-block-end: 1px solid var(--line); padding-inline: 0.9rem; font-size: var(--step--1); }
	.panel-bar > div { display: flex; gap: 0.65rem; }
	.panel-bar > span { color: var(--muted); font-family: var(--font-mono); font-size: 0.68rem; }
	.panel-index { color: var(--signal); font-family: var(--font-mono); }
	.editor-tools, .preview-tools { flex-wrap: wrap; border-block-end: 1px solid var(--line); padding: 0.55rem; }
	.editor-tools label, .preview-tools label { color: var(--muted); font-size: 0.7rem; }
	.editor-tools select { min-inline-size: 8rem; flex: 1; }
	.editor-tools button, .preview-tools button { min-block-size: 2.4rem; padding-inline: 0.7rem; font-size: 0.74rem; }
	.preview-tools select { min-block-size: 2.4rem; }
	button:disabled { cursor: not-allowed; opacity: 0.45; }
	textarea { inline-size: 100%; min-block-size: 31rem; resize: vertical; border: 0; border-radius: 0; padding: 1rem; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.75; tab-size: 2; }
	.editor-help { justify-content: space-between; border-block-start: 1px solid var(--line); padding: 0.4rem 0.75rem; color: var(--muted); font-size: 0.68rem; }
	.diagnostic { min-block-size: 4rem; border-block-start: 1px solid var(--line); padding: 0.75rem; color: var(--muted); font-size: 0.75rem; }
	.diagnostic.has-error { border-color: var(--danger); background: rgb(255 143 123 / 0.06); }
	.diagnostic button { display: grid; justify-items: start; inline-size: 100%; min-block-size: 0; border: 0; background: transparent; padding: 0; color: var(--danger); text-align: start; }
	.diagnostic button span { font-weight: 400; }
	.preview-stage { display: grid; place-items: center; overflow: auto; min-block-size: 34rem; background: var(--paper); padding: 1rem; }
	.preview-stage iframe { inline-size: 100%; block-size: 100%; min-block-size: 31rem; border: 0; background: var(--paper); }
	.preview-stage.scale-100 iframe { inline-size: 50rem; max-inline-size: none; }
	.preview-stage.scale-200 iframe { inline-size: 100rem; max-inline-size: none; }
	.preview-state { display: grid; justify-items: center; gap: 1rem; max-inline-size: 34ch; color: #27342f; text-align: center; }
	.preview-state button { padding-inline: 1rem; }
	.preview-metrics { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0; border-block-start: 1px solid var(--line); }
	.preview-metrics div { padding: 0.55rem 0.7rem; }
	.preview-metrics div + div { border-inline-start: 1px solid var(--line); }
	.preview-metrics dt { color: var(--muted); font-size: 0.62rem; text-transform: uppercase; }
	.preview-metrics dd { margin: 0; font-family: var(--font-mono); font-size: 0.72rem; }
	.playground-note { margin-block-start: 1rem; color: var(--muted); font-size: 0.75rem; }
	.playground-note a { color: var(--signal); }
	@media (max-width: 64rem) { .playground-header { grid-template-columns: 1fr; } .workbench { grid-template-columns: 1fr; } .preview-panel { border-block-start: 1px solid var(--line-strong); border-inline-start: 0; } }
	@media (max-width: 40rem) { .playground-page { padding-inline: 0; } .playground-header, .playground-note { margin-inline: var(--gutter); } .preview-metrics { grid-template-columns: repeat(2, 1fr); } .preview-metrics div:nth-child(3) { border-block-start: 1px solid var(--line); border-inline-start: 0; } .preview-metrics div:nth-child(4) { border-block-start: 1px solid var(--line); } }
</style>
