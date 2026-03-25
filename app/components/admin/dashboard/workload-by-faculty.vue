<script setup lang="ts">
defineOptions({
  tags: ['barcharts', 'stackedhorizontal'],
});

const props = withDefaults(defineProps<{
  period: string;
  startDate?: string;
  endDate?: string;
  facultyId?: number;
  refreshToken?: number;
}>(), {
  refreshToken: 0,
});

type FacultyWorkloadItem = {
  faculty: string;
  completed: number;
  pending: number;
};

type WorkloadRow = {
  facultyId: number;
  facultyNameEn: string;
  facultyNameTh: string;
  completed: number;
  pending: number;
  rejected: number;
  total: number;
};

const { locale } = useI18n();

const query = computed(() => ({
  period: props.period,
  ...(props.startDate ? { startDate: props.startDate } : {}),
  ...(props.endDate ? { endDate: props.endDate } : {}),
  ...(props.facultyId ? { facultyId: props.facultyId } : {}),
}));

const { data, status, refresh } = useFetch<{ success: boolean; data: WorkloadRow[] }>('/api/admin/dashboard/workload-by-faculty', {
  query,
  watch: [query],
});

const workloadRows = computed<WorkloadRow[]>(() => data.value?.data ?? []);

const shouldShowEmptyState = computed(() => {
  if (!workloadRows.value.length)
    return true;

  return workloadRows.value.every(row => row.completed === 0 && row.pending === 0 && row.rejected === 0 && row.total === 0);
});

const chartData = computed<FacultyWorkloadItem[]>(() => {
  const rows = workloadRows.value;
  return rows.map(row => ({
    faculty: locale.value === 'th' ? row.facultyNameTh : row.facultyNameEn,
    completed: row.completed,
    pending: row.pending,
  }));
});

watch(() => props.refreshToken, () => {
  refresh();
});

const categories = {
  completed: { name: 'Completed', color: '#3b82f6' },
  pending: { name: 'Pending', color: '#dbeafe' },
};

function yFormatter(tick: number, _i?: number, _ticks?: number[]) {
  return `${chartData.value[tick]?.faculty ?? ''}`;
}
</script>

<template>
  <UCard>
    <div
      class="mx-auto max-w-3xl space-y-6 rounded-lg"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          Workload by Faculty
        </h3>
      </div>
      <div v-if="status === 'pending'" class="h-75 flex items-center justify-center">
        <UIcon name="i-lucide-loader" class="size-6 animate-spin text-text-secondary" />
      </div>
      <div v-else-if="shouldShowEmptyState" class="h-75 flex items-center justify-center text-sm text-text-secondary">
        No workload data for selected filters.
      </div>
      <BarChart
        v-else
        :data="chartData"
        :stacked="true"
        :height="300"
        :categories="categories"
        :y-axis="['completed', 'pending']"
        :group-padding="0"
        :bar-padding="0.2"
        :x-num-ticks="6"
        :radius="4"
        :orientation="Orientation.Horizontal"
        :y-formatter="yFormatter"
        :legend-position="LegendPosition.TopRight"
        :hide-legend="false"
        :y-grid-line="true"
      />
    </div>
  </UCard>
</template>
