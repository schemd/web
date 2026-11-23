<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/env';
	import { useLanguage } from '#lib/i18n/index.ts';
	import { projectLayerSvg, pulseSvgWires } from '#lib/plotter-layers.ts';

	const { t } = useLanguage();

	interface Props {
		/** Compiled schematic SVG markup from @schemd/core. */
		svg: string;
		/** Measured sheet width in schematic units (optional). */
		sheetWidth?: number | undefined;
		/** Measured sheet height in schematic units (optional). */
		sheetHeight?: number | undefined;
		/** Compile latency in milliseconds (shown on real-speed flash). */
		ms?: number | undefined;
		/** Continuous 4-stage compiler scrubber value: 0..300 (300 = finished ink). */
		stage?: number;
		/** Toggle 3D isometric exploded 4-plate acetate stack. */
		exploded?: boolean;
		/** Show calibrated architectural drafting geometry grid. */
		grid?: boolean;
		/** Attach data-hero-drawing so bidirectional source tracing & tests bind directly. */
		heroHost?: boolean;
		/** Run the mechanical XY pen-plotter trace once on initial mount (unless reduced motion). */
		autoPlot?: boolean;
		/** Compact sizing for narrow sidebars like the Docs Living Notebook Rail. */
		compact?: boolean;
		/** Notify parent when hovering/plotting focuses a specific source line. */
		onfocusline?: (line: number | undefined) => void;
	}

	let {
		svg,
		sheetWidth = undefined,
		sheetHeight = undefined,
		ms = undefined,
		stage = $bindable(300),
		exploded = $bindable(false),
		grid = false,
		heroHost = false,
		autoPlot = false,
		compact = false,
		onfocusline
	}: Props = $props();

	let bedEl = $state<HTMLDivElement | undefined>();
	let svgHost = $state<HTMLDivElement | undefined>();
	let copperPlateHost = $state<HTMLDivElement | undefined>();
	let carriageActive = $state(false);
	let railX = $state(50);
	let railY = $state(50);
	let hudText = $state('IDLE · PEN UP');
	let flashing = $state(false);
	let hasAutoPlotted = false;

	/**
	 * Keep optical layer plates mounted once Explode is opened so collapse
	 * animates smoothly back to z=0 before handing focus back to the live SVG.
	 */
	let stackMounted = $state(false);
	let stackExpanded = $state(false);
	let explodeRaf: number | undefined;

	$effect(() => {
		if (!browser) return;
		if (explodeRaf !== undefined) {
			cancelAnimationFrame(explodeRaf);
			explodeRaf = undefined;
		}
		if (exploded) {
			stackMounted = true;
			explodeRaf = requestAnimationFrame(() => {
				stackExpanded = true;
				explodeRaf = undefined;
			});
		} else {
			stackExpanded = false;
		}
	});

	/* Self-contained, uniquely ID-prefixed SVG clones for the 3 optical drawing plates. */
	const symbolsLayerSvg = $derived(stackMounted ? projectLayerSvg(svg, 'sym') : '');
	const copperLayerSvg = $derived(stackMounted ? projectLayerSvg(svg, 'cu') : '');
	const labelsLayerSvg = $derived(stackMounted ? projectLayerSvg(svg, 'lbl') : '');

	let plotRaf: number | undefined;
	let cancelPulse: (() => void) | undefined;

	function reducedMotion(): boolean {
		return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function cancelAnimations(): void {
		if (plotRaf !== undefined) {
			cancelAnimationFrame(plotRaf);
			plotRaf = undefined;
		}
		if (cancelPulse) {
			cancelPulse();
			cancelPulse = undefined;
		}
		carriageActive = false;
	}

	function queryWires(svgEl: SVGSVGElement): SVGPathElement[] {
		return Array.from(svgEl.querySelectorAll<SVGPathElement>('path.schematic-trace')).filter(
			(path) => path.getTotalLength() > 0
		);
	}

	function queryParts(svgEl: SVGSVGElement): SVGGElement[] {
		return Array.from(svgEl.querySelectorAll<SVGGElement>('.schematic-component, [data-node-id]'));
	}

	function moveCarriageToSvgPoint(svgEl: SVGSVGElement, x: number, y: number, line?: number): void {
		if (!bedEl) return;
		const ctm = svgEl.getScreenCTM();
		if (!ctm) return;
		const pt = svgEl.createSVGPoint();
		pt.x = x;
		pt.y = y;
		const screenPt = pt.matrixTransform(ctm);
		const bedRect = bedEl.getBoundingClientRect();
		if (bedRect.width <= 0 || bedRect.height <= 0) return;

		railX = Math.max(0, Math.min(100, ((screenPt.x - bedRect.left) / bedRect.width) * 100));
		railY = Math.max(0, Math.min(100, ((screenPt.y - bedRect.top) / bedRect.height) * 100));
		carriageActive = true;
		hudText =
			line !== undefined
				? `PEN DOWN · L${String(line).padStart(2, '0')} · (${Math.round(x)}, ${Math.round(y)})`
				: `PEN DOWN · (${Math.round(x)}, ${Math.round(y)})`;
	}

	/** Apply continuous 4-stage compiler scrubbing (0..300) onto the real SVG elements. */
	function applyStage(val: number): void {
		if (!svgHost) return;
		const svgEl = svgHost.querySelector('svg');
		if (!svgEl) return;

		const parts = queryParts(svgEl);
		const wires = queryWires(svgEl);
		const texts = Array.from(svgEl.querySelectorAll<SVGTextElement>('text'));

		/* Stage 0 -> 100: parts glide from the left drafting margin into drafted coordinates. */
		const draftP = Math.max(0, Math.min(1, val / 100));
		for (let i = 0; i < parts.length; i += 1) {
			const part = parts[i]!;
			if (draftP >= 0.995) {
				part.style.transform = '';
				part.style.opacity = '';
			} else {
				const dx = Math.round(-(1 - draftP) * (76 + (i % 4) * 26));
				const dy = Math.round((1 - draftP) * ((i % 3) - 1) * 18);
				part.style.transform = `translate(${dx}px, ${dy}px)`;
				part.style.opacity = (0.28 + 0.72 * draftP).toFixed(2);
			}
		}

		/* Stage 100 -> 200: orthogonal copper wires trace into place via stroke-dashoffset. */
		const routeP = Math.max(0, Math.min(1, (val - 100) / 100));
		for (const wire of wires) {
			if (routeP >= 0.995) {
				wire.style.strokeDasharray = '';
				wire.style.strokeDashoffset = '';
				wire.style.opacity = '';
			} else {
				const len = wire.getTotalLength();
				wire.style.strokeDasharray = `${len}`;
				wire.style.strokeDashoffset = `${(len * (1 - routeP)).toFixed(2)}`;
				wire.style.opacity = routeP <= 0.01 ? '0' : '1';
			}
		}

		/* Stage 200 -> 300: ink sharpens typography and settles construction guides. */
		const inkP = Math.max(0, Math.min(1, (val - 200) / 100));
		for (const textEl of texts) {
			textEl.style.opacity = inkP >= 0.995 ? '' : (0.18 + 0.82 * inkP).toFixed(2);
		}
	}

	/** Mechanically trace every real wire path with the XY carriage. */
	export function plot(): void {
		if (!browser || !svgHost) return;
		cancelAnimations();
		if (exploded) exploded = false;
		stage = 300;
		applyStage(300);

		const svgEl = svgHost.querySelector('svg');
		if (!svgEl) return;
		const wires = queryWires(svgEl);
		if (wires.length === 0 || reducedMotion()) {
			hudText = ms !== undefined ? `COMPILED · ${ms} ms` : 'IDLE · PEN UP';
			return;
		}

		const lengths = wires.map((w) => w.getTotalLength());
		const total = lengths.reduce((a, b) => a + b, 0);
		if (total <= 0) return;

		for (let i = 0; i < wires.length; i += 1) {
			wires[i]!.style.strokeDasharray = `${lengths[i]}`;
			wires[i]!.style.strokeDashoffset = `${lengths[i]}`;
		}

		const duration = Math.min(1800, Math.max(950, total * 0.65));
		const startedAt = performance.now();

		const tick = (now: number): void => {
			const progress = Math.min(1, (now - startedAt) / duration);
			let rem = progress * total;
			let activePt: DOMPoint | undefined;
			let activeLine: number | undefined;

			for (let i = 0; i < wires.length; i += 1) {
				const len = lengths[i]!;
				const drawn = Math.max(0, Math.min(len, rem));
				wires[i]!.style.strokeDashoffset = `${(len - drawn).toFixed(2)}`;
				if (drawn > 0 && drawn <= len) {
					activePt = wires[i]!.getPointAtLength(drawn);
					const rawLine = wires[i]!.closest('[data-source-line]')?.getAttribute('data-source-line');
					if (rawLine) activeLine = Number(rawLine);
				}
				rem -= len;
			}

			if (activePt) moveCarriageToSvgPoint(svgEl, activePt.x, activePt.y, activeLine);
			onfocusline?.(progress < 1 ? activeLine : undefined);

			if (progress < 1) {
				plotRaf = requestAnimationFrame(tick);
			} else {
				for (const w of wires) {
					w.style.strokeDasharray = '';
					w.style.strokeDashoffset = '';
				}
				plotRaf = undefined;
				carriageActive = false;
				hudText = ms !== undefined ? `PLOTTED · ${ms} ms CORE` : 'PLOTTED · PEN UP';
				pulse();
			}
		};

		plotRaf = requestAnimationFrame(tick);
	}

	/** Contrast human pen speed against the compiler's real sub-millisecond compile flash. */
	export function flashRealSpeed(): void {
		if (!browser) return;
		cancelAnimations();
		stage = 300;
		applyStage(300);
		flashing = false;
		queueMicrotask(() => {
			flashing = true;
			setTimeout(() => (flashing = false), 380);
		});
		hudText =
			ms !== undefined ? `REAL COMPILE: ${ms} ms (INSTANT)` : 'REAL COMPILE: < 1 ms (INSTANT)';
		pulse();
	}

	/** Propagate luminous signal packets along every real routed copper path (2D or floating 3D Plate 03). */
	export function pulse(): void {
		if (!browser || reducedMotion()) return;
		if (cancelPulse) {
			cancelPulse();
			cancelPulse = undefined;
		}
		const targetHost = exploded && copperPlateHost ? copperPlateHost : svgHost;
		const svgEl = targetHost?.querySelector('svg');
		if (!svgEl) return;
		cancelPulse = pulseSvgWires(svgEl);
	}

	/* Keep stage visual projection synchronized with scrubber or fresh SVG compiles. */
	$effect(() => {
		const currentSvg = svg;
		const currentStage = stage;
		if (!browser || !currentSvg) return;
		queueMicrotask(() => applyStage(currentStage));
	});

	/* Optional first-load mechanical plot trace (never runs under reduced motion). */
	$effect(() => {
		const currentSvg = svg;
		if (!browser || !autoPlot || hasAutoPlotted || !currentSvg) return;
		hasAutoPlotted = true;
		if (reducedMotion()) {
			hudText = ms !== undefined ? `COMPILED · ${ms} ms` : 'IDLE · PEN UP';
			return;
		}
		const timer = setTimeout(() => plot(), 180);
		return () => clearTimeout(timer);
	});

	onDestroy(() => {
		cancelAnimations();
		if (explodeRaf !== undefined) cancelAnimationFrame(explodeRaf);
	});

	function onPointerOver(event: PointerEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		const raw = target?.closest('[data-source-line]')?.getAttribute('data-source-line');
		onfocusline?.(raw ? Number(raw) : undefined);
	}

	function onPointerDown(event: PointerEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('.schematic-trace, .schematic-component, [data-node-id]')) {
			pulse();
		}
	}
