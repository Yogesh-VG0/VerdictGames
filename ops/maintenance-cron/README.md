# Exclusive maintenance scheduler handoff

This candidate starts dormant with no triggers, no public endpoint, no secret and no ownership plan. Native GitHub events retain ownership until an approved future UTC interval. No historical slot is eligible for external dispatch.

## Rehearsal and capacity

Run `node --test ops/maintenance-cron/scheduler.test.mjs` and review the exact job map in `slots.mjs` against the existing workflow. One */2-style minute selector covers the five currently enabled schedule expressions by using their exact minute set. Other schedules keep their native owner. The Worker dispatches at most one eligible job per matching tick and once more only after an explicit short 429 Retry-After. GitHub remains responsible for the serial runner, freshness check, pressure gate, atomic job/slot claim and provider reservations. Treat an ambiguous network result as unknown and reconcile the slot receipt without replay.

One trigger fits the Workers Free account maximum of five, and scheduled invocations have a 10 ms CPU limit. Network wait is distinct from CPU. Standard GitHub-hosted runners in the existing public repository are free. GitHub admits one executing workflow job in the named group and up to 100 pending with queue max. The candidate rejects stale slots rather than running accumulated jobs. Availability and measured dispatch latency still need an authorized hosted rehearsal. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits) · [Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)

## Authorization and boundaries

1. Choose an owner-approved, future UTC start and finite stop. Generate a plan at least 30 minutes ahead with `node ops/maintenance-cron/prepare-plan.mjs <FROM_UTC> <UNTIL_UTC>`. Use the identical value and SHA-256 for both providers. The interval includes the start and excludes the stop. A finite stop restores native ownership automatically. [Cron propagation](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
2. Authorize the exact workflow changes and a dedicated dispatch identity restricted to this repository with Actions write permission. Put its token only in the Worker secret store. Configure the exact authorized actor in the GitHub resolver variable and verify readback. Keep the Worker dormant until the workflow, actor and timing checks match. [Dispatch permissions](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
3. Under the approved plan, verify the first future external acceptance and durable job outcome. Reconcile GitHub run IDs, safe Worker receipts, gate outcomes and missed slots. If the plan, identity, usage, or pressure fails, disable external dispatch and agree a future rollback boundary on both sides. Confirm the last external and first native claim. Leave historical slots closed.
4. Keep Steam selection changes independent. Assess observation age, missing positive comparison baselines, engagement and prior retries against the existing query and request caps before changing the budget or eligibility.

No production scheduler, variable, secret or subscription is changed by the local plan generator.
