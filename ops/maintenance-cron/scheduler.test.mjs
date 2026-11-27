import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveMaintenance } from "./resolve.mjs";
import { dispatchScheduled } from "./worker.mjs";
import { externalOwns, isFreshSlot, matchesSlot, parsePlan, slots, workflowCron } from "./slots.mjs";
import { handoffSchedules, preparePlan } from "./prepare-plan.mjs";

const now = Date.parse("2026-11-25T06:48:00.000Z");
const slot = "2026-11-25T06:47:00.000Z";
const essential = "47 6 * * *";
const player = "13 1-11,13-23 * * *";
const handover = JSON.stringify({ from: slot, schedules: [essential, player] });
const common = {
  GITHUB_REPOSITORY: "Yogesh-VG0/VerdictGames", GITHUB_REF: "refs/heads/main",
  GITHUB_RUN_ATTEMPT: "1", CATALOGUE_CRON_ENABLED: "true",
  CATALOGUE_EXTERNAL_CRON_ACTOR_ID: "123", GITHUB_ACTOR_ID: "123",
  GITHUB_ACTOR: "test-bot", GITHUB_TRIGGERING_ACTOR: "test-bot",
};
const external = { ...common, GITHUB_EVENT_NAME: "workflow_dispatch", CATALOGUE_EXTERNAL_CRON_PLAN: handover };
const native = { ...common, GITHUB_EVENT_NAME: "schedule" };
const dispatch = (inputs = {}) => ({ inputs: { mode: "external_cron", scheduled_slot_utc: slot, ...inputs } });
const config = new URL("../../.github/workflows/scheduled-maintenance.yml", import.meta.url);

