/**
 * Generated snapshot of schemd/core ROADMAP.md at commit 29c7769.
 * Edit the core roadmap, then regenerate this file; do not hand-edit roadmap copies.
 */
export type TimelineStatus = 'planned' | 'active' | 'blocked';
export type TimelinePhase = 'Now' | 'Next' | 'Later';

export interface TimelineItem {
	readonly id: string;
	readonly title: string;
	readonly priority: 'P1' | 'P2';
	readonly phase: TimelinePhase;
	readonly status: TimelineStatus;
	readonly scope: string;
	readonly expectedRelease: string | null;
	readonly issueUrl: string;
	readonly dependsOn: readonly string[];
}

const claimUrl = (id: string, title: string): string =>
	`https://github.com/schemd/core/issues/new?template=roadmap.yml&title=${encodeURIComponent(`[ROADMAP] ${id} — ${title}`)}`;

export const ROADMAP_SOURCE = Object.freeze({
	repository: 'https://github.com/schemd/core',
	commit: '29c7769',
	path: 'ROADMAP.md',
	generatedAt: '2026-07-18'
});

export const TIMELINE_ITEMS = Object.freeze([
	{
		id: 'P1-02', title: 'Net and junction semantics', priority: 'P1', phase: 'Now', status: 'planned',
		scope: 'Split explicit nets at junctions, render shared junctions once, and bridge only separate nets.', expectedRelease: null,
		issueUrl: claimUrl('P1-02', 'Net and junction semantics'), dependsOn: []
	},
	{
		id: 'P1-04', title: 'Document-level routing index', priority: 'P1', phase: 'Now', status: 'planned',
		scope: 'Reuse an interval index or visibility graph instead of rescanning every obstacle.', expectedRelease: null,
		issueUrl: claimUrl('P1-04', 'Document-level routing index'), dependsOn: ['P1-02']
	},
	{
		id: 'P1-03', title: 'Line and Bézier collision rules', priority: 'P1', phase: 'Now', status: 'planned',
		scope: 'Define opt-out behavior or validate straight and cubic paths against components and crossings.', expectedRelease: null,
		issueUrl: claimUrl('P1-03', 'Line and Bézier collision rules'), dependsOn: ['P1-02']
	},
	{
		id: 'P1-08', title: 'Component overlap validation', priority: 'P1', phase: 'Now', status: 'planned',
		scope: 'Reject accidental overlap in O(V log V) while permitting explicit semantic containers.', expectedRelease: null,
		issueUrl: claimUrl('P1-08', 'Component overlap validation'), dependsOn: []
	},
	{
		id: 'P1-05', title: 'Wire and label occupancy', priority: 'P1', phase: 'Next', status: 'planned',
		scope: 'Add soft route costs and route around unrelated external labels.', expectedRelease: null,
		issueUrl: claimUrl('P1-05', 'Wire and label occupancy'), dependsOn: ['P1-04']
	},
	{
		id: 'P1-06', title: 'Dense bridge clusters', priority: 'P1', phase: 'Next', status: 'planned',
		scope: 'Preserve tangent gaps, merge close crossings, or report a diagnostic.', expectedRelease: null,
		issueUrl: claimUrl('P1-06', 'Dense bridge clusters'), dependsOn: ['P1-02']
	},
	{
		id: 'P1-07', title: 'Background-independent UML markers', priority: 'P1', phase: 'Next', status: 'planned',
		scope: 'Trim paths and include transformed marker bounds in collision checks.', expectedRelease: null,
		issueUrl: claimUrl('P1-07', 'Background-independent UML markers'), dependsOn: []
	},
	{
		id: 'P1-09', title: 'Deterministic typography', priority: 'P1', phase: 'Next', status: 'planned',
		scope: 'Publish a font contract and wrap or reject overflowing UML rows clearly.', expectedRelease: null,
		issueUrl: claimUrl('P1-09', 'Deterministic typography'), dependsOn: []
	},
	{
		id: 'P1-10', title: 'Visual and adversarial test gates', priority: 'P1', phase: 'Next', status: 'planned',
		scope: 'Add browser goldens, route properties, bounded fuzzing, and mutation checks.', expectedRelease: null,
		issueUrl: claimUrl('P1-10', 'Visual and adversarial test gates'), dependsOn: []
	},
	{
		id: 'P1-01', title: 'Built-in symbol registry', priority: 'P1', phase: 'Later', status: 'planned',
		scope: 'Move parsing, ports, bounds, and primitives behind typed entries and publish a support matrix.', expectedRelease: null,
		issueUrl: claimUrl('P1-01', 'Built-in symbol registry'), dependsOn: []
	},
	{
		id: 'P2-01', title: 'Serializer byte result', priority: 'P2', phase: 'Later', status: 'planned',
		scope: 'Reuse one internal SVG-and-byte result and benchmark memory at the 2 MiB ceiling.', expectedRelease: null,
		issueUrl: claimUrl('P2-01', 'Serializer byte result'), dependsOn: []
	},
	{
		id: 'P2-02', title: 'Incremental document IDs', priority: 'P2', phase: 'Later', status: 'planned',
		scope: 'Avoid full JSON signature allocation and document unique prefixes for repeated diagrams.', expectedRelease: null,
		issueUrl: claimUrl('P2-02', 'Incremental document IDs'), dependsOn: []
	},
	{
		id: 'P2-03', title: 'Grammar delimiter escapes', priority: 'P2', phase: 'Later', status: 'planned',
		scope: 'Support bounded backslash, quote, and semicolon escapes in the lexer.', expectedRelease: null,
		issueUrl: claimUrl('P2-03', 'Grammar delimiter escapes'), dependsOn: []
	},
	{
		id: 'P2-04', title: 'Shared external styling', priority: 'P2', phase: 'Later', status: 'planned',
		scope: 'Let controlled hosts reuse one style asset while preserving self-contained output.', expectedRelease: null,
		issueUrl: claimUrl('P2-04', 'Shared external styling'), dependsOn: []
	}
] as const satisfies readonly TimelineItem[]);
