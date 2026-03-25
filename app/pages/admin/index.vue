<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date';

defineOptions({
  tags: ['barcharts', 'stacked'],
});

definePageMeta({
  title: 'adminDashboard',
  middleware: ['permission'],
  permission: 'dashboard.admin.view',
});

const { locale } = useI18n();

const selectedFacultyId = ref<number | 'all'>('all');

const { data: facultyResponse } = await useFetch('/api/admin/faculties', {
  query: {
    pageSize: 100,
  },
});

const facultyOptions = computed(() => {
  const rows = facultyResponse.value?.rows ?? [];
  const options = rows.map((faculty: { id: number; nameEn: string; nameTh: string }) => ({
    label: locale.value === 'th' ? faculty.nameTh : faculty.nameEn,
    value: faculty.id,
  }));

  return [{ label: 'All Faculties', value: 'all' as const }, ...options];
});

const selectedPeriod = ref('Last 30 days');
const periodOptions = [
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
];

const selectedFacultyFilterId = computed(() => selectedFacultyId.value === 'all' ? undefined : selectedFacultyId.value);

type DateRangeValue = {
  start: CalendarDate;
  end: CalendarDate;
};

const DASHBOARD_DATE_FILTER_STORAGE_KEY = 'admin-dashboard-date-filter';

type StoredDateRange = {
  period: string;
  start: string;
  end: string;
};

const periodOptionSet = new Set(periodOptions);

function toStorageDateString(value: CalendarDate) {
  const month = `${value.month}`.padStart(2, '0');
  const day = `${value.day}`.padStart(2, '0');
  return `${value.year}-${month}-${day}`;
}

function parseStorageDateString(value: string) {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day))
    return null;

  if (month < 1 || month > 12 || day < 1 || day > 31)
    return null;

  return new CalendarDate(year, month, day);
}

function getStoredDateFilter() {
  if (!import.meta.client)
    return null;

  const rawValue = localStorage.getItem(DASHBOARD_DATE_FILTER_STORAGE_KEY);
  if (!rawValue)
    return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredDateRange>;
    if (!parsed.start || !parsed.end)
      return null;

    const start = parseStorageDateString(parsed.start);
    const end = parseStorageDateString(parsed.end);

    if (!start || !end)
      return null;

    const period = typeof parsed.period === 'string' && periodOptionSet.has(parsed.period)
      ? parsed.period
      : 'Custom';

    return {
      period,
      range: {
        start,
        end,
      } as DateRangeValue,
    };
  }
  catch {
    localStorage.removeItem(DASHBOARD_DATE_FILTER_STORAGE_KEY);
    return null;
  }
}

function toCalendarDate(date: Date) {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function toIsoRangeFromCalendar(start: CalendarDate, end?: CalendarDate) {
  const resolvedEnd = end ?? start;

  const startDate = start.toDate(getLocalTimeZone());
  startDate.setHours(0, 0, 0, 0);

  const endDate = resolvedEnd.toDate(getLocalTimeZone());
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

function resolvePresetDateRange(period: string): DateRangeValue {
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
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + mondayOffset);
      break;
    }
    case 'Last week': {
      const day = start.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + mondayOffset - 7);
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
      const quarterStartMonth = now.getMonth() - (now.getMonth() % 3);
      start = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
      break;
    }
    case 'Last quarter': {
      const thisQuarterStartMonth = now.getMonth() - (now.getMonth() % 3);
      const lastQuarterStart = new Date(now.getFullYear(), thisQuarterStartMonth - 3, 1, 0, 0, 0, 0);
      start = lastQuarterStart;
      end.setFullYear(lastQuarterStart.getFullYear(), lastQuarterStart.getMonth() + 3, 0);
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

  return {
    start: toCalendarDate(start),
    end: toCalendarDate(end),
  };
}

const modelValue = shallowRef<DateRangeValue>(resolvePresetDateRange(selectedPeriod.value));
const syncingFromPeriod = ref(false);

const storedDateFilter = getStoredDateFilter();
if (storedDateFilter) {
  selectedPeriod.value = storedDateFilter.period;
  modelValue.value = storedDateFilter.range;
}

type CustomDateRangeQuery = {
  startDate?: string;
  endDate?: string;
};

