<!-- schemd-doc: id=integrations; label=Integrations; title=Connect Schemd to an existing toolchain; summary=Compile at a trusted boundary, then hand the resulting SVG to Markdown pipelines or UI frameworks.; category=Connect toolchains; order=50 -->

<!-- schemd-section: id=markdown; eyebrow=01 / Markdown; title=Handle only Schemd fences -->

Core does not ship a Markdown parser. A host adapter recognizes the language, parses the fence information, and compiles its body.

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

export function renderSchemdFence(body: string, info: string) {
	const fence = parseSchematicFence(info);
	return fence ? compileSchematic(body, fence).svg : undefined;
}
```

Send every other fence back to the host parser. Emit only compiler-produced SVG through a trusted HTML boundary.

<!-- /schemd-section -->

<!-- schemd-section: id=frameworks; eyebrow=02 / Frameworks; title=Compile before the component renders -->

The UI component receives a finished SVG string. It should not own parsing, routing, or layout.

| Framework | Reviewed output boundary                    |
| --------- | ------------------------------------------- |
| React     | `dangerouslySetInnerHTML={{ __html: svg }}` |
| Vue       | `v-html="svg"`                              |
| Angular   | A reviewed `SafeHtml` value                 |
| Svelte    | `{@html svg}`                               |

Only pass output produced by Schemd through that boundary. Do not reuse it for arbitrary HTML. For untrusted author input, compile in an isolated worker and present the result in a sandboxed frame, as the playground does.

<!-- /schemd-section -->

<!-- schemd-section: id=interaction; eyebrow=03 / Events; title=Keep application state outside the SVG -->

`full` mode can add stable attributes including `data-node-id`, `data-node-kind`, `data-port-id`, `data-wire-source`, and `data-wire-target`.

```ts
const host = document.querySelector('[data-schemd-host]');

function handleClick(event: Event) {
	const element = event.target instanceof Element ? event.target : null;
	const node = element?.closest('[data-node-id]');
	if (node) node.classList.toggle('is-selected');
}

host?.addEventListener('click', handleClick);
```

Use one delegated listener and clean it up when the host unmounts. Recompiling the same source remains deterministic.

<!-- /schemd-section -->
