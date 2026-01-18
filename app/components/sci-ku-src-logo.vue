<script setup lang="ts">
import sciKuSrcLogoPath from '../assets/images/sci-ku-src-logo.png';

type Props = {
  alt?: string;
  width?: string | number;
  class?: string;
};

const props = withDefaults(defineProps<Props>(), {
  alt: 'SCI KU SRC Logo',
  width: 120,
});

const imgStyle = computed(() => ({
  width: typeof props.width === 'number'
    ? `${props.width}px`
    : props.width,
}));
</script>

<template>
  <img
    :src="sciKuSrcLogoPath"
    :alt="alt"
    :style="imgStyle"
    class="block h-auto"
    :class="props.class"
  >
</template>
