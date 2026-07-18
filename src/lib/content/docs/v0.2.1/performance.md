<!-- schemd-doc: id=performance; label=Limits + performance; title=Keep compilation bounded and predictable; summary=Reject oversized work early, cache stable documents, and measure the compiler separately from its package archive.; category=Operate safely; order=60 -->

<!-- schemd-section: id=hard-limits; eyebrow=01 / Limits; title=Enforce hard allocation ceilings -->

Every compilation is bounded. These are exported from `@schemd/core` and enforced by the parser or renderer.

| Resource       | Limit              |
| -------------- | ------------------ |
| Source text    | 131,072 characters |
| Components     | 512                |
| Connections    | 2,048              |
| Wire crossings | 32,768             |
| SVG output     | 2,097,152 bytes    |

The orthogonal router also has a bounded search. A blocked route reports an error instead of hanging or drawing through a component.

<!-- /schemd-section -->

<!-- schemd-section: id=measure; eyebrow=02 / Measure; title=Compare the right payloads -->

The v0.2.1 compiler entry measures **18,081 bytes gzip** after minification. The generated npm tarball measures **42,878 bytes**. The first is a browser or application bundle concern; the second is a registry transfer archive. They are not interchangeable.

```sh
bun run size
bun pm pack --dry-run
```

Measurements on the landing page are generated from core commit `29c7769` and stored once. The website budget check verifies that the compiler stays below 20 KiB gzip and that compiler code does not enter content-route browser chunks.

<!-- /schemd-section -->

<!-- schemd-section: id=operating-guidance; eyebrow=03 / Operate; title=Compile stable work once -->

- Compile article and documentation diagrams during a build or on the server.
- Cache output for source that does not change.
- Debounce editor work and reject stale worker results.
- Keep source and output sizes visible in authoring tools.
- Use `default` mode until interaction metadata is needed.

The [playground](/playground/v0.2.1) follows the interactive path. Documentation follows the server path and ships no compiler JavaScript.

<!-- /schemd-section -->
