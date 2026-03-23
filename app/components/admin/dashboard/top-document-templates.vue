<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { h } from 'vue';

type TopDocumentTemplate = {
  templateName: string;
  usage: number;
  completion: number;
};

const data = ref<TopDocumentTemplate[]>([
  {
    templateName: 'Grant Application Form',
    usage: 2450,
    completion: 0.96,
  },
  {
    templateName: 'Course Credit Waiver',
    usage: 1820,
    completion: 0.92,
  },
  {
    templateName: 'Faculty Recruitment Dossier',
    usage: 920,
    completion: 0.85,
  },
  {
    templateName: 'Sabbatical Leave Request',
    usage: 420,
    completion: 0.75,
  },
  {
    templateName: 'Research Ethics Approval',
    usage: 380,
    completion: 0.90,
  },
]);

const columns: TableColumn<TopDocumentTemplate>[] = [
  {
    accessorKey: 'templateName',
    header: 'Template Name',
  },
  {
    accessorKey: 'usage',
    header: 'Usage',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ getValue }) => {
      const value = getValue() as number;
      return value.toLocaleString();
    },
  },
  {
    accessorKey: 'completion',
    header: 'Completion',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ getValue }) => {
      const value = getValue() as number;
      const percentage = Math.round(value * 100);
      const colorClass = percentage >= 90
        ? 'text-success'
        : percentage >= 75
          ? 'text-warning'
          : 'text-error';
      return h('span', { class: `${colorClass} font-semibold` }, `${percentage}%`);
    },
  },
];
</script>

<template>
  <UCard>
    <h3 class="font-bold mb-6 text-text-main">
      Top Document Templates
    </h3>
    <UTable :data :columns class="flex-1" />
  </UCard>
</template>
