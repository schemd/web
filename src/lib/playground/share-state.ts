const SHARE_PREFIX = 'z1.';
export const MAX_SHARE_URL_CHARACTERS = 24_000;
export const MAX_SOURCE_CHARACTERS = 131_072;

export interface SharedWorkspace {
	readonly source: string;
	readonly mode: 'default' | 'embedded-css' | 'full';
	readonly title: string;
	readonly bounds: `${number}x${number}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array {
	const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
	if (!('CompressionStream' in globalThis)) return bytes;
	const stream = new Blob([Uint8Array.from(bytes)])
		.stream()
		.pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
	if (bytes[0] !== 0x1f || bytes[1] !== 0x8b || !('DecompressionStream' in globalThis)) {
		return bytes;
	}
	const stream = new Blob([Uint8Array.from(bytes)])
		.stream()
		.pipeThrough(new DecompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeWorkspace(workspace: SharedWorkspace): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(workspace));
	return `${SHARE_PREFIX}${bytesToBase64Url(await gzip(bytes))}`;
}

function legacyFence(value: string): SharedWorkspace | undefined {
	const match =
		/^```schemd(?:\s+bounds="(\d+x\d+)")?(?:\s+title="([^"]*)")?\s*\n([\s\S]*?)\n?```$/iu.exec(
			value.trim()
		);
	if (!match?.[3]) return undefined;
	const rawBounds = match[1];
	const bounds: `${number}x${number}` = rawBounds
		? `${Number(rawBounds.split('x')[0])}x${Number(rawBounds.split('x')[1])}`
		: '880x520';
	return {
		source: match[3],
		mode: 'full',
		bounds,
		title: match[2] ?? 'Shared schematic'
	};
}

function isSharedWorkspace(value: unknown): value is SharedWorkspace {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('source' in value) ||
		!('mode' in value) ||
		!('title' in value) ||
		!('bounds' in value)
	) {
		return false;
	}
	return (
		typeof value.source === 'string' &&
		value.source.length <= MAX_SOURCE_CHARACTERS &&
		(value.mode === 'default' || value.mode === 'embedded-css' || value.mode === 'full') &&
		typeof value.title === 'string' &&
		typeof value.bounds === 'string' &&
		/^\d{2,4}x\d{2,4}$/u.test(value.bounds)
	);
}

export async function decodeWorkspace(value: string): Promise<SharedWorkspace | undefined> {
	if (!value.startsWith(SHARE_PREFIX)) {
		if (value.length > MAX_SOURCE_CHARACTERS + 1_024) return undefined;
		return (
			legacyFence(value) ?? {
				source: value,
				mode: 'full',
				bounds: '880x520',
				title: 'Shared schematic'
			}
		);
	}

	try {
		const compressed = base64UrlToBytes(value.slice(SHARE_PREFIX.length));
		if (compressed.byteLength > MAX_SOURCE_CHARACTERS * 2) return undefined;
		const decoded = new TextDecoder().decode(await gunzip(compressed));
		if (decoded.length > MAX_SOURCE_CHARACTERS + 2_048) return undefined;
		const parsed: unknown = JSON.parse(decoded);
		return isSharedWorkspace(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}
