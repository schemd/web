import type { PageServerLoad } from './$types';
import { simulationPageData } from '$lib/simulations/server';

export const load: PageServerLoad = ({ params }) => simulationPageData(params.version, params.slug);
