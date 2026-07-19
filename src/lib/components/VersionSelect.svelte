<script lang="ts">
	/**
	 * Global version dropdown. Selecting a release rewrites the `[version]`
	 * path parameter of the current route instantly; on unversioned routes it
	 * jumps to that release's documentation overview.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	interface Props {
		versions: readonly string[];
		latest: string;
	}

	let { versions, latest }: Props = $props();

	const current = $derived(page.params['version'] ?? latest);

	function pathFor(version: string): string {
		const parameter = page.params['version'];
		if (parameter !== undefined) {
			const { pathname } = page.url;
			const swapped = pathname.replace(`/${parameter}`, `/${version}`);
			return swapped === pathname && !pathname.includes(`/${version}`)
				? `/docs/${version}/overview`
				: swapped;
		}
		return `/docs/${version}/overview`;
	}

	function onChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		void goto(pathFor(event.currentTarget.value), { noScroll: false });
	}
</script>

<label class="version-select">
	<span class="microlabel">ver</span>
	<select value={current} onchange={onChange} aria-label="Documentation version">
		{#each versions as version (version)}
			<option value={version}>
				v{version}{version === latest ? ' · latest' : ''}
			</option>
		{/each}
	</select>
</label>

<style>
	.version-select {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);

		& select {
			appearance: none;
			font-family: var(--font-mono);
			font-size: var(--text-xs);
			color: var(--accent);
			background:
				linear-gradient(45deg, transparent 50%, var(--ink-faint) 50%) calc(100% - 12px) 55% / 5px
					5px no-repeat,
				linear-gradient(-45deg, transparent 50%, var(--ink-faint) 50%) calc(100% - 8px) 55% / 5px
					5px no-repeat,
				var(--bg-inset);
			border: 1px solid var(--line-strong);
			padding: 0.28rem 1.6rem 0.28rem 0.6rem;
			cursor: pointer;
			transition: border-color var(--dur-fast) var(--ease-precise);

			&:hover {
				border-color: var(--accent);
			}
		}
	}
</style>
