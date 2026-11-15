import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** Remove application credentials before any local/CI verification process. */
export function verificationEnv(overrides = {}) {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
    if (existsSync(file)) {
      for (const key of Object.keys(parseEnv(readFileSync(file, 'utf8')))) env[key] = '';
    }
  }
  for (const key of Object.keys(env)) {
    if (/^(NEXT_PUBLIC_|SUPABASE_|POSTGRES_|RAWG_|STEAM_|TWITCH_|RESEND_|CLOUDINARY_)/.test(key)
      || ['DATABASE_URL', 'DIRECT_URL', 'CRON_SECRET'].includes(key)) env[key] = '';
  }
  return { ...env, ...overrides, VERDICT_LOCAL_VERIFY: '1' };
}
