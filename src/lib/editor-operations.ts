/**
 * Pure text operations for the dependency-free playground editor.
 *
 * Keeping selection arithmetic out of the Svelte component makes every edit
 * deterministic and testable. Offsets are UTF-16 offsets, matching
 * HTMLTextAreaElement.selectionStart/selectionEnd and the compiler's source
 * diagnostics.
 */

export interface EditorSelection {
	readonly start: number;
	readonly end: number;
}

export interface EditorEdit extends EditorSelection {
	readonly text: string;
}

export interface FindOptions {
	readonly caseSensitive?: boolean;
	readonly wholeWord?: boolean;
}

export interface TextMatch {
	readonly start: number;
	readonly end: number;
}

const INDENT = '  ';
const WORD_CHARACTER = /[A-Za-z0-9_]/;

function clampSelection(text: string, selection: EditorSelection): EditorSelection {
	const start = Math.max(0, Math.min(text.length, Math.trunc(selection.start)));
	const end = Math.max(start, Math.min(text.length, Math.trunc(selection.end)));
	return { start, end };
}

/**
 * Range containing every selected line.
 *
 * A selection ending exactly at the start of a line does not include that
 * line; this matches established editor indentation behaviour.
 */
export function selectedLineRange(text: string, selection: EditorSelection): EditorSelection {
	const safe = clampSelection(text, selection);
	const start = safe.start === 0 ? 0 : text.lastIndexOf('\n', safe.start - 1) + 1;
	const inclusiveEnd =
		safe.end > safe.start && safe.end > 0 && text[safe.end - 1] === '\n' ? safe.end - 1 : safe.end;
	const newline = text.indexOf('\n', inclusiveEnd);
	return { start, end: newline < 0 ? text.length : newline };
}

/** Add one two-space indentation level to all selected lines. */
export function indentSelection(text: string, selection: EditorSelection): EditorEdit {
	const safe = clampSelection(text, selection);
	const range = selectedLineRange(text, safe);
	const original = text.slice(range.start, range.end);
	const lines = original.split('\n');
	const replacement = lines.map((line) => INDENT + line).join('\n');
	const selectedLinesBeforeStart = text.slice(range.start, safe.start).split('\n').length;
	const selectedLinesBeforeEnd = text.slice(range.start, safe.end).split('\n').length;
	return {
		text: text.slice(0, range.start) + replacement + text.slice(range.end),
		start: safe.start + selectedLinesBeforeStart * INDENT.length,
		end: safe.end + selectedLinesBeforeEnd * INDENT.length
	};
}

/** Remove one tab or up to two leading spaces from all selected lines. */
export function outdentSelection(text: string, selection: EditorSelection): EditorEdit {
	const safe = clampSelection(text, selection);
	const range = selectedLineRange(text, safe);
	const original = text.slice(range.start, range.end);
	const removals = original
		.split('\n')
		.map((line) =>
			line.startsWith('\t') ? 1 : Math.min(INDENT.length, line.match(/^ */)?.[0].length ?? 0)
		);
	const replacement = original
		.split('\n')
		.map((line, index) => line.slice(removals[index] ?? 0))
		.join('\n');

	function removedBefore(offset: number): number {
		const relative = Math.max(0, Math.min(original.length, offset - range.start));
		let consumed = 0;
		let removed = 0;
		for (const [index, line] of original.split('\n').entries()) {
			const lineStart = consumed;
			const amount = removals[index] ?? 0;
			if (relative <= lineStart) break;
			removed += Math.min(amount, relative - lineStart);
			consumed += line.length + 1;
		}
		return removed;
	}

	return {
		text: text.slice(0, range.start) + replacement + text.slice(range.end),
		start: safe.start - removedBefore(safe.start),
		end: safe.end - removedBefore(safe.end)
	};
}

/**
 * Comment or uncomment the selected lines.
 *
 * Comments are placed after indentation. Blank lines are left alone, and a
 * mixed selection is commented rather than half-toggled.
 */
export function toggleLineComments(text: string, selection: EditorSelection): EditorEdit {
	const safe = clampSelection(text, selection);
	const range = selectedLineRange(text, safe);
	const lines = text.slice(range.start, range.end).split('\n');
	const nonBlank = lines.filter((line) => line.trim() !== '');
	const uncomment = nonBlank.length > 0 && nonBlank.every((line) => /^\s*\/\/ ?/.test(line));
	const transformed = lines.map((line) => {
		if (line.trim() === '') return line;
		if (uncomment) return line.replace(/^(\s*)\/\/ ?/, '$1');
		return line.replace(/^(\s*)/, '$1// ');
	});
	const replacement = transformed.join('\n');

	/* Map offsets through each line's prefix-only edit. */
	function mapOffset(offset: number): number {
		const relative = Math.max(0, Math.min(range.end - range.start, offset - range.start));
		let oldCursor = 0;
		let newCursor = 0;
		for (let index = 0; index < lines.length; index += 1) {
			const before = lines[index] ?? '';
			const after = transformed[index] ?? '';
			if (relative <= oldCursor + before.length) {
				const within = relative - oldCursor;
				const indent = before.match(/^\s*/)?.[0].length ?? 0;
				const delta = after.length - before.length;
				return range.start + newCursor + Math.max(0, within + (within >= indent ? delta : 0));
			}
			oldCursor += before.length + 1;
			newCursor += after.length + 1;
		}
		return range.start + replacement.length;
	}

	return {
		text: text.slice(0, range.start) + replacement + text.slice(range.end),
		start: mapOffset(safe.start),
		end: mapOffset(safe.end)
	};
}

