import type { RawgListItem } from './rawg';
export function isUpcomingSnapshot(payload: unknown): payload is { results: RawgListItem[] };
