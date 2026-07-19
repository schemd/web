<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — schemd compiler boundary</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="error-page">
	<p class="eyebrow">COMPILER BOUNDARY / {page.status}</p>
	<h1>{page.status === 404 ? 'Vector path unresolved.' : 'The render pass failed.'}</h1>
	<p>{page.error?.message ?? 'The requested platform context is unavailable.'}</p>
	<div>
		<a class="button signal" href="/">Return to origin</a>
		<a class="button ghost" href="/docs/v0.2.1/overview">Inspect documentation</a>
	</div>
</article>
