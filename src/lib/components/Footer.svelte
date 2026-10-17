<script lang="ts">
	/**
	 * The title block: every reading page ends in it.
	 *
	 * A drawing sheet keeps its state in one box in the corner — project,
	 * revision, sheet, who drew it — and this is that box for the site. Before
	 * it existed, three pages ended in three different hand-rolled `<aside>`
	 * feet and the rest ended in nothing, so "what else is here" depended on
	 * where you landed. One component mounted once in the layout makes the
	 * answer the same everywhere.
	 *
	 * It reports, never asserts: the registry cell reads `registryLive`, so a
	 * page served while npm is unreachable says so instead of implying live
	 * figures.
	 */
	import { page } from '$app/state';

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
			heading: 'Instruments',
			links: [
				{ label: 'Playground', href: `/playground/${latest}` },
				{ label: 'Inspector', href: `/inspector/${latest}` },
				{ label: 'Simulation lab', href: `/simulations/${latest}` },
				{ label: 'Examples', href: '/examples' },
				{ label: 'Diff', href: `/diff/${latest}` }
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

	/* The sheet this page is: its first path segment, as a drawing would title it. */
	const sheet = $derived.by(() => {
		const segment = page.url.pathname.split('/').filter(Boolean)[0];
		return segment === undefined ? 'Home' : segment[0]!.toUpperCase() + segment.slice(1);
	});

	const year = new Date().getFullYear();
</script>

<footer class="title-block" aria-label="Title block">
	<div class="tb">
		<div class="cell project">
			<span class="microlabel">Project</span>
			<span class="brand">schemd</span>
			<p class="blurb">
				A zero-dependency text-to-SVG compiler for schematics and UML. Every drawing on this site is
				compiled by the engine it documents.
			</p>
			<ul class="elsewhere">
				{#each elsewhere as link (link.href)}
					<li>
						<a href={link.href} rel="noopener" target="_blank">{link.label}</a>
					</li>
				{/each}
			</ul>
		</div>

		<div class="cell">
			<span class="microlabel">Drawn by</span><span class="value mono">@schemd/core {latest}</span>
		</div>
		<div class="cell"><span class="microlabel">Sheet</span><span class="value">{sheet}</span></div>
		<div class="cell">
			<span class="microlabel">Docs line</span><span class="value mono">{docLine}</span>
		</div>
		<div class="cell">
			<span class="microlabel">Registry</span>
			<span class="value registry" class:offline={!registryLive}>
				<span class="registry-dot" aria-hidden="true"></span>
				{registryLive ? 'synced' : 'unreachable — figures may be stale'}
			</span>
		</div>
		<div class="cell">
			<span class="microlabel">Releases</span><span class="value mono">{releases} tracked</span>
		</div>
		<div class="cell">
			<span class="microlabel">Licence</span><span class="value"
				>MIT © {year} John Owolabi Idogun</span
			>
		</div>

		{#each columns as column (column.heading)}
			<nav class="cell links" aria-label={column.heading}>
				<h3 class="microlabel">{column.heading}</h3>
				<ul>
					{#each column.links as link (link.href)}
						<li><a href={link.href}>{link.label}</a></li>
					{/each}
				</ul>
			</nav>
		{/each}
	</div>
</footer>

<style>
	.title-block {
		margin-block-start: var(--space-16);
		padding: 0 clamp(1rem, 4vw, 2.5rem) var(--space-12);
	}

	/* Ruled like a real title block: every cell shares its borders. */
	.tb {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
		max-inline-size: 1360px;
		margin-inline: auto;
		border: 1px solid var(--line-strong);
		background: var(--bg-raised);
	}

	.cell {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		border-inline-start: 1px solid var(--line-strong);
		border-block-start: 1px solid var(--line-strong);
		min-inline-size: 0;
	}

	.project {
		grid-row: span 2;
		border-inline-start: 0;
		border-block-start: 0;
	}

	.tb > .cell:nth-child(2),
	.tb > .cell:nth-child(3),
	.tb > .cell:nth-child(4) {
		border-block-start: 0;
	}

	.tb > nav:last-of-type {
		grid-column: span 2;
	}

	.tb > .links:nth-of-type(1) {
		border-inline-start: 0;
	}

	.brand {
		font-size: var(--text-lg);
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}

	.blurb {
		margin: 0;
		color: var(--ink-mute);
		font-size: var(--text-sm);
		max-inline-size: 46ch;
		line-height: 1.55;
	}

	.value {
		font-size: var(--text-base);
		color: var(--ink);
	}

	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	.elsewhere {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.links h3 {
		margin: 0;
	}

	.links ul {
		display: grid;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.title-block a {
		display: inline-block;
		padding-block: 0.2rem;
		color: var(--ink-mute);
		font-size: var(--text-sm);
		text-decoration: none;

		&:hover,
		&:focus-visible {
			color: var(--accent);
		}
	}

	.registry {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.registry-dot {
		inline-size: 7px;
		block-size: 7px;
		border-radius: 50%;
		background: var(--ok);
	}

	.registry.offline {
		color: var(--warn);
	}

	.registry.offline .registry-dot {
		background: var(--warn);
	}

	@media (max-width: 900px) {
		.tb {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.project,
		.tb > nav:last-of-type {
			grid-column: 1 / -1;
			grid-row: auto;
		}

		.tb > .cell {
			border-block-start: 1px solid var(--line-strong) !important;
			border-inline-start: 0;
		}

		.tb > .cell:nth-child(odd):not(.project) {
			border-inline-start: 1px solid var(--line-strong);
		}

		.project {
			border-block-start: 0 !important;
		}
	}

	@media (max-width: 520px) {
		.tb {
			grid-template-columns: minmax(0, 1fr);
		}

		.tb > .cell:nth-child(odd):not(.project) {
			border-inline-start: 0;
		}
	}
</style>
