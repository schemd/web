<script lang="ts">
	/**
	 * Dependency-free Schemd editor.
	 *
	 * A native textarea remains the sole editing surface, so IME, selection,
	 * clipboard, spellcheck suppression, mobile keyboards, and browser
	 * undo/redo stay native. A non-interactive token layer mirrors its scroll
	 * position; source is rendered as Svelte text nodes, never injected HTML.
	 */
	import { onMount } from 'svelte';
	import { tokenizeLine, type SchemdTokenLine } from '$lib/tokenizer';
	import {
		deleteEmptyPair,
		findText,
		indentSelection,
		lineSelection,
		outdentSelection,
		pairedEdit,
		positionAtOffset,
		replaceMatches,
		toggleLineComments,
		type EditorEdit
	} from '$lib/editor-operations';
	import {
		completionAt,
		completionInsertion,
		type CompletionContext,
		type CompletionVocabulary
	} from '$lib/completion';

	export interface CodeEditorApi {
		readonly focus: () => void;
		readonly focusLine: (line: number) => void;
		readonly openFind: (withReplace?: boolean) => void;
		readonly toggleComment: () => void;
		readonly indent: () => void;
		readonly outdent: () => void;
	}

	interface Props {
		value?: string;
		vocabulary?: CompletionVocabulary | undefined;
		mappedLine?: number | undefined;
		errorLine?: number | undefined;
		oncaretline?: (line: number) => void;
		onpositionchange?: (position: { line: number; column: number }) => void;
		oncompile?: () => void;
		onready?: (api: CodeEditorApi | undefined) => void;
		ariaLabel?: string;
		maxLength?: number;
	}

	let {
		value = $bindable(''),
		vocabulary = undefined,
		mappedLine = undefined,
		errorLine = undefined,
		oncaretline,
		onpositionchange,
		oncompile,
		onready,
		ariaLabel = 'schemd source editor',
		maxLength
	}: Props = $props();

	let textarea = $state<HTMLTextAreaElement | undefined>();
	let findInput = $state<HTMLInputElement | undefined>();
	let scrollTop = $state(0);
	let scrollLeft = $state(0);
	let caretLine = $state(0);
	let caretColumn = $state(0);
	let viewportHeight = $state(0);
	let measuredLineHeight = $state(27);
	let measuredCharacterWidth = $state(8.45);
	let tabRelease = false;
	let composing = false;

	const HIGHLIGHT_CHARACTER_BUDGET = 100_000;
	const HIGHLIGHT_LINE_BUDGET = 4_000;
	let tokenCache: Record<string, SchemdTokenLine | undefined> = Object.create(null);

	/**
	 * Reuse every unchanged line's token object and discard obsolete entries.
	 *
	 * A full 128 KiB document otherwise pays the tokenizer cost on every
	 * keystroke. The cache is bounded by the current document—not editing
	 * history—so prolonged sessions cannot leak one entry per intermediate
	 * line.
	 */
	function tokenizeSource(lines: readonly string[]): readonly SchemdTokenLine[] {
		const nextCache: Record<string, SchemdTokenLine | undefined> = Object.create(null);
		const tokenized = lines.map((line) => {
			const cached = nextCache[line] ?? tokenCache[line];
			const result = cached ?? tokenizeLine(line);
			nextCache[line] = result;
			return result;
		});
		tokenCache = nextCache;
		return tokenized;
	}

	const sourceLines = $derived(value.split('\n'));
	const lineCount = $derived(sourceLines.length);
	const highlightingEnabled = $derived(
		value.length <= HIGHLIGHT_CHARACTER_BUDGET && lineCount <= HIGHLIGHT_LINE_BUDGET
	);
	const tokenLines = $derived(highlightingEnabled ? tokenizeSource(sourceLines) : []);
	const firstGutterLine = $derived(
		Math.max(0, Math.min(lineCount - 1, Math.floor(scrollTop / measuredLineHeight) - 2))
	);
	const visibleGutterLines = $derived(
		Array.from(
			{
				length: Math.max(
					0,
					Math.min(lineCount - firstGutterLine, Math.ceil(viewportHeight / measuredLineHeight) + 5)
				)
			},
			(_, index) => firstGutterLine + index
		)
	);

	/* ---------- Editing primitives ---------- */

	function selection(): { start: number; end: number } {
		return {
			start: textarea?.selectionStart ?? 0,
			end: textarea?.selectionEnd ?? 0
		};
	}

	/**
	 * Apply a pure full-document edit through setRangeText. Computing the
	 * smallest changed range prevents a comment toggle from replacing the
	 * entire document and keeps the textarea's native undo transaction useful.
	 */
	function applyEdit(edit: EditorEdit): void {
		const text =
			maxLength === undefined ? edit.text : edit.text.slice(0, Math.max(0, Math.trunc(maxLength)));
		const normalized: EditorEdit = {
			text,
			start: Math.max(0, Math.min(text.length, edit.start)),
			end: Math.max(0, Math.min(text.length, edit.end))
		};
		const field = textarea;
		if (!field) {
			value = normalized.text;
			return;
		}
		const before = value;
		let prefix = 0;
		while (
			prefix < before.length &&
			prefix < normalized.text.length &&
			before[prefix] === normalized.text[prefix]
		) {
			prefix += 1;
		}
		let suffix = 0;
		while (
			suffix < before.length - prefix &&
			suffix < normalized.text.length - prefix &&
			before[before.length - suffix - 1] === normalized.text[normalized.text.length - suffix - 1]
		) {
			suffix += 1;
		}
		field.setRangeText(
			normalized.text.slice(prefix, normalized.text.length - suffix),
			prefix,
			before.length - suffix,
			'preserve'
		);
		value = field.value;
		field.setSelectionRange(normalized.start, normalized.end);
		updatePosition();
		refreshCompletion();
	}

	function replaceRange(start: number, end: number, replacement: string, select = false): void {
		const next = value.slice(0, start) + replacement + value.slice(end);
		const after = start + replacement.length;
		applyEdit({ text: next, start, end: select ? after : start });
		if (!select) textarea?.setSelectionRange(after, after);
		updatePosition();
	}

	function updatePosition(): void {
		const at = textarea?.selectionStart ?? 0;
		const position = positionAtOffset(value, at);
		caretLine = position.line;
		caretColumn = position.column;
		oncaretline?.(position.line);
		onpositionchange?.(position);
	}

	function runLineEdit(kind: 'indent' | 'outdent' | 'comment'): void {
		const current = selection();
		const edit =
			kind === 'indent'
				? indentSelection(value, current)
				: kind === 'outdent'
					? outdentSelection(value, current)
					: toggleLineComments(value, current);
		applyEdit(edit);
	}

	/* ---------- Completion ---------- */

	let completion = $state<CompletionContext | undefined>();
	let activeItem = $state(0);
	const activeId = $derived(completion ? `editor-completion-${activeItem}` : undefined);
	const caretVisualPosition = $derived(positionAtOffset(value, textarea?.selectionStart ?? 0));
	const completionTop = $derived(
		(caretVisualPosition.line + 1) * measuredLineHeight - scrollTop + 12
	);
	const completionLeft = $derived(
		caretVisualPosition.column * measuredCharacterWidth - scrollLeft + 14
	);

	function dismissCompletion(): void {
		completion = undefined;
		activeItem = 0;
	}

	function refreshCompletion(): void {
		if (composing || !vocabulary || !textarea) return;
		completion = completionAt(value, textarea.selectionStart, vocabulary);
		activeItem = 0;
	}

	$effect(() => {
		const id = activeId;
		if (!id) return;
		queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }));
	});

	function acceptCompletion(index = activeItem): void {
		const context = completion;
		const item = context?.items[index];
		if (!context || item === undefined) return;
		dismissCompletion();
		replaceRange(context.from, context.to, completionInsertion(item, context.kind));
	}

	/* ---------- Find and replace ---------- */

	let findOpen = $state(false);
	let replaceOpen = $state(false);
	let findQuery = $state('');
	let replacement = $state('');
	let caseSensitive = $state(false);
	let wholeWord = $state(false);
	let activeMatch = $state(0);
	const matches = $derived(findText(value, findQuery, { caseSensitive, wholeWord }));
	const matchReadout = $derived(
		matches.length === 0
			? 'No matches'
			: `${Math.min(activeMatch + 1, matches.length)} of ${matches.length}`
	);

	$effect(() => {
		void findQuery;
		void caseSensitive;
		void wholeWord;
		activeMatch = 0;
	});

	function openFind(withReplace = false): void {
		const field = textarea;
		const selected = field?.value.slice(field.selectionStart, field.selectionEnd) ?? '';
		if (selected !== '' && !selected.includes('\n')) findQuery = selected;
		findOpen = true;
		replaceOpen ||= withReplace;
		queueMicrotask(() => {
			findInput?.focus();
			findInput?.select();
		});
	}

	function closeFind(): void {
		findOpen = false;
		replaceOpen = false;
		textarea?.focus();
	}

	function selectMatch(index: number, focusEditor = false): void {
		if (matches.length === 0) return;
		activeMatch = (index + matches.length) % matches.length;
		const match = matches[activeMatch]!;
		textarea?.setSelectionRange(match.start, match.end);
		revealOffset(match.start);
		if (focusEditor) textarea?.focus();
		updatePosition();
	}

	function replaceCurrent(): void {
		const match = matches[activeMatch];
		if (!match) return;
		replaceRange(match.start, match.end, replacement, true);
		queueMicrotask(() => selectMatch(Math.min(activeMatch, matches.length - 1)));
	}

	function replaceAll(): void {
		if (matches.length === 0) return;
		const text = replaceMatches(value, matches, replacement);
		const end = text.length;
		applyEdit({ text, start: end, end });
	}

	/* ---------- Keyboard contract ---------- */

	function onKeydown(event: KeyboardEvent): void {
		if (composing || event.isComposing) return;
		const modifier = event.metaKey || event.ctrlKey;
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
				tabRelease = true;
				return;
			}
		}
		if (modifier && event.key.toLowerCase() === 'f') {
			event.preventDefault();
			openFind(false);
			return;
		}
		if (modifier && event.key.toLowerCase() === 'h') {
			event.preventDefault();
			openFind(true);
			return;
		}
		if (modifier && event.key === '/') {
			event.preventDefault();
			runLineEdit('comment');
			return;
		}
		if (modifier && event.key === 'Enter') {
			event.preventDefault();
			oncompile?.();
			return;
		}
		if (event.key === 'Escape') {
			tabRelease = true;
			dismissCompletion();
			return;
		}
		if (event.key === 'Tab') {
			if (tabRelease) {
				tabRelease = false;
				return;
			}
			event.preventDefault();
			runLineEdit(event.shiftKey ? 'outdent' : 'indent');
			return;
		}
		if (event.key === 'Backspace') {
			const edit = deleteEmptyPair(value, selection());
			if (edit) {
				event.preventDefault();
				applyEdit(edit);
			}
			return;
		}
		const edit =
			!modifier && !event.altKey && event.key.length === 1
				? pairedEdit(value, selection(), event.key)
				: undefined;
		if (edit) {
			event.preventDefault();
			applyEdit(edit);
			return;
		}
		if (event.key === 'Enter' && textarea) {
			const current = selection();
			if (current.start !== current.end) return;
			const lineStart = current.start === 0 ? 0 : value.lastIndexOf('\n', current.start - 1) + 1;
			const indent = value.slice(lineStart, current.start).match(/^\s*/)?.[0] ?? '';
			if (indent !== '') {
				event.preventDefault();
				replaceRange(current.start, current.end, `\n${indent}`);
			}
		}
	}

	function focusLine(line: number): void {
		const field = textarea;
		if (!field) return;
		const target = lineSelection(value, line);
		field.focus();
		field.setSelectionRange(target.start, target.end);
		field.scrollTop = Math.max(0, line * measuredLineHeight - field.clientHeight / 3);
		scrollTop = field.scrollTop;
		updatePosition();
	}

	function revealOffset(offset: number): void {
		const field = textarea;
		if (!field) return;
		const position = positionAtOffset(value, offset);
		const top = position.line * measuredLineHeight;
		const bottom = top + measuredLineHeight;
		if (top < field.scrollTop) field.scrollTop = top;
		else if (bottom > field.scrollTop + field.clientHeight) {
			field.scrollTop = Math.max(0, bottom - field.clientHeight);
		}
		const left = position.column * measuredCharacterWidth;
		if (left < field.scrollLeft) field.scrollLeft = left;
		else if (left > field.scrollLeft + field.clientWidth - measuredCharacterWidth * 2) {
			field.scrollLeft = Math.max(0, left - field.clientWidth / 2);
		}
		scrollTop = field.scrollTop;
		scrollLeft = field.scrollLeft;
	}

	/* `maxlength` constrains native typing but not every scripted assignment. */
	$effect(() => {
		const limit = maxLength;
		if (limit === undefined || value.length <= limit) return;
		value = value.slice(0, Math.max(0, Math.trunc(limit)));
	});

	onMount(() => {
		onready?.({
			focus: () => textarea?.focus(),
			focusLine,
			openFind,
			toggleComment: () => runLineEdit('comment'),
			indent: () => runLineEdit('indent'),
			outdent: () => runLineEdit('outdent')
		});
		const measure = (): void => {
			if (!textarea) return;
			viewportHeight = textarea.clientHeight;
			const style = getComputedStyle(textarea);
			const lineHeight = Number.parseFloat(style.lineHeight);
			if (Number.isFinite(lineHeight) && lineHeight > 0) measuredLineHeight = lineHeight;
			const canvas = document.createElement('canvas');
			const context = canvas.getContext('2d');
			if (context) {
				context.font = style.font;
				const characterWidth = context.measureText('0').width;
				if (Number.isFinite(characterWidth) && characterWidth > 0) {
					measuredCharacterWidth = characterWidth;
				}
			}
		};
		measure();
		const observer =
			typeof ResizeObserver === 'undefined' || !textarea ? undefined : new ResizeObserver(measure);
		if (textarea) observer?.observe(textarea);
		updatePosition();
		return () => {
			observer?.disconnect();
			onready?.(undefined);
		};
	});
