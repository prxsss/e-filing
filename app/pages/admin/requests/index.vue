<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui';

import { useDebounceFn } from '@vueuse/core';

import { PERIOD_OPTIONS, useRequestFiltersStore } from '~/stores/request-filters';
import { getStudentYear } from '~/utils/student';
import { downloadFilesAsZip } from '~/utils/zip';

definePageMeta({
  title: 'requests',
  middleware: ['permission'],
  permission: 'request.view',
});

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

// === Types ===
type RequestStatus = 'draft' | 'in_progress' | 'rejected' | 'completed';

const requestStatuses: RequestStatus[] = ['draft', 'in_progress', 'rejected', 'completed'];

type RequestItem = {
  id: number;
  templateName: string | null;
  status: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  filledDocumentUrl?: string | null;
  studentId: string | null;
  studentYear: string | number;
  studentNameEn: string | null;
  studentNameTh: string | null;
  studentName: string;
  departmentNameTh: string | null;
  departmentNameEn: string | null;
  departmentName: string;
};

type SelectableRow = {
  getIsSelected: () => boolean;
  toggleSelected: (value: boolean) => void;
};

type SelectableTable = {
  getIsSomePageRowsSelected: () => boolean;
  getIsAllPageRowsSelected: () => boolean;
  toggleAllPageRowsSelected: (value: boolean) => void;
};

type FilteredSelectedRow = {
  original: RequestItem;
};

type RequestsTableApi = {
  getFilteredSelectedRowModel: () => {
    rows: FilteredSelectedRow[];
  };
};

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

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()))
    return '-';

  return new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatCalendarDate(value: { year: number; month: number; day: number } | null | undefined): string {
  if (!value)
    return '-';

  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  return new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function getStudentYearDisplay(studentId: string | null): string {
  const normalizedId = String(studentId ?? '').trim();
  if (!/^\d{2}/.test(normalizedId)) {
    return '-';
  }

  const year = getStudentYear(normalizedId);
  return Number.isFinite(year) && year > 0 ? String(year) : '-';
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
  { accessorKey: 'studentId', header: t('studentId'), size: 110 },
  {
    accessorKey: 'studentName',
    header: t('studentName'),
    size: 150,
    cell: (ctx: { row: TableRow<RequestItem> }) => ctx.row.original.studentName,
  },
  {
    accessorKey: 'departmentName',
    header: t('department'),
    size: 140,
  },
  { accessorKey: 'studentYear', header: t('studentYear'), size: 20 },
  {
    accessorKey: 'templateName',
    header: t('requestTitle'),
    size: 240,
  },
  { accessorKey: 'status', header: t('status'), size: 120 },
  { accessorKey: 'createdAt', header: t('submittedDate'), size: 130 },
  {
    id: 'actions',
    header: '',
    size: 80,
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
  return api.getFilteredSelectedRowModel().rows.filter(
    row => Boolean(row.original?.filledDocumentUrl),
  );
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
    await downloadFilesAsZip(validFiles, `requests-${new Date().toISOString().slice(0, 10)}.zip`);
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

// === Shared Filter State (Pinia) ===
const filterStore = useRequestFiltersStore();
const { selectedPeriod, modelValue, dateRangeQuery } = storeToRefs(filterStore);

function getSingleQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value))
    return value[0];
  return value;
}

function getInitialStatusFromQuery(): RequestStatus | undefined {
  const statusQuery = getSingleQueryValue(route.query.status as string | string[] | undefined);
  if (!statusQuery)
    return undefined;
  return requestStatuses.includes(statusQuery as RequestStatus)
    ? statusQuery as RequestStatus
    : undefined;
}

function getInitialSearchFromQuery(): string {
  const studentIdQuery = getSingleQueryValue(route.query.studentId as string | string[] | undefined);
  const searchQuery = getSingleQueryValue(route.query.search as string | string[] | undefined);
  return studentIdQuery ?? searchQuery ?? '';
}

// Local-only state (not shared across pages)
const initialSearchQuery = getInitialSearchFromQuery();
const searchQuery = ref(initialSearchQuery);
const debouncedSearch = ref(initialSearchQuery);
const applySearch = useDebounceFn((val: string) => {
  debouncedSearch.value = val;
}, 350);
watch(searchQuery, applySearch);

const selectedStatus = ref<RequestStatus | undefined>(getInitialStatusFromQuery());
const selectedTemplateId = ref<number | undefined>(undefined);
const page = ref(1);
const pageSize = 15;

