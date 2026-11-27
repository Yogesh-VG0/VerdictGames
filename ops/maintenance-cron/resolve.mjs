import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { externalOwns, matchesSlot, maxSlotAgeMs, parsePlan, parseUtcMinute, slots } from "./slots.mjs";

const allowedJobs = new Set(Object.values(slots).map(([job]) => job));
const requiredRepo = "Yogesh-VG0/VerdictGames";

export async function resolveMaintenance(env, event, now = Date.now(), lookupRunTime = githubRunCreatedAt) {
  if (env.GITHUB_REPOSITORY !== requiredRepo || env.GITHUB_REF !== "refs/heads/main") {
    return { reason: "Production maintenance requires the default branch in the canonical repository." };
  }
  const dispatch = env.GITHUB_EVENT_NAME === "workflow_dispatch";
  const mode = event.inputs?.mode || "manual";
  const schedulerId = env.CATALOGUE_EXTERNAL_CRON_ACTOR_ID || "";
  const actor = env.GITHUB_ACTOR_ID;
  if (dispatch && mode === "manual") {
    const operators = (env.CATALOGUE_MANUAL_OPERATOR_IDS || "175027490").split(",").map(id => id.trim());
    if (!actor || actor === schedulerId || !operators.includes(actor) ||
        env.GITHUB_TRIGGERING_ACTOR !== env.GITHUB_ACTOR || event.inputs?.scheduled_slot_utc ||
        !allowedJobs.has(event.inputs?.job)) {
      return { reason: "Manual dispatch is restricted to an authorized operator and a known job." };
    }
    return { job: event.inputs.job };
  }
  if (env.GITHUB_RUN_ATTEMPT !== "1" || env.CATALOGUE_CRON_ENABLED !== "true") {
    return { reason: "Automatic maintenance is disabled or this is a rerun." };
  }

  const plan = parsePlan(env.CATALOGUE_EXTERNAL_CRON_PLAN);
  let cron;
  let slot;
  if (dispatch && mode === "external_cron") {
    if (!/^\d+$/.test(schedulerId) || actor !== schedulerId || (event.inputs?.job && event.inputs.job !== "automatic-slot") ||
        (event.inputs?.review_limit && event.inputs.review_limit !== "25") ||
        env.GITHUB_TRIGGERING_ACTOR !== env.GITHUB_ACTOR) {
      return { reason: "External dispatch credentials or inputs are invalid." };
    }
    slot = parseUtcMinute(event.inputs?.scheduled_slot_utc);
    if (!(now - slot >= 0 && now - slot <= maxSlotAgeMs)) {
      return { reason: "External slot is invalid, expired, or in the future." };
    }
    cron = plan?.schedules.find(schedule => matchesSlot(schedule, slot) && externalOwns(plan, schedule, slot));
  } else if (env.GITHUB_EVENT_NAME === "schedule") {
    cron = event.schedule;
    if (plan?.schedules.includes(cron)) {
      const createdAt = await lookupRunTime(env);
      if (!(now - createdAt >= 0 && now - createdAt <= maxSlotAgeMs)) {
        return { reason: "Scheduled delivery is outside the handoff window." };
      }
      const creationMinute = Math.floor(createdAt / 60_000) * 60_000;
      for (let candidate = creationMinute; now - candidate <= maxSlotAgeMs; candidate -= 60_000) {
        if (matchesSlot(cron, candidate)) {
          slot = candidate;
          break;
        }
      }
      if (slot === undefined || externalOwns(plan, cron, slot)) {
        return { reason: "No recent native-owned slot was found for this schedule." };
      }
    }
  }

  if (!cron || !Object.hasOwn(slots, cron)) return { reason: "Automatic source or slot is not approved." };
  const [job, gate] = slots[cron];
  if (gate && env[gate] !== "true") return { reason: `Automatic ${job} is disabled.` };
  return { job, slot: slot === undefined ? undefined : new Date(slot).toISOString() };
}

async function githubRunCreatedAt(env) {
  const response = await fetch(`https://api.github.com/repos/${requiredRepo}/actions/runs/${env.GITHUB_RUN_ID}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.MAINTENANCE_GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`GitHub run timestamp unavailable (HTTP ${response.status})`);
  return Date.parse((await response.json()).created_at);
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const { job, slot, reason } = await resolveMaintenance(process.env, event);
  appendFileSync(process.env.GITHUB_OUTPUT, `job=${job ?? ""}\nslot=${slot ?? ""}\n`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, job ? `### Running \`${job}\`\n` : `${reason}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
