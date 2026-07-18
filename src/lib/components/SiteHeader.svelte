<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/docs/latest', label: 'Docs', prefix: '/docs' },
		{ href: '/playground/v0.2.1', label: 'Playground', prefix: '/playground' },
		{ href: '/simulations/v0.2.1', label: 'Simulations', prefix: '/simulations' },
		{ href: '/timeline', label: 'Timeline', prefix: '/timeline' },
		{ href: '/changelog', label: 'Changelog', prefix: '/changelog' }
	] as const;

	function isCurrent(prefix: string): boolean {
		return page.url.pathname.startsWith(prefix);
	}
</script>

<header class="site-header">
	<div class="site-header__inner">
		<a class="wordmark" href="/" aria-label="Schemd home">
			<img src="/brand/schemd-mark.svg" alt="" width="42" height="42" />
			<span>schemd</span>
			<small>v0.2.1</small>
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
