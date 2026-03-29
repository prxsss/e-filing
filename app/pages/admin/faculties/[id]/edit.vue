<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

definePageMeta({
  title: 'edit-faculty',
});

type FacultyDetail = {
  id: number;
  facultyCode: string;
  nameEn: string;
  nameTh: string;
};

const route = useRoute();
const localPath = useLocalePath();
const toast = useToast();
const { t } = useI18n();

const facultyId = Number(route.params.id);

const loading = ref(false);

const updateFacultySchema = z.object({
  facultyCode: z
    .string()
    .min(1, t('common.validation.required', { field: t('adminFaculties.shared.form.facultyCode') }))
    .max(20, t('common.validation.maxLength', { field: t('adminFaculties.shared.form.facultyCode'), max: 20 })),
  nameEn: z.string().min(1, t('common.validation.required', { field: t('adminFaculties.shared.form.nameEn') })),
  nameTh: z.string().min(1, t('common.validation.required', { field: t('adminFaculties.shared.form.nameTh') })),
});

type UpdateFacultySchema = z.output<typeof updateFacultySchema>;

const form = ref<UpdateFacultySchema>({
  facultyCode: '',
  nameEn: '',
  nameTh: '',
});

const { data: faculty } = await useFetch<FacultyDetail>(`/api/admin/faculties/${facultyId}`);

watch(
  faculty,
  (value) => {
    if (!value)
      return;

    form.value = {
      facultyCode: value.facultyCode,
      nameEn: value.nameEn,
      nameTh: value.nameTh,
    };
  },
  { immediate: true },
);

function handleCancel() {
  navigateTo(localPath('/admin/faculties'));
}

async function handleUpdateFaculty(event: FormSubmitEvent<UpdateFacultySchema>) {
  try {
    loading.value = true;

    await $fetch(`/api/admin/faculties/${facultyId}`, {
      method: 'PUT',
      body: {
        facultyCode: event.data.facultyCode.trim(),
        nameEn: event.data.nameEn.trim(),
        nameTh: event.data.nameTh.trim(),
      },
    });

    toast.add({
      title: t('adminFaculties.success.updateSuccess'),
      color: 'success',
    });

    navigateTo(localPath('/admin/faculties'));
  }
  catch (error: any) {
    toast.add({
      title: t('adminFaculties.error.updateError'),
      description: t('adminFaculties.error.updateErrorMessage', {
        message: error?.data?.message || 'Failed to update faculty. Please try again.',
      }),
      color: 'error',
    });
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <UButton
      type="button"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      :to="localPath('/admin/faculties')"
    >
      {{ t('common.actions.backTo', { page: t('adminFaculties.list.title') }) }}
    </UButton>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('adminFaculties.edit.title') }}
      </h1>
    </div>

    <UCard>
      <template #header>
        <div class="h-1.5 -mx-6 -mt-6 mb-5 bg-linear-to-r from-primary/80 via-primary to-cyan-500 rounded-t-[calc(var(--ui-radius)*1.2)]" />
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-building" class="text-primary size-5" />
          <h2 class="font-semibold">
            {{ t('adminFaculties.shared.section') }}
          </h2>
        </div>
      </template>

      <UForm
        :schema="updateFacultySchema"
        :state="form"
        class="space-y-6"
        @submit="handleUpdateFaculty"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField :label="t('adminFaculties.shared.form.facultyCode')" name="facultyCode" required>
            <UInput
              v-model="form.facultyCode"
              class="w-full"
              :placeholder="t('adminFaculties.shared.form.facultyCodePlaceholder')"
              size="xl"
            />
          </UFormField>

          <div class="hidden md:block" />

          <UFormField :label="t('adminFaculties.shared.form.nameEn')" name="nameEn" required>
            <UInput
              v-model="form.nameEn"
              class="w-full"
              :placeholder="t('adminFaculties.shared.form.nameEnPlaceholder')"
              size="xl"
            />
          </UFormField>

          <UFormField :label="t('adminFaculties.shared.form.nameTh')" name="nameTh" required>
            <UInput
              v-model="form.nameTh"
              class="w-full"
              :placeholder="t('adminFaculties.shared.form.nameThPlaceholder')"
              size="xl"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-default">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="t('common.actions.cancel')"
            @click="handleCancel"
          />
          <UButton
            type="submit"
            color="primary"
            :label="t('common.actions.save')"
            :loading="loading"
          />
        </div>
      </UForm>
    </UCard>
  </div>
</template>