</script>

<div class="editor" data-error={errorLine !== undefined}>
	<p id="editor-instructions" class="sr-only">
		Code editor. Tab indents; Shift+Tab outdents. Press Escape then Tab to move focus out of the
		editor. Control or Command slash toggles comments. Control or Command F opens find.
	</p>

	{#if findOpen}
		<div class="findbar" role="search" aria-label="Find and replace">
			<div class="find-row">
				<label>
					<span class="sr-only">Find</span>
					<input
						bind:this={findInput}
						bind:value={findQuery}
						type="text"
						placeholder="Find"
						autocomplete="off"
						spellcheck="false"
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								selectMatch(activeMatch + (event.shiftKey ? -1 : 1));
							} else if (event.key === 'Escape') {
								event.preventDefault();
								closeFind();
							}
						}}
					/>
				</label>
				<output aria-live="polite">{matchReadout}</output>
				<button
					type="button"
					onclick={() => selectMatch(activeMatch - 1)}
					aria-label="Previous match">↑</button
				>
				<button type="button" onclick={() => selectMatch(activeMatch + 1)} aria-label="Next match"
					>↓</button
				>
				<button
					type="button"
					class:active={caseSensitive}
					aria-pressed={caseSensitive}
					onclick={() => (caseSensitive = !caseSensitive)}
					title="Match case">Aa</button
				>
				<button
					type="button"
					class:active={wholeWord}
					aria-pressed={wholeWord}
					onclick={() => (wholeWord = !wholeWord)}
					title="Match whole word">W</button
				>
				<button
					type="button"
					aria-expanded={replaceOpen}
					onclick={() => (replaceOpen = !replaceOpen)}
					aria-label="Toggle replace">⌄</button
				>
				<button type="button" onclick={closeFind} aria-label="Close find">×</button>
			</div>
			{#if replaceOpen}
				<div class="find-row replace-row">
					<label>
						<span class="sr-only">Replace</span>
						<input
							bind:value={replacement}
							type="text"
							placeholder="Replace"
							autocomplete="off"
							spellcheck="false"
							onkeydown={(event) => {
								if (event.key === 'Escape') closeFind();
							}}
						/>
					</label>
					<button type="button" onclick={replaceCurrent} disabled={matches.length === 0}
						>Replace</button
					>
					<button type="button" onclick={replaceAll} disabled={matches.length === 0}>All</button>
				</div>
			{/if}
		</div>
	{/if}

	<div class="gutter" aria-hidden="true">
		<div
			class="gutter-scroll"
			style={`transform: translateY(${firstGutterLine * measuredLineHeight - scrollTop}px)`}
		>
			{#each visibleGutterLines as index (index)}
				<span
					class="gutter-line"
					class:caret={index === caretLine}
					class:mapped={index === mappedLine}
					class:error={index === errorLine}>{index + 1}</span
				>
			{/each}
		</div>
	</div>

	<div class="source-stack">
		<pre
			class="highlight"
			aria-hidden="true"
			style={`transform: translate(${-scrollLeft}px, ${-scrollTop}px)`}>{#if highlightingEnabled}{#each tokenLines as line, lineIndex (lineIndex)}<span
						class="code-line"
						>{#each line.tokens as token, tokenIndex (tokenIndex)}<span
								class={token.cls ? `tok-${token.cls}` : undefined}>{token.text}</span
							>{/each}</span
					>{lineIndex < tokenLines.length - 1 ? '\n' : ''}{/each}{:else}{value}{/if}</pre>
		<textarea
			bind:this={textarea}
			bind:value
			aria-label={ariaLabel}
			aria-describedby="editor-instructions"
			aria-invalid={errorLine !== undefined}
			aria-errormessage={errorLine !== undefined ? 'compiler-diagnostic' : undefined}
			aria-autocomplete="list"
			aria-controls={completion ? 'editor-completion-list' : undefined}
			aria-activedescendant={activeId}
			spellcheck="false"
			autocapitalize="off"
			autocomplete="off"
			wrap="off"
			maxlength={maxLength}
			oninput={() => {
				updatePosition();
				if (!composing) refreshCompletion();
			}}
			oncompositionstart={() => {
				composing = true;
				dismissCompletion();
			}}
			oncompositionend={() => {
				composing = false;
				updatePosition();
				refreshCompletion();
			}}
			onkeydown={onKeydown}
			onkeyup={updatePosition}
			onclick={() => {
				updatePosition();
				refreshCompletion();
			}}
			onselect={updatePosition}
			onblur={dismissCompletion}
			onscroll={(event) => {
				scrollTop = event.currentTarget.scrollTop;
				scrollLeft = event.currentTarget.scrollLeft;
			}}></textarea>
	</div>

	{#if completion}
		<ul
			id="editor-completion-list"
			class="completions"
			role="listbox"
			aria-label="Source completions"
			style={`--top: ${completionTop}px; --left: ${completionLeft}px`}
		>
			{#each completion.items as item, index (item)}
				<li
					id={`editor-completion-${index}`}
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
						}}>{item}</button
					>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="position" aria-hidden="true">
		Ln {caretLine + 1}, Col {caretColumn + 1}{highlightingEnabled ? '' : ' · plain large-file mode'}
	</div>
	{#if !highlightingEnabled}
		<p class="sr-only" role="status">
			Syntax highlighting paused for this large source. Editing and compilation remain available.
		</p>
	{/if}
</div>

<style>
	.editor {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		block-size: 100%;
		min-block-size: 0;
		overflow: hidden;
		background: var(--bg-inset);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.7;
		--editor-pad-block: var(--space-3);
		--editor-pad-inline: var(--space-3);
	}

	.sr-only {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.gutter {
		grid-column: 1;
		grid-row: 1;
		z-index: 2;
		overflow: hidden;
		min-inline-size: 3.4rem;
		padding-block: var(--editor-pad-block);
		text-align: end;
		color: var(--ink-faint);
		background: var(--bg-raised);
		border-inline-end: 1px solid var(--line);
		user-select: none;
		font-variant-numeric: tabular-nums;
	}

	.gutter-scroll {
		display: flex;
		flex-direction: column;
		will-change: transform;
	}

	.gutter-line {
		block-size: 1.7em;
		padding-inline: var(--space-2);

		&.caret {
			color: var(--accent);
			background: color-mix(in srgb, var(--accent) 7%, transparent);
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

	.source-stack {
		position: relative;
		grid-column: 2;
		grid-row: 1;
		min-inline-size: 0;
		min-block-size: 0;
		overflow: hidden;
	}

	.highlight,
	textarea {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		inline-size: 100%;
		block-size: 100%;
		margin: 0;
		padding: var(--editor-pad-block) var(--editor-pad-inline);
		border: 0;
		border-radius: 0;
		font: inherit;
		line-height: inherit;
		letter-spacing: inherit;
		tab-size: 2;
		white-space: pre;
	}

	.highlight {
		inset: auto;
		min-inline-size: 100%;
		min-block-size: 100%;
		pointer-events: none;
		color: var(--ink);
		background: transparent;
		overflow: visible;
		will-change: transform;
	}

	textarea {
		z-index: 1;
		resize: none;
		overflow: auto;
		outline: none;
		background: transparent;
		color: transparent;
		-webkit-text-fill-color: transparent;
		caret-color: var(--accent);
		scrollbar-color: var(--line-strong) transparent;

		&::selection {
			background: color-mix(in srgb, var(--accent) 30%, transparent);
			color: var(--ink);
			-webkit-text-fill-color: var(--ink);
		}

		&:focus-visible {
			box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		}
	}

	.findbar {
		position: absolute;
		inset-block-start: var(--space-2);
		inset-inline-end: var(--space-3);
		z-index: 30;
		display: grid;
		gap: 2px;
		inline-size: min(34rem, calc(100% - 5rem));
		padding: var(--space-1);
		background: var(--bg-raised);
		border: 1px solid var(--line-strong);
		box-shadow: 0 10px 28px rgb(0 0 0 / 24%);
	}

	.find-row {
		display: grid;
		grid-template-columns: minmax(7rem, 1fr) auto repeat(6, auto);
		align-items: center;
		gap: 2px;

		& label {
			min-inline-size: 0;
		}

		& input {
			inline-size: 100%;
			box-sizing: border-box;
			padding: 0.32rem 0.5rem;
			border: 1px solid var(--line);
			background: var(--bg-inset);
			color: var(--ink);
			font: inherit;
		}

		& output {
			padding-inline: var(--space-1);
			color: var(--ink-faint);
			font-size: var(--text-2xs);
			white-space: nowrap;
		}

		& button {
			min-inline-size: 1.8rem;
			padding: 0.26rem 0.4rem;
			color: var(--ink-mute);
			border: 1px solid transparent;
			font: inherit;

			&:hover,
			&.active {
				color: var(--accent);
				border-color: var(--line);
			}
		}
	}

	.replace-row {
		grid-template-columns: minmax(7rem, 1fr) auto auto;
	}

	.completions {
		position: absolute;
		inset-block-start: clamp(0.5rem, var(--top), calc(100% - 13.5rem));
		inset-inline-start: clamp(3.8rem, var(--left), calc(100% - 11rem));
		z-index: 25;
		min-inline-size: 10rem;
		max-block-size: 13rem;
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1);
		list-style: none;
		background: var(--bg-raised);
		border: 1px solid var(--line-strong);
		box-shadow: 0 8px 24px rgb(0 0 0 / 25%);

		& li.active {
			background: color-mix(in srgb, var(--accent) 18%, transparent);
		}

		& button {
			inline-size: 100%;
			padding: var(--space-1) var(--space-2);
			color: inherit;
			font: inherit;
			text-align: start;
		}

		& li.active button {
			color: var(--accent);
		}
	}

	.position {
		position: absolute;
		inset-inline-end: var(--space-3);
		inset-block-end: var(--space-2);
		z-index: 3;
		padding: 1px var(--space-2);
		color: var(--ink-faint);
		background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
		border: 1px solid var(--line);
		font-size: var(--text-2xs);
		pointer-events: none;
	}

	@media (max-width: 560px) {
		.editor {
			font-size: var(--text-xs);
		}

		.gutter {
			min-inline-size: 2.7rem;
		}

		.findbar {
			inset-inline: var(--space-1);
			inline-size: auto;
		}

		.find-row {
			grid-template-columns: minmax(5rem, 1fr) repeat(4, auto);

			& output,
			& button:nth-of-type(4),
			& button:nth-of-type(5) {
				display: none;
			}
		}

		.replace-row {
			grid-template-columns: minmax(5rem, 1fr) auto auto;
		}
	}
</style>
