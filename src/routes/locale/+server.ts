import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { localized } from '#lib/i18n/index.ts';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const fields = await request.formData();
	const language = fields.get('language');
	if (language !== 'en' && language !== 'es') error(400, 'Unknown language');
	const target = fields.get('return');
	if (
		typeof target !== 'string' ||
		!target.startsWith('/') ||
		target.startsWith('//') ||
		target.includes('\\')
	)
		error(400, 'Invalid return path');
	const destination = new URL(localized(target, language), url.origin);
	if (destination.origin !== url.origin) error(400, 'Invalid return origin');
	cookies.set('schemd-language', language, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 31536000
	});
	redirect(303, destination.pathname + destination.search + destination.hash);
};
