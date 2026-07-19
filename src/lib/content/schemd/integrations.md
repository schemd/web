<!-- schemd-doc: id=integrations; label=Interaction; title=Add interaction without changing the SVG compiler; summary=Use full-mode data attributes and one event listener on the host.; category=Ship output; order=70 -->

<!-- schemd-section: id=event-delegation; eyebrow=01 / Events; title=Listen once at the SVG host; example-title=Interactive parity network; example-summary=Full mode exposes stable node, port, and connection metadata. -->

`full` mode adds stable attributes such as `data-node-id`, `data-node-kind`, `data-port-id`, `data-wire-source`, and `data-wire-target`.

Use event delegation instead of adding a handler to every SVG element:

```ts
const host = document.querySelector('[data-schemd-host]');

function handleClick(event: Event) {
	const element = event.target instanceof Element ? event.target : null;
	const node = element?.closest<SVGGElement>('[data-node-id]');
	if (node) node.classList.toggle('is-selected');
}

host?.addEventListener('click', handleClick);
// Later: host?.removeEventListener('click', handleClick);
```

Keep application state outside the SVG. Recompiling the same source remains deterministic.

```schemd bounds="760x320" title="Interactive parity network"
port:A "A" at (60, 90) #blue
port:B "B" at (60, 230) #blue
xor:G1 "Parity" at (380, 160) #cyan [inputs=2 outputs=1]
port:Y "Y" at (700, 160) #emerald

A.out -> G1.in1 #blue [bezier]
B.out -> G1.in2 #blue [bezier]
G1.out -> Y.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
