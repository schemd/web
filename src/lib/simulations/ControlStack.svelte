<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="controls">
	{@render children()}
</div>

<style>
	.controls {
		display: grid;
		gap: 19px;
	}

	.controls :global(.control-field) {
		display: grid;
		gap: 10px;
	}

	.controls :global(.control-label) {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 14px;
	}

	.controls :global(.control-label > span:first-child) {
		color: var(--muted);
		font:
			700 9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.controls :global(.control-value) {
		color: var(--text);
		font:
			700 12px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
	}

	.controls :global(input[type='range']) {
		width: 100%;
		height: 18px;
		margin: 0;
		accent-color: var(--signal);
		cursor: ew-resize;
	}

	.controls :global(.range-scale) {
		margin-top: -6px;
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font:
			8px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
	}

	.controls :global(.button-row),
	.controls :global(.segmented) {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}

	.controls :global(button) {
		min-height: 34px;
		padding: 7px 10px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--surface);
		color: var(--muted);
		font:
			700 9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.035em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.controls :global(button:hover),
	.controls :global(button.active) {
		border-color: var(--line-strong);
		background: var(--panel-raised);
		color: var(--text);
	}

	.controls :global(button.primary) {
		border-color: rgba(var(--signal-rgb), 0.45);
		background: rgba(var(--signal-rgb), 0.1);
		color: var(--signal);
	}

	.controls :global(button:focus-visible),
	.controls :global(input:focus-visible) {
		outline: 2px solid var(--signal);
		outline-offset: 3px;
	}

	.controls :global(.binary-readout) {
		padding: 10px 11px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--surface);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.controls :global(.binary-readout span) {
		color: var(--muted);
		font-size: 9px;
		letter-spacing: 0.06em;
	}

	.controls :global(.binary-readout strong) {
		color: var(--signal);
		font-size: 12px;
		letter-spacing: 0.08em;
	}

	.controls :global(.stage-grid) {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 3px;
	}

	.controls :global(.stage-grid > span) {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--surface);
		color: var(--muted);
		font:
			700 8px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
	}

	.controls :global(.stage-grid > span.active) {
		border-color: rgba(var(--signal-rgb), 0.45);
		background: rgba(var(--signal-rgb), 0.1);
		color: var(--signal);
	}

	.controls :global(.probability-list) {
		display: grid;
		gap: 7px;
	}

	.controls :global(.probability-row) {
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr) 38px;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font:
			9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
	}

	.controls :global(.probability-track) {
		height: 5px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}

	.controls :global(.probability-fill) {
		height: 100%;
		border-radius: inherit;
		background: var(--signal);
		box-shadow: 0 0 9px rgba(var(--signal-rgb), 0.45);
	}

	.controls :global(.timeline) {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 4px;
	}

	.controls :global(.timeline span) {
		height: 4px;
		border-radius: 999px;
		background: var(--line);
	}

	.controls :global(.timeline span.active) {
		background: var(--signal);
		box-shadow: 0 0 8px rgba(var(--signal-rgb), 0.55);
	}

	.controls :global(.notice) {
		margin: 0;
		padding: 10px 11px;
		border-left: 2px solid var(--amber);
		background: color-mix(in srgb, var(--amber) 7%, transparent);
		color: var(--muted);
		font-size: 10px;
		line-height: 1.5;
	}

	@media (prefers-reduced-motion: reduce) {
		.controls :global(button) {
			transition: none;
		}
	}
</style>
