<script lang="ts">
	import '#lib/assets/fonts/fonts.css';
	import '../app.css';
	import type { LayoutProps } from './$types';
	import { provideLanguage, unlocalized } from '#lib/i18n/index.ts';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import CommandPalette from '#lib/components/CommandPalette.svelte';
	import VersionSelect from '#lib/components/VersionSelect.svelte';
	import LanguageSelect from '#lib/components/LanguageSelect.svelte';
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
	const { t, href, locale } = provideLanguage(() => data);
	const pathname = $derived(unlocalized(page.url.pathname));
	$effect(() => {
		document.documentElement.lang = locale();
	});
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
	const showFooter = $derived(!CHROME_FREE.some((prefix) => pathname.startsWith(prefix)));
	/* The playground's panes are sheets of their own, and an embed is someone
	   else's page; every other route lies on one page sheet. */
	const TABLE_ONLY = ['/playground', '/embed'];
	const onSheet = $derived(!TABLE_ONLY.some((prefix) => pathname.startsWith(prefix)));

	const nav = $derived([
		{ href: `/docs/${version}/overview`, label: 'Docs', match: '/docs' },
		{ href: `/playground/${version}`, label: 'Playground', match: '/playground' },
		{ href: '/components', label: 'Components', match: '/components' },
		{ href: '/templates', label: 'Templates', match: '/templates' },
		{ href: `/simulations/${version}`, label: 'Labs', match: '/simulations' },
		{ href: `/inspector/${version}`, label: 'Inspector', match: '/inspector' },
		{ href: '/changelog', label: 'Changelog', match: '/changelog' }
	]);

	function cycleBlueprint(): void {
		const index = BLUEPRINT_MODES.indexOf(ui.blueprint);
		setBlueprint(BLUEPRINT_MODES[(index + 1) % BLUEPRINT_MODES.length]!);
		if (ui.audio) playTick(520);
	}
</script>

<a class="skip-link" href="#main">{t('Skip to content')}</a>

