import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery, searchDocuments, type SearchDocument } from './search';

const documents: readonly SearchDocument[] = [
	{ id: 'exact', title: 'SVG', summary: 'Vectors', category: 'A', path: '/a', text: 'render output' },
	{ id: 'prefix', title: 'SVG output', summary: 'Vectors', category: 'A', path: '/b', text: 'render output' },
	{ id: 'title', title: 'Responsive SVG', summary: 'Vectors', category: 'B', path: '/c', text: 'render output' },
	{ id: 'summary', title: 'Sizing', summary: 'Responsive SVG vectors', category: 'B', path: '/d', text: 'render output' },
	{ id: 'text', title: 'Grammar', summary: 'Language', category: 'C', path: '/e', text: 'SVG render output' },
	{ id: 'none', title: 'Unrelated', summary: 'Nothing', category: 'D', path: '/f', text: 'other' }
];

describe('search', () => {
	it('normalizes, deduplicates, bounds, and filters query tokens', () => {
		expect(normalizeSearchQuery('  SVG svg @schemd/core ! a responsive.output extra one two three four  ')).toEqual([
			'svg', '@schemdcore', 'responsive.output', 'extra', 'one', 'two', 'three', 'four'
		]);
		expect(normalizeSearchQuery('! a')).toEqual([]);
	});

	it('scores every match tier and sorts deterministically', () => {
		expect(searchDocuments(documents, 'svg').map((result) => result.id)).toEqual(['exact', 'prefix', 'title', 'summary', 'text']);
		expect(searchDocuments(documents, 'render output').map((result) => result.id)).toEqual(['prefix', 'text', 'title', 'summary', 'exact']);
		expect(searchDocuments(documents, '')).toEqual([]);
		expect(searchDocuments(documents, 'svg', 2)).toHaveLength(2);
	});

	it.each([0, -1, 1.2, 101])('rejects invalid limit %s', (limit) => {
		expect(() => searchDocuments(documents, 'svg', limit)).toThrowError('limit must be');
	});
});
