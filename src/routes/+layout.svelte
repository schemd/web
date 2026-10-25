<script lang="ts">
	import '#lib/assets/fonts/fonts.css';
	import '../app.css';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import CommandPalette from '#lib/components/CommandPalette.svelte';
	import VersionSelect from '#lib/components/VersionSelect.svelte';
	import Telemetry from '#lib/components/Telemetry.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import {
		BLUEPRINT_MODES,
		BLUEPRINT_LABELS,
		BLUEPRINT_SHORT,
		hydrateUiPreferences,
		setAudio,
		setBlueprint,
		ui
	} from '#lib/ui.svelte.ts';
	import { playTick } from '#lib/audio.ts';

	let { data, children }: LayoutProps = $props();
	let clientReady = $state(false);
	onMount(() => {
		hydrateUiPreferences();
		clientReady = true;
	});

	const version = $derived(page.params['version'] ?? data.latest);

	/*
	 * The instrument routes are exactly one viewport tall by construction, and
	 * the embed route is someone else's iframe; a footer would add a scrollbar
	 * to surfaces designed without one. Every document-shaped route gets it.
	 */
	const CHROME_FREE = ['/playground', '/simulations', '/inspector', '/embed'];
	const showFooter = $derived(!CHROME_FREE.some((prefix) => page.url.pathname.startsWith(prefix)));

	const nav = $derived([
		{ href: `/docs/${version}/overview`, label: 'Docs', match: '/docs' },
		{ href: `/playground/${version}`, label: 'Playground', match: '/playground' },
		{ href: '/components', label: 'Components', match: '/components' },
		{ href: `/simulations/${version}`, label: 'Labs', match: '/simulations' },
		{ href: `/inspector/${version}`, label: 'Inspector', match: '/inspector' },
		{ href: '/changelog', label: 'Changelog', match: '/changelog' }
	]);

	/* A datasheet prints its revision date in words, not as a timestamp. */
	const published = $derived(
		data.latestPublishedAt === undefined
			? undefined
			: new Date(data.latestPublishedAt).toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
					timeZone: 'UTC'
				})
	);

	function cycleBlueprint(): void {
		const index = BLUEPRINT_MODES.indexOf(ui.blueprint);
		setBlueprint(BLUEPRINT_MODES[(index + 1) % BLUEPRINT_MODES.length]!);
		if (ui.audio) playTick(520);
	}
</script>

<a class="skip-link" href="#main">Skip to content</a>

