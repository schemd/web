import type { PageServerLoad } from './$types';
import { simulationIndexData } from '$lib/simulations/server';

export const load: PageServerLoad = ({ params }) => simulationIndexData(params.version);
