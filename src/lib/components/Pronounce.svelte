<script lang="ts">
	/** Brand pronunciation blueprint — anchors "schemd" to /skɛmd/ everywhere. */
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class="pronounce" aria-label="schemd is pronounced skemd">
	{#if !compact}
		<span class="pronounce-tick" aria-hidden="true"></span>
		<span>pronounced like</span>
	{/if}
	<span class="pronounce-say">skemd</span>
	<span class="pronounce-ipa">/skɛmd/</span>
</span>
