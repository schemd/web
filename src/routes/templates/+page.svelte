<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '#lib/components/Seo.svelte';
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();
	let { data }: PageProps = $props();
	const families = ['electrical', 'digital', 'quantum', 'uml'] as const;
	const labels = { electrical: 'Electrical', digital: 'Digital', quantum: 'Quantum', uml: 'UML' };
</script>

<Seo
	title="Starter templates · schemd"
	description="Editable electrical, digital, quantum and UML diagrams. Choose a template and edit its source in the schemd playground."
	canonicalPath="/templates"
/>
<article class="page templates">
	<header class="sheet-title">
		<p class="kicker">{t('Choose a diagram')}</p>
		<h1>{t('Starter templates')}</h1>
		<p class="summary">{t('Each template opens as editable source in the playground.')}</p>
	</header>
	<nav aria-label={t('Template families')} class="family-nav">
		{#each families as family}<a href={`#${family}`}>{t(labels[family])}</a>{/each}
	</nav>
	{#each families as family, familyIndex}
		<section id={family} aria-labelledby={`${family}-title`}>
			<h2 id={`${family}-title`}><span class="num">{familyIndex + 1}</span> {t(labels[family])}</h2>
			<div class="template-grid">
				{#each data.templates.filter((item) => item.family === family) as template}
					<article class="template">
						<div class="drawing">{@html template.svg}</div>
						<div class="details">
							<h3>{t(template.title)}</h3>
							<p>{t(template.description)}</p>
							<a class="btn btn-solid" href={href(template.href)}>{t('Open template')}</a>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</article>

<style>
	.templates {
		padding-block: var(--space-8);
	}
	.family-nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-6);
		border-block-end: 1px solid var(--line);
		padding-block: var(--space-4);
	}
	section {
		scroll-margin-top: 5rem;
		padding-block: var(--space-8);
	}
	h2 {
		border-block-end: 2px solid var(--ink);
		padding-block-end: var(--space-3);
	}
	.template-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-6);
	}
	.template {
		border: 1px solid var(--line);
		min-inline-size: 0;
	}
	.drawing {
		display: flex;
		align-items: center;
		justify-content: center;
		block-size: 240px;
		padding: var(--space-4);
		background: var(--wash);
		border-block-end: 1px solid var(--line);
	}
	.drawing :global(svg) {
		inline-size: 100%;
		block-size: 100%;
		max-block-size: 19rem;
	}
	.details {
		padding: var(--space-5);
	}
	.details h3 {
		margin-block: 0 var(--space-2);
	}
	.details p {
		color: var(--ink-mute);
		margin-block-end: var(--space-4);
	}
	@media (max-width: 680px) {
		.template-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
