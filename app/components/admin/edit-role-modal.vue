<script setup lang="ts">
import * as z from 'zod';

const props = defineProps<{
  role: {
    id: number;
    name: string;
    descriptionEN: string | null;
    descriptionTH: string | null;
  };
}>();

const emit = defineEmits<{ close: [boolean] }>();

const { t } = useI18n();
const toast = useToast();
const loading = ref(false);

const editRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  descriptionEN: z.string().optional(),
  descriptionTH: z.string().optional(),
});

type EditRoleSchema = z.output<typeof editRoleSchema>;

const form = ref<EditRoleSchema>({
  name: props.role.name,
  descriptionEN: props.role.descriptionEN ?? '',
  descriptionTH: props.role.descriptionTH ?? '',
});

async function handleSubmit(event: { data: EditRoleSchema }) {
  loading.value = true;
  try {
    await $fetch(`/api/roles/${props.role.id}`, {
      method: 'PATCH',
      body: {
        name: event.data.name,
        descriptionEN: event.data.descriptionEN || null,
        descriptionTH: event.data.descriptionTH || null,
      },
    });
    toast.add({ title: t('editRole'), description: t('roleUpdatedSuccess'), color: 'success' });
    emit('close', true);
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || t('roleUpdateFailed');
    toast.add({ title: t('error'), description: message, color: 'error' });
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal :title="t('editRole')" :close="{ onClick: () => emit('close', false) }">
    <template #body>
      <UForm :schema="editRoleSchema" :state="form" class="space-y-4" @submit="handleSubmit">
        <UFormField :label="t('roleName')" name="name" required>
          <UInput v-model="form.name" :placeholder="t('roleNamePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('descriptionEN')" name="descriptionEN">
          <UTextarea v-model="form.descriptionEN" :placeholder="t('descriptionENPlaceholder')" class="w-full" :rows="3" />
        </UFormField>

        <UFormField :label="t('descriptionTH')" name="descriptionTH">
          <UTextarea v-model="form.descriptionTH" :placeholder="t('descriptionTHPlaceholder')" class="w-full" :rows="3" />
        </UFormField>

        <div class="flex justify-end gap-3 pt-2">
          <UButton color="neutral" variant="subtle" :label="t('cancel')" @click="emit('close', false)" />
          <UButton type="submit" :label="t('saveChanges')" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
