<script lang="ts">
	/**
	 * A single-series time chart with a crosshair readout.
	 *
	 * The retired downloads chart drew the same area and put a `<title>` on every
	 * dot, which is the browser's tooltip: it takes a second to appear, cannot be
	 * styled, is unreachable from the keyboard, and requires the reader to hit a
	 * 3px circle. Here the whole plot is one hit target — the crosshair snaps to
	 * the nearest day, so a reader aims at a date rather than at a mark — and the
	 * same readout appears on arrow-key navigation.
	 *
	 * One series, so there is deliberately no legend: the panel heading already
	 * names what is plotted, and a one-swatch legend would restate it.
	 */
	interface Point {
		readonly label: string;
		readonly value: number;
	}

	interface Props {
		points: readonly Point[];
		/** Accessible summary of the whole series. */
		summary: string;
		/** Formats a value for the readout, axis, and table. */
		format?: (value: number) => string;
		/** Noun for one observation, used in the readout and table header. */
		unit?: string;
		height?: number;
	}

	let {
		points,
		summary,
		format = (value: number) => value.toLocaleString('en-US'),
		unit = 'value',
		height = 220
	}: Props = $props();

	/* A viewBox keeps the chart resolution-independent; the element is sized by
	   CSS, so these are drawing units rather than pixels. */
	const WIDTH = 720;
	const PAD_X = 46;
	const PAD_TOP = 22;
	const PAD_BOTTOM = 30;

	const plotWidth = WIDTH - PAD_X * 2;
	const plotHeight = $derived(height - PAD_TOP - PAD_BOTTOM);
	const peak = $derived(Math.max(1, ...points.map((point) => point.value)));

	const laid = $derived(
		points.map((point, index) => ({
			...point,
			index,
			x: points.length < 2 ? PAD_X : PAD_X + (index / (points.length - 1)) * plotWidth,
			y: PAD_TOP + plotHeight - (point.value / peak) * plotHeight
		}))
	);

	const linePath = $derived(
		laid.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
	);
	const areaPath = $derived(
		laid.length > 1
			? `${linePath} L${laid.at(-1)!.x} ${PAD_TOP + plotHeight} L${laid[0]!.x} ${PAD_TOP + plotHeight} Z`
			: ''
	);

	/* Four rounded gridline values rather than every observation: the axis
	   carries what the direct labels do not. */
	const ticks = $derived([0, 0.5, 1].map((fraction) => Math.round(peak * fraction)));

	const end = $derived(laid.at(-1));

	let active = $state<number | null>(null);
	const current = $derived(active === null ? null : (laid[active] ?? null));

	/** Snap to the nearest observation, so the pointer never has to find a mark. */
	function locate(event: PointerEvent): void {
		const target = event.currentTarget as SVGElement;
		const box = target.getBoundingClientRect();
		if (box.width === 0 || laid.length === 0) return;
		const ratio = (event.clientX - box.left) / box.width;
		const position = ratio * WIDTH;
		let nearest = 0;
		let best = Number.POSITIVE_INFINITY;
		for (const point of laid) {
			const distance = Math.abs(point.x - position);
			if (distance < best) {
				best = distance;
				nearest = point.index;
			}
		}
		active = nearest;
	}

	function onKeydown(event: KeyboardEvent): void {
		if (laid.length === 0) return;
		const last = laid.length - 1;
		if (event.key === 'ArrowRight') active = Math.min(last, (active ?? -1) + 1);
		else if (event.key === 'ArrowLeft') active = Math.max(0, (active ?? last + 1) - 1);
		else if (event.key === 'Home') active = 0;
		else if (event.key === 'End') active = last;
		else if (event.key === 'Escape') active = null;
		else return;
		event.preventDefault();
	}
</script>

