<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import type { UserDetail } from '~/types/user';

import { formatDate } from '~/utils/formatters';

defineProps<{
  user: UserDetail;
}>();

type UserAssignment = UserDetail['assignments'][number];

const columns: TableColumn<UserAssignment>[] = [
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => row.original.role || '-',
  },
  {
    accessorKey: 'faculty',
    header: 'Faculty',
    cell: ({ row }) => row.original.faculty?.nameEn || row.original.faculty?.nameTh || '-',
  },
  {
    accessorKey: 'department',
    header: 'Department',
    cell: ({ row }) => row.original.department?.nameEn || row.original.department?.nameTh || '-',
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
              Basic details
            </h2>
          </div>
        </template>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              Email
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
              Created At
            </p>
            <p class="text-sm font-medium">
              {{ formatDate(user.createdAt) }}
            </p>
          </div>
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              Updated At
            </p>
            <p class="text-sm font-medium">
              {{ formatDate(user.updatedAt) }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Main Content -->
    <div class="lg:col-span-8 space-y-6">
      <!-- Status Summary Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-chart-no-axes-column-increasing" class="text-primary" />
            <h2 class="font-semibold">
              Status Summary
            </h2>
          </div>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <!-- Total Requests -->
          <div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-2">
              Total Requests
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ user.totalRequests.toLocaleString() }}
            </p>
          </div>

          <!-- Pending Action -->
          <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <p class="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase mb-2">
              Pending Action
            </p>
            <p class="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {{ user.pendingRequests.toLocaleString() }}
            </p>
          </div>

          <!-- Approved -->
          <div class="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase mb-2">
              Approved
            </p>
            <p class="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {{ user.approvedRequests.toLocaleString() }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- Roles Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-shield-user" class="text-primary" />
            <h2 class="font-semibold">
              Roles
            </h2>
          </div>
        </template>
        <UTable :data="user.assignments" :columns="columns" />
      </UCard>
    </div>
  </div>
</template>
