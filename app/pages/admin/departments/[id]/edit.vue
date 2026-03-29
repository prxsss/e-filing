<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

definePageMeta({
  title: 'edit-department',
  middleware: ['permission'],
  permission: 'department.edit',
});

type FacultyItem = {
  id: number;
  facultyCode: string;
  nameEn: string;
  nameTh: string;
};

type DepartmentDetail = {
  id: number;
  departmentCode: string;
  nameEn: string;
  nameTh: string;
  facultyId: number;
};

const route = useRoute();
const localPath = useLocalePath();
const { locale, t } = useI18n();
const toast = useToast();

const departmentId = Number(route.params.id);
const loading = ref(false);

const updateDepartmentSchema = z.object({
  departmentCode: z
    .string()
    .trim()
    .min(1, t('common.validation.required', { field: t('adminDepartments.form.code') }))
    .max(20, t('common.validation.maxLength', { field: t('adminDepartments.form.code'), count: 20 })),
  facultyId: z
    .string()
    .trim()
    .min(1, t('common.validation.required', { field: t('adminDepartments.form.faculty') }))
    .refine(value => Number.isInteger(Number(value)) && Number(value) > 0, t('adminDepartments.validation.facultyRequired'))
    .transform(value => Number(value)),
  nameEn: z.string().trim().min(1, t('common.validation.required', { field: t('adminDepartments.form.nameEn') })).max(255),
  nameTh: z.string().trim().min(1, t('common.validation.required', { field: t('adminDepartments.form.nameTh') })).max(255),
});

type UpdateDepartmentSubmit = z.output<typeof updateDepartmentSchema>;
type UpdateDepartmentForm = z.input<typeof updateDepartmentSchema>;

const form = ref<UpdateDepartmentForm>({
  departmentCode: '',
  facultyId: '',
  nameEn: '',
  nameTh: '',
});

const { data: department } = await useFetch<DepartmentDetail>(`/api/admin/departments/${departmentId}`);

const { data: facultiesData, status: facultiesStatus } = await useFetch<{
  rows: FacultyItem[];
  total: number;
  page: number;
  pageSize: number;
}>('/api/admin/faculties', {
  query: {
    page: 1,
    pageSize: 100,
  },
});

const facultyOptions = computed(() => {
  return (facultiesData.value?.rows ?? []).map(faculty => ({
    label: locale.value === 'en'
      ? `${faculty.facultyCode} - ${faculty.nameEn}`
      : `${faculty.facultyCode} - ${faculty.nameTh}`,
    value: String(faculty.id),
  }));
});

watch(
  department,
  (value) => {
    if (!value)
      return;

    form.value = {
      departmentCode: value.departmentCode,
      facultyId: String(value.facultyId),
      nameEn: value.nameEn,
      nameTh: value.nameTh,
    };
  },
  { immediate: true },
);

function handleCancel() {
  navigateTo(localPath('/admin/departments'));
}

async function handleUpdateDepartment(event: FormSubmitEvent<UpdateDepartmentSubmit>) {
  try {
    loading.value = true;

    await $fetch(`/api/admin/departments/${departmentId}`, {
      method: 'PUT',
      body: {
        departmentCode: event.data.departmentCode.trim().toUpperCase(),
        facultyId: event.data.facultyId,
        nameEn: event.data.nameEn.trim(),
        nameTh: event.data.nameTh.trim(),
      },
    });

    toast.add({
      title: t('adminDepartments.success.update'),
      color: 'success',
    });

    navigateTo(localPath('/admin/departments'));
  }
  catch {
    toast.add({
      title: t('adminDepartments.error.update'),
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
      :to="localPath('/admin/departments')"
    >
      {{ t('common.actions.backTo', { page: t('adminDepartments.title') }) }}
    </UButton>

    <div class="space-y-2">
      <h1 class="text-2xl font-bold mb-1">
        {{ t('adminDepartments.edit.title') }}
      </h1>
    </div>

    <UCard>
      <template #header>
        <div class="h-1.5 -mx-6 -mt-6 mb-5 bg-linear-to-r from-amber-500/80 via-amber-500 to-primary rounded-t-[calc(var(--ui-radius)*1.2)]" />
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-building-2" class="text-primary size-5" />
          <h2 class="font-semibold">
            {{ t('adminDepartments.sections.deptInfo') }}
          </h2>
        </div>
      </template>

      <UForm
        :schema="updateDepartmentSchema"
        :state="form"
        class="space-y-6"
        @submit="handleUpdateDepartment"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField :label="t('adminDepartments.form.code')" name="departmentCode" required>
            <UInput
              v-model="form.departmentCode"
              class="w-full"
              :placeholder="t('adminDepartments.form.codePlaceholder')"
              size="xl"
            />
          </UFormField>

          <UFormField :label="t('adminDepartments.form.faculty')" name="facultyId" required>
            <USelect
              v-model="form.facultyId"
              :items="facultyOptions"
              :loading="facultiesStatus === 'pending'"
              class="w-full"
              size="xl"
              :placeholder="t('adminDepartments.form.facultyPlaceholder')"
            />
          </UFormField>

          <UFormField :label="t('adminDepartments.form.nameEn')" name="nameEn" required>
            <UInput
              v-model="form.nameEn"
              class="w-full"
              size="xl"
            />
          </UFormField>

          <UFormField :label="t('adminDepartments.form.nameTh')" name="nameTh" required>
            <UInput
              v-model="form.nameTh"
              class="w-full"
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
