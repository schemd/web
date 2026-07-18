import { SITE_ORIGIN } from '$lib/versioning/manifest';

export interface BreadcrumbItem {
	readonly name: string;
	readonly path: string;
}

export function absoluteUrl(path: string): string {
	return new URL(path, SITE_ORIGIN).href;
}

export function breadcrumbSchema(items: readonly BreadcrumbItem[]): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: absoluteUrl(item.path)
		}))
	};
}

export function safeStructuredData(value: Record<string, unknown>): string {
	return JSON.stringify(value).replaceAll('<', '\\u003c');
}
