<script lang="ts">
	/**
	 * A small instrument plot for the dock: a step response, a spectrum, the
	 * voltage along a line. Series are sampled evenly from left to right; the
	 * caller owns the physics and passes numbers only. Bands shade an x range,
	 * markers draw vertical cursors, and levels draw horizontal references.
	 */
	type Tone = 'accent' | 'cyan' | 'emerald' | 'amber' | 'purple' | 'mute';

	interface Series {
		readonly id: string;
		readonly values: readonly number[];
		readonly tone: Tone;
		/** Draw as a staircase (logic levels, sampled data). */
		readonly step?: boolean;
		readonly dashed?: boolean;
	}

	interface Props {
		/** The plot's accessible description, with its current values. */
		label: string;
		series: readonly Series[];
		min: number;
		max: number;
		/** Vertical cursors at fractions of the width. */
		markers?: readonly { readonly at: number; readonly tone?: Tone; readonly label?: string }[];
		/** Shaded x ranges, as fractions of the width. */
		bands?: readonly { readonly from: number; readonly to: number; readonly label?: string }[];
		/** Horizontal reference lines, in data units. */
		levels?: readonly { readonly at: number; readonly label?: string }[];
		xStart?: string;
		xEnd?: string;
		caption?: string;
		height?: number;
	}

	let {
		label,
		series,
		min,
		max,
		markers = [],
		bands = [],
		levels = [],
		xStart,
		xEnd,
		caption,
		height = 128
	}: Props = $props();

	const WIDTH = 260;
	const LEFT = 10;
	const RIGHT = 250;
	const TOP = 10;
	const bottom = $derived(height - 18);
	const span = $derived(max - min || 1);
	const x = (fraction: number) => LEFT + (RIGHT - LEFT) * Math.min(1, Math.max(0, fraction));
	const y = (value: number) =>
		TOP + (bottom - TOP) * (1 - (Math.min(max, Math.max(min, value)) - min) / span);

	function path(line: Series): string {
		const count = line.values.length;
		if (count < 2) return '';
		let d = '';
		for (let index = 0; index < count; index += 1) {
			const px = x(index / (count - 1)).toFixed(1);
			const py = y(line.values[index]!).toFixed(1);
			if (index === 0) d += `M ${px} ${py}`;
			else if (line.step) d += ` H ${px} V ${py}`;
			else d += ` L ${px} ${py}`;
		}
		return d;
	}
</script>

<figure class="plot">
	<svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={label}>
		{#each bands as band, index (index)}
			<rect
				class="band"
				x={x(band.from)}
				y={TOP}
				width={Math.max(1, x(band.to) - x(band.from))}
				height={bottom - TOP}
			/>
			{#if band.label}<text class="band-label" x={x(band.from) + 3} y={TOP + 9}>{band.label}</text
				>{/if}
		{/each}
		<line class="frame" x1={LEFT} x2={RIGHT} y1={bottom} y2={bottom} />
		{#each levels as level, index (index)}
			<line class="level" x1={LEFT} x2={RIGHT} y1={y(level.at)} y2={y(level.at)} />
			{#if level.label}<text class="level-label" x={RIGHT} y={y(level.at) - 3}>{level.label}</text
				>{/if}
		{/each}
		{#each series as line (line.id)}
			<path class="series tone-{line.tone}" class:dashed={line.dashed} d={path(line)} />
		{/each}
		{#each markers as marker, index (index)}
			<line
				class="marker tone-{marker.tone ?? 'accent'}"
				x1={x(marker.at)}
				x2={x(marker.at)}
				y1={TOP}
				y2={bottom}
			/>
			{#if marker.label}<text class="marker-label" x={x(marker.at) + 3} y={bottom - 4}
					>{marker.label}</text
				>{/if}
		{/each}
		{#if xStart}<text x={LEFT} y={height - 4}>{xStart}</text>{/if}
		{#if xEnd}<text class="end" x={RIGHT} y={height - 4}>{xEnd}</text>{/if}
	</svg>
	{#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
	.plot {
		display: grid;
		gap: var(--space-2);
		margin: 0;

		& svg {
			display: block;
			inline-size: 100%;
			/* Beside a wide stage the dock is narrow; under it on a tablet it is not. */
			max-block-size: 190px;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			background: var(--bg-inset);
		}

		& figcaption {
			font: var(--text-xs) / 1.4 var(--font-mono);
			color: var(--ink-mute);
		}
	}

	.frame {
		stroke: var(--line-strong);
	}

	.level {
		stroke: var(--line-strong);
		stroke-dasharray: 2 4;
	}

	.band {
		fill: color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.series {
		fill: none;
		stroke-width: 1.6;
		stroke-linejoin: round;

		&.dashed {
			stroke-dasharray: 4 3;
			stroke-width: 1.2;
		}
	}

	.marker {
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.tone-accent {
		stroke: var(--accent);
	}
	.tone-cyan {
		stroke: var(--schematic-color-cyan);
	}
	.tone-emerald {
		stroke: var(--schematic-color-emerald);
	}
	.tone-amber {
		stroke: var(--schematic-color-amber);
	}
	.tone-purple {
		stroke: var(--schematic-color-purple);
	}
	.tone-mute {
		stroke: var(--ink-faint);
	}

	text {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;

		&.end,
		&.level-label {
			text-anchor: end;
		}
	}
</style>
