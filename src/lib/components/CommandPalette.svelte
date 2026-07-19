<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';

	export interface CommandItem {
		readonly title: string;
		readonly detail: string;
		readonly href: string;
		readonly group: string;
	}

	let {
		open = $bindable(false),
		items
	}: {
		open: boolean;
		items: readonly CommandItem[];
	} = $props();

	let dialog: HTMLDialogElement;
	let input: HTMLInputElement;
	let query = $state('');
	let activeIndex = $state(0);
	let remoteItems = $state<readonly CommandItem[]>([]);
	let searching = $state(false);
	let searchController: AbortController | undefined;

	const filtered = $derived(
		query.trim().length >= 2
			? remoteItems.slice(0, 12)
			: items
					.filter((item) =>
						`${item.title} ${item.detail} ${item.group}`.toLowerCase().includes(query.toLowerCase())
					)
					.slice(0, 12)
	);

	function isSearchResult(value: unknown): value is {
		readonly title: string;
		readonly summary: string;
		readonly category: string;
		readonly path: string;
	} {
		if (typeof value !== 'object' || value === null) return false;
		return (
			'title' in value &&
			typeof value.title === 'string' &&
			'summary' in value &&
			typeof value.summary === 'string' &&
			'category' in value &&
			typeof value.category === 'string' &&
			'path' in value &&
			typeof value.path === 'string'
		);
	}

	function close(): void {
		open = false;
		query = '';
		activeIndex = 0;
	}

	async function activate(item: CommandItem | undefined): Promise<void> {
		if (!item) return;
		close();
		await goto(item.href);
	}

	function keydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			void activate(filtered[activeIndex]);
		}
	}

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
			void tick().then(() => input?.focus());
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	$effect(() => {
		const currentIndex = activeIndex;
		document.getElementById(`command-option-${currentIndex}`)?.scrollIntoView({ block: 'nearest' });
	});

	$effect(() => {
		const value = query.trim();
		if (!open || value.length < 2) {
			remoteItems = [];
			searching = false;
			return;
		}
		searchController?.abort();
		searchController = new AbortController();
		searching = true;
		const timer = setTimeout(() => {
			void fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: searchController?.signal })
				.then((response) => response.json())
				.then((payload: unknown) => {
					if (!Array.isArray(payload)) return;
					remoteItems = payload.filter(isSearchResult).map((result) => ({
						title: result.title,
						detail: result.summary,
						group: result.category.toUpperCase(),
						href: result.path
					}));
					activeIndex = 0;
				})
				.catch((reason: unknown) => {
					if (!(reason instanceof DOMException && reason.name === 'AbortError')) remoteItems = [];
				})
				.finally(() => {
					searching = false;
				});
		}, 80);
		return () => {
			clearTimeout(timer);
			searchController?.abort();
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="command-dialog"
	aria-labelledby="command-title"
	onclose={close}
	oncancel={close}
>
	<header>
		<p class="eyebrow" id="command-title">Universal command index</p>
		<button type="button" onclick={close} aria-label="Close command palette">ESC</button>
	</header>
	<div class="command-input">
		<span aria-hidden="true">⌕</span>
		<input
			bind:this={input}
			bind:value={query}
			onkeydown={keydown}
			role="combobox"
			aria-expanded="true"
			aria-controls="command-results"
			aria-activedescendant={filtered.length ? `command-option-${activeIndex}` : undefined}
			autocomplete="off"
			placeholder="Search documentation, labs, and routes"
		/>
	</div>
	<ul id="command-results" role="listbox" aria-label="Commands">
		{#if searching}<li class="command-searching" aria-live="polite">
				Indexing documentation…
			</li>{/if}
		{#each filtered as item, index (item.href)}
			<li
				id={`command-option-${index}`}
				role="option"
				aria-selected={index === activeIndex}
				class:active={index === activeIndex}
			>
				<button
					type="button"
					onmouseenter={() => (activeIndex = index)}
					onclick={() => activate(item)}
				>
					<span><strong>{item.title}</strong><small>{item.detail}</small></span>
					<em>{item.group}</em>
				</button>
			</li>
		{:else}
			<li class="command-empty">No command matches “{query}”.</li>
		{/each}
	</ul>
</dialog>
