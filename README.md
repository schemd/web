# schemd web

The Svelte 5 and SvelteKit 3 documentation site, IDE, and simulation laboratory for
[`@schemd/core`](https://github.com/schemd/core). Schemd is pronounced _“skemd”_
(`/skɛmd/`).

The site serves eleven documentation lines, a native-textarea browser IDE, release and coverage
reports, and eighteen instrumented laboratories covering digital, analog, quantum, power and
control systems. English and Spanish interfaces share the same routes; Spanish URLs begin with `/es`.

## Run it

Requirements: Node.js 24 or newer and Bun.

```sh
bun install --frozen-lockfile
bun run dev
```

The production target is a long-running adapter-bun process:

```sh
bun run build
HOST=0.0.0.0 PORT=3000 bun run start
```

The Bun adapter assumes HTTPS behind a proxy. Set `SCHEMD_ORIGIN` when building for a known
public origin. For a local production preview with working form submissions:

```sh
SCHEMD_ORIGIN=http://127.0.0.1:4173 bun run build
bun run start:test
```

Playwright applies that local build origin automatically. Only trust proxy headers that your
reverse proxy overwrites; the adapter also supports `PROTOCOL_HEADER`, `HOST_HEADER`,
`ADDRESS_HEADER`, `XFF_DEPTH`, `BODY_SIZE_LIMIT` and `SHUTDOWN_TIMEOUT`.

## Architecture

- Svelte 5 runes, strict TypeScript, native CSS, and `@sveltejs/adapter-bun`
- `@schemd/core` 1.3, with independently versioned documentation from 0.2 through 1.3
- a native-textarea IDE with syntax paint, completion, diagnostics, find/replace, keyboard editing,
  command palette, shareable URLs, and crash-safe local drafts—no editor framework
- eighteen route-split simulation models; server-rendered KaTeX supplies both visual HTML and
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
contracts, run the production Bun bundle in Chromium, scan public routes with axe, assert accessible
MathML and reduced-motion behavior, check mobile containment, and gate eager/lazy JavaScript, fonts,
simulation chunks, and total client output.

## Content and routes

Documentation lives under `src/lib/content/schemd/<major.minor>/`; never backfill newer syntax into a
historical line. Adding a documented line means adding a folder; the manifest, search index, version
selector, sitemap, and fence compiler discover it.

- `/docs/1.3/[slug]` — current documentation
- `/playground/1.3.0` — dependency-free source/vector IDE
- `/embed/1.3.0` — standalone compiled SVG
- `/simulations/1.3.0` and `/simulations/1.3.0/[environment]` — curriculum and laboratories
- `/examples`, `/coverage`, and `/changelog` — compiled corpus, vocabulary coverage, and releases
- `/api/compile` — bounded compilation fallback
- `/sitemap.xml` — generated route inventory

Do not derive the engine version from editorial release notes. Server routes read the installed
`@schemd/core` package manifest; documentation versions are discovered separately from content
folders.

## Interface languages

`src/lib/server/messages.es.json` maps English source messages to formal Spanish. Components use
`useLanguage()` for messages and links; the root layout provides a separate context per request.
`/locale` stores an explicit language choice in a cookie and preserves the current query and hash.

The build collects English messages with `scripts/collect-messages.ts`, checks compact-key collisions,
and replaces static message literals with compact references. Catalogs remain server data and are
selected by language and site section. After changing interface copy, add its Spanish translation and
run `bun scripts/collect-messages.ts`. Mathematical notation and compiler source are preserved.

Spanish documentation lives in `src/lib/content/schemd/es/{1.2,1.3}/`. Older lines retain their English
content with a Spanish notice. `test:docs` compiles both languages and rejects mismatched file sets,
metadata IDs/order, section IDs or code fences. Language links, metadata and sitemap alternates refer
to the same translated pages.

`/templates` contains eight compiler-verified starting points. Each opens the playground with source,
canvas bounds, title and output mode encoded in its URL. The component index and every datasheet
are also included in the bilingual sitemap.
