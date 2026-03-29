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
  pendingCount: number;
  avgWaitingHours: number;
};

const topLimit = ref<'5' | '10' | 'all'>('5');
const topLimitOptions = ['5', '10', 'all'];

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

const items = computed(() => {
  return (data.value?.data ?? []).map(item => ({
    name: item.roleName,
    value: Math.min(5, Number((item.avgWaitingHours / 24).toFixed(2))),
    avg: item.avgWaitingHours < 24
      ? `${item.avgWaitingHours.toFixed(1)} hrs avg`
      : `${(item.avgWaitingHours / 24).toFixed(1)} days avg`,
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
          <span class="text-text-main">{{ item.name }} ({{ item.pendingCount }})</span>
          <span class="text-text-secondary">{{ item.avg }}</span>
        </div>
        <UProgress v-model="item.value" :max="5" :color="getColor(item.value)" />
      </div>
    </div>
  </UCard>
</template>
