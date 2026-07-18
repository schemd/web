<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { CORE_REPOSITORY } from '$lib/versioning/manifest';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let softwareSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'SoftwareSourceCode',
		name: '@schemd/core',
		description: 'Zero-dependency text-to-SVG compiler for circuit schematics and UML diagrams.',
		codeRepository: CORE_REPOSITORY,
		programmingLanguage: 'TypeScript',
		runtimePlatform: 'Node.js 24+',
		version: data.metrics.version,
		license: `${CORE_REPOSITORY}/blob/main/LICENSE`,
		author: { '@type': 'Person', name: 'John Owolabi Idogun' }
	});
</script>

<Seo
	title="Schemd — text-to-SVG schematics and UML"
	description="A zero-dependency, framework-agnostic compiler that turns a small text language into accessible, deterministic SVG."
	path="/"
	structuredData={softwareSchema}
/>

<section class="hero page-shell" aria-labelledby="hero-title">
	<div class="hero__copy">
		<p class="eyebrow"><span class="status-dot"></span> Engineering vectors, in plain text</p>
		<h1 id="hero-title">Draw the system.<br />Keep the source.</h1>
		<p class="lede">
			Schemd is a small compiler for circuit schematics and UML. Write a bounded text document; get
			responsive, accessible SVG without a DOM, a framework, or a runtime dependency.
		</p>
		<div class="hero__actions">
			<a class="button button--signal" href="/docs/latest"
				>Start with the grammar <span aria-hidden="true">→</span></a
			>
			<a class="button button--quiet" href="/playground/v0.2.1">Open the playground</a>
		</div>
		<p class="hero__install"><span aria-hidden="true">$</span> bun add @schemd/core</p>
	</div>

	<div class="hero__instrument" aria-label="Live compiler example">
		<div class="instrument-bar">
			<span>sensor-input.schemd</span>
			<span>{data.heroBounds.replace('x', ' × ')}</span>
		</div>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pinned Schemd compiler output from trusted, server-owned source. -->
		<div class="schematic-host">{@html data.circuitSvg}</div>
		<div class="instrument-scale" aria-hidden="true">
			<span>0</span><span>190</span><span>380</span><span>570</span><span>760</span>
		</div>
	</div>
</section>

<section class="signal-strip" aria-label="Verified project measurements">
	<div class="page-shell metrics">
		<dl>
			<div>
				<dt>Stable</dt>
				<dd class="metric-value">v{data.metrics.version}</dd>
			</div>
			<div>
				<dt>Compiler gzip</dt>
				<dd class="metric-value">{data.metrics.compilerGzip}</dd>
			</div>
			<div>
				<dt>npm tarball</dt>
				<dd class="metric-value">{data.metrics.npmTarball}</dd>
			</div>
			<div>
				<dt>Core coverage</dt>
				<dd class="metric-value">{data.metrics.coverage}</dd>
			</div>
			<div>
				<dt>Core tests</dt>
				<dd class="metric-value">{data.metrics.tests}</dd>
			</div>
		</dl>
		<p>
			Measured from core commit <code>29c7769</code>. Compiler gzip and package tarball are
			different budgets.
		</p>
	</div>
</section>

<section class="explain page-shell" aria-labelledby="why-title">
	<div class="section-heading">
		<p class="eyebrow">01 / Why it exists</p>
		<h2 id="why-title">Diagrams should survive the page that first rendered them.</h2>
	</div>
	<div class="explain__body flow">
		<p>
			Most drawing tools keep the picture and hide the intent. Schemd keeps placement, labels,
			ports, and relationships in text you can review beside the code it explains.
		</p>
		<p>
			The compiler parses, validates, routes, and serializes in one deterministic pass. The result
			is plain SVG with an intrinsic <code>viewBox</code>. Use it during a build, on a server, in a
			CLI, or anywhere else JavaScript runs without a browser.
		</p>
		<ul class="trace-list">
			<li>
				<span>01</span><strong>Zero runtime dependencies</strong><small
					>Markdown stays at the host boundary.</small
				>
			</li>
			<li>
				<span>02</span><strong>Framework independent</strong><small
					>React, Vue, Svelte, Angular, or no UI framework.</small
				>
			</li>
			<li>
				<span>03</span><strong>Responsive output</strong><small
					>One coordinate system; the host chooses the display size.</small
				>
			</li>
			<li>
				<span>04</span><strong>Accessible by default</strong><small
					>Each bounded diagram has a title and semantic SVG structure.</small
				>
			</li>
		</ul>
	</div>
