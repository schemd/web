<script lang="ts">
	/**
	 * Persistent floating diagnostic probe HUD.
	 *
	 * A universal multimeter pinned to the lower edge of the viewport. When
	 * armed, the cursor becomes a probe tip: clicking any element that carries
	 * the compiler's `data-port-id` / `data-wire-source` / `data-node-id`
	 * attributes asks the active simulation for a reading and pins it inside a
	 * cursor-tracking tooltip.
	 */
	import { playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';

	interface Props {
		/** Resolve a probe reading for a delegated target, or undefined. */
		read: (element: Element) => string | undefined;
	}

	let { read }: Props = $props();

	let armed = $state(false);
	let reading = $state<string | undefined>();
	let x = $state(0);
	let y = $state(0);

	function onPointerMove(event: PointerEvent): void {
		if (!armed) return;
		x = event.clientX;
		y = event.clientY;
	}

	function onClick(event: MouseEvent): void {
		if (!armed || !(event.target instanceof Element)) return;
		const target = event.target.closest('[data-port-id], [data-wire-source], [data-node-id]');
		if (!target) {
			reading = undefined;
			return;
		}
		reading = read(target);
		if (reading !== undefined && ui.audio) playTick(740);
	}
</script>

<svelte:window onpointermove={onPointerMove} onclick={onClick} />

<div class="probe-hud" class:armed>
	<span class="microlabel">diagnostic probe</span>
	<button
		type="button"
		role="switch"
		aria-checked={armed}
		onclick={(event) => {
			event.stopPropagation();
			armed = !armed;
			reading = undefined;
			if (ui.audio) playTick(armed ? 660 : 440);
		}}
	>
		{armed ? '● armed — click a node, port, or wire' : '○ arm probe'}
	</button>
	{#if reading !== undefined}
		<output class="probe-inline">{reading}</output>
	{/if}
</div>

{#if armed && reading !== undefined}
	<output class="probe-tip" style={`transform: translate(${x + 14}px, ${y - 40}px)`}>
		{reading}
	</output>
{/if}

<style>
	.probe-hud {
		position: fixed;
		inset-block-end: 0;
		inset-inline: 0;
		z-index: 70;
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
		backdrop-filter: blur(6px);
		border-block-start: 1px solid var(--line-strong);
		font-family: var(--font-mono);
		font-size: var(--text-xs);

		& button {
			color: var(--ink-mute);
			letter-spacing: 0.04em;

			&[aria-checked='true'] {
				color: var(--accent);
			}
		}

		&.armed {
			border-block-start-color: var(--accent);
		}
	}

	.probe-inline {
		color: var(--accent);
		margin-inline-start: auto;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.probe-tip {
		position: fixed;
		inset-block-start: 0;
		inset-inline-start: 0;
		z-index: 80;
		pointer-events: none;
		padding: 0.3rem 0.6rem;
		background: var(--bg-panel);
		border: 1px solid var(--accent);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent);
		white-space: nowrap;
		will-change: transform;
	}

	:global(body:has(.probe-hud.armed)) {
		cursor: crosshair;
	}
</style>
