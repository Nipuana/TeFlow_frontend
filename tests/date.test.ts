import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dateInputToIso, isoToDateInput, shortDate, dueInfo } from '@/lib/date';

describe('dateInputToIso', () => {
  it('converts a yyyy-mm-dd value to UTC-midnight ISO', () => {
    expect(dateInputToIso('2026-07-15')).toBe('2026-07-15T00:00:00.000Z');
  });
  it('returns null for empty or invalid input', () => {
    expect(dateInputToIso('')).toBeNull();
    expect(dateInputToIso('not-a-date')).toBeNull();
  });
});

describe('isoToDateInput', () => {
  it('extracts the yyyy-mm-dd portion', () => {
    expect(isoToDateInput('2026-07-15T00:00:00.000Z')).toBe('2026-07-15');
  });
  it('returns an empty string for null/undefined', () => {
    expect(isoToDateInput(null)).toBe('');
    expect(isoToDateInput(undefined)).toBe('');
  });
});

describe('shortDate', () => {
  it('formats a compact month/day label', () => {
    expect(shortDate('2026-07-15T00:00:00.000Z')).toBe('Jul 15');
  });
  it('returns an em dash when unset or invalid', () => {
    expect(shortDate(null)).toBe('—');
    expect(shortDate('nonsense')).toBe('—');
  });
});

describe('dueInfo (relative to "now")', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to 2026-07-10T12:00Z. The runner's TZ is UTC (see vitest config).
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('labels a same-day due date as "due today" and flags it soon', () => {
    const info = dueInfo('2026-07-10T00:00:00.000Z');
    expect(info).toMatchObject({ label: 'due today', overdue: false, soon: true });
  });

  it('labels the next day as "due tomorrow"', () => {
    expect(dueInfo('2026-07-11T00:00:00.000Z')?.label).toBe('due tomorrow');
  });

  it('labels a far-future date as "due in Nd" and not soon', () => {
    expect(dueInfo('2026-07-20T00:00:00.000Z')).toMatchObject({ label: 'due in 10d', soon: false });
  });

  it('flags a past date as overdue', () => {
    expect(dueInfo('2026-07-09T00:00:00.000Z')).toMatchObject({ label: '1d overdue', overdue: true });
    expect(dueInfo('2026-07-05T00:00:00.000Z')?.label).toBe('5d overdue');
  });

  it('never marks a completed task as overdue', () => {
    expect(dueInfo('2026-07-01T00:00:00.000Z', true)).toMatchObject({ overdue: false });
  });

  it('returns null when there is no due date', () => {
    expect(dueInfo(null)).toBeNull();
  });
});
