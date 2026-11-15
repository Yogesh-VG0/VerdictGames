// Shared admission contract for the public reader and scheduled snapshot writer.
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 250;
const count = value => Number.isSafeInteger(value) && value >= 0;
const terms = value => value === null || Array.isArray(value) && value.every(item => text(item?.name));
export function isUpcomingSnapshot(payload) {
  return Array.isArray(payload?.results) && payload.results.length > 0 && payload.results.length <= 100
    && payload.results.every(row => count(row?.id) && row.id > 0 && text(row.name) && text(row.slug)
      && typeof row.tba === 'boolean' && (row.released === null || /^\d{4}-\d{2}-\d{2}$/.test(row.released))
      && count(row.added) && count(row.ratings_count) && Number.isFinite(row.rating) && row.rating >= 0 && row.rating <= 5
      && terms(row.genres) && terms(row.tags)
      && (row.platforms === null || Array.isArray(row.platforms) && row.platforms.every(item => text(item?.platform?.name))));
}
