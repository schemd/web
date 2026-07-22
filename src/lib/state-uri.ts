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

/** Encode workspace source into a safe URI token. */
export function encodeWorkspaceState(source: string): string {
	return bytesToBase64Url(new TextEncoder().encode(source));
}

/** Restore workspace source from a `?code=` token; undefined when invalid. */
export function decodeWorkspaceState(token: string): string | undefined {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(token));
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

/** Narrow a query-string mode without trusting arbitrary URL input. */
export function workspaceOutputMode(
	raw: string | null | undefined,
	fallback: WorkspaceOutputMode = 'full'
): WorkspaceOutputMode {
	return WORKSPACE_OUTPUT_MODES.find((mode) => mode === raw) ?? fallback;
}
