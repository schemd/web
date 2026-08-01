<script lang="ts">
	/**
	 * The site's base plate — the header bezel's counterpart.
	 *
	 * Before this existed, three pages ended in three different hand-rolled
	 * `<aside>` feet and the rest ended in nothing at all, so "what else is
	 * here" depended on which page you happened to land on. One component
	 * mounted once in the layout is what makes that answer the same everywhere.
	 *
	 * It carries its own status line rather than asserting freshness: the
	 * registry indicator reads `registryLive`, so a footer served while npm is
	 * unreachable says so instead of implying live data.
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
			heading: 'Instruments',
			links: [
				{ label: 'Playground', href: `/playground/${latest}` },
				{ label: 'Inspector', href: `/inspector/${latest}` },
				{ label: 'Simulation lab', href: `/simulations/${latest}` },
				{ label: 'Examples', href: '/examples' },
				{ label: 'Diff', href: '/diff' }
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

<footer class="site-footer" aria-label="Site footer">
	<hr class="signal-rule" />

	<div class="footer-inner">
		<div class="footer-identity">
			<span class="footer-brand">schemd</span>
			<p class="footer-blurb">
				A zero-dependency text-to-SVG compiler for schematics and UML. Every diagram on this site is
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

		{#each columns as column (column.heading)}
			<nav class="footer-column" aria-label={column.heading}>
				<h3 class="microlabel">{column.heading}</h3>
				<ul>
					{#each column.links as link (link.href)}
						<li><a href={link.href}>{link.label}</a></li>
					{/each}
				</ul>
			</nav>
		{/each}
	</div>

	<div class="footer-status hairline-x">
		<span class="microlabel">
			engine v{latest} · docs line {docLine} · {releases} releases tracked
		</span>
		<span class="microlabel registry" class:offline={!registryLive}>
			<span class="registry-dot" aria-hidden="true"></span>
			{registryLive ? 'registry synced' : 'registry unreachable — figures may be stale'}
		</span>
		<span class="microlabel">MIT © {year} John Owolabi Idogun</span>
	</div>
</footer>

<style>
	.site-footer {
		margin-block-start: var(--space-16);
		background-color: var(--bg-raised);
		border-block-start: 1px solid var(--line);
	}

	.signal-rule {
		/* The header terminates in this same rule; the footer opens with it
		   mirrored, so the page reads as one instrument closed at both ends. */
		transform: scaleX(-1);
	}

	.footer-inner {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr));
		gap: var(--space-8);
		padding: var(--space-12) clamp(1rem, 4vw, 3rem) var(--space-8);
		max-inline-size: 1180px;
		margin-inline: auto;
	}

	.footer-brand {
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		letter-spacing: var(--tracking-wide);
		color: var(--ink);
	}

	.footer-blurb {
		margin: var(--space-3) 0 var(--space-4);
		color: var(--ink-mute);
		font-size: var(--text-sm);
		max-inline-size: 42ch;
	}

	.elsewhere {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.footer-column h3 {
		margin: 0 0 var(--space-3);
	}

	.footer-column ul {
		display: grid;
		gap: var(--space-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.site-footer a {
		color: var(--ink-mute);
		font-size: var(--text-sm);
		text-decoration: none;

		&:hover,
		&:focus-visible {
			color: var(--accent);
		}
	}

	.footer-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-4) clamp(1rem, 4vw, 3rem);
		max-inline-size: 1180px;
		margin-inline: auto;
	}

	.registry {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.registry-dot {
		inline-size: 6px;
		block-size: 6px;
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
		.footer-inner {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-6);
			padding: var(--space-8) var(--space-5) var(--space-6);
		}

		.footer-status {
			padding: var(--space-4) var(--space-5);
		}
	}

	@media (max-width: 560px) {
		.footer-inner {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
