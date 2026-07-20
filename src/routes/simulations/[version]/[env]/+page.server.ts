import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveVersion } from '$lib/server/registry';
import { getSimulation, listSimulationEnvironments } from '$lib/server/simulations';

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No simulation release named ${params.version}.`);
	}
	if (params.version === 'latest') {
		redirect(307, `/simulations/${version}/${params.env}`);
	}

	const simulation = getSimulation(params.env);
	if (!simulation) {
		error(404, `Unknown simulation environment: ${params.env}`);
	}

	return { version, simulation, environments: listSimulationEnvironments() };
};
