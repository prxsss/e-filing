<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

import { DateFormatter, getLocalTimeZone } from '@internationalized/date';

import { PERIOD_OPTIONS, useRequestFiltersStore } from '~/stores/request-filters';

defineOptions({
  tags: ['barcharts', 'stacked'],
});

definePageMeta({
  title: 'dashboard',
  middleware: ['permission'],
  permission: 'dashboard.admin.view',
});

const { locale, t } = useI18n();

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

  return [{ label: t('common.allFaculties'), value: 'all' as const }, ...options];
});

const selectedFacultyFilterId = computed(() => selectedFacultyId.value === 'all' ? undefined : selectedFacultyId.value);

// === Shared Date Filter (Pinia) ===
const filterStore = useRequestFiltersStore();
const { selectedPeriod, modelValue, dateRangeQuery } = storeToRefs(filterStore);

type DateRangeQuery = { startDate?: string; endDate?: string };

const customDateRangeQuery = computed<DateRangeQuery>(() =>
  selectedPeriod.value === 'Custom' ? dateRangeQuery.value : {},
);

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
</script>

<template>
  <div>
    <div class="flex flex-col justify-center lg:flex-row lg:items-center lg:justify-between mb-8 gap-6">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-text-main mb-2">
          {{ $t('adminDashboard.title') }}
        </h2>
        <p class="text-text-secondary">
          {{ $t('adminDashboard.description') }}
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
            :items="[...PERIOD_OPTIONS]"
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
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          {{ $t('adminDashboard.stats.totalRequests') }}
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
          {{ $t('adminDashboard.stats.completedRequests') }}
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
          {{ $t('adminDashboard.stats.medianTurnaround') }}
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
          {{ $t('adminDashboard.stats.rejectedRequests') }}
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

      <!-- <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          {{ $t('adminDashboard.activeUsers') }}
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            {{ summaryCards.activeUsers }}
          </h3>
          <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 8%
          </span>
        </div>
      </UCard> -->
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
