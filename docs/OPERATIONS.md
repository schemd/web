# Production operations

The current production site is https://schemd.johnowolabiidogun.dev. John Owolabi Idogun
(`@Sirneij`) owns deployment and rollback decisions. Hosting credentials are managed outside
this repository. There is no appointed secondary deployment operator.

## Deploy

Merge a reviewed PR only after the required `verify` check passes against current `main`.
The GitHub environment `schemd / production` accepts deployments from protected branches.
Keep the hosting provider's production source restricted to `main` as well; a GitHub environment
rule does not configure an external provider's branch settings.

The deployment target runs `bun run build` with the pinned toolchain and starts the adapter-bun
process with `HOST=0.0.0.0 PORT=3000 bun run start`. Configure `SCHEMD_ORIGIN` at build time.
Only trust forwarding headers overwritten by the reverse proxy. Keep credentials in the hosting
provider's secret store, never in a PR or committed environment file.

After deployment, check the home page, current documentation, a playground compilation, a
laboratory, and the locale selector. Confirm the deployed commit and inspect server errors.
Use the relevant browser and unit suites to reproduce a failure before marking a deployment good.

## Roll back

Record the failing deployment and its commit. In the hosting provider, redeploy the last known
good deployment or build its recorded commit with the lockfile and toolchain from that commit.
Confirm the same public routes and compilation checks after rollback. Do not move a release tag
or force-push `main` to perform a rollback. Submit a normal revert or corrective PR so source
history and the next deployment agree.

## Compiler updates and previews

The scheduled compiler sync opens a PR and runs the complete documentation and browser checks.
Review its rendered output before merging. Check failed scheduled runs instead of widening budgets
or changing expected output without investigating the cause.

Fork previews must use read-only credentials and no production secrets. The diagram-review job
publishes a workflow summary and an artifact for every contributor; automatic PR comments are
limited to branches in this repository. Do not run fork code under `pull_request_target` with a
write token to obtain a comment.
