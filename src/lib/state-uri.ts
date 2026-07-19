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

/** Compress workspace source into a safe URI token. */
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
