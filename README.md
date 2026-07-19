# schemd web

The standalone SvelteKit 5 platform for
[`@schemd/core`](https://github.com/schemd/core): versioned documentation, a zero-runtime-dependency
playground, five instrumented simulation laboratories, registry-backed release history, and native
SVG benchmark charts.

Schemd is pronounced like _“skemd”_ (`/skɛmd/`).

## Runtime

- SvelteKit with Svelte 5 runes
- `@sveltejs/adapter-node` on Node.js 24 or newer
- strict TypeScript
- pure nested vanilla CSS
- exact `@schemd/core@0.2.1` compiler pin
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

The unit suite covers documentation parsing, registry caching, compiler isolation, SVG semantics,
and simulation math. Playwright exercises the production adapter-node bundle, mobile documentation,
the editor/caret/URI pipeline, command-palette focus restoration, simulation diagnostics, route
semantics, horizontal overflow, and automated axe checks.

## Server boundaries

`src/lib/server/release-registry.ts` maintains one bounded, single-flight registry snapshot. The
bundled release archive is always immediately available; npm and GitHub refresh it with timeouts,
response limits, a 15-minute fresh window, and a 24-hour stale fallback.

Public compilation runs through `src/lib/server/compiler-pool.ts`: two unrefed worker threads, an
eight-request queue, a two-second routing budget, and worker replacement after timeout or protocol
failure. Untrusted geometry cannot pin the SvelteKit event loop.

Documentation prose and metadata live in `src/lib/content/docs.ts` and are parsed by the bounded,
server-only pipeline in `src/lib/server/documentation.ts`. Schematic fences compile during SSR;
only compiler output and escaped Markdown/token streams cross trusted HTML boundaries.

## Routes

- `/` — SSR product surface and compiler proof
- `/docs/v0.2.1/[slug]` — 3-column synchronized documentation
- `/playground/v0.2.1` — resizable source/render workspace
- `/simulations/v0.2.1/[slug]` — five isolated engineering laboratories
- `/changelog` — registry timeline and native SVG metrics
- `/api/compile` and `/api/search` — bounded server endpoints
- `/sitemap.xml` — automated route inventory
