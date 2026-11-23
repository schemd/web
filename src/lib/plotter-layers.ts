/**
 * Shared helpers for The Plotter Sheet's optical 4-plate 3D Explode stack
 * and real-wire signal pulse propagation.
 */

/**
 * Create a self-contained, aria-hidden SVG clone for one optical acetate layer
 * with uniquely prefixed element IDs so the DOM never contains duplicate IDs.
 */
export function projectLayerSvg(rawSvg: string, suffix: string): string {
	if (!rawSvg) return '';
	const prefix = `layer-${suffix}-`;
	return rawSvg
		.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
		.replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, '')
		.replace(/\srole="img"/gi, '')
		.replace(/\saria-labelledby="[^"]*"/gi, '')
		.replace(/\sid="([^"]+)"/g, (_, id: string) => ` id="${prefix}${id}"`)
		.replace(/\bhref="#([^"]+)"/g, (_, id: string) => `href="#${prefix}${id}"`)
		.replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`);
}

/**
 * Propagate luminous signal packets along every routed `.schematic-trace` path
 * inside an SVG, with junction ripple rings where nets branch. Returns a cancel
 * callback to cleanly tear down the animation.
 */
export function pulseSvgWires(svgEl: SVGSVGElement): () => void {
	svgEl.querySelector('[data-plotter-pulse]')?.remove();
	const wires = Array.from(svgEl.querySelectorAll<SVGPathElement>('path.schematic-trace')).filter(
		(path) => path.getTotalLength() > 0
	);
	if (wires.length === 0) return () => undefined;

	const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	layer.setAttribute('data-plotter-pulse', '');
	layer.setAttribute('pointer-events', 'none');
	svgEl.appendChild(layer);

	const packets = wires.map((wire, index) => {
		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.setAttribute('r', '4');
		dot.setAttribute('fill', 'var(--mark)');
		dot.setAttribute('stroke', 'var(--ink)');
		dot.setAttribute('stroke-width', '1.25');
		dot.style.opacity = '0';
		layer.appendChild(dot);
		return {
			wire,
			len: wire.getTotalLength(),
			delay: (index % 4) * 85,
			dot
		};
	});

	/* Detect junction dots (both explicit <circle> and compiled .schematic-node-fill paths). */
	const junctionPoints: { x: number; y: number }[] = [];
	for (const c of svgEl.querySelectorAll<SVGCircleElement>('circle')) {
		const r = Number(c.getAttribute('r'));
		if (r >= 2.2 && r <= 4.5 && c.closest('[data-plotter-pulse]') === null) {
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

	const stepMs = 520;
	const maxDelay = Math.max(...packets.map((p) => p.delay), 0);
	const totalMs = maxDelay + stepMs + 280;
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
				p.dot.setAttribute('cx', pt.x.toFixed(1));
				p.dot.setAttribute('cy', pt.y.toFixed(1));
				p.dot.style.opacity = '1';
				alive = true;
			} else {
				p.dot.style.opacity = '0';
			}
		}

		if (!ringsFired && elapsed >= stepMs * 0.48) {
			ringsFired = true;
			for (const pt of junctionPoints.slice(0, 12)) {
				const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				ring.setAttribute('cx', pt.x.toFixed(1));
				ring.setAttribute('cy', pt.y.toFixed(1));
				ring.setAttribute('r', '3');
				ring.setAttribute('fill', 'none');
				ring.setAttribute('stroke', 'var(--mark)');
				ring.setAttribute('stroke-width', '2.2');
				ring.style.animation = 'plotter-pulse-ring 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards';
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
