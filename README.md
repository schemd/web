# schemd web

The SvelteKit 5 documentation, IDE, and simulation laboratory for
[`@schemd/core`](https://github.com/schemd/core). Schemd is pronounced _“skemd”_
(`/skɛmd/`).

The site serves three independent documentation lines, a dependency-free browser IDE, release and
coverage reports, and thirteen instrumented laboratories spanning digital, analog, quantum, power,
nonlinear, and control systems.

## Run it

Requirements: Node.js 24 or newer and Bun.

```sh
bun install --frozen-lockfile
bun run dev
```

The production target is a long-running adapter-node process:

```sh
bun run build
HOST=0.0.0.0 PORT=3000 bun run start
```

Only trust proxy headers that your reverse proxy overwrites. Adapter-node supports `ORIGIN`,
`PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH`, `BODY_SIZE_LIMIT`, and
`SHUTDOWN_TIMEOUT`.

## Architecture

- Svelte 5 runes, strict TypeScript, native CSS, and `@sveltejs/adapter-node`
- `@schemd/core` 0.4 with current, `0.3`, and immutable `0.2` documentation corpora
- a native-textarea IDE with syntax paint, completion, diagnostics, find/replace, keyboard editing,
  command palette, shareable URLs, and crash-safe local drafts—no editor framework
- thirteen route-split simulation models; server-rendered KaTeX supplies both visual HTML and
  accessible MathML
- explicit reduced-motion policy and pause controls for every continuously animated laboratory
- bounded, isolated server compilation with host-supplied compiler limits, a wall-clock worker
  deadline, a finite queue, rate limiting, and a byte-bounded LRU
- registry and documentation caches with finite keys, stale fallback, single-flight refresh, and
  abort deadlines

The browser loads the compiler only on playground and review routes. Every other route keeps it out
of the eager client graph.

## Verify it

```sh
bun run format:check
bun run lint
bun run check
bun run test:unit
bun run test:e2e
bun run test:a11y
bun run test:budget
# or run the complete sequence:
bun run release:check
```

`release:check` starts with a frozen install. It rejects a dependency manifest and lockfile that
disagree instead of silently validating whichever local link happens to be present.

The suites compile every fence in every documentation line, validate all simulation sources and
reference models, exercise editor operations and persistence as pure functions, enforce curriculum
contracts, run the production Node bundle in Chromium, scan public routes with axe, assert accessible
MathML and reduced-motion behavior, check mobile containment, and gate eager/lazy JavaScript, fonts,
simulation chunks, and total client output.

## Content and routes

Documentation lives under `src/lib/content/schemd/{0.2,0.3,0.4}/`; never backfill newer syntax into a
historical line. Adding a documented line means adding a folder—the manifest, search index, version
selector, sitemap, and fence compiler discover it.

- `/docs/0.4/[slug]` — current documentation
- `/playground/0.4.0` — dependency-free source/vector IDE
- `/embed/0.4.0` — standalone compiled SVG
- `/simulations/0.4.0` and `/simulations/0.4.0/[environment]` — curriculum and laboratories
- `/examples`, `/coverage`, and `/changelog` — compiled corpus, vocabulary coverage, and releases
- `/api/compile` — bounded compilation fallback
- `/sitemap.xml` — generated route inventory

Do not derive the engine version from editorial release notes. Server routes read the installed
`@schemd/core` package manifest; documentation versions are discovered separately from content
folders.