</section>

<section class="language page-shell" aria-labelledby="language-title">
	<div class="section-heading">
		<p class="eyebrow">02 / One language</p>
		<h2 id="language-title">
			Circuit paths and software relationships use the same small grammar.
		</h2>
	</div>
	<div class="language__grid">
		<div class="code-surface">
			<div class="instrument-bar"><span>source</span><span>9 statements</span></div>
			<pre><code>{data.heroSource}</code></pre>
		</div>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pinned Schemd compiler output from trusted, server-owned source. -->
		<div class="schematic-host">{@html data.umlSvg}</div>
	</div>
	<div class="capability-index">
		<div>
			<span>A</span>
			<h3>Electrical</h3>
			<p>Passives, analog devices, configurable ICs, ports, and grounds.</p>
		</div>
		<div>
			<span>B</span>
			<h3>Logic + quantum</h3>
			<p>Classical gates, Hadamard, CNOT, and labelled quantum operators.</p>
		</div>
		<div>
			<span>C</span>
			<h3>UML</h3>
			<p>Classes, actors, use cases, states, lifelines, notes, packages, and relations.</p>
		</div>
		<div>
			<span>D</span>
			<h3>Math labels</h3>
			<p>Nested scripts and common engineering symbols without shipping a TeX runtime.</p>
		</div>
	</div>
</section>

<section class="install page-shell" aria-labelledby="install-title">
	<div class="section-heading">
		<p class="eyebrow">03 / Begin</p>
		<h2 id="install-title">Install it with the package manager already in your project.</h2>
	</div>
	<div class="install-grid">
		<div class="install-primary">
			<p>Bun</p>
			<code>bun add @schemd/core</code>
		</div>
		<div>
			<p>npm</p>
			<code>npm install @schemd/core</code>
		</div>
		<div>
			<p>pnpm</p>
			<code>pnpm add @schemd/core</code>
		</div>
		<div>
			<p>Yarn</p>
			<code>yarn add @schemd/core</code>
		</div>
	</div>
	<div class="quick-api">
		<pre><code
				><span class="tok-keyword">import</span> {`{ compileSchematic, parseSchematicFence }`} <span
					class="tok-keyword">from</span
				> <span class="tok-string">'@schemd/core'</span>;

<span class="tok-keyword">const</span> fence = parseSchematicFence(
	<span class="tok-string">'schemd bounds="760x420" title="Sensor input"'</span>
);

<span class="tok-keyword">const</span
				> {`{ svg, document, metrics }`} = compileSchematic(source, fence);</code
			></pre>
		<div class="quick-api__note flow">
			<p class="eyebrow">One public call</p>
			<h3>Parse, validate, route, render.</h3>
			<p>
				The compiler returns the SVG, the immutable document, and useful byte and topology counts.
			</p>
			<a href="/docs/latest">Read the quickstart <span aria-hidden="true">→</span></a>
		</div>
	</div>
</section>

<section class="labs page-shell" aria-labelledby="labs-title">
	<div class="section-heading">
		<p class="eyebrow">04 / Inspect the behaviour</p>
		<h2 id="labs-title">The playground catches syntax. The simulations teach the system.</h2>
	</div>
	<div class="labs__paths">
		<a href="/playground/v0.2.1">
			<span class="path-index">P / 01</span>
			<h3>Playground</h3>
			<p>
				Edit a bounded source, inspect diagnostics, copy or download the SVG, and share the state.
			</p>
			<strong>Compile in a worker <span aria-hidden="true">→</span></strong>
		</a>
		<a href="/simulations/v0.2.1">
			<span class="path-index">S / 05</span>
			<h3>Simulation bench</h3>
			<p>
				Explore digital carry, Bell entanglement, an RC filter, 555 timing, and state teleportation.
			</p>
			<strong>Open the instruments <span aria-hidden="true">→</span></strong>
		</a>
	</div>
</section>

<section class="limits page-shell" aria-labelledby="limits-title">
	<div class="limits__rail" aria-hidden="true"></div>
	<div>
		<p class="eyebrow">05 / Honest edges</p>
		<h2 id="limits-title">Useful now. Still being sharpened.</h2>
	</div>
	<div class="flow">
		<p>
			Schemd has bounded input and output, collision-aware orthogonal routing, and wire bridges. It
			does not yet model explicit electrical nets or junction semantics, and dense routing can still
			expose visual edge cases.
		</p>
		<p>
			Typography is deterministic by estimate rather than by a browser font pass. Built-in symbols
			are intentional, not exhaustive. The public timeline names this work without turning it into a
			release promise.
		</p>
		<div class="limits__links">
			<a class="button button--signal" href="/timeline">Read the implementation timeline</a>
			<a class="button button--quiet" href={CORE_REPOSITORY}>Inspect the core source</a>
		</div>
	</div>
