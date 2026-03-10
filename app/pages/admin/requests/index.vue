<script lang="ts" setup>
import type { TableColumn, TableRow } from '@nuxt/ui';

import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'requests',
});

// === Composables ===
const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

// === Type Definitions ===
type RequestStatus = 'draft' | 'submitted' | 'pending' | 'in_progress' | 'rejected' | 'completed';

type RequestItem = {
  id: number;
  templateId: number | null;
  templateName: string | null;
  templateCategory: string | null;
  status: string | null;
  createdBy: number | null;
  requesterName: string | null;
  submittedAt: string | null;
  filledDocumentUrl: string | null;
  createdAt: string;
};

// === Status Helpers ===
const statusColorMap: Record<RequestStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  submitted: 'info',
  pending: 'warning',
  in_progress: 'warning',
  rejected: 'error',
  completed: 'success',
};

function getStatusColor(status: string) {
  return statusColorMap[status as RequestStatus] ?? 'neutral';
}

function getStatusLabel(status: string): string {
  const key = status as RequestStatus;
  const labels: Record<RequestStatus, string> = {
    draft: t('draft'),
    submitted: t('submitted'),
    pending: t('pending'),
    in_progress: t('inProgress'),
    rejected: t('rejected'),
    completed: t('completed'),
  };
  return labels[key] ?? status;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr)
    return '-';
  return new Date(dateStr).toLocaleDateString(locale.value === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// === Table Configuration ===
const UBadge = resolveComponent('UBadge');

const columns: TableColumn<RequestItem>[] = [
  { accessorKey: 'id', header: t('requestId') },
  { accessorKey: 'templateName', header: t('requestTitle') },
  {
    accessorKey: 'templateCategory',
    header: t('requestType'),
    cell: ({ row }) => {
      const category = row.getValue('templateCategory') as string | null;
      return category || h('span', { class: 'text-gray-400' }, '-');
    },
  },
  {
    accessorKey: 'requesterName',
    header: t('fullName'),
    cell: ({ row }) => {
      const name = row.getValue('requesterName') as string | null;
      return name || h('span', { class: 'text-gray-400' }, '-');
    },
  },
  { accessorKey: 'status', header: t('status') },
  { accessorKey: 'createdAt', header: t('submittedDate') },
];

// === Filter Options ===
const statusOptions = [
  { label: t('allStatuses'), value: undefined },
  { label: t('draft'), value: 'draft' },
  { label: t('submitted'), value: 'submitted' },
  { label: t('inProgress'), value: 'in_progress' },
  { label: t('rejected'), value: 'rejected' },
  { label: t('completed'), value: 'completed' },
];

// === Reactive State ===
const searchQuery = ref('');
const selectedStatus = ref<string | undefined>(undefined);
const page = ref(1);
const pageCount = 10;

// Reset page when filters change
watch([searchQuery, selectedStatus], () => {
  page.value = 1;
});

// === Fetch Requests from API ===
const queryParams = computed(() => ({
  page: page.value,
  limit: pageCount,
  ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
  ...(searchQuery.value ? { search: searchQuery.value } : {}),
}));

const { data: response, status: fetchStatus } = await useFetch<{
  success: boolean;
  data: RequestItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}>('/api/requests', {
  query: queryParams,
  watch: [queryParams],
});

const requests = computed(() => response.value?.data ?? []);
const total = computed(() => response.value?.meta?.total ?? 0);

// === Row Click Handler ===
function onRowSelect(_event: Event, row: TableRow<RequestItem>) {
  router.push(localePath(`/admin/requests/${row.original.id}`));
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <UIcon name="i-lucide-file-text" class="text-primary-500" />
          {{ t('requests') }}
        </h1>
        <p class="text-sm mt-1">
          {{ t('noRequests') !== 'noRequests' ? '' : '' }}Manage and review all submitted requests.
        </p>
      </div>
    </div>

    <!-- Main Table Card -->
    <UCard>
      <!-- Filters -->
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          :placeholder="t('searchByTitle')"
          class="w-full sm:w-72"
        />
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          option-attribute="label"
          :placeholder="t('status')"
          class="w-full sm:w-48"
        />
      </div>

      <!-- Table -->
      <UTable
        :data="requests"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
        class="cursor-pointer"
        empty=" "
        @select="onRowSelect"
      >
        <template #status-cell="{ row }">
          <UBadge
            :color="getStatusColor(row.original.status ?? '')"
            variant="subtle"
            size="sm"
          >
            {{ getStatusLabel(row.original.status ?? '') }}
          </UBadge>
        </template>
        <template #createdAt-cell="{ row }">
          {{ formatDate(row.original.submittedAt || row.original.createdAt) }}
        </template>
      </UTable>

      <!-- Empty State -->
      <div v-if="requests.length === 0 && fetchStatus !== 'pending'" class="py-12 text-center">
        <div class="bg-gray-50 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
          <UIcon name="i-lucide-inbox" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="font-medium mb-1">
          {{ t('noRequests') }}
        </h3>
        <p class="text-sm text-gray-500">
          {{ t('tryAdjustingFilters') }}
        </p>
      </div>

      <!-- Pagination Footer -->
      <template v-if="total > 0" #footer>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">
            {{ total }} {{ t('result') }}
          </span>
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
