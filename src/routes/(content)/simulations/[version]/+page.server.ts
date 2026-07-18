import { error } from '@sveltejs/kit';
import { SIMULATIONS } from '$lib/simulations/manifest';
import { getVersion, VERSIONS } from '$lib/versioning/manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const version = getVersion(params.version);
	if (!version) error(404, `Simulation compiler ${params.version} is not available.`);
	return { version, versions: VERSIONS, simulations: SIMULATIONS };
};
