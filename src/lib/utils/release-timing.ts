export type ReleaseTiming =
  | { precision: 'day' | 'month' | 'quarter' | 'year'; value: string }
  | { precision: 'tba' };

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function resolveReleaseTiming(
  date: string | null | undefined,
  options: { upcoming?: boolean; tba?: boolean; evidence?: ReleaseTiming } = {},
): ReleaseTiming {
  if (options.evidence) return options.evidence;
  if (options.tba || !date) return { precision: 'tba' };
  if (/^\d{4}$/.test(date)) return { precision: 'year', value: date };
  if (/^\d{4}-Q[1-4]$/.test(date)) return { precision: 'quarter', value: date };
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return { precision: 'month', value: date };

  const day = date.slice(0, 10);
  const parsed = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return { precision: 'tba' };
  if (options.upcoming) {
    const year = day.slice(0, 4);
    const month = day.slice(0, 7);
    if (day.endsWith('-12-31') || day.endsWith('-01-01')) return { precision: 'year', value: year };
    const lastDay = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate();
    if (parsed.getUTCDate() === lastDay) return { precision: 'month', value: month };
  }
  return { precision: 'day', value: day };
}

export function formatReleaseTiming(timing: ReleaseTiming): string {
  switch (timing.precision) {
    case 'day': return dayFormatter.format(new Date(timing.value + 'T00:00:00Z'));
    case 'month': return monthFormatter.format(new Date(timing.value + '-01T00:00:00Z'));
    case 'quarter': return timing.value.slice(5) + ' ' + timing.value.slice(0, 4);
    case 'year': return timing.value;
    case 'tba': return 'TBA';
  }
}

export function releaseTimingMonth(timing: ReleaseTiming): string | undefined {
  if (timing.precision === 'day' || timing.precision === 'month') return timing.value.slice(0, 7);
}

export interface IgdbReleaseDate {
  date?: number;
  y?: number;
  m?: number;
  date_format?: { format?: string };
  status?: { name?: string };
}

export function selectIgdbTiming(entries: IgdbReleaseDate[], rawDate?: string | null): ReleaseTiming | undefined {
  const timings: ReleaseTiming[] = [];
  for (const entry of entries) {
    if (/early.access|beta|cancel|rumou?r|unconfirmed/i.test(entry.status?.name ?? '')) continue;
    const format = entry.date_format?.format?.toUpperCase();
    if (format === 'TBD' || format === 'TBA') {
      timings.push({ precision: 'tba' });
      continue;
    }
    const fromEpoch = entry.date != null ? new Date(entry.date * 1000) : null;
    const date = fromEpoch && Number.isFinite(fromEpoch.getTime()) ? fromEpoch.toISOString().slice(0, 10) : '';
    const year = entry.y && entry.y > 1900 ? String(entry.y) : date.slice(0, 4);
    const month = entry.m && entry.m >= 1 && entry.m <= 12 ? String(entry.m).padStart(2, '0') : date.slice(5, 7);
    if (!year || rawDate && rawDate.slice(0, 4) !== year) continue;
    if (format === 'YYYYMMMMDD' && date) timings.push(resolveReleaseTiming(date));
    if (format === 'YYYYMMMM' && month) timings.push({ precision: 'month', value: `${year}-${month}` });
    if (format === 'YYYY') timings.push({ precision: 'year', value: year });
    if (format && /^YYYYQ[1-4]$/.test(format)) timings.push({ precision: 'quarter', value: `${year}-${format.slice(-2)}` });
  }
  const supported = timings.filter(timing => timing.precision !== 'tba');
  if (!supported.length) return timings.find(timing => timing.precision === 'tba');
  const exact = supported.find(timing => timing.precision === 'day' && timing.value === rawDate?.slice(0, 10));
  if (exact) return exact;
  const year = supported.find(timing => timing.precision === 'year');
  if (year) return year;
  const distinct = new Map(supported.map(timing => [timing.value, timing]));
  if (distinct.size === 1) return distinct.values().next().value;
  const months = new Set(supported.filter(timing => timing.precision === 'day' || timing.precision === 'month').map(timing => timing.value.slice(0, 7)));
  if (months.size === 1 && supported.every(timing => timing.precision === 'day' || timing.precision === 'month')) {
    return { precision: 'month', value: [...months][0] };
  }
}

// Chronological sorts compare the start of each supported release window.
// Dates that are still unknown always follow entries with timing evidence.
export function compareUpcomingTiming(left: ReleaseTiming, right: ReleaseTiming, newest: boolean): number {
  const key = (timing: Exclude<ReleaseTiming, { precision: 'tba' }>) => {
    if (timing.precision === 'day') return timing.value;
    if (timing.precision === 'month') return timing.value + '-01';
    const year = timing.value.slice(0, 4);
    const month = timing.precision === 'quarter' ? (Number(timing.value.at(-1)) - 1) * 3 + 1 : 1;
    return year + '-' + String(month).padStart(2, '0') + '-01';
  };
  if (left.precision === 'tba') return right.precision === 'tba' ? 0 : 1;
  if (right.precision === 'tba') return -1;
  return (newest ? -1 : 1) * key(left).localeCompare(key(right));
}
