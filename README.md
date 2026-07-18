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

The project intentionally uses `@sveltejs/adapter-auto`. Connect the repository to a supported SvelteKit host, set the production domain to `schemd.johnowolabiidogun.dev`, and use:

```sh
bun ci
bun run build
```

No runtime environment variables are required. Change to a platform-specific adapter only after the deployment target is selected.

## Content and releases

`src/lib/versioning/manifest.ts` is the website release source of truth. Versioned documentation is build-bundled under `src/lib/content/docs/<version>`. The generated metrics and timeline files record their core commit provenance; update the core sources first, then regenerate the website snapshots.
