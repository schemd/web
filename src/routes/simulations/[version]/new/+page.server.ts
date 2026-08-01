import { error, redirect } from '@sveltejs/kit';
import { compileSchematic } from '@schemd/core';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion } from '$lib/server/registry';
import { decodeWorkspaceState } from '$lib/state-uri';
import { LAB_MODEL_NAMES } from '$lib/lab-models';
import { validateLabManifest, type LabManifest } from '$lib/lab-manifest';
import { STARTER_LAB } from './starter';

/** Bound an author-supplied document the same way the compile endpoint does. */
const LIMITS = { components: 200, connections: 400, sourceCharacters: 20_000 } as const;

export interface BuilderResult {
	readonly manifest: LabManifest | undefined;
	readonly svg: string | undefined;
	/** Everything wrong with what the author wrote, all at once. */
	readonly problems: readonly string[];
	/** The text in the editor, which is what the author actually typed. */
	readonly draft: string;
}

/**
 * Parse, validate, and compile an author's manifest.
 *
 * Every failure path returns problems rather than throwing: a builder whose
 * preview disappears behind an error page the moment a brace is unbalanced is
 * unusable, and the author needs to see the diagnostic *beside* the thing that
 * produced it. The only errors this cannot absorb are the ones about the
 * release itself, which are genuine 404s.
 */
function build(draft: string): BuilderResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(draft);
	} catch (cause) {
		return {
			manifest: undefined,
			svg: undefined,
			problems: [`Manifest is not valid JSON: ${(cause as Error).message}`],
			draft
		};
	}

	const manifest = parsed as LabManifest;
	if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
		return {
			manifest: undefined,
			svg: undefined,
			problems: ['Manifest must be an object.'],
			draft
		};
	}

	const problems = [...validateLabManifest(manifest, LAB_MODEL_NAMES)];
	if (problems.length > 0) return { manifest: undefined, svg: undefined, problems, draft };

	try {
		const compiled = compileSchematic(manifest.source, {
			bounds: { width: 1000, height: 520 },
			title: manifest.title,
			mode: 'full',
			idPrefix: `lab-${manifest.id}`,
			limits: LIMITS
		});
		return { manifest, svg: compiled.svg, problems: [], draft };
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		const line = (cause as { line?: number }).line;
		return {
			manifest: undefined,
			svg: undefined,
			problems: [line === undefined ? message : `Line ${line}: ${message}`],
			draft
		};
	}
}

export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) error(404, `No simulation release named ${params.version}.`);
	if (params.version !== version) redirect(307, `/simulations/${version}/new${url.search}`);

	/* A lab arrives in the URL through the same encoder the playground shares
	   workspaces with, so a builder link is as portable as a playground link. */
	const token = url.searchParams.get('lab');
	const shared = token === null ? undefined : decodeWorkspaceState(token);
	const draft = shared ?? JSON.stringify(STARTER_LAB, null, 2);

	return { version, models: LAB_MODEL_NAMES, ...build(draft) };
};
