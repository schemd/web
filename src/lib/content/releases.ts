export interface ReleaseRecord {
	readonly version: string;
	readonly date: string;
	readonly title: string;
	readonly summary: string;
	readonly documentationAvailable: boolean;
	readonly tagUrl: string;
}

export const RELEASES = Object.freeze([
	Object.freeze({
		version: 'v0.2.1',
		date: '2026-07-17',
		title: 'Current stable compiler',
		summary:
			'Published the current package build with the documented circuit, logic, quantum, IC, UML, routing, math-label, and bounded-output contracts.',
		documentationAvailable: true,
		tagUrl: 'https://github.com/schemd/core/releases/tag/v0.2.1'
	}),
	Object.freeze({
		version: 'v0.2.0',
		date: '2026-07-17',
		title: 'Markdown boundary removed',
		summary:
			'Removed the Marked peer dependency so the compiler remains independent of a host Markdown implementation.',
		documentationAvailable: false,
		tagUrl: 'https://github.com/schemd/core/releases/tag/v0.2.0'
	}),
	Object.freeze({
		version: 'v0.1.2',
		date: '2026-07-16',
		title: 'Parser and math fixes',
		summary:
			'Recorded fixes across line rendering, math labels, and the former Markdown integration.',
		documentationAvailable: false,
		tagUrl: 'https://github.com/schemd/core/releases/tag/v0.1.2'
	}),
	Object.freeze({
		version: 'v0.1.1',
		date: '2026-07-16',
		title: 'Early Schemd package update',
		summary: 'An early package release after the project adopted the @schemd/core name.',
		documentationAvailable: false,
		tagUrl: 'https://github.com/schemd/core/releases/tag/v0.1.1'
	}),
	Object.freeze({
		version: 'v0.1.0',
		date: '2026-07-16',
		title: 'Package rename baseline',
		summary: 'Established @schemd/core as the public package identity.',
		documentationAvailable: false,
		tagUrl: 'https://github.com/schemd/core/releases/tag/v0.1.0'
	})
] as const satisfies readonly ReleaseRecord[]);
