<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { computed, h, ref, resolveComponent } from 'vue';
import * as z from 'zod';

import type { Role, UserDetail } from '~/types/user';

definePageMeta({
  title: 'edit-user',
  middleware: ['permission'],
  permission: 'user.edit',
});

const UButton = resolveComponent('UButton');

const localPath = useLocalePath();
const toast = useToast();
const route = useRoute();
const overlay = useOverlay();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const userId = route.params.id as string;
const loading = ref(true);
const isDirty = ref(false);
const open = ref(false);
const formRef = ref<any>(null);

type RoleAssignment = {
  roleId: number | null;
  facultyId: number | null;
  departmentId: number | null;
};

type UserAssignment = UserDetail['assignments'][number];

const roleAssignments = ref<RoleAssignment[]>([]);

type Faculty = {
  id: number;
  nameEn: string;
};

// Faculty options
const { data: faculties } = await useFetch('/api/faculties', {
  transform: res => res.map((f: Faculty) => ({ label: f.nameEn, value: f.id })),
});

// Role options
const { data: roles } = await useFetch('/api/roles', {
  transform: res => res.map((r: Role) => ({ label: r.name, value: r.id })),
});

type Department = {
  id: number;
  nameEn: string;
  facultyId: number;
};

// Department options
const { data: departments } = await useFetch('/api/departments', {
  transform: (res: any[]) => res.map((d: Department) => ({ label: d.nameEn, value: d.id, facultyId: d.facultyId })),
  lazy: true,
});

const columns = computed<TableColumn<RoleAssignment>[]>(() => [
  {
    accessorKey: 'roleId',
    header: 'Role',
    cell: ({ row }) => {
      const roleId = row.original.roleId;
      if (!roleId)
        return '-';
      const role = roles.value?.find(r => r.value === roleId);
      return role ? role.label : String(roleId);
    },
  },
  {
    accessorKey: 'facultyId',
    header: 'Faculty',
    cell: ({ row }) => {
      const facultyId = row.original.facultyId;
      if (!facultyId)
        return '-';
      const faculty = faculties.value?.find(f => f.value === facultyId);
      return faculty ? faculty.label : String(facultyId);
    },
  },
  {
    accessorKey: 'departmentId',
    header: 'Department',
    cell: ({ row }) => {
      const departmentId = row.original.departmentId;
      if (!departmentId)
        return '-';
      const department = departments.value?.find(d => d.value === departmentId);
      return department ? department.label : String(departmentId);
    },
  },
  {
    id: 'actions',
    meta: {
      class: {
        td: 'text-right',
      },
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center justify-end gap-2' }, [
        h(
          UButton,
          {
            'color': 'error',
            'variant': 'soft',
            'aria-label': 'Delete role assignment',
            onClick() {
              roleAssignments.value = roleAssignments.value.filter(
                r => r !== row.original,
              );
            },
          },
          () => 'Delete',
        ),
      ]);
    },
  },
]);

const newRoleAssignment = ref<RoleAssignment>({
  roleId: null,
  facultyId: null,
  departmentId: null,
});

const filteredDepartments = computed(() => {
  if (!departments.value)
    return [];
  if (!newRoleAssignment.value.facultyId)
    return departments.value;
  return departments.value.filter(d => d.facultyId === newRoleAssignment.value.facultyId);
});

const showRoleError = ref(false);

