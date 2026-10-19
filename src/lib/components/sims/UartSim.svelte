<script lang="ts">
	/**
	 * UART link with a logic analyzer, on the v2 bench.
	 *
	 * The transmitter frames the byte; the receiver syncs on the start edge and
	 * samples mid-bit by its own clock. The analyzer draws the line with one idle
	 * bit either side, every bit cell, and every sampling instant: green where a
	 * sample lands inside the bit it means to read, red where accumulated clock
	 * error has carried it into a neighbour.
	 */
	import { setWiresFrom, setWireSignalFrom } from '#lib/sim-dom.ts';
	import { uartFrame, uartReceive, type UartParity } from '#lib/simulation-models.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import { signed } from './bench/format';
	import type { PartControl } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let byte = $state(0x53);
	let skew = $state(0);
	let parity = $state<UartParity>('none');
	let inverted = $state(false);
	const timeline = useSimulationTimelineModel();

	const frame = $derived(uartFrame(byte, parity));
	const decode = $derived(uartReceive(frame, skew / 100, parity, inverted));
	const line = $derived(frame.map((bit) => (inverted ? 1 - bit : bit)));
	const idle = $derived(inverted ? 0 : 1);
	const ok = $derived(decode.byte === byte && !decode.framingError && !decode.parityError);
	const drift = $derived((frame.length - 0.5) * (skew / 100));
	const status = $derived(
		decode.framingError
			? 'framing error · stop bit read low'
			: decode.parityError
				? 'parity error · a bit slipped'
				: decode.byte !== byte
					? 'wrong byte, no error flagged'
					: `received 0x${hex(byte)} cleanly`
	);

	function hex(value: number): string {
		return value.toString(16).toUpperCase().padStart(2, '0');
	}
	function binary(value: number): string {
		return value.toString(2).padStart(8, '0');
	}
	function glyph(value: number): string {
		return value >= 0x20 && value < 0x7f ? `“${String.fromCharCode(value)}”` : '';
	}
	const names = $derived([
		'S',
		...Array.from({ length: 8 }, (_, index) => String(index)),
		...(parity === 'none' ? [] : ['P']),
		'Sp'
	]);

	/* Analyzer geometry: one idle cell before the frame, one after. */
	const WIDTH = 260;
	const LEFT = 8;
	const RIGHT = 252;
	const cells = $derived(frame.length + 2);
	const cell = $derived((RIGHT - LEFT) / cells);
	const cellX = (index: number) => LEFT + (index + 1) * cell;
	const HIGH = 34;
	const LOW = 62;
	const levelY = (bit: number) => (bit ? HIGH : LOW);
	const wave = $derived.by(() => {
		let d = `M ${LEFT} ${levelY(idle)} H ${cellX(0)}`;
		let previous = idle;
		line.forEach((bit, index) => {
			if (bit !== previous) d += ` V ${levelY(bit)}`;
			d += ` H ${cellX(index + 1)}`;
			previous = bit;
		});
		if (idle !== previous) d += ` V ${levelY(idle)}`;
		return `${d} H ${RIGHT}`;
	});
	const ticks = $derived(
		decode.samples.map((time, index) => ({
			x: LEFT + (time + 1) * cell,
			bit: decode.bits[index]!,
			good: Math.floor(time) === index
		}))
	);

	$effect(() => {
		const root = host;
		if (!root) return;
		setWireSignalFrom(root, 'TX.tx', idle === 1);
		setWireSignalFrom(root, 'LINE.node', idle === 1);
		setWiresFrom(root, 'RX.err', decode.framingError || decode.parityError);
		setWiresFrom(root, 'RX.data', ok);
	});

	const controls = $derived<PartControl[]>([
		{
			id: 'uart-byte',
			node: 'BYTE',
			label: 'byte',
			ariaLabel: 'Transmitted byte',
			min: 0,
			max: 255,
			step: 1,
			value: byte,
			display: `0x${hex(byte)} ${glyph(byte)}`,
			set: (value) => (byte = value),
			place: 'above'
		},
		{
			id: 'uart-skew',
			node: 'RCLK',
			label: 'RX clock',
			ariaLabel: 'Receiver clock error, minus 10 to plus 10 percent',
			min: -10,
			max: 10,
			step: 0.1,
			value: skew,
			display: `${signed(skew, 1)} %`,
			set: (value) => (skew = value),
			place: 'below'
		}
	]);
</script>

<Bench
	title="UART logic analyzer"
	tone="digital"
	{status}
	{stage}
	{dock}
	{deck}
	hint="Drag the byte and the receiver-clock tags. The analyzer shows the line and every instant the receiver samples it."
/>

