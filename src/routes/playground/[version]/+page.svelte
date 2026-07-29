<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import type { SchematicSourceMap } from '@schemd/core';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import WorkspaceShell from '$lib/components/WorkspaceShell.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import IdeCommandPalette from './IdeCommandPalette.svelte';
	import { compileInBrowser, prefetchCompiler } from '$lib/compile-client';
	import { COMPILE_LIMITS } from '$lib/compile-contract';
	import { rasterExportScale } from '$lib/playground-export';
	import {
		decodeWorkspaceState,
		shareableWorkspaceUrl,
		WORKSPACE_OUTPUT_MODES,
		workspaceOutputMode
	} from '$lib/state-uri';
	import { playError, playSuccess } from '$lib/audio';
	import { trackInteraction } from '$lib/telemetry';
	import { ui } from '$lib/ui.svelte';
	import {
		isPlaygroundWorkspaceId,
		parsePlaygroundDraft,
		playgroundDraftKey,
		PLAYGROUND_DRAFT_SESSION_KEY,
		serializePlaygroundDraft
	} from '$lib/playground-draft';

	let { data }: PageProps = $props();

	/* ---------- Workspace state ---------- */
	const params = page.url.searchParams;
	/* Fetch the compiler while the page is still painting, not on first keystroke. */
	if (browser) prefetchCompiler();
	const MODES = WORKSPACE_OUTPUT_MODES;
	const shared = params?.get('code') ?? null;
	function initialSource(): string {
		return (shared !== null ? decodeWorkspaceState(shared) : undefined) ?? data.sample;
	}
	/** Read an integer bound from the URL, clamped to the compiler's legal range. */
	function initialBound(name: 'w' | 'h', fallback: number): number {
		/* A missing param is `null`; `Number(null)` is 0, which would clamp the
		 * default workspace to the 64×64 minimum — guard it before coercing. */
		const raw = params?.get(name);
		if (raw === null || raw === undefined || raw.trim() === '') return fallback;
		const value = Number(raw);
		if (!Number.isFinite(value)) return fallback;
		return Math.max(64, Math.min(4096, Math.round(value)));
	}
	let source = $state(initialSource());
	let mode = $state(workspaceOutputMode(params?.get('m')));
	let view = $state<'render' | 'raw' | 'fence'>('render');
	/* Bounds and title follow a shared/opened example so it renders as authored. */
	let boundsWidth = $state(initialBound('w', 760));
	let boundsHeight = $state(initialBound('h', 440));
	let title = $state(
		(params?.get('t') ?? 'Workspace schematic').slice(0, COMPILE_LIMITS.maxTitleCharacters)
	);
	let draftReady = $state(false);
	let draftState = $state<'loading' | 'recovered' | 'dirty' | 'saved' | 'shared' | 'unavailable'>(
		'loading'
	);
	let savedSharedSnapshot = $state<string | undefined>();
	let notice = $state('');
	let draftWorkspaceId = $state('');
	const draftStorageKey = $derived(
		draftWorkspaceId === '' ? undefined : playgroundDraftKey(data.version, draftWorkspaceId)
	);

	interface EditorApi {
		focus(): void;
		focusLine(line: number): void;
		openFind(withReplace?: boolean): void;
		toggleComment(): void;
		indent(): void;
		outdent(): void;
	}
	interface PaletteApi {
		open(): void;
	}
	let editorApi = $state<EditorApi | undefined>();
	let paletteApi = $state<PaletteApi | undefined>();
	let cursor = $state({ line: 0, column: 0 });

	function initializeDraftWorkspace(): string | undefined {
		try {
			const existing = sessionStorage.getItem(PLAYGROUND_DRAFT_SESSION_KEY);
			if (isPlaygroundWorkspaceId(existing)) return existing;
			const id =
				typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: `tab_${Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) =>
							part.toString(36)
						).join('_')}`;
			sessionStorage.setItem(PLAYGROUND_DRAFT_SESSION_KEY, id);
			return id;
		} catch {
			return undefined;
		}
	}

	onMount(() => {
		const workspaceId = initializeDraftWorkspace();
		if (!workspaceId) {
			draftState = shared === null ? 'unavailable' : 'shared';
			draftReady = true;
			return;
		}
		draftWorkspaceId = workspaceId;
		const key = playgroundDraftKey(data.version, workspaceId);
		if (!key) {
			draftState = 'unavailable';
			draftReady = true;
			return;
		}
		/* Shared URLs are explicit and always win over a local crash draft. */
		if (shared === null) {
			try {
				const draft = parsePlaygroundDraft(localStorage.getItem(key));
				if (draft) {
					const changed =
						draft.source !== source ||
						draft.width !== boundsWidth ||
						draft.height !== boundsHeight ||
						draft.title !== title ||
						draft.mode !== mode;
					source = draft.source;
					boundsWidth = draft.width;
					boundsHeight = draft.height;
					title = draft.title;
					mode = draft.mode;
					if (changed) {
						draftState = 'recovered';
						notice = 'Recovered the last local draft.';
					} else {
						draftState = 'saved';
					}
				} else {
					draftState = 'saved';
				}
			} catch {
				/* Storage can throw in locked-down/private browser contexts. */
				draftState = 'unavailable';
			}
		} else {
			/* Merely opening someone else's share link must not overwrite this
			 * browser's unrelated recovery draft. Shared work is persisted only
			 * after an explicit save command. */
			draftState = 'shared';
		}
		draftReady = true;
	});

	/**
	 * Accept a pasted Markdown ```schemd fence: hoist its bounds and title out of
	 * the source so an example (or a docs snippet) opens exactly as authored. The
	 * match only fires on a *complete* fence, so ordinary typing is untouched.
	 */
	const FENCE_PATTERN =
		/^```schemd\s+bounds="(\d+)x(\d+)"(?:\s+title="([^"]*)")?\s*\n([\s\S]*?)\n```\s*$/;
	function absorbFence(candidate: string): boolean {
		const match = FENCE_PATTERN.exec(candidate.trim());
		if (!match) return false;
		boundsWidth = Math.max(64, Math.min(4096, Number(match[1])));
		boundsHeight = Math.max(64, Math.min(4096, Number(match[2])));
		if (match[3] !== undefined && match[3] !== '') {
			title = match[3].slice(0, COMPILE_LIMITS.maxTitleCharacters);
		}
		source = match[4]!;
		return true;
	}
	$effect(() => {
		absorbFence(source);
	});
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
	let compileNonce = $state(0);
	let handledCompileNonce = 0;
	let compileAnnouncement = $state('');

	function requestCompile(): void {
		compileNonce += 1;
	}

	/* ---------- Debounced compilation ----------
	 * The compiler runs in this tab whenever the browser can load it: the
	 * endpoint runs the very same installed engine, so a round trip per
	 * keystroke bought latency and server CPU and nothing else. The endpoint
	 * remains the fallback, and the debounce shortens to roughly one frame when
	 * compiling locally — a sub-millisecond compile needs no waiting.
	 */
	$effect(() => {
		if (browser && !draftReady) return;
		void compileNonce;
		const payload = {
			source,
			width: boundsWidth,
			height: boundsHeight,
			title,
			mode
		};
		const generation = ++compileGeneration;
		const manual = compileNonce > handledCompileNonce;
		handledCompileNonce = compileNonce;
		const controller = new AbortController();
		compiling = true;
		const debounceMs = manual ? 0 : source.length > 50_000 ? 220 : source.length > 10_000 ? 90 : 24;
		const timer = setTimeout(async () => {
			try {
				const local = await compileInBrowser(payload, controller.signal);
				if (generation !== compileGeneration) return;
				const body: unknown =
					local ??
					(await (
						await fetch('/api/compile', {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(payload),
							signal: controller.signal
						})
					).json());
				if (generation !== compileGeneration) return;
				const record = isRecord(body) ? body : {};
				if (record['ok'] === true) {
					const raw = isRecord(record['metrics']) ? record['metrics'] : {};
					/* Announce from the locals rather than re-reading the reactive
					 * `result`, whose optional fields do not stay narrowed. */
					const metrics = {
						sourceCharacters: Number(raw['sourceCharacters'] ?? 0),
						components: Number(raw['components'] ?? 0),
						connections: Number(raw['connections'] ?? 0),
						svgBytes: Number(raw['svgBytes'] ?? 0)
					};
					result = {
						svg: String(record['svg'] ?? ''),
						metrics,
						sourceMap: parseSourceMap(record['sourceMap']),
						ms: Number(record['ms'] ?? 0)
					};
					if (manual) {
						compileAnnouncement = `Compilation complete. ${metrics.components} components and ${metrics.connections} connections.`;
					}
					if (manual && ui.audio) playSuccess();
				} else {
					const failure = {
						message: String(record['message'] ?? 'Compilation failed.'),
						line: typeof record['line'] === 'number' ? record['line'] : undefined
					};
					result = { ...result, error: failure };
					if (manual) {
						compileAnnouncement = `Compilation error${failure.line === undefined ? '' : ` on line ${failure.line}`}: ${failure.message}`;
					}
					if (manual && ui.audio) playError();
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
		}, debounceMs);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	/* ---------- Complete reproducible state in the URI ---------- */
	$effect(() => {
		if (!browser) return;
		/* Read state synchronously so Svelte can track every dependency. Values
		 * first read inside the timer callback are deliberately not tracked. */
		const workspace = {
			source,
			width: boundsWidth,
			height: boundsHeight,
			title,
			mode
		};
		const timer = setTimeout(() => {
			const url = new URL(location.href);
			const shareable = shareableWorkspaceUrl(url, workspace);
			if (shareable) {
				if (shareable.href === location.href) return;
				replaceState(shareable, page.state);
				return;
			}
			/* A local document may legitimately exceed practical URL limits.
			 * Remove stale workspace fields rather than leaving the address bar
			 * pointing at an older, different program. */
			for (const key of ['code', 'w', 'h', 't', 'm']) url.searchParams.delete(key);
			if (url.href === location.href) return;
			replaceState(url, page.state);
		}, 300);
		return () => clearTimeout(timer);
	});

	/* ---------- Crash-safe local draft ---------- */

	function showNotice(message: string): void {
		notice = message;
		const snapshot = message;
		setTimeout(() => {
			if (notice === snapshot) notice = '';
		}, 2200);
	}

	function saveDraftNow(): void {
		const key = draftStorageKey;
		if (!browser || !draftReady || !key) {
			draftState = 'unavailable';
			return;
		}
		try {
			localStorage.setItem(
				key,
				serializePlaygroundDraft({
					source,
					width: boundsWidth,
					height: boundsHeight,
					title,
					mode
				})
			);
			if (shared !== null) {
				savedSharedSnapshot = JSON.stringify({
					source,
					boundsWidth,
					boundsHeight,
					title,
					mode
				});
			}
			draftState = 'saved';
		} catch {
			draftState = 'unavailable';
		}
	}

	$effect(() => {
		if (!browser || !draftReady) return;
		/* Read the complete snapshot synchronously so every field is tracked. */
		const snapshot = { source, boundsWidth, boundsHeight, title, mode };
		if (shared !== null) {
			draftState = JSON.stringify(snapshot) === savedSharedSnapshot ? 'saved' : 'shared';
			return;
		}
		draftState = 'dirty';
		const timer = setTimeout(saveDraftNow, 450);
		return () => clearTimeout(timer);
	});

	function resetWorkspace(): void {
		const confirmed = (() => {
			try {
				return window.confirm('Discard this draft and restore the verified starter schematic?');
			} catch {
				return false;
			}
		})();
		if (!confirmed) return;
		const key = draftStorageKey;
		try {
			if (key) localStorage.removeItem(key);
		} catch {
			draftState = 'unavailable';
		}
		source = data.sample;
		boundsWidth = 760;
		boundsHeight = 440;
		title = 'Workspace schematic';
		mode = 'full';
		view = 'render';
		showNotice('Starter schematic restored.');
		queueMicrotask(() => editorApi?.focus());
	}

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

	const shareUrl = $derived.by(() => {
		if (!browser) return undefined;
		return shareableWorkspaceUrl(new URL(`/playground/${data.version}`, location.origin), {
			source,
			width: boundsWidth,
			height: boundsHeight,
			title,
			mode
		})?.href;
	});

	let copied = $state(false);
	async function copyShare(): Promise<void> {
		if (shareUrl === undefined) {
			showNotice('Workspace is too large for a reliable URL. Download the source instead.');
			return;
		}
		try {
			await navigator.clipboard.writeText(shareUrl);
			trackInteraction('copy_share');
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* The fully selectable URL remains in browser history when clipboard access is denied. */
		}
	}

	let sourceCopied = $state(false);
	async function copySource(): Promise<void> {
		try {
			await navigator.clipboard.writeText(source);
			sourceCopied = true;
			showNotice('Source copied.');
			setTimeout(() => (sourceCopied = false), 1600);
		} catch {
			showNotice('Clipboard access was denied.');
		}
	}

	/* ---------- Fenced-markdown form (for pasting into a Markdown pipeline) ---------- */
	/* Fence titles cannot escape quotes, so strip them exactly like the compile endpoint. */
	const fenceMarkdown = $derived(
		'```schemd bounds="' +
			boundsWidth +
			'x' +
			boundsHeight +
			'" title="' +
			(title.replace(/["\r\n]/g, '').trim() || 'Playground schematic') +
			'"\n' +
			source +
			'\n```'
	);
	let fenceCopied = $state(false);
	async function copyFence(): Promise<void> {
		try {
			await navigator.clipboard.writeText(fenceMarkdown);
			trackInteraction('copy_fence');
			fenceCopied = true;
			setTimeout(() => (fenceCopied = false), 1600);
		} catch {
			/* The fence stays visible and selectable. */
		}
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
		/* The compiler already declares xmlns; adding a second copy is an XML parse error. */
		const namespaced = svg.includes('xmlns=')
			? svg
			: svg.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg"`);
		return namespaced.replace(/(<svg[^>]*>)/, `$1<style>${rootRule}${tokenRules}</style>`);
	}

	function triggerDownload(href: string, filename: string): void {
		const anchor = document.createElement('a');
		anchor.href = href;
		anchor.download = filename;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
	}

	function safeFilename(): string {
		const stem = title
			.toLocaleLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 64);
		return stem || 'schemd-schematic';
	}

	function downloadSource(): void {
		const url = URL.createObjectURL(new Blob([fenceMarkdown + '\n'], { type: 'text/markdown' }));
		triggerDownload(url, `${safeFilename()}.schemd.md`);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		showNotice('Source downloaded.');
	}

	function downloadSvg(): void {
		const svg = themedSvg();
		if (!svg) return;
		const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
		triggerDownload(url, `${safeFilename()}.svg`);
		trackInteraction('download_svg');
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function downloadPng(): void {
		const svg = themedSvg();
		if (!svg) return;
		const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
		const image = new Image();
		let sourceUrlLive = true;
		const releaseSource = (): void => {
			if (!sourceUrlLive) return;
			sourceUrlLive = false;
			URL.revokeObjectURL(url);
		};
		setTimeout(releaseSource, 30_000);
		image.onload = () => {
			try {
				const scale = rasterExportScale(boundsWidth, boundsHeight);
				if (scale === 0) throw new Error('Invalid raster dimensions.');
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(boundsWidth * scale);
				canvas.height = Math.round(boundsHeight * scale);
				const context = canvas.getContext('2d');
				if (!context) throw new Error('Canvas unavailable.');
				context.scale(scale, scale);
				context.drawImage(image, 0, 0, boundsWidth, boundsHeight);
				releaseSource();
				canvas.toBlob((blob) => {
					if (!blob) {
						showNotice('PNG export is unavailable in this browser.');
						return;
					}
					const pngUrl = URL.createObjectURL(blob);
					triggerDownload(pngUrl, `${safeFilename()}.png`);
					trackInteraction('download_png');
					setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
				}, 'image/png');
			} catch {
				releaseSource();
				showNotice('PNG export failed safely. Download SVG instead.');
			}
		};
		image.onerror = () => {
			releaseSource();
			showNotice('PNG export could not decode the generated SVG.');
		};
		image.decoding = 'async';
		image.src = url;
	}

	/** Shareable read-only embed URL for the current workspace. */
	const embedUrl = $derived.by(() => {
		if (!browser) return undefined;
		return shareableWorkspaceUrl(new URL(`/embed/${data.version}`, location.origin), {
			source,
			width: boundsWidth,
			height: boundsHeight,
			title,
			mode
		})?.href;
	});
	let embedCopied = $state(false);
	async function copyEmbed(): Promise<void> {
		if (embedUrl === undefined) {
			showNotice('Workspace is too large for a reliable embed URL. Download the source instead.');
			return;
		}
		try {
			await navigator.clipboard.writeText(embedUrl);
			trackInteraction('copy_embed');
			embedCopied = true;
			setTimeout(() => (embedCopied = false), 1600);
		} catch {
			/* Clipboard policies vary in embedded browsers; do not break the workspace. */
		}
	}

	const ideCommands = $derived.by(() => {
		const commands = [
			{
				id: 'focus-source',
				label: 'Focus source editor',
				detail: 'Return the caret to Schemd source',
				run: () => editorApi?.focus()
			},
			{
				id: 'find',
				label: 'Find',
				detail: 'Literal search in source',
				shortcut: '⌘F',
				run: () => editorApi?.openFind(false)
			},
			{
				id: 'replace',
				label: 'Find and replace',
				detail: 'Replace one or every literal match',
				shortcut: '⌘H',
				run: () => editorApi?.openFind(true)
			},
			{
				id: 'toggle-comment',
				label: 'Toggle line comment',
				detail: 'Comment or uncomment the selection',
				shortcut: '⌘/',
				run: () => editorApi?.toggleComment()
			},
			{
				id: 'compile',
				label: 'Compile now',
				detail: 'Bypass the edit debounce',
				shortcut: '⌘↵',
				run: requestCompile
			},
			{
				id: 'render',
				label: 'Show rendered preview',
				detail: 'Switch the output pane to SVG',
				run: () => {
					view = 'render';
				}
			},
			{
				id: 'raw',
				label: 'Show raw SVG',
				detail: 'Inspect compiler markup',
				run: () => {
					view = 'raw';
				}
			},
			{
				id: 'fence',
				label: 'Show Markdown fence',
				detail: 'Inspect the portable fenced source',
				run: () => {
					view = 'fence';
				}
			},
			{
				id: 'copy-source',
				label: 'Copy source',
				detail: 'Copy plain Schemd source',
				run: copySource
			},
			{
				id: 'copy-fence',
				label: 'Copy Markdown fence',
				detail: 'Copy bounds, title, and source',
				run: copyFence
			},
			{
				id: 'copy-share',
				label: 'Copy share link',
				detail:
					shareUrl === undefined
						? 'Document is too large for a reliable URL'
						: 'Encode this workspace in a URL',
				run: copyShare
			},
			{
				id: 'download-source',
				label: 'Download source',
				detail: 'Save a self-describing .schemd.md file',
				run: downloadSource
			},
			{
				id: 'download-svg',
				label: 'Download SVG',
				detail: 'Save a standalone themed vector',
				run: downloadSvg
			},
			{
				id: 'download-png',
				label: 'Download PNG',
				detail: 'Rasterize a 2× preview locally',
				run: downloadPng
			},
			{
				id: 'toggle-reference',
				label: `${leftOpen ? 'Hide' : 'Show'} reference`,
				detail: 'Toggle the component vocabulary pane',
				run: () => {
					leftOpen = !leftOpen;
				}
			},
			{
				id: 'toggle-preview',
				label: `${rightOpen ? 'Hide' : 'Show'} preview`,
				detail: 'Toggle the compiler output pane',
				run: () => {
					rightOpen = !rightOpen;
				}
			},
			{
				id: 'save',
				label: 'Save recovery draft',
				detail: 'Persist this workspace in this browser',
				shortcut: '⌘S',
				run: () => {
					saveDraftNow();
					showNotice('Recovery draft saved.');
				}
			},
			{
				id: 'reset',
				label: 'Restore starter schematic',
				detail: 'Discard the local draft after confirmation',
				run: resetWorkspace
			}
		];
		if (result.error?.line !== undefined) {
			commands.unshift({
				id: 'diagnostic',
				label: `Go to error on line ${result.error.line}`,
				detail: result.error.message,
				shortcut: 'F8',
				run: () => editorApi?.focusLine(result.error!.line! - 1)
			});
		}
		return commands;
	});

	function onWindowKeydown(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 's') {
			event.preventDefault();
			saveDraftNow();
			showNotice('Recovery draft saved.');
		} else if (event.key === 'F8' && result.error?.line !== undefined) {
			event.preventDefault();
			editorApi?.focusLine(result.error.line - 1);
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<Seo
	title={`Playground · schemd v${data.version}`}
	description="Compile schemd source to SVG live: three output modes, a raw markup view, and shareable workspace links."
	canonicalPath={`/playground/${data.latest}`}
	noindex
/>

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
			<p class="microlabel">fence · bounds (px)</p>
			<div class="fence-controls">
				<label>
					<span class="microlabel">width</span>
					<input
						type="number"
						min="64"
						max="4096"
						step="10"
						inputmode="numeric"
						bind:value={boundsWidth}
					/>
				</label>
				<label>
					<span class="microlabel">height</span>
					<input
						type="number"
						min="64"
						max="4096"
						step="10"
						inputmode="numeric"
						bind:value={boundsHeight}
					/>
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
				<div class="compile-summary">
					<span class="microlabel">
						{result.error
							? `error${result.error.line ? ` · line ${result.error.line}` : ''}`
							: compiling
								? 'compiling…'
								: result.metrics
									? 'compiled'
									: 'ready'}
					</span>
					{#if result.metrics && !result.error}
						<span class="readout">
							{result.metrics.components} nodes · {result.metrics.connections} wires ·
							{result.metrics.svgBytes.toLocaleString('en-US')} B · {result.ms} ms
						</span>
					{/if}
					<button
						type="button"
						class="command-trigger"
						onclick={() => paletteApi?.open()}
						aria-label="Open playground command palette"
						title="Playground commands (F1 or Command/Control Shift P)"
					>
						commands <kbd>F1</kbd>
					</button>
				</div>
			</div>
			<CodeEditor
				bind:value={source}
				onready={(api) => (editorApi = api)}
				vocabulary={{
					kinds: data.kindGroups.flatMap((group) => group.kinds),
					colors: data.colors,
					orientations: data.orientations
				}}
				{mappedLine}
				errorLine={result.error?.line !== undefined ? result.error.line - 1 : undefined}
				oncaretline={(line) => (caretLine = line)}
				onpositionchange={(position) => (cursor = position)}
				oncompile={requestCompile}
				maxLength={COMPILE_LIMITS.maxSourceCharacters}
			/>
			{#if result.error}
				<section
					id="compiler-diagnostic"
					class="diagnostic-panel"
					aria-label="Compiler diagnostics"
				>
					<span class="diagnostic-severity">error</span>
					<p>{result.error.message}</p>
					{#if result.error.line !== undefined}
						<button type="button" onclick={() => editorApi?.focusLine(result.error!.line! - 1)}>
							Go to line {result.error.line} <kbd>F8</kbd>
						</button>
					{/if}
				</section>
			{/if}
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
		<span class="microlabel">Ln {cursor.line + 1}, Col {cursor.column + 1}</span>
		<span class="draft-status" data-state={draftState}>
			{draftState === 'dirty'
				? '● unsaved'
				: draftState === 'unavailable'
					? 'local save unavailable'
					: draftState === 'shared'
						? 'shared · save manually'
						: draftState === 'recovered'
							? 'recovered'
							: 'saved locally'}
		</span>
		<span class="microlabel">mode={mode}</span>
		<button type="button" class="status-action" onclick={copySource}>
			{sourceCopied ? '✓ source copied' : '⧉ source'}
		</button>
		<button type="button" class="status-action" onclick={downloadSource} title="Download source"
			>↓ source</button
		>
		<button type="button" class="status-action" onclick={downloadSvg} title="Download themed SVG"
			>↓ svg</button
		>
		<button type="button" class="status-action" onclick={downloadPng} title="Download 2× PNG"
			>↓ png</button
		>
		<button
			type="button"
			class="status-action"
			onclick={copyEmbed}
			aria-live="polite"
			disabled={embedUrl === undefined}
			title={embedUrl === undefined
				? 'Document is too large for a reliable embed URL'
				: 'Copy embed URL'}
		>
			{embedCopied ? '✓ embed copied' : '⧉ embed'}
		</button>
		<button
			type="button"
			class="status-action"
			onclick={copyShare}
			aria-live="polite"
			disabled={shareUrl === undefined}
			title={shareUrl === undefined
				? 'Document is too large for a reliable share URL'
				: 'Copy share URL'}
		>
			{copied ? '✓ link copied' : '⧉ share'}
		</button>
	{/snippet}
</WorkspaceShell>

<IdeCommandPalette commands={ideCommands} onready={(api) => (paletteApi = api)} />
<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
	{compileAnnouncement}
</p>
<div class="workspace-notice" aria-live="polite" aria-atomic="true">{notice}</div>

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

		&:disabled {
			color: var(--ink-faint);
			cursor: not-allowed;
			opacity: 0.55;
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
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);

		& label {
			display: grid;
			gap: 2px;
			min-inline-size: 0;
		}

		& input {
			inline-size: 100%;
			min-inline-size: 0;
			box-sizing: border-box;
			background: var(--bg-inset);
			border: 1px solid var(--line-strong);
			color: var(--ink);
			font-family: var(--font-mono);
			font-size: var(--text-sm);
			padding: 0.4rem 0.55rem;
			transition: border-color var(--dur-fast) var(--ease-precise);
		}

		& input:focus-visible {
			outline: none;
			border-color: var(--accent);
		}

		& .fence-title {
			grid-column: 1 / -1;
		}
	}

	.ref-docs {
		font-size: var(--text-xs);
		margin-block-start: var(--space-2);
	}

	.editor-pane,
	.preview-pane {
		display: grid;
		min-block-size: 0;
	}

	.editor-pane {
		grid-template-rows: auto minmax(0, 1fr) auto;
	}

	.preview-pane {
		grid-template-rows: auto minmax(0, 1fr);
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

	.compile-summary {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		min-inline-size: 0;
		flex-wrap: wrap;
	}

	.command-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.2rem 0.45rem;
		color: var(--ink-mute);
		border: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);

		&:hover {
			color: var(--accent);
			border-color: var(--line-strong);
		}
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

	.diagnostic-panel {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: color-mix(in srgb, var(--danger) 9%, var(--bg-raised));
		border-block-start: 1px solid color-mix(in srgb, var(--danger) 55%, var(--line));
		font-family: var(--font-mono);
		font-size: var(--text-xs);

		& p {
			min-inline-size: 0;
			margin: 0;
			overflow-wrap: anywhere;
		}

		& button {
			padding: 0.2rem 0.45rem;
			color: var(--danger);
			border: 1px solid color-mix(in srgb, var(--danger) 50%, var(--line));
			white-space: nowrap;
		}
	}

	.diagnostic-severity {
		padding: 0.05rem 0.4rem;
		color: var(--accent-ink);
		background: var(--danger);
		text-transform: uppercase;
		font-size: var(--text-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
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

	.draft-status {
		color: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);

		&[data-state='dirty'] {
			color: var(--amber, var(--accent));
		}

		&[data-state='unavailable'] {
			color: var(--danger);
		}
	}

	.workspace-notice {
		position: fixed;
		inset-inline-start: 50%;
		inset-block-end: calc(var(--statusbar-h) + var(--space-3));
		z-index: 80;
		max-inline-size: min(32rem, calc(100vw - 2rem));
		padding: var(--space-2) var(--space-3);
		transform: translateX(-50%);
		color: var(--ink);
		background: var(--bg-raised);
		border: 1px solid var(--line-strong);
		box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
		font-family: var(--font-mono);
		font-size: var(--text-xs);

		&:empty {
			display: none;
		}
	}

	@media (max-width: 620px) {
		.editor-toolbar,
		.preview-toolbar {
			align-items: stretch;
		}

		.compile-summary {
			justify-content: space-between;
			inline-size: 100%;
		}

		.readout {
			display: none;
		}

		.diagnostic-panel {
			grid-template-columns: auto minmax(0, 1fr);

			& button {
				grid-column: 1 / -1;
				justify-self: start;
			}
		}
	}
</style>
