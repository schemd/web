<script lang="ts">
	/**
	 * One industrial switchboard lever for the fault-injection panel.
	 *
	 * Throwing the lever breaks the owning simulation's math (the parent binds
	 * `active` into its fault state) and emits a distinct error tone; restoring
	 * it clears the fault with a soft confirm tick.
	 */
	import { playError, playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';

	interface Props {
		label: string;
		active: boolean;
	}

	let { label, active = $bindable() }: Props = $props();

	function toggle(): void {
		active = !active;
		if (!ui.audio) return;
		if (active) playError();
		else playTick(700);
	}
</script>

<label class="fault-switch">
	<input type="checkbox" role="switch" checked={active} onchange={toggle} />
	<span class="fault-lever" aria-hidden="true"></span>
	<span class="fault-label">{label}</span>
</label>

<style>
	.fault-switch {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);

		& input {
			position: absolute;
			opacity: 0;
		}

		& .fault-lever {
			inline-size: 26px;
			block-size: 14px;
			border: 1px solid var(--line-strong);
			background: var(--bg-inset);
			position: relative;
			flex: none;
			transition: border-color var(--dur-fast) var(--ease-precise);

			&::after {
				content: '';
				position: absolute;
				inset-block: 1px;
				inset-inline-start: 1px;
				inline-size: 10px;
				background: var(--ink-faint);
				transition:
					transform var(--dur-fast) var(--ease-precise),
					background-color var(--dur-fast) var(--ease-precise);
			}
		}

		& input:checked + .fault-lever {
			border-color: var(--danger);

			&::after {
				transform: translateX(12px);
				background: var(--danger);
			}
		}

		& input:focus-visible + .fault-lever {
			outline: 2px solid var(--accent);
			outline-offset: 2px;
		}

		& input:checked ~ .fault-label {
			color: var(--danger);
		}
	}
</style>