test("maintains every native schedule and checks every automatic job gate", async () => {
  assert.deepEqual([...readFileSync(config, "utf8").matchAll(/- cron: "([^"]+)"/g)].map(match => match[1]), Object.keys(slots));
  for (const [schedule, [job, gate]] of Object.entries(slots)) {
    if (gate) assert.equal((await resolveMaintenance(native, { schedule }, now)).job, undefined);
    assert.equal((await resolveMaintenance({ ...native, [gate]: "true" }, { schedule }, now)).job, job);
  }
  assert.equal((await resolveMaintenance({ ...native, CATALOGUE_CRON_ENABLED: "false" }, { schedule: essential }, now)).job, undefined);
});

test("selects exact UTC weekdays and keeps Worker trigger minutes aligned", () => {
  const start = Date.parse("2026-11-22T00:00:00Z");
  let matched = 0;
  for (let minute = 0; minute < 7 * 24 * 60; minute++) {
    const time = start + minute * 60_000;
    const schedules = Object.keys(slots).filter(cron => matchesSlot(cron, time));
    assert.ok(schedules.length <= 1);
    if (schedules.length === 1) {
      matched++;
      assert.ok(matchesSlot(workflowCron, time));
    }
  }
  assert.equal(matched, 252);
  assert.ok(matchesSlot("29 5 * * 2", Date.parse("2026-11-24T05:29:00Z")));
  assert.ok(!matchesSlot("29 5 * * 2", Date.parse("2026-11-27T05:29:00Z")));
});

test("enforces source ownership, external identity and age, and manual authorization", async () => {
  const allow = await resolveMaintenance(external, dispatch({ job: "automatic-slot" }), now);
  assert.deepEqual(allow, { job: "re-enrich", slot });
  const rejects = [
    [{ ...external, CATALOGUE_CRON_ENABLED: "false" }, dispatch()],
    [{ ...external, GITHUB_ACTOR_ID: "124" }, dispatch()],
    [{ ...external, GITHUB_RUN_ATTEMPT: "2" }, dispatch()],
    [{ ...external, GITHUB_REF: "refs/heads/old" }, dispatch()],
    [external, dispatch({ mode: "manual", job: "re-enrich", scheduled_slot_utc: "" })],
    [external, dispatch({ scheduled_slot_utc: "2026-11-24T06:47:00.000Z" })],
    [external, dispatch({ scheduled_slot_utc: "2026-11-25T07:13:00.000Z" })],
    [external, dispatch({ scheduled_slot_utc: "2026-11-25T06:46:00.000Z" })],
    [external, dispatch({ job: "re-enrich" })],
    [external, dispatch({ review_limit: "100" })],
  ];
  for (const args of rejects) assert.equal((await resolveMaintenance(...args, now)).job, undefined);
  const later = Date.parse("2026-11-25T07:14:00Z");
  const playerEvent = dispatch({ scheduled_slot_utc: "2026-11-25T07:13:00.000Z" });
  assert.equal((await resolveMaintenance(external, playerEvent, later)).job, undefined);
  assert.equal((await resolveMaintenance({ ...external, CATALOGUE_PLAYER_CRON_ENABLED: "true" }, playerEvent, later)).job, "refresh-player-counts");

  const active = { ...native, CATALOGUE_EXTERNAL_CRON_PLAN: handover };
  assert.equal((await resolveMaintenance(active, { schedule: essential }, now, async () => now)).job, undefined);
  const end = JSON.stringify({ from: "2026-11-24T00:00:00.000Z", until: slot, schedules: [essential] });
  assert.deepEqual(await resolveMaintenance({ ...active, CATALOGUE_EXTERNAL_CRON_PLAN: end }, { schedule: essential }, now, async () => now), allow);
  assert.equal((await resolveMaintenance(active, { schedule: essential }, now + 31 * 60_000, async () => now)).job, undefined);

  const owner = { ...external, GITHUB_ACTOR_ID: "175027490", GITHUB_ACTOR: "operator", GITHUB_TRIGGERING_ACTOR: "operator" };
  const manual = { inputs: { mode: "manual", job: "seed-curated-lists" } };
  assert.equal((await resolveMaintenance({ ...owner, CATALOGUE_CRON_ENABLED: "false" }, manual, now)).job, "seed-curated-lists");
  assert.equal((await resolveMaintenance({ ...owner, GITHUB_TRIGGERING_ACTOR: "test-bot" }, manual, now)).job, undefined);
});

test("Worker stays dormant and makes bounded dispatch attempts", async () => {
  const attempts = [];
  const waits = [];
  let noRetry = 0;
  const controller = { cron: workflowCron, scheduledTime: Date.parse(slot), noRetry: () => noRetry++ };
  const env = { ENABLE_EXTERNAL_CRON: "true", CATALOGUE_EXTERNAL_CRON_PLAN: handover, GITHUB_ACTIONS_DISPATCH_TOKEN: "fake" };
  const hooks = {
    now: () => now,
    wait: async ms => { waits.push(ms); },
    send: async (url, init) => {
      attempts.push({ url, body: JSON.parse(init.body) });
      return attempts.length === 1
        ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
        : new Response(null, { status: 204 });
    },
  };
  await dispatchScheduled(controller, { ...env, ENABLE_EXTERNAL_CRON: "false" }, hooks);
  await dispatchScheduled({ ...controller, scheduledTime: Date.parse(slot) - 5 * 60_000 }, env, hooks);
  assert.equal(attempts.length, 0);
  await dispatchScheduled(controller, env, hooks);
  assert.deepEqual(waits, [2_000]);
  assert.equal(noRetry, 3);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].url, "https://api.github.com/repos/Yogesh-VG0/VerdictGames/actions/workflows/317757346/dispatches");
  assert.deepEqual(attempts[0].body, { ref: "main", inputs: { mode: "external_cron", scheduled_slot_utc: slot } });
  let failedAttempts = 0;
  await assert.rejects(dispatchScheduled(controller, env, {
    ...hooks, send: async () => { failedAttempts++; throw new Error("timeout"); },
  }), /outcome unknown/);
  assert.equal(failedAttempts, 1);
});


