<script setup lang="ts">
definePageMeta({
  layout: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <UError
    :redirect="localePath('/')"
    :error="{
      statusCode: 404,
      statusMessage: t('errors.404.title'),
      message: t('errors.404.description'),
    }"
  />
</template>
