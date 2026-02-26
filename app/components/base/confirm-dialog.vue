<script setup lang="ts">
type CancelButton = {
  label: string;
};

type ConfirmButton = {
  label: string;
  color: 'primary' | 'error';
};

const props = defineProps<{
  title: string;
  description?: string;
  cancelButton: CancelButton;
  confirmButton: ConfirmButton;
}>();

const emit = defineEmits<{ close: [boolean] }>();
</script>

<template>
  <UModal
    :close="{ onClick: () => emit('close', false) }" :title :description :ui="{
      footer: 'justify-end',
    }"
  >
    <template #footer>
      <UButton
        color="neutral"
        variant="subtle"
        @click="emit('close', false)"
      >
        {{ props.cancelButton.label }}
      </UButton>
      <UButton
        :color="props.confirmButton.color"
        @click="emit('close', true)"
      >
        {{ props.confirmButton.label }}
      </UButton>
    </template>
  </UModal>
</template>
