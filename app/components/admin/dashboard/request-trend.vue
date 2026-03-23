<script setup lang="ts">
defineOptions({
  tags: ['linecharts', 'multilines'],
});

const chartData = [
  { month: 'January', submissions: 186, completes: 186 },
  { month: 'February', submissions: 305, completes: 305 },
  { month: 'March', submissions: 237, completes: 237 },
  { month: 'April', submissions: 260, completes: 209 },
  { month: 'May', submissions: 209, completes: 209 },
  { month: 'June', submissions: 250, completes: 214 },
];

const categories: Record<string, BulletLegendItemInterface> = {
  submissions: { name: 'Submissions', color: '#3b82f6' },
  completes: { name: 'Completes', color: '#22c55e' },
};

function xFormatter(tick: number, _i?: number, _ticks?: number[]): string {
  return chartData[tick]?.month ?? '';
}
</script>

<template>
  <UCard>
    <div
      class="mx-auto max-w-3xl space-y-6 rounded-lg"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          Request Trends
        </h3>
      </div>
      <LineChart
        :data="chartData"
        :height="300"
        y-label="Number of Requests"
        :x-num-ticks="2"
        :categories="categories"
        :x-formatter="xFormatter"
        :y-grid-line="true"
        :curve-type="CurveType.MonotoneX"
        :legend-position="LegendPosition.TopRight"
        :hide-legend="false"
      />
    </div>
  </UCard>
</template>
