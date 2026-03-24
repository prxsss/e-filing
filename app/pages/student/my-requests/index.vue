<script lang="ts" setup>
import type { TableRow } from '@nuxt/ui';

definePageMeta({
  title: 'myRequests',
  middleware: ['permission'],
  permission: 'request.view_own',
});

// === Composables ===
const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

const authStore = useAuthStore();

// === Type Definitions ===
type RequestStatus = 'draft' | 'submitted' | 'pending' | 'in_progress' | 'rejected' | 'completed';

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
    in_progress: 'กำลังดำเนินการ',
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
const UIcon = resolveComponent('UIcon');

// === Reactive State ===
const searchQuery = ref('');
const selectedStatus = ref<string | undefined>(undefined);
const page = ref(1);
const pageCount = 10;

const columns: any[] = [
  {
    id: 'rowNumber',
    header: '#',
    size: 40,
    cell: (ctx: { row: TableRow<any> }) => (page.value - 1) * pageCount + ctx.row.index + 1,
  },
  { accessorKey: 'templateName', header: t('requestTitle') },
  { accessorKey: 'status', header: t('status') },
  { accessorKey: 'createdAt', header: t('submittedDate') },
  { accessorKey: 'submittedAt', header: t('lastUpdated') },
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
];

function onRowSelect(_e: Event, row: TableRow<any>) {
  router.push(localePath(`/student/my-requests/${row.original.id}`));
}

// === Filter Options ===
const statusOptions = [
  { label: t('allStatuses') || 'All Statuses', value: undefined },
  { label: t('draft'), value: 'draft' },
  { label: t('submitted'), value: 'submitted' },
  { label: 'กำลังดำเนินการ', value: 'in_progress' },
  { label: t('rejected'), value: 'rejected' },
  { label: t('completed'), value: 'completed' },
];

// Reset to page 1 when filters change
watch([searchQuery, selectedStatus], () => {
  page.value = 1;
});

// === Fetch Requests from API ===
const queryParams = computed(() => ({
  page: page.value,
  limit: pageCount,
  mine: 'true',
  ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
  ...(searchQuery.value ? { search: searchQuery.value } : {}),
}));

const { data: response, status: fetchStatus } = await useFetch('/api/requests', {
  query: queryParams,
  watch: [queryParams],
});

const requests = computed(() => response.value?.data ?? []);
const total = computed(() => response.value?.meta?.total ?? 0);

// === Methods ===
function handleNewRequest() {
  router.push(localePath('/student/new-request'));
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          {{ t('myRequests') || 'My Requests' }}
        </h1>
        <p>ติดตามสถานะและประวัติการยื่นคำร้องทั้งหมด</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="authStore.can('request.create')"
          icon="i-heroicons-plus"
          size="md"
          color="primary"
          class="shadow-sm"
          @click="handleNewRequest"
        >
          {{ t('newRequest') || 'สร้างคำร้องใหม่' }}
        </UButton>
      </div>
    </div>
    <!-- Search and Filter Row -->
    <div class="w-full">
      <div class="max-w-md ml-auto">
        <UFieldGroup class="w-full">
          <UInput
            v-model="searchQuery"
            class="w-full"
            icon="i-heroicons-magnifying-glass"
            size="lg"
            variant="outline"
            placeholder="ค้นหาตามรหัส หรือชื่อเรื่อง..."
            @keyup.enter="page = 1"
          />
          <UButton icon="i-lucide-search" label="Search" color="primary" variant="solid" :loading="fetchStatus === 'pending'" @click="page = 1" />
          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            option-attribute="label"
            placeholder="สถานะ"
            class="w-40"
          />
        </UFieldGroup>
      </div>
    </div>
    <!-- Table Card -->
    <UCard>
      <UTable
        :data="requests"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
        class="flex-1"
        :ui="{ tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
        empty=" "
        @select="onRowSelect"
      >
        <template #createdAt-cell="{ row }">
          {{ formatDate(row.original.createdAt) }}
        </template>
        <template #submittedAt-cell="{ row }">
          {{ formatDate(row.original.submittedAt) }}
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="getStatusColor(row.original.status ?? '')"
            variant="subtle"
            size="sm"
          >
            {{ getStatusLabel(row.original.status ?? '') }}
          </UBadge>
        </template>
      </UTable>
      <!-- Empty State -->
      <div v-if="requests.length === 0 && fetchStatus !== 'pending'" class="py-12 text-center">
        <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
          <UIcon name="i-heroicons-inbox" class="w-8 h-8 " />
        </div>
        <h3 class="font-medium mb-1">
          ไม่พบข้อมูลคำร้อง
        </h3>
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
