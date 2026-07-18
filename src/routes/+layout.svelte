<script lang="ts">
	import '../app.css';
	import SiteHeader from '$lib/components/SiteHeader.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/brand/schemd-mark.svg" />
	<meta name="theme-color" content="#080b0b" />
	<meta name="color-scheme" content="dark" />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to content</a>
<SiteHeader />

<main id="main-content" tabindex="-1">
	{@render children()}
</main>

<footer class="site-footer">
	<div class="site-footer__inner">
		<a class="site-footer__brand" href="/" aria-label="Schemd home">
			<img src="/brand/schemd-logo.svg" alt="Schemd — engineering vectors" width="360" height="100" />
		</a>
		<div class="site-footer__links">
			<div>
				<p class="site-footer__label">Build</p>
				<a href="/docs/latest">Documentation</a>
				<a href="/playground/v0.2.1">Playground</a>
				<a href="/simulations/v0.2.1">Simulations</a>
			</div>
			<div>
				<p class="site-footer__label">Project</p>
				<a href="/timeline">Timeline</a>
				<a href="/changelog">Changelog</a>
				<a href="https://github.com/schemd/core">Source on GitHub</a>
			</div>
		</div>
	</div>
	<div class="site-footer__base">
		<p>Designed and built by John Owolabi Idogun. Schemd is MIT licensed.</p>
		<p><span aria-hidden="true">◆</span> Text in. Engineering vectors out.</p>
	</div>
</footer>
