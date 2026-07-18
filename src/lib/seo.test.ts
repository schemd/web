import { describe, expect, it } from 'vitest';
import { absoluteUrl, breadcrumbSchema, safeStructuredData } from './seo';

describe('SEO helpers', () => {
	it('builds absolute URLs and breadcrumb structured data', () => {
		expect(absoluteUrl('/docs/v0.2.1/overview')).toBe('https://schemd.johnowolabiidogun.dev/docs/v0.2.1/overview');
		expect(breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Docs', path: '/docs/v0.2.1/overview' }])).toEqual({
			'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://schemd.johnowolabiidogun.dev/' },
				{ '@type': 'ListItem', position: 2, name: 'Docs', item: 'https://schemd.johnowolabiidogun.dev/docs/v0.2.1/overview' }
			]
		});
	});

	it('neutralizes script-closing characters in JSON', () => {
		expect(safeStructuredData({ value: '</script>' })).toBe('{"value":"\\u003c/script>"}');
	});
});