// === Filter Helpers ===
const statusOptions = [
  { label: 'สถานะทั้งหมด', value: undefined },
  { label: 'กำลังดำเนินการ', value: 'in_progress' },
  { label: 'ปฏิเสธ', value: 'rejected' },
  { label: 'เสร็จสิ้น', value: 'completed' },
];

const { data: templatesData } = await useFetch('/api/pdf-templates', {
  query: { pageSize: 100 },
});

const templateOptions = computed(() => {
  const rows = templatesData.value?.data ?? [];
  const options = rows.map((t: { id: number; name: string | null }) => ({
    label: t.name ?? '-',
    value: t.id,
  }));
  return [{ label: 'แบบฟอร์มทั้งหมด', value: undefined }, ...options];
});

const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value || selectedStatus.value || selectedTemplateId.value || selectedPeriod.value !== 'This month'),
);

function clearFilters() {
  searchQuery.value = '';
  debouncedSearch.value = '';
  selectedStatus.value = undefined;
  selectedTemplateId.value = undefined;
  filterStore.resetDateFilter();
  page.value = 1;
}

// Reset page when any filter changes
watch([debouncedSearch, selectedStatus, selectedTemplateId, dateRangeQuery], () => {
  page.value = 1;
}, { deep: true });

// === Fetch ===
const queryParams = computed(() => ({
  page: page.value,
  limit: pageSize,
  ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
  ...(selectedTemplateId.value ? { templateId: selectedTemplateId.value } : {}),
  ...dateRangeQuery.value,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
}));

const { data: response, status: fetchStatus, refresh } = await useFetch('/api/requests', {
  query: queryParams,
});

const requests = computed<RequestItem[]>(() => {
  const raw = response.value?.data ?? [];
  return raw.map((item: any) => {
    const studentName = locale.value === 'th'
      ? (item.studentNameTh ?? '')
      : (item.studentNameEn ?? '');
    const departmentName = locale.value === 'th'
      ? (item.departmentNameTh ?? item.departmentNameEn ?? '')
      : (item.departmentNameEn ?? item.departmentNameTh ?? '');
    const studentId = item.studentId ?? '';
    return {
      ...item,
      studentId,
      studentYear: getStudentYearDisplay(studentId),
      studentNameEn: item.studentNameEn ?? '',
      studentNameTh: item.studentNameTh ?? '',
      studentName,
      departmentNameTh: item.departmentNameTh ?? null,
      departmentNameEn: item.departmentNameEn ?? null,
      departmentName: departmentName || '-',
    };
  });
});
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
</script>

<template>
  <div class="space-y-6 min-h-screen pb-10">
    <!-- Header -->
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          คำร้องทั้งหมด
        </h1>
        <p>ตรวจสอบและติดตามสถานะคำร้องของผู้ใช้ทุกคน</p>
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
          <UPopover arrow :content="{ align: 'end', side: 'bottom' }">
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
                <UFormField label="ประเภทคำร้อง">
                  <USelect
                    v-model="selectedTemplateId"
                    :items="templateOptions"
                    option-attribute="label"
                    placeholder="ประเภทคำร้องทั้งหมด"
                    class="w-full"
                    size="sm"
                  />
                </UFormField>
                <UFormField label="กำหนดช่วงวันที่เอง">
                  <UPopover arrow :content="{ align: 'start', side: 'bottom' }">
                    <UButton color="neutral" variant="outline" size="sm" class="w-full font-normal">
                      <template v-if="modelValue.start">
                        <template v-if="modelValue.end">
                          {{ formatCalendarDate(modelValue.start) }} - {{ formatCalendarDate(modelValue.end) }}
                        </template>
                        <template v-else>
                          {{ formatCalendarDate(modelValue.start) }}
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
        class="w-full"
        :data="requests"
        :columns="columns"
        :get-row-id="(row: RequestItem) => String(row.id)"
        :loading="fetchStatus === 'pending'"
        :ui="{ base: 'table-fixed min-w-full', th: 'text-left', td: 'text-left', tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
        empty=" "
        @select="onRowSelect"
      >
        <template #templateName-cell="{ row }">
          <div
            class="max-w-60 truncate"
            :title="row.original.templateName ?? '-'"
          >
            {{ row.original.templateName || '-' }}
          </div>
        </template>
        <template #departmentName-cell="{ row }">
          <div class="max-w-45 truncate" :title="row.original.departmentName || '-'">
            {{ row.original.departmentName || '-' }}
          </div>
        </template>
        <template #createdAt-cell="{ row }">
          {{ formatDate(row.original.createdAt) }}
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
