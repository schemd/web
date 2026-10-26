import { localized, localeOf } from '#lib/i18n/index.ts';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion } from '#lib/server/registry.ts';
import { getSimulation, listSimulationEnvironments } from '#lib/server/simulations.ts';
import { renderSimulationMath, renderSimulationTimeline } from '#lib/server/simulation-math.ts';
import { timelineFor } from '#lib/simulation-timelines.ts';

export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No simulation release named ${params.version}.`);
	}
	/* Canonicalize aliases (`latest`, `0.3`) to the concrete release URL. */
	if (params.version !== version) {
		redirect(
			307,
			localized(`/simulations/${version}/${params.env}${url.search}`, localeOf(url.pathname))
		);
	}

	const locale = localeOf(url.pathname);
	const simulation = getSimulation(params.env, locale);
	if (!simulation) {
		error(404, `Unknown simulation environment: ${params.env}`);
	}

	return {
		version,
		simulation,
		math: renderSimulationMath(simulation.id),
		timeline: renderSimulationTimeline(timelineFor(simulation.id), locale),
		environments: listSimulationEnvironments(locale).map(({ id, index, title, curriculum }) => ({
			id,
			index,
			title,
			curriculum
		}))
	};
};
