<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';

const props = withDefaults(defineProps<{
  items?: SelectItem[];
  valueKey?: string;
  placeholder?: string;
  searchInput?: boolean;
  clear?: boolean;
}>(), {
  searchInput: false,
});

const modelValue = defineModel<string | number | null>();
</script>

<template>
  <USelectMenu
    v-model="modelValue"
    :items="props.items"
    :value-key="props.valueKey"
    :placeholder="props.placeholder"
    :search-input="props.searchInput"
    :clear="props.clear"
    class="w-full"
  />
</template>
