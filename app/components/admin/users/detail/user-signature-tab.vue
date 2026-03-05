<script setup lang="ts">
import type { UserListItem } from '~/types/user';

defineProps<{
  user: UserListItem;
  signatureDetails: {
    status: string;
    lastUsed: string;
    fileType: string;
  };
}>();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-pencil-20-solid" class="text-gray-400" />
        <h2 class="font-semibold">
          Signature Management
        </h2>
      </div>
    </template>

    <!-- No Signature State -->
    <div v-if="!user.signature" class="flex flex-col items-center justify-center py-12">
      <div class="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
        <UIcon name="i-heroicons-document-plus-20-solid" class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        No Signature Found
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
        This user has not uploaded a signature yet. Upload one to enable signature functionality.
      </p>
      <UButton
        icon="i-heroicons-arrow-up-tray-20-solid"
        label="Upload Signature"
        color="primary"
        size="md"
      />
    </div>

    <!-- Has Signature State -->
    <div v-else class="flex flex-col lg:flex-row gap-12">
      <!-- Current Signature Section -->
      <div class="flex-1">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
          Current Signature
        </h3>
        <div class="aspect-16/6 w-full bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center overflow-hidden relative">
          <img
            :src="user.signature"
            alt="Signature Preview"
            class="absolute opacity-10 grayscale scale-150 z-0"
          >
          <div class="relative z-10 flex items-center justify-center">
            <span class="text-gray-300 dark:text-gray-700 font-display text-4xl italic select-none">
              {{ user.name }}
            </span>
          </div>
        </div>
      </div>

      <!-- Signature Details Section -->
      <div class="lg:w-96 flex flex-col">
        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
              Signature Details
            </h3>
            <div class="space-y-4">
              <!-- Status -->
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800">
                <span class="text-gray-600 dark:text-gray-400">Status</span>
                <UBadge
                  color="success"
                  variant="subtle"
                  icon="i-heroicons-check-circle-20-solid"
                  class="text-xs font-semibold"
                >
                  {{ signatureDetails.status }}
                </UBadge>
              </div>

              <!-- Last Used -->
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800">
                <span class="text-gray-600 dark:text-gray-400">Last Used</span>
                <span class="text-gray-900 dark:text-gray-100 font-medium">
                  {{ signatureDetails.lastUsed }}
                </span>
              </div>

              <!-- File Type -->
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800">
                <span class="text-gray-600 dark:text-gray-400">File Type</span>
                <span class="text-gray-900 dark:text-gray-100 font-medium">
                  {{ signatureDetails.fileType }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-8 flex flex-col gap-3">
          <UButton
            icon="i-heroicons-arrow-up-tray-20-solid"
            label="Force Re-upload"
            block
            color="neutral"
            variant="soft"
          />
          <UButton
            icon="i-heroicons-no-symbol-20-solid"
            label="Disable Signature"
            block
            color="error"
            variant="soft"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
