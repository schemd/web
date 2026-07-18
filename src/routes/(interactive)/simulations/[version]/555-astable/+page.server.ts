import { simulationPageData } from '$lib/server/simulations';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) =>
	simulationPageData(params.version, '555-astable');
