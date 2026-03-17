<script setup lang="ts">
import type { TableRow } from '@nuxt/ui';

definePageMeta({
  title: 'signedHistory',
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
  return new Date(dateStr).toLocaleDateString('th-TH', {
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
const actionLabel: Record<string, string> = {
  signed: 'ลงนามแล้ว',
  rejected: 'ปฏิเสธ',
};
const requestStatusColor: Record<string, string> = {
  completed: 'success',
  in_progress: 'warning',
  rejected: 'error',
  submitted: 'info',
  draft: 'neutral',
};
const requestStatusLabel: Record<string, string> = {
  completed: 'เสร็จสมบูรณ์',
  in_progress: 'กำลังดำเนินการ',
  rejected: 'ถูกปฏิเสธ',
  submitted: 'ส่งแล้ว',
  draft: 'ร่าง',
};

const UBadge = resolveComponent('UBadge');
const UIcon = resolveComponent('UIcon');

const actionOptions = [
  { label: 'ทั้งหมด', value: undefined },
  { label: actionLabel.signed, value: 'signed' },
  { label: actionLabel.rejected, value: 'rejected' },
];

const tableData = computed(() =>
  entries.value.map(entry => ({
    ...entry,
    id: entry.flowId,
    requestId: entry.requestId,
    templateName: entry.request?.templateName ?? 'เอกสาร',
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

const columns: any[] = [
  { accessorKey: 'requestId', header: 'รหัสคำร้อง' },
  { accessorKey: 'templateName', header: 'ชื่อเอกสาร' },
  { accessorKey: 'actionStatus', header: 'ผลการดำเนินการ' },
  { accessorKey: 'requestStatus', header: 'สถานะคำร้อง' },
  { accessorKey: 'signedAt', header: 'วันที่ดำเนินการ' },
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
];

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
          ประวัติการลงนาม
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          เอกสารที่คุณเคยลงนามหรือปฏิเสธ
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
        รีเฟรช
      </UButton>
    </div>

    <UCard>
      <div class="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="ค้นหาตามรหัส ชื่อเอกสาร"
          class="w-full sm:w-80"
        />

        <USelect
          v-model="selectedAction"
          :items="actionOptions"
          option-attribute="label"
          placeholder="ผลการดำเนินการ"
          class="w-full sm:w-56"
        />
      </div>

      <UTable
        :data="paginatedEntries"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{ tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
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
              ดู PDF
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
          ยังไม่มีประวัติการลงนาม
        </h3>
        <p class="text-sm text-slate-400">
          เมื่อคุณลงนามหรือปฏิเสธเอกสาร จะปรากฏที่นี่
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
