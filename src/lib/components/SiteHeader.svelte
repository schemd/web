<script lang="ts">
	import { page } from '$app/state';
	import { getReleaseRegistry } from '$lib/releases.remote';
	import {
		CORE_REPOSITORY,
		LATEST_VERSION,
		NPM_PACKAGE_URL,
		VERSIONS
	} from '$lib/versioning/manifest';

	const links = [
		{ href: '/docs/latest', label: 'Docs', prefix: '/docs' },
		{ href: '/playground/v0.2.1', label: 'Playground', prefix: '/playground' },
		{ href: '/simulations/v0.2.1', label: 'Simulations', prefix: '/simulations' },
		{ href: '/timeline', label: 'Timeline', prefix: '/timeline' },
		{ href: '/changelog', label: 'Changelog', prefix: '/changelog' }
	] as const;
	let registryVersion = $state<string>(LATEST_VERSION.packageVersion);
	let registryNotice = $state('Verified website artifact');

	function isCurrent(prefix: string): boolean {
		return page.url.pathname.startsWith(prefix);
	}

	function openCommandPalette(): void {
		window.dispatchEvent(new Event('schemd:search'));
	}

	$effect(() => {
		let active = true;
		void getReleaseRegistry().then((snapshot) => {
			if (!active) return;
			registryVersion = snapshot.registryLatest;
			registryNotice =
				snapshot.compatibilityNotice ??
				(snapshot.source === 'network' ? 'Confirmed by npm / GitHub' : 'Verified website artifact');
		});
		return () => {
			active = false;
		};
	});
</script>

<header class="site-header">
	<div class="install-rail">
		<div>
			<p>
				<span class="status-dot"></span><strong>@schemd/core</strong><span
					aria-label={registryNotice}>v{registryVersion}</span
				>
			</p>
			<code>bun add @schemd/core</code>
			<nav aria-label="Package links">
				<a href={NPM_PACKAGE_URL}
					><svg viewBox="0 0 24 24" aria-hidden="true"
						><path d="M3 7h18v10h-9v2H9v-2H3V7Zm3 3v4h3v-4H6Zm6 0v4h6v-4h-6Z" /></svg
					><span>npm</span></a
				>
				<a href={CORE_REPOSITORY}
					><svg viewBox="0 0 24 24" aria-hidden="true"
						><path
							d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.88c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.82c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
						/></svg
					><span>GitHub</span></a
				>
			</nav>
		</div>
	</div>
	<div class="site-header__inner">
		<a class="wordmark" href="/" aria-label="Schemd home">
			<img src="/brand/schemd-mark.svg" alt="" width="42" height="42" />
			<span>schemd</span>
			<small>v{LATEST_VERSION.packageVersion}</small>
		</a>

		<nav class="desktop-nav" aria-label="Primary navigation">
			{#each links as link}
				<a href={link.href} aria-current={isCurrent(link.prefix) ? 'page' : undefined}>
					{link.label}
				</a>
			{/each}
		</nav>

		<form class="header-search" action="/search" method="get" role="search">
			<label class="visually-hidden" for="site-search">Search documentation</label>
			<input id="site-search" name="q" type="search" placeholder="Search docs" maxlength="80" />
			<button type="submit">Search</button>
		</form>

		<form class="global-version" action="/docs/select" method="get">
			<input type="hidden" name="page" value="overview" />
			<label class="visually-hidden" for="global-version">Package version</label>
			<select
				id="global-version"
				name="version"
				onchange={(event) => event.currentTarget.form?.requestSubmit()}
			>
				{#each VERSIONS as version (version.id)}<option value={version.id}>{version.id}</option
					>{/each}
			</select>
		</form>

		<button
			class="command-trigger"
			type="button"
			onclick={openCommandPalette}
			aria-label="Open search and command palette"
		>
			<span>Search</span><kbd>⌘ K</kbd>
		</button>

		<details class="mobile-nav">
			<summary><span>Menu</span><span aria-hidden="true">＋</span></summary>
			<nav aria-label="Mobile navigation">
				{#each links as link}
					<a href={link.href} aria-current={isCurrent(link.prefix) ? 'page' : undefined}>
						{link.label}
					</a>
				{/each}
				<form action="/search" method="get" role="search">
					<label for="mobile-site-search">Search documentation</label>
					<div class="mobile-nav__search">
						<input id="mobile-site-search" name="q" type="search" maxlength="80" />
						<button type="submit">Search</button>
					</div>
				</form>
			</nav>
		</details>
	</div>
</header>

<style>
	.install-rail {
		border-block-end: 1px solid var(--line);
		background: var(--ink-0);
	}
	.install-rail > div {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-block-size: 2.35rem;
		max-inline-size: var(--shell);
		margin-inline: auto;
		padding-inline: var(--gutter);
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.install-rail p {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.install-rail strong {
		color: var(--paper);
	}
	.install-rail code {
		margin-inline-start: auto;
		color: var(--signal-bright);
	}
	.install-rail nav {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.install-rail a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-block-size: 2rem;
		padding-inline: 0.45rem;
		text-decoration: none;
	}
	.install-rail svg {
		inline-size: 1rem;
		block-size: 1rem;
		fill: currentColor;
	}
	.global-version select {
		min-block-size: 2.5rem;
		padding-inline: 0.55rem 1.8rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.command-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-block-size: 2.5rem;
		padding-inline: 0.65rem;
		color: var(--muted);
		font-size: 0.72rem;
	}
	.command-trigger kbd {
		border-inline-start: 1px solid var(--line);
		padding-inline-start: 0.55rem;
		color: var(--paper-soft);
		font-size: 0.64rem;
	}
	@media (max-width: 70rem) {
		.global-version,
		.command-trigger > span {
			display: none;
		}
		.command-trigger {
			margin-inline-start: auto;
		}
	}
	@media (max-width: 34rem) {
		.install-rail code {
			display: none;
		}
		.install-rail nav {
			margin-inline-start: auto;
		}
		.install-rail a span {
			position: absolute;
			inline-size: 1px;
			block-size: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
	}
</style>
