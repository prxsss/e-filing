<script setup lang="ts">
import type { TableRow } from '@nuxt/ui';

definePageMeta({
  title: 'dashboard',
});

const { t, locale } = useI18n();
const localePath = useLocalePath();
const router = useRouter();

// === Status Helpers ===
type RequestStatus = 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected' | 'completed';

const statusColorMap: Record<RequestStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  submitted: 'info',
  pending: 'warning',
  approved: 'success',
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
    approved: t('approved'),
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

// === Table Columns ===
const UIcon = resolveComponent('UIcon');

const columns = [
  { accessorKey: 'id', header: t('requestId') || 'ID' },
  { accessorKey: 'templateName', header: t('requestTitle') || 'Title' },
  { accessorKey: 'status', header: t('status') || 'Status' },
  { accessorKey: 'createdAt', header: t('submittedDate') || 'Date' },
  { accessorKey: 'submittedAt', header: t('lastUpdated') || 'Date' },
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

// === Fetch Recent Requests from API ===
const { data: response, status: fetchStatus } = await useFetch('/api/requests', {
  query: {
    limit: 5,
    mine: 'true',
  },
});

const recentRequests = computed(() => response.value?.data ?? []);

// === Popular Templates (Fixed 4 Icons) ===
// อัปเดต: ใช้ไอคอนเอกสารที่เป็นกลาง แต่เพิ่มสีสันโทนเย็นให้ดูสวยงามและเป็นทางการ
const iconPalette = [
  { icon: 'i-heroicons-document-text', bg: 'bg-blue-100', text: 'text-blue-600' },
  { icon: 'i-heroicons-clipboard-document-list', bg: 'bg-emerald-100', text: 'text-emerald-600' },
  { icon: 'i-heroicons-document-duplicate', bg: 'bg-indigo-100', text: 'text-indigo-600' },
  { icon: 'i-heroicons-clipboard-document', bg: 'bg-sky-100', text: 'text-sky-600' },
];

const { data: popularResponse } = await useFetch('/api/requests/popular-templates', {
  query: { limit: 4 },
});

const popularRequests = computed(() =>
  (popularResponse.value?.data ?? []).map((item, index) => ({
    ...item,
    ...iconPalette[index % iconPalette.length],
  })),
);

// --- Methods / Logic ---
function navigateToNewRequest() {
  return navigateTo(localePath('/student/new-request'));
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50">
    <!-- Main Content -->
    <UContainer class="space-y-8 pb-8">
      <!-- 2. Primary Action (Banner) -->
      <div
        class="bg-linear-to-r from-primary-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:scale-[1.005] transition-transform duration-300"
        @click="navigateToNewRequest"
      >
        <!-- Decorative Background Element -->
        <div class="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 translate-x-12 pointer-events-none" />

        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 class="text-2xl font-bold mb-2">
              ยื่นคำร้องใหม่ออนไลน์
            </h2>
            <p class="text-white/90 max-w-lg">
              ระบบ E-Request สะดวก รวดเร็ว ติดตามสถานะได้ตลอด 24 ชม. ไม่ต้องเดินทางมาที่คณะ
            </p>
          </div>
          <UButton
            size="xl"
            color="success"
            variant="solid"
            label="สร้างคำร้องใหม่"
            icon="i-heroicons-plus-circle"
            class="text-primary-700 font-bold shadow-md"
          />
        </div>
      </div>

      <!-- 3. Popular Requests (Grid) -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-star" class="text-yellow-500 w-5 h-5" />
          <h3 class="font-semibold text-gray-800">
            คำร้องยอดนิยม
          </h3>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UCard
            v-for="(item, index) in popularRequests"
            :key="item.id ?? index"
            class="cursor-pointer hover:ring-2 hover:ring-primary-500/20 transition-all hover:-translate-y-1 group"
            @click="router.push(localePath(`/student/new-request/${item.id}`))"
          >
            <div class="flex flex-col items-center text-center gap-3">
              <div :class="`w-12 h-12 rounded-full ${item.bg} ${item.text} flex items-center justify-center transition-transform group-hover:scale-110`">
                <!-- Dynamic Icon -->
                <UIcon :name="item.icon" class="w-6 h-6" />
              </div>
              <span class="text-sm font-medium text-gray-700">{{ item.name }}</span>
            </div>
          </UCard>
        </div>
      </div>

      <!-- 4. Recent Requests (UTable) -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="text-gray-400 w-5 h-5" />
              <h3 class="font-semibold text-gray-800">
                รายการล่าสุด
              </h3>
            </div>
            <UButton to="/student/my-requests" variant="link" color="primary" label="ดูทั้งหมด" :padded="false" />
          </div>
        </template>

        <!-- UTable Implementation -->
        <UTable
          :data="recentRequests"
          :columns="columns"
          :loading="fetchStatus === 'pending'"
          class="w-full"
          :empty="t('noRecentRequests')"
          :ui="{ tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
          @select="onRowSelect"
        >
          <template #submittedAt-cell="{ row }">
            {{ formatDate(row.original.submittedAt) }}
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
        </UTable>
      </UCard>

      <!-- 5. Help Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 ">
        <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-4 hover:bg-blue-50 transition-colors">
          <div class="bg-white p-2.5 rounded-lg text-blue-600 shadow-sm flex items-center justify-center">
            <UIcon name="i-heroicons-book-open" class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              คู่มือการใช้งาน
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              ขั้นตอนการยื่นคำร้องและการติดตามสถานะ
            </p>
          </div>
        </div>
        <div class="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex items-start gap-4 hover:bg-orange-50 transition-colors">
          <div class="bg-white p-2.5 rounded-lg text-orange-600 shadow-sm flex items-center justify-center">
            <UIcon name="i-heroicons-phone" class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              ติดต่อเจ้าหน้าที่
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              พบปัญหาการใช้งาน หรือสอบถามข้อมูลเพิ่มเติม
            </p>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
