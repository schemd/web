import { query } from '$app/server';
import { fetchReleaseRegistry } from '$lib/server/release-registry';

export const getReleaseRegistry = query(fetchReleaseRegistry);
