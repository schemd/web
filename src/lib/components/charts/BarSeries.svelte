<script lang="ts">
	/**
	 * A horizontal magnitude chart, built from ordinary HTML rather than SVG.
	 *
	 * Bars are the one form where SVG buys nothing: the category names are real
	 * text that must wrap, be selected, and be read by a screen reader, and a
	 * `<div>` needs no label-fitting arithmetic to avoid clipping them. Each row
	 * is its own hit target and its own tab stop, which is what the skill asks
	 * for on bar marks — no crosshair, the mark *is* the target.
	 *
	 * `tone` exists for status magnitude (error / warning / info counts). Status
	 * colour is never the only channel: every toned row also prints its severity
	 * as text, because the reserved status hues sit inside the CVD floor band and
	 * are only legal alongside a secondary encoding.
	 */
	export type BarTone = 'default' | 'ok' | 'warn' | 'danger';

	interface Item {
		readonly label: string;
		readonly value: number;
		/** Optional status severity; prints as text beside the bar. */
		readonly tone?: BarTone;
		/** Optional secondary line under the label. */
		readonly note?: string;
		/** Optional destination — the whole row becomes a link. */
		readonly href?: string;
	}

	interface Props {
		items: readonly Item[];
		/** Accessible summary of the whole chart. */
		summary: string;
		format?: (value: number) => string;
		/** Noun for one observation, used in the table header. */
		unit?: string;
		/** Force a common scale; defaults to the largest value present. */
		max?: number;
	}

	let {
		items,
		summary,
		format = (value: number) => value.toLocaleString('en-US'),
		unit = 'count',
		max
	}: Props = $props();

	const ceiling = $derived(Math.max(1, max ?? Math.max(...items.map((item) => item.value), 0)));
	const total = $derived(items.reduce((sum, item) => sum + item.value, 0));

	let active = $state<string | null>(null);

	function share(value: number): number {
		return Math.round((value / ceiling) * 1000) / 10;
	}
</script>

<div class="barseries" role="group" aria-label={summary}>
	<ul class="bars">
		{#each items as item (item.label)}
			{@const width = share(item.value)}
			{@const tone = item.tone ?? 'default'}
			<li
				class="bar-row"
				class:is-active={active === item.label}
				data-tone={tone}
				onpointerenter={() => (active = item.label)}
				onpointerleave={() => (active = null)}
				onfocusin={() => (active = item.label)}
				onfocusout={() => (active = null)}
			>
				<svelte:element
					this={item.href ? 'a' : 'div'}
					href={item.href}
					class="bar-hit"
					tabindex={item.href ? undefined : 0}
				>
					<span class="bar-label">
						<span class="bar-name">{item.label}</span>
						{#if item.note}<span class="bar-note">{item.note}</span>{/if}
					</span>

					<span class="bar-track" aria-hidden="true">
						<span class="bar-fill" style={`inline-size:${Math.max(width, 1.5)}%`}></span>
					</span>

					<span class="bar-value">
						{format(item.value)}
						{#if tone !== 'default'}
							<span class="bar-tone microlabel">{tone === 'danger' ? 'error' : tone}</span>
						{/if}
					</span>
				</svelte:element>
			</li>
		{/each}
	</ul>

	<details class="table-view">
		<summary class="microlabel">View as table</summary>
		<div class="table-scroll">
			<table>
				<caption class="visually-hidden">{summary}</caption>
				<thead>
					<tr>
						<th scope="col">Category</th>
						<th scope="col">{unit}</th>
						<th scope="col">Share</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.label)}
						<tr>
							<th scope="row">{item.label}</th>
							<td>{format(item.value)}</td>
							<td>{total === 0 ? '—' : `${((item.value / total) * 100).toFixed(1)}%`}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</div>

<style>
	.bars {
		display: grid;
		/* The 2px separation between adjacent bars is surface, not a stroke. */
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.bar-hit {
		display: grid;
		grid-template-columns: minmax(0, 12rem) minmax(0, 1fr) minmax(4.5rem, auto);
		align-items: center;
		gap: var(--space-3);
		/* The hit area is the whole row, well past the painted bar. */
		padding: var(--space-2) var(--space-2);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;

		&:focus-visible {
			outline: 2px solid var(--accent);
			outline-offset: -2px;
		}
	}

	.bar-row.is-active .bar-hit {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.bar-label {
		display: grid;
		min-inline-size: 0;
	}

	.bar-name {
		font-size: var(--text-sm);
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.bar-note {
		font-size: var(--text-2xs);
		color: var(--ink-faint);
		overflow-wrap: anywhere;
	}

	.bar-track {
		block-size: 14px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		overflow: hidden;
	}

	.bar-fill {
		display: block;
		block-size: 100%;
		background: var(--accent);
		/* Square where it meets the baseline, rounded at the data end. */
		border-start-end-radius: 4px;
		border-end-end-radius: 4px;
		transition: filter var(--dur-fast, 120ms) var(--ease-precise, ease);
	}

	.bar-row.is-active .bar-fill {
		filter: brightness(1.18);
	}

	.bar-row[data-tone='ok'] .bar-fill {
		background: var(--ok);
	}

	.bar-row[data-tone='warn'] .bar-fill {
		background: var(--warn);
	}

	.bar-row[data-tone='danger'] .bar-fill {
		background: var(--danger);
	}

	/* Values wear text tokens — the coloured bar beside them carries identity. */
	.bar-value {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		justify-content: flex-end;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--ink);
		white-space: nowrap;
	}

	.bar-tone {
		color: var(--ink-faint);
	}

	.table-view {
		margin-block-start: var(--space-4);

		& summary {
			cursor: pointer;
		}
	}

	.table-scroll {
		max-block-size: 300px;
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

	@media (max-width: 640px) {
		.bar-hit {
			grid-template-columns: minmax(0, 1fr) minmax(3.5rem, auto);
			grid-template-areas:
				'label value'
				'track track';
			row-gap: var(--space-1);
		}

		.bar-label {
			grid-area: label;
		}

		.bar-value {
			grid-area: value;
		}

		.bar-track {
			grid-area: track;
		}
	}
</style>
