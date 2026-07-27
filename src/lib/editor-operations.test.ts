import { describe, expect, it } from 'vitest';
import {
	deleteEmptyPair,
	findText,
	indentSelection,
	lineSelection,
	outdentSelection,
	pairedEdit,
	positionAtOffset,
	replaceMatches,
	selectedLineRange,
	toggleLineComments
} from './editor-operations';

const SOURCE = 'port:A "A" at (80, 80)\nA.out -> B.in #blue\n// note';

describe('editor line operations', () => {
	it('selects complete lines without including a trailing boundary line', () => {
		expect(selectedLineRange(SOURCE, { start: 3, end: SOURCE.indexOf('A.out') })).toEqual({
			start: 0,
			end: SOURCE.indexOf('\n')
		});
		expect(selectedLineRange(SOURCE, { start: SOURCE.length, end: SOURCE.length })).toEqual({
			start: SOURCE.lastIndexOf('\n') + 1,
			end: SOURCE.length
		});
	});

	it('indents and outdents multi-line selections while preserving selection intent', () => {
		const end = SOURCE.indexOf('\n//');
		const indented = indentSelection(SOURCE, { start: 0, end });
		expect(indented.text.startsWith('  port:A')).toBe(true);
		expect(indented.text).toContain('\n  A.out');
		expect(indented.start).toBe(2);
		expect(indented.end).toBe(end + 4);

		const restored = outdentSelection(indented.text, {
			start: indented.start,
			end: indented.end
		});
		expect(restored.text).toBe(SOURCE);
	});

	it('outdents tabs and only the available spaces', () => {
		const result = outdentSelection('\tfirst\n second\nthird', { start: 0, end: 20 });
		expect(result.text).toBe('first\nsecond\nthird');
	});

	it('comments after indentation and toggles a wholly commented selection back', () => {
		const source = '  resistor:R1 "R"\n\n  C1.out -> R1.in';
		const commented = toggleLineComments(source, { start: 0, end: source.length });
		expect(commented.text).toBe('  // resistor:R1 "R"\n\n  // C1.out -> R1.in');
		const uncommented = toggleLineComments(commented.text, {
			start: 0,
			end: commented.text.length
		});
		expect(uncommented.text).toBe(source);
	});

	it('comments a mixed selection instead of producing a mixed state', () => {
		const result = toggleLineComments('// one\ntwo', { start: 0, end: 10 });
		expect(result.text).toBe('// // one\n// two');
	});
});

describe('editor delimiter operations', () => {
	it('wraps selections and places the caret inside empty pairs', () => {
		expect(pairedEdit('label', { start: 0, end: 5 }, '"')).toEqual({
			text: '"label"',
			start: 1,
			end: 6
		});
		expect(pairedEdit('', { start: 0, end: 0 }, '[')).toEqual({
			text: '[]',
			start: 1,
			end: 1
		});
	});

	it('skips an existing closing delimiter and conservatively declines unsafe quotes', () => {
		expect(pairedEdit('()', { start: 1, end: 1 }, ')')).toEqual({
			text: '()',
			start: 2,
			end: 2
		});
		expect(pairedEdit('word', { start: 0, end: 0 }, '"')).toBeUndefined();
		expect(pairedEdit('\\', { start: 1, end: 1 }, '"')).toBeUndefined();
	});

	it('deletes both sides of an empty pair only at a collapsed caret', () => {
		expect(deleteEmptyPair('before [] after', { start: 8, end: 8 })).toEqual({
			text: 'before  after',
			start: 7,
			end: 7
		});
		expect(deleteEmptyPair('[x]', { start: 1, end: 1 })).toBeUndefined();
	});
});

describe('editor search and navigation', () => {
	it('finds literal matches with case and whole-word controls', () => {
		expect(findText('R1 r1 R10', 'r1')).toEqual([
			{ start: 0, end: 2 },
			{ start: 3, end: 5 },
			{ start: 6, end: 8 }
		]);
		expect(findText('R1 r1 R10', 'r1', { caseSensitive: true })).toEqual([{ start: 3, end: 5 }]);
		expect(findText('R1 r1 R10', 'r1', { wholeWord: true })).toEqual([
			{ start: 0, end: 2 },
			{ start: 3, end: 5 }
		]);
		expect(findText('anything', '')).toEqual([]);
	});

	it('preserves textarea offsets across Unicode case-fold expansion and surrogate pairs', () => {
		expect(findText('İ Ω LABEL', 'label')).toEqual([{ start: 4, end: 9 }]);
		expect(findText('A😀Ωa', 'Ω')).toEqual([{ start: 3, end: 4 }]);
		expect(findText('İ', 'i')).toEqual([{ start: 0, end: 1 }]);
	});

	it('replaces precomputed matches without interpreting replacement syntax', () => {
		const text = 'R1 -> R1';
		expect(replaceMatches(text, findText(text, 'R1'), '$&')).toBe('$& -> $&');
	});

	it('maps lines and offsets with defensive clamping', () => {
		expect(lineSelection('zero\none\ntwo', 1)).toEqual({ start: 5, end: 8 });
		expect(lineSelection('zero\none', 99)).toEqual({ start: 8, end: 8 });
		expect(positionAtOffset('zero\none', 7)).toEqual({ line: 1, column: 2 });
		expect(positionAtOffset('zero', -3)).toEqual({ line: 0, column: 0 });
		expect(positionAtOffset('\nfirst', 0)).toEqual({ line: 0, column: 0 });
	});
});
