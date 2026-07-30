/**
 * The compiler, made visible.
 *
 * The landing page has always carried a Tokenize → Validate → Route → Emit
 * strip, and it has always been decoration: it *describes* the pipeline. This
 * route runs it on the visitor's own document and shows each stage's actual
 * output, which is a different claim — the site stops asserting that there is
 * real engineering here and starts displaying it.
 *
 * Compilation is server-side, like `/api/compile`, and for the same reason: this
 * is the deployment's one real engine, and every stage below must describe the
 * same compilation rather than a browser re-run that might disagree. The whole
 * page is therefore a function of `(version, source)`, which also makes it
 * shareable — an inspector URL is a citable bug report.
 */
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion, WEBSITE_CORE_VERSION } from '$lib/server/registry';
import {
	buildNetlist,
	compileSchematic,
	SCHEMATIC_CONGESTION_CELL_SIZE,
	SCHEMATIC_RULES,
	SchematicSyntaxError,
	verifyNetlist,
	type SchematicDiagnostic
} from '@schemd/core';
import { describeNetlist } from '@schemd/core/describe';
import { HOST_COMPILER_LIMITS } from '$lib/compile-contract';
import { decodeWorkspaceState } from '$lib/state-uri';
import { tokenizeLine, type SchemdTokenLine } from '$lib/tokenizer';
import { RELATIVE_PLACEMENT_SOURCE } from '$lib/diagrams';

/** Fence the inspector compiles against; wide enough for the sample to breathe. */
const INSPECTOR_BOUNDS = { width: 900, height: 520 } as const;

/** One node of the AST tree the Parse stage renders. */
interface AstNode {
	readonly line: number;
	readonly kind: string;
	readonly id: string;
	readonly summary: string;
	readonly fields: readonly { readonly name: string; readonly value: string }[];
}

/** Describe one component or connection without leaking the whole AST to the client. */
function astFields(record: Record<string, unknown>): AstNode['fields'] {
	const fields: { name: string; value: string }[] = [];
	for (const [name, value] of Object.entries(record)) {
		if (value === undefined || name === 'line') continue;
		if (typeof value === 'object' && value !== null) {
			fields.push({ name, value: JSON.stringify(value) });
			continue;
		}
		fields.push({ name, value: String(value) });
	}
	return fields;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No inspector release named ${params.version}.`);
	}
	if (params.version !== version) {
		redirect(307, `/inspector/${version}${url.search}`);
	}

	const shared = url.searchParams.get('code');
	const decoded = shared === null ? undefined : decodeWorkspaceState(shared);
	const source = decoded ?? RELATIVE_PLACEMENT_SOURCE;

	/* Stage 1 runs whether or not the document compiles: a lexer view of a
	   document the parser rejects is exactly when it is most useful. */
	const lex: readonly SchemdTokenLine[] = source.split('\n').map((line) => tokenizeLine(line));

	const base = {
		version,
		latest: registry.latest,
		engineVersion: WEBSITE_CORE_VERSION,
		source,
		bounds: INSPECTOR_BOUNDS,
		congestionCell: SCHEMATIC_CONGESTION_CELL_SIZE,
		lex
	};

	try {
		const compilation = compileSchematic(source, {
			bounds: { ...INSPECTOR_BOUNDS },
			title: 'Inspector document',
			mode: 'full',
			semanticHooks: ['nodes', 'ports', 'wires'],
			limits: HOST_COMPILER_LIMITS
		});

		const ast: AstNode[] = [
			...compilation.document.components.map((component) => ({
				line: component.line,
				kind: component.kind,
				id: component.id,
				summary: `${component.kind}:${component.id}`,
				fields: astFields(component as unknown as Record<string, unknown>)
			})),
			...compilation.document.connections.map((connection) => ({
				line: connection.line,
				kind: connection.curve,
				id: `${connection.from.componentId}.${connection.from.port} -> ${connection.to.componentId}.${connection.to.port}`,
				summary: `${connection.curve} trace`,
				fields: astFields(connection as unknown as Record<string, unknown>)
			}))
		].sort((left, right) => left.line - right.line);

		const netlist = buildNetlist(compilation.document);
		const diagnostics: readonly SchematicDiagnostic[] = verifyNetlist(netlist);
		const description = describeNetlist(netlist);

		/* Trace vertices come from the emitted `full`-mode markup rather than from a
		   second routing pass: re-routing here could disagree with what was drawn,
		   and the point of this page is to show what actually happened. */
		const traces = [...compilation.svg.matchAll(/data-wire-source="([^"]+)"[^>]*d="([^"]+)"/g)].map(
			(match) => ({ endpoint: match[1]!, d: match[2]! })
		);

		return {
			...base,
			ok: true as const,
			svg: compilation.svg,
			metrics: compilation.metrics,
			sourceMap: compilation.sourceMap,
			placements: compilation.placements,
			routing: compilation.routing,
			ast,
			traces,
			netlist: {
				nodes: netlist.nodes.length,
				nets: netlist.nets.map((net) => ({
					id: net.id,
					name: net.name ?? null,
					lines: net.lines,
					terminals: net.terminals.map((terminal) => `${terminal.componentId}.${terminal.port}`)
				})),
				edges: netlist.edges.length
			},
			rules: Object.entries(SCHEMATIC_RULES).map(([code, rule]) => ({
				code,
				severity: rule.severity,
				summary: rule.summary,
				fired: diagnostics.filter((diagnostic) => diagnostic.code === code).length
			})),
			diagnostics: diagnostics.map((diagnostic) => ({
				code: diagnostic.code,
				severity: diagnostic.severity,
				message: diagnostic.message
			})),
			description: {
				headline: description.headline,
				inventory: description.inventory,
				connections: description.connections,
				counts: description.counts
			}
		};
	} catch (thrown) {
		/*
		 * A rejected document is not an error page. The lexer stage already has
		 * something to show, and the diagnostic — with its line — is the single most
		 * useful thing the inspector can display, so it is returned as data.
		 */
		const failure =
			thrown instanceof SchematicSyntaxError
				? { message: thrown.message, line: thrown.line }
				: { message: 'The compiler failed in a way it does not have a diagnostic for.' };
		return { ...base, ok: false as const, failure };
	}
};
