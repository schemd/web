<script lang="ts">
	interface Point {
		x: number;
		y: number;
	}

	interface Props {
		points: readonly Point[];
		label?: string;
		xLabel?: string;
		yLabel?: string;
	}

	let { points, label = 'phase portrait', xLabel = 'x', yLabel = 'y' }: Props = $props();

	const SIZE = 180;
	const PAD = 12;

	const projected = $derived.by(() => {
		if (points.length < 2) return '';
		let extent = 1;
		for (const point of points) extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
		extent *= 1.08;
		const span = SIZE - PAD * 2;
		return points
			.map((point, index) => {
				const x = PAD + ((point.x / extent + 1) / 2) * span;
				const y = PAD + (1 - (point.y / extent + 1) / 2) * span;
				return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			})
			.join(' ');
	});
</script>

<figure class="portrait" aria-label={label}>
	<svg
		viewBox={`0 0 ${SIZE} ${SIZE}`}
		role="img"
		aria-label={`${label}: ${yLabel} against ${xLabel}`}
	>
		<rect class="bezel" x="0.5" y="0.5" width={SIZE - 1} height={SIZE - 1} />
		<line class="axis" x1={PAD} x2={SIZE - PAD} y1={SIZE / 2} y2={SIZE / 2} />
		<line class="axis" x1={SIZE / 2} x2={SIZE / 2} y1={PAD} y2={SIZE - PAD} />
		<path class="orbit-glow" d={projected} />
		<path class="orbit" d={projected} />
		<text class="axis-label" x={SIZE - PAD} y={SIZE / 2 - 4}>{xLabel}</text>
		<text class="axis-label" x={SIZE / 2 + 4} y={PAD}>{yLabel}</text>
	</svg>
	<figcaption class="microlabel">{label}</figcaption>
</figure>

<style>
	.portrait {
		margin: 0;
		display: grid;
		gap: 3px;
		justify-items: center;

		& svg {
			inline-size: min(100%, 180px);
			background: var(--bg-inset);
		}
	}

	.bezel {
		fill: none;
		stroke: var(--line-strong);
	}

	.axis {
		stroke: var(--line);
		stroke-width: 0.65;
		stroke-dasharray: 2 3;
	}

	.orbit,
	.orbit-glow {
		fill: none;
		stroke: var(--accent);
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.orbit {
		stroke-width: 1.05;
	}

	.orbit-glow {
		stroke-width: 3;
		opacity: 0.16;
		filter: blur(1px);
	}

	.axis-label {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
	}
</style>
