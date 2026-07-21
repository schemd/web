import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion } from '$lib/server/registry';
import { listSimulationEnvironments } from '$lib/server/simulations';

export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No simulation release named ${params.version}.`);
	}
	/* Canonicalize aliases (`latest`, `0.3`) to the concrete release URL. */
	if (params.version !== version) {
		redirect(307, `/simulations/${version}${url.search}`);
	}
	return { version, environments: listSimulationEnvironments() };
};
