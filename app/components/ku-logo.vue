<script setup lang="ts">
import kuLogoPath from '../assets/images/ku-logo.png';

type Props = {
  alt?: string;
};

const props = withDefaults(defineProps<Props>(), {
  alt: 'KU Logo',
});
</script>

<template>
  <img
    :src="kuLogoPath"
    :alt="props.alt"
    draggable="false"
  >
</template>
