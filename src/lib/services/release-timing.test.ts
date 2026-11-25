import { describe, expect, it } from 'vitest';
import { getReviewedReleaseTiming, selectIgdbTiming } from './release-timing';
import { formatReleaseTiming, releaseTimingMonth, resolveReleaseTiming } from '@/lib/utils/release-timing';

const fromDate = (day: string, format: string, status?: string) => ({
  date: Date.parse(day + 'T00:00:00Z') / 1000,
  date_format: { format },
  status: { name: status },
});

describe('release date precision', () => {
  it('uses the newer Catalyst year without accepting stale precision or changing Legacy of Atlantis', () => {
    const oldDay = { precision: 'day', value: '2027-12-31' } as const;
    const catalyst = getReviewedReleaseTiming(1015411, oldDay.value, oldDay);
    expect(catalyst).toEqual({ precision: 'year', value: '2028' });
    expect(releaseTimingMonth(catalyst!)).toBeUndefined();
    expect(getReviewedReleaseTiming(1015421, null)).toEqual({ precision: 'month', value: '2027-02' });
    expect(getReviewedReleaseTiming(1015421, oldDay.value, oldDay)).toBe(oldDay);
  });
  it.each(['Clockwork Revolution', 'Kena: Scars of Kosmora', 'Resident Evil Veronica'])(
    'does not turn the year placeholder for %s into December 31',
    () => {
      const rawDate = '2027-12-31';
      const timing = resolveReleaseTiming(rawDate, { upcoming: true });
      expect(formatReleaseTiming(timing)).toBe('2027');
      expect(releaseTimingMonth(timing)).toBeUndefined();
      expect(rawDate).toBe('2027-12-31');
    },
  );

  it.each(['2027-12-31', '2027-01-01', '2028-02-29'])('preserves a source-confirmed exact boundary date %s', date => {
    const evidence = selectIgdbTiming([fromDate(date, 'YYYYMMMMDD')], date);
    expect(resolveReleaseTiming(date, { upcoming: true, evidence })).toEqual({ precision: 'day', value: date });
    expect(resolveReleaseTiming(date)).toEqual({ precision: 'day', value: date });
  });

  it('keeps the correct month for a month-only window and does not assign a day', () => {
    const timing = resolveReleaseTiming('2028-02-29', { upcoming: true });
    expect(formatReleaseTiming(timing)).toBe('Feb 2028');
    expect(releaseTimingMonth(timing)).toBe('2028-02');
    expect(selectIgdbTiming([fromDate('2028-02-01', 'YYYYMMMM')], '2028-02-29')).toEqual(timing);
  });

  it('uses the date-format quarter instead of the placeholder month', () => {
    const date = '2027-12-31';
    const evidence = selectIgdbTiming([fromDate(date, 'YYYYQ4')], date);
    const timing = resolveReleaseTiming(date, { upcoming: true, evidence });
    expect(formatReleaseTiming(timing)).toBe('Q4 2027');
    expect(releaseTimingMonth(timing)).toBeUndefined();
  });

  it('keeps TBA and ignores Early Access dates when choosing a full launch window', () => {
    const evidence = selectIgdbTiming([fromDate('2027-02-12', 'YYYYMMMMDD', 'Early Access'),
      { date_format: { format: 'TBD' } }], '2027-02-12');
    expect(formatReleaseTiming(resolveReleaseTiming('2027-02-12', { upcoming: true, evidence }))).toBe('TBA');
    expect(resolveReleaseTiming('2027-02-31')).toEqual({ precision: 'tba' });
    expect(resolveReleaseTiming(null, { tba: true })).toEqual({ precision: 'tba' });
  });
});
