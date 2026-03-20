import { CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { defineStore } from 'pinia';

// ─── Types ────────────────────────────────────────────────────────────────────

// Plain POJO — safe to store in Pinia (SSR-serialisable by devalue)
export type PlainDateRange = {
  start: { year: number; month: number; day: number };
  end: { year: number; month: number; day: number };
};

// CalendarDate-based type — only used in templates / UCalendar v-model
export type DateRangeValue = {
  start: CalendarDate;
  end: CalendarDate;
};

type StoredDateRange = {
  period: string;
  start: string;
  end: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const PERIOD_OPTIONS = [
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

export type PeriodOption = (typeof PERIOD_OPTIONS)[number];

const STORAGE_KEY = 'request-filters-date';
const DEFAULT_PERIOD: PeriodOption = 'This month';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPlainDate(date: Date): PlainDateRange['start'] {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function toCalendarDate(plain: PlainDateRange['start']): CalendarDate {
  return new CalendarDate(plain.year, plain.month, plain.day);
}

function isoFromPlain(plain: PlainDateRange['start'], endOfDay = false): string {
  const d = new CalendarDate(plain.year, plain.month, plain.day).toDate(getLocalTimeZone());
  endOfDay ? d.setHours(23, 59, 59, 999) : d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function resolvePresetDateRange(period: string): PlainDateRange {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'Today':
      break;
    case 'Yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'Last 7 days':
      start.setDate(start.getDate() - 6);
      break;
    case 'Last 14 days':
      start.setDate(start.getDate() - 13);
      break;
    case 'This week': {
      const day = start.getDay();
      start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
      break;
    }
    case 'Last week': {
      const day = start.getDay();
      start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day) - 7);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'This month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    case 'Last month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'This quarter': {
      const qStart = now.getMonth() - (now.getMonth() % 3);
      start = new Date(now.getFullYear(), qStart, 1, 0, 0, 0, 0);
      break;
    }
    case 'Last quarter': {
      const thisQStart = now.getMonth() - (now.getMonth() % 3);
      start = new Date(now.getFullYear(), thisQStart - 3, 1, 0, 0, 0, 0);
      end.setFullYear(start.getFullYear(), start.getMonth() + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'Year to date (YTD)':
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    case 'Last 12 months':
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
      break;
    case 'Last 30 days':
    default:
      start.setDate(start.getDate() - 29);
      break;
  }

  return { start: toPlainDate(start), end: toPlainDate(end) };
}

function toStorageDateString(plain: PlainDateRange['start']): string {
  return `${plain.year}-${String(plain.month).padStart(2, '0')}-${String(plain.day).padStart(2, '0')}`;
}

function parseStorageDateString(value: string): PlainDateRange['start'] | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d)
    return null;
  if (m < 1 || m > 12 || d < 1 || d > 31)
    return null;
  return { year: y, month: m, day: d };
}

const periodOptionSet = new Set<string>(PERIOD_OPTIONS);

function loadFromStorage(): { period: string; range: PlainDateRange } | null {
  if (!import.meta.client)
    return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return null;
    const parsed = JSON.parse(raw) as Partial<StoredDateRange>;
    if (!parsed.start || !parsed.end)
      return null;
    const start = parseStorageDateString(parsed.start);
    const end = parseStorageDateString(parsed.end);
    if (!start || !end)
      return null;
    const period = typeof parsed.period === 'string' && periodOptionSet.has(parsed.period)
      ? parsed.period
      : 'Custom';
    return { period, range: { start, end } };
  }
  catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRequestFiltersStore = defineStore('requestFilters', () => {
  const stored = loadFromStorage();

  const selectedPeriod = ref<PeriodOption>(stored?.period as PeriodOption ?? DEFAULT_PERIOD);

  // ✅ Plain POJO — safe for SSR/devalue serialisation, no CalendarDate in state
  const plainRange = ref<PlainDateRange>(
    stored?.range ?? resolvePresetDateRange(DEFAULT_PERIOD),
  );

  // ✅ CalendarDate instances — derived computed, never held in Pinia state
  // Used as v-model on UCalendar in templates
  const modelValue = computed<DateRangeValue>({
    get: () => ({
      start: toCalendarDate(plainRange.value.start),
      end: toCalendarDate(plainRange.value.end),
    }),
    set: (val: DateRangeValue) => {
      plainRange.value = {
        start: { year: val.start.year, month: val.start.month, day: val.start.day },
        end: { year: val.end.year, month: val.end.month, day: val.end.day },
      };
    },
  });

  // Guard to stop the period→range and range→'Custom' watches from looping
  const syncingFromPeriod = ref(false);

  // ISO startDate/endDate — spread directly into useFetch query params
  const dateRangeQuery = computed(() => ({
    startDate: isoFromPlain(plainRange.value.start, false),
    endDate: isoFromPlain(plainRange.value.end, true),
  }));

  // When a preset is chosen, resolve its plain date range
  watch(selectedPeriod, (period: PeriodOption) => {
    if (period === 'Custom')
      return;
    syncingFromPeriod.value = true;
    plainRange.value = resolvePresetDateRange(period);
    nextTick(() => {
      syncingFromPeriod.value = false;
    });
  });

  // When the calendar range is changed manually, switch period to 'Custom'
  watch(plainRange, () => {
    if (syncingFromPeriod.value)
      return;
    selectedPeriod.value = 'Custom';
  }, { deep: true });

  // Persist to localStorage whenever period or range changes
  watch([plainRange, selectedPeriod], ([range, period]) => {
    if (!import.meta.client)
      return;
    const payload: StoredDateRange = {
      period,
      start: toStorageDateString(range.start),
      end: toStorageDateString(range.end),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, { deep: true });

  function setPeriod(period: PeriodOption) {
    selectedPeriod.value = period;
  }

  function setRange(range: DateRangeValue) {
    modelValue.value = range;
  }

  function resetDateFilter() {
    selectedPeriod.value = DEFAULT_PERIOD;
    plainRange.value = resolvePresetDateRange(DEFAULT_PERIOD);
  }

  return {
    selectedPeriod,
    modelValue, // computed writable — CalendarDate instances, for UCalendar v-model
    dateRangeQuery, // plain ISO strings, for useFetch query params
    setPeriod,
    setRange,
    resetDateFilter,
  };
});
