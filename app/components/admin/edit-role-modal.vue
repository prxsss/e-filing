<script setup lang="ts">
import * as z from 'zod';

const props = defineProps<{
  role: {
    id: number;
    name: string;
    nameTh: string;
    descriptionEn: string | null;
    descriptionTh: string | null;
  };
}>();

const emit = defineEmits<{ close: [boolean] }>();

const { t } = useI18n();
const toast = useToast();
const loading = ref(false);
const isAdminRole = computed(() => props.role.name.toLowerCase() === 'admin');

const editRoleSchema = z.object({
  name: z.string().min(1, t('adminAccessControl.roleNameRequiredEn')),
  nameTh: z.string().min(1, t('adminAccessControl.roleNameRequiredTh')),
  descriptionEn: z.string().optional(),
  descriptionTh: z.string().optional(),
});

type EditRoleSchema = z.output<typeof editRoleSchema>;

const form = ref<EditRoleSchema>({
  name: props.role.name,
  nameTh: props.role.nameTh,
  descriptionEn: props.role.descriptionEn ?? '',
  descriptionTh: props.role.descriptionTh ?? '',
});

async function handleSubmit(event: { data: EditRoleSchema }) {
  loading.value = true;
  try {
    await $fetch(`/api/roles/${props.role.id}`, {
      method: 'PATCH',
      body: {
        name: isAdminRole.value ? props.role.name : event.data.name,
        nameTh: isAdminRole.value ? props.role.nameTh : event.data.nameTh,
        descriptionEn: event.data.descriptionEn || null,
        descriptionTh: event.data.descriptionTh || null,
      },
    });
    toast.add({ title: t('adminAccessControl.editRole'), description: t('adminAccessControl.roleUpdatedSuccess'), color: 'success' });
    emit('close', true);
  }
  catch (error: any) {
    if (error?.statusCode === 409 && error?.data?.code === 'ADMIN_ROLE_NAME_LOCKED') {
      toast.add({ title: t('adminAccessControl.editRole'), description: t('adminAccessControl.adminRoleNameLocked'), color: 'error' });
      return;
    }

    const message = error?.data?.statusMessage || t('adminAccessControl.roleUpdateFailed');
    toast.add({ title: t('error'), description: message, color: 'error' });
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal :title="t('adminAccessControl.editRole')" :close="{ onClick: () => emit('close', false) }">
    <template #body>
      <UForm :schema="editRoleSchema" :state="form" class="space-y-4" @submit="handleSubmit">
        <UFormField :label="t('adminAccessControl.roleName')" name="name" required>
          <UInput v-model="form.name" :placeholder="t('adminAccessControl.roleNamePlaceholder')" class="w-full" :disabled="isAdminRole" />
          <p v-if="isAdminRole" class="text-xs text-error mt-1">
            {{ t('adminAccessControl.adminRoleNameLocked') }}
          </p>
        </UFormField>

        <UFormField :label="t('adminAccessControl.roleNameTh')" name="nameTh" required>
          <UInput v-model="form.nameTh" :placeholder="t('adminAccessControl.roleNameThPlaceholder')" class="w-full" :disabled="isAdminRole" />
          <p v-if="isAdminRole" class="text-xs text-error mt-1">
            {{ t('adminAccessControl.adminRoleNameLocked') }}
          </p>
        </UFormField>

        <UFormField :label="t('adminAccessControl.descriptionEn')" name="descriptionEn">
          <UTextarea v-model="form.descriptionEn" :placeholder="t('adminAccessControl.descriptionEnPlaceholder')" class="w-full" :rows="3" />
        </UFormField>

        <UFormField :label="t('adminAccessControl.descriptionTh')" name="descriptionTh">
          <UTextarea v-model="form.descriptionTh" :placeholder="t('adminAccessControl.descriptionThPlaceholder')" class="w-full" :rows="3" />
        </UFormField>

        <div class="flex justify-end gap-3 pt-2">
          <UButton color="neutral" variant="subtle" :label="t('cancel')" @click="emit('close', false)" />
          <UButton type="submit" :label="t('saveChanges')" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
