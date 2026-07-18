const SHARE_PARAMETER = 'code';
const LEGACY_PREFIX = '#source=';

export function encodeSharedSource(source: string): string {
	return `?${SHARE_PARAMETER}=${encodeURIComponent(source)}`;
}

export function decodeSharedSource(
	locationValue: string,
	maximumCharacters: number
): string | undefined {
	if (!Number.isInteger(maximumCharacters) || maximumCharacters < 1)
		throw new RangeError('maximumCharacters must be a positive integer.');
	let encoded: string | undefined;
	if (locationValue.startsWith(LEGACY_PREFIX)) encoded = locationValue.slice(LEGACY_PREFIX.length);
	else if (locationValue.startsWith('?'))
		encoded = new URLSearchParams(locationValue).get(SHARE_PARAMETER) ?? undefined;
	if (encoded === undefined) return undefined;
	try {
		const source = locationValue.startsWith('?') ? encoded : decodeURIComponent(encoded);
		return source.length <= maximumCharacters ? source : undefined;
	} catch {
		return undefined;
	}
}

export function svgFileName(title: string): string {
	const words = title
		.trim()
		.toLowerCase()
		.split(/[^a-z0-9]+/u)
		.filter(Boolean);
	const base = words.join('-').slice(0, 64).replace(/-+$/u, '');
	return `${base || 'schemd-diagram'}.svg`;
}