const OPEN_PAIRS: Readonly<Record<string, string>> = {
	'(': ')',
	'[': ']',
	'"': '"'
};

/**
 * Return an automatic pair edit when insertion is safe.
 *
 * Quotes are conservative because labels are the only quoted grammar slot:
 * do not pair after a backslash or before a word character. Closing delimiters
 * at the caret are skipped instead of duplicated.
 */
export function pairedEdit(
	text: string,
	selection: EditorSelection,
	key: string
): EditorEdit | undefined {
	const safe = clampSelection(text, selection);
	if (safe.start === safe.end && Object.values(OPEN_PAIRS).includes(key)) {
		if (text[safe.start] === key) {
			return { text, start: safe.start + 1, end: safe.start + 1 };
		}
		return undefined;
	}
	const close = OPEN_PAIRS[key];
	if (!close) return undefined;
	const selected = text.slice(safe.start, safe.end);
	const next = text[safe.end] ?? '';
	const previous = text[safe.start - 1] ?? '';
	if (key === '"' && (previous === '\\' || (selected === '' && WORD_CHARACTER.test(next)))) {
		return undefined;
	}
	if (selected === '' && next !== '' && !/[\s,.;:\])]/.test(next)) return undefined;
	return {
		text: text.slice(0, safe.start) + key + selected + close + text.slice(safe.end),
		start: safe.start + 1,
		end: safe.end + 1
	};
}

/** Delete both delimiters when Backspace is pressed between an empty pair. */
export function deleteEmptyPair(text: string, selection: EditorSelection): EditorEdit | undefined {
	const safe = clampSelection(text, selection);
	if (safe.start !== safe.end || safe.start === 0) return undefined;
	const open = text[safe.start - 1];
	const close = text[safe.start];
	if (!open || OPEN_PAIRS[open] !== close) return undefined;
	return {
		text: text.slice(0, safe.start - 1) + text.slice(safe.start + 1),
		start: safe.start - 1,
		end: safe.start - 1
	};
}

/** Literal, linear-time search; regular expressions are deliberately unsupported. */
export function findText(
	text: string,
	query: string,
	options: FindOptions = {}
): readonly TextMatch[] {
	if (query === '') return [];
	const folded = options.caseSensitive ? undefined : foldWithOffsets(text);
	const haystack = folded?.text ?? text;
	const needle = options.caseSensitive ? query : foldWithOffsets(query).text;
	const matches: TextMatch[] = [];
	let from = 0;
	while (from <= haystack.length - needle.length) {
		const foldedStart = haystack.indexOf(needle, from);
		if (foldedStart < 0) break;
		const foldedEnd = foldedStart + needle.length;
		const start = folded ? folded.starts[foldedStart]! : foldedStart;
		const end = folded ? folded.ends[foldedEnd - 1]! : foldedEnd;
		const left = text[start - 1];
		const right = text[end];
		const whole =
			!options.wholeWord || (!WORD_CHARACTER.test(left ?? '') && !WORD_CHARACTER.test(right ?? ''));
		const previous = matches[matches.length - 1];
		if (whole && (!previous || start >= previous.end)) matches.push({ start, end });
		from = Math.max(foldedEnd, foldedStart + 1);
	}
	return matches;
}

interface FoldedText {
	readonly text: string;
	/** Original UTF-16 start offset for each folded UTF-16 code unit. */
	readonly starts: readonly number[];
	/** Original UTF-16 end offset for each folded UTF-16 code unit. */
	readonly ends: readonly number[];
}

/**
 * Case-fold Unicode while retaining exact textarea offsets.
 *
 * Lowercasing can expand one character (`İ` → `i` + combining dot). Searching
 * one globally-lowercased string and returning its indices therefore points at
 * the wrong source after the first expansion. This map translates each folded
 * code unit back to the full original code point.
 */
function foldWithOffsets(value: string): FoldedText {
	let text = '';
	const starts: number[] = [];
	const ends: number[] = [];
	let offset = 0;
	for (const character of value) {
		const folded = character.toLocaleLowerCase();
		text += folded;
		for (let index = 0; index < folded.length; index += 1) {
			starts.push(offset);
			ends.push(offset + character.length);
		}
		offset += character.length;
	}
	return { text, starts, ends };
}

/** Replace every precomputed, non-overlapping literal match. */
export function replaceMatches(
	text: string,
	matches: readonly TextMatch[],
	replacement: string
): string {
	let cursor = 0;
	let output = '';
	for (const match of matches) {
		if (match.start < cursor || match.end < match.start || match.end > text.length) continue;
		output += text.slice(cursor, match.start) + replacement;
		cursor = match.end;
	}
	return output + text.slice(cursor);
}

/** Select the requested zero-based line and clamp out-of-range diagnostics. */
export function lineSelection(text: string, line: number): EditorSelection {
	const target = Math.max(0, Math.trunc(line));
	let start = 0;
	for (let current = 0; current < target; current += 1) {
		const newline = text.indexOf('\n', start);
		if (newline < 0) return { start: text.length, end: text.length };
		start = newline + 1;
	}
	const newline = text.indexOf('\n', start);
	return { start, end: newline < 0 ? text.length : newline };
}

/** Zero-based line and column for a textarea offset. */
export function positionAtOffset(
	text: string,
	offset: number
): { readonly line: number; readonly column: number } {
	const at = Math.max(0, Math.min(text.length, Math.trunc(offset)));
	const lineStart = at === 0 ? 0 : text.lastIndexOf('\n', at - 1) + 1;
	return {
		line: text.slice(0, lineStart).split('\n').length - 1,
		column: at - lineStart
	};
}
