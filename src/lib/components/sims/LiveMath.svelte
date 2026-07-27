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
	let slotLeaves: Array<
		readonly [
			name: string,
			visual: HTMLElement,
			accessible: Element | undefined,
			monospace: boolean
		]
	> = [];
	const accessibleLabel = $derived.by(() => {
		const normalizedLabel = label.toLocaleLowerCase();
		const omitted = Object.entries(values).filter(([, value]) => {
			const rendered = String(value).trim();
			return rendered !== '' && !normalizedLabel.includes(rendered.toLocaleLowerCase());
		});
		if (omitted.length === 0) return label;
		return `${label}; live values ${omitted
			.map(([name, value]) => `${name.replace(/[_-]+/g, ' ')} ${String(value)}`)
			.join(', ')}`;
	});

	/**
	 * Bind each trusted HTML-data slot to the corresponding MathML placeholder.
	 *
	 * KaTeX deliberately applies `\htmlData` only to its visual tree. Matching
	 * the static placeholder once lets high-frequency updates patch two text
	 * leaves without shipping KaTeX or rebuilding either tree in the browser.
	 */
	$effect(() => {
		const root = host;
		const slots = values;
		const markup = html;
		if (!root) return;
		if (cachedHost !== root || cachedHtml !== markup) {
			cachedHost = root;
			cachedHtml = markup;
			slotLeaves = [];
			const usedMathLeaves: Element[] = [];
			const mathCandidates = [
				...root.querySelectorAll(
					'.katex-mathml mi, .katex-mathml mn, .katex-mathml mtext, .katex-mathml mrow'
				)
			];
			for (const element of root.querySelectorAll<HTMLElement>('[data-math-slot]')) {
				const name = element.dataset.mathSlot;
				if (name !== undefined) {
					const placeholder = element.textContent ?? '';
					const accessible = mathCandidates
						.filter(
							(candidate) =>
								!usedMathLeaves.includes(candidate) && candidate.textContent === placeholder
						)
						.sort((left, right) => left.childElementCount - right.childElementCount)[0];
					if (accessible) {
						accessible.setAttribute('data-math-slot', name);
						usedMathLeaves.push(accessible);
					}
					slotLeaves.push([name, element, accessible, element.querySelector('.mathtt') !== null]);
				}
			}
		}
		for (const [name, visual, accessible, monospace] of slotLeaves) {
			if (!(name in slots)) continue;
			const value = String(slots[name]);
			if (visual.textContent !== value) {
				if (monospace) {
					const leaf = document.createElement('span');
					leaf.className = 'mord mathtt';
					leaf.textContent = value;
					visual.replaceChildren(leaf);
				} else {
					visual.textContent = value;
				}
			}
			if (accessible && accessible.textContent !== value) accessible.textContent = value;
		}
	});
</script>

<span
	bind:this={host}
	class={['live-math', className]}
	role="math"
	aria-label={accessibleLabel}
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

	.live-math :global([data-math-slot]) {
		font-family: var(--font-mono);
	}

	.math-fallback {
		font-family: var(--font-mono);
		color: var(--danger);
	}
</style>
