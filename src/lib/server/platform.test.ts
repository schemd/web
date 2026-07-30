import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	compileSchematic,
	inspectSchematic,
	parseSchematicFence,
	COMPONENT_KINDS
} from '@schemd/core';
import { decodeWorkspaceState } from '$lib/state-uri';
import { _compileHeroes, _HERO_SPECS } from '../../routes/+page.server';
import { _PLAYGROUND_SAMPLE } from '../../routes/playground/[version]/+page.server';
import { timelineFor } from '$lib/simulation-timelines';
import { docManifest, docSearchIndex, loadDoc } from './docs';
import { loadGallery } from './gallery';
import {
	compareVersionsDesc,
	_createRegistryStore,
	DOCUMENTATION_VERSIONS,
	_buildRegistry,
	_seedReleases,
	packageManifestVersion,
	resolveVersion,
	resolveReleaseVersion,
	WEBSITE_CORE_VERSION,
	type SchemdRegistry
} from './registry';
import {
	DOCUMENTED_VERSIONS,
	LATEST_DOCUMENTED_VERSION,
	resolveDocVersion,
	versionedRawSources
} from './versions';
import { languageCoverage } from './coverage';
import { COMPONENT_CATALOG } from './component-catalog';
import {
	getSimulation,
	getSimulationSource,
	listSimulationEnvironments,
	RC_SOURCE
} from './simulations';

const registry: SchemdRegistry = {
	releases: [WEBSITE_CORE_VERSION, '0.2.1'].map((version) => ({
		version,
		publishedAt: new Date(0).toISOString(),
		unpackedSize: undefined,
		fileCount: undefined,
		gitHead: undefined,
		notes: undefined,
		released: version !== WEBSITE_CORE_VERSION
	})),
	latest: WEBSITE_CORE_VERSION,
	syncedAt: 0,
	live: false
};

