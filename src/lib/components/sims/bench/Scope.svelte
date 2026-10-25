<script lang="ts">
	/**
	 * A two-channel oscilloscope for whatever the probes are clipped to.
	 *
	 * Channels sample across the screen (`x` 0 → 1) and scroll with `phase`
	 * while running. Paused, or for a reader who prefers reduced motion, it draws
	 * one still frame and redraws only when a value changes. The vertical scale
	 * snaps to a 1-2-5 step that fits both channels, so the two are comparable.
	 */
	interface Channel {
		readonly id: string;
		readonly letter: string;
		readonly label: string;
		readonly color: string;
		readonly sample: (x: number, phase: number) => number;
		readonly summary: string;
		readonly unit: string;
		readonly ac?: boolean;
	}

	interface Props {
		channels: readonly Channel[];
		running: boolean;
		/** What one horizontal division means, as a reader says it. */
		timebase: string;
		/** Changes whenever a sampled value changes, so a still frame redraws. */
		revision: string;
	}

	let { channels, running, timebase, revision }: Props = $props();

	let canvas = $state<HTMLCanvasElement | undefined>();
	let swatches = $state<HTMLElement[]>([]);
	let phase = 0;
	/* Each channel has its own volts (or amps) per division, as on a bench scope. */
	let scales = $state<number[]>([]);

	const STEPS = [1, 2, 5];
	function niceScale(peak: number): number {
		const target = Math.max(peak, 1e-6) / 3.6;
		const exponent = Math.floor(Math.log10(target));
		for (const step of STEPS) {
			const value = step * 10 ** exponent;
			if (value >= target) return value;
		}
		return 10 ** (exponent + 1);
	}

	function draw(): void {
		if (!canvas) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const ratio = devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (
			canvas.width !== Math.round(width * ratio) ||
			canvas.height !== Math.round(height * ratio)
		) {
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
		}
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, width, height);
		const style = getComputedStyle(canvas);
		const grid = style.getPropertyValue('--scope-grid').trim() || 'rgb(128 128 128 / 0.2)';
		const axis = style.getPropertyValue('--scope-axis').trim() || 'rgb(128 128 128 / 0.45)';

		context.lineWidth = 1;
		for (let column = 1; column < 10; column += 1) {
			const x = Math.round((width * column) / 10) + 0.5;
			context.strokeStyle = column === 5 ? axis : grid;
			context.beginPath();
			context.moveTo(x, 0);
			context.lineTo(x, height);
			context.stroke();
		}
		for (let row = 1; row < 8; row += 1) {
			const y = Math.round((height * row) / 8) + 0.5;
			context.strokeStyle = row === 4 ? axis : grid;
			context.beginPath();
			context.moveTo(0, y);
			context.lineTo(width, y);
			context.stroke();
		}

		const samples = Math.max(120, Math.round(width));
		const next: number[] = [];
		const traces = channels.map((channel) => {
			const values: number[] = [];
			let peak = 0;
			for (let index = 0; index <= samples; index += 1)
				values.push(channel.sample(index / samples, phase));
			if (channel.ac) {
				const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
				for (let index = 0; index < values.length; index += 1) values[index]! -= mean;
			}
			for (const value of values) peak = Math.max(peak, Math.abs(value));
			next.push(niceScale(peak));
			return values;
		});
		if (next.join() !== scales.join()) scales = next;
		const perDivision = height / 8;
		traces.forEach((values, channelIndex) => {
			const scale = next[channelIndex]!;
			const color = swatches[channelIndex]
				? getComputedStyle(swatches[channelIndex]!).backgroundColor
				: axis;
			context.strokeStyle = color;
			context.lineWidth = 2;
			context.lineJoin = 'round';
			context.beginPath();
			values.forEach((value, index) => {
				const x = (width * index) / samples;
				const y = height / 2 - (value / scale) * perDivision;
				if (index === 0) context.moveTo(x, y);
				else context.lineTo(x, y);
			});
			context.stroke();
		});
	}

	const reduce =
		typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;

	$effect(() => {
		void revision;
		void channels.length;
		if (!canvas) return;
		if (!running || reduce?.matches) {
			draw();
			const observer = new ResizeObserver(() => draw());
			observer.observe(canvas);
			return () => observer.disconnect();
		}
		let frame = 0;
		let last = performance.now();
		const loop = (now: number) => {
			phase += Math.min(0.05, (now - last) / 1000) * 2.4;
			last = now;
			draw();
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	/* 1-2-5 values with an SI prefix: 20 µA/div, 0.2 V/div, 5 mV/div. */
	function formatScale(value: number, unit: string): string {
		/* Amplitudes and logic levels have no unit, so no prefix either. */
		if (!unit) return String(Number(value.toPrecision(2)));
		const prefixes: ReadonlyArray<readonly [number, string]> = [
			[1e6, 'M'],
			[1e3, 'k'],
			[1, ''],
			[1e-3, 'm'],
			[1e-6, 'µ'],
			[1e-9, 'n']
		];
		for (const [scale, prefix] of prefixes) {
			if (value >= scale * 0.999)
				return `${Number((value / scale).toPrecision(2))} ${prefix}${unit}`;
		}
		return `${value.toExponential(0)} ${unit}`;
	}
	const description = $derived(
		channels.length
			? `Oscilloscope. ${channels.map((channel) => `Channel ${channel.letter}, ${channel.label}: ${channel.summary}`).join('. ')}.`
			: 'Oscilloscope with no probe attached. Click a wire in the drawing to clip a probe on.'
	);
</script>

<figure class="scope">
	<div class="screen">
		<div class="trace" role="img" aria-label={description}>
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
		</div>
		{#if !channels.length}
			<p class="idle">Click a wire to clip a probe on.</p>
		{/if}
	</div>
	<figcaption>
		<ul class="legend">
			{#each channels as channel, index (channel.letter)}
				<li>
					<i class="swatch" style={`background:${channel.color}`} bind:this={swatches[index]}></i>
					<b>{channel.letter}{channel.ac ? '~' : ''}</b>
					<span>{channel.label}</span>
					<output>{channel.summary}</output>
					<span class="per-div"
						>{scales[index] ? `${formatScale(scales[index]!, channel.unit)}/div` : ''}</span
					>
				</li>
			{/each}
		</ul>
		<span class="divisions">{timebase}</span>
	</figcaption>
</figure>

<style>
	.scope {
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}

	.screen {
		position: relative;
		aspect-ratio: 5 / 3;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--bg-inset);
		overflow: hidden;
	}

	.trace {
		position: absolute;
		inset: 0;
	}

	canvas {
		--scope-grid: color-mix(in srgb, var(--ink-faint) 30%, transparent);
		--scope-axis: color-mix(in srgb, var(--ink-mute) 55%, transparent);
		display: block;
		inline-size: 100%;
		block-size: 100%;
	}

	.idle {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		font: var(--text-xs) / 1.4 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		color: var(--ink-mute);
	}

	figcaption {
		display: grid;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.legend {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;

		& li {
			display: grid;
			grid-template-columns: 10px 1.2em minmax(0, 1fr) auto auto;
			align-items: center;
			gap: 6px;
		}

		& b {
			color: var(--ink);
		}

		& output {
			color: var(--ink);
			font-variant-numeric: tabular-nums;
		}
	}

	.per-div {
		min-inline-size: 7.5em;
		text-align: end;
		font-variant-numeric: tabular-nums;
	}

	.swatch {
		inline-size: 10px;
		block-size: 3px;
		border-radius: 1px;
	}

	.divisions {
		font-variant-numeric: tabular-nums;
	}
</style>
