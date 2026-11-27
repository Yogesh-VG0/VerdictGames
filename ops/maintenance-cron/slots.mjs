export const workflowCron = "9,13,17,23,29,37,43,47,51,53,57 * * * *";
export const maxSlotAgeMs = 30 * 60_000;
export const slots = {
  "17 0,12 * * *": ["refresh-trending"],
  "37 3 * * *": ["discover-standard"],
  "47 6 * * *": ["re-enrich"],
  "13 1-11,13-23 * * *": ["refresh-player-counts", "CATALOGUE_PLAYER_CRON_ENABLED"],
  "43 4 * * 1,4": ["refresh-steam-reviews", "CATALOGUE_REVIEW_CRON_ENABLED"],
  "23 2 * * 6": ["seed-curated-lists", "CATALOGUE_CURATED_CRON_ENABLED"],
  "29 5 * * 2": ["backfill-mobile-android", "CATALOGUE_MOBILE_CRON_ENABLED"],
  "29 5 * * 5": ["backfill-mobile-ios", "CATALOGUE_MOBILE_CRON_ENABLED"],
  "53 2,8,14,20 * * *": ["refresh-upcoming-snapshot", "CATALOGUE_UPCOMING_CRON_ENABLED"],
  "23 6,18 * * *": ["refresh-trending", "CATALOGUE_FOLLOWUP_CRON_ENABLED"],
  "47 13 * * *": ["re-enrich", "CATALOGUE_FOLLOWUP_CRON_ENABLED"],
  "57 9 * * *": ["discover-steam-popular", "CATALOGUE_FOLLOWUP_CRON_ENABLED"],
  "53 4 * * 3": ["discover-deep", "CATALOGUE_FOLLOWUP_CRON_ENABLED"],
  "51 4 * * 0": ["backfill-games", "CATALOGUE_FOLLOWUP_CRON_ENABLED"],
  "9 7 * * *": ["maintenance-health", "CATALOGUE_FOLLOWUP_CRON_ENABLED"],
};

export function parseUtcMinute(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : NaN;
}

export function isFreshSlot(slot, now = Date.now()) {
  const age = now - parseUtcMinute(slot);
  return age >= 0 && age <= maxSlotAgeMs;
}

function matchesField(field, value) {
  return field === "*" || field.split(",").some(entry => {
    const [first, last = first] = entry.split("-").map(Number);
    return value >= first && value <= last;
  });
}

export function matchesSlot(cron, timestamp) {
  const date = new Date(timestamp);
  const [minute, hour, , , day] = cron.split(" ");
  return matchesField(minute, date.getUTCMinutes()) &&
    matchesField(hour, date.getUTCHours()) && matchesField(day, date.getUTCDay());
}

export function parsePlan(value) {
  if (!value) return null;
  const { from, until, schedules } = JSON.parse(value);
  const start = parseUtcMinute(from);
  const end = until === undefined ? Infinity : parseUtcMinute(until);
  if (!Number.isFinite(start) || !(end > start) || !Array.isArray(schedules) || !schedules.length ||
      schedules.some(cron => !Object.hasOwn(slots, cron)) || new Set(schedules).size !== schedules.length) {
    throw new Error("Invalid UTC maintenance handoff plan");
  }
  return { start, end, schedules };
}

export function externalOwns(plan, cron, slot) {
  return Boolean(plan && plan.schedules.includes(cron) && slot >= plan.start && slot < plan.end);
}
