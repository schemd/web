<script lang="ts">
	import { page } from '$app/state';
	import Seo from '$lib/components/Seo.svelte';
	let isNotFound = $derived(page.status === 404);
	let title = $derived(
		isNotFound ? 'Page not found — Schemd' : `Request failed (${page.status}) — Schemd`
	);
</script>

<Seo
	{title}
	description="The requested Schemd page could not be served."
	path={page.url.pathname}
	noindex={true}
/>

<section class="error-page page-shell">
	<div class="error-trace" aria-hidden="true"><span></span><span></span><span></span></div>
	<p class="eyebrow">HTTP {page.status}</p>
	<h1>{isNotFound ? 'That trace ends here.' : 'The request did not complete.'}</h1>
	<p class="lede">
		{isNotFound
			? 'The address does not match a published Schemd route or documentation version.'
			: (page.error?.message ?? 'An unexpected server error occurred.')}
	</p>
	<div class="error-actions">
		<a class="button button--signal" href="/">Return home</a><a
			class="button button--quiet"
			href="/docs/latest">Open documentation</a
		><a class="button button--quiet" href="/search">Search the site</a>
	</div>
</section>

<style>
	.error-page {
		display: grid;
		align-content: center;
		gap: 1.3rem;
		min-block-size: 70vh;
		padding-block: 5rem;
	}
	.error-page h1 {
		max-inline-size: 13ch;
	}
	.error-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-block-start: 1rem;
	}
	.error-trace {
		display: flex;
		align-items: center;
		inline-size: min(28rem, 80vw);
	}
	.error-trace::before,
	.error-trace::after {
		block-size: 1px;
		flex: 1;
		background: var(--line-strong);
		content: '';
	}
	.error-trace span {
		inline-size: 0.7rem;
		block-size: 0.7rem;
		border: 2px solid var(--signal);
		border-radius: 50%;
	}
	.error-trace span + span {
		margin-inline-start: clamp(2rem, 8vw, 6rem);
	}
	.error-trace span:last-child {
		border-color: var(--danger);
	}
</style>
