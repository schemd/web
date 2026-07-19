<script lang="ts">
	let {
		title,
		description,
		canonical,
		type = 'website',
		structuredData
	}: {
		title: string;
		description: string;
		canonical: string;
		type?: 'website' | 'article';
		structuredData?: Record<string, unknown>;
	} = $props();

	const jsonLd = $derived(
		JSON.stringify(
			structuredData ?? {
				'@context': 'https://schema.org',
				'@type': type === 'article' ? 'TechArticle' : 'SoftwareApplication',
				name: title,
				description,
				url: canonical,
				applicationCategory: 'DeveloperApplication',
				operatingSystem: 'Any'
			}
		).replaceAll('<', '\\u003c')
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content="schemd" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content="https://schemd.johnowolabiidogun.dev/og-v2.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="https://schemd.johnowolabiidogun.dev/og-v2.png" />
	{@html `<script type="application/ld+json">${jsonLd}</${'script'}>`}
</svelte:head>
