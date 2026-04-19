<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import type { UserDetail } from '~/types/user';

import { formatDate } from '~/utils/formatters';

defineProps<{
  user: UserDetail;
}>();

const { locale, t } = useI18n();
const localePath = useLocalePath();

type RequestSummaryStatus = 'in_progress' | 'rejected' | 'completed';

function goToRequests(studentId?: string | null, status?: RequestSummaryStatus) {
  if (!studentId)
    return;

  const query: Record<string, string> = { studentId };
  if (status)
    query.status = status;

  navigateTo(localePath({ path: '/admin/requests', query }));
}

type UserAssignment = UserDetail['assignments'][number];

const columns: TableColumn<UserAssignment>[] = [
  {
    id: 'no',
    header: '#',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ row }) => (row.index + 1).toLocaleString(),
  },
  {
    accessorKey: 'role',
    header: t('common.table.role'),
    cell: ({ row }) => locale.value === 'en' ? row.original.role : row.original.roleTh,
  },
  {
    accessorKey: 'faculty',
    header: t('common.table.faculty'),
    cell: ({ row }) => locale.value === 'en' ? row.original.faculty?.nameEn : row.original.faculty?.nameTh || '-',
  },
  {
    accessorKey: 'department',
    header: t('common.table.department'),
    cell: ({ row }) => locale.value === 'en' ? row.original.department?.nameEn : row.original.department?.nameTh || '-',
  },
];
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Sidebar -->
    <div class="lg:col-span-4 space-y-6">
      <!-- Basic Details Card -->
      <UCard :ui="{ body: 'p-2!' }">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-user" class="text-primary" />
            <h2 class="font-semibold">
              {{ $t('adminUsers.shared.sections.basic') }}
            </h2>
          </div>
        </template>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div v-if="user.studentId" class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              {{ $t('adminUsers.shared.form.studentId') }}
            </p>
            <p class="text-sm font-medium">
              {{ user.studentId || '-' }}
            </p>
          </div>
          <div v-if="user.staffId" class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              {{ $t('adminUsers.shared.form.staffId') }}
            </p>
            <p class="text-sm font-medium">
              {{ user.staffId || '-' }}
            </p>
          </div>
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              {{ $t('common.table.email') }}
            </p>
            <p class="text-sm font-medium">
              {{ user.email }}
            </p>
          </div>
          <!-- <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              Faculty
            </p>
            <p class="text-sm font-medium">
              {{ user.facultyName || '-' }}
            </p>
          </div> -->
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              {{ $t('common.table.createdAt') }}
            </p>
            <p class="text-sm font-medium">
              {{ formatDate(user.createdAt, locale) }}
            </p>
          </div>
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              {{ $t('common.table.updatedAt') }}
            </p>
            <p class="text-sm font-medium">
              {{ formatDate(user.updatedAt, locale) }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Main Content -->
    <div class="lg:col-span-8 space-y-6">
      <!-- Status Summary Card -->
      <UCard v-if="user.studentId">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-chart-no-axes-column-increasing" class="text-primary" />
            <h2 class="font-semibold">
              {{ $t('adminUsers.detail.requestStatusSummary.title') }}
            </h2>
          </div>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <!-- Total Requests -->
          <button
            type="button"
            class="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 text-left w-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/70"
            @click="goToRequests(user.studentId)"
          >
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-2">
              {{ $t('adminUsers.detail.requestStatusSummary.totalRequests') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ user.totalRequests.toLocaleString() }}
            </p>
          </button>

          <!-- Pending Action -->
          <button
            type="button"
            class="p-4 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-900/30 text-left w-full transition-colors hover:bg-warning-100 dark:hover:bg-warning-900/20"
            @click="goToRequests(user.studentId, 'in_progress')"
          >
            <p class="text-xs text-warning-600 dark:text-warning-400 font-medium uppercase mb-2">
              {{ $t('adminUsers.detail.requestStatusSummary.pending') }}
            </p>
            <p class="text-2xl font-bold text-warning-700 dark:text-warning-400">
              {{ user.pendingRequests.toLocaleString() }}
            </p>
          </button>

          <!-- Rejected -->
          <button
            type="button"
            class="p-4 rounded-lg bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-900/30 text-left w-full transition-colors hover:bg-error-100 dark:hover:bg-error-900/20"
            @click="goToRequests(user.studentId, 'rejected')"
          >
            <p class="text-xs text-error-600 dark:text-error-400 font-medium uppercase mb-2">
              {{ $t('adminUsers.detail.requestStatusSummary.rejected') }}
            </p>
            <p class="text-2xl font-bold text-error-700 dark:text-error-400">
              {{ user.rejectedRequests.toLocaleString() }}
            </p>
          </button>

          <!-- Approved -->
          <button
            type="button"
            class="p-4 rounded-lg bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-900/30 text-left w-full transition-colors hover:bg-success-100 dark:hover:bg-success-900/20"
            @click="goToRequests(user.studentId, 'completed')"
          >
            <p class="text-xs text-success-600 dark:text-success-400 font-medium uppercase mb-2">
              {{ $t('adminUsers.detail.requestStatusSummary.approved') }}
            </p>
            <p class="text-2xl font-bold text-success-700 dark:text-success-400">
              {{ user.approvedRequests.toLocaleString() }}
            </p>
          </button>
        </div>
      </UCard>

      <!-- Roles Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-shield-user" class="text-primary" />
            <h2 class="font-semibold">
              {{ $t('common.table.role') }}
            </h2>
          </div>
        </template>
        <UTable :data="user.assignments" :columns="columns" />
      </UCard>
    </div>
  </div>
</template>
