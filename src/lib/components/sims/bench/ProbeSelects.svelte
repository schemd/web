<script lang="ts">
	/** Keyboard route to the probes: the same two channels the clips on the drawing set. */
	import type { ProbeNet } from './types';

	interface Props {
		nets: readonly ProbeNet[];
		a: string | null;
		b: string | null;
	}

	let { nets, a = $bindable(), b = $bindable() }: Props = $props();
</script>

<div class="probe-selects">
	<span class="microlabel">Probes</span>
	<div class="row">
		<label>
			<span class="ch ch-a" aria-hidden="true">A</span>
			<select bind:value={a} aria-label="Probe A">
				<option value={null}>off</option>
				<!-- A net already on the other channel is offered but not selectable: two
				     identical traces would only hide each other. -->
				{#each nets as net (net.id)}<option value={net.id} disabled={net.id === b}
						>{net.label}</option
					>{/each}
			</select>
		</label>
		<label>
			<span class="ch ch-b" aria-hidden="true">B</span>
			<select bind:value={b} aria-label="Probe B">
				<option value={null}>off</option>
				{#each nets as net (net.id)}<option value={net.id} disabled={net.id === a}
						>{net.label}</option
					>{/each}
			</select>
		</label>
	</div>
</div>

<style>
	.probe-selects {
		display: grid;
		gap: var(--space-2);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	select {
		min-block-size: 32px;
		padding: 4px 8px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--bg-inset);
		color: var(--ink);
		font: var(--text-sm) / 1.3 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
	}

	.ch {
		display: grid;
		place-items: center;
		inline-size: 20px;
		block-size: 20px;
		border-radius: 50%;
		border: 2px solid var(--clip);
		color: var(--clip);
		font: 600 0.625rem / 1 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
	}

	.ch-a {
		--clip: var(--accent);
	}

	.ch-b {
		--clip: var(--schematic-color-cyan);
	}
</style>
