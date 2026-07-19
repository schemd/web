import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveVersion } from '$lib/server/registry';
import { getSimulation, listSimulationEnvironments } from '$lib/server/simulations';

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined || params.version === 'latest') {
		redirect(307, `/simulate/${version ?? registry.latest}/${params.env}`);
	}

	const simulation = getSimulation(params.env);
	if (!simulation) {
		error(404, `Unknown simulation environment: ${params.env}`);
	}

	return { version, simulation, environments: listSimulationEnvironments() };
};
