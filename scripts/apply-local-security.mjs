import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

// Explicitly local, never a generic migration runner for an arbitrary URL.
assert.equal(new URL(process.env.SUPABASE_DB_URL).hostname, '127.0.0.1');
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, onnotice: () => {} });
try {
  // The local test fixture predates the deployed shared write guard. Match that
  // dependency so route mutations are tested with the guard still enabled.
  await sql.unsafe(readFileSync('supabase/migrations/20261110181537_shared_mutation_rate_limits.sql', 'utf8'));
  await sql.unsafe(readFileSync('supabase/migrations/20261110175651_secure_profiles_and_private_lists.sql', 'utf8'));
  await sql.unsafe(readFileSync('supabase/migrations/20261114121612_isolate_private_profile_library_and_avatars.sql', 'utf8'));
  console.log('Local privacy migration applied; hosted project and migration history unchanged');
} finally {
  await sql.end();
}
