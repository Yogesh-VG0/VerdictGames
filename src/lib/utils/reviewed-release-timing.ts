import type { ReleaseTiming } from './release-timing';

// Preserve the previously reviewed publisher windows when provider precision is absent.
const reviewedWindows = new Map([[391403, '2026-12'], [973539, '2027-03'], [1015421, '2027-02'], [469645, '2027-01']]);

export function getReviewedReleaseTiming(rawgId: number | null | undefined, date?: string | null, providerTiming?: ReleaseTiming): ReleaseTiming | undefined {
  // Catalyst, separate from Legacy of Atlantis. Embracer's 2026-11-11
  // schedule supersedes the 2025 reveal window, at calendar-year precision.
  // https://embracer.com/wp-content/uploads/2026/11/Q2-FY-2627-Presentation.pdf#page=9
  if (rawgId === 1015411) return { precision: 'year', value: '2028' };
  if (providerTiming) return providerTiming;
  const month = rawgId ? reviewedWindows.get(rawgId) : undefined;
  if (month && (!date || date.startsWith(month) || date < month)) return { precision: 'month', value: month };
}
