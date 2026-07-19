<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';
	import { page } from '$app/state';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import VersionSelect from '$lib/components/VersionSelect.svelte';
	import { BLUEPRINT_MODES, BLUEPRINT_LABELS, setAudio, setBlueprint, ui } from '$lib/ui.svelte';
	import { playTick } from '$lib/audio';

	let { data, children }: LayoutProps = $props();

	const version = $derived(page.params['version'] ?? data.latest);

	const nav = $derived([
		{ href: `/docs/${version}/overview`, label: 'Docs', match: '/docs' },
		{ href: `/playground/${version}`, label: 'Playground', match: '/playground' },
		{ href: `/simulate/${version}`, label: 'Simulate', match: '/simulate' },
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
		<button
			type="button"
			class="tool"
			onclick={() => (ui.paletteOpen = true)}
			aria-label="Open command palette"
		>
			<span class="microlabel">search</span>
			<kbd>⌘K</kbd>
		</button>
		<button
			type="button"
			class="tool"
			onclick={cycleBlueprint}
			aria-label={`Blueprint mode: ${BLUEPRINT_LABELS[ui.blueprint]}. Activate to switch.`}
		>
			<span class="blueprint-dot" data-mode={ui.blueprint} aria-hidden="true"></span>
			<span class="microlabel">{ui.blueprint}</span>
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
			aria-label="Auditory feedback"
		>
			<span class="microlabel">{ui.audio ? 'audio on' : 'audio off'}</span>
		</button>
		<VersionSelect versions={data.versions} latest={data.latest} />
	</div>
</header>

<main id="main">
	{@render children()}
</main>

<CommandPalette entries={data.paletteEntries} />

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

	@media (max-width: 760px) {
		.site-header {
			gap: var(--space-3);
			overflow-x: auto;
		}

		.brand .brand-ipa {
			display: none;
		}
	}
</style>
