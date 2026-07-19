<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import Pronunciation from '$lib/components/Pronunciation.svelte';

	let { data }: PageProps = $props();
</script>

<Seo
	title="schemd — deterministic text-to-SVG engineering vectors"
	description="A zero-dependency, server-native compiler for electronic, logic, quantum, and UML schematics."
	canonical="https://schemd.johnowolabiidogun.dev/"
/>

<article class="landing">
	<section class="hero-grid" aria-labelledby="hero-title">
		<div class="hero-copy">
			<p class="eyebrow"><span>PKG</span> @schemd/core · {data.platform.currentVersion}</p>
			<h1 id="hero-title">
				Engineering diagrams,<br />
				<span>compiled—not drawn.</span>
			</h1>
			<p class="hero-lede">
				A deterministic text-to-SVG compiler built for electrical systems, logic networks, quantum
				circuits, and software architecture. No DOM. No runtime dependencies. No canvas ambiguity.
			</p>
			<Pronunciation />
			<div class="hero-actions">
				<a class="button signal" href={`/playground/${data.platform.currentVersion}`}
					>Open compiler</a
				>
				<a class="button ghost" href={`/docs/${data.platform.currentVersion}/overview`}
					>Read the contract</a
				>
			</div>
			<dl class="hero-metrics">
				<div>
					<dt>Runtime deps</dt>
					<dd>0</dd>
				</div>
				<div>
					<dt>Compiler modes</dt>
					<dd>3</dd>
				</div>
				<div>
					<dt>SSR fidelity</dt>
					<dd>100%</dd>
				</div>
				<div>
					<dt>Current</dt>
					<dd>{data.platform.currentVersion}</dd>
				</div>
			</dl>
		</div>

		<div class="hero-terminal">
			<header>
				<div><i></i><i></i><i></i></div>
				<span>signal-chain.schemd</span>
				<small>SSR · {Math.round(data.hero.metrics.svgBytes / 1024)} KiB</small>
			</header>
			<div class="hero-canvas">
				{@html data.hero.svg}
			</div>
			<footer>
				<span class="status-light"></span>
				COMPILED {data.hero.metrics.components} NODES / {data.hero.metrics.connections} NETS
				<em>00 ERRORS</em>
			</footer>
		</div>
	</section>

	<section class="capability-strip" aria-label="Compiler capabilities">
		<p>ONE GRAMMAR</p>
		<ul>
			<li><span>01</span>Electrical</li>
			<li><span>02</span>Digital logic</li>
			<li><span>03</span>Quantum</li>
			<li><span>04</span>UML systems</li>
		</ul>
	</section>

	<section class="manifesto-grid">
		<header>
			<p class="eyebrow">COMPILER PHILOSOPHY / 001</p>
			<h2>Vector output with a verifiable contract.</h2>
		</header>
		<div class="manifesto-copy">
			<p>
				Most diagramming systems hide geometry behind an editor. schemd exposes it as text,
				validates it on the server, and emits intrinsic SVG that is stable before the first browser
				paint.
			</p>
			<a href={`/docs/${data.platform.currentVersion}/output-modes`}>Inspect output budgets →</a>
		</div>
		<ol class="compiler-passes">
			<li>
				<span>01</span>
				<div>
					<strong>Parse</strong>
					<p>Strict lexical boundaries and bounded source budgets.</p>
				</div>
				<code>AST</code>
			</li>
			<li>
				<span>02</span>
				<div>
					<strong>Route</strong>
					<p>Orthogonal geometry, collision envelopes, and wire bridges.</p>
				</div>
				<code>AABB</code>
			</li>
			<li>
				<span>03</span>
				<div>
					<strong>Emit</strong>
					<p>Static, styled, or semantically interactive SVG.</p>
				</div>
				<code>SVG</code>
			</li>
		</ol>
	</section>

	<section class="mode-matrix">
		<header>
			<p class="eyebrow">OUTPUT BUDGET MATRIX</p>
			<h2>Ship only the semantics you consume.</h2>
		</header>
		<div class="mode-cards">
			<article>
				<small>PASS / 01</small>
				<h3>Default</h3>
				<p>Compact, static vectors for documentation and export.</p>
				<code>mode: "default"</code>
			</article>
			<article>
				<small>PASS / 02</small>
				<h3>Embedded CSS</h3>
				<p>Isolated surface, grid, focus, and calibrated signal styling.</p>
				<code>mode: "embedded-css"</code>
			</article>
			<article class="featured">
				<small>PASS / 03</small>
				<h3>Full metadata</h3>
				<p>Node, port, and wire hooks for delegated interaction.</p>
				<code>mode: "full"</code>
			</article>
		</div>
	</section>

	<section class="lab-cta">
		<div>
			<p class="eyebrow">LIVE ENGINEERING ENVIRONMENT</p>
			<h2>Stop admiring diagrams.<br />Interrogate them.</h2>
		</div>
		<p>
			Five deterministic simulation labs pair full-mode SVG with instruments, probes, state
			machines, and fault injection—without a charting or editor dependency.
		</p>
		<a class="button signal" href={`/simulations/${data.platform.currentVersion}`}
			>Enter laboratory</a
		>
	</section>
</article>
