/**
 * Ultra-lightweight, zero-dependency tokenizer for the `schemd` DSL.
 *
 * The classifier mirrors the compiler's actual lexical shapes — the
 * `COMPONENT_PATTERN` and `CONNECTION_PATTERN` regular expressions in
 * `@schemd/core`'s parser — without importing the compiler into the client
 * bundle. It is line-oriented and linear-time, so re-highlighting on every
 * keystroke stays well under a frame.
 */

/** One classified run of source text. */
export interface SchemdToken {
	/** Raw source slice, exactly as typed. */
	readonly text: string;
	/** CSS class name (without the `tok-` prefix) or `undefined` for plain text. */
	readonly cls: string | undefined;
}

/** A tokenized source line plus its structural classification. */
export interface SchemdTokenLine {
	readonly tokens: readonly SchemdToken[];
	readonly kind: 'component' | 'connection' | 'comment' | 'blank' | 'other';
}

/** Mirrors the parser's component-declaration head: `kind:ID "label"`. */
const COMPONENT_HEAD = /^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z][A-Za-z0-9_-]*)\s+"/;
/** Mirrors the parser's connection head: `ID.port -> ID.port`. */
const CONNECTION_HEAD =
	/^([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z][A-Za-z0-9_-]*)\s*->\s*([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z][A-Za-z0-9_-]*)/;

function pushToken(out: SchemdToken[], text: string, cls?: string): void {
	if (text.length > 0) out.push({ text, cls });
}

/** Tokenize a declaration tail: color expression and bracketed options. */
function tokenizeTail(tail: string, out: SchemdToken[]): void {
	let rest = tail;
	while (rest.length > 0) {
		const ws = rest.match(/^\s+/);
		if (ws) {
			pushToken(out, ws[0]);
			rest = rest.slice(ws[0].length);
			continue;
		}
		const bracket = rest.match(/^\[[^\]]*\]?/);
		if (bracket) {
			pushToken(out, '[', 'punct');
			const body = bracket[0].slice(1, bracket[0].endsWith(']') ? -1 : undefined);
			for (const piece of body.split(/(\s+|"[^"]*"?)/)) {
				if (piece === undefined || piece === '') continue;
				if (/^\s+$/.test(piece)) pushToken(out, piece);
				else if (piece.startsWith('"')) pushToken(out, piece, 'string');
				else pushToken(out, piece, 'option');
			}
			if (bracket[0].endsWith(']')) pushToken(out, ']', 'punct');
			rest = rest.slice(bracket[0].length);
			continue;
		}
		const color = rest.match(/^#?[A-Za-z0-9()%,./\s-]+?(?=\s*\[|$)/);
		if (color) {
			pushToken(out, color[0], 'color');
			rest = rest.slice(color[0].length);
			continue;
		}
		pushToken(out, rest[0]!, undefined);
		rest = rest.slice(1);
	}
}

/** Tokenize one line of `schemd` source. */
export function tokenizeLine(line: string): SchemdTokenLine {
	const trimmed = line.trim();
	if (trimmed === '') return { tokens: [{ text: line, cls: undefined }], kind: 'blank' };
	if (trimmed.startsWith('//')) {
		return { tokens: [{ text: line, cls: 'comment' }], kind: 'comment' };
	}

	const leading = line.slice(0, line.length - line.trimStart().length);
	const body = line.trimStart();
	const out: SchemdToken[] = [];
	pushToken(out, leading);

	const componentHead = body.match(COMPONENT_HEAD);
	if (componentHead) {
		pushToken(out, componentHead[1]!, 'kind');
		pushToken(out, ':', 'punct');
		pushToken(out, componentHead[2]!, 'id');
		let rest = body.slice(componentHead[1]!.length + 1 + componentHead[2]!.length);
		const label = rest.match(/^\s+("[^"]*"?)/);
		if (label) {
			pushToken(out, rest.slice(0, label[0].length - label[1]!.length));
			pushToken(out, label[1]!, 'string');
			rest = rest.slice(label[0].length);
		}
		const at = rest.match(/^\s+at\s+\((-?\d+(?:\.\d+)?),(\s*)(-?\d+(?:\.\d+)?)\)/);
		if (at) {
			const beforeAt = rest.match(/^\s+/)![0];
			pushToken(out, beforeAt);
			pushToken(out, 'at', 'keyword');
			rest = rest.slice(beforeAt.length + 2);
			const paren = rest.match(/^\s+\(/)![0];
			pushToken(out, paren.slice(0, -1));
			pushToken(out, '(', 'punct');
			pushToken(out, at[1]!, 'number');
			pushToken(out, ',', 'punct');
			pushToken(out, at[2]!);
			pushToken(out, at[3]!, 'number');
			pushToken(out, ')', 'punct');
			rest = rest.slice(
				paren.length - 1 + 1 + at[1]!.length + 1 + at[2]!.length + at[3]!.length + 1
			);
			tokenizeTail(rest, out);
		} else {
			pushToken(out, rest);
		}
		return { tokens: out, kind: 'component' };
	}

	const connectionHead = body.match(CONNECTION_HEAD);
	if (connectionHead) {
		pushToken(out, connectionHead[1]!, 'id');
		pushToken(out, '.', 'punct');
		pushToken(out, connectionHead[2]!, 'kind');
		const arrowStart = connectionHead[1]!.length + 1 + connectionHead[2]!.length;
		const afterArrow = body.slice(arrowStart);
		const arrow = afterArrow.match(/^(\s*)->(\s*)/)!;
		pushToken(out, arrow[1]!);
		pushToken(out, '->', 'arrow');
		pushToken(out, arrow[2]!);
		pushToken(out, connectionHead[3]!, 'id');
		pushToken(out, '.', 'punct');
		pushToken(out, connectionHead[4]!, 'kind');
		tokenizeTail(
			body.slice(
				arrowStart + arrow[0].length + connectionHead[3]!.length + 1 + connectionHead[4]!.length
			),
			out
		);
		return { tokens: out, kind: 'connection' };
	}

	pushToken(out, body);
	return { tokens: out, kind: 'other' };
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escapeHtml(value: string): string {
	return value.replace(/[&<>]/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Render one line as trusted highlight HTML (`span.tok-*` runs).
 * All source text is HTML-escaped; class names come from a fixed set.
 */
export function highlightLineHtml(line: string): string {
	return tokenizeLine(line)
		.tokens.map((token) =>
			token.cls === undefined
				? escapeHtml(token.text)
				: `<span class="tok-${token.cls}">${escapeHtml(token.text)}</span>`
		)
		.join('');
}

/** Render a whole source string as highlight HTML with `\n` separators. */
export function highlightSourceHtml(source: string): string {
	return source.split('\n').map(highlightLineHtml).join('\n');
}
