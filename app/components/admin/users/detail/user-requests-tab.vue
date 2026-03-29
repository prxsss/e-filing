<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui';

import type { RequestStatus } from '~/utils/request-status';

defineProps<{
  requests: Request[];
  total: number | undefined;
  columns: TableColumn<Request>[];
}>();

const localePath = useLocalePath();

type Request = {
  id: string;
  title: string;
  status: RequestStatus;
  submittedAt: string;
};

const page = defineModel('page', { type: Number, default: 1 });
const pageSize = defineModel('pageSize', { type: Number, default: 5 });

function onRowSelect(_e: Event, row: TableRow<Request>) {
  navigateTo(localePath(`/admin/requests/${row.original.id}`));
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-file-text" class="text-primary" />
        <h2 class="font-semibold">
          {{ $t('adminUsers.detail.tabs.requests') }}
        </h2>
      </div>
    </template>

    <UTable
      :data="requests" :columns="columns" :ui="{
        tr: 'cursor-pointer',
      }" @select="onRowSelect"
    >
      <template #actions-cell>
        <UIcon name="i-lucide-chevron-right" class="w-5 h-5" />
      </template>
    </UTable>
    <div class="flex justify-center gap-2 border-t border-default pt-4 px-4">
      <UPagination
        v-model:page="page"
        :items-per-page="pageSize"
        :total="total"
        show-edges
      />
      <USelect v-model="pageSize" :items="[5, 10, 20, 50]" />
    </div>
  </UCard>
</template>
