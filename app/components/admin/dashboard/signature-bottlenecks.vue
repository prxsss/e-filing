<script setup lang="ts">
const props = withDefaults(defineProps<{
  period: string;
  startDate?: string;
  endDate?: string;
  facultyId?: number;
  refreshToken?: number;
}>(), {
  refreshToken: 0,
});

type BottleneckRow = {
  roleName: string;
  roleNameTh: string;
  pendingCount: number;
  avgWaitingHours: number;
};

const { t, locale } = useI18n();

const topLimit = ref<'5' | '10' | 'all'>('5');
const topLimitOptions = computed(() => ([
  { label: t('adminDashboard.signatureBottlenecks.topLimitOptions.top5'), value: '5' },
  { label: t('adminDashboard.signatureBottlenecks.topLimitOptions.top10'), value: '10' },
  { label: t('adminDashboard.signatureBottlenecks.topLimitOptions.all'), value: 'all' },
]));

const query = computed(() => ({
  period: props.period,
  limit: topLimit.value,
  ...(props.startDate ? { startDate: props.startDate } : {}),
  ...(props.endDate ? { endDate: props.endDate } : {}),
  ...(props.facultyId ? { facultyId: props.facultyId } : {}),
}));

const { data, status, refresh } = useFetch<{ success: boolean; data: BottleneckRow[] }>('/api/admin/dashboard/signature-bottlenecks', {
  query,
  watch: [query],
});

function formatLocalizedNumber(value: number): string {
  return value.toLocaleString(locale.value === 'th' ? 'th-TH' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatAvgWaitingLabel(avgWaitingHours: number): string {
  if (avgWaitingHours < 24) {
    return t('adminDashboard.signatureBottlenecks.avgHours', {
      value: formatLocalizedNumber(avgWaitingHours),
    });
  }

  return t('adminDashboard.signatureBottlenecks.avgDays', {
    value: formatLocalizedNumber(avgWaitingHours / 24),
  });
}

const items = computed(() => {
  return (data.value?.data ?? []).map(item => ({
    name: item.roleName,
    nameTh: item.roleNameTh,
    value: Math.min(5, Number((item.avgWaitingHours / 24).toFixed(2))),
    avg: formatAvgWaitingLabel(item.avgWaitingHours),
    pendingCount: item.pendingCount,
  }));
});

watch(() => props.refreshToken, () => {
  refresh();
});

function getColor(value: number) {
  if (value <= 2)
    return 'success';
  if (value <= 4)
    return 'warning';
  return 'error';
}
</script>

<template>
  <UCard>
    <div class="mb-6 flex items-center justify-between gap-3">
      <h3 class="font-bold text-text-main">
        {{ $t('adminDashboard.signatureBottlenecks.title') }}
      </h3>
      <USelect
        v-model="topLimit"
        size="sm"
        :items="topLimitOptions"
        label-key="label"
        value-key="value"
        :ui="{ content: 'min-w-fit' }"
      />
    </div>
    <div v-if="status === 'pending'" class="h-55 flex items-center justify-center">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin text-text-secondary" />
    </div>
    <div v-else-if="!items.length" class="h-55 flex items-center justify-center text-sm text-text-secondary">
      {{ $t('adminDashboard.signatureBottlenecks.noData') }}
    </div>
    <div v-else class="space-y-6 h-80 overflow-y-auto">
      <div v-for="(item, index) in items" :key="index">
        <div class="flex justify-between text-xs font-medium mb-1.5">
          <span class="text-text-main">{{ locale === 'th' ? item.nameTh : item.name }} ({{ item.pendingCount }})</span>
          <span class="text-text-secondary">{{ item.avg }}</span>
        </div>
        <UProgress v-model="item.value" :max="5" :color="getColor(item.value)" />
      </div>
    </div>
  </UCard>
</template>
