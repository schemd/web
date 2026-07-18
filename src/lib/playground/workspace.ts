export type WorkspaceTokenKind =
	'plain' | 'kind' | 'identifier' | 'string' | 'number' | 'operator' | 'attribute' | 'comment';

export interface WorkspaceToken {
	readonly kind: WorkspaceTokenKind;
	readonly value: string;
}

export interface WorkspaceLine {
	readonly number: number;
	readonly tokens: readonly WorkspaceToken[];
}

function isDigit(character: string): boolean {
	return character >= '0' && character <= '9';
}

function isWord(character: string): boolean {
	return (
		(character >= 'a' && character <= 'z') ||
		(character >= 'A' && character <= 'Z') ||
		isDigit(character) ||
		character === '_' ||
		character === '-'
	);
}

export function tokenizeWorkspaceLine(line: string): readonly WorkspaceToken[] {
	if (line.trimStart().startsWith('//') || line.trimStart().startsWith('# '))
		return [{ kind: 'comment', value: line }];
	const tokens: WorkspaceToken[] = [];
	let index = 0;
	let beforeColon = true;
	while (index < line.length) {
		const character = line[index];
		if (character === '"') {
			let end = index + 1;
			while (end < line.length) {
				if (line[end] === '"' && line[end - 1] !== '\\') {
					end += 1;
					break;
				}
				end += 1;
			}
			tokens.push({ kind: 'string', value: line.slice(index, end) });
			index = end;
			continue;
		}
		if (line.slice(index, index + 2) === '->') {
			tokens.push({ kind: 'operator', value: '->' });
			index += 2;
			beforeColon = false;
			continue;
		}
		if (isDigit(character)) {
			let end = index + 1;
			while (end < line.length && (isDigit(line[end]) || line[end] === '.')) end += 1;
			tokens.push({ kind: 'number', value: line.slice(index, end) });
			index = end;
			continue;
		}
		if (isWord(character)) {
			let end = index + 1;
			while (end < line.length && isWord(line[end])) end += 1;
			const word = line.slice(index, end);
			tokens.push({ kind: beforeColon ? 'kind' : 'identifier', value: word });
			index = end;
			continue;
		}
		if ('[]()=,:.#'.includes(character)) {
			tokens.push({
				kind:
					character === '[' || character === ']' || character === '=' ? 'attribute' : 'operator',
				value: character
			});
			if (character === ':') beforeColon = false;
		} else tokens.push({ kind: 'plain', value: character });
		index += 1;
	}
	return tokens;
}

export function workspaceLines(source: string): readonly WorkspaceLine[] {
	return source
		.split('\n')
		.map((line, index) => ({ number: index + 1, tokens: tokenizeWorkspaceLine(line) }));
}

export function insertIndent(
	source: string,
	selectionStart: number,
	selectionEnd: number,
	spaces = 2
): {
	readonly source: string;
	readonly selectionStart: number;
	readonly selectionEnd: number;
} {
	if (
		!Number.isInteger(selectionStart) ||
		!Number.isInteger(selectionEnd) ||
		selectionStart < 0 ||
		selectionEnd < selectionStart ||
		selectionEnd > source.length
	) {
		throw new RangeError('selection must be a valid source range.');
	}
	if (!Number.isInteger(spaces) || spaces < 1 || spaces > 8)
		throw new RangeError('spaces must be an integer from 1 through 8.');
	const indentation = ' '.repeat(spaces);
	return {
		source: `${source.slice(0, selectionStart)}${indentation}${source.slice(selectionEnd)}`,
		selectionStart: selectionStart + spaces,
		selectionEnd: selectionStart + spaces
	};
}