<header class="nav-sheet vellum">
	<a class="wordmark" href={href('/')} aria-label={t('schemd home')}>{t('schemd')}</a>
	<nav class="nav-links" aria-label={t('Primary')}>
		{#each nav as item (item.href)}
			<a href={href(item.href)} aria-current={pathname.startsWith(item.match) ? 'page' : undefined}>
				{t(item.label)}
			</a>
		{/each}
	</nav>

	<div class="nav-tools">
		<button
			type="button"
			class="tool search"
			disabled={!clientReady}
			onclick={() => (ui.paletteOpen = true)}
			aria-keyshortcuts="Meta+K Control+K"
		>
			<!-- Named by what it shows, so a voice command of "search" finds it. -->
			<span>{t('Search')}</span>
			<kbd>{t('⌘K')}</kbd>
			<span class="visually-hidden">{t(', opens the command palette')}</span>
		</button>
		<button
			type="button"
			class="tool"
			onclick={cycleBlueprint}
			aria-label={t('Print mode: {0}. Activate to switch.', [t(BLUEPRINT_LABELS[ui.blueprint])])}
		>
			<span class="mode-swatch" data-mode={ui.blueprint} aria-hidden="true"></span>
			<span class="tool-text">{t(BLUEPRINT_SHORT[ui.blueprint])}</span>
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
			aria-label={t('Sound')}
		>
			<span>{ui.audio ? t('Sound on') : t('Sound off')}</span>
		</button>
		<LanguageSelect />
		<VersionSelect
			versions={data.versions}
			latest={data.latest}
			docLines={data.docLines}
			docSlugs={data.docSlugs}
		/>
		<a
			class="tool external"
			href="https://github.com/schemd/core"
			rel="noopener"
			target="_blank"
			aria-label={t('schemd on GitHub (opens in a new tab)')}>{t('GitHub')}</a
		>
	</div>
</header>

<main id="main" class:has-footer={showFooter} class:on-table={!onSheet}>
	{#if onSheet}
		<!-- The page is a sheet of vellum with a second sheet beneath it. -->
		<div class="sheet-stack">
			<div class="vellum page-sheet">
				{@render children()}
			</div>
		</div>
	{:else}
		{@render children()}
	{/if}
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
		border-radius: var(--radius-sm);
		background: var(--ink);
		color: var(--bg);

		&:focus {
			inset-block-start: var(--space-2);
		}
	}

	/* The navigation is a sheet of its own that floats over the page as it
	   scrolls, with a strip of table showing round it. */
	.nav-sheet {
		position: sticky;
		inset-block-start: var(--space-3);
		z-index: 50;
		display: flex;
		align-items: center;
		gap: var(--space-4);
		inline-size: min(100% - 2 * var(--space-4) - var(--under-offset), var(--sheet-max));
		block-size: 56px;
		margin: var(--space-3) auto 0;
		padding-inline: var(--space-5) var(--space-3);
		/* Pages scroll beneath this sheet, so it diffuses them more than a page
		   sheet diffuses the sheet under it. */
		background: color-mix(in srgb, var(--vellum) 90%, transparent);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
	}

	.wordmark {
		font-weight: 800;
		font-size: 1.375rem;
		letter-spacing: -0.035em;
		line-height: 1;
		color: var(--ink);

		&:hover {
			text-decoration: none;
		}
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 0;
		min-inline-size: 0;
		overflow-x: auto;
		scrollbar-width: none;

		& a {
			padding: 0.3rem 0.55rem;
			border-radius: 6px;
			font-size: 0.9375rem;
			font-weight: 500;
			color: var(--ink);
			white-space: nowrap;

			&:hover {
				text-decoration: none;
				background: var(--wash);
			}

			/* The current page is marked with the checker's highlighter. */
			&[aria-current='page'] {
				background: var(--mark);
				color: var(--mark-ink);
				font-weight: 600;
			}
		}
	}

	.nav-tools {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-inline-start: auto;
		font-size: var(--text-sm);
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-block-size: 36px;
		padding-inline: var(--space-2);
		border-radius: var(--radius-sm);
		color: var(--ink-mute);
		font-weight: 500;
		white-space: nowrap;

		&:hover {
			color: var(--ink);
			background: var(--wash);
			text-decoration: none;
		}

		&:disabled {
			color: var(--ink-faint);
			cursor: default;
		}
	}

	.search {
		padding-inline: var(--space-3) var(--space-2);
		border: 1px solid var(--line);
		background: var(--bg);
	}

	/* The mode switch: a half-lit disc, the usual sign for light and dark. */
	.mode-swatch {
		inline-size: 14px;
		block-size: 14px;
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		background: linear-gradient(90deg, var(--ink) 50%, transparent 50%);
	}

	.on-table {
		padding-block-start: var(--space-3);
	}

	.page-sheet {
		padding-block: var(--space-2);
	}

	/* The mode button keeps its disc and its spoken name when the visible
	   word goes. */
	@media (max-width: 1520px) {
		.nav-tools .tool-text {
			display: none;
		}
	}

	@media (max-width: 1360px) {
		.nav-tools .external {
			display: none;
		}
	}

	@media (max-width: 1180px) {
		.nav-tools kbd {
			display: none;
		}
	}

	/* On a phone the sheet holds two rows: the links, then the tools, each
	   scrolling sideways so nothing is ever cut short. */
	@media (max-width: 860px) {
		.nav-sheet {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-rows: 48px 48px;
			column-gap: var(--space-3);
			row-gap: 0;
			block-size: auto;
			padding-inline: var(--space-4) var(--space-2);
			inset-block-start: var(--space-2);
			margin-block-start: var(--space-2);
		}

		.nav-tools {
			grid-column: 1 / -1;
			margin-inline-start: 0;
			overflow-x: auto;
			scrollbar-width: none;
			border-block-start: 1px solid var(--line);
		}

		.nav-tools kbd {
			display: none;
		}

		.tool {
			min-block-size: 40px;
		}
	}
</style>
