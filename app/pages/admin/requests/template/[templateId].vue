<script lang="ts" setup>
import type { TableColumn, TableRow } from '@nuxt/ui';

import { DateFormatter, getLocalTimeZone } from '@internationalized/date';
import { useDebounceFn } from '@vueuse/core';

import { PERIOD_OPTIONS, useRequestFiltersStore } from '~/stores/request-filters';
import { downloadFilesAsZip } from '~/utils/zip';

type TemplateInfo = { id: number; name: string | null };

definePageMeta({
  title: 'requestByTemplate',
  middleware: ['permission'],
  permission: 'request.view',
});

const route = useRoute();
const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();
const templateId = route.params.templateId as string;

// Fetch template info
const { data: templateRes } = await useFetch(`/api/pdf-templates/${templateId}`);
const template = computed<TemplateInfo | null>(() => templateRes.value?.data ?? null);

// === Types ===
type RequestStatus = 'draft' | 'in_progress' | 'rejected' | 'completed';
type RequestItem = {
  id: number;
  templateName: string | null;
  status: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  filledDocumentUrl?: string | null;
  studentId: string | null;
  studentNameEn: string | null;
  studentNameTh: string | null;
  studentName: string;
};
type SelectableRow = { getIsSelected: () => boolean; toggleSelected: (value: boolean) => void };
type SelectableTable = { getIsSomePageRowsSelected: () => boolean; getIsAllPageRowsSelected: () => boolean; toggleAllPageRowsSelected: (value: boolean) => void };
type FilteredSelectedRow = { original: RequestItem };
type RequestsTableApi = { getFilteredSelectedRowModel: () => { rows: FilteredSelectedRow[] } };

// === Status Helpers ===
const statusColorMap: Record<RequestStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  in_progress: 'warning',
  rejected: 'error',
  completed: 'success',
};
const statusLabelMap: Record<RequestStatus, string> = {
  draft: t('draft'),
  in_progress: t('inProgress'),
  rejected: t('rejected'),
  completed: t('completed'),
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
  });
}

// === Table Columns ===
const UBadge = resolveComponent('UBadge');
const UButton = resolveComponent('UButton');
const UCheckbox = resolveComponent('UCheckbox');
const UIcon = resolveComponent('UIcon');
const table = ref<{ tableApi?: RequestsTableApi } | null>(null);
const rowSelection = ref<Record<string, boolean>>({});
const isBulkDownloading = ref(false);
const columns: TableColumn<RequestItem>[] = [
  {
    id: 'select',
    header: (ctx: { table: SelectableTable }) =>
      h(UCheckbox, {
        'modelValue': ctx.table.getIsSomePageRowsSelected() ? 'indeterminate' : ctx.table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => ctx.table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all',
      }),
    cell: (ctx: { row: SelectableRow }) =>
      h(UCheckbox, {
        'modelValue': ctx.row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => ctx.row.toggleSelected(!!value),
        'aria-label': 'Select row',
      }),
    enableSorting: false,
    enableHiding: false,
  },
  { accessorKey: 'studentId', header: t('studentId'), size: 120 },
  {
    accessorKey: 'studentName',
    header: t('studentName'),
    size: 180,
    cell: (ctx: { row: TableRow<RequestItem> }) => ctx.row.original.studentName,
  },
  { accessorKey: 'templateName', header: t('requestTitle'), size: 250 },
  { accessorKey: 'status', header: t('status'), size: 150 },
  { accessorKey: 'createdAt', header: t('submittedDate'), size: 165 },
  { accessorKey: 'submittedAt', header: t('lastUpdated'), size: 165 },
  {
    id: 'actions',
    header: '',
    size: 100,
    meta: { class: { td: 'text-right' } },
  },
];
function onRowSelect(_e: Event, row: TableRow<RequestItem>) {
  router.push(localePath(`/admin/requests/${row.original.id}`));
}

