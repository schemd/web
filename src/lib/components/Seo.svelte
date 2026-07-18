<script lang="ts">
	import { absoluteUrl, safeStructuredData } from '$lib/seo';

	interface Props {
		title: string;
		description: string;
		path: string;
		structuredData?: Record<string, unknown>;
		noindex?: boolean;
	}

	let { title, description, path, structuredData, noindex = false }: Props = $props();
	let canonical = $derived(absoluteUrl(path));
	let json = $derived(structuredData ? safeStructuredData(structuredData) : '');
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Schemd" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={absoluteUrl('/og.png')} />
	<meta property="og:image:alt" content="Schemd — text in, engineering vectors out" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={absoluteUrl('/og.png')} />
	{#if noindex}<meta name="robots" content="noindex,follow" />{/if}
	{#if structuredData}<svelte:element this={"script"} type="application/ld+json"
			>{json}</svelte:element
		>{/if}
</svelte:head>
