<script lang="ts">
	import { getContext } from 'svelte';
	import {
		SIMULATION_MATH_CONTEXT,
		type MathSlotValues,
		type SimulationMathContext
	} from '$lib/simulation-math';

	interface Props {
		id: string;
		label: string;
		values?: MathSlotValues;
		class?: string;
	}

	let { id, label, values = {}, class: className }: Props = $props();
	const registry = getContext<SimulationMathContext>(SIMULATION_MATH_CONTEXT);
	const html = $derived(registry?.()[id]);
	let host = $state<HTMLElement>();
	let cachedHost: HTMLElement | undefined;
	let cachedHtml: string | undefined;
	let slotLeaves: Array<readonly [string, HTMLElement]> = [];

	/* KaTeX owns the immutable structure; animation updates only slot text. */
	$effect(() => {
		const root = host;
		const slots = values;
		const markup = html;
		if (!root) return;
		if (cachedHost !== root || cachedHtml !== markup) {
			cachedHost = root;
			cachedHtml = markup;
			slotLeaves = [];
			for (const element of root.querySelectorAll<HTMLElement>('[data-math-slot]')) {
				const name = element.dataset.mathSlot;
				if (name !== undefined) {
					const candidates = element.querySelectorAll<HTMLElement>('.mord');
					slotLeaves.push([name, candidates[candidates.length - 1] ?? element]);
				}
			}
		}
		for (const [name, leaf] of slotLeaves) {
			if (!(name in slots)) continue;
			const value = String(slots[name]);
			if (leaf.textContent !== value) leaf.textContent = value;
		}
	});
</script>

<span
	bind:this={host}
	class={['live-math', className]}
	role="math"
	aria-label={label}
	data-math-id={id}
	data-math-missing={html === undefined ? id : undefined}
>
	{#if html !== undefined}
		{@html html}
	{:else}
		<span class="math-fallback">{label}</span>
	{/if}
</span>

<style>
	.live-math {
		display: inline-block;
		max-inline-size: 100%;
		font-variant-numeric: tabular-nums;
	}

	.live-math :global(.katex) {
		font-size: 1em;
	}

	.math-fallback {
		font-family: var(--font-mono);
		color: var(--danger);
	}
</style>