</section>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(19rem, 0.85fr) minmax(27rem, 1.15fr);
		align-items: center;
		gap: clamp(2rem, 5vw, 6rem);
		min-block-size: calc(100svh - var(--header-height));
		padding-block: clamp(4rem, 8vw, 8rem);
	}

	.hero__copy {
		--flow-space: 1.4rem;
	}
	.hero__copy > * + * {
		margin-block-start: var(--flow-space);
	}
	.hero h1 {
		max-inline-size: 12ch;
	}
	.hero__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
	}
	.hero__install {
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--step--1);
	}
	.hero__install span {
		color: var(--signal);
	}
	.hero__instrument {
		min-inline-size: 0;
		border: 1px solid var(--line-strong);
		background: var(--ink-1);
	}
	.instrument-bar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-block-end: 1px solid var(--line);
		padding: 0.65rem 0.8rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}
	.hero__instrument .schematic-host {
		border: 0;
	}
	.instrument-scale {
		display: flex;
		justify-content: space-between;
		border-block-start: 1px solid var(--line);
		padding: 0.3rem 0.6rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.62rem;
	}

	.signal-strip {
		border-block: 1px solid var(--line);
		background: var(--ink-1);
	}
	.metrics {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 2rem;
		padding-block: 1.2rem;
	}
	.metrics dl {
		display: grid;
		grid-template-columns: repeat(5, minmax(6rem, 1fr));
		gap: 1px;
	}
	.metrics dl > div {
		border-inline-start: 1px solid var(--line);
		padding-inline: 0.9rem;
	}
	.metrics dt {
		color: var(--muted);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.metrics dd {
		color: var(--paper);
		font-weight: 650;
	}
	.metrics > p {
		max-inline-size: 28ch;
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.explain,
	.language,
	.install,
	.labs {
		padding-block: clamp(5rem, 10vw, 10rem);
	}
	.explain {
		display: grid;
		grid-template-columns: minmax(16rem, 0.7fr) minmax(20rem, 1fr);
		gap: clamp(2rem, 8vw, 9rem);
	}
	.section-heading {
		display: grid;
		align-content: start;
		gap: 1.2rem;
		max-inline-size: 54rem;
	}
	.explain__body > p {
		max-inline-size: 66ch;
		color: var(--paper-soft);
		font-size: var(--step-1);
	}
	.trace-list {
		display: grid;
		margin: 2.5rem 0 0;
		padding: 0;
		list-style: none;
	}
	.trace-list li {
		display: grid;
		grid-template-columns: 2.5rem minmax(10rem, 0.55fr) 1fr;
		gap: 1rem;
		align-items: baseline;
		border-block-start: 1px solid var(--line);
		padding-block: 1rem;
	}
	.trace-list span {
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.trace-list small {
		color: var(--muted);
	}

	.language {
		border-block: 1px solid var(--line);
	}
	.language__grid {
		display: grid;
		grid-template-columns: minmax(19rem, 0.85fr) minmax(25rem, 1.15fr);
		gap: 1rem;
		margin-block-start: 3rem;
	}
	.code-surface {
		min-inline-size: 0;
		border: 1px solid var(--line);
		background: var(--ink-1);
	}
	.code-surface pre,
	.quick-api pre {
		overflow: auto;
		margin: 0;
		padding: clamp(1rem, 3vw, 2rem);
		color: var(--paper-soft);
		font-size: var(--step--1);
		line-height: 1.8;
	}
	.capability-index {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-block-start: 1rem;
		border-block: 1px solid var(--line);
	}
	.capability-index > div {
		padding: 1.25rem;
	}
	.capability-index > div + div {
		border-inline-start: 1px solid var(--line);
	}
	.capability-index span {
		color: var(--amber);
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
	.capability-index h3 {
		margin-block: 0.75rem 0.45rem;
	}
	.capability-index p {
		color: var(--muted);
		font-size: var(--step--1);
	}

	.install-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin-block-start: 3rem;
		border: 1px solid var(--line);
		background: var(--line);
	}
	.install-grid > div {
		min-inline-size: 0;
		background: var(--ink-1);
		padding: 1.1rem;
	}
	.install-grid p {
		color: var(--muted);
		font-size: var(--step--1);
	}
	.install-grid code {
		display: block;
		overflow: auto;
		margin-block-start: 0.6rem;
		color: var(--paper-soft);
		white-space: nowrap;
	}
	.install-grid .install-primary {
		box-shadow: inset 0 3px var(--signal);
	}
	.quick-api {
		display: grid;
		grid-template-columns: minmax(22rem, 1.3fr) minmax(16rem, 0.7fr);
		margin-block-start: 1rem;
		border: 1px solid var(--line);
		background: var(--ink-1);
	}
	.quick-api__note {
		align-content: center;
		border-inline-start: 1px solid var(--line);
		padding: clamp(1.5rem, 4vw, 3rem);
		color: var(--paper-soft);
	}
	.quick-api__note a {
		color: var(--signal);
		font-weight: 650;
	}
	.tok-keyword {
		color: var(--purple);
	}
	.tok-string {
		color: var(--signal-bright);
	}

	.labs {
		border-block-start: 1px solid var(--line);
	}
	.labs__paths {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		margin-block-start: 3rem;
		border-block: 1px solid var(--line);
	}
	.labs__paths a {
		display: grid;
		gap: 1rem;
		min-block-size: 22rem;
		padding: clamp(1.5rem, 4vw, 3rem);
		text-decoration: none;
	}
	.labs__paths a + a {
		border-inline-start: 1px solid var(--line);
	}
	.labs__paths a:hover {
		background: var(--ink-1);
	}
	.labs__paths h3 {
		align-self: end;
		font-size: var(--step-3);
	}
	.labs__paths p {
		max-inline-size: 44ch;
		color: var(--muted);
	}
	.labs__paths strong {
		color: var(--signal);
	}
	.path-index {
		color: var(--amber);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.limits {
		display: grid;
		grid-template-columns: 4rem minmax(16rem, 0.8fr) minmax(20rem, 1.2fr);
		gap: clamp(2rem, 5vw, 5rem);
		padding-block: clamp(5rem, 10vw, 10rem);
	}
	.limits__rail {
		position: relative;
		border-inline-start: 1px solid var(--line);
	}
	.limits__rail::before,
	.limits__rail::after {
		position: absolute;
		inset-inline-start: -0.3rem;
		inline-size: 0.55rem;
		block-size: 0.55rem;
		border-radius: 50%;
		background: var(--amber);
		content: '';
	}
	.limits__rail::before {
		inset-block-start: 0;
	}
	.limits__rail::after {
		inset-block-end: 0;
	}
	.limits > .flow {
		color: var(--paper-soft);
	}
	.limits__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-block-start: 2rem;
	}

	@media (max-width: 62rem) {
		.hero,
		.explain,
		.language__grid {
			grid-template-columns: 1fr;
		}
		.hero {
			min-block-size: auto;
		}
		.metrics {
			grid-template-columns: 1fr;
		}
		.metrics > p {
			max-inline-size: none;
		}
		.capability-index {
			grid-template-columns: repeat(2, 1fr);
		}
		.capability-index > div:nth-child(3) {
			border-inline-start: 0;
			border-block-start: 1px solid var(--line);
		}
		.capability-index > div:nth-child(4) {
			border-block-start: 1px solid var(--line);
		}
		.install-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.quick-api {
			grid-template-columns: 1fr;
		}
		.quick-api__note {
			border-block-start: 1px solid var(--line);
			border-inline-start: 0;
		}
		.limits {
			grid-template-columns: 1rem 1fr;
		}
		.limits > .flow {
			grid-column: 2;
		}
	}

	@media (max-width: 42rem) {
		.hero__actions,
		.hero__actions .button {
			inline-size: 100%;
		}
		.metrics dl {
			grid-template-columns: repeat(2, 1fr);
			row-gap: 1rem;
		}
		.trace-list li {
			grid-template-columns: 2rem 1fr;
		}
		.trace-list small {
			grid-column: 2;
		}
		.capability-index,
		.install-grid,
		.labs__paths {
			grid-template-columns: 1fr;
		}
		.capability-index > div + div,
		.capability-index > div:nth-child(3),
		.labs__paths a + a {
			border-block-start: 1px solid var(--line);
			border-inline-start: 0;
		}
		.labs__paths a {
			min-block-size: 18rem;
		}
	}
</style>
