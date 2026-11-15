export function hasEarlyAccessSignal(game: { release_status?: string | null; tags?: string[] | null; genres?: string[] | null }) {
  return [game.release_status || '', ...(game.tags || []), ...(game.genres || [])]
    .some(value => value.toLowerCase().replace(/[-_]/g,' ') === 'early access');
}
