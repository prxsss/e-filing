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

const facultyId = Number(route.params.id);

const loading = ref(false);

const updateFacultySchema = z.object({
  facultyCode: z
    .string()
    .min(1, 'Faculty code is required')
    .max(20, 'Faculty code must be 20 characters or fewer'),
  nameEn: z.string().min(1, 'Faculty name (EN) is required'),
  nameTh: z.string().min(1, 'Faculty name (TH) is required'),
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
      title: 'Success',
      description: 'Faculty has been updated successfully.',
      color: 'success',
    });

    navigateTo(localPath('/admin/faculties'));
  }
  catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to update faculty. Please try again.',
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
      Back to Faculties
    </UButton>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">
        Edit Faculty
      </h1>
      <p class="text-muted">
        Update faculty details to keep the academic structure information current.
      </p>
    </div>

    <UCard>
      <template #header>
        <div class="h-1.5 -mx-6 -mt-6 mb-5 bg-linear-to-r from-amber-500/80 via-amber-500 to-primary rounded-t-[calc(var(--ui-radius)*1.2)]" />
      </template>

      <UForm
        :schema="updateFacultySchema"
        :state="form"
        class="space-y-6"
        @submit="handleUpdateFaculty"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField label="Faculty Code" name="facultyCode" required>
            <UInput
              v-model="form.facultyCode"
              class="w-full"
              placeholder="e.g. F001"
              size="xl"
            />
          </UFormField>

          <div class="hidden md:block" />

          <UFormField label="Faculty Name (EN)" name="nameEn" required>
            <UInput
              v-model="form.nameEn"
              class="w-full"
              placeholder="e.g. Faculty of Natural Sciences"
              size="xl"
            />
          </UFormField>

          <UFormField label="Faculty Name (TH)" name="nameTh" required>
            <UInput
              v-model="form.nameTh"
              class="w-full"
              placeholder="e.g. คณะวิทยาศาสตร์"
              size="xl"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-default">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            label="Cancel"
            @click="handleCancel"
          />
          <UButton
            type="submit"
            color="primary"
            label="Save Changes"
            icon="i-lucide-save"
            :loading="loading"
          />
        </div>
      </UForm>
    </UCard>
  </div>
</template>
