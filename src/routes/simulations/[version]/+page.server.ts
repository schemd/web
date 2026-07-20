import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveVersion } from '$lib/server/registry';
import { listSimulationEnvironments } from '$lib/server/simulations';

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No simulation release named ${params.version}.`);
	}
	if (params.version === 'latest') {
		redirect(307, `/simulations/${version}`);
	}
	return { version, environments: listSimulationEnvironments() };
};
