<script setup lang="ts">
import type { TableRow } from '@nuxt/ui';

definePageMeta({
  title: 'signerSignedHistory.title',
  middleware: ['permission'],
  permission: 'request.sign_history.view',
});

type HistoryEntry = {
  flowId: number;
  requestId: number;
  stepOrder: number;
  roleName: string;
  status: string;
  signedAt: string | null;
  request: {
    id: number;
    status: string;
    note: string | null;
    submittedAt: string | null;
    filledDocumentUrl: string | null;
    templateName: string | null;
  } | null;
};

const router = useRouter();
const { t, locale } = useI18n();

const { data, status, refresh } = await useFetch<{ success: boolean; data: HistoryEntry[] }>(
  '/api/requests/signed-history',
);

const entries = computed<HistoryEntry[]>(() => data.value?.data ?? []);

const searchQuery = ref('');
const selectedAction = ref<string | undefined>(undefined);
const page = ref(1);
const pageCount = 10;

watch([searchQuery, selectedAction], () => {
  page.value = 1;
});

function formatDate(dateStr: string | null | undefined) {
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

const actionColor: Record<string, string> = {
  signed: 'success',
  rejected: 'error',
};
const actionLabel = computed<Record<string, string>>(() => ({
  signed: t('signerSignedHistory.actions.status.signed'),
  rejected: t('signerSignedHistory.actions.status.rejected'),
}));
const requestStatusColor: Record<string, string> = {
  completed: 'success',
  in_progress: 'warning',
  rejected: 'error',
  submitted: 'info',
  draft: 'neutral',
};
const requestStatusLabel = computed<Record<string, string>>(() => ({
  completed: t('signerSignedHistory.requestStatus.completed'),
  in_progress: t('signerSignedHistory.requestStatus.inProgress'),
  rejected: t('signerSignedHistory.requestStatus.rejected'),
  submitted: t('signerSignedHistory.requestStatus.submitted'),
  draft: t('signerSignedHistory.requestStatus.draft'),
}));

const UBadge = resolveComponent('UBadge');
const UIcon = resolveComponent('UIcon');

const actionOptions = computed(() => [
  { label: t('signerSignedHistory.filters.allActions'), value: undefined },
  { label: actionLabel.value.signed, value: 'signed' },
  { label: actionLabel.value.rejected, value: 'rejected' },
]);

const tableData = computed(() =>
  entries.value.map(entry => ({
    ...entry,
    id: entry.flowId,
    requestId: entry.requestId,
    templateName: entry.request?.templateName ?? t('signerSignedHistory.table.defaultDocument'),
    actionStatus: entry.status,
    requestStatus: entry.request?.status ?? '',
    signedAt: entry.signedAt,
    note: entry.request?.note ?? '',
  })),
);

const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();

  return tableData.value.filter((entry) => {
    if (selectedAction.value && entry.actionStatus !== selectedAction.value)
      return false;

    if (!q)
      return true;

    const templateName = entry.templateName?.toLowerCase() ?? '';
    const requestId = String(entry.requestId ?? '').toLowerCase();

    return (
      templateName.includes(q)
      || requestId.includes(q)
    );
  });
});

const paginatedEntries = computed(() => {
  const start = (page.value - 1) * pageCount;
  const end = start + pageCount;
  return filteredEntries.value.slice(start, end);
});

const total = computed(() => filteredEntries.value.length);

const columns = computed<any[]>(() => [
  {
    id: 'rowNumber',
    header: '#',
    size: 50,
    cell: (ctx: any) => {
      const index = paginatedEntries.value.findIndex((t: any) => t.id === ctx.row.original.id);
      return ((page.value - 1) * pageCount) + index + 1;
    },
  },
  { accessorKey: 'studentId', header: t('signerSignedHistory.table.studentId') },
  { accessorKey: 'studentName', header: t('signerSignedHistory.table.studentName') },
  { accessorKey: 'templateName', header: t('signerSignedHistory.table.documentName') },
  { accessorKey: 'actionStatus', header: t('signerSignedHistory.table.actionResult') },
  { accessorKey: 'requestStatus', header: t('signerSignedHistory.table.requestStatus') },
  { accessorKey: 'signedAt', header: t('signerSignedHistory.table.actionDate') },
  { id: 'actions', header: '' },
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
  router.push(`/signer/signed-history/${row.original.requestId}`);
}
</script>

<template>
  <div class="space-y-6 min-h-screen pb-10">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          {{ $t('signerSignedHistory.header.title') }}
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          {{ $t('signerSignedHistory.header.description') }}
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
        {{ $t('signerSignedHistory.actions.refresh') }}
      </UButton>
    </div>

    <UCard>
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="$t('signerSignedHistory.searchPlaceholder')"
          class="w-full sm:w-80"
        />

        <USelect
          v-model="selectedAction"
          :items="actionOptions"
          option-attribute="label"
          :placeholder="$t('signerSignedHistory.filters.actionPlaceholder')"
          class="w-full sm:w-56"
        />
      </div>

      <UTable
        :data="paginatedEntries"
        :columns="columns"
        :loading="status === 'pending'"
        empty=" "
        @select="onRowSelect"
      >
        <template #actionStatus-cell="{ row }">
          <UBadge
            :color="(actionColor[row.original.actionStatus] ?? 'neutral') as any"
            variant="soft"
            size="sm"
          >
            {{ actionLabel[row.original.actionStatus] ?? row.original.actionStatus }}
          </UBadge>
        </template>

        <template #requestStatus-cell="{ row }">
          <UBadge
            v-if="row.original.requestStatus"
            :color="(requestStatusColor[row.original.requestStatus] ?? 'neutral') as any"
            variant="outline"
            size="xs"
          >
            {{ requestStatusLabel[row.original.requestStatus] ?? row.original.requestStatus }}
          </UBadge>
        </template>

        <template #signedAt-cell="{ row }">
          <span v-if="row.original.signedAt">
            {{ formatDate(row.original.signedAt) }}
          </span>
          <span v-else>
            -
          </span>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex gap-2 justify-center">
            <UButton
              v-if="row.original.request?.filledDocumentUrl"
              size="xs"
              variant="soft"
              color="neutral"
              icon="i-lucide-external-link"
              :to="row.original.request.filledDocumentUrl"
              target="_blank"
              @click.stop
            >
              {{ $t('signerSignedHistory.actions.viewPdf') }}
            </UButton>
          </div>
        </template>
      </UTable>

      <!-- Empty State -->
      <div v-if="filteredEntries.length === 0 && status !== 'pending'" class="py-12 text-center">
        <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
          <UIcon name="i-lucide-inbox" class="w-8 h-8 text-slate-300" />
        </div>
        <h3 class="font-semibold text-slate-700 mb-1">
          {{ $t('signerSignedHistory.emptyState.title') }}
        </h3>
        <p class="text-sm text-slate-400">
          {{ $t('signerSignedHistory.emptyState.description') }}
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
