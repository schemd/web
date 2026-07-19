<script lang="ts">
	/**
	 * Single-layer schemd editor. No Monaco, no CodeMirror, no mirrored
	 * textarea/pre overlay stack. One `contenteditable="plaintext-only"`
	 * surface holds the real text; on every input the zero-dependency
	 * tokenizer re-renders inline `tok-*` spans while the caret position is
	 * preserved by character offset (TreeWalker over text nodes). Highlighting
	 * a 200-line document re-tokenizes in well under a millisecond.
	 */
	import { highlightLineHtml } from '$lib/tokenizer';

	interface Props {
		value?: string;
		/** 0-based line currently mapped from the vector preview, if any. */
		mappedLine?: number | undefined;
		/** Fired when the caret moves to a different 0-based line. */
		oncaretline?: (line: number) => void;
		ariaLabel?: string;
	}

	let {
		value = $bindable(''),
		mappedLine = undefined,
		oncaretline,
		ariaLabel = 'schemd source editor'
	}: Props = $props();

	let surface = $state<HTMLElement | undefined>();
	let caretLine = $state(0);
	const lineCount = $derived(value.split('\n').length);

	/** Absolute character offset of the caret inside the surface. */
	function caretOffset(root: HTMLElement): number {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return 0;
		const range = selection.getRangeAt(0);
		const probe = range.cloneRange();
		probe.selectNodeContents(root);
		probe.setEnd(range.endContainer, range.endOffset);
		return probe.toString().length;
	}

	/** Restore the caret to an absolute character offset. */
	function setCaret(root: HTMLElement, offset: number): void {
		const selection = window.getSelection();
		if (!selection) return;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let remaining = offset;
		let node = walker.nextNode();
		while (node) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) {
				const range = document.createRange();
				range.setStart(node, remaining);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
				return;
			}
			remaining -= length;
			node = walker.nextNode();
		}
		/* Past the end — place at the very end. */
		const range = document.createRange();
		range.selectNodeContents(root);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	/** Render highlighted HTML for the current value (lines joined by \n text). */
	function render(root: HTMLElement, source: string): void {
		root.innerHTML = source
			.split('\n')
			.map((line) => `<span class="code-line">${highlightLineHtml(line)}</span>`)
			.join('\n');
	}

	/** Read the true text back out of the surface. */
	function readValue(root: HTMLElement): string {
		return (root.textContent ?? '').replace(/ /g, ' ');
	}

	function onInput(): void {
		const root = surface;
		if (!root) return;
		const offset = caretOffset(root);
		value = readValue(root);
		render(root, value);
		setCaret(root, offset);
		updateCaretLine(offset);
	}

	function updateCaretLine(offset?: number): void {
		const root = surface;
		if (!root) return;
		const at = offset ?? caretOffset(root);
		const line = value.slice(0, at).split('\n').length - 1;
		if (line !== caretLine) {
			caretLine = line;
			oncaretline?.(line);
		}
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Tab') {
			/* Keep Tab for indentation but preserve an escape hatch for a11y. */
			if (event.shiftKey) return;
			event.preventDefault();
			document.execCommand('insertText', false, '  ');
		}
	}

	/* Initial paint + external value replacement (share links, samples). */
	$effect(() => {
		const root = surface;
		if (!root) return;
		if (readValue(root) !== value) {
			render(root, value);
		}
	});
</script>

<div class="editor" style={`--mapped-line: ${mappedLine ?? -1}`}>
	<div class="gutter" aria-hidden="true">
		{#each { length: lineCount } as _, index (index)}
			<span
				class="gutter-line"
				class:caret={index === caretLine}
				class:mapped={index === mappedLine}>{index + 1}</span
			>
		{/each}
	</div>
	<div
		bind:this={surface}
		class="surface"
		contenteditable="plaintext-only"
		role="textbox"
		aria-multiline="true"
		aria-label={ariaLabel}
		spellcheck="false"
		tabindex="0"
		oninput={onInput}
		onkeydown={onKeydown}
		onkeyup={() => updateCaretLine()}
		onpointerup={() => updateCaretLine()}
	></div>
</div>

<style>
	.editor {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		block-size: 100%;
		overflow: auto;
		background: var(--bg-inset);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.7;
	}

	.gutter {
		display: flex;
		flex-direction: column;
		padding: var(--space-3) var(--space-2);
		text-align: end;
		color: var(--ink-faint);
		background: var(--bg-raised);
		border-inline-end: 1px solid var(--line);
		user-select: none;
		font-variant-numeric: tabular-nums;
	}

	.gutter-line {
		font-size: inherit;
		line-height: 1.7;

		&.caret {
			color: var(--accent);
		}

		&.mapped {
			color: var(--accent-2);
			background: var(--selection);
		}
	}

	.surface {
		padding: var(--space-3);
		white-space: pre-wrap;
		word-break: break-word;
		caret-color: var(--accent);
		outline: none;
		min-block-size: 100%;

		:global(.code-line) {
			display: inline;
		}
	}
</style>
