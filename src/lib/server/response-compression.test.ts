import { describe, expect, it } from 'vitest';
import { compressServerResponse } from './response-compression';

async function decompressedText(response: Response): Promise<string> {
	if (!response.body) throw new Error('Expected a response body.');
	return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
}

describe('Node response compression', () => {
	it('streams compressible HTML with correct representation headers', async () => {
		const request = new Request('https://schemd.test/docs', {
			headers: { 'accept-encoding': 'br, gzip;q=1' }
		});
		const original = new Response('<main>Schemd</main>'.repeat(100), {
			status: 201,
			statusText: 'Created',
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'content-length': '1900',
				vary: 'Accept-Language'
			}
		});
		const compressed = compressServerResponse(request, original);
		expect(compressed).not.toBe(original);
		expect(compressed.status).toBe(201);
		expect(compressed.statusText).toBe('Created');
		expect(compressed.headers.get('content-encoding')).toBe('gzip');
		expect(compressed.headers.get('content-length')).toBeNull();
		expect(compressed.headers.get('vary')).toBe('Accept-Language, Accept-Encoding');
		expect(await decompressedText(compressed)).toBe('<main>Schemd</main>'.repeat(100));
	});

	it('accepts wildcard encoding and does not duplicate Vary', async () => {
		const compressed = compressServerResponse(
			new Request('https://schemd.test/api', {
				headers: { 'accept-encoding': '*;q=0.8' }
			}),
			new Response('{"ok":true}', {
				headers: { 'content-type': 'application/json', vary: 'Accept-Encoding' }
			})
		);
		expect(compressed.headers.get('content-encoding')).toBe('gzip');
		expect(compressed.headers.get('vary')).toBe('Accept-Encoding');
		expect(await decompressedText(compressed)).toBe('{"ok":true}');
	});

	it('accepts an unparameterised gzip representation', async () => {
		const compressed = compressServerResponse(
			new Request('https://schemd.test/plain', {
				headers: { 'accept-encoding': 'gzip' }
			}),
			new Response('plain text', {
				headers: { 'content-type': 'text/plain' }
			})
		);
		expect(compressed.headers.get('vary')).toBe('Accept-Encoding');
		expect(await decompressedText(compressed)).toBe('plain text');
	});

	it('honours explicit quality values and invalid parameters', () => {
		for (const acceptEncoding of [
			'gzip;q=0, *;q=1',
			'gzip;q=invalid',
			'gzip;level=9',
			'gzip;q=2',
			'gzip;q=-1',
			'br'
		]) {
			const original = new Response('Schemd', {
				headers: { 'content-type': 'text/plain' }
			});
			expect(
				compressServerResponse(
					new Request('https://schemd.test', {
						headers: { 'accept-encoding': acceptEncoding }
					}),
					original
				)
			).toBe(original);
		}
	});

	it('leaves ineligible responses untouched', () => {
		const gzipRequest = new Request('https://schemd.test', {
			headers: { 'accept-encoding': 'gzip' }
		});
		const responses = [
			new Response(null),
			new Response('pixels', { headers: { 'content-type': 'image/png' } }),
			new Response('already compressed', {
				headers: { 'content-type': 'text/plain', 'content-encoding': 'br' }
			}),
			new Response('partial', {
				headers: { 'content-type': 'text/plain', 'content-range': 'bytes 0-6/20' }
			})
		];
		for (const response of responses)
			expect(compressServerResponse(gzipRequest, response)).toBe(response);

		const noEncoding = new Response('plain', { headers: { 'content-type': 'text/plain' } });
		expect(compressServerResponse(new Request('https://schemd.test'), noEncoding)).toBe(noEncoding);

		const headResponse = new Response('head metadata', {
			headers: { 'content-type': 'text/plain' }
		});
		expect(
			compressServerResponse(
				new Request('https://schemd.test', {
					method: 'HEAD',
					headers: { 'accept-encoding': 'gzip' }
				}),
				headResponse
			)
		).toBe(headResponse);
	});
});
