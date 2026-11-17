type ReleaseSignals = { release_status?: string | null; tags?: string[] | null; genres?: string[] | null };
const normalizedStatus = (value: string) => value.toLowerCase().replace(/[-_]/g, ' ').trim();

export function hasKnownFullRelease(game: ReleaseSignals) {
  return ['released', 'full release'].includes(normalizedStatus(game.release_status || ''));
}

export function hasEarlyAccessSignal(game: ReleaseSignals) {
  // Historical community tags are retained as source data. A verified current
  // full-release status takes precedence over those historical signals.
  if (hasKnownFullRelease(game)) return false;
  return [game.release_status || '', ...(game.tags || []), ...(game.genres || [])]
    .some(value => normalizedStatus(value) === 'early access');
}
