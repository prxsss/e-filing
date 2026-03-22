<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { formatDate } from '~/utils/formatters';

type ActivityLog = {
  timestamp: string;
  actionType: string;
  description: string;
  actor: string;
};

const data = ref<ActivityLog[]>([
  {
    timestamp: '2024-10-24T14:30:00',
    actionType: 'Request Cancelled',
    description: 'Cancelled request "Annual Lab Safety Report #SR-2024-11"',
    actor: 'Self',
  },
  {
    timestamp: '2024-10-24T11:45:00',
    actionType: 'Request Submitted',
    description: 'Submitted request "Annual Lab Safety Report #SR-2024-11" for approval',
    actor: 'Self',
  },
  {
    timestamp: '2024-10-23T09:12:00',
    actionType: 'Request Saved Draft',
    description: 'Saved draft for "Annual Lab Safety Report #SR-2024-11"',
    actor: 'Self',
  },
  {
    timestamp: '2024-10-21T16:55:00',
    actionType: 'Request Created',
    description: 'Created request "Annual Lab Safety Report #SR-2024-11"',
    actor: 'Self',
  },
]);

const columns: TableColumn<ActivityLog>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Timestamp',
    cell: ({ row }) => {
      return formatDate(row.getValue('timestamp') as string);
    },
  },
  {
    accessorKey: 'actionType',
    header: 'Action Type',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'actor',
    header: 'Performed By',
  },
];
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-history" class="text-primary" />
          <h2 class="font-semibold">
            Activity Log
          </h2>
        </div>
      </div>
    </template>

    <UTable :data="data" :columns="columns" />
  </UCard>
</template>
