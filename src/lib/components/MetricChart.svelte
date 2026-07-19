<script lang="ts">
	type Metric = 'meanMilliseconds' | 'installKibibytes' | 'svgBytes';
	interface ReleaseBenchmark {
		readonly version: string;
		readonly meanMilliseconds: number;
		readonly p95Milliseconds: number;
		readonly installKibibytes: number;
		readonly svgBytes: number;
	}

	let {
		rows,
		metric,
		label,
		unit,
		color = 'var(--signal)'
	}: {
		rows: readonly ReleaseBenchmark[];
		metric: Metric;
		label: string;
		unit: string;
		color?: string;
	} = $props();

	const width = 540;
	const height = 190;
	const inset = 28;
	const values = $derived(rows.map((row) => row[metric]));
	const maximum = $derived(Math.max(...values, 1));
	const minimum = $derived(Math.min(...values, 0));
	const range = $derived(Math.max(maximum - minimum, maximum * 0.1, 0.001));
	const coordinates = $derived(
		rows.map((row, index) => ({
			x: inset + (index / Math.max(rows.length - 1, 1)) * (width - inset * 2),
			y: height - inset - ((row[metric] - minimum) / range) * (height - inset * 2),
			row
		}))
	);
	const line = $derived(
		coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
	);
</script>

<figure class="metric-chart">
	<figcaption><span>{label}</span><small>{unit}</small></figcaption>
	<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} across releases`}>
		<g class="chart-grid" aria-hidden="true">
			<path
				d={`M${inset} ${inset}H${width - inset}M${inset} ${height / 2}H${width - inset}M${inset} ${height - inset}H${width - inset}`}
			/>
		</g>
		<path
			class="chart-area"
			d={`${line} L${width - inset} ${height - inset} L${inset} ${height - inset}Z`}
			style:fill={color}
		/>
		<path class="chart-line" d={line} style:stroke={color} />
		{#each coordinates as point}
			<g class="chart-point" transform={`translate(${point.x} ${point.y})`}>
				<circle r="4" style:fill={color} />
				<title>{point.row.version}: {point.row[metric]} {unit}</title>
			</g>
			<text x={point.x} y={height - 8} text-anchor="middle">{point.row.version}</text>
			<text x={point.x} y={point.y - 10} text-anchor="middle">{point.row[metric]}</text>
		{/each}
	</svg>
</figure>
