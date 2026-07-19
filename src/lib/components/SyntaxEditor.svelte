<script lang="ts">
	import { tick } from 'svelte';
	import { tokenizeLine } from '$lib/playground/tokenizer';

	let {
		value = $bindable(),
		activeLine,
		onLineEnter,
		onLineLeave
	}: {
		value: string;
		activeLine?: number;
		onLineEnter?: (line: number) => void;
		onLineLeave?: () => void;
	} = $props();

	interface EditorSelection {
		readonly start: number;
		readonly end: number;
	}

	interface HistoryEntry {
		readonly source: string;
		readonly caret: number;
	}

	let editor: HTMLDivElement;
	let inputRevision = 0;
	let composing = false;
	let hoveredLine: number | undefined;
	let pendingSelection: EditorSelection | undefined;
	let lastEditKind = '';
	let lastEditAt = 0;
	let lastEditCaret = -1;
	const undoStack: HistoryEntry[] = [];
	const redoStack: HistoryEntry[] = [];
	const maximumHistoryCharacters = 1_000_000;
	const lines = $derived(value.split('\n'));
	const blockElements = new Set([
		'ADDRESS',
		'ARTICLE',
		'ASIDE',
		'BLOCKQUOTE',
		'DIV',
		'FOOTER',
		'HEADER',
		'LI',
		'MAIN',
		'NAV',
		'OL',
		'P',
		'PRE',
		'SECTION',
		'UL'
	]);
	const lineNumbers = $derived(Array.from({ length: lines.length }, (_, index) => index + 1));
	const highlightedSource = $derived(
		lines
			.map((line, lineIndex) => {
				const tokens = tokenizeLine(line)
					.map(
						(token) => `<span class="token token-${token.kind}">${escapeHtml(token.value)}</span>`
					)
					.join('');
				return `<span class="code-line" data-line="${lineIndex + 1}" role="presentation">${tokens}</span>`;
			})
			.join('\n')
	);

	function escapeHtml(input: string): string {
		return input.replace(
			/[&<>"']/gu,
			(character) =>
				({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				})[character] ?? character
		);
	}

	function editableText(root: Node): string {
		function walk(parent: Node): string {
			let result = '';
			for (const child of parent.childNodes) {
				if (child.nodeType === Node.TEXT_NODE) {
					result += child.textContent ?? '';
					continue;
				}
				if (!(child instanceof HTMLElement)) continue;
				if (child.tagName === 'BR') {
					result += '\n';
					continue;
				}

				const block = blockElements.has(child.tagName);
				if (block && result.length > 0 && !result.endsWith('\n')) result += '\n';
				result += walk(child);
				if (block && !result.endsWith('\n')) result += '\n';
			}
			return result;
		}

		let result = walk(root).replaceAll('\u00a0', ' ').replace(/\r\n?/gu, '\n');
		const lastChild = root.lastChild;
		if (
			result.endsWith('\n') &&
			lastChild instanceof HTMLElement &&
			blockElements.has(lastChild.tagName)
		) {
			result = result.slice(0, -1);
		}
		return result;
	}

	function textOffset(root: Node, container: Node, offset: number): number {
		if (container !== root && !root.contains(container)) return value.length;
		const prefix = document.createRange();
		prefix.selectNodeContents(root);
		prefix.setEnd(container, offset);
		return editableText(prefix.cloneContents()).length;
	}

	function selectionOffsets(root: Node): EditorSelection {
		const selection = window.getSelection();
		if (!selection?.rangeCount) return { start: value.length, end: value.length };
		const range = selection.getRangeAt(0);
		return {
			start: textOffset(root, range.startContainer, range.startOffset),
			end: textOffset(root, range.endContainer, range.endOffset)
		};
	}

	function caretOffset(root: Node): number {
		return selectionOffsets(root).end;
	}

	function restoreCaret(root: Node, offset: number): void {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let remaining = offset;
		let node = walker.nextNode();
		while (node) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) {
				const selection = window.getSelection();
				const range = document.createRange();
				range.setStart(node, remaining);
				range.collapse(true);
				selection?.removeAllRanges();
				selection?.addRange(range);
				return;
			}
			remaining -= length;
			node = walker.nextNode();
		}
		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(root);
		range.collapse(false);
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	function normalizedText(element: HTMLElement): string {
		return editableText(element);
	}

	async function input(event?: Event): Promise<void> {
		if (composing || (event instanceof InputEvent && event.isComposing)) return;
		pendingSelection = undefined;
		const revision = ++inputRevision;
		const offset = caretOffset(editor);
		value = normalizedText(editor);
		await tick();
		if (revision !== inputRevision) return;
		restoreCaret(editor, Math.min(offset, value.length));
	}

	function trimHistory(stack: HistoryEntry[]): void {
		let characters = stack.reduce((total, entry) => total + entry.source.length, 0);
		while (stack.length > 1 && characters > maximumHistoryCharacters) {
			characters -= stack.shift()?.source.length ?? 0;
		}
	}

	function recordHistory(start: number, end: number, replacement: string, editKind: string): void {
		const now = performance.now();
		const coalescedTyping =
			editKind === 'insertText' &&
			replacement.length === 1 &&
			start === end &&
			start === lastEditCaret &&
			lastEditKind === editKind &&
			now - lastEditAt < 750;
		if (!coalescedTyping) {
			undoStack.push({ source: value, caret: start });
			trimHistory(undoStack);
		}
		redoStack.length = 0;
		lastEditKind = editKind;
		lastEditAt = now;
		lastEditCaret = start + replacement.length;
	}

	async function replaceSelection(replacement: string, editKind: string): Promise<void> {
		const { start, end } = pendingSelection ?? selectionOffsets(editor);
		recordHistory(start, end, replacement, editKind);
		const revision = ++inputRevision;
		value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
		const caret = start + replacement.length;
		pendingSelection = { start: caret, end: caret };
		await tick();
		if (revision !== inputRevision) return;
		restoreCaret(editor, caret);
		pendingSelection = undefined;
	}

	function previousCharacter(index: number): number {
		if (index <= 0) return 0;
		const finalUnit = value.charCodeAt(index - 1);
		if (index > 1 && finalUnit >= 0xdc00 && finalUnit <= 0xdfff) {
			const firstUnit = value.charCodeAt(index - 2);
			if (firstUnit >= 0xd800 && firstUnit <= 0xdbff) return index - 2;
		}
		return index - 1;
	}

	function nextCharacter(index: number): number {
		if (index >= value.length) return value.length;
		const firstUnit = value.charCodeAt(index);
		if (index + 1 < value.length && firstUnit >= 0xd800 && firstUnit <= 0xdbff) {
			const finalUnit = value.charCodeAt(index + 1);
			if (finalUnit >= 0xdc00 && finalUnit <= 0xdfff) return index + 2;
		}
		return index + 1;
	}

	function deletionRange(inputType: string, selection: EditorSelection): EditorSelection {
		if (selection.start !== selection.end) return selection;
		const { start } = selection;
		switch (inputType) {
			case 'deleteContentBackward':
				return { start: previousCharacter(start), end: start };
			case 'deleteContentForward':
				return { start, end: nextCharacter(start) };
			case 'deleteWordBackward': {
				const match = /\s*\S+\s*$/u.exec(value.slice(0, start));
				return { start: match ? start - match[0].length : 0, end: start };
			}
			case 'deleteWordForward': {
				const match = /^\s*\S+\s*/u.exec(value.slice(start));
				return { start, end: match ? start + match[0].length : value.length };
			}
			case 'deleteSoftLineBackward':
			case 'deleteHardLineBackward':
				return { start: value.lastIndexOf('\n', Math.max(0, start - 1)) + 1, end: start };
			case 'deleteSoftLineForward':
			case 'deleteHardLineForward': {
				const newline = value.indexOf('\n', start);
				return { start, end: newline === -1 ? value.length : newline };
			}
			case 'deleteEntireSoftLine': {
				const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
				const newline = value.indexOf('\n', start);
				return {
					start: lineStart,
					end: newline === -1 ? value.length : Math.min(value.length, newline + 1)
				};
			}
			default:
				return selection;
		}
	}

	async function deleteSelection(inputType: string): Promise<void> {
		const selection = pendingSelection ?? selectionOffsets(editor);
		const range = deletionRange(inputType, selection);
		if (range.start === range.end) return;
		pendingSelection = range;
		await replaceSelection('', inputType);
	}

	async function restoreHistory(source: HistoryEntry, destination: HistoryEntry[]): Promise<void> {
		const selection = pendingSelection ?? selectionOffsets(editor);
		destination.push({ source: value, caret: selection.start });
		trimHistory(destination);
		lastEditKind = '';
		lastEditCaret = -1;
		const revision = ++inputRevision;
		value = source.source;
		pendingSelection = { start: source.caret, end: source.caret };
		await tick();
		if (revision !== inputRevision) return;
		restoreCaret(editor, source.caret);
		pendingSelection = undefined;
	}

	function undo(): void {
		const previous = undoStack.pop();
		if (previous) void restoreHistory(previous, redoStack);
	}

	function redo(): void {
		const next = redoStack.pop();
		if (next) void restoreHistory(next, undoStack);
	}

	function keydown(event: KeyboardEvent): void {
		const command = event.metaKey || event.ctrlKey;
		if (command && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		} else if (command && event.key.toLowerCase() === 'y') {
			event.preventDefault();
			redo();
		} else if (event.key === 'Tab') {
			event.preventDefault();
			void replaceSelection('  ', 'insertTab');
		} else if (event.key === 'Enter') {
			event.preventDefault();
			void replaceSelection('\n', 'insertLineBreak');
		}
	}

	function beforeinput(event: InputEvent): void {
		if (event.isComposing || composing) return;
		switch (event.inputType) {
			case 'insertText':
			case 'insertReplacementText':
				event.preventDefault();
				void replaceSelection(event.data ?? '', 'insertText');
				break;
			case 'insertParagraph':
			case 'insertLineBreak':
				event.preventDefault();
				void replaceSelection('\n', 'insertLineBreak');
				break;
			case 'insertFromDrop':
				event.preventDefault();
				void replaceSelection(event.dataTransfer?.getData('text/plain') ?? '', 'insertFromDrop');
				break;
			case 'historyUndo':
				event.preventDefault();
				undo();
				break;
			case 'historyRedo':
				event.preventDefault();
				redo();
				break;
			default:
				if (event.inputType.startsWith('delete')) {
					event.preventDefault();
					void deleteSelection(event.inputType);
				}
		}
	}

	function paste(event: ClipboardEvent): void {
		event.preventDefault();
		void replaceSelection(event.clipboardData?.getData('text/plain') ?? '', 'insertFromPaste');
	}

	function cut(event: ClipboardEvent): void {
		const selection = pendingSelection ?? selectionOffsets(editor);
		if (selection.start === selection.end) return;
		event.preventDefault();
		event.clipboardData?.setData('text/plain', value.slice(selection.start, selection.end));
		pendingSelection = selection;
		void replaceSelection('', 'deleteByCut');
	}

	function pointermove(event: PointerEvent): void {
		if (!(event.target instanceof Element)) return;
		const lineElement = event.target.closest<HTMLElement>('[data-line]');
		if (!lineElement || !editor.contains(lineElement)) return;
		const line = Number(lineElement.dataset.line);
		if (!Number.isInteger(line) || line === hoveredLine) return;
		hoveredLine = line;
		onLineEnter?.(line);
	}

	function pointerleave(): void {
		hoveredLine = undefined;
		onLineLeave?.();
	}

	$effect(() => {
		if (!editor) return;
		for (const line of editor.querySelectorAll<HTMLElement>('[data-line]')) {
			line.classList.toggle('active', Number(line.dataset.line) === activeLine);
		}
		if (!activeLine) return;
		editor.querySelector<HTMLElement>(`[data-line="${activeLine}"]`)?.scrollIntoView({
			block: 'center',
			behavior: 'smooth'
		});
	});
</script>

<div class="editor-frame">
	<div class="editor-gutter" aria-hidden="true">
		{#each lineNumbers as lineNumber}
			<span class:active={activeLine === lineNumber}>{lineNumber}</span>
		{/each}
	</div>
	<div
		bind:this={editor}
		class="syntax-editor"
		contenteditable="true"
		role="textbox"
		tabindex="0"
		aria-label="Schemd source editor"
		aria-multiline="true"
		spellcheck="false"
		autocapitalize="off"
		oninput={input}
		oncompositionstart={() => (composing = true)}
		oncompositionend={() => {
			composing = false;
			void input();
		}}
		onbeforeinput={beforeinput}
		onkeydown={keydown}
		onpaste={paste}
		oncut={cut}
		onpointermove={pointermove}
		onpointerleave={pointerleave}
	>
		{@html highlightedSource}
	</div>
</div>
