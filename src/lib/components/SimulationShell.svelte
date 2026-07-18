<script lang="ts">
	import type { Snippet } from 'svelte';
	import Seo from './Seo.svelte';
	import { breadcrumbSchema } from '$lib/seo';
	import {
		faultLabel,
		oscilloscopePath,
		type FaultMode,
		type ProbeMetric,
		type WaveformKind
	} from '$lib/simulations/instrumentation';

	interface Props {
		version: string;
		slug: string;
		domain: string;
		title: string;
		summary: string;
		idea: string;
		docsPath: string;
		svg: string;
		fault?: FaultMode;
		waveform?: WaveformKind;
		traceRate?: number;
		traceIntensity?: number;
		pulseTargetId?: string;
		pulsePeriodSeconds?: number;
		probeMetrics?: readonly ProbeMetric[];
		onTargetActivate?: (label: string) => void;
		children: Snippet;
	}

	let {
		version,
		slug,
		domain,
		title,
		summary,
		idea,
		docsPath,
		svg,
		fault = $bindable<FaultMode>('none'),
		waveform = 'logic',
		traceRate = 0.25,
		traceIntensity = 1,
		pulseTargetId,
		pulsePeriodSeconds = 1,
		probeMetrics = [],
		onTargetActivate,
		children
	}: Props = $props();
	let path = $derived(`/simulations/${version}/${slug}`);
	let phase = $state(0);
	let probeActive = $state(false);
	let probeTarget = $state('No test point selected');
	let scopePath = $derived(oscilloscopePath(waveform, phase));
	let selectedElement: Element | undefined;
	let schema = $derived(
		breadcrumbSchema([
			{ name: 'Schemd', path: '/' },
			{ name: 'Simulations', path: `/simulations/${version}` },
			{ name: title, path }
		])
	);

	function targetFromEvent(event: Event): Element | undefined {
		if (!(event.target instanceof Element)) return undefined;
		return (
			event.target.closest(
				'.schematic-component, .schematic-wire, [data-schemd-component], [data-schemd-connection]'
			) ?? undefined
		);
	}

	function selectProbeTarget(event: Event): void {
		if (!probeActive) return;
		const target = targetFromEvent(event);
		if (!target) return;
		selectedElement?.classList.remove('is-selected');
		target.classList.add('is-selected');
		selectedElement = target;
		const label = target.getAttribute('aria-label') ?? target.id ?? 'Unnamed schematic target';
		probeTarget = label;
		onTargetActivate?.(label);
		if (fault !== 'none') {
			fault = 'none';
			probeTarget = `Repaired ${label}`;
		}
	}

	function handleDiagramKey(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!targetFromEvent(event)) return;
		event.preventDefault();
		selectProbeTarget(event);
	}

	function repairCircuit(): void {
		fault = 'none';
		selectedElement?.classList.remove('is-selected');
		selectedElement = undefined;
		probeTarget = 'Circuit restored to nominal state';
	}

	$effect(() => {
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		if (motion.matches) {
			phase = 0;
			return;
		}
		let frame = 0;
		let previous = performance.now();
		const tick = (time: number): void => {
			const elapsed = Math.min(64, time - previous);
			previous = time;
			if (!document.hidden)
				phase = (phase + (elapsed * Math.max(0.05, Math.min(4, traceRate))) / 1000) % 1;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<Seo title={`${title} — Schemd ${version}`} description={summary} {path} structuredData={schema} />

<div class="simulation-page page-shell">
	<header class="simulation-header">
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<ol>
				<li><a href="/">Home</a></li>
				<li><a href={`/simulations/${version}`}>Simulations {version}</a></li>
				<li aria-current="page">{title}</li>
			</ol>
		</nav>
		<p class="eyebrow">{domain} / {version}</p>
		<h1>{title}</h1>
		<p class="lede">{summary}</p>
		<div class="idea">
			<strong>One idea</strong>
			<p>{idea}</p>
		</div>
	</header>
	<div class="simulation-grid">
		<section class="simulation-controls" aria-label={`${title} controls and readout`}>
			{@render children()}
		</section>
		<div class="simulation-visual">
			<aside class="instrument-deck" aria-label="Diagnostic instrumentation">
				<div class="scope">
					<div class="scope__bar">
						<span>SCM-01</span><strong>60 FPS VECTOR SCOPE</strong><i
							class:active={fault === 'none'}
						></i>
					</div>
					<svg
						viewBox="0 0 240 140"
						role="img"
						aria-label={`${waveform} diagnostic waveform`}
						preserveAspectRatio="none"
					>
						<title>{waveform} diagnostic waveform</title>
						<path
							class="scope-grid"
							d="M0 35H240M0 70H240M0 105H240M60 0V140M120 0V140M180 0V140"
						/>
						<path class="scope-trace" d={scopePath} />
					</svg>
				</div>
				<div class="instrument-controls">
					<label for={`fault-${slug}`}>Fault injection</label>
					<select id={`fault-${slug}`} bind:value={fault}>
						<option value="none">Nominal</option><option value="short-ground"
							>Short to Ground</option
						><option value="open-circuit">Open Circuit</option><option value="degraded-resistor"
							>Degraded Resistor</option
						>
					</select>
					<div>
						<button
							type="button"
							aria-pressed={probeActive}
							onclick={() => (probeActive = !probeActive)}
							>Logic probe {probeActive ? 'armed' : 'off'}</button
						><button type="button" onclick={repairCircuit}>Repair</button>
					</div>
				</div>
			</aside>
			<figure
				class="simulation-diagram"
				data-fault={fault}
				class:probe-active={probeActive}
				class:has-pulse={pulseTargetId !== undefined}
				data-pulse-target={pulseTargetId}
				style={`--trace-intensity:${Math.max(0.12, Math.min(1, traceIntensity))};--pulse-period:${Math.max(0.12, Math.min(12, pulsePeriodSeconds))}s`}
			>
				<div class="instrument-bar">
					<span>Schemd output · full mode</span><span>{faultLabel(fault)}</span>
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions (events delegate to keyboard-focusable semantic SVG children) -->
				<div
					class="schematic-host"
					role="group"
					aria-label="Interactive full-mode schematic"
					onclick={selectProbeTarget}
					onkeydown={handleDiagramKey}
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pinned Schemd compiler output from trusted, server-owned source. -->
					{@html svg}
				</div>
				<figcaption>
					The diagram is compiled by {version}; delegated pointer and keyboard events inspect its
					full-mode semantic hooks.
				</figcaption>
			</figure>
		</div>
	</div>
	<aside class="probe-hud" aria-label="Virtual logic probe and multimeter" aria-live="polite">
		<div>
			<span class:armed={probeActive}></span>
			<p>
				<strong>{probeActive ? 'PROBE ARMED' : 'PROBE STANDBY'}</strong><small>{probeTarget}</small>
			</p>
		</div>
		<dl>
			{#each probeMetrics as metric (metric.label)}<div>
					<dt>{metric.label}</dt>
					<dd>{metric.value}</dd>
				</div>{/each}
			<div>
				<dt>Fault</dt>
				<dd>{faultLabel(fault)}</dd>
			</div>
		</dl>
	</aside>
	<nav class="simulation-footer" aria-label="Related simulation links">
		<a href={`/simulations/${version}`}>← All simulations</a><a href={docsPath}
			>Relevant documentation →</a
		>
	</nav>
</div>

<style>
	.simulation-page {
		padding-block: 3rem 6rem;
	}
	.simulation-header {
		display: grid;
		gap: 1.15rem;
		max-inline-size: 68rem;
		padding-block: 2rem 4rem;
	}
	.simulation-header h1 {
		max-inline-size: 13ch;
		font-size: var(--step-3);
	}
	.idea {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: 1rem;
		max-inline-size: 52rem;
		border-inline-start: 3px solid var(--amber);
		background: rgb(225 161 92 / 0.07);
		padding: 1rem;
		color: var(--paper-soft);
	}
	.idea strong {
		color: var(--amber);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
	}
	.simulation-grid {
		display: grid;
		grid-template-columns: minmax(20rem, 0.75fr) minmax(28rem, 1.25fr);
		align-items: start;
		border: 1px solid var(--line-strong);
		background: var(--ink-1);
	}
	.simulation-controls {
		min-inline-size: 0;
		padding: clamp(1.25rem, 3vw, 2.5rem);
	}
	.simulation-visual {
		display: grid;
		min-inline-size: 0;
		border-inline-start: 1px solid var(--line-strong);
		background: var(--ink-1);
	}
	.instrument-deck {
		display: grid;
		grid-template-columns: minmax(13rem, 1fr) minmax(11rem, 0.7fr);
		gap: 0.75rem;
		border-block-end: 1px solid var(--line-strong);
		background: var(--ink-0);
		padding: 0.75rem;
	}
	.scope {
		overflow: hidden;
		border: 1px solid var(--line-strong);
		background: #050907;
	}
	.scope__bar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-block-size: 1.9rem;
		border-block-end: 1px solid var(--line);
		padding-inline: 0.55rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.58rem;
	}
	.scope__bar strong {
		margin-inline-end: auto;
		color: var(--paper-soft);
		letter-spacing: 0.06em;
	}
	.scope__bar i {
		inline-size: 0.45rem;
		block-size: 0.45rem;
		border-radius: 50%;
		background: var(--danger);
	}
	.scope__bar i.active {
		background: var(--signal);
		box-shadow: 0 0 0.55rem var(--signal);
	}
	.scope svg {
		display: block;
		inline-size: 100%;
		block-size: 8.75rem;
	}
	.scope-grid {
		fill: none;
		stroke: var(--line);
		stroke-width: 0.7;
		vector-effect: non-scaling-stroke;
	}
	.scope-trace {
		fill: none;
		stroke: var(--signal);
		stroke-width: 1.8;
		filter: drop-shadow(0 0 0.2rem var(--signal));
		vector-effect: non-scaling-stroke;
	}
	.instrument-controls {
		display: grid;
		align-content: center;
		gap: 0.45rem;
	}
	.instrument-controls label {
		color: var(--amber);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		text-transform: uppercase;
	}
	.instrument-controls select {
		inline-size: 100%;
		min-inline-size: 0;
	}
	.instrument-controls > div {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.35rem;
	}
	.instrument-controls button {
		min-block-size: 2.4rem;
		padding-inline: 0.55rem;
		font-size: 0.68rem;
	}
	.instrument-controls button[aria-pressed='true'] {
		border-color: var(--signal);
		color: var(--signal-bright);
	}
	.simulation-diagram {
		min-inline-size: 0;
		background: var(--ink-1);
	}
	.simulation-diagram :global(.schematic-wire) {
		opacity: var(--trace-intensity);
	}
	.simulation-diagram[data-pulse-target='LED1'] :global([data-node-id='LED1']) {
		animation: probe-pulse var(--pulse-period) steps(1, end) infinite;
	}
	.instrument-bar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-block-end: 1px solid var(--line);
		padding: 0.55rem 0.75rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.simulation-diagram .schematic-host {
		border: 0;
	}
	.simulation-diagram figcaption {
		border-block-start: 1px solid var(--line);
		padding: 0.65rem 0.8rem;
		color: var(--muted);
		font-size: 0.7rem;
	}
	.simulation-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-block-end: 1px solid var(--line);
		padding-block: 1.2rem;
	}
	.simulation-footer a {
		color: var(--signal);
		font-weight: 650;
	}
	.probe-hud {
		display: flex;
		position: sticky;
		z-index: 10;
		inset-block-end: 0.5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-block-start: 1rem;
		border: 1px solid var(--line-strong);
		background: rgb(8 11 11 / 0.97);
		padding: 0.65rem 0.8rem;
		box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.38);
	}
	.probe-hud > div {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-inline-size: 12rem;
	}
	.probe-hud > div > span {
		inline-size: 0.65rem;
		block-size: 0.65rem;
		flex: none;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
	}
	.probe-hud > div > span.armed {
		border-color: var(--signal);
		background: var(--signal);
		box-shadow: 0 0 0.65rem var(--signal);
	}
	.probe-hud p {
		display: grid;
	}
	.probe-hud strong,
	.probe-hud dt {
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.probe-hud small {
		overflow: hidden;
		max-inline-size: 28rem;
		color: var(--muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.probe-hud dl {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.35rem;
		margin: 0;
	}
	.probe-hud dl div {
		min-inline-size: 7rem;
		border-inline-start: 1px solid var(--line);
		padding-inline: 0.65rem;
	}
	.probe-hud dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
	.simulation-diagram[data-fault='short-ground'] :global(.schematic-wire) {
		opacity: 0.28;
	}
	.simulation-diagram[data-fault='short-ground'] :global(.schematic-wire:nth-of-type(2n)) {
		opacity: 1;
		color: var(--danger);
	}
	.simulation-diagram[data-fault='open-circuit'] :global(.schematic-wire:nth-of-type(3n)) {
		opacity: 0.12;
		stroke-dasharray: 5 7;
	}
	.simulation-diagram[data-fault='degraded-resistor'] :global(.schematic-component),
	.simulation-diagram[data-fault='degraded-resistor'] :global(.schematic-wire) {
		filter: saturate(0.45);
	}
	.simulation-diagram.probe-active :global(.schematic-component),
	.simulation-diagram.probe-active :global(.schematic-wire) {
		cursor: crosshair;
	}
	@keyframes probe-pulse {
		0%,
		58% {
			opacity: 1;
			filter: drop-shadow(0 0 0.5rem var(--signal));
		}
		58.01%,
		100% {
			opacity: 0.32;
			filter: none;
		}
	}
	:global(.simulation-controls .control-stack) {
		display: grid;
		gap: 1.5rem;
	}
	:global(.simulation-controls fieldset) {
		display: grid;
		gap: 1rem;
		margin: 0;
		border: 1px solid var(--line);
		padding: 1rem;
	}
	:global(.simulation-controls legend) {
		padding-inline: 0.4rem;
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
	}
	:global(.simulation-controls .field) {
		display: grid;
		gap: 0.35rem;
	}
	:global(.simulation-controls .field-line) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	:global(.simulation-controls input[type='range']) {
		inline-size: 100%;
		accent-color: var(--signal);
	}
	:global(.simulation-controls input[type='number']) {
		inline-size: 100%;
	}
	:global(.simulation-controls .readout) {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1px;
		border: 1px solid var(--line);
		background: var(--line);
	}
	:global(.simulation-controls .readout div) {
		background: var(--ink-2);
		padding: 0.75rem;
	}
	:global(.simulation-controls .readout dt) {
		color: var(--muted);
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	:global(.simulation-controls .readout dd) {
		margin: 0.2rem 0 0;
		color: var(--paper);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	:global(.simulation-controls .simulation-actions) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	:global(.simulation-controls .simulation-actions button) {
		padding-inline: 0.9rem;
	}
	:global(.simulation-controls .technical-note) {
		color: var(--muted);
		font-size: 0.74rem;
	}
	@media (max-width: 64rem) {
		.simulation-grid {
			grid-template-columns: 1fr;
		}
		.simulation-visual {
			border-block-start: 1px solid var(--line-strong);
			border-inline-start: 0;
		}
	}
	@media (max-width: 46rem) {
		.instrument-deck {
			grid-template-columns: 1fr;
		}
		.probe-hud {
			align-items: start;
		}
		.probe-hud dl {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 38rem) {
		.simulation-page {
			padding-inline: 0;
		}
		.simulation-header,
		.simulation-footer,
		.probe-hud {
			margin-inline: var(--gutter);
		}
		.idea {
			grid-template-columns: 1fr;
		}
		.probe-hud {
			display: grid;
		}
		.probe-hud dl {
			justify-content: stretch;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scope-trace {
			filter: none;
		}
	}
</style>