const customDateRangeQuery = computed<CustomDateRangeQuery>(() => {
  if (selectedPeriod.value !== 'Custom')
    return {};

  if (!modelValue.value.start)
    return {};

  return toIsoRangeFromCalendar(modelValue.value.start, modelValue.value.end);
});

const summaryQuery = computed(() => ({
  period: selectedPeriod.value,
  ...customDateRangeQuery.value,
  ...(selectedFacultyFilterId.value ? { facultyId: selectedFacultyFilterId.value } : {}),
}));

const { data: summaryResponse, status: summaryStatus, refresh: refreshSummary } = useFetch('/api/admin/dashboard/summary', {
  query: summaryQuery,
  watch: [summaryQuery],
});

const summary = computed(() => summaryResponse.value?.data ?? null);

function formatMedianTurnaround(hoursValue: number) {
  if (!Number.isFinite(hoursValue) || hoursValue <= 0)
    return '0m';

  const totalMinutes = Math.round(hoursValue * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  const parts: string[] = [];

  if (days > 0)
    parts.push(`${days}d`);
  if (hours > 0)
    parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0)
    parts.push(`${minutes}m`);

  return parts.join(' ');
}

const summaryCards = computed(() => {
  const data = summary.value;
  if (!data) {
    return {
      totalRequests: '-',
      completedRequests: '-',
      completionRate: '-',
      medianTurnaround: '-',
      rejectedRequests: '-',
      activeUsers: '-',
    };
  }

  return {
    totalRequests: Number(data.totalRequests ?? 0).toLocaleString(),
    completedRequests: Number(data.completedRequests ?? 0).toLocaleString(),
    completionRate: `${Number(data.completionRate ?? 0).toFixed(1)}%`,
    medianTurnaround: formatMedianTurnaround(Number(data.medianTurnaroundHours ?? 0)),
    rejectedRequests: Number(data.rejectedRequests ?? 0).toLocaleString(),
    activeUsers: Number(data.activeUsers ?? 0).toLocaleString(),
  };
});

const autoRefresh = ref(false);
const selectedAutoRefresh = ref(15000);
const refreshTick = ref(0);
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();

  if (!autoRefresh.value)
    return;

  autoRefreshTimer = setInterval(() => {
    refreshTick.value += 1;
    refreshSummary();
  }, selectedAutoRefresh.value);
}

watch([autoRefresh, selectedAutoRefresh], () => {
  if (import.meta.client)
    startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});
const autoRefreshOptions = computed<DropdownMenuItem[]>(() => ([
  {
    label: '15s',
    type: 'checkbox',
    checked: selectedAutoRefresh.value === 15000,
    onUpdateChecked: (checked: boolean) => {
      if (checked)
        selectedAutoRefresh.value = 15000;
    },
  },
  {
    label: '30s',
    type: 'checkbox',
    checked: selectedAutoRefresh.value === 30000,
    onUpdateChecked: (checked: boolean) => {
      if (checked)
        selectedAutoRefresh.value = 30000;
    },
  },
  {
    label: '1m',
    type: 'checkbox',
    checked: selectedAutoRefresh.value === 60000,
    onUpdateChecked: (checked: boolean) => {
      if (checked)
        selectedAutoRefresh.value = 60000;
    },
  },
]));

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
});

watch(selectedPeriod, (period) => {
  if (period === 'Custom')
    return;

  syncingFromPeriod.value = true;
  modelValue.value = resolvePresetDateRange(period);
  nextTick(() => {
    syncingFromPeriod.value = false;
  });
});

watch(modelValue, (value) => {
  if (syncingFromPeriod.value)
    return;

  if (value?.start)
    selectedPeriod.value = 'Custom';
}, { deep: true });

watch([modelValue, selectedPeriod], ([range, period]) => {
  if (!import.meta.client)
    return;

  if (!range?.start)
    return;

  const payload: StoredDateRange = {
    period,
    start: toStorageDateString(range.start),
    end: toStorageDateString(range.end ?? range.start),
  };

  localStorage.setItem(DASHBOARD_DATE_FILTER_STORAGE_KEY, JSON.stringify(payload));
}, { deep: true });
</script>

