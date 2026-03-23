<script setup lang="ts">
const items = ref([
  { name: 'Head of Dept Approval', value: 1.2, avg: '1.2 days' },
  { name: 'Dean Signature', value: 3.8, avg: '3.8 days' },
  { name: 'Registrar Verification', value: 0.5, avg: '0.5 days' },
  { name: 'Financial Clearance', value: 4.1, avg: '4.1 days' },
]);

function getColor(value: number) {
  if (value <= 2)
    return 'success';
  if (value <= 4)
    return 'warning';
  return 'error';
}
</script>

<template>
  <UCard>
    <h3 class="font-bold mb-6 text-text-main">
      Signature Bottlenecks
    </h3>
    <div class="space-y-6">
      <div v-for="(item, index) in items" :key="index">
        <div class="flex justify-between text-xs font-medium mb-1.5">
          <span class="text-text-main">{{ item.name }}</span>
          <span class="text-text-secondary">{{ item.avg }}</span>
        </div>
        <UProgress v-model="item.value" :max="5" :color="getColor(item.value)" />
      </div>
    </div>
  </UCard>
</template>
