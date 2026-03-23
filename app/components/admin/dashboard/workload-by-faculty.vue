<script setup lang="ts">
defineOptions({
  tags: ['barcharts', 'stackedhorizontal'],
});

type FacultyWorkloadItem = {
  faculty: string;
  completed: number;
  pending: number;
};

const chartData: FacultyWorkloadItem[] = [
  { faculty: 'Management Sciences', completed: 186, pending: 80 },
  { faculty: 'Engineering at Sriracha', completed: 305, pending: 200 },
  { faculty: 'Science at Sriracha', completed: 237, pending: 120 },
  { faculty: 'Economics at Sriracha', completed: 73, pending: 190 },
  { faculty: 'International Maritime Studies', completed: 209, pending: 130 },
];

const categories = {
  completed: { name: 'Completed', color: '#3b82f6' },
  pending: { name: 'Pending', color: '#dbeafe' },
};

function yFormatter(tick: number, _i?: number, _ticks?: number[]) {
  return `${chartData[tick]?.faculty ?? ''}`;
}
</script>

<template>
  <UCard>
    <div
      class="mx-auto max-w-3xl space-y-6 rounded-lg"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          Workload by Faculty
        </h3>
      </div>
      <BarChart
        :data="chartData"
        :stacked="true"
        :height="300"
        :categories="categories"
        :y-axis="['completed', 'pending']"
        :group-padding="0"
        :bar-padding="0.2"
        :x-num-ticks="6"
        :radius="4"
        :orientation="Orientation.Horizontal"
        :y-formatter="yFormatter"
        :legend-position="LegendPosition.TopRight"
        :hide-legend="false"
        :y-grid-line="true"
      />
    </div>
  </UCard>
</template>
