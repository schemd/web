<script lang="ts">
	import { page } from '$app/state';
	import { useLanguage } from '#lib/i18n/index.ts';
	import { LANGUAGES } from '#lib/i18n/locales.ts';

	const { t, locale } = useLanguage();

	function changeLanguage(event: Event & { currentTarget: HTMLSelectElement }): void {
		if (event.currentTarget.value !== locale()) event.currentTarget.form?.requestSubmit();
	}
</script>

<form class="language-select" method="POST" action="/locale">
	<input type="hidden" name="return" value={page.url.pathname + page.url.search + page.url.hash} />
	<label>
		<span class="visually-hidden">{t('Language')}</span>
		<select
			name="language"
			value={locale()}
			onchange={changeLanguage}
			aria-describedby="language-navigation-hint"
		>
			{#each LANGUAGES as language (language.code)}
				<option value={language.code} lang={language.code}>{language.name}</option>
			{/each}
		</select>
	</label>
	<span id="language-navigation-hint" class="visually-hidden">
		{t('Selecting a language reloads this page.')}
	</span>
	<noscript><button type="submit" class="apply-language">{t('Apply language')}</button></noscript>
</form>

<style>
	.language-select,
	label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
		color: var(--ink-mute);
	}

	.language-select {
		margin: 0;
		flex: none;
	}

	select,
	.apply-language {
		font: inherit;
		font-weight: 600;
		color: var(--ink);
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		min-block-size: 36px;
		padding-inline: var(--space-2);
		cursor: pointer;

		&:hover {
			border-color: var(--ink);
		}
	}

	@media (max-width: 760px) {
		select,
		.apply-language {
			min-block-size: 40px;
		}
	}
</style>