</script>

<div
	bind:this={bedEl}
	class="plotter-bed"
	class:compact
	class:exploded={stackExpanded}
	class:show-grid={grid || stage < 260 || stackExpanded}
>
	{#if flashing}
		<div class="flash-veil" aria-hidden="true"></div>
	{/if}

	<!-- Isometric 3D Optical 4-Plate Acetate Rig -->
	<div class="iso-scene" class:exploded={stackExpanded}>
		<div class="iso-rig">
			<!-- Canonical Live Compiled Schematic (in flow for zero CLS, interactive when flat) -->
			<div
				bind:this={svgHost}
				class="canonical-host"
				class:split-active={stackExpanded}
				role="region"
				aria-label={t('Compiled schematic preview')}
				data-hero-drawing={heroHost ? '' : undefined}
				data-schematic-host
				onpointerover={onPointerOver}
				onpointerleave={() => onfocusline?.(undefined)}
				onpointerdown={onPointerDown}
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html svg}
			</div>

			{#if stackMounted}
				<!-- Plate 01 (-58px): Channel Lattice & Measured 24u Auto-Sheet Frame -->
				<div class="acetate-plate plate-0 plotter-grid" aria-hidden="true">
					<span class="plate-tag">{t('01 · Lattice & sheet')}</span>
					<div class="margin-guide">
						<span class="reg tl">┌</span>
						<span class="reg tr">┐</span>
						<span class="reg bl">└</span>
						<span class="reg br">┘</span>
					</div>
					{#if sheetWidth && sheetHeight}
						<span class="sheet-dim tabular">
							{sheetWidth}×{sheetHeight} · 24u
						</span>
					{/if}
				</div>

				<!-- Plate 02 (-14px): Component Symbols & Pins ONLY -->
				<div class="acetate-plate plate-1 layer-symbols" aria-hidden="true">
					<span class="plate-tag">{t('02 · Symbols & pins')}</span>
					<div class="layer-svg">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- prefixed clone of compiler output -->
						{@html symbolsLayerSvg}
					</div>
				</div>

				<!-- Plate 03 (+36px): Routed Orthogonal Copper & Junctions ONLY -->
				<div
					bind:this={copperPlateHost}
					class="acetate-plate plate-2 layer-copper"
					aria-hidden="true"
				>
					<span class="plate-tag">{t('03 · Routed copper')}</span>
					<div class="layer-svg">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- prefixed clone of compiler output -->
						{@html copperLayerSvg}
					</div>
				</div>

				<!-- Plate 04 (+84px): Labels, Math & Source Map Annotations ONLY -->
				<div class="acetate-plate plate-3 layer-labels" aria-hidden="true">
					<span class="plate-tag">{t('04 · Labels & source map')}</span>
					<div class="layer-svg">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- prefixed clone of compiler output -->
						{@html labelsLayerSvg}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Mechanical XY Plotter Carriage Rails -->
	<div
		class="rail-v"
		class:active={carriageActive}
		style:left={`${railX}%`}
		aria-hidden="true"
	></div>
	<div
		class="rail-h"
		class:active={carriageActive}
		style:top={`${railY}%`}
		aria-hidden="true"
	></div>
	<div
		class="carriage"
		class:active={carriageActive}
		style:left={`${railX}%`}
		style:top={`${railY}%`}
		aria-hidden="true"
	>
		<span class="nib"></span>
	</div>

	<!-- Bottom-left mechanical plotter readout -->
	{#if !compact}
		<div class="plotter-hud tabular" aria-hidden="true">
			<span>{hudText}</span>
			{#if sheetWidth && sheetHeight}
				<span>· {sheetWidth}×{sheetHeight}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.plotter-bed {
		position: relative;
		min-block-size: 360px;
		padding: var(--space-5);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--wash);
		overflow: hidden;
		transition:
			background-color var(--dur-med) var(--ease-precise),
			padding var(--dur-med) var(--ease-precise);

		&.compact {
			min-block-size: 200px;
			padding: var(--space-3);
		}
	}

	.plotter-bed.show-grid {
		background-image:
			linear-gradient(
				to right,
				color-mix(in srgb, var(--line) 42%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in srgb, var(--line) 42%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to right,
				color-mix(in srgb, var(--line) 74%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in srgb, var(--line) 74%, transparent) 1px,
				transparent 1px
			);
		background-size:
			20px 20px,
			20px 20px,
			100px 100px,
			100px 100px;
	}

	.flash-veil {
		position: absolute;
		inset: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--mark) 35%, transparent);
		pointer-events: none;
		animation: plotter-flash 360ms ease-out forwards;
	}

	.iso-scene {
		perspective: 1400px;
		transform-style: preserve-3d;
		inline-size: 100%;
	}

	.iso-rig {
		position: relative;
		transform-style: preserve-3d;
		transition: transform 720ms cubic-bezier(0.22, 1, 0.36, 1);
		transform: rotateX(0deg) rotateZ(0deg) scale(1);
	}

	.plotter-bed.exploded {
		overflow: visible;
		padding-block: var(--space-8);

		&.compact {
			padding-block: var(--space-6);
		}

		& .iso-rig {
			transform: rotateX(54deg) rotateZ(-26deg) scale(0.82) translateY(-8px);
		}
	}

	.canonical-host {
		position: relative;
		z-index: 2;
		transition: opacity 220ms ease;

		&.split-active {
			opacity: 0;
			pointer-events: none;
		}

		& :global(figure) {
			margin: 0;
		}

		& :global(figcaption) {
			display: none;
		}

		& :global(svg) {
			display: block;
			inline-size: 100%;
			block-size: auto;
			overflow: visible;
		}

		& :global(.schematic-component),
		& :global([data-node-id]) {
			transition:
				transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
				opacity 220ms ease;
		}

		& :global([data-source-line]) {
			cursor: pointer;
			transition:
				opacity var(--dur-fast) var(--ease-precise),
				filter var(--dur-fast) var(--ease-precise);
		}
	}

	/* ---------- True 4-Plate Optical Acetate Stack ---------- */
	.acetate-plate {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		background: transparent;
		pointer-events: none;
		opacity: 0;
		transform: translateZ(0);
		transition:
			transform 720ms cubic-bezier(0.22, 1, 0.36, 1),
			box-shadow 720ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 360ms ease,
			background-color 360ms ease,
			opacity 240ms ease;
	}

	.iso-scene.exploded .acetate-plate {
		opacity: 1;
		pointer-events: auto;
		border-color: color-mix(in srgb, var(--line-strong) 82%, transparent);
		background: color-mix(in srgb, var(--bg-raised) 56%, transparent);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--ink) 8%, transparent),
			0 22px 36px -18px rgb(0 0 0 / 0.34);

		&:hover {
			border-color: var(--accent);
			background: color-mix(in srgb, var(--bg-raised) 76%, transparent);
		}
	}

	.iso-scene.exploded .plate-0 {
		transform: translateZ(-58px);
		background: color-mix(in srgb, var(--bg-inset) 78%, transparent);

		&:hover {
			transform: translateZ(-48px);
		}
	}

	.iso-scene.exploded .plate-1 {
		transform: translateZ(-14px);

		&:hover {
			transform: translateZ(-4px);
		}
	}

	.iso-scene.exploded .plate-2 {
		transform: translateZ(36px);

		&:hover {
			transform: translateZ(46px);
		}
	}

	.iso-scene.exploded .plate-3 {
		transform: translateZ(84px);

		&:hover {
			transform: translateZ(94px);
		}
	}

	/* Compact depth scale for Docs sidebar */
	.compact .iso-scene.exploded .plate-0 {
		transform: translateZ(-36px);
	}
	.compact .iso-scene.exploded .plate-1 {
		transform: translateZ(-8px);
	}
	.compact .iso-scene.exploded .plate-2 {
		transform: translateZ(24px);
	}
	.compact .iso-scene.exploded .plate-3 {
		transform: translateZ(56px);
	}

	/* Plate 01: 24u dashed auto-sheet margin guide & corner registration ticks */
	.margin-guide {
		position: absolute;
		inset: 14px;
		border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 2px;
		pointer-events: none;
	}

	.reg {
		position: absolute;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		line-height: 1;
		color: var(--ink-mute);

		&.tl {
			inset-block-start: -3px;
			inset-inline-start: -2px;
		}
		&.tr {
			inset-block-start: -3px;
			inset-inline-end: -2px;
		}
		&.bl {
			inset-block-end: -3px;
			inset-inline-start: -2px;
		}
		&.br {
			inset-block-end: -3px;
			inset-inline-end: -2px;
		}
	}

	.plate-tag {
		position: absolute;
		inset-block-start: 0.45rem;
		inset-inline-start: 0.55rem;
		z-index: 4;
		padding: 0.1rem 0.42rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
		color: var(--ink-mute);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		pointer-events: none;
		opacity: 0;
		transition: opacity 320ms ease;
	}

	.iso-scene.exploded .plate-tag {
		opacity: 1;
	}

	.sheet-dim {
		position: absolute;
		inset-block-end: 0.5rem;
		inset-inline-end: 0.65rem;
		z-index: 4;
		padding: 0.1rem 0.42rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		pointer-events: none;
	}

	/* Synchronized SVG optical projections */
	.layer-svg {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;

		& :global(figure) {
			margin: 0;
			inline-size: 100%;
		}

		& :global(figcaption) {
			display: none;
		}

		& :global(svg) {
			display: block;
			inline-size: 100%;
			block-size: auto;
			overflow: visible;
		}
	}

	/* Plate 02: Components & pins ONLY (hide routed wires, junction dots, labels, grids) */
	.layer-symbols {
		& :global(.schematic-trace),
		& :global(.schematic-node-fill),
		& :global(.schematic-grid),
		& :global(.schematic-wire-label),
		& :global(.schematic-annotation),
		& :global([data-connection-index]),
		& :global(text) {
			display: none !important;
		}
	}

	/* Plate 03: Routed copper & junction dots ONLY (hide component symbols & text) */
	.layer-copper {
		& :global(.schematic-component),
		& :global(.schematic-grid),
		& :global(.schematic-wire-label),
		& :global(.schematic-annotation),
		& :global(text) {
			display: none !important;
		}
	}

	/* Plate 04: Labels, designators & annotations ONLY (hide vector geometry, keep text & label boxes) */
	.layer-labels {
		& :global(.schematic-vectors use),
		& :global(.schematic-vectors path),
		& :global(.schematic-vectors circle),
		& :global(.schematic-vectors line),
		& :global(.schematic-vectors polygon),
		& :global(.schematic-vectors polyline),
		& :global(.schematic-vectors rect:not(.schematic-label-bg)),
		& :global(.schematic-grid) {
			display: none !important;
		}
	}

	/* ---------- Mechanical XY Plotter Carriage ---------- */
	.rail-v,
	.rail-h {
		position: absolute;
		pointer-events: none;
		z-index: 12;
		opacity: 0;
		transition: opacity 220ms ease;

		&.active {
			opacity: 0.72;
		}
	}

	.rail-v {
		inset-block: 0;
		inline-size: 1px;
		background: color-mix(in srgb, var(--accent) 52%, transparent);
	}

	.rail-h {
		inset-inline: 0;
		block-size: 1px;
		background: color-mix(in srgb, var(--accent) 52%, transparent);
	}

	.carriage {
		position: absolute;
		z-index: 14;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		margin-inline-start: -0.75rem;
		margin-block-start: -0.75rem;
		border: 1.5px solid var(--accent);
		border-radius: 3px;
		background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
		display: grid;
		place-items: center;
		pointer-events: none;
		opacity: 0;
		transition: opacity 200ms ease;

		&.active {
			opacity: 1;
		}

		& .nib {
			inline-size: 6px;
			block-size: 6px;
			border-radius: 50%;
			background: var(--mark);
			box-shadow: 0 0 0 1.5px var(--ink);
		}
	}

	.plotter-hud {
		position: absolute;
		inset-block-end: var(--space-2);
		inset-inline-start: var(--space-3);
		z-index: 10;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0.12rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
		color: var(--ink-mute);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.iso-rig,
		.acetate-plate,
		.canonical-host :global(.schematic-component),
		.canonical-host :global([data-node-id]) {
			transition: none !important;
		}
	}
</style>
