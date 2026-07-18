import { compileVersion } from '../compilers/v0.2.1';
import { isCompilerWorkerRequest, type CompilerWorkerResponse } from '../protocol';

function post(response: CompilerWorkerResponse): void {
	globalThis.postMessage(response);
}

globalThis.addEventListener('message', (event: MessageEvent<unknown>) => {
	const request = event.data;
	if (!isCompilerWorkerRequest(request)) return;
	const result = compileVersion(request.source, request.fence);
	post(result.ok
		? { kind: 'success', id: request.id, svg: result.svg, metrics: result.metrics }
		: { kind: 'error', id: request.id, diagnostic: result.diagnostic });
});

post({ kind: 'ready' });
