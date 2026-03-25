export const DASHBOARD_PERIOD_OPTIONS = [
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last 14 days',
  'Last 30 days',
  'This week',
  'Last week',
  'This month',
  'Last month',
  'This quarter',
  'Last quarter',
  'Year to date (YTD)',
  'Last 12 months',
  'Custom',
] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIOD_OPTIONS)[number];

export type DashboardPeriodRange = {
  startDate: string;
  endDate: string;
  bucket: 'day' | 'week' | 'month';
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + mondayOffset);
  return result;
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfQuarter(date: Date) {
  const month = date.getMonth();
  const quarterStartMonth = month - (month % 3);
  return new Date(date.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
}

function endOfQuarter(date: Date) {
  const start = startOfQuarter(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999);
}

function toIsoRange(start: Date, end: Date, bucket: 'day' | 'week' | 'month'): DashboardPeriodRange {
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    bucket,
  };
}

export function resolveDashboardPeriodRange(period: string | undefined): DashboardPeriodRange {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  switch (period) {
    case 'Today':
      return toIsoRange(todayStart, todayEnd, 'day');

    case 'Yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return toIsoRange(startOfDay(yesterday), endOfDay(yesterday), 'day');
    }

    case 'Last 7 days': {
      const start = startOfDay(new Date(now));
      start.setDate(start.getDate() - 6);
      return toIsoRange(start, todayEnd, 'day');
    }

    case 'Last 14 days': {
      const start = startOfDay(new Date(now));
      start.setDate(start.getDate() - 13);
      return toIsoRange(start, todayEnd, 'day');
    }

    case 'This week':
      return toIsoRange(startOfWeek(now), todayEnd, 'day');

    case 'Last week': {
      const base = new Date(now);
      base.setDate(base.getDate() - 7);
      return toIsoRange(startOfWeek(base), endOfWeek(base), 'day');
    }

    case 'This month':
      return toIsoRange(startOfMonth(now), todayEnd, 'day');

    case 'Last month': {
      const base = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return toIsoRange(startOfMonth(base), endOfMonth(base), 'day');
    }

    case 'This quarter':
      return toIsoRange(startOfQuarter(now), todayEnd, 'week');

    case 'Last quarter': {
      const currentQuarterStart = startOfQuarter(now);
      const base = new Date(currentQuarterStart);
      base.setMonth(base.getMonth() - 1);
      return toIsoRange(startOfQuarter(base), endOfQuarter(base), 'week');
    }

    case 'Year to date (YTD)': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return toIsoRange(start, todayEnd, 'month');
    }

    case 'Last 12 months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
      return toIsoRange(start, todayEnd, 'month');
    }

    case 'Last 30 days':
    default: {
      const start = startOfDay(new Date(now));
      start.setDate(start.getDate() - 29);
      return toIsoRange(start, todayEnd, 'day');
    }
  }
}

function parseDateParam(value: string | undefined) {
  if (!value)
    return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return null;

  return date;
}

function resolveBucketByRangeDays(start: Date, end: Date): 'day' | 'week' | 'month' {
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 120)
    return 'month';

  if (diffDays > 45)
    return 'week';

  return 'day';
}

export function resolveDashboardRange(
  period: string | undefined,
  startDateParam?: string,
  endDateParam?: string,
): DashboardPeriodRange {
  const startDate = parseDateParam(startDateParam);
  const endDate = parseDateParam(endDateParam);

  if (startDate && endDate) {
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      bucket: resolveBucketByRangeDays(startDate, endDate),
    };
  }

  return resolveDashboardPeriodRange(period);
}
