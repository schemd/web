import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'cache-control' || name === 'etag' || name === 'last-modified'
	});

	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('cross-origin-opener-policy', 'same-origin');
	response.headers.set(
		'permissions-policy',
		'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=()'
	);

	if (event.url.pathname.startsWith('/api/')) {
		response.headers.set('cache-control', 'no-store');
	} else if (event.url.pathname.startsWith('/_app/')) {
		response.headers.set('cache-control', 'public, max-age=31536000, immutable');
	}

	return response;
};
