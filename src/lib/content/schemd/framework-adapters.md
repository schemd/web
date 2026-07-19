<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Mount compiled SVG in any framework; summary=Compile once on the server, then hand the trusted SVG string to React, Vue, Angular, or Svelte.; category=Connect toolchains; order=80 -->

<!-- schemd-section: id=framework-contract; eyebrow=01 / Host; title=Keep compilation outside the component; example-title=Framework-neutral signal chain; example-summary=One compiled SVG can be mounted by every major UI framework. -->

Compile before the component renders. The component only receives the resulting SVG string.

| Framework | Trusted HTML boundary                       |
| --------- | ------------------------------------------- |
| React     | `dangerouslySetInnerHTML={{ __html: svg }}` |
| Vue       | `v-html="svg"`                              |
| Angular   | A reviewed `SafeHtml` value                 |
| Svelte    | `{@html svg}`                               |

Only pass output produced by Schemd through that boundary. Do not use it for arbitrary user-supplied HTML.

If the page is interactive, attach one delegated listener to the host. Clean it up when the component unmounts. The SVG itself stays framework-agnostic.

```schemd bounds="720x300" title="Framework-neutral signal chain"
port:IN "Input" at (60, 150) #blue
and:G1 "Enable" at (360, 150) #cyan [inputs=2 outputs=1]
port:OUT "Output" at (660, 150) #emerald

IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
