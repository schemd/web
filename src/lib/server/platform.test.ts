import { describe, expect, test } from 'vitest';
import { compileSchematic } from '@schemd/core';
import { decodeWorkspaceState } from '$lib/state-uri';
import { _compileHeroes } from '../../routes/+page.server';
import { _PLAYGROUND_SAMPLE } from '../../routes/playground/[version]/+page.server';
import { docManifest, docSearchIndex, loadDoc } from './docs';
import { loadGallery } from './gallery';
import {
	compareVersionsDesc,
	DOCUMENTATION_VERSIONS,
	resolveVersion,
	WEBSITE_CORE_VERSION,
	type SchemdRegistry
} from './registry';
import {
	getSimulation,
	getSimulationSource,
	listSimulationEnvironments,
	RC_SOURCE
} from './simulations';

const registry: SchemdRegistry = {
	releases: DOCUMENTATION_VERSIONS.map((version) => ({
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
	test('compiles every landing-page hero with strict geometry validation', () => {
		const heroes = _compileHeroes();
		expect(heroes).toHaveLength(4);
		for (const hero of heroes) expect(hero.svg).toContain('data-schematic');
	});

	test('sorts semver, resolves aliases, and rejects unknown releases', () => {
		expect(['0.2.1', '0.3.1', '0.2.9'].sort(compareVersionsDesc)).toEqual([
			'0.3.1',
			'0.2.9',
			'0.2.1'
		]);
		expect(resolveVersion(registry, 'latest')).toBe(WEBSITE_CORE_VERSION);
		expect(resolveVersion(registry, '0.2.1')).toBe('0.2.1');
		expect(resolveVersion(registry, '9.9.9')).toBeUndefined();
	});

	test('keeps complete, distinct current and historical 0.2.1 corpora', () => {
		const current = docManifest(WEBSITE_CORE_VERSION);
		const historical = docManifest('0.2.1');
		expect(current.map(({ slug }) => slug)).toEqual(historical.map(({ slug }) => slug));
		expect(current).toHaveLength(11);

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

		const currentOverview = loadDoc(WEBSITE_CORE_VERSION, 'overview');
		const historicalOverview = loadDoc('0.2.1', 'overview');
		expect(
			currentOverview?.examples.some(({ source }) => source.includes('orientation=down'))
		).toBe(true);
		expect(historicalOverview?.examples.some(({ source }) => source.includes('orientation='))).toBe(
			false
		);
	});

	test('indexes current sections with version-preserving command links', () => {
		const entries = docSearchIndex(WEBSITE_CORE_VERSION);
		expect(
			entries.some(({ href }) => href === `/docs/${WEBSITE_CORE_VERSION}/component-reference`)
		).toBe(true);
		expect(entries.some(({ title }) => title.includes('Sources, connectivity'))).toBe(true);
		expect(entries.every(({ href }) => href.startsWith(`/docs/${WEBSITE_CORE_VERSION}/`))).toBe(
			true
		);
	});

	test('builds the gallery exclusively from compiled current documentation', () => {
		const items = loadGallery();
		expect(items.length).toBeGreaterThan(10);
		expect(new Set(items.map(({ id }) => id)).size).toBe(items.length);
		for (const item of items) {
			expect(item.svg).toContain('<svg');
			expect(decodeWorkspaceState(item.code)).toBe(item.source);
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

	test('uses native 0.3 source, junction, testpoint, and rotated capacitor primitives', () => {
		expect(RC_SOURCE).toContain('source:VIN');
		expect(RC_SOURCE).toContain('junction:VOUT_NODE');
		expect(RC_SOURCE).toContain('testpoint:VOUT_PROBE');
		expect(RC_SOURCE).toContain('capacitor:C1');
		expect(RC_SOURCE).toContain('orientation=down');
		expect(RC_SOURCE).not.toContain('initial:');
	});

	test('compiles all five laboratories once with full semantic hooks', () => {
		const environments = listSimulationEnvironments();
		expect(environments).toHaveLength(5);
		for (const environment of environments) {
			expect(getSimulationSource(environment.id)).toBeDefined();
			const simulation = getSimulation(environment.id);
			expect(simulation).toBeDefined();
			expect(simulation?.components).toBeGreaterThan(0);
			expect(simulation?.connections).toBeGreaterThan(0);
			expect(simulation?.svg).toContain('data-schematic');
			expect(simulation?.svg).toContain('data-node-id');
		}
		expect(getSimulation('missing')).toBeUndefined();
		expect(getSimulationSource('missing')).toBeUndefined();
	});
});
