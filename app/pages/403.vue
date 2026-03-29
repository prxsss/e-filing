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
      statusCode: 403,
      statusMessage: t('errorAccessDenied'),
      message: t('errorAccessDeniedMessage'),
    }"
  />
</template>
