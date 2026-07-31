/**
 * The one definition of a compile request.
 *
 * A diagram can be compiled in the browser (`compile-client.ts`) or on the
 * server (`/api/compile`), and a shared link must produce the same bytes either
 * way. That guarantee used to rest on a comment asking the next reader to keep
 * two copies of the same interfaces and the same validation "field for field" —
 * and the copies had already drifted in style, one using named ceilings and the
 * other bare literals in the middle of a condition.
 *
 * Both callers now normalize through `normalizeCompileRequest`, so the promise
 * is structural rather than clerical.
 *
 * Nothing here imports `@schemd/core` at runtime. The compiler is a lazily
 * loaded chunk that the build budget asserts stays dynamic, and a value import
 * in a module the playground loads eagerly would pull it into the entry. The
 * output modes are therefore declared locally and checked against the
 * compiler's own union at type level, which costs nothing at runtime and still
 * fails the build if upstream adds a mode.
 */
import type {
	SchematicCompilation,
	SchemdOutputMode,
	SchematicLimitOptions,
	SchematicSourceMap
} from '@schemd/core';

/** Ceilings the compiler enforces, applied before it is ever reached. */
export const COMPILE_LIMITS = {
	maxSourceCharacters: 131_072,
	minDimension: 64,
	maxDimension: 4096,
	maxTitleCharacters: 512,
	/** JSON escaping can nearly double a valid source payload in transport. */
	maxRequestBytes: 280 * 1024
} as const;

/**
 * Host budgets for source the public playground did not write.
 *
 * Core 0.4 intentionally defaults component and connection counts to
 * unlimited. That is appropriate for a trusted CLI and reckless for a public
 * endpoint. These limits still allow diagrams far beyond a readable browser
 * canvas while bounding parser, routing, crossing, and response amplification.
 */
export const HOST_COMPILER_LIMITS = {
	components: 1_024,
	connections: 4_096,
	sourceCharacters: COMPILE_LIMITS.maxSourceCharacters,
	wireCrossings: 4_096,
	svgOutputBytes: 2 * 1024 * 1024
} as const satisfies SchematicLimitOptions;

/** Title used when a request omits one or supplies only quotes and spaces. */
export const DEFAULT_COMPILE_TITLE = 'Playground schematic';

/**
 * Output modes, mirrored from the compiler.
 *
 * `satisfies Record<SchemdOutputMode, true>` fails the build in both
 * directions: a mode the compiler adds is a missing key, and a mode it drops is
 * an excess one. The check is erased at runtime.
 */
const OUTPUT_MODES = {
	default: true,
	'embedded-css': true,
	full: true
} as const satisfies Record<SchemdOutputMode, true>;

export const COMPILE_OUTPUT_MODES = Object.keys(OUTPUT_MODES) as readonly SchemdOutputMode[];

export interface CompileRequest {
	readonly source: string;
	readonly width: number;
	readonly height: number;
	readonly title: string;
	readonly mode: SchemdOutputMode;
}

export interface CompileSuccess {
	readonly ok: true;
	readonly svg: string;
	readonly metrics: {
		readonly sourceCharacters: number;
		readonly components: number;
		readonly connections: number;
		readonly svgBytes: number;
	};
	readonly sourceMap: SchematicSourceMap;
	/** What each relative declaration resolved to; empty without relations. */
	readonly placements: SchematicCompilation['placements'];
	readonly ms: number;
}

export interface CompileFailure {
	readonly ok: false;
	readonly message: string;
	readonly line: number | undefined;
}

export type CompileOutcome = CompileSuccess | CompileFailure;

/** Message both surfaces return for a request that fails validation. */
export const MALFORMED_COMPILE_REQUEST: CompileFailure = {
	ok: false,
	message: 'Malformed compile request.',
	line: undefined
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Whether a value is one of the compiler's output modes. */
export function isCompileOutputMode(value: unknown): value is SchemdOutputMode {
	return typeof value === 'string' && Object.hasOwn(OUTPUT_MODES, value);
}

/**
 * Validate and canonicalize an untrusted compile request.
 *
 * Accepts `unknown` so the endpoint can hand it parsed JSON and the browser can
 * hand it a typed object, and both get the identical answer.
 *
 * @returns the canonical request, or `undefined` when it must be rejected.
 */
export function normalizeCompileRequest(body: unknown): CompileRequest | undefined {
	if (!isRecord(body)) return undefined;
	const { source, width, height, title, mode } = body;
	if (typeof source !== 'string' || source.length > COMPILE_LIMITS.maxSourceCharacters) {
		return undefined;
	}
	if (typeof width !== 'number' || typeof height !== 'number') return undefined;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
	if (width < COMPILE_LIMITS.minDimension || width > COMPILE_LIMITS.maxDimension) return undefined;
	if (height < COMPILE_LIMITS.minDimension || height > COMPILE_LIMITS.maxDimension) {
		return undefined;
	}
	if (typeof title !== 'string' || title.length > COMPILE_LIMITS.maxTitleCharacters) {
		return undefined;
	}
	if (!isCompileOutputMode(mode)) return undefined;
	return {
		source,
		width: Math.trunc(width),
		height: Math.trunc(height),
		title: title.replace(/"/g, '').trim() || DEFAULT_COMPILE_TITLE,
		mode
	};
}
