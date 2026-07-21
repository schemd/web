<script lang="ts">
	/**
	 * Ultra-premium error surface, rendered as a compiler diagnostic.
	 *
	 * schemd is a compiler, so an unroutable URL is presented the way the engine
	 * presents an unroutable net: a dead-ended schematic trace plus a source-line
	 * diagnostic in the compiler's own voice. The status band selects the copy;
	 * everything is theme-aware, vanilla-CSS, and reduced-motion safe.
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const status = $derived(page.status);
	const path = $derived(page.url.pathname);
	const detail = $derived(page.error?.message ?? 'Unknown fault');

	/** Status-banded diagnostic identity. */
	const band = $derived.by(() => {
		if (status === 404)
			return {
				code: 'ENOROUTE',
				headline: 'No route to this node',
				note: 'The path you followed resolves to no component in the document. It may have moved, been renamed, or never been laid out.',
				hint: 'net not found'
			};
		if (status >= 500)
			return {
				code: 'EFAULT',
				headline: 'The compiler faulted',
				note: 'A pass raised before it could emit. This is on us, not on you — the request was well-formed but the server tripped.',
				hint: 'unexpected throw in render pass'
			};
		if (status === 403)
			return {
				code: 'EACCESS',
				headline: 'This port is closed',
				note: 'You reached a real node, but its terminal is not exposed on the public net.',
				hint: 'terminal not exported'
			};
		return {
			code: 'ESIGNAL',
			headline: 'Unexpected signal',
			note: 'The request completed, but the response carried a status the client could not route.',
			hint: 'unhandled status'
		};
	});

	const links = [
		{ href: '/', label: 'Home', key: 'h', kbd: 'H' },
		{ href: '/docs/latest/overview', label: 'Docs', key: 'd', kbd: 'D' },
		{ href: '/playground/latest', label: 'Playground', key: 'p', kbd: 'P' }
	];

	/** Single-key recovery shortcuts, ignored while the user is typing. */
	function onKey(event: KeyboardEvent): void {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target;
		if (target instanceof HTMLElement && target.isContentEditable) return;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
		const match = links.find((link) => link.key === event.key.toLowerCase());
		if (match) {
			event.preventDefault();
			void goto(match.href);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>{status} · {band.headline} · schemd</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="fault grid-backdrop" aria-labelledby="fault-title">
	<div class="fault-inner">
		<!-- Dead-ended schematic trace: a signal enters, bridges a crossing, and
		     terminates at an open node — the visual grammar of an unrouted net. -->
		<svg
			class="motif"
			viewBox="0 0 320 120"
			role="img"
			aria-label="A schematic trace ending at an open, unconnected terminal"
		>
			<defs>
				<pattern id="fault-grid" width="20" height="20" patternUnits="userSpaceOnUse">
					<path class="motif-grid" d="M20 0H0V20" />
				</pattern>
			</defs>
			<rect x="0" y="0" width="320" height="120" fill="url(#fault-grid)" />

			<!-- Source terminal -->
			<circle class="motif-node" cx="26" cy="60" r="5" />
			<!-- Live trace with an engineering bridge over a crossing -->
			<path class="motif-wire" d="M31 60 H120 A5 5 0 0 1 130 60 H150 A5 5 0 0 0 160 60 H214" />
			<!-- Crossing signal (vertical) -->
			<path class="motif-cross" d="M140 20 V100" />
			<!-- Animated signal pulse riding the trace up to the break -->
			<path class="motif-pulse" d="M31 60 H214" />
			<!-- The break: an open terminal, unconnected -->
			<circle class="motif-open" cx="224" cy="60" r="9" />
			<path class="motif-slash" d="M218 54 L230 66 M230 54 L218 66" />
			<!-- Dangling stub past the break -->
			<path class="motif-stub" d="M233 60 H300" stroke-dasharray="4 6" />
		</svg>

		<p class="eyebrow microlabel">{band.code} · status {status}</p>
		<h1 id="fault-title">
			<span class="status-code">{status}</span>
			<span class="headline">{band.headline}</span>
		</h1>
		<p class="note">{band.note}</p>

		<!-- The compiler's own diagnostic idiom, applied to the failed request. -->
		<figure class="diagnostic" aria-label="Compiler-style diagnostic">
			<pre><code
					><span class="d-head">schemd: {band.code.toLowerCase()}: {detail}</span>
<span class="d-gutter">  request │</span> <span class="d-verb">GET</span> {path}
<span class="d-gutter">        │</span> <span class="d-caret"
						>{'^'.repeat(Math.min(path.length, 48))}</span
					> <span class="d-hint">{band.hint}</span></code
				></pre>
		</figure>

		<nav class="actions" aria-label="Recover">
			{#each links as link, index (link.href)}
				<a class="action" class:primary={index === 0} href={link.href}>
					<span>{link.label}</span>
					<kbd>{link.kbd}</kbd>
				</a>
			{/each}
		</nav>
	</div>
</section>

<style>
	.fault {
		min-block-size: calc(100vh - var(--header-h));
		display: grid;
		place-items: center;
		padding: clamp(1.5rem, 5vw, 4rem);
	}

	.fault-inner {
		inline-size: min(100%, 620px);
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-4);
		animation: sweep-in var(--dur-kinetic) var(--ease-kinetic) both;
	}

	/* ---------- Schematic motif ---------- */
	.motif {
		inline-size: min(100%, 340px);
		block-size: auto;
		margin-block-end: var(--space-2);
	}

	.motif-grid {
		fill: none;
		stroke: var(--grid-dot);
		stroke-width: 1;
		opacity: 0.5;
	}

	.motif-wire,
	.motif-cross,
	.motif-stub {
		fill: none;
		stroke: var(--ink-mute);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.motif-cross {
		opacity: 0.4;
	}

	.motif-node {
		fill: var(--accent);
	}

	.motif-open {
		fill: var(--bg);
		stroke: var(--danger);
		stroke-width: 2;
		animation: fault-breathe 2.6s var(--ease-precise) infinite;
	}

	.motif-slash {
		stroke: var(--danger);
		stroke-width: 2;
		stroke-linecap: round;
	}

	/* A signal pulse that races the live trace and stops dead at the break. */
	.motif-pulse {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-dasharray: 26 999;
		filter: drop-shadow(0 0 5px var(--glow));
		animation: fault-signal 2.6s var(--ease-precise) infinite;
	}

	@keyframes fault-signal {
		0% {
			stroke-dashoffset: 210;
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
		62%,
		100% {
			stroke-dashoffset: 0;
			opacity: 0;
		}
	}

	@keyframes fault-breathe {
		0%,
		100% {
			filter: drop-shadow(0 0 1px transparent);
		}
		50% {
			filter: drop-shadow(0 0 7px var(--danger));
		}
	}

	/* ---------- Headline ---------- */
	.eyebrow {
		color: var(--danger);
		letter-spacing: 0.14em;
	}

	h1 {
		display: grid;
		gap: var(--space-2);
		justify-items: center;
		margin: 0;
	}

	.status-code {
		font-family: var(--font-mono);
		font-size: clamp(3.5rem, 14vw, 6rem);
		line-height: 0.9;
		font-weight: 700;
		letter-spacing: -0.04em;
		color: var(--ink);
		background: linear-gradient(180deg, var(--ink) 0%, var(--ink-mute) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.headline {
		font-size: clamp(var(--text-lg), 4vw, var(--text-2xl));
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--ink);
	}

	.note {
		margin: 0;
		max-inline-size: 46ch;
		color: var(--ink-mute);
		line-height: 1.6;
	}

	/* ---------- Compiler diagnostic card ---------- */
	.diagnostic {
		margin: var(--space-2) 0 0;
		inline-size: 100%;
		text-align: start;
		background: var(--bg-inset);
		border: 1px solid var(--line);
		border-inline-start: 3px solid var(--danger);
		overflow-x: auto;

		& pre {
			margin: 0;
			padding: var(--space-3) var(--space-4);
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			line-height: 1.7;
			color: var(--ink-mute);
			white-space: pre;
		}
	}

	.d-head {
		color: var(--danger);
	}

	.d-gutter {
		color: var(--ink-faint);
	}

	.d-verb {
		color: var(--accent-2);
	}

	.d-caret {
		color: var(--danger);
	}

	.d-hint {
		color: var(--ink-faint);
		font-style: italic;
	}

	/* ---------- Recovery actions ---------- */
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin-block-start: var(--space-2);
	}

	.action {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0.55rem 0.9rem;
		font-size: var(--text-sm);
		font-weight: 560;
		color: var(--ink);
		background: var(--bg-panel);
		border: 1px solid var(--line-strong);
		transition:
			border-color var(--dur-fast) var(--ease-precise),
			transform var(--dur-fast) var(--ease-precise),
			background-color var(--dur-fast) var(--ease-precise);

		&:hover {
			text-decoration: none;
			transform: translateY(-2px);
			border-color: var(--accent);
		}

		&.primary {
			color: var(--accent-ink);
			background: var(--accent);
			border-color: var(--accent);
		}

		& kbd {
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			padding: 0.05em 0.4em;
			color: var(--ink-faint);
			background: var(--bg-inset);
			border: 1px solid var(--line);
			border-radius: 3px;
		}

		&.primary kbd {
			color: var(--accent-ink);
			background: color-mix(in srgb, var(--accent-ink) 16%, transparent);
			border-color: transparent;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fault-inner {
			animation: none;
		}

		.motif-pulse,
		.motif-open {
			animation: none;
		}

		.motif-pulse {
			opacity: 0;
		}
	}
</style>
