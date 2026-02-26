<script setup lang="ts">
import type { UserDetail } from '~/types/user';

import { formatDate } from '~/utils/formatters';

defineProps<{
  user: UserDetail;
  statusSummary: {
    totalRequests: number;
    pendingAction: number;
    approved: number;
  };
}>();
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Sidebar -->
    <div class="lg:col-span-4 space-y-6">
      <!-- Basic Details Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-user-20-solid" class="text-gray-400" />
            <h2 class="font-semibold">
              Basic details
            </h2>
          </div>
        </template>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              ID
            </p>
            <p class="text-sm font-medium">
              {{ user.id }}
            </p>
          </div>
          <div class="p-5">
            <p class="text-xs text-gray-500 font-medium uppercase mb-1">
              Faculty
            </p>
            <p class="text-sm font-medium">
              {{ user.facultyName || '-' }}
            </p>
          </div>
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
            <UIcon name="i-heroicons-chart-bar-20-solid" class="text-gray-400" />
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
              {{ statusSummary.totalRequests }}
            </p>
          </div>

          <!-- Pending Action -->
          <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <p class="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase mb-2">
              Pending Action
            </p>
            <p class="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {{ statusSummary.pendingAction }}
            </p>
          </div>

          <!-- Approved -->
          <div class="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase mb-2">
              Approved
            </p>
            <p class="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {{ statusSummary.approved }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- Roles Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-users-20-solid" class="text-gray-400" />
            <h2 class="font-semibold">
              Roles
            </h2>
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="role in user.roles"
              :key="role.id"
              color="primary"
              variant="soft"
              class="text-sm"
            >
              {{ role.name }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <!-- Digital Signature Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-pencil-20-solid" class="text-gray-400" />
            <h2 class="font-semibold">
              Digital Signature
            </h2>
          </div>
        </template>

        <!-- No Signature State -->
        <div v-if="true" class="flex flex-col items-center justify-center py-8">
          <div class="flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon name="i-heroicons-document-plus-20-solid" class="w-7 h-7 text-gray-400" />
          </div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            No Signature Uploaded
          </h3>
          <p class="text-xs text-gray-600 dark:text-gray-400 text-center mb-4">
            User needs to upload a digital signature
          </p>
          <!-- <UButton
            label="Manage Signature"
            color="primary"
            variant="soft"
            size="sm"
          /> -->
        </div>

        <!-- Has Signature State -->
        <div v-else class="flex flex-col md:flex-row gap-8 items-center">
          <div class="w-full md:w-64 h-32 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center p-4">
            <img
              :src="undefined"
              alt="Signature Preview"
              class="max-h-full dark:invert opacity-80"
            >
          </div>
          <div class="flex-1 space-y-4">
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Last used on Oct 24, 2024 for <NuxtLink to="#" class="text-primary hover:underline">
                Document #2344
              </NuxtLink>
            </p>
            <!-- <UButton
              label="Manage Signature"
              color="primary"
              variant="link"
            /> -->
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
