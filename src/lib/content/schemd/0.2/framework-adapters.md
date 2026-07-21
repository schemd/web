<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Mount compiled SVG in any framework; summary=Compile once on the server, then hand the trusted SVG string to React, Vue, Angular, or Svelte.; category=Connect toolchains; order=80 -->

<!-- schemd-section: id=framework-contract; eyebrow=01 / Host; title=Keep compilation outside the component; example-title=Framework-neutral signal chain; example-summary=One compiled SVG can be mounted by every major UI framework. -->

The contract is one sentence: compile before the component renders, and hand the component only the finished SVG string. Every framework already has a boundary for trusted HTML — find yours in the table and pass schemd's output through it.

| Framework | Trusted HTML boundary                       |
| --------- | ------------------------------------------- |
| React     | `dangerouslySetInnerHTML={{ __html: svg }}` |
| Vue       | `v-html="svg"`                              |
| Angular   | A reviewed `SafeHtml` value                 |
| Svelte    | `{@html svg}`                               |

That boundary is for schemd output and nothing else — never route arbitrary, user-supplied HTML through the same door. If the page is interactive, attach a single delegated listener to the host and clean it up on unmount; the SVG itself stays entirely framework-agnostic, which is rather the point.

```schemd bounds="720x300" title="Framework-neutral signal chain"
port:IN "Input" at (60, 150) #blue
and:G1 "Enable" at (360, 150) #cyan [inputs=2 outputs=1]
port:OUT "Output" at (660, 150) #emerald

IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
