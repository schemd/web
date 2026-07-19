const SHARE_PARAMETER = 'code';
const LEGACY_PREFIX = '#source=';
const COMPRESSED_PREFIX = 'z1.';

function assertMaximum(maximumCharacters: number): void {
	if (!Number.isInteger(maximumCharacters) || maximumCharacters < 1)
		throw new RangeError('maximumCharacters must be a positive integer.');
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): Uint8Array | undefined {
	if (!/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) return undefined;
	try {
		const padding = '='.repeat((4 - (value.length % 4)) % 4);
		const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
		return bytes;
	} catch {
		return undefined;
	}
}

async function compressedBytes(source: string): Promise<Uint8Array> {
	const stream = new Blob([source]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressedSource(
	bytes: Uint8Array,
	maximumCharacters: number
): Promise<string | undefined> {
	const maximumBytes = maximumCharacters * 4;
	const ownedBytes = new Uint8Array(bytes.byteLength);
	ownedBytes.set(bytes);
	const reader = new Blob([ownedBytes.buffer])
		.stream()
		.pipeThrough(new DecompressionStream('gzip'))
		.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		while (true) {
			const result = await reader.read();
			if (result.done) break;
			byteLength += result.value.byteLength;
			if (byteLength > maximumBytes) {
				await reader.cancel();
				return undefined;
			}
			chunks.push(result.value);
		}
		const combined = new Uint8Array(byteLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.byteLength;
		}
		const source = new TextDecoder(undefined, { fatal: true }).decode(combined);
		return source.length <= maximumCharacters ? source : undefined;
	} catch {
		return undefined;
	} finally {
		reader.releaseLock();
	}
}

export async function encodeSharedSource(source: string): Promise<string> {
	const encoded = toBase64Url(await compressedBytes(source));
	return `?${SHARE_PARAMETER}=${COMPRESSED_PREFIX}${encoded}`;
}

export async function decodeSharedSource(
	locationValue: string,
	maximumCharacters: number
): Promise<string | undefined> {
	assertMaximum(maximumCharacters);
	let encoded: string | undefined;
	if (locationValue.startsWith(LEGACY_PREFIX)) encoded = locationValue.slice(LEGACY_PREFIX.length);
	else if (locationValue.startsWith('?'))
		encoded = new URLSearchParams(locationValue).get(SHARE_PARAMETER) ?? undefined;
	if (encoded === undefined) return undefined;
	if (encoded.startsWith(COMPRESSED_PREFIX)) {
		if (encoded.length > maximumCharacters * 8 + 128) return undefined;
		const bytes = fromBase64Url(encoded.slice(COMPRESSED_PREFIX.length));
		return bytes ? decompressedSource(bytes, maximumCharacters) : undefined;
	}
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
