<script lang="ts">
	/**
	 * Global version switcher.
	 *
	 * The site routes in two different version domains and the switcher has to
	 * offer whichever one the current route lives in, or its options can never
	 * match the URL:
	 *
	 * - **Docs** are versioned by documented *line* (`/docs/0.4/...`). Every
	 *   release parameter is 308-canonicalised onto its line by `hooks.server`,
	 *   so offering patch releases here would show a value the URL can never
	 *   hold — the selection would silently snap back to blank.
	 * - **Playground, simulations, and diff** execute one real engine build, so
	 *   they are versioned by published *release* (`/playground/0.4.0`).
	 *
	 * Switching keeps you where you are: the `[version]` segment is rewritten in
	 * place with the query and hash preserved, and a docs line switch keeps the
	 * current page when the target line publishes it.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';

	interface Props {
		/** Published npm releases, newest first. */
		versions: readonly string[];
		/** The npm `latest` dist-tag. */
		latest: string;
		/** Documented docs lines, newest first. */
		docLines: readonly string[];
		/** Slugs each documented line actually publishes. */
		docSlugs: Readonly<Record<string, readonly string[]>>;
	}

	let { versions, latest, docLines, docSlugs }: Props = $props();

	/** True while the reader is inside the line-versioned documentation. */
	const inDocs = $derived(page.url.pathname.startsWith('/docs/'));

	const options = $derived(inDocs ? docLines : versions);

	/**
	 * The option the URL currently names. Both domains are exact: a docs path
	 * always carries a documented line, and an engine path always carries a
	 * published release, so this is a real member of `options` — which is what
	 * keeps the rendered control and the address bar in agreement.
	 */
	const current = $derived(page.params['version'] ?? latest);

	function docsTargetFor(line: string): string {
		const slug = page.params['slug'];
		const published = docSlugs[line] ?? [];
		const kept = slug !== undefined && published.includes(slug) ? slug : 'overview';
		return `/docs/${line}/${kept}`;
	}

	function pathFor(version: string): string {
		if (inDocs) return docsTargetFor(version);
		const parameter = page.params['version'];
		if (parameter === undefined) return `/docs/${docLines[0]}/overview`;
		/* Shallow playground URI writes can lead the route snapshot by a tick. */
		const { pathname, search, hash } = browser ? new URL(window.location.href) : page.url;
		const swapped = pathname.replace(`/${parameter}`, `/${version}`);
		const target =
			swapped === pathname && !pathname.includes(`/${version}`)
				? `/docs/${docLines[0]}/overview`
				: swapped;
		return `${target}${search}${hash}`;
	}

	let control = $state<HTMLSelectElement | undefined>();

	/**
	 * Re-assert the URL's version onto the control after every navigation.
	 *
	 * A `<select>` keeps whatever the visitor picked. When a navigation resolves
	 * to a version the reader did not choose — a patch release canonicalising
	 * onto its line, a redirect, an aborted `goto` — the derived value can be
	 * unchanged while the DOM still shows the stale pick, leaving the control
	 * contradicting the page it labels.
	 */
	$effect(() => {
		void page.url;
		const node = control;
		if (node && node.value !== current) node.value = current;
	});

	function onChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		void goto(pathFor(event.currentTarget.value), { noScroll: false });
	}
</script>

<label class="version-select">
	<span class="microlabel">{inDocs ? 'docs' : 'ver'}</span>
	<select
		bind:this={control}
		value={current}
		onchange={onChange}
		aria-label="Documentation version"
	>
		{#each options as version (version)}
			<option value={version}>
				v{version}{!inDocs && version === latest ? ' · latest' : ''}
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
			border-radius: var(--radius-sm);
			padding: 0.28rem 1.6rem 0.28rem 0.6rem;
			cursor: pointer;
			transition: border-color var(--dur-fast) var(--ease-precise);

			&:hover {
				border-color: var(--accent);
			}
		}
	}
</style>
