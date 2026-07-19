<!-- schemd-doc: id=performance; label=Performance; title=Keep compilation predictable; summary=Use the built-in limits, cache stable output, and measure the SVG you actually ship.; category=Operate safely; order=100 -->

<!-- schemd-section: id=limits; eyebrow=01 / Limits; title=Reject oversized work early; example-title=Bounded processing chain; example-summary=A representative route inside the normal compiler budget. -->

Every schemd document is fenced in more than one sense of the word. There are hard ceilings, and the compiler enforces them before it does any real work:

| Resource       |              Limit |
| -------------- | -----------------: |
| Source text    | 131,072 characters |
| Components     |                512 |
| Connections    |              2,048 |
| Wire crossings |             32,768 |
| SVG output     |    2,097,152 bytes |

The orthogonal router carries its own bounded search, too. A route it cannot complete comes back as an _error_ — never a hang, and never a wire drawn straight through a component as though the obstacle were not there.

Compile on the server or during a build; cache the diagrams that do not change; and resist recompiling on every client keystroke unless the editor is debounced. Determinism is only a gift if you stop paying for it twice.

```schemd bounds="760x320" title="Bounded processing chain"
port:IN "Input" at (60, 160) #blue
resistor:R1 "1 k\Omega" at (240, 160) #amber
not:G1 "Condition" at (450, 160) #cyan [outputs=1]
port:OUT "Output" at (700, 160) #emerald

IN.out -> R1.in #blue [line]
R1.out -> G1.in #amber [ortho]
G1.out -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget-calculator; eyebrow=02 / Measure; title=Check a real output budget; example-title=Budget reference; example-summary=Use the controls below to measure the emitted document.; widget=budget-calculator -->

Numbers beat intuition, so measure rather than guess. The reference beside this section is compiled on the server, and the figures worth watching are source bytes, SVG bytes, level-nine gzip size, and the true count of SVG elements the document emits.

Read them as measurements of _this_ topology and mode — not as a universal benchmark. Labels, routes, markers, and interaction metadata each move the total, which is exactly why the honest answer to "how big is a schemd diagram?" is always "compile the one you mean and look."

```schemd bounds="760x300" title="Budget reference"
port:IN "Input" at (60, 150) #blue
or:G1 "Aggregate" at (380, 150) #cyan [inputs=2 outputs=1]
port:OUT "Output" at (700, 150) #emerald

IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
