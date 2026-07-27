import { COMPILE_LIMITS, isCompileOutputMode, type CompileRequest } from '$lib/compile-contract';

/** Prefix only; each tab/version receives a separate recovery slot. */
export const PLAYGROUND_DRAFT_KEY = 'schemd.playground.draft.v2';
export const PLAYGROUND_DRAFT_SESSION_KEY = 'schemd.playground.workspace.v1';
export const PLAYGROUND_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const WORKSPACE_ID = /^[A-Za-z0-9_-]{8,80}$/;

export interface PlaygroundDraft extends CompileRequest {
	readonly schema: 1;
	readonly savedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isPlaygroundWorkspaceId(value: unknown): value is string {
	return typeof value === 'string' && WORKSPACE_ID.test(value);
}

/** One recoverable workspace per browser tab and compiler version. */
export function playgroundDraftKey(version: string, workspaceId: string): string | undefined {
	if (!/^\d+\.\d+(?:\.\d+)?$/.test(version) || !isPlaygroundWorkspaceId(workspaceId)) {
		return undefined;
	}
	return `${PLAYGROUND_DRAFT_KEY}:${version}:${workspaceId}`;
}

/** Serialize only the fields required to recover a workspace after a crash. */
export function serializePlaygroundDraft(workspace: CompileRequest, savedAt = Date.now()): string {
	const draft: PlaygroundDraft = { schema: 1, savedAt, ...workspace };
	return JSON.stringify(draft);
}

/**
 * Parse a local draft without trusting localStorage.
 *
 * Drafts can outlive application versions and browser extensions can mutate
 * storage, so recovery receives the same size and shape scrutiny as a request.
 */
export function parsePlaygroundDraft(
	raw: string | null,
	now = Date.now(),
	maxAgeMs = PLAYGROUND_DRAFT_MAX_AGE_MS
): PlaygroundDraft | undefined {
	if (raw === null || raw.length > COMPILE_LIMITS.maxRequestBytes) return undefined;
	try {
		const value: unknown = JSON.parse(raw);
		if (!isRecord(value) || value['schema'] !== 1) return undefined;
		const savedAt = value['savedAt'];
		if (
			typeof savedAt !== 'number' ||
			!Number.isFinite(savedAt) ||
			savedAt > now + 60_000 ||
			now - savedAt > maxAgeMs
		) {
			return undefined;
		}
		const source = value['source'];
		const width = value['width'];
		const height = value['height'];
		const title = value['title'];
		const mode = value['mode'];
		if (
			typeof source !== 'string' ||
			source.length > COMPILE_LIMITS.maxSourceCharacters ||
			typeof width !== 'number' ||
			!Number.isInteger(width) ||
			width < COMPILE_LIMITS.minDimension ||
			width > COMPILE_LIMITS.maxDimension ||
			typeof height !== 'number' ||
			!Number.isInteger(height) ||
			height < COMPILE_LIMITS.minDimension ||
			height > COMPILE_LIMITS.maxDimension ||
			typeof title !== 'string' ||
			title.length > COMPILE_LIMITS.maxTitleCharacters ||
			!isCompileOutputMode(mode)
		) {
			return undefined;
		}
		return { schema: 1, savedAt, source, width, height, title, mode };
	} catch {
		return undefined;
	}
}
