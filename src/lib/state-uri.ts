/**
 * Workspace state ⇄ URI codec.
 *
 * Source text is UTF-8 encoded with `TextEncoder` and packed into URL-safe
 * base64 (`-`/`_`, no padding) so `?code=` links survive chat clients and
 * markdown. Native browser APIs only.
 */

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
	const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

/** Same UTF-16 source-character ceiling enforced by the compiler contract. */
export const MAX_WORKSPACE_STATE_CHARACTERS = 131_072;
/**
 * A JavaScript code unit expands to at most three UTF-8 bytes (a surrogate
 * pair is four bytes across two units). Keep the allocation guard in bytes,
 * then enforce the actual compiler contract on decoded string length.
 */
export const MAX_WORKSPACE_STATE_BYTES = MAX_WORKSPACE_STATE_CHARACTERS * 3;
/**
 * Conservative transport budget for links copied into proxies, issue trackers,
 * chat clients, and email. The editor accepts much larger local documents;
 * those must be shared as downloaded source rather than a brittle mega-URL.
 */
export const MAX_WORKSPACE_URL_CHARACTERS = 16_000;

/** Encode workspace source into a safe URI token. */
export function encodeWorkspaceState(source: string): string {
	return bytesToBase64Url(new TextEncoder().encode(source));
}

/** Restore workspace source from a `?code=` token; undefined when invalid. */
export function decodeWorkspaceState(token: string): string | undefined {
	/* Reject before base64 allocation. Four encoded characters represent at
	 * most three bytes; a tiny allowance covers an omitted padding quantum. */
	if (token.length > Math.ceil((MAX_WORKSPACE_STATE_BYTES * 4) / 3) + 4) return undefined;
	try {
		const bytes = base64UrlToBytes(token);
		if (bytes.byteLength > MAX_WORKSPACE_STATE_BYTES) return undefined;
		const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		return source.length <= MAX_WORKSPACE_STATE_CHARACTERS ? source : undefined;
	} catch {
		return undefined;
	}
}

export const WORKSPACE_OUTPUT_MODES = ['default', 'embedded-css', 'full'] as const;
export type WorkspaceOutputMode = (typeof WORKSPACE_OUTPUT_MODES)[number];

export interface WorkspaceQueryState {
	readonly source: string;
	readonly width: number;
	readonly height: number;
	readonly title: string;
	readonly mode: WorkspaceOutputMode;
}

/** Write the complete reproducible workspace state into an existing URL. */
export function writeWorkspaceQuery(url: URL, state: WorkspaceQueryState): URL {
	url.searchParams.set('code', encodeWorkspaceState(state.source));
	url.searchParams.set('w', String(Math.round(state.width)));
	url.searchParams.set('h', String(Math.round(state.height)));
	url.searchParams.set('t', state.title);
	url.searchParams.set('m', state.mode);
	return url;
}

/**
 * Build a complete workspace URL only when the entire encoded URL is within
 * the practical transport budget. The input URL is never mutated.
 */
export function shareableWorkspaceUrl(url: URL, state: WorkspaceQueryState): URL | undefined {
	const candidate = new URL(url);
	for (const key of ['code', 'w', 'h', 't', 'm']) candidate.searchParams.delete(key);
	/*
	 * UTF-8 is never shorter than the source's UTF-16 code-unit count, and an
	 * unpadded base64url token needs ceil(4n/3) characters. Reject an
	 * impossible link before allocating a large byte array, binary string, and
	 * encoded URL on every debounced edit in large-file mode.
	 */
	const minimumCodeCharacters = Math.ceil((state.source.length * 4) / 3);
	if (
		candidate.href.length + '?code='.length + minimumCodeCharacters >
		MAX_WORKSPACE_URL_CHARACTERS
	) {
		return undefined;
	}
	writeWorkspaceQuery(candidate, state);
	return candidate.href.length <= MAX_WORKSPACE_URL_CHARACTERS ? candidate : undefined;
}

/** Narrow a query-string mode without trusting arbitrary URL input. */
export function workspaceOutputMode(
	raw: string | null | undefined,
	fallback: WorkspaceOutputMode = 'full'
): WorkspaceOutputMode {
	return WORKSPACE_OUTPUT_MODES.find((mode) => mode === raw) ?? fallback;
}
