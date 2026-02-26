<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import type { RequestStatus } from '~/utils/request-status';

type Request = {
  id: string;
  title: string;
  status: RequestStatus;
  role: string;
};

defineProps<{
  requests: Request[];
  columns: TableColumn<Request>[];
}>();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-document-20-solid" class="text-gray-400" />
        <h2 class="font-semibold">
          Related Requests
        </h2>
      </div>
    </template>

    <UTable :data="requests" :columns="columns" />

    <template #footer>
      <div class="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
        <p class="text-sm text-gray-500">
          Showing 3 of 12 documents
        </p>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-heroicons-chevron-left-20-solid"
            color="neutral"
            variant="soft"
            size="sm"
          />
          <UButton
            icon="i-heroicons-chevron-right-20-solid"
            color="neutral"
            variant="soft"
            size="sm"
          />
        </div>
      </div>
    </template>
  </UCard>
</template>
