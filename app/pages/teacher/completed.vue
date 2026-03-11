<script setup lang="ts">
definePageMeta({ title: 'completed' });

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

const { data, status, refresh } = await useFetch<{ success: boolean; data: HistoryEntry[] }>(
  '/api/requests/signed-history',
);

const entries = computed<HistoryEntry[]>(() => data.value?.data ?? []);

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
</script>

<template>
  <div class="space-y-6">
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

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-green-600 animate-spin" />
    </div>

    <!-- Empty state -->
    <template v-else-if="entries.length === 0">
      <div class="text-center py-16">
        <UIcon name="i-lucide-inbox" class="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 class="font-semibold text-slate-700 mb-1">
          ยังไม่มีประวัติการลงนาม
        </h3>
        <p class="text-sm text-slate-400">
          เมื่อคุณลงนามหรือปฏิเสธเอกสาร จะปรากฏที่นี่
        </p>
      </div>
    </template>

    <!-- History list -->
    <div v-else class="space-y-3">
      <UCard
        v-for="entry in entries"
        :key="entry.flowId"
        class="hover:shadow-md transition-shadow"
      >
        <div class="flex items-start gap-4">
          <!-- Icon -->
          <div
            class="p-3 rounded-lg shrink-0"
            :class="entry.status === 'signed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'"
          >
            <UIcon
              :name="entry.status === 'signed' ? 'i-lucide-file-check-2' : 'i-lucide-file-x-2'"
              class="w-6 h-6"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h3 class="font-semibold text-slate-800 truncate">
                {{ entry.request?.templateName ?? 'เอกสาร' }}
              </h3>
              <UBadge
                :color="(actionColor[entry.status] ?? 'neutral') as any"
                :label="actionLabel[entry.status] ?? entry.status"
                variant="soft"
                size="sm"
              />
            </div>

            <p class="text-sm text-slate-500">
              คำร้อง #{{ entry.requestId }}
              &nbsp;·&nbsp; ขั้นตอนที่ {{ entry.stepOrder }}: {{ entry.roleName }}
            </p>

            <p v-if="entry.signedAt" class="text-xs text-slate-400 mt-0.5">
              {{ entry.status === 'signed' ? 'ลงนามเมื่อ' : 'ปฏิเสธเมื่อ' }}: {{ formatDate(entry.signedAt) }}
            </p>

            <!-- Rejection reason -->
            <p
              v-if="entry.status === 'rejected' && entry.request?.note"
              class="text-xs text-red-500 mt-1 italic"
            >
              เหตุผล: {{ entry.request.note }}
            </p>
          </div>

          <!-- Right: request status + action -->
          <div class="shrink-0 flex flex-col items-end gap-2">
            <UBadge
              v-if="entry.request?.status"
              :color="(requestStatusColor[entry.request.status] ?? 'neutral') as any"
              :label="requestStatusLabel[entry.request.status] ?? entry.request.status"
              variant="outline"
              size="xs"
            />
            <div class="flex gap-2">
              <UButton
                v-if="entry.request?.filledDocumentUrl"
                size="xs"
                variant="soft"
                color="neutral"
                icon="i-lucide-external-link"
                :to="entry.request.filledDocumentUrl"
                target="_blank"
              >
                ดู PDF
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-eye"
                :to="`/teacher/sign/${entry.requestId}`"
              >
                รายละเอียด
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
