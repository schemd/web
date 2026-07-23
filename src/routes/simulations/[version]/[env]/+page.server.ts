import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion } from '$lib/server/registry';
import { getSimulation, listSimulationEnvironments } from '$lib/server/simulations';
import { renderSimulationMath, renderSimulationTimeline } from '$lib/server/simulation-math';
import { timelineFor } from '$lib/simulation-timelines';

export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No simulation release named ${params.version}.`);
	}
	/* Canonicalize aliases (`latest`, `0.3`) to the concrete release URL. */
	if (params.version !== version) {
		redirect(307, `/simulations/${version}/${params.env}${url.search}`);
	}

	const simulation = getSimulation(params.env);
	if (!simulation) {
		error(404, `Unknown simulation environment: ${params.env}`);
	}

	return {
		version,
		simulation,
		math: renderSimulationMath(simulation.id),
		timeline: renderSimulationTimeline(timelineFor(simulation.id)),
		environments: listSimulationEnvironments().map(({ id, index, title }) => ({ id, index, title }))
	};
};
