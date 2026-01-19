<script setup lang="ts">
definePageMeta({
  title: 'dashboard',
});

const { t } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

const stats = computed(() => [
  { label: t('totalRequests'), value: '12', icon: 'i-lucide-file-text', color: 'bg-blue-100', textColor: 'text-blue-600' },
  { label: t('inProgress'), value: '3', icon: 'i-lucide-clock', color: 'bg-amber-100', textColor: 'text-amber-600' },
  { label: t('approved'), value: '8', icon: 'i-lucide-check-circle-2', color: 'bg-green-100', textColor: 'text-green-600' },
  { label: t('rejected'), value: '1', icon: 'i-lucide-x-circle', color: 'bg-red-100', textColor: 'text-red-600' },
]);

type Request = {
  id: string;
  title: string;
  date: string;
  status: 'Approved' | 'In Progress' | 'Rejected' | 'Draft';
  signer: string;
  progress: number;
};

const recentRequests: Request[] = [
  { id: 'REQ-2024-001', title: 'Late Registration (Course 01204)', date: '2024-01-10', status: 'Approved', signer: 'Dean of Engineering', progress: 100 },
  { id: 'REQ-2024-002', title: 'Tuition Fee Installment', date: '2024-01-12', status: 'In Progress', signer: 'Dr. Suthep Panya', progress: 60 },
  { id: 'REQ-2024-003', title: 'Activity Room Booking', date: '2024-01-15', status: 'Rejected', signer: 'Building Manager', progress: 100 },
  { id: 'REQ-2024-004', title: 'Add/Drop Course Request', date: '2024-01-18', status: 'Draft', signer: '-', progress: 0 },
];

function getStatusColor(status: Request['status']) {
  const statusMap: Record<Request['status'], string> = {
    'Approved': 'bg-green-100 text-green-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Rejected': 'bg-red-100 text-red-700',
    'Draft': 'bg-slate-100 text-slate-700',
  };
  return statusMap[status];
}

function handleViewRequest(requestId: string) {
  // Navigate to my-requests page with request details
  // In a real app, this would navigate to a detail page or open a modal
  router.push(localePath(`/student/my-requests?id=${requestId}`));
}
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="stat in stats" :key="stat.label" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
          <p class="text-sm font-medium text-slate-500 mb-2">
            {{ stat.label }}
          </p>
          <p class="text-2xl font-bold text-slate-800">
            {{ stat.value }}
          </p>
        </div>
        <div :class="`${stat.color} p-3 rounded-lg`">
          <UIcon :name="stat.icon" :class="`${stat.textColor} size-6`" />
        </div>
      </div>
    </div>

    <!-- Recent Requests Table -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-100 flex justify-between items-center">
        <h3 class="font-semibold text-slate-800">
          {{ t('recentRequests') }}
        </h3>
        <UButton variant="ghost" class="text-xs" :to="localePath('/student/my-requests')">
          {{ t('viewAll') }}
        </UButton>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
            <tr>
              <th class="px-5 py-3">
                {{ t('requestTitle') }}
              </th>
              <th class="px-5 py-3">
                {{ t('submittedDate') }}
              </th>
              <th class="px-5 py-3">
                {{ t('status') }}
              </th>
              <th class="px-5 py-3">
                {{ t('currentSigner') }}
              </th>
              <th class="px-5 py-3">
                {{ t('progress') }}
              </th>
              <th class="px-5 py-3">
                {{ t('action') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="request in recentRequests" :key="request.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-5 py-4 font-medium text-slate-800">
                {{ request.title }}
              </td>
              <td class="px-5 py-4 text-slate-600">
                {{ request.date }}
              </td>
              <td class="px-5 py-4">
                <UBadge :class="getStatusColor(request.status)" variant="subtle">
                  {{ request.status }}
                </UBadge>
              </td>
              <td class="px-5 py-4 text-slate-600">
                {{ request.signer }}
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center gap-2">
                  <UProgress v-model="request.progress" size="sm" />
                  <span class="text-xs font-semibold text-slate-600 min-w-fit">{{ request.progress }}%</span>
                </div>
              </td>
              <td class="px-5 py-4">
                <UButton
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-eye"
                  :aria-label="t('view')"
                  @click="handleViewRequest(request.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