// === PDF Download ===
async function downloadPdf(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error('Fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }
  catch {
    if (typeof window !== 'undefined')
      window.open(url, '_blank');
  }
}
const selectedRowsWithPdf = computed<FilteredSelectedRow[]>(() => {
  const api: RequestsTableApi | undefined = table.value?.tableApi;
  if (!api)
    return [];
  return api.getFilteredSelectedRowModel().rows.filter(row => Boolean(row.original?.filledDocumentUrl));
});
const canBulkDownload = computed<boolean>(() => selectedRowsWithPdf.value.length > 0);
async function onBulkDownload() {
  const rows = selectedRowsWithPdf.value;
  if (!rows.length)
    return;

  isBulkDownloading.value = true;
  try {
    const files = await Promise.all(rows.map(async (row) => {
      const url = row.original.filledDocumentUrl;
      if (!url)
        return null;

      const res = await fetch(url);
      if (!res.ok)
        throw new Error('Fetch failed');

      return {
        name: `request-${row.original.id}.pdf`,
        data: new Uint8Array(await res.arrayBuffer()),
      };
    }));

    const validFiles = files.filter(Boolean) as Array<{ name: string; data: Uint8Array }>;
    await downloadFilesAsZip(validFiles, `requests-${templateId}-${new Date().toISOString().slice(0, 10)}.zip`);
  }
  catch {
    for (const row of rows) {
      const url = row.original.filledDocumentUrl;
      if (url)
        await downloadPdf(url, `request-${row.original.id}.pdf`);
    }
  }
  finally {
    isBulkDownloading.value = false;
  }
}

// === Shared Date Filter (Pinia) ===
const filterStore = useRequestFiltersStore();
const { selectedPeriod, modelValue, dateRangeQuery } = storeToRefs(filterStore);

const df = new DateFormatter('en-US', { dateStyle: 'medium' });

// === Local Filter State ===
const statusOptions = [
  { label: 'สถานะทั้งหมด', value: undefined },
  { label: 'กำลังดำเนินการ', value: 'in_progress' },
  { label: 'ปฏิเสธ', value: 'rejected' },
  { label: 'เสร็จสิ้น', value: 'completed' },
];
const searchQuery = ref('');
const debouncedSearch = ref('');
const applySearch = useDebounceFn((val: string) => {
  debouncedSearch.value = val;
}, 350);
watch(searchQuery, applySearch);
const selectedStatus = ref<string | undefined>(undefined);
const page = ref(1);
const pageSize = 15;

const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value || selectedStatus.value || selectedPeriod.value !== 'This month'),
);

function clearFilters() {
  searchQuery.value = '';
  debouncedSearch.value = '';
  selectedStatus.value = undefined;
  filterStore.resetDateFilter();
  page.value = 1;
}

// Reset page when any filter changes
watch([debouncedSearch, selectedStatus, dateRangeQuery], () => {
  page.value = 1;
}, { deep: true });

// === Fetch ===
const queryParams = computed(() => ({
  page: page.value,
  limit: pageSize,
  ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
  ...dateRangeQuery.value,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  templateId,
}));
const { data: response, status: fetchStatus, refresh } = await useFetch('/api/requests', { query: queryParams });
const requests = computed<RequestItem[]>(() => {
  const raw = response.value?.data ?? [];
  return raw.map((item: any) => {
    const studentName = locale.value === 'th' ? (item.studentNameTh ?? '') : (item.studentNameEn ?? '');
    return {
      ...item,
      studentId: item.studentId ?? '',
      studentNameEn: item.studentNameEn ?? '',
      studentNameTh: item.studentNameTh ?? '',
      studentName,
    };
  });
});
const total = computed(() => response.value?.meta?.total ?? 0);
const statsMap = computed(() => {
  const counts = response.value?.meta?.statusCounts;
  return {
    total: total.value,
    in_progress: counts?.in_progress ?? 0,
    rejected: counts?.rejected ?? 0,
    completed: counts?.completed ?? 0,
  };
});
</script>