test("one prepared window gives baseline slots one owner and restores native ownership at the end", async () => {
  const from = "2026-11-29T00:00:00.000Z";
  const until = "2026-11-30T00:00:00.000Z";
  const before = Date.parse(from) - 40 * 60_000;
  const generated = preparePlan(from, until, before);
  const value = generated.github.CATALOGUE_EXTERNAL_CRON_PLAN;
  assert.equal(generated.cloudflare.vars.CATALOGUE_EXTERNAL_CRON_PLAN, value);
  assert.match(generated.planSha256, /^[a-f0-9]{64}$/);
  assert.equal(generated.cloudflare.workers_dev, false);
  assert.equal(generated.cloudflare.preview_urls, false);
  assert.deepEqual(generated.cloudflare.triggers.crons, [workflowCron]);
  assert.throws(() => preparePlan(from, until, Date.parse(from) - 29 * 60_000), /future/);
  assert.throws(() => preparePlan(from, undefined, before), /rollback/);
  assert.throws(() => preparePlan(from, from, before), /Invalid/);
  const planEnv = {
    CATALOGUE_EXTERNAL_CRON_PLAN: value,
    CATALOGUE_PLAYER_CRON_ENABLED: "true",
    CATALOGUE_UPCOMING_CRON_ENABLED: "true",
    CATALOGUE_FOLLOWUP_CRON_ENABLED: "true",
  };
  const plan = parsePlan(value);
  for (const schedule of handoffSchedules) {
    assert.equal(externalOwns(plan, schedule, Date.parse(from) - 1), false);
    assert.equal(externalOwns(plan, schedule, Date.parse(from)), true);
    assert.equal(externalOwns(plan, schedule, Date.parse(until)), false);
  }
  let dispatched = 0;
  let returnedToNative = 0;
  for (let time = Date.parse(from); time < Date.parse(until) + 86_400_000; time += 60_000) {
    const schedule = handoffSchedules.find(cron => matchesSlot(cron, time));
    if (!schedule) continue;
    const scheduled_slot_utc = new Date(time).toISOString();
    const checkTime = time + 60_000;
    const nativeResult = await resolveMaintenance({ ...native, ...planEnv },
      { schedule }, checkTime, async () => checkTime);
    const externalResult = await resolveMaintenance({ ...external, ...planEnv },
      dispatch({ scheduled_slot_utc }), checkTime);
    const expected = slots[schedule][0];
    assert.equal(Number(Boolean(nativeResult.job)) + Number(Boolean(externalResult.job)), 1);
    assert.equal(nativeResult.job || externalResult.job, expected);
    if (externalResult.job) dispatched++;
    if (nativeResult.job) returnedToNative++;
  }
  assert.equal(dispatched, 30);
  assert.equal(returnedToNative, 30);
  const optional = "23 6,18 * * *";
  const time = Date.parse("2026-11-29T06:23:00Z");
  assert.equal((await resolveMaintenance({ ...native, ...planEnv }, { schedule: optional }, time)).job, "refresh-trending");
  assert.equal((await resolveMaintenance({ ...external, ...planEnv },
    dispatch({ scheduled_slot_utc: new Date(time).toISOString() }), time)).job, undefined);
  assert.equal(isFreshSlot(slot, Date.parse(slot) + 30 * 60_000), true);
  assert.equal(isFreshSlot(slot, Date.parse(slot) + 30 * 60_000 + 1), false);
  assert.equal(isFreshSlot(slot, Date.parse(slot) - 1), false);
});

test("ownership resolution runs outside the serial database job", () => {
  const yaml = readFileSync(config, "utf8");
  const resolveJob = yaml.slice(yaml.indexOf("  resolve:"), yaml.indexOf("  run:"));
  const runJob = yaml.slice(yaml.indexOf("  run:"));
  assert.doesNotMatch(resolveJob, /concurrency:|secrets.SUPABASE_DB_URL|secrets.RAWG_API_KEY/);
  assert.match(runJob, /needs: resolve/);
  assert.match(runJob, /group: scheduled-maintenance\s+queue: max\s+cancel-in-progress: false/);
  assert.ok(runJob.indexOf("Check slot before database access") < runJob.indexOf("Check database pressure"));
  assert.ok(runJob.indexOf("Check database pressure") < runJob.indexOf("Claim automatic UTC slot"));
  assert.ok(runJob.indexOf("Claim automatic UTC slot") < runJob.indexOf("Check RAWG availability"));
});

test("a rejected dispatch is reported once and a success carries only safe receipt fields", async t => {
  const log = t.mock.method(console, "info", () => {});
  let sends = 0;
  const controller = { cron: workflowCron, scheduledTime: Date.parse(slot), noRetry() {} };
  const env = { ENABLE_EXTERNAL_CRON: "true", CATALOGUE_EXTERNAL_CRON_PLAN: handover, GITHUB_ACTIONS_DISPATCH_TOKEN: "never-log" };
  const body = JSON.stringify({ workflow_run_id: 123, html_url: "ignored" });
  await dispatchScheduled(controller, env, {
    now: () => now,
    send: async () => new Response(body, { status: 200, headers: { "Content-Length": String(body.length) } }),
  });
  assert.deepEqual(JSON.parse(log.mock.calls[0].arguments[0]), { outcome: "dispatch-accepted", slot, status: 200, runId: 123 });
  await assert.rejects(dispatchScheduled(controller, env, {
    now: () => now,
    send: async () => { sends++; return new Response("never-log", { status: 403 }); },
  }), /GitHub dispatch HTTP 403 at 2026-11-25T06:47/);
  assert.equal(sends, 1);
  assert.equal(log.mock.callCount(), 1);
});
