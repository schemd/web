/**
 * Current, drawn as dots moving along the compiled wires.
 *
 * Each trace gets one sibling clone carrying the `flow-dots` class; CSS turns
 * it into round dots marching along the same path, so the drawing's geometry is
 * never touched. The dots' speed follows the model's current and their direction
 * its sign. Reduced motion stops the march (see the bench's CSS); a wire with
 * no current shows no dots.
 */
import { wirePaths } from '#lib/sim-dom.ts';

const FASTEST_PERIOD = 0.35;
const SLOWEST_PERIOD = 3.2;

function dotsFor(path: SVGElement): SVGElement {
	const next = path.nextElementSibling;
	if (next instanceof SVGElement && next.classList.contains('flow-dots')) return next;
	const clone = path.cloneNode(false) as SVGElement;
	clone.removeAttribute('id');
	clone.removeAttribute('style');
	clone.removeAttribute('marker-start');
	clone.removeAttribute('marker-end');
	clone.setAttribute('class', 'flow-dots');
	clone.setAttribute('aria-hidden', 'true');
	path.after(clone);
	return clone;
}

interface FlowOptions {
	/** Only the wire to this endpoint, when one source fans out to several. */
	readonly target?: string;
	/**
	 * Alternating current: the dots slosh back and forth instead of marching,
	 * one swing per half `period` seconds.
	 */
	readonly alternate?: boolean;
	readonly period?: number;
}

/**
 * Show current on the wires from `source`.
 *
 * @param rate - Signed current, normalised to −1…1. Zero hides the dots.
 */
export function setFlow(
	host: Element,
	source: string,
	rate: number,
	options: FlowOptions = {}
): void {
	const magnitude = Math.min(1, Math.abs(rate));
	for (const path of wirePaths(host, source)) {
		if (
			options.target &&
			path.closest('[data-wire-target]')?.getAttribute('data-wire-target') !== options.target
		)
			continue;
		const dots = dotsFor(path);
		if (magnitude < 0.02) {
			dots.style.setProperty('opacity', '0');
			continue;
		}
		const period = options.period ?? SLOWEST_PERIOD - (SLOWEST_PERIOD - FASTEST_PERIOD) * magnitude;
		dots.style.setProperty('opacity', (0.35 + 0.65 * magnitude).toFixed(2));
		dots.style.setProperty(
			'--flow-period',
			`${(options.alternate ? period / 2 : period).toFixed(2)}s`
		);
		dots.style.setProperty(
			'animation-direction',
			options.alternate ? 'alternate' : rate < 0 ? 'reverse' : 'normal'
		);
		dots.style.setProperty(
			'animation-timing-function',
			options.alternate ? 'ease-in-out' : 'linear'
		);
		/* An alternating swing travels only as far as the current is strong. */
		dots.style.setProperty(
			'--flow-reach',
			options.alternate ? `${(-4 - 8 * magnitude).toFixed(2)}` : '-12.01'
		);
	}
}
