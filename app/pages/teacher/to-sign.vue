<script setup lang="ts">
definePageMeta({
  title: 'toSign',
});

type SigningTask = {
  flowId: number;
  requestId: number;
  stepOrder: number;
  roleName: string;
  createdAt: string;
  studentName: string;
  request: {
    id: number;
    status: string;
    submittedAt: string | null;
    filledDocumentUrl: string | null;
    templateName: string | null;
  } | null;
};

const { data, status, refresh } = await useFetch<{ success: boolean; data: SigningTask[] }>(
  '/api/requests/for-signing',
);

const tasks = computed<SigningTask[]>(() => data.value?.data ?? []);

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
</script>

<template>
  <div class="space-y-6">
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

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-green-600 animate-spin" />
    </div>

    <!-- Task list -->
    <template v-else>
      <div v-if="tasks.length > 0" class="space-y-3">
        <UCard
          v-for="task in tasks"
          :key="task.flowId"
          class="hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4 min-w-0">
              <div class="bg-amber-50 text-amber-600 p-3 rounded-lg shrink-0">
                <UIcon name="i-lucide-file-signature" class="w-6 h-6" />
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-slate-800 truncate">
                  {{ task.request?.templateName ?? 'เอกสาร' }}
                </h3>
                <p class="text-sm text-slate-500 mt-0.5">
                  จาก: <span class="text-slate-700">{{ task.studentName }}</span>
                </p>
                <p class="text-sm text-slate-500">
                  ส่งเมื่อ: {{ formatDate(task.request?.submittedAt ?? null) }}
                </p>
                <div class="mt-2 flex items-center gap-2">
                  <UBadge
                    color="warning"
                    variant="soft"
                    size="sm"
                    :label="`ขั้นตอนที่ ${task.stepOrder}: ${task.roleName}`"
                  />
                </div>
              </div>
            </div>
            <UButton
              color="success"
              size="sm"
              icon="i-lucide-pen-line"
              :to="`/teacher/sign/${task.requestId}`"
              class="shrink-0"
            >
              ลงนาม
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16">
        <UIcon name="i-lucide-inbox" class="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 class="font-semibold text-slate-800 mb-2">
          ไม่มีเอกสารรอลงนาม
        </h3>
        <p class="text-sm text-slate-500">
          เมื่อมีเอกสารรอลงนาม จะแสดงที่นี่
        </p>
      </div>
    </template>
  </div>
</template>
