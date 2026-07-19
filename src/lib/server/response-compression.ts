const COMPRESSIBLE_TYPES = [
	'text/',
	'application/javascript',
	'application/json',
	'application/xml',
	'image/svg+xml'
] as const;

function quality(parameter: string | undefined): number {
	if (parameter === undefined) return 1;
	const [name, value] = parameter.split('=').map((part) => part.trim());
	if (name !== 'q' || value === undefined) return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

function acceptsGzip(value: string | null): boolean {
	if (value === null) return false;
	let gzipQuality: number | undefined;
	let wildcardQuality: number | undefined;
	for (const item of value.split(',')) {
		const [encoding, parameter] = item
			.trim()
			.toLowerCase()
			.split(';')
			.map((part) => part.trim());
		if (encoding === 'gzip') gzipQuality = quality(parameter);
		else if (encoding === '*') wildcardQuality = quality(parameter);
	}
	return (gzipQuality ?? wildcardQuality ?? 0) > 0;
}

function appendVary(headers: Headers, value: string): void {
	const existing = headers.get('vary');
	const values = new Set(
		(existing ? existing.split(',') : []).map((item) => item.trim()).filter(Boolean)
	);
	values.add(value);
	headers.set('Vary', [...values].join(', '));
}

export function compressServerResponse(request: Request, response: Response): Response {
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	const compressible = COMPRESSIBLE_TYPES.some((type) => contentType.startsWith(type));
	if (
		request.method === 'HEAD' ||
		response.body === null ||
		!compressible ||
		response.headers.has('content-encoding') ||
		response.headers.has('content-range') ||
		!acceptsGzip(request.headers.get('accept-encoding'))
	)
		return response;

	const headers = new Headers(response.headers);
	headers.delete('content-length');
	headers.set('Content-Encoding', 'gzip');
	appendVary(headers, 'Accept-Encoding');
	return new Response(response.body.pipeThrough(new CompressionStream('gzip')), {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
