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
	import {
		completionAt,
		completionInsertion,
		type CompletionContext,
		type CompletionVocabulary
	} from '$lib/completion';

	interface Props {
		value?: string;
		/** Compiler vocabulary offered while typing; omit to disable completion. */
		vocabulary?: CompletionVocabulary | undefined;
		/** 0-based line currently mapped from the vector preview, if any. */
		mappedLine?: number | undefined;
		/** 0-based line the compiler flagged as a diagnostic, if any. */
		errorLine?: number | undefined;
		/** Fired when the caret moves to a different 0-based line. */
		oncaretline?: (line: number) => void;
		ariaLabel?: string;
	}

	let {
		value = $bindable(''),
		vocabulary = undefined,
		mappedLine = undefined,
		errorLine = undefined,
		oncaretline,
		ariaLabel = 'schemd source editor'
	}: Props = $props();

	let surface = $state<HTMLElement | undefined>();
	let caretLine = $state(0);

	/* ---------- Completion ---------- */
	let completion = $state<CompletionContext | undefined>();
	let activeItem = $state(0);
	let popoverTop = $state(0);
	let popoverLeft = $state(0);
	const activeId = $derived(completion ? `completion-option-${activeItem}` : undefined);
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
		return (root.textContent ?? '').replace(/\u00a0/g, ' ');
	}

	/* Re-rendering the surface mid-IME-composition destroys the composition
	 * session (dead keys, CJK input), so highlighting waits for compositionend. */
	let composing = false;

	function onInput(event?: Event): void {
		const root = surface;
		if (!root) return;
		if (composing || (event instanceof InputEvent && event.isComposing)) {
			value = readValue(root);
			return;
		}
		const offset = caretOffset(root);
		value = readValue(root);
		render(root, value);
		setCaret(root, offset);
		updateCaretLine(offset);
		refreshCompletion(offset);
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

	/** Close without touching the document. */
	function dismissCompletion(): void {
		completion = undefined;
		activeItem = 0;
	}

	/** Resolve what the caret could be typing, and anchor the list under it. */
	function refreshCompletion(offset?: number): void {
		const root = surface;
		if (!root || !vocabulary) return;
		const at = offset ?? caretOffset(root);
		const next = completionAt(value, at, vocabulary);
		if (!next) {
			dismissCompletion();
			return;
		}
		const selection = window.getSelection();
		const rectangle = selection?.rangeCount
			? selection.getRangeAt(0).getBoundingClientRect()
			: undefined;
		const host = root.getBoundingClientRect();
		if (rectangle && (rectangle.width > 0 || rectangle.height > 0 || rectangle.top !== 0)) {
			popoverTop = rectangle.bottom - host.top + root.scrollTop + 4;
			popoverLeft = rectangle.left - host.left + root.scrollLeft;
		}
		completion = next;
		activeItem = 0;
	}

	/** Locate the text node and offset holding an absolute character offset. */
	function positionAt(
		root: HTMLElement,
		offset: number
	): { node: Node; offset: number } | undefined {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let remaining = offset;
		let node = walker.nextNode();
		while (node) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) return { node, offset: remaining };
			remaining -= length;
			node = walker.nextNode();
		}
		return undefined;
	}

	/** Replace the typed prefix with the chosen entry, keeping undo intact. */
	function acceptCompletion(index = activeItem): void {
		const root = surface;
		const context = completion;
		if (!root || !context) return;
		const item = context.items[index];
		if (item === undefined) return;
		const start = positionAt(root, context.from);
		const end = positionAt(root, context.to);
		dismissCompletion();
		if (!start || !end) return;
		root.focus();
		const range = document.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		/* execCommand keeps the browser's native undo stack for the editor. */
		document.execCommand('insertText', false, completionInsertion(item, context.kind));
		onInput();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (completion) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const step = event.key === 'ArrowDown' ? 1 : -1;
				activeItem = (activeItem + step + completion.items.length) % completion.items.length;
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				acceptCompletion();
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				dismissCompletion();
				return;
			}
		}
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
		{#each { length: lineCount }, index (index)}
			<span
				class="gutter-line"
				class:caret={index === caretLine}
				class:mapped={index === mappedLine}
				class:error={index === errorLine}>{index + 1}</span
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
		onpointerup={() => {
			updateCaretLine();
			dismissCompletion();
		}}
		onblur={dismissCompletion}
		aria-autocomplete="list"
		aria-haspopup="listbox"
		aria-controls={completion ? 'completion-list' : undefined}
		aria-activedescendant={activeId}
		oncompositionstart={() => (composing = true)}
		oncompositionend={() => {
			composing = false;
			onInput();
		}}
	></div>

	{#if completion}
		<!-- Anchored under the caret. Mousedown (not click) so the surface never
		     loses focus before the insertion runs. -->
		<ul
			id="completion-list"
			class="completions"
			role="listbox"
			aria-label="Source completions"
			style={`--top: ${popoverTop}px; --left: ${popoverLeft}px`}
		>
			{#each completion.items as item, index (item)}
				<li
					id={`completion-option-${index}`}
					role="option"
					aria-selected={index === activeItem}
					class:active={index === activeItem}
				>
					<button
						type="button"
						tabindex="-1"
						onmousedown={(event) => {
							event.preventDefault();
							acceptCompletion(index);
						}}
					>
						{item}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.completions {
		position: absolute;
		inset-block-start: var(--top);
		inset-inline-start: var(--left);
		z-index: 20;
		min-inline-size: 9rem;
		max-block-size: 13rem;
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1);
		list-style: none;
		background: var(--bg-raised);
		border: 1px solid var(--line-strong, var(--line));
		box-shadow: 0 8px 24px rgb(0 0 0 / 25%);

		& li {
			border-radius: 2px;

			&.active {
				background: color-mix(in srgb, var(--accent) 18%, transparent);
			}
		}

		& button {
			inline-size: 100%;
			padding: var(--space-1) var(--space-2);
			border: 0;
			background: none;
			color: inherit;
			font: inherit;
			text-align: start;
			cursor: pointer;
		}

		& li.active button {
			color: var(--accent);
		}
	}

	.editor {
		position: relative;
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

		&.error {
			color: var(--accent-ink);
			background: var(--danger);
			font-weight: 700;
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