{#snippet stage()}
	<div class="uart-canvas">
		<div
			class="sim-stage uart-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="UART link: a byte and transmit clock into the transmitter, one serial line, and a receiver with its own baud clock. Drag the tags on the byte and the receiver clock."
			data-model-stage={timeline.step}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
	</div>
{/snippet}

{#snippet dock()}
	<figure class="analyzer">
		<p class="microlabel">Logic analyzer</p>
		<svg
			viewBox={`0 0 ${WIDTH} 104`}
			role="img"
			aria-label={`Serial line for byte 0x${hex(byte)}: ${line.join('')} between idle ${idle}s. Receiver read ${decode.bits.join('')}; ${ticks.filter((tick) => !tick.good).length} samples landed in the wrong bit.`}
		>
			{#each names as name, index (index)}
				<rect
					class="cell"
					class:alt={index % 2 === 1}
					x={cellX(index)}
					y="22"
					width={cell}
					height="48"
				/>
				<text class="cell-name" x={cellX(index) + cell / 2} y="16">{name}</text>
			{/each}
			<path class="line" d={wave} />
			{#each ticks as tick, index (index)}
				<line class="tick" class:bad={!tick.good} x1={tick.x} x2={tick.x} y1="24" y2="70" />
				<circle class="sample" class:bad={!tick.good} cx={tick.x} cy={levelY(tick.bit)} r="2.4" />
				<text class="read" class:bad={!tick.good} x={tick.x} y="86">{tick.bit}</text>
			{/each}
			<text class="axis" x={LEFT} y="100">idle</text>
			<text class="axis end" x={RIGHT} y="100">idle</text>
		</svg>
		<figcaption>
			line level · <span class="good-key">●</span> sample inside its bit ·
			<span class="bad-key">●</span> sample in a neighbour
		</figcaption>
	</figure>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="metrics">
			<div>
				<span>sent</span>
				<strong
					><LiveMath
						id="uart.readout.tx"
						label={`sent ${binary(byte)}, hex ${hex(byte)}`}
						values={{ bits: binary(byte), hex: hex(byte) }}
					/></strong
				>
			</div>
			<div>
				<span>received</span>
				<strong
					><LiveMath
						id="uart.readout.rx"
						label={`received ${binary(decode.byte)}, hex ${hex(decode.byte)}`}
						values={{ bits: binary(decode.byte), hex: hex(decode.byte) }}
					/></strong
				>
			</div>
			<div>
				<span>stop-bit drift</span>
				<strong
					><LiveMath
						id="uart.readout.drift"
						label={`last sample off by ${signed(drift)} bit`}
						values={{ value: signed(drift) }}
					/></strong
				>
			</div>
			<div>
				<span>flags</span>
				<strong
					><LiveMath
						id="uart.readout.flags"
						label={`framing ${decode.framingError ? 'error' : 'ok'}, parity ${parity === 'none' ? 'off' : decode.parityError ? 'error' : 'ok'}`}
						values={{
							framing: decode.framingError ? 'error' : 'ok',
							parity: parity === 'none' ? 'off' : decode.parityError ? 'error' : 'ok'
						}}
					/></strong
				>
			</div>
		</div>
	</section>
{/snippet}

{#snippet deck()}
	<div class="deck-group">
		<span class="microlabel">Parity</span>
		<div class="presets" role="group" aria-label="Parity">
			{#each ['none', 'even', 'odd'] as const as value (value)}
				<button
					class="btn"
					type="button"
					data-parity={value}
					aria-pressed={parity === value}
					onclick={() => (parity = value)}>{value}</button
				>
			{/each}
		</div>
	</div>
	<div class="deck-group">
		<span class="microlabel">Try</span>
		<div class="presets">
			<button class="btn" type="button" data-preset="crystal" onclick={() => (skew = 0.5)}
				>Crystal-grade clock (+0.5 %)</button
			>
			<button class="btn" type="button" data-preset="rc-clock" onclick={() => (skew = 6)}
				>Cheap RC clock (+6 %)</button
			>
		</div>
	</div>
	<div class="deck-group">
		<FaultSwitch label="TX line polarity inverted" bind:active={inverted} />
	</div>
{/snippet}

<style>
	.uart-canvas {
		position: relative;
	}

	.uart-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.analyzer {
		display: grid;
		gap: var(--space-2);
		margin: 0;

		& svg {
			display: block;
			inline-size: 100%;
			max-block-size: 210px;
			border: 1px solid var(--line);
			border-radius: var(--radius-sm);
			background: var(--bg-inset);
		}

		& figcaption {
			font: var(--text-xs) / 1.4 var(--font-mono);
			color: var(--ink-mute);
		}
	}

	.cell {
		fill: transparent;
		stroke: var(--line);
		stroke-width: 0.5;

		&.alt {
			fill: color-mix(in srgb, var(--ink-faint) 6%, transparent);
		}
	}

	.line {
		fill: none;
		stroke: var(--schematic-color-cyan);
		stroke-width: 1.6;
	}

	.tick {
		stroke: var(--schematic-color-emerald);
		stroke-width: 0.6;
		stroke-dasharray: 2 2;

		&.bad {
			stroke: var(--danger, #f2555a);
		}
	}

	.sample {
		fill: var(--schematic-color-emerald);

		&.bad {
			fill: var(--danger, #f2555a);
		}
	}

	text {
		font-family: var(--font-mono);
		font-size: 7px;
		fill: var(--ink-faint);
		text-anchor: middle;

		&.read {
			fill: var(--ink);

			&.bad {
				fill: var(--danger, #f2555a);
			}
		}

		&.axis {
			text-anchor: start;

			&.end {
				text-anchor: end;
			}
		}
	}

	.good-key {
		color: var(--schematic-color-emerald);
	}

	.bad-key {
		color: var(--danger, #f2555a);
	}

	.dock-block {
		display: grid;
		gap: var(--space-2);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);

		& > div {
			display: grid;
			gap: 2px;
			min-inline-size: 0;
		}

		& span {
			font: var(--text-xs) / 1.4 var(--font-mono);
			color: var(--ink-mute);
		}

		& strong {
			font-size: var(--text-sm);
			font-weight: 560;
			color: var(--ink);
			overflow-wrap: anywhere;
		}
	}

	.deck-group {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
