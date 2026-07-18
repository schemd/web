export interface SearchDocument {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly category: string;
	readonly path: string;
	readonly text: string;
}

export interface SearchResult extends SearchDocument {
	readonly score: number;
}

export function normalizeSearchQuery(value: string): readonly string[] {
	const normalized = value.trim().toLocaleLowerCase('en-US').slice(0, 80);
	const tokens: string[] = [];
	for (const rawToken of normalized.split(/\s+/u)) {
		const token = rawToken.replaceAll(/[^a-z0-9@+._-]/gu, '');
		if (token.length >= 2 && !tokens.includes(token)) tokens.push(token);
		if (tokens.length === 8) break;
	}
	return tokens;
}

export function searchDocuments(
	documents: readonly SearchDocument[],
	query: string,
	limit = 20
): readonly SearchResult[] {
	if (!Number.isInteger(limit) || limit < 1 || limit > 100)
		throw new RangeError('limit must be an integer from 1 through 100.');
	const tokens = normalizeSearchQuery(query);
	if (tokens.length === 0) return [];
	const results: SearchResult[] = [];
	for (const document of documents) {
		const title = document.title.toLocaleLowerCase('en-US');
		const summary = document.summary.toLocaleLowerCase('en-US');
		const text = document.text.toLocaleLowerCase('en-US');
		let score = 0;
		let matchesAll = true;
		for (const token of tokens) {
			if (title === token) score += 16;
			else if (title.startsWith(token)) score += 10;
			else if (title.includes(token)) score += 7;
			else if (summary.includes(token)) score += 4;
			else if (text.includes(token)) score += 1;
			else {
				matchesAll = false;
				break;
			}
		}
		if (matchesAll) results.push({ ...document, score });
	}
	return results
		.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
		.slice(0, limit);
}
