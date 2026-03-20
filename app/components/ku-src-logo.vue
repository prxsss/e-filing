<script setup lang="ts">
import kuSrcLogoPath from '../assets/images/ku-src-logo.png';

type Props = {
  alt?: string;
};

const props = withDefaults(defineProps<Props>(), {
  alt: 'KU SRC Logo',
});
</script>

<template>
  <img
    :src="kuSrcLogoPath"
    :alt="props.alt"
    draggable="false"
  >
</template>