<div class="timeseries">
	{#if laid.length > 1}
		<!--
			The plot really is keyboard-operable — arrows step the readout, Home/End
			jump to the ends, Escape clears it — so it takes a tab stop. The rules
			below assume an `img` is inert; this one is not, and everything the
			crosshair reveals is also in the live readout and the table beneath it,
			so nothing is gated behind the interaction.
		-->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<svg
			viewBox={`0 0 ${WIDTH} ${height}`}
			role="img"
			aria-label={summary}
			tabindex="0"
			style={`--plot-height:${height}px`}
			onpointermove={locate}
			onpointerleave={() => (active = null)}
			onkeydown={onKeydown}
			onblur={() => (active = null)}
		>
			{#each ticks as tick (tick)}
				{@const y = PAD_TOP + plotHeight - (tick / peak) * plotHeight}
				<line class="grid" x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} />
				<text class="axis" x={PAD_X - 8} y={y + 4} text-anchor="end">{format(tick)}</text>
			{/each}

			<path class="area" d={areaPath} />
			<path class="series" d={linePath} />

			{#if current}
				<line
					class="crosshair"
					x1={current.x}
					x2={current.x}
					y1={PAD_TOP}
					y2={PAD_TOP + plotHeight}
				/>
				<circle class="marker" cx={current.x} cy={current.y} r="5" />
			{/if}

			<!-- The endpoint is the one value worth labelling directly. -->
			{#if end}
				<text
					class="endpoint"
					x={Math.min(WIDTH - 4, end.x + 8)}
					y={end.y - 8}
					text-anchor={end.x > WIDTH - 90 ? 'end' : 'start'}
				>
					{format(end.value)}
				</text>
				<text class="axis" x={PAD_X} y={height - 8}>{laid[0]!.label}</text>
				<text class="axis" x={WIDTH - PAD_X} y={height - 8} text-anchor="end">{end.label}</text>
			{/if}
		</svg>

		<p class="readout" aria-live="polite">
			{#if current}
				<strong>{format(current.value)}</strong>
				<span>{unit} · {current.label}</span>
			{:else}
				<span class="hint">Hover or focus the chart, then use ← → to step through days.</span>
			{/if}
		</p>
	{:else}
		<p class="microlabel empty">Not enough observations to plot a series.</p>
	{/if}

	<details class="table-view">
		<summary class="microlabel">View as table</summary>
		<div class="table-scroll">
			<table>
				<caption class="visually-hidden">{summary}</caption>
				<thead>
					<tr><th scope="col">Day</th><th scope="col">{unit}</th></tr>
				</thead>
				<tbody>
					{#each points as point (point.label)}
						<tr><th scope="row">{point.label}</th><td>{format(point.value)}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</div>

<style>
	svg {
		inline-size: 100%;
		block-size: auto;
		display: block;
		touch-action: pan-y;
		border-radius: var(--radius-sm);

		&:focus-visible {
			outline: 2px solid var(--accent);
			outline-offset: 2px;
		}
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}

	.area {
		fill: var(--accent);
		opacity: 0.1;
	}

	.series {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.crosshair {
		stroke: var(--ink-faint);
		stroke-width: 1;
	}

	.marker {
		fill: var(--accent);
		/* The surface ring keeps the marker legible where it sits on the line. */
		stroke: var(--bg-panel);
		stroke-width: 2;
	}

	/* Text wears text tokens; the accent belongs to the marks. */
	.axis {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.endpoint {
		fill: var(--ink);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.readout {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		min-block-size: 1.6rem;
		font-size: var(--text-sm);
		color: var(--ink-mute);

		& strong {
			font-family: var(--font-mono);
			font-size: var(--text-base);
			color: var(--ink);
		}
	}

	.hint {
		color: var(--ink-faint);
		font-size: var(--text-xs, 0.75rem);
	}

	.table-view {
		margin-block-start: var(--space-3);

		& summary {
			cursor: pointer;
		}
	}

	.table-scroll {
		max-block-size: 260px;
		overflow: auto;
		margin-block-start: var(--space-2);
	}

	table {
		inline-size: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th,
	td {
		text-align: start;
		padding: var(--space-1) var(--space-2);
		border-block-end: 1px solid var(--line);
		font-weight: 400;
		color: var(--ink-mute);
	}

	td {
		font-family: var(--font-mono);
		color: var(--ink);
	}

	.visually-hidden {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