<header class="band">
	<div class="band-inner">
		<a class="wordmark" href="/" aria-label="schemd home">schemd</a>
		<p class="descriptor">Text-to-schematic compiler</p>
		<dl class="revision">
			<div>
				<dt>Revision</dt>
				<dd class="tabular">{data.latest}</dd>
			</div>
			{#if published !== undefined}
				<div>
					<dt>Published</dt>
					<dd>{published}</dd>
				</div>
			{/if}
		</dl>
	</div>
</header>

<nav class="site-nav" aria-label="Primary">
	<div class="nav-inner">
		<div class="nav-links">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					aria-current={page.url.pathname.startsWith(item.match) ? 'page' : undefined}
				>
					{item.label}
				</a>
			{/each}
		</div>

		<div class="nav-tools">
			<button
				type="button"
				class="tool"
				disabled={!clientReady}
				onclick={() => (ui.paletteOpen = true)}
				aria-keyshortcuts="Meta+K Control+K"
			>
				<!-- Named by what it shows, so a voice command of "search" finds it. -->
				<span>Search</span>
				<kbd>⌘K</kbd>
				<span class="visually-hidden">, opens the command palette</span>
			</button>
			<button
				type="button"
				class="tool"
				onclick={cycleBlueprint}
				aria-label={`Print mode: ${BLUEPRINT_LABELS[ui.blueprint]}. Activate to switch.`}
			>
				<span class="mode-swatch" data-mode={ui.blueprint} aria-hidden="true"></span>
				<span class="tool-text">{BLUEPRINT_SHORT[ui.blueprint]}</span>
			</button>
			<button
				type="button"
				class="tool"
				role="switch"
				aria-checked={ui.audio}
				onclick={() => {
					setAudio(!ui.audio);
					if (!ui.audio) return;
					playTick(660);
				}}
				aria-label="Sound"
			>
				<span class="tool-text">{ui.audio ? 'Sound on' : 'Sound off'}</span>
			</button>
			<VersionSelect
				versions={data.versions}
				latest={data.latest}
				docLines={data.docLines}
				docSlugs={data.docSlugs}
			/>
			<a
				class="tool"
				href="https://github.com/schemd/core"
				rel="noopener"
				target="_blank"
				aria-label="schemd on GitHub (opens in a new tab)">GitHub</a
			>
			<a
				class="tool"
				href="https://www.npmjs.com/package/@schemd/core"
				rel="noopener"
				target="_blank"
				aria-label="@schemd/core on npm (opens in a new tab)">npm</a
			>
		</div>
	</div>
</nav>

<main id="main" class:has-footer={showFooter}>
	{@render children()}
</main>

{#if showFooter}
	<Footer
		latest={data.latest}
		docLine={data.docLines[0] ?? data.latest}
		registryLive={data.registryLive}
		releases={data.versions.length}
	/>
{/if}

<CommandPalette entries={data.paletteEntries} />
<Telemetry />

<style>
	.skip-link {
		position: absolute;
		inset-block-start: -100%;
		inset-inline-start: var(--space-4);
		z-index: 100;
		padding: var(--space-2) var(--space-4);
		background: var(--ink);
		color: var(--bg);

		&:focus {
			inset-block-start: var(--space-2);
		}
	}

	/* The datasheet's header band: the one bold element on every page. It
	   ends in a heavy ink rule, and it scrolls away with the page. */
	.band {
		block-size: 60px;
		border-block-end: 4px solid var(--ink);
	}

	.band-inner {
		display: flex;
		align-items: baseline;
		gap: var(--space-4);
		block-size: 100%;
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
		padding-block-start: 14px;
	}

	.wordmark {
		font-stretch: var(--width-extended);
		font-weight: 800;
		font-size: 1.875rem;
		line-height: 1;
		color: var(--ink);

		&:hover {
			text-decoration: none;
		}
	}

	.descriptor {
		margin: 0;
		font-stretch: var(--width-table);
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--ink);
	}

	.revision {
		display: flex;
		gap: var(--space-6);
		margin: 0 0 0 auto;
		font-stretch: var(--width-table);
		font-size: var(--text-sm);

		& div {
			display: flex;
			gap: var(--space-2);
		}

		& dt {
			color: var(--ink-mute);
		}

		& dd {
			margin: 0;
			font-weight: 600;
		}
	}

	/* The navigation row stays in reach while the band scrolls away. */
	.site-nav {
		position: sticky;
		inset-block-start: 0;
		z-index: 50;
		block-size: 44px;
		background: var(--bg);
		border-block-end: 1px solid var(--line);
	}

	.nav-inner {
		display: flex;
		align-items: stretch;
		gap: var(--space-6);
		block-size: 100%;
		inline-size: min(100% - 2 * var(--space-4), var(--page-max));
		margin-inline: auto;
	}

	.nav-links {
		display: flex;
		gap: var(--space-6);
		overflow-x: auto;
		scrollbar-width: none;

		& a {
			display: flex;
			align-items: center;
			font-stretch: var(--width-table);
			font-size: var(--text-base);
			font-weight: 600;
			color: var(--ink);
			white-space: nowrap;
			border-block-end: 3px solid transparent;
			padding-block-start: 3px;

			&:hover {
				text-decoration: none;
				border-block-end-color: var(--line-strong);
			}

			&[aria-current='page'] {
				border-block-end-color: var(--accent);
			}
		}
	}

	.nav-tools {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin-inline-start: auto;
		font-stretch: var(--width-table);
		font-size: var(--text-sm);
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-mute);
		font-weight: 500;
		white-space: nowrap;

		&:hover {
			color: var(--ink);
			text-decoration: none;
		}

		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
	}

	/* The current print mode, shown as the paper it prints on. */
	.mode-swatch {
		inline-size: 12px;
		block-size: 12px;
		border: 1px solid var(--ink);
		background: linear-gradient(135deg, var(--bg) 50%, var(--ink) 50%);
	}

	@media (max-width: 1040px) {
		.revision div:last-child {
			display: none;
		}

		.nav-tools a.tool {
			display: none;
		}
	}

	@media (max-width: 760px) {
		.descriptor,
		.revision {
			display: none;
		}

		/* On a phone the links and tools share one strip that scrolls sideways,
		   so no link is ever cut short. */
		.nav-inner {
			overflow-x: auto;
			scrollbar-width: none;
		}

		.nav-links {
			flex: none;
			overflow: visible;
		}

		.nav-tools {
			flex: none;
			gap: var(--space-3);
			padding-inline-end: var(--space-4);
		}

		.nav-tools .tool-text,
		.nav-tools kbd {
			display: none;
		}
	}
</style>
