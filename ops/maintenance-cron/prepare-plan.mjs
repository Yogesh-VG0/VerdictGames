import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parsePlan, workflowCron } from "./slots.mjs";

// Repository variables currently enable the essential, hourly player and
// Upcoming schedules. Other schedule gates retain their native owner.
export const handoffSchedules = [
  "17 0,12 * * *",
  "37 3 * * *",
  "47 6 * * *",
  "13 1-11,13-23 * * *",
  "53 2,8,14,20 * * *",
];

export function preparePlan(from, until, now = Date.now()) {
  const value = JSON.stringify({ from, until, schedules: handoffSchedules });
  const { start, end } = parsePlan(value);
  // Allow the documented maximum trigger propagation and time for readback.
  if (start - now < 30 * 60_000 || !Number.isFinite(end)) {
    throw new Error("Set a UTC start at least 30 minutes in the future and a finite rollback boundary");
  }
  return {
    planSha256: createHash("sha256").update(value).digest("hex"),
    github: { CATALOGUE_EXTERNAL_CRON_PLAN: value },
    cloudflare: {
      name: "verdict-games-maintenance-cron",
      main: "worker.mjs",
      compatibility_date: "2026-11-25",
      workers_dev: false,
      preview_urls: false,
      triggers: { crons: [workflowCron] },
      vars: { CATALOGUE_EXTERNAL_CRON_PLAN: value, ENABLE_EXTERNAL_CRON: "true" },
      observability: { enabled: true, logs: { enabled: true }, traces: { enabled: false } },
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error("Usage: node prepare-plan.mjs FROM_UTC UNTIL_UTC");
  console.log(JSON.stringify(preparePlan(...process.argv.slice(2)), null, 2));
}
