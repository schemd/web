<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/** A labelled page section. In the datasheet design it is plain paper. */
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();
</script>

<section class="sheet" aria-label={t(label)}>
	{@render children()}
</section>

<style>
	.sheet {
		position: relative;
		min-inline-size: 0;
	}
</style>
