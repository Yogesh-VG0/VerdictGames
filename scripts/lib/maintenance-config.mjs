// Validate provider prerequisites without making optional RAWG ingestion a
// prerequisite for existing Steam catalogue refreshes.
export function missingMaintenanceSecrets(job, environment) {
  const missing = environment.SUPABASE_DB_URL ? [] : ['SUPABASE_DB_URL'];
  if (['re-enrich', 'backfill-games'].includes(job) && !environment.RAWG_API_KEY) {
    missing.push('RAWG_API_KEY');
  }
  if (['discover-standard', 'discover-deep'].includes(job)
    && !environment.RAWG_API_KEY
    && (!environment.TWITCH_CLIENT_ID || !environment.TWITCH_CLIENT_SECRET)) {
    missing.push('RAWG_API_KEY-or-TWITCH-credentials');
  }
  return missing;
}
