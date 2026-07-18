<script lang="ts">
	interface CommandResult {
		readonly title: string;
		readonly summary: string;
		readonly category: string;
		readonly path: string;
	}

	let dialog: HTMLDialogElement;
	let input: HTMLInputElement;
	let query = $state('');
	let results = $state<readonly CommandResult[]>([]);
	let activeIndex = $state(0);
	let status = $state('Type to search documentation and platform routes.');
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let requestId = 0;
	let restoreFocus: HTMLElement | undefined;

	function openPalette(): void {
		if (dialog.open) return;
		restoreFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		dialog.showModal();
		queueMicrotask(() => input.focus());
		void search();
	}

	function closePalette(): void {
		dialog.close();
		restoreFocus?.focus();
	}

	async function search(): Promise<void> {
		const currentRequest = ++requestId;
		status = 'Searching…';
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
				headers: { accept: 'application/json' }
			});
			if (!response.ok) throw new Error(`Search returned HTTP ${response.status}.`);
			const payload: unknown = await response.json();
			if (currentRequest !== requestId || !Array.isArray(payload)) return;
			results = payload.filter(isCommandResult);
			activeIndex = 0;
			status =
				results.length === 0 ? 'No matching routes.' : `${results.length} results available.`;
		} catch {
			if (currentRequest !== requestId) return;
			results = [];
			status = 'Search is temporarily unavailable. Use the full search page.';
		}
	}

	function isCommandResult(value: unknown): value is CommandResult {
		if (typeof value !== 'object' || value === null) return false;
		return (
			'title' in value &&
			typeof value.title === 'string' &&
			'summary' in value &&
			typeof value.summary === 'string' &&
			'category' in value &&
			typeof value.category === 'string' &&
			'path' in value &&
			typeof value.path === 'string' &&
			value.path.startsWith('/')
		);
	}

	function scheduleSearch(): void {
		if (debounce !== undefined) clearTimeout(debounce);
		debounce = setTimeout(() => void search(), 120);
	}

	function navigate(index: number): void {
		const result = results[index];
		if (result) location.assign(result.path);
	}

	function handleKeys(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = results.length === 0 ? 0 : (activeIndex + 1) % results.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = results.length === 0 ? 0 : (activeIndex - 1 + results.length) % results.length;
		} else if (event.key === 'Enter' && results[activeIndex]) {
			event.preventDefault();
			navigate(activeIndex);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closePalette();
		}
	}

	$effect(() => {
		const shortcut = (event: KeyboardEvent): void => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
				event.preventDefault();
				openPalette();
			}
		};
		const customOpen = (): void => openPalette();
		window.addEventListener('keydown', shortcut);
		window.addEventListener('schemd:search', customOpen);
		return () => {
			if (debounce !== undefined) clearTimeout(debounce);
			window.removeEventListener('keydown', shortcut);
			window.removeEventListener('schemd:search', customOpen);
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="command-dialog"
	aria-labelledby="command-title"
	onclose={() => {
		query = '';
		results = [];
	}}
>
	<div class="command-frame">
		<header>
			<div>
				<p class="eyebrow">Universal index</p>
				<h2 id="command-title">Go to a Schemd surface</h2>
			</div>
			<button type="button" onclick={closePalette} aria-label="Close command palette">Esc</button>
		</header>
		<form
			action="/search"
			method="get"
			role="search"
			onsubmit={(event) => {
				if (results[activeIndex]) {
					event.preventDefault();
					navigate(activeIndex);
				}
			}}
		>
			<label class="visually-hidden" for="command-query">Search documentation and routes</label>
			<input
				bind:this={input}
				bind:value={query}
				id="command-query"
				name="q"
				type="search"
				maxlength="80"
				placeholder="Search grammar, components, tools…"
				autocomplete="off"
				oninput={scheduleSearch}
				onkeydown={handleKeys}
				aria-controls="command-results"
				aria-activedescendant={results[activeIndex] ? `command-result-${activeIndex}` : undefined}
			/>
		</form>
		<ul id="command-results" role="listbox" aria-label="Command results">
			{#each results as result, index (result.path)}
				<li id={`command-result-${index}`} role="option" aria-selected={index === activeIndex}>
					<a href={result.path} onpointermove={() => (activeIndex = index)}>
						<span>{result.category}</span><strong>{result.title}</strong><small
							>{result.summary}</small
						>
					</a>
				</li>
			{/each}
		</ul>
		<footer>
			<span aria-live="polite">{status}</span><a href={`/search?q=${encodeURIComponent(query)}`}
				>Full search</a
			>
		</footer>
	</div>
</dialog>

<style>
	.command-dialog {
		inline-size: min(44rem, calc(100% - 2rem));
		max-block-size: min(42rem, calc(100dvh - 2rem));
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		background: var(--ink-1);
		padding: 0;
		color: var(--paper);
		box-shadow: 0 1.5rem 5rem rgb(0 0 0 / 0.55);
	}
	.command-dialog::backdrop {
		background: rgb(2 5 4 / 0.78);
		backdrop-filter: blur(3px);
	}
	.command-frame {
		display: grid;
		grid-template-rows: auto auto minmax(4rem, 1fr) auto;
		max-block-size: inherit;
	}
	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
	}
	header {
		border-block-end: 1px solid var(--line);
	}
	header h2 {
		margin-block-start: 0.2rem;
		font-size: var(--step-1);
	}
	header button {
		min-block-size: 2.4rem;
		padding-inline: 0.75rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	form {
		padding: 0.75rem;
	}
	input {
		inline-size: 100%;
		min-block-size: 3.4rem;
		border-color: var(--signal);
		padding-inline: 1rem;
	}
	ul {
		overflow: auto;
		margin: 0;
		padding: 0 0.75rem 0.75rem;
		list-style: none;
	}
	li + li {
		margin-block-start: 0.3rem;
	}
	li a {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: 0.1rem 1rem;
		border: 1px solid transparent;
		padding: 0.75rem;
		text-decoration: none;
	}
	li[aria-selected='true'] a {
		border-color: var(--signal);
		background: rgb(114 219 187 / 0.07);
	}
	li span {
		grid-row: 1 / 3;
		color: var(--signal);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	li strong {
		line-height: 1.3;
	}
	li small {
		color: var(--muted);
		line-height: 1.45;
	}
	footer {
		border-block-start: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.72rem;
	}
	footer a {
		color: var(--signal);
	}
	@media (max-width: 34rem) {
		li a {
			grid-template-columns: 1fr;
		}
		li span {
			grid-row: auto;
		}
	}
</style>
