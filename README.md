# Schemd website

The official SvelteKit website for [`@schemd/core`](https://github.com/schemd/core): landing page, versioned documentation, worker-based playground, focused simulations, public implementation timeline, changelog, and server search.

## Local development

The repository uses Bun only.

```sh
bun ci
bun run dev
```

The development server prints the local URL. Production verification:

```sh
bun run format:check
bun run lint
bun run check
bun run test:coverage
bun run test:docs
bun run build
bun run check:budget
bun run test:e2e
```

## Deployment

The production target is a long-running Node.js 24+ process built by
`@sveltejs/adapter-node`. Static assets are emitted with Brotli and gzip sidecars.

```sh
bun ci
bun run build
HOST=0.0.0.0 PORT=3000 bun run start
```

The process keeps a bounded npm/GitHub release registry snapshot in memory. Every process starts
with the reproducible bundled manifest, returns it without network latency, and refreshes the
registry in the background. Fresh results are reused for 15 minutes; the last network result
remains available for 24 hours if either upstream is unavailable.

The adapter also supports `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER`,
`ADDRESS_HEADER`, `XFF_DEPTH`, `BODY_SIZE_LIMIT`, and `SHUTDOWN_TIMEOUT` when the
server is deployed behind a trusted reverse proxy. Set only the forwarding headers
your proxy owns; accepting untrusted forwarded headers can make origin checks unsafe.

## Content and releases

`src/lib/versioning/manifest.ts` is the website release source of truth. Versioned documentation is build-bundled under `src/lib/content/docs/<version>`. The generated metrics and timeline files record their core commit provenance; update the core sources first, then regenerate the website snapshots.
