<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import VersionSelect from '$lib/components/VersionSelect.svelte';
	import Telemetry from '$lib/components/Telemetry.svelte';
	import { BLUEPRINT_MODES, BLUEPRINT_LABELS, setAudio, setBlueprint, ui } from '$lib/ui.svelte';
	import { playTick } from '$lib/audio';

	let { data, children }: LayoutProps = $props();
	let clientReady = $state(false);
	onMount(() => {
		clientReady = true;
	});

	const version = $derived(page.params['version'] ?? data.latest);

	const nav = $derived([
		{ href: `/docs/${version}/overview`, label: 'Docs', match: '/docs' },
		{ href: `/playground/${version}`, label: 'Playground', match: '/playground' },
		{ href: `/simulations/${version}`, label: 'Simulations', match: '/simulations' },
		{ href: '/changelog', label: 'Changelog', match: '/changelog' }
	]);

	function cycleBlueprint(): void {
		const index = BLUEPRINT_MODES.indexOf(ui.blueprint);
		setBlueprint(BLUEPRINT_MODES[(index + 1) % BLUEPRINT_MODES.length]!);
		if (ui.audio) playTick(520);
	}
</script>

<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
	<a class="brand" href="/" aria-label="schemd home">
		<img src="/brand/schemd-mark.svg" alt="" width="22" height="22" />
		<span class="brand-name">schemd</span>
		<span class="brand-ipa" aria-hidden="true">/skɛmd/</span>
	</a>

	<nav aria-label="Primary">
		{#each nav as item (item.href)}
			<a
				href={item.href}
				aria-current={page.url.pathname.startsWith(item.match) ? 'page' : undefined}
			>
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="header-tools">
		<a
			class="tool icon-link"
			href="https://github.com/schemd/core"
			rel="noopener"
			target="_blank"
			aria-label="schemd on GitHub (opens in a new tab)"
			title="GitHub"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
				<path
					fill="currentColor"
					d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
				/>
			</svg>
		</a>
		<a
			class="tool npm-link"
			href="https://www.npmjs.com/package/@schemd/core"
			rel="noopener"
			target="_blank"
			aria-label="@schemd/core on npm (opens in a new tab)"
			title="npm registry"
		>
			<span class="npm-badge" aria-hidden="true">npm</span>
		</a>
		<button
			type="button"
			class="tool search-tool"
			disabled={!clientReady}
			onclick={() => (ui.paletteOpen = true)}
			aria-label="Open command palette"
		>
			<span class="microlabel">search</span>
			<kbd>⌘K</kbd>
		</button>
		<button
			type="button"
			class="tool blueprint-tool"
			onclick={cycleBlueprint}
			aria-label={`Blueprint mode: ${BLUEPRINT_LABELS[ui.blueprint]}. Activate to switch.`}
		>
			<span class="blueprint-dot" data-mode={ui.blueprint} aria-hidden="true"></span>
			<span class="microlabel">{ui.blueprint}</span>
		</button>
		<button
			type="button"
			class="tool audio-tool"
			role="switch"
			aria-checked={ui.audio}
			onclick={() => {
				setAudio(!ui.audio);
				if (!ui.audio) return;
				playTick(660);
			}}
			aria-label="Auditory feedback"
		>
			<span class="audio-glyph" aria-hidden="true">{ui.audio ? '♫' : '♪'}</span>
			<span class="microlabel">{ui.audio ? 'audio on' : 'audio off'}</span>
		</button>
		<VersionSelect versions={data.versions} latest={data.latest} />
	</div>
</header>

<main id="main">
	{@render children()}
</main>

<CommandPalette entries={data.paletteEntries} />
<Telemetry />

<style>
	.skip-link {
		position: absolute;
		inset-block-start: -100%;
		inset-inline-start: var(--space-4);
		z-index: 100;
		padding: var(--space-2) var(--space-4);
		background: var(--accent);
		color: var(--accent-ink);

		&:focus {
			inset-block-start: var(--space-2);
		}
	}

	.site-header {
		position: sticky;
		inset-block-start: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: var(--space-6);
		block-size: var(--header-h);
		padding-inline: var(--space-4);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(8px);
		border-block-end: 1px solid var(--line);
	}

	.brand {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2);
		color: var(--ink);

		&:hover {
			text-decoration: none;
		}

		& img {
			align-self: center;
		}

		& .brand-name {
			font-family: var(--font-mono);
			font-weight: 700;
			letter-spacing: -0.02em;
		}

		& .brand-ipa {
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			color: var(--ink-faint);
		}
	}

	nav {
		display: flex;
		gap: var(--space-1);

		& a {
			padding: 0.3rem 0.7rem;
			font-size: var(--text-sm);
			font-weight: 560;
			color: var(--ink-mute);

			&:hover {
				color: var(--ink);
				text-decoration: none;
			}

			&[aria-current='page'] {
				color: var(--accent);
				box-shadow: inset 0 -2px 0 var(--accent);
			}
		}
	}

	.header-tools {
		margin-inline-start: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0.3rem 0.55rem;
		border: 1px solid var(--line);
		background: var(--bg-raised);
		transition: border-color var(--dur-fast) var(--ease-precise);

		&:hover {
			border-color: var(--line-strong);
		}
	}

	.icon-link {
		color: var(--ink-mute);
		padding: 0.34rem 0.5rem;

		&:hover {
			color: var(--ink);
			text-decoration: none;
		}
	}

	.npm-link {
		padding: 0.3rem 0.5rem;

		&:hover {
			text-decoration: none;
		}
	}

	.npm-badge {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--accent-ink);
		background: var(--danger);
		padding: 0.05em 0.4em;
		border-radius: 2px;
	}

	.blueprint-dot {
		inline-size: 10px;
		block-size: 10px;
		border-radius: 50%;
		border: 1px solid var(--line-strong);

		&[data-mode='hud'] {
			background: #0a0d10;
			box-shadow: inset 0 0 3px #57d7c4;
		}

		&[data-mode='cyanotype'] {
			background: #0d2b52;
			box-shadow: inset 0 0 3px #ffffff;
		}

		&[data-mode='iso'] {
			background: #f7f8f7;
			box-shadow: inset 0 0 3px #0b7d6c;
		}
	}

	main {
		min-block-size: calc(100vh - var(--header-h));
	}

	@media (max-width: 1040px) {
		:global(:root) {
			--header-h: 98px;
		}

		.site-header {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-rows: 48px 49px;
			gap: 0 var(--space-3);
			block-size: var(--header-h);
			padding-inline: var(--space-3);
		}

		.site-header > nav {
			grid-column: 1 / -1;
			grid-row: 2;
			min-inline-size: 0;
			overflow-x: auto;
			overflow-y: hidden;
			overscroll-behavior-inline: contain;
			scrollbar-width: none;

			& a {
				white-space: nowrap;
			}
		}

		.header-tools {
			grid-column: 2;
			grid-row: 1;
			gap: var(--space-2);
			min-inline-size: 0;
			justify-self: end;
		}

		.icon-link,
		.npm-link {
			display: none;
		}

		.brand .brand-ipa {
			display: none;
		}
	}

	@media (max-width: 620px) {
		.site-header {
			padding-inline: var(--space-2);
		}

		.brand {
			gap: var(--space-1);
		}

		.brand-name {
			display: none;
		}

		.header-tools {
			gap: 4px;
		}

		.tool {
			min-inline-size: 36px;
			min-block-size: 36px;
			justify-content: center;
			padding: 0.3rem;
		}

		.tool .microlabel,
		.search-tool kbd {
			display: none;
		}

		.search-tool::before {
			content: '⌕';
			font-family: var(--font-mono);
			font-size: var(--text-md);
		}

		.site-header > nav a {
			padding-inline: 0.58rem;
		}
	}
</style>
