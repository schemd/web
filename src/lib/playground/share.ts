const SHARE_PREFIX = '#source=';

export function encodeSharedSource(source: string): string {
	return `${SHARE_PREFIX}${encodeURIComponent(source)}`;
}

export function decodeSharedSource(hash: string, maximumCharacters: number): string | undefined {
	if (!Number.isInteger(maximumCharacters) || maximumCharacters < 1) throw new RangeError('maximumCharacters must be a positive integer.');
	if (!hash.startsWith(SHARE_PREFIX)) return undefined;
	try {
		const source = decodeURIComponent(hash.slice(SHARE_PREFIX.length));
		return source.length <= maximumCharacters ? source : undefined;
	} catch {
		return undefined;
	}
}

export function svgFileName(title: string): string {
	const words = title.trim().toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);
	const base = words.join('-').slice(0, 64).replace(/-+$/u, '');
	return `${base || 'schemd-diagram'}.svg`;
}
