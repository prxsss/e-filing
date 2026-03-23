<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

defineOptions({
  tags: ['barcharts', 'stacked'],
});

definePageMeta({
  title: 'adminDashboard',
  middleware: ['permission'],
  permission: 'dashboard.admin.view',
});

const selectedFaculty = ref('All Faculties');
const facultyOptions = ref([
  'All Faculties',
  'Faculty of Management Sciences',
  'Faculty of Engineering at Sriracha',
  'Faculty of Science at Sriracha',
  'Faculty of Economics at Sriracha',
  'Faculty of International Maritime Studies',
]);

const selectedPeriod = ref('Last 30 days');
const periodOptions = ref([
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last 14 days',
  'Last 30 days',
  'This week',
  'Last week',
  'This month',
  'Last month',
  'This quarter',
  'Last quarter',
  'Year to date (YTD)',
  'Last 12 months',
]);

const autoRefresh = ref(false);
const selectedAutoRefresh = ref(15000);
const autoRefreshOptions = computed<DropdownMenuItem[]>(() => ([
  {
    label: '15s',
    type: 'checkbox',
    checked: selectedAutoRefresh.value === 15000,
    onUpdateChecked: (checked: boolean) => {
      if (checked)
        selectedAutoRefresh.value = 15000;
    },
  },
  {
    label: '30s',
    type: 'checkbox',
    checked: selectedAutoRefresh.value === 30000,
    onUpdateChecked: (checked: boolean) => {
      if (checked)
        selectedAutoRefresh.value = 30000;
    },
  },
  {
    label: '1m',
    type: 'checkbox',
    checked: selectedAutoRefresh.value === 60000,
    onUpdateChecked: (checked: boolean) => {
      if (checked)
        selectedAutoRefresh.value = 60000;
    },
  },
]));
</script>

<template>
  <div>
    <div class="flex flex-col justify-center lg:flex-row lg:items-center lg:justify-between mb-8 gap-6">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-text-main mb-2">
          Academic Oversight Dashboard
        </h2>
        <p class="text-text-secondary">
          Monitoring real-time document flow and signature bottlenecks across departments.
        </p>
      </div>
      <div class="self-end lg:self-auto flex gap-3">
        <USelect
          v-model="selectedFaculty" icon="i-lucide-building" :items="facultyOptions" :ui="{
            content: 'min-w-fit',
          }"
        />
        <USelect
          v-model="selectedPeriod" icon="i-lucide-calendar" :items="periodOptions" :ui="{
            content: 'min-w-fit',
          }"
        />
        <UFieldGroup>
          <UTooltip :delay-duration="200" text="Auto Refresh">
            <UButton icon="i-lucide-refresh-ccw" :color="autoRefresh ? 'primary' : 'neutral'" variant="subtle" @click="autoRefresh = !autoRefresh" />
          </UTooltip>
          <UDropdownMenu
            arrow
            :items="autoRefreshOptions"
            :content="{
              align: 'end',
              side: 'bottom' }"
          >
            <UButton color="neutral" variant="outline" icon="i-lucide-chevron-down" />
          </UDropdownMenu>
        </UFieldGroup>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Total Requests
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            14,250
          </h3>
          <!-- <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 12% </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Completion Rate
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            88.5%
          </h3>
          <!-- <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 2.5%
          </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Median Turnaround
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            4.2 hrs
          </h3>
          <!-- <span class="text-warning text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-arrow-right" class="mr-1" /> 0.0
          </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-error uppercase tracking-wider mb-1">
          Overdue Requests
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-error">
            42
          </h3>
          <!-- <span class="text-error text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-alert-triangle" class="mr-1" /> Urgent
          </span> -->
        </div>
      </UCard>

      <UCard>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
          Active Users
        </p>
        <div class="flex items-end justify-between">
          <h3 class="text-2xl font-bold text-text-main">
            1,200
          </h3>
          <!-- <span class="text-success text-xs font-bold flex items-center mb-1">
            <UIcon name="i-lucide-trending-up" class="mr-1" /> 8%
          </span> -->
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- Request Trends -->
      <AdminDashboardRequestTrend class="lg:col-span-2" />

      <!-- Signature Bottlenecks -->
      <AdminDashboardSignatureBottlenecks />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Workload by Faculty -->
      <AdminDashboardWorkloadByFaculty />

      <!-- Top Document Templates -->
      <AdminDashboardTopDocumentTemplates />
    </div>
  </div>
</template>
