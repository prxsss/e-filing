<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { ref } from 'vue';
import * as z from 'zod';

import type { Role, UserDetail } from '~/types/user';

const localPath = useLocalePath();
const toast = useToast();
const route = useRoute();
const overlay = useOverlay();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const userId = route.params.id as string;
const loading = ref(true);
const isDirty = ref(false);

type Faculty = {
  id: number;
  name: string;
};

// Faculty options
const { data: faculties } = await useFetch('/api/faculties', {
  transform: res => res.map((f: Faculty) => ({ label: f.name, value: f.id })),
});

// Role options
const { data: roles } = await useFetch('/api/roles', {
  transform: res => res.map((r: Role) => ({ label: r.name, value: r.id })),
});

// User details
const { data: userData } = await useFetch<UserDetail>(`/api/users/${userId}`);

const updateUserSchema = z.object({
  firstNameEn: z.string().min(1, 'First name is required'),
  lastNameEn: z.string().min(1, 'Last name is required'),
  facultyId: z.number().nullable(),
  roles: z.array(z.number()).min(1, 'At least one role must be assigned'),
});

type UpdateUserSchema = z.output<typeof updateUserSchema>;

const form = ref<Partial<UpdateUserSchema>>({
  firstNameEn: '',
  lastNameEn: '',
  facultyId: null,
  roles: [] as number[],
});

// const isDirty = computed(() => {
//   return JSON.stringify(form.value) !== JSON.stringify({
//     firstNameEn: userData.value?.firstNameEn,
//     lastNameEn: userData.value?.lastNameEn,
//     facultyId: userData.value?.facultyId,
//     roles: userData.value?.roles?.map(r => r.id) || [],
//   });
// });

// Initialize form with user data once it's loaded
watch(userData, (newData) => {
  if (newData) {
    form.value = {
      firstNameEn: newData.firstNameEn || '',
      lastNameEn: newData.lastNameEn || '',
      facultyId: newData.facultyId,
      roles: newData.roles?.map(r => r.id) || [],
    };
  }
  loading.value = false;
}, { immediate: true });

// Detect form changes to set dirty state
watch(form, (newData) => {
  isDirty.value = JSON.stringify(newData) !== JSON.stringify({
    firstNameEn: userData.value?.firstNameEn,
    lastNameEn: userData.value?.lastNameEn,
    facultyId: userData.value?.facultyId,
    roles: userData.value?.roles?.map(r => r.id) || [],
  });
}, { deep: true });

function handleCancel() {
  // Navigate back to users list
  navigateTo(localPath('/admin/users'));
}

async function handleUpdateUser(event: FormSubmitEvent<UpdateUserSchema>) {
  try {
    // Update user basic information
    await $fetch(`/api/users/${userId}`, {
      method: 'PUT',
      body: {
        firstNameEn: event.data.firstNameEn,
        lastNameEn: event.data.lastNameEn,
        facultyId: event.data.facultyId,
      },
    });

    // Get current roles and update if changed
    if (userData.value?.roles) {
      const currentRoleIds = userData.value.roles.map(r => r.id);
      const newRoleIds = event.data.roles;

      // Remove roles that are no longer assigned
      for (const roleId of currentRoleIds) {
        if (!newRoleIds.includes(roleId)) {
          await $fetch('/api/user-role', {
            method: 'DELETE',
            body: { userId, roleId },
          });
        }
      }

      // Add new roles
      for (const roleId of newRoleIds) {
        if (!currentRoleIds.includes(roleId)) {
          await $fetch('/api/user-role', {
            method: 'POST',
            body: { userId, roleId },
          });
        }
      }
    }

    isDirty.value = false;

    toast.add({ title: 'Success', description: 'User has been updated successfully.', color: 'success' });
    navigateTo(localPath('/admin/users'));
  }
  catch (error) {
    console.error('Error updating user:', error);
    toast.add({ title: 'Error', description: 'Failed to update user. Please try again.', color: 'error' });
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (isDirty.value) {
    event.preventDefault();
  }
}

onBeforeRouteLeave(async () => {
  if (!isDirty.value)
    return true;

  const instance = confirmDialog.open({
    title: 'Discard changes?',
    description: 'You have unsaved changes. Are you sure you want to leave this page?',
    cancelButton: {
      label: 'Cancel',
    },
    confirmButton: {
      label: 'Leave',
      color: 'error',
    },
  });

  const result = await instance.result;

  return Boolean(result);
});

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload));
</script>

