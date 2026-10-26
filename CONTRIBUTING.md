# Contributing to Schemd web

This repository contains the documentation, IDE, translations, and engineering laboratories.
Read [README.md](./README.md) for the architecture, routes, local preview, and language workflow.
Use Node 24 or newer and the Bun version declared in `package.json` (`bun@1.4.3`).

## Develop and verify

Work on a branch or fork and install with `bun install --frozen-lockfile`. Use `bun run dev`
for the development server. Before submitting, run `bun run release:check`; it covers formatting,
lint, types, unit tests, documentation fences, production browser tests, and build budgets.
Install Chromium once with `bunx playwright install chromium`. Target a smaller suite while
iterating, then run the complete sequence for a change that affects rendering or navigation.

Keep compilation bounded, compiler imports lazy, server data request-local, and all published
documentation fences valid. Preserve keyboard access, readable focus, reduced-motion behaviour,
and mobile containment. Review rendered output when compiler or laboratory geometry changes.

## Content and translations

Keep historical compiler documentation in its own version directory. Do not add new syntax to an
older line. Update Spanish interface messages when English copy changes, then run
`bun scripts/collect-messages.ts`. `bun run test:docs` verifies translated document structure and
code-fence parity. Keep source examples and mathematical notation consistent across languages.

## Pull requests

Describe the user-visible problem, resulting behaviour, validation, and relevant compatibility or
budget effects. Include screenshots for a visible change when they help review. Agree on substantial
API or curriculum changes in an issue first. Add a regression assertion for a defect, and inspect
generated snapshots before committing them. CI and review requirements apply to automation too.

Compiler dependency updates must also refresh `src/lib/server/release-snapshot.json` with
`bun scripts/sync-release-snapshot.ts`. The scheduled compiler workflow prepares both changes;
if Dependabot opens a compiler update first, refresh its snapshot before merging. Compiler security
updates remain enabled in Dependabot.

Use [SUPPORT.md](./SUPPORT.md) for questions, [SECURITY.md](./SECURITY.md) for vulnerabilities,
and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for conduct reports.

## Licensing

The repository's code and original documentation use the [MIT licence](./LICENSE).
Third-party dependencies and assets retain their own licences and notices.
