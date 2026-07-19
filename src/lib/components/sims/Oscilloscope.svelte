<script lang="ts">
	/**
	 * 60 FPS SVG oscilloscope.
	 *
	 * A compact square instrument fed by one or more numeric sample rings
	 * (values in 0…1). Each channel's trace is a single `<path>` whose `d` is
	 * rebuilt from the coordinate array whenever the parent's rAF loop pushes a
	 * new frame — path serialization for a few hundred points is far below frame
	 * budget, and no external charting engine comes anywhere near this.
	 */
	interface Channel {
		readonly samples: readonly number[];
		/** CSS color for the trace; defaults to the accent palette by index. */
		readonly color?: string;
		/** Optional per-channel legend caption. */
		readonly name?: string;
	}

	interface Props {
		/** Single-channel convenience input. */
		samples?: readonly number[];
		/** Multi-channel input; takes precedence over `samples`. */
		channels?: readonly Channel[];
		label?: string;
	}

	let { samples, channels, label = 'scope' }: Props = $props();

	const SIZE = 128;
	const PADDING = 8;
	const PALETTE = ['var(--accent)', 'var(--accent-2)', 'var(--warn)'];

	const lines = $derived.by((): readonly Channel[] => {
		if (channels && channels.length > 0) return channels;
		if (samples) return [{ samples }];
		return [];
	});

	function pathFor(series: readonly number[]): string {
		if (series.length < 2) return '';
		const span = SIZE - PADDING * 2;
		const step = span / (series.length - 1);
		let d = '';
		for (const [index, sample] of series.entries()) {
			const x = PADDING + index * step;
			const y = PADDING + (1 - Math.max(0, Math.min(1, sample))) * span;
			d += `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
		}
		return d;
	}

	const traces = $derived(
		lines.map((channel, index) => ({
			d: pathFor(channel.samples),
			color: channel.color ?? PALETTE[index % PALETTE.length],
			name: channel.name
		}))
	);

	const legend = $derived(traces.filter((trace) => trace.name !== undefined));
</script>

<figure class="scope" aria-label={`Oscilloscope: ${label}`}>
	<svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${label} waveform`}>
		<rect class="scope-bezel" x="0.5" y="0.5" width={SIZE - 1} height={SIZE - 1} />
		{#each [1, 2, 3] as division (division)}
			<line
				class="scope-grid"
				x1={PADDING}
				x2={SIZE - PADDING}
				y1={PADDING + ((SIZE - 2 * PADDING) / 4) * division}
				y2={PADDING + ((SIZE - 2 * PADDING) / 4) * division}
			/>
			<line
				class="scope-grid"
				y1={PADDING}
				y2={SIZE - PADDING}
				x1={PADDING + ((SIZE - 2 * PADDING) / 4) * division}
				x2={PADDING + ((SIZE - 2 * PADDING) / 4) * division}
			/>
		{/each}
		{#each traces as trace, index (index)}
			<path class="scope-trace" d={trace.d} style={`--trace: ${trace.color}`} />
		{/each}
	</svg>
	{#if legend.length > 0}
		<ul class="scope-legend">
			{#each legend as entry (entry.name)}
				<li><span class="swatch" style={`background: ${entry.color}`}></span>{entry.name}</li>
			{/each}
		</ul>
	{/if}
	<figcaption class="microlabel">{label}</figcaption>
</figure>

<style>
	.scope {
		margin: 0;
		display: grid;
		gap: 2px;
		justify-items: center;

		& svg {
			inline-size: 128px;
			block-size: 128px;
			background: var(--bg-inset);
		}
	}

	.scope-bezel {
		fill: none;
		stroke: var(--line-strong);
	}

	.scope-grid {
		stroke: var(--line);
		stroke-width: 0.5;
	}

	.scope-trace {
		fill: none;
		stroke: var(--trace, var(--accent));
		stroke-width: 1.5;
		stroke-linejoin: round;
		filter: drop-shadow(0 0 3px var(--glow));
	}

	.scope-legend {
		display: flex;
		gap: var(--space-3);
		list-style: none;
		margin: 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);

		& li {
			display: inline-flex;
			align-items: center;
			gap: 0.35em;
			margin: 0;
		}

		& .swatch {
			inline-size: 10px;
			block-size: 2px;
		}
	}
</style>
