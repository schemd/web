import type { SchemdOutputMode } from '@schemd/core';

export const PACKAGE_NAME = '@schemd/core';
export const SITE_NAME = 'schemd';
export const SITE_ORIGIN = 'https://schemd.johnowolabiidogun.dev';
export const CORE_REPOSITORY = 'https://github.com/schemd/core';
export const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@schemd/core';
export const CURRENT_VERSION = 'v0.2.1';
export const CURRENT_SEMVER = '0.2.1';

export interface PlatformVersion {
	readonly id: string;
	readonly version: string;
	readonly semver: string;
	readonly label: string;
	readonly releasedAt: string;
	readonly docsPath: string;
	readonly playgroundPath: string;
	readonly simulationsPath: string;
}

export const VERSIONS: readonly PlatformVersion[] = Object.freeze([
	Object.freeze({
		id: CURRENT_VERSION,
		version: CURRENT_VERSION,
		semver: CURRENT_SEMVER,
		label: `Core ${CURRENT_SEMVER}`,
		releasedAt: '2026-07-17',
		docsPath: `/docs/${CURRENT_VERSION}/overview`,
		playgroundPath: `/playground/${CURRENT_VERSION}`,
		simulationsPath: `/simulations/${CURRENT_VERSION}`
	})
]);

const VERSION_BY_ID = new Map<string, PlatformVersion>();
for (const version of VERSIONS) {
	VERSION_BY_ID.set(version.id, version);
	VERSION_BY_ID.set(version.semver, version);
}

export function resolveVersion(value: string): PlatformVersion | undefined {
	return VERSION_BY_ID.get(value);
}

export type VersionedArea = 'docs' | 'playground' | 'simulations';

export function versionPath(version: PlatformVersion, area: VersionedArea, slug?: string): string {
	const root =
		area === 'docs'
			? `/docs/${version.id}`
			: area === 'playground'
				? version.playgroundPath
				: version.simulationsPath;
	return slug === undefined || slug.length === 0 ? root : `${root}/${encodeURIComponent(slug)}`;
}

export const OUTPUT_MODES: readonly SchemdOutputMode[] = Object.freeze([
	'default',
	'embedded-css',
	'full'
]);

export interface SimulationRoute {
	readonly slug: string;
	readonly name: string;
	readonly discipline: string;
	readonly summary: string;
}

export const SIMULATION_ROUTES: readonly SimulationRoute[] = Object.freeze([
	Object.freeze({
		slug: 'digital-adder',
		name: '8-bit digital adder',
		discipline: 'Logic',
		summary: 'Toggle two binary registers and inspect carry propagation through the output bus.'
	}),
	Object.freeze({
		slug: 'rc-low-pass',
		name: 'Dynamic RC low-pass filter',
		discipline: 'Analog',
		summary: 'Sweep frequency, resistance, and capacitance against a derived transfer function.'
	}),
	Object.freeze({
		slug: 'bell-state',
		name: 'Bell-state entanglement',
		discipline: 'Quantum',
		summary: 'Inspect probability amplitudes and correlation after Hadamard and CNOT passes.'
	}),
	Object.freeze({
		slug: '555-astable',
		name: '555 astable multivibrator',
		discipline: 'Timing',
		summary: 'Track charge, discharge, duty cycle, and output frequency around an eight-pin timer.'
	}),
	Object.freeze({
		slug: 'quantum-teleportation',
		name: 'Quantum teleportation',
		discipline: 'Quantum',
		summary: 'Step a parameterized qubit through entanglement, measurement, and correction.'
	})
]);

export const DEFAULT_SCHEMATIC_SOURCE = `port:VIN "Sensor" at (60, 150) #blue
resistor:R1 "10 k\\Omega" at (245, 150) #amber
capacitor:C1 "100 nF" at (455, 150) #cyan
port:ADC "ADC" at (660, 150) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> ADC.in #emerald [line marker-end=arrow]`;

export interface PlatformSearchEntry {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly category: string;
	readonly path: string;
	readonly keywords: readonly string[];
}

export const PLATFORM_SEARCH_ENTRIES: readonly PlatformSearchEntry[] = Object.freeze([
	Object.freeze({
		id: 'platform-home',
		title: 'schemd compiler terminal',
		summary: 'Text-to-SVG architecture, installation, output budgets, and engineering workflow.',
		category: 'Platform',
		path: '/',
		keywords: Object.freeze(['home', 'install', 'compiler', 'skemd'])
	}),
	Object.freeze({
		id: 'platform-playground',
		title: 'Versioned playground',
		summary: 'Compile, inspect, and share schemd source in the zero-dependency workspace.',
		category: 'Workspace',
		path: `/playground/${CURRENT_VERSION}`,
		keywords: Object.freeze(['editor', 'svg', 'compiler', 'workspace'])
	}),
	Object.freeze({
		id: 'platform-simulations',
		title: 'Simulation laboratory',
		summary: 'Run digital, analog, timing, and quantum schematic experiments.',
		category: 'Laboratory',
		path: `/simulations/${CURRENT_VERSION}`,
		keywords: Object.freeze(['oscilloscope', 'probe', 'fault', 'laboratory'])
	}),
	Object.freeze({
		id: 'platform-changelog',
		title: 'Release changelog',
		summary: 'Registry-backed package history and native SVG compiler metrics.',
		category: 'Project',
		path: '/changelog',
		keywords: Object.freeze(['release', 'version', 'npm', 'github'])
	})
]);
