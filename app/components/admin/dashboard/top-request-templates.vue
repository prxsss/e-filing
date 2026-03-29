<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui';

type TopRequestTemplate = {
  rowNo: number;
  templateId: number;
  templateName: string;
  usage: number;
  completion: number;
};

const props = withDefaults(defineProps<{
  period: string;
  startDate?: string;
  endDate?: string;
  facultyId?: number;
  refreshToken?: number;
}>(), {
  refreshToken: 0,
});

type TopTemplateRow = {
  templateId: number;
  templateName: string | null;
  usage: number;
  completionRate: number;
};

const { t } = useI18n();

const topLimit = ref<'5' | '10' | 'all'>('5');
const topLimitOptions = ['5', '10', 'all'];

const query = computed(() => ({
  period: props.period,
  limit: topLimit.value,
  ...(props.startDate ? { startDate: props.startDate } : {}),
  ...(props.endDate ? { endDate: props.endDate } : {}),
  ...(props.facultyId ? { facultyId: props.facultyId } : {}),
}));

const { data: response, status, refresh } = useFetch<{ success: boolean; data: TopTemplateRow[] }>('/api/admin/dashboard/top-templates', {
  query,
  watch: [query],
});

const data = computed<TopRequestTemplate[]>(() => {
  return (response.value?.data ?? []).map((item, index) => ({
    rowNo: index + 1,
    templateId: item.templateId,
    templateName: item.templateName ?? 'Untitled Template',
    usage: item.usage,
    completion: item.completionRate,
  }));
});

const router = useRouter();
const localePath = useLocalePath();

function onRowSelect(_e: Event, row: TableRow<TopRequestTemplate>) {
  const templateId = row.original.templateId;
  if (templateId) {
    router.push(localePath(`/admin/requests/template/${templateId}`));
  }
}

watch(() => props.refreshToken, () => {
  refresh();
});

const columns: TableColumn<TopRequestTemplate>[] = [
  {
    accessorKey: 'rowNo',
    header: t('common.table.no'),
    meta: {
      class: {
        th: 'w-20 text-right',
        td: 'text-right',
      },
    },
  },
  {
    accessorKey: 'templateName',
    header: t('adminDashboard.topRequestTemplates.templateName'),
  },
  {
    accessorKey: 'usage',
    header: t('adminDashboard.topRequestTemplates.usageCount'),
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ getValue }) => {
      const value = getValue() as number;
      return value.toLocaleString();
    },
  },
  {
    accessorKey: 'completion',
    header: t('adminDashboard.topRequestTemplates.completion'),
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ getValue }) => {
      const value = getValue() as number;
      const percentage = Math.round(value * 100);
      const colorClass = percentage >= 90
        ? 'text-success'
        : percentage >= 75
          ? 'text-warning'
          : 'text-error';
      return h('span', { class: `${colorClass} font-semibold` }, `${percentage}%`);
    },
  },
];
</script>

<template>
  <UCard>
    <div class="mb-6 flex items-center justify-between gap-3">
      <h3 class="font-bold text-text-main">
        {{ $t('adminDashboard.topRequestTemplates.title') }}
      </h3>
      <USelect
        v-model="topLimit"
        size="sm"
        :items="topLimitOptions"
        :ui="{ content: 'min-w-fit' }"
      />
    </div>
    <UTable
      :data="data"
      :columns="columns"
      :loading="status === 'pending'"
      sticky
      class="flex-1 h-80"
      :ui="{ tr: 'cursor-pointer hover:bg-gray-50 transition-colors' }"
      @select="onRowSelect"
    />
  </UCard>
</template>
