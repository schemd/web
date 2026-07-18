/** Generated from schemd/core commit 29c7769 on 2026-07-18. */
export const CORE_METRICS = Object.freeze({
	packageVersion: '0.2.1',
	sourceCommit: '29c7769',
	compilerBundle: Object.freeze({ minifiedBytes: 59_039, gzipBytes: 18_081 }),
	npmTarballBytes: 42_878,
	coverage: Object.freeze({ statements: 100, branches: 100, functions: 100, lines: 100 }),
	testCount: 79,
	limits: Object.freeze({
		sourceCharacters: 131_072,
		components: 512,
		connections: 2_048,
		wireCrossings: 32_768,
		svgOutputBytes: 2_097_152
	})
});

export function formatBytes(bytes: number): string {
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(bytes / 1_000) + ' kB';
}