describe('versioned registry and documentation', () => {
	test('reports the installed compiler version, independent of editorial release-note order', () => {
		const entry = fileURLToPath(import.meta.resolve('@schemd/core'));
		const manifest: unknown = JSON.parse(
			readFileSync(resolve(dirname(entry), '..', 'package.json'), 'utf8')
		);
		expect(WEBSITE_CORE_VERSION).toBe(packageManifestVersion(manifest));
		expect(packageManifestVersion({ version: 'not semver' })).toBeUndefined();
		expect(packageManifestVersion(null)).toBeUndefined();
	});

	test('compiles every landing-page hero with strict geometry validation', () => {
		const heroes = _compileHeroes();
		expect(heroes).toHaveLength(4);
		for (const hero of heroes) expect(hero.svg).toContain('data-schematic');

		const analog = _HERO_SPECS.find(({ id }) => id === 'circuit')?.source ?? '';
		expect(analog).not.toContain('initial:');
		const quantum = _HERO_SPECS.find(({ id }) => id === 'quantum')?.source ?? '';
		expect(quantum).toContain('CX.in1');
		expect(quantum).toContain('CX.in2');
		expect(quantum).toContain('CX.out1');
		expect(quantum).toContain('CX.out2');
		expect(quantum).not.toMatch(/CX\.(?:control|target|out)(?:\s|$)/);
	});

	test('sorts semver, resolves aliases, and rejects unknown releases', () => {
		expect(['0.2.1', '0.3.1', '0.2.9'].sort(compareVersionsDesc)).toEqual([
			'0.3.1',
			'0.2.9',
			'0.2.1'
		]);
		expect(['0.4.0-beta.2', '0.4.0', '0.4.0-beta.11', '0.3.9'].sort(compareVersionsDesc)).toEqual([
			'0.4.0',
			'0.4.0-beta.11',
			'0.4.0-beta.2',
			'0.3.9'
		]);
		expect(resolveVersion(registry, 'latest')).toBe(WEBSITE_CORE_VERSION);
		expect(resolveVersion(registry, '0.2.1')).toBe('0.2.1');
		expect(resolveVersion(registry, '9.9.9')).toBeUndefined();
	});

	test('seeds the generated snapshot as published and a local build as unconfirmed', () => {
		/* The snapshot records what npm reported when it was generated, so its
		 * entries seed as published; an engine it never saw is a local build. */
		const snapshot = [
			{ version: '0.3.8', publishedAt: '2026-07-26T04:14:29.344Z', unpackedSize: 339_502 },
			{ version: '0.2.1', publishedAt: '2026-07-17T00:00:00.000Z' }
		];
		expect(_seedReleases(snapshot, '0.3.8').map((r) => [r.version, r.released])).toEqual([
			['0.3.8', true],
			['0.2.1', true]
		]);
		const withLocalBuild = _seedReleases(snapshot, '0.4.0');
		expect(withLocalBuild.map((r) => [r.version, r.released])).toEqual([
			['0.4.0', false],
			['0.3.8', true],
			['0.2.1', true]
		]);
		expect(withLocalBuild[1]).toMatchObject({ unpackedSize: 339_502 });
	});

	test('takes npm latest from the dist-tag rather than an unpublished local candidate', () => {
		const live = _buildRegistry(
			{
				'dist-tags': { latest: '0.3.8' },
				versions: {
					'0.3.8': {
						dist: { unpackedSize: 290_000, fileCount: 24 },
						gitHead: '0123456789abcdef'
					}
				},
				time: { '0.3.8': '2026-07-20T00:00:00.000Z' }
			},
			[]
		);
		expect(live?.latest).toBe('0.3.8');
		expect(live?.releases.find((release) => release.version === '0.3.8')).toMatchObject({
			released: true,
			gitHead: '0123456789ab'
		});
		expect(
			live?.releases.find((release) => release.version === WEBSITE_CORE_VERSION)
		).toMatchObject({ released: false });
	});

	test('serves the cold registry seed immediately and refreshes npm and GitHub in parallel', async () => {
		const pending: ((value: unknown) => void)[] = [];
		const fetcher = vi.fn(
			() =>
				new Promise<unknown>((resolveRequest) => {
					pending.push(resolveRequest);
				})
		);
		const store = _createRegistryStore(fetcher, () => 1_000_000);

		const cold = store.read();
		expect(cold.live).toBe(false);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(pending).toHaveLength(2);
		/* A second reader shares the same in-flight refresh. */
		expect(store.read()).toBe(cold);
		expect(fetcher).toHaveBeenCalledTimes(2);

		pending[0]!({
			'dist-tags': { latest: '0.3.8' },
			versions: { '0.3.8': { dist: { unpackedSize: 290_000, fileCount: 24 } } },
			time: { '0.3.8': '2026-07-20T00:00:00.000Z' }
		});
		pending[1]!([]);

		await vi.waitFor(() => {
			expect(store.read()).toMatchObject({ live: true, latest: '0.3.8' });
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	test('resolves release line aliases to a concrete release for playground/simulations', () => {
		/* A docs line alias must navigate to the real engine build, not 404. */
		const line = WEBSITE_CORE_VERSION.split('.').slice(0, 2).join('.'); // e.g. 0.3
		const major = WEBSITE_CORE_VERSION.split('.')[0]!; // e.g. 0
		expect(resolveReleaseVersion(registry, line)).toBe(WEBSITE_CORE_VERSION);
		expect(resolveReleaseVersion(registry, major)).toBe(WEBSITE_CORE_VERSION);
		expect(resolveReleaseVersion(registry, 'latest')).toBe(WEBSITE_CORE_VERSION);
		expect(resolveReleaseVersion(registry, WEBSITE_CORE_VERSION)).toBe(WEBSITE_CORE_VERSION);
		expect(resolveReleaseVersion(registry, '0.2.1')).toBe('0.2.1');
		expect(resolveReleaseVersion(registry, '0.2')).toBe('0.2.1');
		expect(resolveReleaseVersion(registry, '9.9')).toBeUndefined();
		expect(resolveReleaseVersion(registry, 'nope')).toBeUndefined();
	});

	test('keeps complete, distinct current and historical line corpora', () => {
		const current = docManifest(LATEST_DOCUMENTED_VERSION);
		const historical = docManifest('0.2');
		/* The current line must still document everything the historical line
		   did; it may document more, because a release can add an API the older
		   line never had (0.3.4 added the netlist). */
		const currentSlugs = current.map(({ slug }) => slug);
		for (const { slug } of historical) expect(currentSlugs).toContain(slug);
		expect(new Set(currentSlugs).size).toBe(current.length);
		/* 14 since 0.5, which added the placement chapter. */
		expect(current).toHaveLength(14);
		expect(currentSlugs).toContain('placement');

		for (const version of DOCUMENTATION_VERSIONS) {
			for (const page of docManifest(version)) {
				let doc: ReturnType<typeof loadDoc>;
				try {
					doc = loadDoc(version, page.slug);
				} catch (failure) {
					const message = failure instanceof Error ? failure.message : String(failure);
					throw new Error(`${version}/${page.slug}: ${message}`, { cause: failure });
				}
				expect(doc, `${version}/${page.slug}`).toBeDefined();
				expect(doc?.html).toContain('<h2');
				for (const example of doc?.examples ?? []) {
					expect(example.svg).toContain('<svg');
					expect(example.svg).not.toMatch(/NaN|Infinity/);
					expect(example.sourceHtml.length).toBeGreaterThan(0);
				}
			}
		}

		const currentOverview = loadDoc(LATEST_DOCUMENTED_VERSION, 'overview');
		const historicalOverview = loadDoc('0.2', 'overview');
		expect(
			currentOverview?.examples.some(({ source }) => source.includes('orientation=down'))
		).toBe(true);
		expect(historicalOverview?.examples.some(({ source }) => source.includes('orientation='))).toBe(
			false
		);
	});

	test('pins the complete 0.4 corpus, all 33 compiled fences, and every internal link', () => {
		const line = '0.4';
		const manifest = docManifest(line);
		const sources = versionedRawSources(line);
		expect(sources).toBeDefined();
		expect(manifest).toHaveLength(13);

		let fenceCount = 0;
		for (const page of manifest) {
			const doc = loadDoc(line, page.slug);
			expect(doc, `${line}/${page.slug}`).toBeDefined();
			fenceCount += doc?.examples.length ?? 0;
		}
		expect(fenceCount).toBe(33);

		const searchableLinks = new Set(docSearchIndex(line).map(({ href }) => href));
		const routeLinks = new Set(['/playground/0.4.0', '/changelog']);
		for (const [path, raw] of Object.entries(sources!)) {
			const slug = path.split('/').pop()!.replace(/\.md$/, '');
			expect(raw, path).toContain(`schemd-doc: id=${slug};`);
			for (const match of raw.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)) {
				const href = match[1]!;
				if (href.startsWith(`/docs/${line}/`)) {
					expect(searchableLinks.has(href), `${path}: broken documentation link ${href}`).toBe(
						true
					);
				} else {
					expect(routeLinks.has(href), `${path}: unverified internal route ${href}`).toBe(true);
				}
			}
		}

		const netlistDoc = loadDoc(line, 'netlist')!;
		const supply = netlistDoc.examples.find(({ source }) => source.includes('source:V1'))!;
		const compiled = compileSchematic(supply.source, {
			bounds: { width: 900, height: 400 },
			title: 'Supply, resistor, and return'
		});
		expect(inspectSchematic(compiled.document).netlist.nets).toHaveLength(2);
		expect(Object.values(sources!).find((raw) => raw.includes('id=netlist;'))).toContain(
			'netlist.nets.length; // 2'
		);
	});

	test('indexes current sections with line-preserving command links', () => {
		const entries = docSearchIndex(LATEST_DOCUMENTED_VERSION);
		expect(
			entries.some(({ href }) => href === `/docs/${LATEST_DOCUMENTED_VERSION}/component-reference`)
		).toBe(true);
		expect(entries.some(({ title }) => title.includes('Sources, connectivity'))).toBe(true);
		expect(
			entries.every(({ href }) => href.startsWith(`/docs/${LATEST_DOCUMENTED_VERSION}/`))
		).toBe(true);
	});

	test('builds the gallery exclusively from compiled current documentation', () => {
		const items = loadGallery();
		expect(items.length).toBeGreaterThan(10);
		expect(new Set(items.map(({ id }) => id)).size).toBe(items.length);
		for (const item of items) {
			expect(item.svg).toContain('<svg');
			expect(decodeWorkspaceState(item.code)).toBe(item.source);
			/* Every gallery item carries its authored bounds so it opens as drawn. */
			expect(item.width).toBeGreaterThanOrEqual(64);
			expect(item.height).toBeGreaterThanOrEqual(64);
		}
		const cnot = items.find(({ source }) => source.includes('cnot:CX'));
		expect(cnot?.source).toContain('CX.in1');
		expect(cnot?.source).toContain('CX.in2');
		expect(cnot?.source).toContain('CX.out1');
		expect(cnot?.source).toContain('CX.out2');
	});
});

describe('dynamic line-based versioning', () => {
	test('discovers documented lines newest-first with the latest as default', () => {
		expect(DOCUMENTED_VERSIONS.length).toBeGreaterThanOrEqual(2);
		expect(LATEST_DOCUMENTED_VERSION).toBe(DOCUMENTED_VERSIONS[0]);
		/* The installed engine release always belongs to the latest documented line. */
		expect(WEBSITE_CORE_VERSION.startsWith(`${LATEST_DOCUMENTED_VERSION}.`)).toBe(true);
		const sorted = [...DOCUMENTED_VERSIONS].sort(compareVersionsDesc);
		expect(DOCUMENTED_VERSIONS).toEqual(sorted);
	});

	test('snaps every requested version onto a documented line', () => {
		expect(resolveDocVersion('latest')).toBe(LATEST_DOCUMENTED_VERSION);
		expect(resolveDocVersion(LATEST_DOCUMENTED_VERSION)).toBe(LATEST_DOCUMENTED_VERSION);
		/* Patches resolve to their line; undocumented releases snap to the range. */
		expect(resolveDocVersion(WEBSITE_CORE_VERSION)).toBe(LATEST_DOCUMENTED_VERSION);
		expect(resolveDocVersion('0.2.1')).toBe('0.2');
		expect(resolveDocVersion('0.1.0')).toBe('0.2');
		expect(resolveDocVersion('9.9.9')).toBe(LATEST_DOCUMENTED_VERSION);
		expect(resolveDocVersion('not-a-version')).toBeUndefined();
		/* Every documented line resolves to itself with a complete manifest. */
		for (const line of DOCUMENTED_VERSIONS) {
			expect(resolveDocVersion(line)).toBe(line);
			expect(docManifest(line).length).toBeGreaterThan(0);
		}
	});
});

describe('language coverage is a genuine 100%', () => {
	test('every compiler primitive has a canonical, compiling catalog example', () => {
		expect(COMPONENT_CATALOG).toHaveLength(COMPONENT_KINDS.length);
		expect(new Set(COMPONENT_CATALOG.map((entry) => entry.kind)).size).toBe(COMPONENT_KINDS.length);
		for (const entry of COMPONENT_CATALOG) {
			const fence = parseSchematicFence(
				`schemd bounds="${entry.width}x${entry.height}" title="${entry.kind}"`
			);
			expect(fence, entry.kind).not.toBeNull();
			expect(
				() =>
					compileSchematic(entry.source, {
						...fence!,
						mode: 'default',
						idPrefix: `cat-${entry.kind}`
					}),
				entry.kind
			).not.toThrow();
			expect(decodeWorkspaceState(entry.code)).toBe(entry.source);
		}
	});

	test('coverage report exercises 100% of the exported vocabulary', () => {
		const coverage = languageCoverage();
		expect(coverage.total).toBe(COMPONENT_KINDS.length);
		expect(coverage.covered).toBe(coverage.total);
		/* Every kind shown in a group is covered and openable. */
		const shown = coverage.groups.flatMap((group) => group.kinds);
		expect(shown).toHaveLength(COMPONENT_KINDS.length);
		for (const kind of shown) {
			expect(kind.count, kind.kind).toBeGreaterThan(0);
			expect(kind.code.length, kind.kind).toBeGreaterThan(0);
		}
	});
});

describe('versioned simulation source and compilation', () => {
	test('opens the canonical playground sample as a valid full-mode schematic', () => {
		const result = compileSchematic(_PLAYGROUND_SAMPLE, {
			bounds: { width: 760, height: 440 },
			title: 'Workspace schematic',
			mode: 'full',
			idPrefix: 'playground-test'
		});
		expect(result.svg).toContain('data-node-id="C1"');
		expect(result.svg).toContain('data-orientation="down"');
	});

	test('uses the native first-order RC topology with no probe/junction workaround', () => {
		expect(RC_SOURCE).toContain('source:VIN');
		expect(RC_SOURCE).toContain('junction:VOUT');
		expect(RC_SOURCE).toContain('port:OUT');
		expect(RC_SOURCE).toContain('capacitor:C1');
		expect(RC_SOURCE).toContain('orientation=down');
		expect(RC_SOURCE).not.toContain('testpoint:');
		expect(RC_SOURCE).not.toContain('RETURN_NODE');
		expect(RC_SOURCE).not.toContain('initial:');
	});

	test('compiles all thirteen laboratories once with full semantic hooks', () => {
		const environments = listSimulationEnvironments();
		expect(environments).toHaveLength(13);
		for (const environment of environments) {
			expect(getSimulationSource(environment.id)).toBeDefined();
			expect(environment.formulaHtml).toContain('katex');
			expect(environment.formulaHtml).not.toContain('katex-error');
			/* Every environment carries a rendered, error-free "aha" teaching layer. */
			expect(environment.pedagogy.aha.length).toBeGreaterThan(0);
			expect(environment.pedagogy.ahaHtml).not.toContain('katex-error');
			expect(environment.pedagogy.principleHtml).toContain('katex');
			expect(environment.pedagogy.principleHtml).not.toContain('katex-error');
			expect(environment.pedagogy.steps.length).toBeGreaterThanOrEqual(3);
			for (const step of environment.pedagogy.steps) {
				expect(step.labelHtml).not.toContain('$');
				expect(step.detailHtml).not.toContain('$');
				expect(step.detailHtml).not.toContain('katex-error');
			}
			const simulation = getSimulation(environment.id);
			expect(simulation).toBeDefined();
			expect(simulation?.components).toBeGreaterThan(0);
			expect(simulation?.connections).toBeGreaterThan(0);
			const wireSources = new Set(
				[...(simulation?.svg.matchAll(/data-wire-source="([^"]+)"/g) ?? [])].map(
					(match) => match[1]!
				)
			);
			const nodeIds = new Set(
				[...(simulation?.svg.matchAll(/data-node-id="([^"]+)"/g) ?? [])].map((match) => match[1]!)
			);
			for (const frame of timelineFor(environment.id)) {
				for (const node of [...frame.nodes, ...(frame.highNodes ?? [])]) {
					expect(nodeIds.has(node), `${environment.id}: missing timeline node ${node}`).toBe(true);
				}
				for (const source of [...frame.wires, ...(frame.highWires ?? [])]) {
					expect(
						wireSources.has(source),
						`${environment.id}: missing timeline wire ${source}`
					).toBe(true);
				}
			}
			expect(simulation?.svg).toContain('data-schematic');
			expect(simulation?.svg).toContain('data-node-id');
		}
		expect(getSimulation('missing')).toBeUndefined();
		expect(getSimulationSource('missing')).toBeUndefined();
	});
});
