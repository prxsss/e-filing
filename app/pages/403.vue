<script setup lang="ts">
definePageMeta({
  layout: false,
});

const localePath = useLocalePath();
</script>

<template>
  <UError
    :redirect="localePath('/')"
    :error="{
      statusCode: 403,
      statusMessage: 'Access denied',
      message: 'You do not have permission to access this page.',
    }"
  />
</template>
