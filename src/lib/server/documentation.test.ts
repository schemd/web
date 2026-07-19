import { describe, expect, test } from 'vitest';
import {
	documentationPageCount,
	documentationPaths,
	documentationSectionCount,
	getDocumentationPage,
	searchDocumentation
} from './documentation';

const HISTORICAL_SLUGS: readonly string[] = [
	'overview',
	'grammar',
	'math-labels',
	'component-reference',
	'responsive-svg',
	'output-modes',
	'integrations',
	'framework-adapters',
	'markdown-adapters',
	'performance',
	'roadmap'
];

describe('documentation registry', () => {
	test('preserves every historical chapter and section anchor', () => {
		expect(documentationPageCount()).toBe(HISTORICAL_SLUGS.length);
		expect(documentationSectionCount()).toBe(26);
		expect(documentationPaths()).toEqual(HISTORICAL_SLUGS.map((slug) => `/docs/v0.2.1/${slug}`));
		expect(getDocumentationPage('v0.2.1', 'overview')?.sections.map(({ id }) => id)).toEqual([
			'direct-api',
			'markdown'
		]);
		expect(
			getDocumentationPage('v0.2.1', 'component-reference')?.sections.map(({ id }) => id)
		).toEqual([
			'passives',
			'semiconductors',
			'boundaries',
			'logic-gates',
			'quantum-gates',
			'integrated-circuits',
			'uml-structure',
			'uml-behavior',
			'uml-sequence'
		]);
	});

	test('precompiles every synchronized example into bounded SVG', () => {
		for (const path of documentationPaths()) {
			const segments = path.split('/');
			const version = segments[2] ?? '';
			const slug = segments[3] ?? '';
			const page = getDocumentationPage(version, slug);
			expect(page).toBeDefined();
			for (const section of page?.sections ?? []) {
				expect(section.example.svg).toMatch(/<svg\b/u);
				expect(section.example.metrics.components).toBeGreaterThan(0);
				expect(section.example.metrics.svgBytes).toBeGreaterThan(0);
			}
		}
	});

	test('returns anchor-specific, bounded search results', () => {
		const results = searchDocumentation('relationship');
		expect(results.length).toBeGreaterThan(0);
		expect(results.length).toBeLessThanOrEqual(12);
		expect(results.some(({ path }) => path.includes('#'))).toBe(true);
	});
});
