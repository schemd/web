import { redirect } from '@sveltejs/kit';
import { LATEST_VERSION } from '$lib/versioning/manifest';

export function load(): never {
	redirect(308, LATEST_VERSION.simulationsPath);
}
