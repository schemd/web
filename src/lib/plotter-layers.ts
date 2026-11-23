/**
 * Shared helpers for The Plotter Sheet's optical 4-plate 3D Explode stack
 * and real-wire signal pulse propagation.
 */

export interface PlateFootprint {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly line?: number;
}

export interface PlateCallout {
	readonly x: number;
	readonly y: number;
	readonly line: number;
	readonly tag: string;
}

export interface PlateOverlayGeometry {
	readonly viewBox: string;
	readonly sheetBox: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
	readonly footprints: readonly PlateFootprint[];
	readonly callouts: readonly PlateCallout[];
}

/**
 * Create a self-contained, optically transparent, aria-hidden SVG clone for one
 * acetate layer: strips opaque background rects/grids, duplicate style blocks,
 * accessibility/focus attributes, and prefixes every ID/reference uniquely.
 */
export function projectLayerSvg(rawSvg: string, suffix: string): string {
	if (!rawSvg) return '';
	const prefix = `layer-${suffix}-`;
	return rawSvg
		.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
		.replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, '')
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(
			/<rect\b[^>]*class="[^"]*\bschematic-(?:surface|grid)\b[^"]*"[^>]*\/?>(?:<\/rect>)?/gi,
			''
		)
		.replace(/\srole="(?:img|group|button)"/gi, '')
		.replace(/\stabindex="[^"]*"/gi, '')
		.replace(/\saria-(?:labelledby|label)="[^"]*"/gi, '')
		.replace(/\sid="([^"]+)"/g, (_, id: string) => ` id="${prefix}${id}"`)
		.replace(/\bhref="#([^"]+)"/g, (_, id: string) => `href="#${prefix}${id}"`)
		.replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`);
}

/**
 * Measure real component footprints and source-line callout positions from a
 * rendered canonical schematic SVG so Plate 01 (obstacle clearance boxes) and
 * Plate 04 (source-map badges) align 1:1 with the actual drawing.
 */
export function measurePlateOverlays(svgEl: SVGSVGElement): PlateOverlayGeometry | undefined {
	const rawVb = svgEl.getAttribute('viewBox');
	if (!rawVb) return undefined;
	const parts = rawVb
		.trim()
		.split(/[\s,]+/)
		.map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
	const [vx, vy, vw, vh] = parts as [number, number, number, number];
	if (vw <= 0 || vh <= 0) return undefined;

	const footprints: PlateFootprint[] = [];
	const callouts: PlateCallout[] = [];
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	const includeBounds = (x: number, y: number, w: number, h: number): void => {
		if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 0 || h <= 0) return;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x + w > maxX) maxX = x + w;
		if (y + h > maxY) maxY = y + h;
	};

	const parseTranslate = (transform: string | null): { tx: number; ty: number } => {
		if (!transform) return { tx: 0, ty: 0 };
		const m = /translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)/.exec(transform);
		if (!m) return { tx: 0, ty: 0 };
		return { tx: Number(m[1]) || 0, ty: Number(m[2]) || 0 };
	};

	for (const comp of svgEl.querySelectorAll<SVGGElement>('.schematic-component')) {
		const { tx, ty } = parseTranslate(comp.getAttribute('transform'));
		const rawLine = comp.getAttribute('data-source-line');
		const line = rawLine ? Number(rawLine) : undefined;
		let box: DOMRect | undefined;
		try {
			const symbolUse = comp.querySelector<SVGGraphicsElement>('.schematic-component-vector');
			box = (symbolUse ?? comp).getBBox();
		} catch {
			box = undefined;
		}
		if (!box || box.width <= 0 || box.height <= 0) continue;
		const pad = 6;
		const fx = tx + box.x - pad;
		const fy = ty + box.y - pad;
		const fw = box.width + pad * 2;
		const fh = box.height + pad * 2;
		footprints.push({ x: fx, y: fy, width: fw, height: fh, line });
		includeBounds(fx, fy, fw, fh);
		if (line !== undefined && Number.isFinite(line)) {
			callouts.push({
				x: fx + fw + 2,
				y: fy + 6,
				line,
				tag: `L${String(line).padStart(2, '0')}`
			});
		}
	}

	for (const wire of svgEl.querySelectorAll<SVGPathElement>('path.schematic-trace')) {
		try {
			const wb = wire.getBBox();
			includeBounds(wb.x, wb.y, wb.width, wb.height);
		} catch {
			/* ignore unmeasured path */
		}
	}

	const margin = Math.max(18, Math.min(vw, vh) * 0.05);
	const sheetBox =
		Number.isFinite(minX) && maxX > minX
			? {
					x: Math.max(vx + 6, minX - margin),
					y: Math.max(vy + 6, minY - margin),
					width: Math.min(vw - 12, maxX - minX + margin * 2),
					height: Math.min(vh - 12, maxY - minY + margin * 2)
				}
			: {
					x: vx + 16,
					y: vy + 16,
					width: Math.max(20, vw - 32),
					height: Math.max(20, vh - 32)
				};

	return { viewBox: rawVb, sheetBox, footprints, callouts };
}

/**
 * Propagate luminous signal packets along every routed `.schematic-trace` path
 * inside an SVG, with glowing halos and junction ripple rings where nets branch.
 * Scales cleanly to the SVG's viewBox so packets are vivid in both 2D and 3D.
 */
export function pulseSvgWires(svgEl: SVGSVGElement): () => void {
	svgEl.querySelector('[data-plotter-pulse]')?.remove();
	const wires = Array.from(svgEl.querySelectorAll<SVGPathElement>('path.schematic-trace')).filter(
		(path) => path.getTotalLength() > 0
	);
	if (wires.length === 0) return () => undefined;

	const vbWidth = svgEl.viewBox?.baseVal?.width || 600;
	const coreR = Math.max(5, Math.min(9.5, vbWidth * 0.011));
	const haloR = coreR * 2.3;
	const strokeW = Math.max(1.4, coreR * 0.28);

	const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	layer.setAttribute('data-plotter-pulse', '');
	layer.setAttribute('pointer-events', 'none');
	svgEl.appendChild(layer);

	const packets = wires.map((wire, index) => {
		const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		group.style.opacity = '0';

		const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		halo.setAttribute('r', haloR.toFixed(1));
		halo.setAttribute('fill', 'var(--mark)');
		halo.setAttribute('fill-opacity', '0.35');
		halo.setAttribute('stroke', 'none');

		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.setAttribute('r', coreR.toFixed(1));
		dot.setAttribute('fill', 'var(--mark)');
		dot.setAttribute('stroke', 'var(--ink)');
		dot.setAttribute('stroke-width', strokeW.toFixed(1));

		group.appendChild(halo);
		group.appendChild(dot);
		layer.appendChild(group);
		return {
			wire,
			len: wire.getTotalLength(),
			delay: (index % 4) * 85,
			group
		};
	});

	/* Detect junction dots (both explicit <circle> and compiled .schematic-node-fill paths). */
	const junctionPoints: { x: number; y: number }[] = [];
	for (const c of svgEl.querySelectorAll<SVGCircleElement>('circle.schematic-node-fill, circle')) {
		const r = Number(c.getAttribute('r'));
		if (
			r >= 2.2 &&
			r <= 5 &&
			!c.classList.contains('schematic-port-hotspot') &&
			c.closest('[data-plotter-pulse]') === null
		) {
			const cx = Number(c.getAttribute('cx'));
			const cy = Number(c.getAttribute('cy'));
			if (Number.isFinite(cx) && Number.isFinite(cy)) junctionPoints.push({ x: cx, y: cy });
		}
	}
	if (junctionPoints.length === 0) {
		for (const nodeFill of svgEl.querySelectorAll<SVGPathElement>('path.schematic-node-fill')) {
			const d = nodeFill.getAttribute('d') ?? '';
			for (const match of d.matchAll(/M\s*([-\d.]+)\s+([-\d.]+)/g)) {
				const x = Number(match[1]) + 3;
				const y = Number(match[2]);
				if (Number.isFinite(x) && Number.isFinite(y)) junctionPoints.push({ x, y });
			}
		}
	}

	const stepMs = 580;
	const maxDelay = Math.max(...packets.map((p) => p.delay), 0);
	const totalMs = maxDelay + stepMs + 340;
	const start = performance.now();
	let ringsFired = false;
	let rafId: number | undefined;

	const tick = (now: number): void => {
		const elapsed = now - start;
		let alive = false;
		for (const p of packets) {
			const progress = (elapsed - p.delay) / stepMs;
			if (progress >= 0 && progress <= 1) {
				const pt = p.wire.getPointAtLength(p.len * progress);
				p.group.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
				p.group.style.opacity = '1';
				alive = true;
			} else {
				p.group.style.opacity = '0';
			}
		}

		if (!ringsFired && elapsed >= stepMs * 0.44) {
			ringsFired = true;
			for (const pt of junctionPoints.slice(0, 14)) {
				const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				ring.setAttribute('cx', pt.x.toFixed(1));
				ring.setAttribute('cy', pt.y.toFixed(1));
				ring.setAttribute('r', coreR.toFixed(1));
				ring.setAttribute('fill', 'none');
				ring.setAttribute('stroke', 'var(--mark)');
				ring.setAttribute('stroke-width', (strokeW * 1.4).toFixed(1));
				ring.style.animation = 'plotter-pulse-ring 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards';
				layer.appendChild(ring);
			}
		}

		if (alive || elapsed < totalMs) {
			rafId = requestAnimationFrame(tick);
		} else {
			layer.remove();
			rafId = undefined;
		}
	};

	rafId = requestAnimationFrame(tick);

	return () => {
		if (rafId !== undefined) cancelAnimationFrame(rafId);
		layer.remove();
	};
}
