<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();
	import { browser } from '$app/env';
	import { onDestroy } from 'svelte';

	interface Props {
		/** Real compiled SVG markup from `@schemd/core`. */
		svg: string;
		/** Optional measured sheet width/height for HUD display. */
		sheetWidth?: number;
		sheetHeight?: number;
		/** Real measured compile latency in ms. */
		ms?: number;
		/** Continuous compiler pipeline stage 0..300 (0=Parse, 100=Draft, 200=Route, 300=Ink). */
		stage?: number;
		/** Whether the isometric 3D layer stack is exploded. */
		exploded?: boolean;
		/** Whether the drafting grid overlay is pinned on even at stage 300. */
		grid?: boolean;
		/** Optional attribute hook (e.g. `data-hero-drawing`). */
		heroHost?: boolean;
		/** Play the XY pen-plotter carriage animation automatically when `svg` changes. */
		autoPlot?: boolean;
		/** Notify parent when hovering or plotting a specific source line. */
		onfocusline?: (line: number | undefined) => void;
	}

	let {
		svg,
		sheetWidth,
		sheetHeight,
		ms,
		stage = $bindable(300),
		exploded = $bindable(false),
		grid = false,
		heroHost = false,
		autoPlot = false,
		onfocusline
	}: Props = $props();

	let bedEl = $state<HTMLElement | undefined>();
	let svgHost = $state<HTMLElement | undefined>();
	let railX = $state(0);
	let railY = $state(0);
	let carriageActive = $state(false);
	let flashing = $state(false);
	let hudText = $state('IDLE · PEN UP');

	let plotRaf: number | undefined;
	let pulseRaf: number | undefined;

	function reducedMotion(): boolean {
		return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function cancelAnimations(): void {
		if (plotRaf !== undefined) {
			cancelAnimationFrame(plotRaf);
			plotRaf = undefined;
		}
		if (pulseRaf !== undefined) {
			cancelAnimationFrame(pulseRaf);
			pulseRaf = undefined;
		}
		carriageActive = false;
	}

	onDestroy(cancelAnimations);

	function queryWires(root: Element): SVGPathElement[] {
		const traces = Array.from(root.querySelectorAll<SVGPathElement>('path.schematic-trace'));
		if (traces.length > 0) return traces;
		return Array.from(root.querySelectorAll<SVGPathElement>('[data-wire-source] path')).filter(
			(path) => path.getTotalLength() > 0
		);
	}

	function parseViewBox(svgEl: SVGSVGElement): { x: number; y: number; w: number; h: number } {
		const raw = svgEl.getAttribute('viewBox');
		if (raw) {
			const nums = raw
				.trim()
				.split(/[\s,]+/)
				.map(Number);
			if (nums.length === 4 && nums.every(Number.isFinite) && nums[2]! > 0 && nums[3]! > 0) {
				return { x: nums[0]!, y: nums[1]!, w: nums[2]!, h: nums[3]! };
			}
		}
		const box = svgEl.getBBox();
		return {
			x: box.x || 0,
			y: box.y || 0,
			w: box.width || 600,
			h: box.height || 400
		};
	}

	function moveCarriageToSvgPoint(svgEl: SVGSVGElement, x: number, y: number, line?: number): void {
		if (exploded || !bedEl) {
			carriageActive = false;
			return;
		}
		const vb = parseViewBox(svgEl);
		const bedRect = bedEl.getBoundingClientRect();
		const svgRect = svgEl.getBoundingClientRect();
		if (bedRect.width <= 0 || bedRect.height <= 0 || svgRect.width <= 0 || svgRect.height <= 0) {
			return;
		}
		const relX = (x - vb.x) / vb.w;
		const relY = (y - vb.y) / vb.h;
		const px = svgRect.left - bedRect.left + relX * svgRect.width;
		const py = svgRect.top - bedRect.top + relY * svgRect.height;
		railX = Math.max(0, Math.min(100, (px / bedRect.width) * 100));
		railY = Math.max(0, Math.min(100, (py / bedRect.height) * 100));
		carriageActive = true;
		hudText = `PEN DOWN · (${Math.round(x)}, ${Math.round(y)})${line ? ` · L${line}` : ''}`;
	}

	/** Apply continuous 0..300 compiler stage visuals directly to the mounted SVG DOM. */
	function applyStage(val: number): void {
		const host = svgHost;
		if (!host) return;
		const svgEl = host.querySelector('svg');
		if (!svgEl) return;

		const tDraft = Math.max(0, Math.min(1, val / 100));
		const easeDraft = 1 - Math.pow(1 - tDraft, 3);
		const tRoute = Math.max(0, Math.min(1, (val - 100) / 100));
		const tInk = Math.max(0, Math.min(1, (val - 200) / 100));

		/* Stage 1 -> 2: BFS draft flight of components from left margin into compiled coordinates. */
		const nodes = Array.from(svgEl.querySelectorAll<SVGGElement>('[data-node-id]'));
		const vb = parseViewBox(svgEl);
		for (let i = 0; i < nodes.length; i += 1) {
			const node = nodes[i]!;
			if (val >= 100) {
				node.style.transform = '';
				node.style.opacity = '';
			} else {
				const targetX = vb.x + 24;
				const targetY = vb.y + 36 + ((i * 34) % Math.max(120, vb.h - 72));
				const box = node.getBBox();
				const dx = (targetX - box.x) * (1 - easeDraft);
				const dy = (targetY - box.y) * (1 - easeDraft);
				node.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
				node.style.opacity = String((0.35 + 0.65 * easeDraft).toFixed(2));
			}
		}

		/* Stage 2 -> 3: Manhattan wire tracing via stroke-dashoffset. */
		const wires = queryWires(svgEl);
		for (const path of wires) {
			if (val >= 200) {
				path.style.strokeDasharray = '';
				path.style.strokeDashoffset = '';
			} else {
				const len = path.getTotalLength();
				path.style.strokeDasharray = `${len}`;
				path.style.strokeDashoffset = `${(len * (1 - tRoute)).toFixed(2)}`;
			}
		}

		/* Stage 3 -> 4: Typography ink sharpen. */
		const texts = Array.from(svgEl.querySelectorAll<SVGTextElement>('text'));
		for (const label of texts) {
			label.style.opacity = val >= 300 ? '' : String((0.18 + 0.82 * tInk).toFixed(2));
		}
	}

	/** Mechanically trace every real wire path with the XY carriage. */
	export function plot(): void {
		if (!browser || !svgHost) return;
		cancelAnimations();
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

	/** Propagate luminous signal packets along every real routed copper path. */
	export function pulse(): void {
		if (!browser || !svgHost || reducedMotion()) return;
		if (pulseRaf !== undefined) {
			cancelAnimationFrame(pulseRaf);
			pulseRaf = undefined;
		}
		const svgEl = svgHost.querySelector('svg');
		if (!svgEl) return;

		svgEl.querySelector('[data-plotter-pulse]')?.remove();
		const wires = queryWires(svgEl);
		if (wires.length === 0) return;

		const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		layer.setAttribute('data-plotter-pulse', '');
		layer.setAttribute('pointer-events', 'none');
		svgEl.appendChild(layer);

		const packets = wires.map((wire, index) => {
			const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			dot.setAttribute('r', '4');
			dot.setAttribute('fill', 'var(--mark)');
			dot.setAttribute('stroke', 'var(--ink)');
			dot.setAttribute('stroke-width', '1.2');
			dot.style.opacity = '0';
			layer.appendChild(dot);
			return {
				wire,
				len: wire.getTotalLength(),
				delay: (index % 4) * 90,
				dot
			};
		});

		const junctions = Array.from(svgEl.querySelectorAll<SVGCircleElement>('circle')).filter((c) => {
			const r = Number(c.getAttribute('r'));
			return r >= 2.2 && r <= 4.5 && c.closest('[data-plotter-pulse]') === null;
		});

		const stepMs = 520;
		const maxDelay = Math.max(...packets.map((p) => p.delay), 0);
		const totalMs = maxDelay + stepMs + 260;
		const start = performance.now();
		let ringsFired = false;

		const tick = (now: number): void => {
			const elapsed = now - start;
			let alive = false;
			for (const p of packets) {
				const t = (elapsed - p.delay) / stepMs;
				if (t >= 0 && t <= 1 && p.len > 0) {
					const pt = p.wire.getPointAtLength(p.len * t);
					p.dot.setAttribute('cx', pt.x.toFixed(1));
					p.dot.setAttribute('cy', pt.y.toFixed(1));
					p.dot.style.opacity = '1';
					alive = true;
				} else {
					p.dot.style.opacity = '0';
				}
			}

			if (!ringsFired && elapsed > stepMs * 0.6) {
				ringsFired = true;
				for (const j of junctions.slice(0, 10)) {
					const cx = j.getAttribute('cx');
					const cy = j.getAttribute('cy');
					if (!cx || !cy) continue;
					const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
					ring.setAttribute('cx', cx);
					ring.setAttribute('cy', cy);
					ring.setAttribute('fill', 'none');
					ring.setAttribute('stroke', 'var(--mark)');
					ring.style.animation = 'plotter-pulse-ring 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards';
					layer.appendChild(ring);
				}
			}

			if (elapsed < totalMs || alive) {
				pulseRaf = requestAnimationFrame(tick);
			} else {
				layer.remove();
				pulseRaf = undefined;
			}
		};

		pulseRaf = requestAnimationFrame(tick);
	}

	/* Re-apply stage transforms whenever stage or SVG changes. */
	$effect(() => {
		void svg;
		const currentStage = stage;
		if (!browser) return;
		queueMicrotask(() => applyStage(currentStage));
	});

	/* Auto-plot once when a new specimen mounts if requested. */
	let lastPlottedSvg = '';
	$effect(() => {
		const markup = svg;
		if (!browser || !autoPlot || !markup || markup === lastPlottedSvg) return;
		lastPlottedSvg = markup;
		queueMicrotask(() => plot());
	});

	function lineFromEvent(event: Event): number | undefined {
		const target = event.target instanceof Element ? event.target : null;
		const raw = target?.closest('[data-source-line]')?.getAttribute('data-source-line');
		if (!raw) return undefined;
		const parsed = Number(raw);
		return Number.isInteger(parsed) ? parsed : undefined;
	}

	function onPointerOver(event: PointerEvent): void {
		const line = lineFromEvent(event);
		if (line !== undefined) onfocusline?.(line);
	}

	function onPointerDown(event: PointerEvent): void {
		const line = lineFromEvent(event);
		if (line !== undefined) onfocusline?.(line);
		pulse();
	}
</script>

<div
	bind:this={bedEl}
	class="plotter-bed"
	class:exploded
	class:show-grid={grid || stage < 260 || exploded}
>
	{#if flashing}
		<div class="flash-veil" aria-hidden="true"></div>
	{/if}

	<!-- Isometric 3D Acetate Rig -->
	<div class="iso-scene">
		<div class="iso-rig">
			<!-- Backing Lattice Acetate Plate (visible in Explode / Draft-Route stages) -->
			<div class="acetate-plate plate-base plotter-grid" aria-hidden="true">
				<span class="plate-label">{t('01 · Lattice & sheet')}</span>
			</div>

			<!-- Live Compiled Schematic Plate -->
			<div
				bind:this={svgHost}
				class="acetate-plate plate-main"
				role="region"
				aria-label={t('Compiled schematic preview')}
				data-hero-drawing={heroHost ? '' : undefined}
				data-schematic-host
				onpointerover={onPointerOver}
				onpointerleave={() => onfocusline?.(undefined)}
				onpointerdown={onPointerDown}
			>
				<span class="plate-label">{t('02 · Copper & symbols')}</span>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html svg}
			</div>

			<!-- Floating Sheet Registration Frame (visible in Explode / Geometry) -->
			<div class="acetate-plate plate-top" aria-hidden="true">
				<span class="plate-label">{t('03 · Source map & bounds')}</span>
				{#if sheetWidth && sheetHeight}
					<span class="sheet-dim tabular">
						{sheetWidth}×{sheetHeight} · 24u
					</span>
				{/if}
			</div>
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
	<div class="plotter-hud tabular" aria-hidden="true">
		<span>{hudText}</span>
		{#if sheetWidth && sheetHeight}
			<span>· {sheetWidth}×{sheetHeight}</span>
		{/if}
	</div>
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
		transition: background-color var(--dur-med) var(--ease-precise);
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
				color-mix(in srgb, var(--line) 72%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in srgb, var(--line) 72%, transparent) 1px,
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
		transition: transform 680ms cubic-bezier(0.22, 1, 0.36, 1);
		transform: rotateX(0deg) rotateZ(0deg) scale(1);
	}

	.plotter-bed.exploded {
		overflow: visible;
		padding-block: var(--space-8);

		& .iso-rig {
			transform: rotateX(48deg) rotateZ(-22deg) scale(0.84);
		}
	}

	.acetate-plate {
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		transition:
			transform 680ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 360ms ease,
			background-color 360ms ease,
			opacity 320ms ease,
			box-shadow 680ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.plate-base,
	.plate-top {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
	}

	.plate-main {
		position: relative;
		z-index: 2;

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
		}

		& :global([data-source-line]) {
			cursor: pointer;
		}
	}

	.plate-label {
		position: absolute;
		inset-block-start: var(--space-2);
		inset-inline-start: var(--space-2);
		z-index: 4;
		padding: 0.1rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-mute);
		opacity: 0;
		pointer-events: none;
		transition: opacity 320ms ease;
	}

	.sheet-dim {
		position: absolute;
		inset-block-end: var(--space-2);
		inset-inline-end: var(--space-2);
		padding: 0.1rem 0.45rem;
		border: 1px dashed var(--accent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--accent);
	}

	.plotter-bed.exploded .plate-base {
		opacity: 1;
		transform: translateZ(-46px);
		border-color: var(--line-strong);
		background-color: color-mix(in srgb, var(--bg) 68%, transparent);
		box-shadow: 0 22px 42px -18px color-mix(in srgb, var(--ink) 32%, transparent);
	}

	.plotter-bed.exploded .plate-main {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--vellum) 82%, transparent);
		box-shadow: 0 18px 34px -16px color-mix(in srgb, var(--ink) 28%, transparent);
	}

	.plotter-bed.exploded .plate-top {
		opacity: 1;
		transform: translateZ(46px);
		border: 1.5px dashed var(--accent);
		background-color: color-mix(in srgb, var(--accent) 4%, transparent);
	}

	.plotter-bed.exploded .plate-label {
		opacity: 1;
	}

	/* Mechanical XY Plotter Rails */
	.rail-v,
	.rail-h {
		position: absolute;
		z-index: 10;
		pointer-events: none;
		background: color-mix(in srgb, var(--accent) 60%, transparent);
		opacity: 0;
		transition: opacity 220ms ease;

		&.active {
			opacity: 1;
		}
	}

	.rail-v {
		inset-block: 0;
		inline-size: 1px;
	}

	.rail-h {
		inset-inline: 0;
		block-size: 1px;
	}

	.carriage {
		position: absolute;
		z-index: 12;
		pointer-events: none;
		transform: translate(-50%, -50%);
		opacity: 0;
		transition: opacity 220ms ease;

		&.active {
			opacity: 1;
		}
	}

	.nib {
		display: block;
		inline-size: 14px;
		block-size: 14px;
		border-radius: 50%;
		border: 2px solid var(--accent);
		background: var(--mark);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--bg) 80%, transparent);
	}

	.plotter-hud {
		position: absolute;
		inset-block-end: var(--space-2);
		inset-inline-start: var(--space-3);
		z-index: 8;
		display: flex;
		gap: var(--space-2);
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg) 90%, transparent);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-mute);
		pointer-events: none;
	}

	@media (max-width: 720px) {
		.plotter-bed {
			min-block-size: 260px;
			padding: var(--space-3);
		}
	}
</style>
