<script lang="ts">
	/** A labelled page section. In the datasheet design it is plain paper. */
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();
</script>

<section class="sheet" aria-label={label}>
	{@render children()}
</section>

<style>
	.sheet {
		position: relative;
		min-inline-size: 0;
	}
</style>
