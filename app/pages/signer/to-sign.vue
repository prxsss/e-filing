<script setup lang="ts">
import type { TableRow } from '@nuxt/ui';

definePageMeta({
  title: 'toSign',
  middleware: ['permission'],
  permission: 'request.to_sign.view',
});

type SigningTask = {
  flowId: number;
  requestId: number;
  stepOrder: number;
  roleName: string;
  createdAt: string;
  studentNameEn: string;
  studentNameTh: string;
  request: {
    id: number;
    status: string;
    submittedAt: string | null;
    filledDocumentUrl: string | null;
    templateName: string | null;
  } | null;
};

// const authStore = useAuthStore();

const router = useRouter();
const { locale } = useI18n();

const { data, status, refresh } = await useFetch<{ success: boolean; data: SigningTask[] }>(
  '/api/requests/for-signing',
);

const tasks = computed<SigningTask[]>(() => data.value?.data ?? []);

const searchQuery = ref('');
const page = ref(1);
const pageCount = 10;

watch(searchQuery, () => {
  page.value = 1;
});

const tableData = computed(() =>
  tasks.value.map(task => ({
    ...task,
    id: task.flowId,
    templateName: task.request?.templateName ?? 'เอกสาร',
    submittedAt: task.request?.submittedAt ?? null,
    status: task.request?.status ?? '',
    stepInfo: `ขั้นตอนที่ ${task.stepOrder}: ${task.roleName}`,
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

const paginatedTasks = computed(() => {
  const start = (page.value - 1) * pageCount;
  const end = start + pageCount;
  return filteredTasks.value.slice(start, end);
});

const total = computed(() => filteredTasks.value.length);

function formatDate(dateStr: string | null) {
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

const UIcon = resolveComponent('UIcon');

const columns: any[] = [
  { accessorKey: 'templateName', header: 'ชื่อเอกสาร' },
  {
    header: 'นักศึกษา',
    cell: ({ row }: { row: TableRow<SigningTask> }) => {
      const studentName = locale.value === 'th' ? row.original.studentNameTh : row.original.studentNameEn;
      return studentName || '-';
    },
  },
  { accessorKey: 'stepInfo', header: 'ขั้นตอน' },
  { accessorKey: 'submittedAt', header: 'วันที่ยื่น' },
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
          รอลงนาม
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          เอกสารที่รอการลงนามของคุณ
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
          placeholder="ค้นหาตามชื่อเอกสาร นักศึกษา หรือขั้นตอน..."
          class="w-full sm:w-80"
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
          <UBadge
            color="warning"
            variant="soft"
            size="sm"
          >
            {{ row.original.stepInfo }}
          </UBadge>
        </template>
      </UTable>

      <!-- Empty State -->
      <div v-if="filteredTasks.length === 0 && status !== 'pending'" class="py-12 text-center">
        <div class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
          <UIcon name="i-lucide-inbox" class="w-8 h-8 text-slate-300" />
        </div>
        <h3 class="font-semibold text-slate-800 mb-2">
          ไม่มีเอกสารรอลงนาม
        </h3>
        <p class="text-sm text-slate-500">
          เมื่อมีเอกสารรอลงนาม จะแสดงที่นี่
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
