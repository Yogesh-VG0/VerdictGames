import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connectDb, closeDb } from "../../scripts/lib/db-connect.mjs";
import { isFreshSlot, parseUtcMinute, slots } from "./slots.mjs";

export function slotId(job, slot) {
  if (!Object.values(slots).some(([allowed]) => job === allowed) || !Number.isFinite(parseUtcMinute(slot))) {
    throw new Error("Invalid automatic slot claim");
  }
  const hex = createHash("sha256").update(`verdictgames:automatic-cron:${job}:${slot}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function claimSlot(sql, job, slot, now = Date.now()) {
  const id = slotId(job, slot);
  if (!isFreshSlot(slot, now)) return false;
  const rows = await sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout = '2500ms'`;
    await tx`SET LOCAL lock_timeout = '1500ms'`;
    return tx`
      INSERT INTO public.scheduler_runs (id, job_name, status, finished_at, metadata)
      VALUES (${id}::uuid, 'automatic-cron-slot', 'success', now(),
        jsonb_build_object('job', ${job}::text, 'nominal_slot', ${slot}::text))
      ON CONFLICT (id) DO NOTHING
      RETURNING id`;
  });
  return rows.length === 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { AUTOMATIC_JOB: job, AUTOMATIC_SLOT: slot, GITHUB_OUTPUT: output } = process.env;
  const sql = connectDb("automatic-cron-slot");
  try {
    const claimed = await claimSlot(sql, job, slot);
    appendFileSync(output, `claimed=${claimed}\n`);
  } finally {
    await closeDb(sql, "automatic-cron-slot");
  }
}
