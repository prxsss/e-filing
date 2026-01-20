<script lang="ts" setup>
definePageMeta({
  title: 'requestDetails',
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">
      Request Details ID: {{ $route.params.id }}
    </h1>
    <p>View and manage your request details here.</p>
  </div>
</template>

<style>

</style>
