<script lang="ts">
	/**
	 * One place that states what a page is, for crawlers.
	 *
	 * Before this, only the documentation carried a canonical link and only
	 * three routes carried social metadata, so most of the site published a
	 * title and nothing else. Worse, the engine-versioned routes exist once per
	 * release: fifteen `/playground/x.y.z` URLs and two hundred and ten
	 * `/simulations/…` URLs render near-identical content, and without a
	 * canonical a crawler treats each as a separate page competing with its own
	 * siblings.
	 *
	 * So `canonical` here is the *preferred* URL, not necessarily the current
	 * one: a historical release points at the latest, and the query string is
	 * dropped unless a route says otherwise (a playground URL carries an entire
	 * document in `?code=`, which must never become an indexable page).
	 */
	import { page } from '$app/state';

	interface Props {
		/** Full document title, including the site suffix. */
		title: string;
		/** One sentence. Search results show roughly 155 characters. */
		description: string;
		/**
		 * Preferred path for this page, absolute from the site root. Defaults to
		 * the current pathname with any query string removed.
		 */
		canonicalPath?: string;
		/** `article` for documentation and changelog entries; `website` otherwise. */
		type?: 'website' | 'article';
		/** Absolute-from-root path of the social preview image. */
		image?: string;
		/** Keep this page out of the index — authoring surfaces and errors. */
		noindex?: boolean;
		/** Extra JSON-LD, already serialized, appended after the defaults. */
		jsonLd?: string;
	}

	let {
		title,
		description,
		canonicalPath,
		type = 'website',
		image = '/brand/social-card.jpg',
		noindex = false,
		jsonLd
	}: Props = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}${canonicalPath ?? page.url.pathname}`);
	const imageUrl = $derived(`${origin}${image}`);

	/*
	 * A component cannot contain the literal closing script tag, so it is
	 * assembled from a fragment. `JSON.stringify` escapes nothing that is
	 * HTML-significant — a `<` inside a string value survives verbatim — so
	 * every `<` becomes its `<` JSON escape before the payload is written.
	 * That parses back to the same document and cannot close the block early.
	 */
	function ldBlock(payload: string): string {
		return `<script type="application/ld+json">${payload.replaceAll('<', '\\u003c')}</${'script'}>`;
	}

	const websiteLd = $derived(
		ldBlock(
			JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'WebSite',
				name: 'schemd',
				alternateName: 'schemd — the vector schematic compiler',
				url: origin,
				inLanguage: 'en-US',
				publisher: {
					'@type': 'Person',
					name: 'John Owolabi Idogun',
					url: 'https://www.johnowolabiidogun.dev'
				}
			})
		)
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	{#if noindex}
		<meta name="robots" content="noindex, follow" />
	{:else}
		<!-- `max-image-preview:large` is what lets a compiled schematic appear as
		     a full-width result image rather than a thumbnail. -->
		<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	{/if}

	<meta property="og:site_name" content="schemd" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="schemd — schematics compiled from plain text" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:creator" content="@Sirneij" />

	{@html websiteLd}
	{#if jsonLd}
		{@html ldBlock(jsonLd)}
	{/if}
</svelte:head>
