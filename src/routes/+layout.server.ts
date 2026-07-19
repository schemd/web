import { getCachedReleaseRegistry } from '$lib/server/release-cache';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => ({
	release: await getCachedReleaseRegistry()
});
