# schemd web

The standalone SvelteKit 5 platform for
[`@schemd/core`](https://github.com/schemd/core): versioned documentation, a zero-runtime-dependency
playground, eight instrumented simulation laboratories, registry-backed release history, and native
SVG benchmark charts.

Schemd is pronounced like _“skemd”_ (`/skɛmd/`).

## Runtime

- SvelteKit with Svelte 5 runes
- `@sveltejs/adapter-node` on Node.js 24 or newer
- strict TypeScript
- pure nested vanilla CSS
- exact `@schemd/core` compiler pin (0.2.1 until 0.3.0 is published; the validated release tarball is installed locally during release verification)
- no browser editor, chart, simulation, audio, or state-serialization dependencies

```sh
bun run ci
bun run dev
```

The production process is a long-running Node server:

```sh
bun run build
HOST=0.0.0.0 PORT=3000 bun run start
```

Behind a trusted reverse proxy, adapter-node also supports `ORIGIN`, `PROTOCOL_HEADER`,
`HOST_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH`, `BODY_SIZE_LIMIT`, and `SHUTDOWN_TIMEOUT`. Configure
only headers overwritten by that proxy.

## Verification

```sh
bun run format:check
bun run lint
bun run check
bun run test:unit
bun run test:e2e
```

The unit suite compiles every current and historical documentation fence, validates the registry,
URI codec, hero programs, and all eight full-mode simulation sources. Playwright exercises the
production adapter-node bundle, current/historical switching, invalid routes, source/vector mapping,
raw SVG parity, URI persistence, mobile documentation, command-palette focus containment, zero-CLS
landing structure, simulation reactivity, sitemap inventory, and automated axe WCAG A/AA checks.

## Server boundaries

`src/lib/server/registry.ts` maintains a bounded, single-flight registry snapshot. A deterministic
0.3.0 release-candidate record and the last stable historical release are always available; npm and
GitHub refresh the process cache with abort deadlines and a stale fallback. Publish dates and git
hashes remain explicitly pending until the real release exists.

Public compilation runs through `src/routes/api/compile/+server.ts`. It validates source, dimensions,
title, and mode before compilation, hashes cache keys with native SHA-256, and enforces both entry and
byte ceilings on its process-local LRU cache. The compiler itself enforces bounded declarations,
geometry, crossings, and SVG output.

Documentation prose and metadata live in `src/lib/content/schemd/`. The immutable 0.2.1 corpus is
kept separate from `0.3.0/`; `src/lib/server/docs.ts` and `markdown.ts` parse, compile, and cache them
on the server. Schematic fences compile during SSR, and every fence is compiled again in tests.

## Routes

- `/` — SSR product surface and compiler proof
- `/docs/0.3.0/[slug]` and `/docs/0.2.1/[slug]` — versioned 3-column documentation
- `/playground/0.3.0` — resizable source/render workspace with shareable `?code=` state
- `/embed/0.3.0` — standalone SVG response for shared workspace source
- `/simulations/0.3.0/[adder|rc|bell|timer|teleport]` — isolated engineering laboratories
- `/changelog` — registry timeline and native SVG metrics
- `/api/compile` — bounded compilation endpoint
- `/sitemap.xml` — automated route inventory
