import { externalOwns, matchesSlot, parsePlan, workflowCron } from "./slots.mjs";

const dispatchUrl = "https://api.github.com/repos/Yogesh-VG0/VerdictGames/actions/workflows/317757346/dispatches";
const maxDispatchAgeMs = 5 * 60_000;
const maxRetryAfterSeconds = 15;

export async function dispatchScheduled(controller, env, {
  send = fetch, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  controller.noRetry();
  if (env.ENABLE_EXTERNAL_CRON !== "true" || controller.cron !== workflowCron) return;
  const time = controller.scheduledTime;
  const age = now() - time;
  if (!Number.isInteger(time) || time % 60_000 !== 0 || age < 0 || age > maxDispatchAgeMs) return;
  const plan = parsePlan(env.CATALOGUE_EXTERNAL_CRON_PLAN);
  const cron = plan?.schedules.find(schedule => matchesSlot(schedule, time));
  if (!externalOwns(plan, cron, time)) return;
  if (!env.GITHUB_ACTIONS_DISPATCH_TOKEN) throw new Error("GitHub dispatch secret is missing");

  const slot = new Date(time).toISOString();
  const request = () => send(dispatchUrl, {
    method: "POST",
    redirect: "error",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_ACTIONS_DISPATCH_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "VerdictGames-maintenance-cron",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({ ref: "main", inputs: { mode: "external_cron", scheduled_slot_utc: slot } }),
    signal: AbortSignal.timeout(12_000),
  });

  let response;
  try {
    response = await request();
    const retryAfter = response.headers.get("Retry-After");
    if (response.status === 429 && /^\d+$/.test(retryAfter ?? "")) {
      const seconds = Math.max(1, Number(retryAfter));
      if (seconds <= maxRetryAfterSeconds && now() + seconds * 1000 - time <= maxDispatchAgeMs) {
        await response.body?.cancel();
        await wait(seconds * 1000);
        if (now() - time <= maxDispatchAgeMs) response = await request();
      }
    }
  } catch {
    throw new Error(`GitHub dispatch outcome unknown at ${slot}`);
  }
  if (response.status !== 200 && response.status !== 204) {
    await response.body?.cancel();
    throw new Error("GitHub dispatch HTTP " + response.status + " at " + slot);
  }
  // GitHub may return a run ID. Its absence cannot justify replaying the slot.
  let runId;
  const length = Number(response.headers.get("Content-Length"));
  if (response.status === 200 && length > 0 && length <= 4096) {
    const receipt = await response.json().catch(() => null);
    if (Number.isSafeInteger(receipt?.workflow_run_id) && receipt.workflow_run_id > 0) runId = receipt.workflow_run_id;
  } else {
    await response.body?.cancel();
  }
  console.info(JSON.stringify({ outcome: "dispatch-accepted", slot, status: response.status, runId }));
}

export default {
  scheduled(controller, env) {
    return dispatchScheduled(controller, env);
  },
};
