<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/** Brand pronunciation blueprint — anchors "schemd" to /skɛmd/ everywhere. */
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class="pronounce" aria-label={t('schemd is pronounced skemd')}>
	{#if !compact}
		<span class="pronounce-tick" aria-hidden="true"></span>
		<span>{t('pronounced like')}</span>
	{/if}
	<span class="pronounce-say">{t('skemd')}</span>
	<span class="pronounce-ipa">{t('/skɛmd/')}</span>
</span>
