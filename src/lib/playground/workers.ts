import type { VersionId } from '$lib/versioning/manifest';

export async function createVersionWorker(version: VersionId): Promise<Worker> {
	switch (version) {
		case 'v0.2.1': {
			const module = await import('./workers/v0.2.1.worker?worker');
			return new module.default();
		}
	}
}