<template>
  <div class="space-y-6 min-h-screen pb-10">
    <!-- Header -->
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          {{ template?.name ? `คำร้องสำหรับ: ${template.name}` : 'คำร้องตามแบบฟอร์ม' }}
        </h1>
        <p>ตรวจสอบและติดตามสถานะคำร้องสำหรับแบบฟอร์มนี้</p>
      </div>
      <div class="flex items-center gap-2">
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
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <UCard
        class="p-4 cursor-pointer select-none"
        :class="{ 'ring-2 ring-primary-500': !selectedStatus }"
        @click="() => { if (!selectedStatus) return; selectedStatus = undefined; }"
      >
        <div class="text-2xl font-bold">
          {{ total }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          คำร้องทั้งหมด
        </div>
      </UCard>
      <UCard
        class="p-4 cursor-pointer select-none"
        :class="{ 'ring-2 ring-yellow-500': selectedStatus === 'in_progress' }"
        @click="() => { selectedStatus = selectedStatus === 'in_progress' ? undefined : 'in_progress'; }"
      >
        <div class="text-2xl font-bold text-yellow-500">
          {{ statsMap.in_progress }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          กำลังดำเนินการ
        </div>
      </UCard>
      <UCard
        class="p-4 cursor-pointer select-none"
        :class="{ 'ring-2 ring-red-500': selectedStatus === 'rejected' }"
        @click="() => { selectedStatus = selectedStatus === 'rejected' ? undefined : 'rejected'; }"
      >
        <div class="text-2xl font-bold text-red-500">
          {{ statsMap.rejected }}
        </div>
        <div class="text-sm text-gray-500 mt-0.5">
          ปฏิเสธ
        </div>
      </UCard>
      <UCard
        class="p-4 cursor-pointer select-none"
        :class="{ 'ring-2 ring-green-500': selectedStatus === 'completed' }"
        @click="() => { selectedStatus = selectedStatus === 'completed' ? undefined : 'completed'; }"
      >
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
      <div class="w-full mb-5">
        <div class="w-full flex flex-col gap-2 sm:max-w-md sm:ml-auto sm:flex-row sm:items-center">
          <UTooltip text="กรุณาเลือกรายการก่อน" :prevent="canBulkDownload">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              color="primary"
              variant="soft"
              size="sm"
              :disabled="!canBulkDownload"
              :loading="isBulkDownloading"
              class="w-full justify-center items-center sm:min-w-40 sm:w-auto"
              @click="onBulkDownload"
            >
              {{ selectedRowsWithPdf.length > 1 ? `ดาวน์โหลด ZIP (${selectedRowsWithPdf.length})` : 'ดาวน์โหลด ZIP' }}
            </UButton>
          </UTooltip>
          <UFieldGroup class="w-full">
            <UInput
              v-model="searchQuery"
              class="w-full"
              icon="i-heroicons-magnifying-glass"
              size="lg"
              variant="outline"
              placeholder="ค้นหาตามชื่อคำร้อง รหัสนิสิต หรือชื่อนิสิต..."
              :loading="fetchStatus === 'pending'"
            />
            <UButton icon="i-heroicons-magnifying-glass" label="ค้นหา" color="primary" variant="solid" :loading="fetchStatus === 'pending'" @click="applySearch(searchQuery)" />
          </UFieldGroup>
          <UPopover :content="{ align: 'end', side: 'bottom' }">
            <template #default="{ open }">
              <UButton
                color="primary"
                variant="ghost"
                :leading-icon="open ? 'i-lucide-x' : 'i-lucide-sliders-horizontal'"
                :ui="{ leadingIcon: `${open ? 'rotate-180' : ''} transition-transform duration-200` }"
              />
            </template>
            <template #content>
              <div class="w-[min(92vw,32rem)] p-4 space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UFormField label="สถานะ">
                    <USelect
                      v-model="selectedStatus"
                      :items="statusOptions"
                      option-attribute="label"
                      placeholder="สถานะ"
                      class="w-full"
                      size="sm"
                    />
                  </UFormField>
                  <UFormField label="ช่วงเวลา">
                    <USelect
                      v-model="selectedPeriod"
                      icon="i-lucide-calendar"
                      :items="[...PERIOD_OPTIONS]"
                      class="w-full"
                      size="sm"
                      :ui="{ content: 'min-w-fit' }"
                    />
                  </UFormField>
                </div>
                <UFormField label="กำหนดช่วงวันที่เอง">
                  <UPopover arrow :content="{ align: 'start', side: 'bottom' }">
                    <UButton color="neutral" variant="outline" size="sm" class="w-full font-normal">
                      <template v-if="modelValue.start">
                        <template v-if="modelValue.end">
                          {{ df.format(modelValue.start.toDate(getLocalTimeZone())) }} - {{ df.format(modelValue.end.toDate(getLocalTimeZone())) }}
                        </template>
                        <template v-else>
                          {{ df.format(modelValue.start.toDate(getLocalTimeZone())) }}
                        </template>
                      </template>
                      <template v-else>
                        เลือกวันที่
                      </template>
                    </UButton>
                    <template #content>
                      <UCalendar v-model="modelValue" class="p-2" :number-of-months="2" range />
                    </template>
                  </UPopover>
                </UFormField>
                <div class="flex justify-end gap-2 pt-2 border-t border-default">
                  <UButton
                    color="neutral" variant="ghost" :ui="{ base: 'rounded-md!' }" @click="clearFilters"
                  >
                    ล้าง
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:row-selection="rowSelection"
        :data="requests"
        :columns="columns"
        :get-row-id="(row: RequestItem) => String(row.id)"
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
        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-3" @click.stop>
            <UTooltip text="ดาวน์โหลด PDF">
              <UButton
                icon="i-heroicons-arrow-down-tray"
                size="md"
                variant="ghost"
                color="neutral"
                :disabled="!row.original.filledDocumentUrl"
                :aria-label="row.original.filledDocumentUrl ? 'ดาวน์โหลด PDF' : 'ไม่มี PDF'"
                @click="row.original.filledDocumentUrl && downloadPdf(row.original.filledDocumentUrl, `request-${row.original.id}.pdf`)"
              />
            </UTooltip>
            <UIcon name="i-lucide-chevron-right" class="w-5 h-5" />
          </div>
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
        <p v-if="hasActiveFilters" class="text-sm text-gray-400">
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

<style>

</style>
