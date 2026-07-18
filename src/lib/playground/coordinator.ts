import type { CompilerWorkerResponse } from './protocol';

export interface CompilationCoordinatorState {
	readonly latestRequestId: number;
	readonly latestSource: string;
}

export function createCoordinatorState(): CompilationCoordinatorState {
	return { latestRequestId: 0, latestSource: '' };
}

export function nextCompilation(
	state: CompilationCoordinatorState,
	source: string
): { readonly state: CompilationCoordinatorState; readonly requestId: number } | undefined {
	if (source === state.latestSource) return undefined;
	const requestId = state.latestRequestId + 1;
	return { state: { latestRequestId: requestId, latestSource: source }, requestId };
}

export function acceptsCompilation(
	state: CompilationCoordinatorState,
	response: CompilerWorkerResponse
): boolean {
	return response.kind !== 'ready' && response.id === state.latestRequestId;
}
