<script lang="ts" setup>
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'myRequests',
});

// === Composables ===
const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

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
const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const columns: any[] = [
  { accessorKey: 'id', header: t('requestId') || 'Request ID' },
  { accessorKey: 'templateName', header: t('requestTitle') || 'Topic' },
  { accessorKey: 'createdAt', header: t('submittedDate') || 'Date' },
  { accessorKey: 'status', header: t('status') || 'Status' },
  {
    id: 'actions',
    header: '',
    cell: ({ row }: any) =>
      h(UButton, {
        size: 'xs',
        variant: 'ghost',
        color: 'neutral',
        icon: 'i-lucide-eye',
        label: 'ดูรายละเอียด',
        onClick: () => router.push(localePath(`/student/my-requests/${row.original.id}`)),
      }),
  },
];

// === Filter Options ===
const statusOptions = [
  { label: t('allStatuses') || 'All Statuses', value: undefined },
  { label: t('draft'), value: 'draft' },
  { label: t('submitted'), value: 'submitted' },
  { label: 'กำลังดำเนินการ', value: 'in_progress' },
  { label: t('rejected'), value: 'rejected' },
  { label: t('completed'), value: 'completed' },
];

// === Reactive State ===
const searchQuery = ref('');
const selectedStatus = ref<string | undefined>(undefined);
const page = ref(1);
const pageCount = 10;

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
  <div class="space-y-6 min-h-screen pb-10">
    <!-- 1. Page Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold  flex items-center gap-2">
          <UIcon name="i-heroicons-folder-open" class="text-primary-500" />
          {{ t('myRequests') || 'รายการคำร้องของฉัน' }}
        </h2>
        <p class="text-sm  mt-1">
          ติดตามสถานะและประวัติการยื่นคำร้องทั้งหมด
        </p>
      </div>
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        size="md"
        class="shadow-sm"
        @click="handleNewRequest"
      >
        {{ t('newRequest') || 'สร้างคำร้องใหม่' }}
      </UButton>
    </div>

    <!-- 2. Main Table Card -->
    <UCard>
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <!-- Left: Search -->
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="ค้นหาตามรหัส หรือชื่อเรื่อง..."
          class="w-full sm:w-72"
        />

        <!-- Right: Filter -->
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          option-attribute="label"
          placeholder="สถานะ"
          class="w-full sm:w-48"
        />
      </div>

      <!-- Table Content -->
      <UTable
        :data="requests"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
        empty=" "
      >
        <template #createdAt-cell="{ row }">
          {{ formatDate(row.original.submittedAt || row.original.createdAt) }}
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
