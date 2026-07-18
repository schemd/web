import { isVersionId, type VersionId } from '$lib/versioning/manifest';

export interface CompileRequest {
	readonly kind: 'compile';
	readonly id: number;
	readonly version: VersionId;
	readonly source: string;
	readonly fence: string;
}

export type CompilerWorkerRequest = CompileRequest;

export type CompilerWorkerResponse =
	| { readonly kind: 'ready' }
	| {
			readonly kind: 'success';
			readonly id: number;
			readonly svg: string;
			readonly metrics: {
				readonly sourceCharacters: number;
				readonly components: number;
				readonly connections: number;
				readonly svgBytes: number;
			};
	  }
	| {
			readonly kind: 'error';
			readonly id: number;
			readonly diagnostic: { readonly message: string; readonly line?: number };
	  };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null;
}

export function isCompilerWorkerRequest(value: unknown): value is CompilerWorkerRequest {
	return (
		isRecord(value) &&
		value.kind === 'compile' &&
		typeof value.id === 'number' &&
		typeof value.version === 'string' &&
		isVersionId(value.version) &&
		typeof value.source === 'string' &&
		typeof value.fence === 'string'
	);
}

export function isCompilerWorkerResponse(value: unknown): value is CompilerWorkerResponse {
	if (!isRecord(value) || typeof value.kind !== 'string') return false;
	if (value.kind === 'ready') return true;
	if ((value.kind !== 'success' && value.kind !== 'error') || typeof value.id !== 'number')
		return false;
	if (value.kind === 'success') {
		if (typeof value.svg !== 'string' || !isRecord(value.metrics)) return false;
		const metrics = value.metrics;
		return ['sourceCharacters', 'components', 'connections', 'svgBytes'].every(
			(key) => typeof metrics[key] === 'number'
		);
	}
	return (
		isRecord(value.diagnostic) &&
		typeof value.diagnostic.message === 'string' &&
		(value.diagnostic.line === undefined || typeof value.diagnostic.line === 'number')
	);
}