<template>
  <div>
    <div class="flex flex-col justify-center lg:flex-row lg:items-center lg:justify-between mb-8 gap-6">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-text-main mb-2">
          Academic Oversight Dashboard
        </h2>
        <p class="text-text-secondary">
          Monitoring real-time request flow and signature bottlenecks across departments.
        </p>
      </div>
      <div class="self-end lg:self-auto flex gap-3">
        <USelect
          v-model="selectedFacultyId"
          icon="i-lucide-building"
          :items="facultyOptions"
          label-key="label"
          value-key="value"
          :ui="{
            content: 'min-w-fit',
          }"
        />
        <UFieldGroup>
          <USelect
            v-model="selectedPeriod"
            icon="i-lucide-calendar"
            :items="periodOptions"
            :ui="{
              content: 'min-w-fit',
            }"
          />
          <UPopover>
            <UButton color="neutral" variant="outline">
              <template v-if="modelValue.start">
                <template v-if="modelValue.end">
                  {{ df.format(modelValue.start.toDate(getLocalTimeZone())) }} - {{ df.format(modelValue.end.toDate(getLocalTimeZone())) }}
                </template>

                <template v-else>
                  {{ df.format(modelValue.start.toDate(getLocalTimeZone())) }}
                </template>
              </template>
              <template v-else>
                Pick a date
              </template>
            </UButton>

            <template #content>
              <UCalendar v-model="modelValue" class="p-2" :number-of-months="2" range />
            </template>
          </UPopover>
        </UFieldGroup>
        <UFieldGroup>
          <UTooltip :delay-duration="200" text="Auto Refresh">
            <UButton
              leading-icon="i-lucide-refresh-ccw" :color="autoRefresh ? 'primary' : 'neutral'" variant="subtle" :ui="{
                leadingIcon: autoRefresh ? 'animate-spin' : '',
              }" @click="autoRefresh = !autoRefresh"
            />
          </UTooltip>
          <UDropdownMenu
            arrow
            :items="autoRefreshOptions"
            :content="{
              align: 'end',
              side: 'bottom' }"
          >
            <UButton color="neutral" variant="outline" icon="i-lucide-chevron-down" />
          </UDropdownMenu>
        </UFieldGroup>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Total Requests
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            {{ summaryCards.totalRequests }}
          </h3>
          <!-- <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 12% </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Completed Requests
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            {{ summaryCards.completedRequests }} <span class="text-sm ">({{ summaryCards.completionRate }})</span>
          </h3>
          <!-- <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 2.5%
          </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Median Turnaround
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            {{ summaryCards.medianTurnaround }}
          </h3>
          <!-- <span class="text-warning text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-arrow-right" class="mr-1" /> 0.0
          </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-error uppercase tracking-wider mb-1">
          Rejected Requests
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-error">
            {{ summaryCards.rejectedRequests }}
          </h3>
          <!-- <span class="text-error text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-alert-triangle" class="mr-1" /> Urgent
          </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Active Users
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            {{ summaryCards.activeUsers }}
          </h3>
          <!-- <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 8%
          </span> -->
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- Request Trends -->
      <AdminDashboardRequestTrend
        class="lg:col-span-2"
        :period="selectedPeriod"
        :start-date="customDateRangeQuery.startDate"
        :end-date="customDateRangeQuery.endDate"
        :faculty-id="selectedFacultyFilterId"
        :refresh-token="refreshTick"
      />

      <!-- Signature Bottlenecks -->
      <AdminDashboardSignatureBottlenecks
        :period="selectedPeriod"
        :start-date="customDateRangeQuery.startDate"
        :end-date="customDateRangeQuery.endDate"
        :faculty-id="selectedFacultyFilterId"
        :refresh-token="refreshTick"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Workload by Faculty -->
      <AdminDashboardWorkloadByFaculty
        :period="selectedPeriod"
        :start-date="customDateRangeQuery.startDate"
        :end-date="customDateRangeQuery.endDate"
        :faculty-id="selectedFacultyFilterId"
        :refresh-token="refreshTick"
      />

      <!-- Top Request Templates -->
      <AdminDashboardTopRequestTemplates
        :period="selectedPeriod"
        :start-date="customDateRangeQuery.startDate"
        :end-date="customDateRangeQuery.endDate"
        :faculty-id="selectedFacultyFilterId"
        :refresh-token="refreshTick"
      />
    </div>
    <p v-if="summaryStatus === 'pending'" class="mt-4 text-xs text-text-secondary">
      Updating dashboard metrics...
    </p>
  </div>
</template>
