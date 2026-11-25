import { getServerSupabase } from '@/lib/supabase/server';
import { annualReleaseTiming } from '@/lib/utils/editorial-eligibility.mjs';
import type { GameRow } from '@/lib/supabase/types';
import type { ReleaseTiming } from '@/lib/utils/release-timing';

export async function readAnnualListEvidence(rows: GameRow[]): Promise<Map<string, ReleaseTiming>> {
  const candidates = rows.filter(row => row.igdb_id != null).slice(0, 60);
  const evidence = new Map<string, ReleaseTiming>();
  if (!candidates.length || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return evidence;
  const { data, error } = await getServerSupabase().from('game_sources')
    .select('game_id, provider_id:raw_data->id, release_dates:raw_data->release_dates')
    .eq('source_name', 'igdb').in('game_id', candidates.map(row => row.id))
    .abortSignal(AbortSignal.timeout(1800));
  if (error) throw error;
  for (const row of candidates) {
    const source = data?.find(entry => entry.game_id === row.id);
    if (!source) continue;
    const timing = annualReleaseTiming(row, { id: source.provider_id, release_dates: source.release_dates });
    if (timing) evidence.set(row.id, timing);
  }
  return evidence;
}
