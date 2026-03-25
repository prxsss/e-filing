<script setup lang="ts">
defineOptions({
  tags: ['linecharts', 'multilines'],
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

type TrendRow = {
  bucket: string;
  submissions: number;
  completions: number;
};

const query = computed(() => ({
  period: props.period,
  ...(props.startDate ? { startDate: props.startDate } : {}),
  ...(props.endDate ? { endDate: props.endDate } : {}),
  ...(props.facultyId ? { facultyId: props.facultyId } : {}),
}));

const { data, status, refresh } = useFetch<{ success: boolean; data: TrendRow[] }>('/api/admin/dashboard/trends', {
  query,
  watch: [query],
});

const chartData = computed(() => {
  const rows = data.value?.data ?? [];
  return rows.map((row) => {
    const date = new Date(row.bucket);
    return {
      label: Number.isNaN(date.getTime())
        ? row.bucket
        : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date),
      submissions: row.submissions,
      completions: row.completions,
    };
  });
});

watch(() => props.refreshToken, () => {
  refresh();
});

const categories: Record<string, BulletLegendItemInterface> = {
  submissions: { name: 'Submissions', color: '#3b82f6' },
  completions: { name: 'Completions', color: '#22c55e' },
};

function xFormatter(tick: number, _i?: number, _ticks?: number[]): string {
  return chartData.value[tick]?.label ?? '';
}
</script>

<template>
  <UCard>
    <div
      class="mx-auto max-w-3xl space-y-6 rounded-lg"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          Request Trends
        </h3>
      </div>
      <div v-if="status === 'pending'" class="h-75 flex items-center justify-center">
        <UIcon name="i-lucide-loader" class="size-6 animate-spin text-text-secondary" />
      </div>
      <div v-else-if="!chartData.length" class="h-75 flex items-center justify-center text-sm text-text-secondary">
        No trend data for selected filters.
      </div>
      <LineChart
        v-else
        :data="chartData"
        :height="300"
        y-label="Number of Requests"
        :x-num-ticks="2"
        :categories="categories"
        :x-formatter="xFormatter"
        :y-grid-line="true"
        :curve-type="CurveType.MonotoneX"
        :legend-position="LegendPosition.TopRight"
        :hide-legend="false"
      />
    </div>
  </UCard>
</template>