<template>
  <div>
    <UButton
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      :to="localPath('/admin/users')"
      class="mb-6"
    >
      Back to Users
    </UButton>

    <div v-if="userData">
      <!-- Main Content -->
      <UForm :schema="updateUserSchema" :state="form" class="flex-1 max-w-360 mx-auto w-full space-y-6" @submit.prevent="handleUpdateUser">
        <!-- Page Header -->
        <div>
          <h1 class="text-2xl font-bold mb-4">
            Edit User
          </h1>
        </div>
        <!-- Form Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <!-- Left Sidebar - Profile Picture Section -->
          <div class="lg:col-span-4 space-y-6">
            <!-- Profile Picture Card -->
            <UCard class="text-center">
              <template #header>
                <div class="flex items-center justify-center">
                  <div class="relative">
                    <div class="w-32 h-32 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <UIcon
                        name="i-heroicons-user-plus-20-solid"
                        class="w-16 h-16 text-slate-400"
                      />
                    </div>
                    <UButton
                      type="button"
                      icon="i-heroicons-camera-20-solid"
                      size="sm"
                      color="primary"
                      class="absolute bottom-2 right-1 rounded-full shadow-lg"
                    />
                  </div>
                </div>
              </template>
              <div class="space-y-3">
                <h3 class="font-semibold text-base">
                  Profile Picture
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  JPG, GIF or PNG. Max size of 800K
                </p>
              </div>
            </UCard>
          </div>
          <!-- Right Section - Form Fields -->
          <div class="lg:col-span-8 space-y-8">
            <!-- Basic Information Card -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-heroicons-identification-20-solid"
                    class="text-gray-400"
                  />
                  <h2 class="font-semibold text-base">
                    Basic Information
                  </h2>
                </div>
              </template>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="col-span-2">
                  <UFormField
                    label="ID"
                    name="id"
                    required
                  >
                    <UInput
                      v-model="userData.id"
                      disabled
                      variant="subtle"
                      class="w-full"
                    />
                  </UFormField>
                </div>
                <!-- First Name (EN) -->
                <UFormField
                  label="First Name"
                  name="firstNameEn"
                  required
                >
                  <UInput
                    v-model="form.firstNameEn"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Last Name (EN)"
                  name="lastNameEn"
                  required
                >
                  <UInput
                    v-model="form.lastNameEn"
                    class="w-full"
                  />
                </UFormField>
                <!-- Email -->
                <UFormField
                  label="Email Address"
                  name="email"
                  required
                >
                  <UInput
                    v-model="userData.email"
                    disabled
                    variant="subtle"
                    type="email"
                    class="w-full"
                  />
                </UFormField>
                <!-- Faculty -->
                <UFormField
                  label="Faculty"
                  name="facultyId"
                >
                  <BaseSelect v-model="form.facultyId" :items="faculties" value-key="value" placeholder="Select Faculty" :clear="true" />
                </UFormField>
              </div>
            </UCard>
            <!-- Roles Card -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-heroicons-shield-check-20-solid"
                    class="text-gray-400"
                  />
                  <h2 class="font-semibold text-base after:content-['*'] after:-ms-0.5 after:text-error">
                    Roles
                  </h2>
                </div>
              </template>
              <UFormField name="roles">
                <UInputMenu v-model="form.roles" multiple :items="roles" value-key="value" open-on-click placeholder="Assign Roles" class="w-full" />
              </UFormField>
            </UCard>
            <!-- Initial Signature Setup Card -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-heroicons-pencil-square-20-solid"
                    class="text-gray-400"
                  />
                  <h2 class="font-semibold text-base">
                    Initial Signature Setup
                  </h2>
                </div>
              </template>
              <div class="space-y-4">
                <!-- Upload Area -->
                <div
                  class="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center bg-slate-50 dark:bg-slate-900/50 hover:border-primary-400 transition-colors cursor-pointer"
                >
                  <UIcon
                    name="i-heroicons-cloud-arrow-up-20-solid"
                    class="w-12 h-12 text-slate-400 mx-auto mb-2"
                  />
                  <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Drop signature image here, or
                    <span class="text-primary-500 hover:text-primary-600">
                      browse
                    </span>
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports PNG with transparent background
                  </p>
                </div>
              </div>
            </UCard>
          </div>
        </div>
        <div class="flex items-center justify-end gap-4">
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
            label="Update User"
            icon="i-heroicons-check-20-solid"
          />
        </div>
      </UForm>
    </div>
    <div v-else>
      <p>Sorry, user with ID {{ route.params.id }} not found.</p>
    </div>
  </div>
</template>
