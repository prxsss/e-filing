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
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  reasonErrorMessage?: string;
  cancelButton: CancelButton;
  confirmButton: ConfirmButton;
}>();

const emit = defineEmits<{ close: [{
  confirmed: boolean;
  confirmationReason?: string;
}]; }>();

const confirmationReason = ref<string>('');
const submitted = ref(false);

function onConfirm() {
  submitted.value = true;
  if (props.reasonRequired && confirmationReason.value.trim() === '')
    return;

  emit('close', { confirmed: true, confirmationReason: confirmationReason.value });
}
</script>

<template>
  <UModal
    :close="{ onClick: () => emit('close', { confirmed: false }) }" :title :description :ui="{
      footer: 'justify-end',
    }"
  >
    <template #body>
      <UAlert
        v-if="reasonRequired && submitted && confirmationReason.trim() === ''"
        :title="reasonErrorMessage"
        color="error"
        variant="subtle"
        class="mb-2"
      />
      <UTextarea v-model="confirmationReason" :placeholder="reasonPlaceholder" class="w-full" required />
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="subtle"
        @click="emit('close', { confirmed: false })"
      >
        {{ props.cancelButton.label }}
      </UButton>
      <UButton
        :color="props.confirmButton.color"
        @click="onConfirm"
      >
        {{ props.confirmButton.label }}
      </UButton>
    </template>
  </UModal>
</template>
