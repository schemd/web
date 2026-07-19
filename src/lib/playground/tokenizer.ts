export type TokenKind =
	| 'comment'
	| 'keyword'
	| 'identifier'
	| 'string'
	| 'number'
	| 'operator'
	| 'color'
	| 'attribute'
	| 'plain';

export interface SyntaxToken {
	readonly kind: TokenKind;
	readonly value: string;
}

const COMPONENTS = new Set([
	'resistor',
	'capacitor',
	'inductor',
	'diode',
	'transistor',
	'ground',
	'port',
	'and',
	'or',
	'not',
	'nand',
	'nor',
	'xor',
	'xnor',
	'buffer',
	'cnot',
	'qgate',
	'ic',
	'class',
	'actor',
	'state',
	'lifeline'
]);

const TOKEN_PATTERN =
	/(\/\/.*$|"(?:[^"\n]*)"|#[a-z][a-z0-9-]*|#[0-9a-fA-F]{3,8}\b|->|<-|<->|-->|==>|[()[\]{},:=]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_][\w.-]*|\s+|.)/gu;

function classify(value: string): TokenKind {
	if (value.startsWith('//')) return 'comment';
	if (value.startsWith('"')) return 'string';
	if (/^#[a-z0-9]/iu.test(value)) return 'color';
	if (/^-?\d/u.test(value)) return 'number';
	if (/^(?:->|<-|<->|-->|==>|[()[\]{},:=])$/u.test(value)) return 'operator';
	if (COMPONENTS.has(value)) return 'keyword';
	if (/^(?:at|label|bounds|title|width|height|pins|ortho|arrow|open-arrow)$/u.test(value)) {
		return 'attribute';
	}
	if (/^[A-Za-z_]/u.test(value)) return 'identifier';
	return 'plain';
}

export function tokenizeLine(line: string): readonly SyntaxToken[] {
	const tokens: SyntaxToken[] = [];
	for (const match of line.matchAll(TOKEN_PATTERN)) {
		const value = match[0];
		tokens.push({ kind: classify(value), value });
	}
	return tokens;
}

export function sourceLineForNode(source: string, nodeId: string): number | undefined {
	const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	const pattern = new RegExp(`^\\s*[a-z][\\w-]*:${escaped}(?:\\s|$)`, 'iu');
	const index = source.split('\n').findIndex((line) => pattern.test(line));
	return index < 0 ? undefined : index + 1;
}
