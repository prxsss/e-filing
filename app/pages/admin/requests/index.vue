<script setup lang="ts">
import type { TableRow } from '@nuxt/ui';

// import { access } from 'node:fs';
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'requests',
  middleware: ['permission'],
  permission: 'request.view',
});

const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

// === Types ===
type RequestStatus = 'in_progress' | 'rejected' | 'completed';

// === Status Helpers ===
const statusColorMap: Record<RequestStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  in_progress: 'warning',
  rejected: 'error',
  completed: 'success',
};

const statusLabelMap: Record<RequestStatus, string> = {
  in_progress: 'กำลังดำเนินการ',
  rejected: 'ปฏิเสธ',
  completed: 'เสร็จสิ้น',
};

function getStatusColor(status: string) {
  return statusColorMap[status as RequestStatus] ?? 'neutral';
}

function getStatusLabel(status: string) {
  return statusLabelMap[status as RequestStatus] ?? status;
}

function formatDate(dateStr: string | null): string {
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

// === Table Columns ===
const UBadge = resolveComponent('UBadge');
const UIcon = resolveComponent('UIcon');

const columns: any[] = [
  { accessorKey: 'id', header: t('requestId'), size: 80 },
  { accessorKey: 'templateName', header: t('requestTitle'), size: 250 },
  { accessorKey: 'status', header: t('status'), size: 150 },
  { accessorKey: 'createdAt', header: t('submittedDate'), size: 165 },
  { accessorKey: 'submittedAt', header: t('lastUpdated'), size: 165 },
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
  router.push(localePath(`/admin/requests/${row.original.id}`));
}

// === Filter State ===
const statusOptions = [
  { label: 'สถานะทั้งหมด', value: undefined },
  { label: 'กำลังดำเนินการ', value: 'in_progress' },
  { label: 'ปฏิเสธ', value: 'rejected' },
  { label: 'เสร็จสิ้น', value: 'completed' },
];

const searchQuery = ref('');
const selectedStatus = ref<string | undefined>(undefined);
const page = ref(1);
const pageSize = 15;

watch([searchQuery, selectedStatus], () => {
  page.value = 1;
});

// === Fetch ===
const queryParams = computed(() => ({
  page: page.value,
  limit: pageSize,
  ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
  ...(searchQuery.value ? { search: searchQuery.value } : {}),
}));

const { data: response, status: fetchStatus, refresh } = await useFetch('/api/requests', {
  query: queryParams,
  watch: [queryParams],
});

const requests = computed(() => response.value?.data ?? []);
const total = computed(() => response.value?.meta?.total ?? 0);

// === Stats ===
const statsMap = computed(() => {
  const counts = response.value?.meta?.statusCounts;
  return {
    total: total.value,
    in_progress: counts?.in_progress ?? 0,
    rejected: counts?.rejected ?? 0,
    completed: counts?.completed ?? 0,
  };
});

function clearFilters() {
  searchQuery.value = '';
  selectedStatus.value = undefined;
  page.value = 1;
}
</script>

<template>
  <div class="space-y-6 min-h-screen pb-10">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <UIcon name="i-heroicons-clipboard-document-list" class="text-primary-500" />
          คำร้องทั้งหมด
        </h2>
        <p class="text-sm mt-1 text-gray-500">
          ตรวจสอบและติดตามสถานะคำร้องของผู้ใช้ทุกคน
        </p>
      </div>
      <UButton
        icon="i-heroicons-arrow-path"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      >
        รีเฟรช
      </UButton>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <UCard class="p-4">
        <div class="text-2xl font-bold">
          {{ total }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          คำร้องทั้งหมด
        </div>
      </UCard>
      <UCard class="p-4">
        <div class="text-2xl font-bold text-yellow-500">
          {{ statsMap.in_progress }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          กำลังดำเนินการ
        </div>
      </UCard>
      <UCard class="p-4">
        <div class="text-2xl font-bold text-red-500">
          {{ statsMap.rejected }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          ปฏิเสธ
        </div>
      </UCard>
      <UCard class="p-4">
        <div class="text-2xl font-bold text-green-500">
          {{ statsMap.completed }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          เสร็จสิ้น
        </div>
      </UCard>
    </div>

    <!-- Table Card -->
    <UCard>
      <!-- Filters -->
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-5">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="ค้นหาตามรหัสคำร้อง หรือชื่อเรื่อง..."
          class="w-full sm:w-80"
          :loading="fetchStatus === 'pending'"
        />
        <div class="flex gap-2">
          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            option-attribute="label"
            placeholder="สถานะ"
            class="w-40"
          />
          <UButton
            v-if="searchQuery || selectedStatus"
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearFilters"
          >
            ล้าง
          </UButton>
        </div>
      </div>

      <!-- Table -->
      <UTable
        :data="requests"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
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
          <UIcon name="i-heroicons-inbox" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="font-medium mb-1">
          ไม่พบข้อมูลคำร้อง
        </h3>
        <p v-if="searchQuery || selectedStatus" class="text-sm text-gray-400">
          ลองปรับเงื่อนไขการค้นหา หรือ
          <button class="text-primary-500 underline" @click="clearFilters">
            ล้างตัวกรอง
          </button>
        </p>
      </div>

      <!-- Pagination -->
      <template v-if="total > 0" #footer>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-500">
            แสดง {{ requests.length }} จาก {{ total }} รายการ
          </span>
          <UPagination
            v-model:page="page"
            :items-per-page="pageSize"
            :total="total"
            size="md"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