function toNumberId(value: string | number | null | undefined) {
  if (value === null || value === undefined)
    return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapAssignmentsToRoleAssignments(assignments: UserAssignment[] = []): RoleAssignment[] {
  return assignments.map((assignment) => {
    const mappedRole = roles.value?.find(role => role.label === assignment.role);

    return {
      roleId: mappedRole?.value ?? null,
      facultyId: toNumberId(assignment.faculty?.id),
      departmentId: toNumberId(assignment.department?.id),
    };
  });
}

function addRoleAssignment() {
  if (!newRoleAssignment.value.roleId || !newRoleAssignment.value.facultyId) {
    toast.add({ title: 'Error', description: 'Role and Faculty are required', color: 'error' });
    return;
  }

  roleAssignments.value.push({ ...newRoleAssignment.value });
  showRoleError.value = false;
  newRoleAssignment.value = { roleId: null, facultyId: null, departmentId: null };
  open.value = false;
}

// User details
const { data: userData } = await useFetch<UserDetail>(`/api/users/${userId}`);

const updateUserSchema = z.object({
  academicRankEn: z.string().max(20),
  titleEn: z.string().max(20),
  firstNameEn: z.string().min(1, 'First name is required'),
  lastNameEn: z.string().min(1, 'Last name is required'),
  academicRankTh: z.string().max(20),
  titleTh: z.string().max(20),
  firstNameTh: z.string().min(1, 'First name (TH) is required'),
  lastNameTh: z.string().min(1, 'Last name (TH) is required'),
});

type UpdateUserSchema = z.output<typeof updateUserSchema>;

const form = ref<Partial<UpdateUserSchema>>({
  academicRankEn: '',
  titleEn: '',
  firstNameEn: '',
  lastNameEn: '',
  academicRankTh: '',
  titleTh: '',
  firstNameTh: '',
  lastNameTh: '',
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
watch([userData, roles], ([newData]) => {
  if (newData) {
    form.value = {
      firstNameEn: newData.firstNameEn || '',
      lastNameEn: newData.lastNameEn || '',
      academicRankEn: newData.academicRankEn || '',
      titleEn: newData.titleEn || '',
      firstNameTh: newData.firstNameTh || '',
      lastNameTh: newData.lastNameTh || '',
      academicRankTh: newData.academicRankTh || '',
      titleTh: newData.titleTh || '',
    };

    roleAssignments.value = mapAssignmentsToRoleAssignments(newData.assignments || []);
  }
  loading.value = false;
}, { immediate: true });

// Detect form changes to set dirty state
watch([form, roleAssignments], ([newForm, newRoles]) => {
  const initialRoles = mapAssignmentsToRoleAssignments(userData.value?.assignments || []);

  const formDirty = JSON.stringify(newForm) !== JSON.stringify({
    firstNameEn: userData.value?.firstNameEn,
    lastNameEn: userData.value?.lastNameEn,
    academicRankEn: userData.value?.academicRankEn,
    titleEn: userData.value?.titleEn,
    firstNameTh: userData.value?.firstNameTh,
    lastNameTh: userData.value?.lastNameTh,
    academicRankTh: userData.value?.academicRankTh,
    titleTh: userData.value?.titleTh,
  });

  const rolesDirty = JSON.stringify(newRoles) !== JSON.stringify(initialRoles);

  isDirty.value = formDirty || rolesDirty;
}, { deep: true });

function handleCancel() {
  // Navigate back to users list
  navigateTo(localPath('/admin/users'));
}

async function handleUpdateUser(event: FormSubmitEvent<UpdateUserSchema>) {
  try {
    let hasRoleError = false;

    if (roleAssignments.value.length === 0) {
      showRoleError.value = true;
      hasRoleError = true;
    }
    else {
      showRoleError.value = false;
    }

    // We already have validated form data in event.data from UForm's @submit
    if (hasRoleError) {
      return;
    }

    loading.value = true;

    // Update user basic information
    await $fetch(`/api/users/${userId}`, {
      method: 'PUT',
      body: {
        firstNameEn: event.data.firstNameEn,
        lastNameEn: event.data.lastNameEn,
        academicRankEn: event.data.academicRankEn,
        titleEn: event.data.titleEn,
        firstNameTh: event.data.firstNameTh,
        lastNameTh: event.data.lastNameTh,
        academicRankTh: event.data.academicRankTh,
        titleTh: event.data.titleTh,
      },
    });

    // Handle role assignments logic completely (replace or update)
    if (userData.value?.assignments) {
      const currentRoleAssignments = mapAssignmentsToRoleAssignments(userData.value.assignments);

      const newRoleAssignments = roleAssignments.value;

      // TODO: This could be optimized to only delete what's removed and add what's new.
      // For now, doing a simpler approach: delete old ones and insert new ones.

      // Delete old roles
      for (const role of currentRoleAssignments) {
        await $fetch('/api/user-role', {
          method: 'DELETE',
          body: { userId, roleId: role.roleId },
        });
      }

      // Add new roles
      for (const role of newRoleAssignments) {
        if (role.roleId) {
          await $fetch('/api/user-role', {
            method: 'POST',
            body: { userId, roleId: role.roleId, facultyId: role.facultyId, departmentId: role.departmentId },
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
  finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (roleAssignments.value.length === 0) {
    showRoleError.value = true;
  }
  else {
    showRoleError.value = false;
  }

  if (formRef.value) {
    formRef.value.submit();
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
      <UForm ref="formRef" :schema="updateUserSchema" :state="form" class="flex-1 max-w-360 mx-auto w-full space-y-6" @submit.prevent="handleUpdateUser">
        <!-- Page Header -->
        <div>
          <h1 class="text-2xl font-bold mb-4">
            Edit User
          </h1>
        </div>
        <!-- Form Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <!-- Left Sidebar - Profile Picture Section -->
          <!-- Profile Picture Card -->
          <!-- <div class="lg:col-span-4 space-y-6">
            <UCard class="text-center">
              <template #header>
                <div class="flex items-center justify-center">
                  <div class="relative">
                    <div class="w-32 h-32 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <UIcon
                        name="i-lucide-user-round"
                        class="w-16 h-16 text-slate-400"
                      />
                    </div>
                    <UButton
                      type="button"
                      icon="i-lucide-camera"
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
          </div> -->
          <!-- Right Section - Form Fields -->
          <div class="lg:col-span-12 space-y-8">
            <!-- Basic Information Card -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-lucide-id-card"
                    class="text-primary"
                  />
                  <h2 class="font-semibold text-base">
                    Basic Information
                  </h2>
                </div>
              </template>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="col-span-1 md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <UFormField
                    label="ID"
                    name="id"
                    required
                    class="col-span-1"
                  >
                    <UInput
                      v-model="userData.id"
                      disabled
                      variant="subtle"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <!-- Academic Rank (EN) -->
                <UFormField
                  label="Academic Rank (EN)"
                  name="academicRankEn"
                >
                  <UInput
                    v-model="form.academicRankEn"
                    class="w-full"
                  />
                </UFormField>

                <!-- Title (EN) -->
                <UFormField
                  label="Title (EN)"
                  name="titleEn"
                >
                  <UInput
                    v-model="form.titleEn"
                    class="w-full"
                  />
                </UFormField>

                <!-- First Name (EN) -->
                <UFormField
                  label="First Name (EN)"
                  name="firstNameEn"
                  required
                >
                  <UInput
                    v-model="form.firstNameEn"
                    class="w-full"
                  />
                </UFormField>

                <!-- Last Name (EN) -->
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

                <!-- Academic Rank (TH) -->
                <UFormField
                  label="Academic Rank (TH)"
                  name="academicRankTh"
                >
                  <UInput
                    v-model="form.academicRankTh"
                    class="w-full"
                  />
                </UFormField>

                <!-- Title (TH) -->
                <UFormField
                  label="Title (TH)"
                  name="titleTh"
                >
                  <UInput
                    v-model="form.titleTh"
                    class="w-full"
                  />
                </UFormField>

                <!-- First Name (TH) -->
                <UFormField
                  label="First Name (TH)"
                  name="firstNameTh"
                  required
                >
                  <UInput
                    v-model="form.firstNameTh"
                    class="w-full"
                  />
                </UFormField>

                <!-- Last Name (TH) -->
                <UFormField
                  label="Last Name (TH)"
                  name="lastNameTh"
                  required
                >
                  <UInput
                    v-model="form.lastNameTh"
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
              </div>
            </UCard>
            <!-- Roles Card -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <UIcon
                      name="i-lucide-shield-user"
                      class="text-primary"
                    />
                    <h2 class="font-semibold text-base after:content-['*'] after:-ms-0.5 after:text-error">
                      Role Assignments
                    </h2>
                  </div>
                  <UModal v-model:open="open" title="Add Role Assignment" :ui="{ footer: 'justify-end' }">
                    <UButton icon="i-lucide-plus" label="Add Role Assignment" variant="soft" />

                    <template #body>
                      <div class="space-y-4">
                        <!-- Role -->
                        <UFormField
                          label="Role"
                          name="role"
                          required
                        >
                          <BaseSelect v-model="newRoleAssignment.roleId" :items="roles || []" value-key="value" placeholder="Select Role" :clear="true" size="xl" />
                        </UFormField>
                        <!-- Faculty -->
                        <UFormField
                          label="Faculty"
                          name="faculty"
                          required
                        >
                          <BaseSelect v-model="newRoleAssignment.facultyId" :items="faculties || []" value-key="value" placeholder="Select Faculty" :clear="true" size="xl" />
                        </UFormField>
                        <!-- Department -->
                        <UFormField
                          label="Department"
                          name="department"
                        >
                          <BaseSelect v-model="newRoleAssignment.departmentId" :items="filteredDepartments" value-key="value" placeholder="Select Department" :clear="true" size="xl" />
                        </UFormField>
                      </div>
                    </template>

                    <template #footer="{ close }">
                      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
                      <UButton label="Submit" color="primary" :disabled="!newRoleAssignment.roleId || !newRoleAssignment.facultyId" @click="addRoleAssignment" />
                    </template>
                  </UModal>
                </div>
              </template>

              <UAlert
                v-if="showRoleError"
                color="error"
                variant="subtle"
                title="Role assignment required"
                description="Please assign at least one role to the user before continuing."
                icon="i-heroicons-exclamation-triangle-20-solid"
                class="mb-4"
              />

              <UTable
                :data="roleAssignments" :columns="columns" class=""
              />
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
            type="button"
            color="primary"
            label="Update User"
            :loading="loading"
            @click="handleSubmit"
          />
        </div>
      </UForm>
    </div>
    <div v-else>
      <p>Sorry, user with ID {{ route.params.id }} not found.</p>
    </div>
  </div>
</template>
