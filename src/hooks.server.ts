import type { Handle } from '@sveltejs/kit';
import { compressServerResponse } from '$lib/server/response-compression';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);
	response.headers.set('X-Frame-Options', 'DENY');
	return compressServerResponse(event.request, response);
};
