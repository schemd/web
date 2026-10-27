<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	/**
	 * The end matter every reading page closes with: where else to go, and the
	 * revision, licence and source of the figures on the page.
	 *
	 * It reports, never asserts: the registry line reads `registryLive`, so a
	 * page served while npm is unreachable says so instead of implying live
	 * figures.
	 */

	interface Props {
		/** Newest published release, for version-pinned links. */
		latest: string;
		/** Newest documented docs line, which is not always the newest release. */
		docLine: string;
		/** Whether the last registry poll actually reached npm. */
		registryLive: boolean;
		/** Published releases the registry knows about. */
		releases: number;
	}

	let { latest, docLine, registryLive, releases }: Props = $props();

	const columns = $derived([
		{
			heading: 'Documentation',
			links: [
				{ label: 'Quickstart', href: `/docs/${docLine}/overview` },
				{ label: 'Grammar', href: `/docs/${docLine}/grammar` },
				{ label: 'Component API', href: `/docs/${docLine}/component-reference` },
				{ label: 'Resource budgets', href: `/docs/${docLine}/limits` },
				{ label: 'Roadmap', href: `/docs/${docLine}/roadmap` }
			]
		},
		{
			heading: 'Tools',
			links: [
				{ label: 'Playground', href: `/playground/${latest}` },
				{ label: 'Inspector', href: `/inspector/${latest}` },
				{ label: 'Components', href: '/components' },
				{ label: 'Labs', href: `/simulations/${latest}` },
				{ label: 'Examples', href: '/examples' },
				{ label: 'Compare releases', href: `/diff/${latest}` }
			]
		},
		{
			heading: 'Evidence',
			links: [
				{ label: 'Changelog', href: '/changelog' },
				{ label: 'Language coverage', href: '/coverage' },
				{ label: 'Conformance', href: '/conformance' },
				{ label: 'Install telemetry', href: '/downloads' }
			]
		}
	]);

	const elsewhere = [
		{ label: 'GitHub', href: 'https://github.com/schemd/core' },
		{ label: 'npm', href: 'https://www.npmjs.com/package/@schemd/core' },
		{ label: 'Author', href: 'https://www.johnowolabiidogun.dev' }
	];

	const year = new Date().getFullYear();
</script>

<footer class="end page">
	<div class="columns">
		<div class="about">
			<p class="name">{t('schemd')}</p>
			<p>
				{t(
					'A text-to-schematic compiler with no dependencies. Every drawing on this site is compiled by the release it documents.'
				)}
			</p>
			<ul class="elsewhere">
				{#each elsewhere as link (link.href)}
					<li>
						<a href={href(link.href)} rel="noopener" target="_blank">{t(link.label)}</a>
					</li>
				{/each}
			</ul>
		</div>

		{#each columns as column (column.heading)}
			<nav aria-label={t(column.heading)}>
				<h2>{t(column.heading)}</h2>
				<ul>
					{#each column.links as link (link.href)}
						<li><a href={href(link.href)}>{t(link.label)}</a></li>
					{/each}
				</ul>
			</nav>
		{/each}
	</div>

	<p class="imprint">
		{t('Revision')} <span class="tabular">{t(latest)}</span>{t(', documentation line')}
		<span class="tabular">{t(docLine)}</span>, {t(releases)}
		{t('releases recorded.')}
		{registryLive
			? t('Release figures are read from npm.')
			: t('npm could not be reached, so release figures may be out of date.')}
		{t('MIT licence, ©')}
		{t(year)}
		{t('John Owolabi Idogun.')}
	</p>
</footer>

<style>
	/* The footer lies on the table below the page sheet, not on a sheet. */
	.end {
		margin-block-start: var(--space-8);
		padding-block: var(--space-6) var(--space-12);
		font-size: var(--text-sm);
	}

	.columns {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
		gap: var(--space-8);
	}

	.name {
		margin: 0 0 var(--space-2);
		font-weight: 800;
		font-size: var(--text-md);
		letter-spacing: -0.035em;
	}

	.about p {
		max-inline-size: 40ch;
	}

	h2 {
		font-size: var(--text-sm);
		margin-block-end: var(--space-2);
		color: var(--ink-mute);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;

		& li {
			margin-block: var(--space-1);
		}
	}

	a {
		color: var(--ink);

		&:hover {
			color: var(--accent);
		}
	}

	.elsewhere {
		display: flex;
		gap: var(--space-4);
	}

	.imprint {
		margin: var(--space-8) 0 0;
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--edge);
		color: var(--ink-mute);
	}

	@media (max-width: 760px) {
		.columns {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}

		.about {
			grid-column: 1 / -1;
		}
	}
</style>
