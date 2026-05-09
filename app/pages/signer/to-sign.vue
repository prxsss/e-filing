<script setup lang="ts">
import type { TableRow } from '@nuxt/ui';

definePageMeta({
  title: 'signerToSign.title',
  middleware: ['permission'],
  permission: 'request.to_sign.view',
});

type SigningTask = {
  flowId: number;
  requestId: number;
  stepOrder: number;
  roleDescriptionEn: string | null;
  roleDescriptionTh: string | null;
  createdAt: string;
  acknowledgeOnly: boolean;
  studentNameEn: string;
  studentNameTh: string;
  request: {
    id: number;
    status: string;
    submittedAt: string | null;
    filledDocumentUrl: string | null;
    templateName: string | null;
    userId: string | null;
  } | null;
};

// const authStore = useAuthStore();

const router = useRouter();
const { t, locale } = useI18n();

const { data, status, refresh } = await useFetch<{ success: boolean; data: SigningTask[] }>(
  '/api/requests/for-signing',
);

const tasks = computed<SigningTask[]>(() => data.value?.data ?? []);

const searchQuery = ref('');
const sortDirection = ref<'asc' | 'desc'>('desc');
const page = ref(1);
const pageCount = 10;

watch(searchQuery, () => {
  page.value = 1;
});

const tableData = computed(() =>
  tasks.value.map(task => ({
    ...task,
    id: task.flowId,
    studentName: task.studentNameTh || task.studentNameEn || '-',
    templateName: task.request?.templateName ?? t('signerToSign.table.defaultDocument'),
    submittedAt: task.request?.submittedAt ?? null,
    status: task.request?.status ?? '',
    stepInfo: locale.value === 'th'
      ? (task.roleDescriptionTh ?? task.roleDescriptionEn ?? '-')
      : (task.roleDescriptionEn ?? task.roleDescriptionTh ?? '-'),
    studentId: task.request?.userId ?? '-',
    acknowledgeOnly: Boolean(task.acknowledgeOnly),
  })),
);

const filteredTasks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q)
    return tableData.value;

  return tableData.value.filter((task) => {
    const templateName = task.templateName?.toLowerCase() ?? '';
    const studentNameEn = task.studentNameEn?.toLowerCase() ?? '';
    const studentNameTh = task.studentNameTh?.toLowerCase() ?? '';
    const stepInfo = task.stepInfo?.toLowerCase() ?? '';

    return (
      templateName.includes(q)
      || studentNameEn.includes(q)
      || studentNameTh.includes(q)
      || stepInfo.includes(q)
    );
  });
});

const sortedTasks = computed(() => {
  const data = [...filteredTasks.value];
  const getTimestamp = (value: string | null | undefined) => {
    const parsed = value ? new Date(value).getTime() : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return data.sort((a, b) => {
    const result = getTimestamp(a.submittedAt) - getTimestamp(b.submittedAt);
    return sortDirection.value === 'asc' ? result : -result;
  });
});

const paginatedTasks = computed(() => {
  const start = (page.value - 1) * pageCount;
  const end = start + pageCount;
  return sortedTasks.value.slice(start, end);
});

const total = computed(() => filteredTasks.value.length);

function formatDate(dateStr: string | null) {
  if (!dateStr)
    return '-';
  return new Date(dateStr).toLocaleDateString(locale.value === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const UIcon = resolveComponent('UIcon');

const columns = computed<any[]>(() => [
  {
    id: 'rowNumber',
    header: '#',
    size: 50,
    cell: (ctx: any) => {
      const index = paginatedTasks.value.findIndex((t: any) => t.id === ctx.row.original.id);
      return ((page.value - 1) * pageCount) + index + 1;
    },
  },
  { accessorKey: 'studentId', header: t('signerToSign.table.studentId') },
  { id: 'studentName', header: t('signerToSign.table.studentName'), cell: (ctx: any) => {
    const name = ctx.row.original.studentNameEn;
    const nameTh = ctx.row.original.studentNameTh;
    return locale.value === 'th' && nameTh && nameTh !== '-'
      ? nameTh
      : name;
  } },
  { accessorKey: 'templateName', header: t('signerToSign.table.document'), size: 300 },
  { accessorKey: 'stepInfo', header: t('signerToSign.table.step') },
  { accessorKey: 'submittedAt', header: t('signerToSign.table.submittedDate') },
  {
    id: 'navigate',
    header: '',
    size: 40,
    cell: () =>
      h(UIcon, {
        name: 'i-lucide-chevron-right',
        class: 'w-5 h-5 text-gray-400',
      }),
  },
]);

function onRowSelect(_e: Event, row: TableRow<any>) {
  router.push(`/signer/sign/${row.original.requestId}`);
}
</script>

<template>
  <div class="space-y-6 min-h-screen pb-10">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          {{ $t('signerToSign.header.title') }}
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          {{ $t('signerToSign.header.description') }}
        </p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        color="neutral"
        size="sm"
        :loading="status === 'pending'"
        @click="() => refresh()"
      >
        {{ $t('signerToSign.actions.refresh') }}
      </UButton>
    </div>

    <UCard>
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="$t('signerToSign.searchPlaceholder')"
          class="w-full sm:w-90"
        />
        <UButton
          color="neutral"
          variant="outline"
          size="md"
          class="justify-center w-10"
          :icon="sortDirection === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'"
          :aria-label="sortDirection === 'asc' ? t('adminTemplates.list.ascending') : t('adminTemplates.list.descending')"
          @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
        />
      </div>

      <UTable
        :data="paginatedTasks"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
        empty=" "
        @select="onRowSelect"
      >
        <template #submittedAt-cell="{ row }">
          {{ formatDate(row.original.submittedAt) }}
        </template>
        <template #stepInfo-cell="{ row }">
          <div class="flex items-center gap-2">
            <UBadge
              :color="row.original.acknowledgeOnly ? 'primary' : 'warning'"
              variant="soft"
              size="sm"
            >
              {{ row.original.stepInfo }}
            </UBadge>
            <UBadge
              v-if="row.original.acknowledgeOnly"
              color="primary"
              variant="subtle"
              size="xs"
            >
              {{ $t('signerToSign.table.acknowledgeOnly') }}
            </UBadge>
          </div>
        </template>
        <template #templateName-cell="{ row }">
          <div class="w-70 truncate" :title="row.original.templateName">
            {{ row.original.templateName }}
          </div>
        </template>
      </UTable>

      <!-- Empty State -->
      <div v-if="sortedTasks.length === 0 && status !== 'pending'" class="py-12 text-center">
        <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
          <UIcon name="i-lucide-inbox" class="w-8 h-8 text-slate-300" />
        </div>
        <h3 class="font-semibold text-slate-800 mb-2">
          {{ $t('signerToSign.emptyState.title') }}
        </h3>
        <p class="text-sm text-slate-500">
          {{ $t('signerToSign.emptyState.description') }}
        </p>
      </div>

      <!-- Pagination Footer -->
      <template v-if="total > 0" #footer>
        <div class="justify-items-center py-2">
          <UPagination
            v-model:page="page"
            :items-per-page="pageCount"
            :total="total"
            size="md"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
