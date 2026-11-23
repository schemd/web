<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/env';
	import { useLanguage } from '#lib/i18n/index.ts';
	import {
		measurePlateOverlays,
		projectLayerSvg,
		pulseSvgWires,
		type PlateOverlayGeometry
	} from '#lib/plotter-layers.ts';

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
		/** Attach data-hero-drawing / data-hero-stack so bidirectional source tracing binds in 2D & 3D. */
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
	let symbolsPlateHost = $state<HTMLDivElement | undefined>();
	let labelsPlateHost = $state<HTMLDivElement | undefined>();
	let overlays = $state<PlateOverlayGeometry | undefined>();
	let carriageActive = $state(false);
	let railX = $state(50);
	let railY = $state(50);
	let hudText = $state('IDLE · PEN UP');
	let flashing = $state(false);
	let hasAutoPlotted = false;

	const DEFAULT_TILT_X = 54;
	const DEFAULT_SPIN_Z = -26;
	let tiltX = $state(DEFAULT_TILT_X);
	let spinZ = $state(DEFAULT_SPIN_Z);
	let orbiting = $state(false);
	let orbitDrag:
		| {
				pointerId: number;
				startX: number;
				startY: number;
				baseTilt: number;
				baseSpin: number;
				moved: boolean;
				hitInteractive: boolean;
		  }
		| undefined;

	const isCustomOrbit = $derived(
		Math.abs(tiltX - DEFAULT_TILT_X) > 0.5 || Math.abs(spinZ - DEFAULT_SPIN_Z) > 0.5
	);

	function resetOrbit(): void {
		tiltX = DEFAULT_TILT_X;
		spinZ = DEFAULT_SPIN_Z;
	}

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
				const canonicalSvg = svgHost?.querySelector('svg');
				if (canonicalSvg instanceof SVGSVGElement) {
					overlays = measurePlateOverlays(canonicalSvg);
				}
				stackExpanded = true;
				applyStageAll(stage);
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

	/** Apply continuous 4-stage compiler scrubbing (0..300) onto one SVG element. */
	function applyStageToSvg(svgEl: SVGSVGElement | null | undefined, val: number): void {
		if (!svgEl) return;

		const parts = queryParts(svgEl);
		const wires = queryWires(svgEl);
		const texts = Array.from(svgEl.querySelectorAll<SVGTextElement>('text'));

		/* Stage 0 -> 100: parts glide from the left drafting margin into drafted coordinates.
		   Use the independent CSS `translate` property so SVG `transform="translate(x y)"` stays intact. */
		const draftP = Math.max(0, Math.min(1, val / 100));
		for (let i = 0; i < parts.length; i += 1) {
			const part = parts[i]!;
			if (draftP >= 0.995) {
				part.style.translate = '';
				part.style.opacity = '';
			} else {
				const dx = Math.round(-(1 - draftP) * (76 + (i % 4) * 26));
				const dy = Math.round((1 - draftP) * ((i % 3) - 1) * 18);
				part.style.translate = `${dx}px ${dy}px`;
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

	/** Keep both the canonical SVG and all mounted 3D optical plates synced with stage. */
	function applyStageAll(val: number): void {
		applyStageToSvg(svgHost?.querySelector('svg'), val);
		if (stackMounted) {
			applyStageToSvg(copperPlateHost?.querySelector('svg'), val);
			applyStageToSvg(symbolsPlateHost?.querySelector('svg'), val);
			applyStageToSvg(labelsPlateHost?.querySelector('svg'), val);
		}
	}

	/** Mechanically trace every real wire path (2D with XY carriage, or live on 3D Plate 02). */
	export function plot(): void {
		if (!browser) return;
		cancelAnimations();
		stage = 300;
		applyStageAll(300);

		const targetHost = stackExpanded && copperPlateHost ? copperPlateHost : svgHost;
		const svgEl = targetHost?.querySelector('svg');
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
		const is3d = stackExpanded;

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

			if (activePt) {
				if (is3d) {
					hudText =
						activeLine !== undefined
							? `PLOTTING 3D · L${String(activeLine).padStart(2, '0')} · (${Math.round(activePt.x)}, ${Math.round(activePt.y)})`
							: `PLOTTING 3D · (${Math.round(activePt.x)}, ${Math.round(activePt.y)})`;
				} else {
					moveCarriageToSvgPoint(svgEl, activePt.x, activePt.y, activeLine);
				}
			}
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
		applyStageAll(300);
		flashing = false;
		queueMicrotask(() => {
			flashing = true;
			setTimeout(() => (flashing = false), 420);
		});
		hudText =
			ms !== undefined ? `REAL COMPILE: ${ms} ms (INSTANT)` : 'REAL COMPILE: < 1 ms (INSTANT)';
		pulse();
	}

	/** Propagate luminous signal packets along every real routed copper path (2D or floating 3D Plate 02). */
	export function pulse(): void {
		if (!browser || reducedMotion()) return;
		if (cancelPulse) {
			cancelPulse();
			cancelPulse = undefined;
		}
		const targetHost = stackExpanded && copperPlateHost ? copperPlateHost : svgHost;
		const svgEl = targetHost?.querySelector('svg');
		if (!svgEl) return;
		cancelPulse = pulseSvgWires(svgEl);
	}

	/* Keep stage projection & measured overlays synchronized with scrubber or fresh SVG compiles. */
	$effect(() => {
		const currentSvg = svg;
		const currentStage = stage;
		if (!browser || !currentSvg) return;
		queueMicrotask(() => {
			if (stackMounted) {
				const canonicalSvg = svgHost?.querySelector('svg');
				if (canonicalSvg instanceof SVGSVGElement) {
					overlays = measurePlateOverlays(canonicalSvg);
				}
			}
			applyStageAll(currentStage);
		});
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

	function isInteractiveHit(target: EventTarget | null): boolean {
		const el = target instanceof Element ? target : null;
		return Boolean(
			el?.closest(
				'.schematic-trace, .schematic-wire, .schematic-component, [data-node-id], .callout-pill'
			)
		);
	}

	function onPointerOver(event: PointerEvent): void {
		if (orbiting) return;
		const target = event.target instanceof Element ? event.target : null;
		const raw = target?.closest('[data-source-line]')?.getAttribute('data-source-line');
		onfocusline?.(raw ? Number(raw) : undefined);
	}

	function onBedPointerDown(event: PointerEvent): void {
		if (event.button !== 0) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('button')) return;

		if (!stackExpanded) {
			if (isInteractiveHit(target)) pulse();
			return;
		}

		orbitDrag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			baseTilt: tiltX,
			baseSpin: spinZ,
			moved: false,
			hitInteractive: isInteractiveHit(target)
		};
		bedEl?.setPointerCapture?.(event.pointerId);
	}

	function onBedPointerMove(event: PointerEvent): void {
		if (!orbitDrag || orbitDrag.pointerId !== event.pointerId) return;
		const dx = event.clientX - orbitDrag.startX;
		const dy = event.clientY - orbitDrag.startY;
		if (!orbitDrag.moved && Math.hypot(dx, dy) >= 4) {
			orbitDrag.moved = true;
			orbiting = true;
			onfocusline?.(undefined);
		}
		if (!orbitDrag.moved) return;
		tiltX = Math.max(12, Math.min(78, orbitDrag.baseTilt - dy * 0.34));
		spinZ = Math.max(-120, Math.min(120, orbitDrag.baseSpin - dx * 0.36));
		hudText = `ORBIT ${Math.round(tiltX)}° / ${Math.round(spinZ)}°`;
	}

	function onBedPointerUp(event: PointerEvent): void {
		if (!orbitDrag || orbitDrag.pointerId !== event.pointerId) return;
		const drag = orbitDrag;
		orbitDrag = undefined;
		orbiting = false;
		if (bedEl?.hasPointerCapture?.(event.pointerId)) {
			bedEl.releasePointerCapture(event.pointerId);
		}
		if (!drag.moved && drag.hitInteractive) {
			pulse();
		}
	}
</script>

<div
	bind:this={bedEl}
	class="plotter-bed"
	class:compact
	class:flashing
	class:orbiting
	class:exploded={stackExpanded}
	class:show-grid={grid || stage < 260 || stackExpanded}
	onpointerdown={onBedPointerDown}
	onpointermove={onBedPointerMove}
	onpointerup={onBedPointerUp}
	onpointercancel={onBedPointerUp}
>
	{#if flashing && !stackExpanded}
		<div class="flash-veil" aria-hidden="true"></div>
	{/if}

	<!-- Isometric 3D Optical 4-Plate Acetate Rig -->
	<div class="iso-scene" class:exploded={stackExpanded}>
		<div
			class="iso-rig"
			style:--tilt-x={`${tiltX}deg`}
			style:--spin-z={`${spinZ}deg`}
			data-hero-stack={heroHost ? '' : undefined}
			onpointerover={onPointerOver}
			onpointerleave={() => onfocusline?.(undefined)}
		>
			<!-- Canonical Live Compiled Schematic (in flow for zero CLS, interactive when flat) -->
			<div
				bind:this={svgHost}
				class="canonical-host"
				class:split-active={stackExpanded}
				role="region"
				aria-label={t('Compiled schematic preview')}
				data-hero-drawing={heroHost ? '' : undefined}
				data-schematic-host
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html svg}
			</div>

			{#if stackMounted}
				<!-- Plate 01 (-62px): Channel Lattice, Measured 24u Sheet Frame & Component Footprints -->
				<div class="acetate-plate plate-0 plotter-grid" aria-hidden="true">
					<span class="plate-tag">{t('01 · Lattice & sheet')}</span>
					{#if overlays}
						<svg class="overlay-svg" viewBox={overlays.viewBox} preserveAspectRatio="xMidYMid meet">
							<rect
								class="sheet-outline"
								x={overlays.sheetBox.x}
								y={overlays.sheetBox.y}
								width={overlays.sheetBox.width}
								height={overlays.sheetBox.height}
								rx="6"
							/>
							{#each overlays.footprints as fp, i (i)}
								<g class="footprint-item" data-source-line={fp.line}>
									<rect
										class="footprint-box"
										x={fp.x}
										y={fp.y}
										width={fp.width}
										height={fp.height}
										rx="4"
									/>
									<path
										class="anchor-cross"
										d={`M ${fp.cx - 4} ${fp.cy} H ${fp.cx + 4} M ${fp.cx} ${fp.cy - 4} V ${fp.cy + 4}`}
									/>
								</g>
							{/each}
						</svg>
					{/if}
					{#if sheetWidth && sheetHeight}
						<span class="sheet-dim tabular">
							{sheetWidth}×{sheetHeight} · 24u
						</span>
					{/if}
				</div>

				<!-- Plate 02 (-14px): Routed Orthogonal Copper & Junctions ONLY -->
				<div
					bind:this={copperPlateHost}
					class="acetate-plate plate-1 layer-copper"
					aria-hidden="true"
				>
					<span class="plate-tag">{t('02 · Routed copper')}</span>
					<div class="layer-svg">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- prefixed clone of compiler output -->
						{@html copperLayerSvg}
					</div>
				</div>

				<!-- Plate 03 (+36px): Component Symbols & Pins ONLY -->
				<div
					bind:this={symbolsPlateHost}
					class="acetate-plate plate-2 layer-symbols"
					aria-hidden="true"
				>
					<span class="plate-tag">{t('03 · Symbols & pins')}</span>
					<div class="layer-svg">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- prefixed clone of compiler output -->
						{@html symbolsLayerSvg}
					</div>
				</div>

				<!-- Plate 04 (+86px): Labels, Math & Source-Map Callout Badges ONLY -->
				<div
					bind:this={labelsPlateHost}
					class="acetate-plate plate-3 layer-labels"
					aria-hidden="true"
				>
					<span class="plate-tag">{t('04 · Labels & source map')}</span>
					<div class="layer-svg">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- prefixed clone of compiler output -->
						{@html labelsLayerSvg}
					</div>
					{#if overlays && overlays.callouts.length > 0}
						<svg
							class="overlay-svg callouts-svg"
							viewBox={overlays.viewBox}
							preserveAspectRatio="xMidYMid meet"
						>
							{#each overlays.callouts as c (c.line + ':' + c.x + ':' + c.y)}
								<g class="callout-pill" data-source-line={c.line}>
									<rect x={c.x} y={c.y - 10} width="28" height="14" rx="3" />
									<text x={c.x + 14} y={c.y + 0.5} text-anchor="middle">{c.tag}</text>
								</g>
							{/each}
						</svg>
					{/if}
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

	<!-- Bottom-right 3D orbit hint / reset button while Exploded -->
	{#if stackExpanded}
		<div class="orbit-hud tabular">
			{#if isCustomOrbit}
				<button type="button" class="orbit-reset" onclick={resetOrbit}>
					{Math.round(tiltX)}° / {Math.round(spinZ)}° · {t('Reset angle')}
				</button>
			{:else}
				<span class="orbit-hint">{t('Drag to tilt')}</span>
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
		perspective: 1500px;
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
		cursor: grab;
		user-select: none;
		touch-action: none;

		&.compact {
			padding-block: var(--space-6);
		}

		&.orbiting {
			cursor: grabbing;

			& .iso-rig {
				transition: none;
			}
		}

		& .iso-rig {
			transform: rotateX(var(--tilt-x, 54deg)) rotateZ(var(--spin-z, -26deg)) scale(0.8)
				translateY(-10px);
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
				translate 420ms cubic-bezier(0.22, 1, 0.36, 1),
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
		pointer-events: none;
		border-color: color-mix(in srgb, var(--line-strong) 85%, transparent);
		background: color-mix(in srgb, var(--bg-raised) 14%, transparent);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--ink) 8%, transparent),
			0 20px 34px -18px rgb(0 0 0 / 0.28);
	}

	/* Real-speed flash pulse directly on the 3D optical plates */
	.plotter-bed.flashing.exploded .acetate-plate {
		border-color: var(--mark);
		background: color-mix(in srgb, var(--mark) 22%, transparent);
		box-shadow:
			0 0 0 1px var(--mark),
			0 22px 38px -14px color-mix(in srgb, var(--mark) 45%, transparent);
	}

	.iso-scene.exploded .plate-0 {
		transform: translateZ(-36px);
		background: color-mix(in srgb, var(--bg-inset) 62%, transparent);
	}

	.iso-scene.exploded .plate-1 {
		transform: translateZ(-10px);
	}

	.iso-scene.exploded .plate-2 {
		transform: translateZ(14px);
	}

	.iso-scene.exploded .plate-3 {
		transform: translateZ(42px);
	}

	/* Compact depth scale for Docs sidebar */
	.compact .iso-scene.exploded .plate-0 {
		transform: translateZ(-24px);
	}
	.compact .iso-scene.exploded .plate-1 {
		transform: translateZ(-6px);
	}
	.compact .iso-scene.exploded .plate-2 {
		transform: translateZ(10px);
	}
	.compact .iso-scene.exploded .plate-3 {
		transform: translateZ(28px);
	}

	/* Measured overlay SVG (Plate 01 footprints & Plate 04 source-map callouts) */
	.overlay-svg {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		display: block;
		overflow: visible;
		pointer-events: none;
	}

	.sheet-outline {
		fill: color-mix(in srgb, var(--accent) 4%, transparent);
		stroke: color-mix(in srgb, var(--accent) 62%, transparent);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
		vector-effect: non-scaling-stroke;
	}

	.footprint-item {
		transition:
			opacity var(--dur-fast) var(--ease-precise),
			filter var(--dur-fast) var(--ease-precise);
	}

	.footprint-box {
		fill: color-mix(in srgb, var(--mark) 10%, transparent);
		stroke: color-mix(in srgb, var(--mark) 72%, transparent);
		stroke-width: 1.25;
		stroke-dasharray: 3 3;
		vector-effect: non-scaling-stroke;
	}

	.anchor-cross {
		fill: none;
		stroke: color-mix(in srgb, var(--accent) 68%, transparent);
		stroke-width: 1.1;
		vector-effect: non-scaling-stroke;
	}

	.callout-pill {
		pointer-events: auto;
		cursor: pointer;
		transition:
			opacity var(--dur-fast) var(--ease-precise),
			filter var(--dur-fast) var(--ease-precise);

		& rect {
			fill: color-mix(in srgb, var(--bg-raised) 92%, transparent);
			stroke: color-mix(in srgb, var(--accent) 70%, transparent);
			stroke-width: 1;
			vector-effect: non-scaling-stroke;
		}

		& text {
			fill: var(--accent);
			font-family: var(--font-mono);
			font-size: 9px;
			font-weight: 700;
			stroke: none;
		}
	}

	/* Plate edge tabs tucked along bottom-left edge so they never collide with symbols */
	.plate-tag {
		position: absolute;
		inset-block-end: 0.45rem;
		inset-inline-start: 0.55rem;
		z-index: 4;
		padding: 0.1rem 0.42rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 94%, transparent);
		color: var(--ink-mute);
		font-family: var(--font-mono);
		font-size: 0.66rem;
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
		inset-block-end: 0.45rem;
		inset-inline-end: 0.6rem;
		z-index: 4;
		padding: 0.1rem 0.42rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 94%, transparent);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		pointer-events: none;
	}

	/* Synchronized SVG optical projections — aligned 1:1 with canonical-host */
	.layer-svg {
		position: absolute;
		inset: 0;
		pointer-events: none;

		& :global(figure) {
			margin: 0;
			inline-size: 100%;
			block-size: 100%;
		}

		& :global(figcaption) {
			display: none;
		}

		& :global(svg) {
			display: block;
			inline-size: 100%;
			block-size: 100%;
			overflow: visible;
		}

		& :global(.schematic-surface),
		& :global(.schematic-grid),
		& :global(.schematic-glow-layer),
		& :global(.schematic-port-hotspot) {
			display: none !important;
		}

		& :global([data-source-line]) {
			pointer-events: auto;
			cursor: pointer;
			transition:
				opacity var(--dur-fast) var(--ease-precise),
				filter var(--dur-fast) var(--ease-precise);
		}

		& :global(.schematic-component),
		& :global([data-node-id]) {
			transition:
				translate 420ms cubic-bezier(0.22, 1, 0.36, 1),
				opacity 220ms ease,
				filter var(--dur-fast) var(--ease-precise);
		}
	}

	/* Plate 02: Routed copper & junction dots ONLY (hide component symbols & text) */
	.layer-copper {
		& :global(.schematic-component),
		& :global(.schematic-wire-label),
		& :global(.schematic-annotation),
		& :global(text) {
			display: none !important;
		}
	}

	/* Plate 03: Component symbols & pins ONLY (hide routed wires, junction dots, labels) */
	.layer-symbols {
		& :global(.schematic-wire),
		& :global(.schematic-trace),
		& :global(.schematic-node-fill),
		& :global(.schematic-wire-label),
		& :global(.schematic-annotation),
		& :global([data-connection-index]),
		& :global(text) {
			display: none !important;
		}
	}

	/* Plate 04: Floating labels, math & source-map typography ONLY */
	.layer-labels {
		& :global(.schematic-vectors use),
		& :global(.schematic-vectors path),
		& :global(.schematic-vectors circle),
		& :global(.schematic-vectors line),
		& :global(.schematic-vectors polygon),
		& :global(.schematic-vectors polyline),
		& :global(.schematic-vectors rect:not(.schematic-label-bg)) {
			display: none !important;
		}

		& :global(text) {
			fill: var(--ink) !important;
			stroke: var(--bg);
			stroke-width: 2.5px;
			paint-order: stroke;
			font-weight: 600;
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

	.orbit-hud {
		position: absolute;
		inset-block-end: var(--space-2);
		inset-inline-end: var(--space-3);
		z-index: 10;
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}

	.orbit-hint {
		display: inline-block;
		padding: 0.12rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
		color: var(--ink-mute);
		pointer-events: none;
	}

	.orbit-reset {
		padding: 0.14rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-tag);
		background: color-mix(in srgb, var(--bg-raised) 94%, transparent);
		color: var(--ink);
		font: inherit;
		cursor: pointer;

		&:hover {
			border-color: var(--accent);
			color: var(--accent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.iso-rig,
		.acetate-plate,
		.canonical-host :global(.schematic-component),
		.canonical-host :global([data-node-id]),
		.layer-svg :global(.schematic-component),
		.layer-svg :global([data-node-id]) {
			transition: none !important;
		}
	}
</style>
