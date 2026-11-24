// A failed attempt defers an identity without advancing any public freshness time.
export async function recordMaintenanceAttempt(sql, job, gameId, succeeded, successDays) {
  await sql`
    INSERT INTO public.maintenance_item_due_state (job, game_id, next_attempt_at, failures)
    VALUES (${job}, ${gameId}, now() + ${succeeded ? successDays : 1} * interval '1 day', ${succeeded ? 0 : 1})
    ON CONFLICT (job, game_id) DO UPDATE SET
      failures = CASE WHEN ${succeeded} THEN 0 ELSE LEAST(10, maintenance_item_due_state.failures + 1) END,
      next_attempt_at = now() + CASE WHEN ${succeeded} THEN ${successDays}::double precision
        ELSE LEAST(30, power(2, maintenance_item_due_state.failures)) END * interval '1 day'
  `;
}
