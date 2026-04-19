<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { computed, h, ref, resolveComponent } from 'vue';
import * as z from 'zod';

import type { Department } from '~/types/department';
import type { Faculty } from '~/types/faculty';
import type { Role, UserDetail } from '~/types/user';

definePageMeta({
  title: 'adminUsers.edit.title',
  middleware: ['permission'],
  permission: 'user.edit',
});

const UButton = resolveComponent('UButton');

const localPath = useLocalePath();
const toast = useToast();
const route = useRoute();
const overlay = useOverlay();
const { locale, t } = useI18n();

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

// Faculty options
const { data: faculties } = await useFetch('/api/faculties', {
  transform: res => res.map((f: Faculty) => ({ label: f.nameEn, labelTh: f.nameTh, value: f.id })),
});

// Role options
const { data: roles } = await useFetch('/api/roles', {
  transform: res => res.map((r: Role) => ({ label: r.name, labelTh: r.nameTh, value: r.id })),
});

// Department options
const { data: departments } = await useFetch('/api/departments', {
  transform: res => res.map((d: Department) => ({ label: d.nameEn, labelTh: d.nameTh, value: d.id, facultyId: d.facultyId })),
  lazy: true,
});

const columns = computed<TableColumn<RoleAssignment>[]>(() => [
  {
    id: 'no',
    header: '#',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ row }) => (row.index + 1).toLocaleString(),
  },
  {
    accessorKey: 'roleId',
    header: t('common.table.role'),
    cell: ({ row }) => {
      const roleId = row.original.roleId;
      if (!roleId)
        return '-';
      const role = roles.value?.find(r => r.value === roleId);
      return role ? (locale.value === 'th' ? role.labelTh : role.label) : String(roleId);
    },
  },
  {
    accessorKey: 'facultyId',
    header: t('common.table.faculty'),
    cell: ({ row }) => {
      const facultyId = row.original.facultyId;
      if (!facultyId)
        return '-';
      const faculty = faculties.value?.find(f => f.value === facultyId);
      return faculty ? (locale.value === 'th' ? faculty.labelTh : faculty.label) : String(facultyId);
    },
  },
  {
    accessorKey: 'departmentId',
    header: t('common.table.department'),
    cell: ({ row }) => {
      const departmentId = row.original.departmentId;
      if (!departmentId)
        return '-';
      const department = departments.value?.find(d => d.value === departmentId);
      return department ? (locale.value === 'th' ? department.labelTh : department.label) : String(departmentId);
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
            color: 'error',
            variant: 'soft',
            icon: 'i-lucide-trash-2',
            onClick() {
              roleAssignments.value = roleAssignments.value.filter(
                r => r !== row.original,
              );
            },
          },
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

const hasAssignedStudentRole = computed(() => roleAssignments.value.some(assignment => isStudentRole(assignment.roleId)));
const hasAssignedNonStudentRole = computed(() => roleAssignments.value.some(assignment => assignment.roleId && !isStudentRole(assignment.roleId)));
const selectedRoleIsStudent = computed(() => isStudentRole(newRoleAssignment.value.roleId));
const canAssignSelectedRole = computed(() => !(selectedRoleIsStudent.value && hasAssignedNonStudentRole.value));
const availableRolesForAssignment = computed(() => {
  if (!roles.value)
    return [];

  if (!hasAssignedNonStudentRole.value)
    return roles.value;

  return roles.value.filter(role => !isStudentRole(role.value));
});

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

function getRoleById(roleId: number | null) {
  if (!roleId)
    return null;
  return roles.value?.find(r => r.value === roleId) ?? null;
}

function getAssignmentKey(assignment: RoleAssignment) {
  return `${assignment.roleId ?? 'null'}:${assignment.facultyId ?? 'null'}:${assignment.departmentId ?? 'null'}`;
}

function isStudentRole(roleId: number | null) {
  const role = getRoleById(roleId);
  if (!role)
    return false;

  const roleLabels = [role.label, role.labelTh]
    .filter(Boolean)
    .map(label => String(label).trim().toLowerCase());

  return roleLabels.some(label => ['student', 'นักศึกษา', 'นิสิต'].some(keyword => label === keyword || label.includes(keyword)));
}

function addRoleAssignment() {
  const selectedRoleId = newRoleAssignment.value.roleId;
  if (!selectedRoleId)
    return;

  const hasStudentRole = hasAssignedStudentRole.value;
  const selectedIsStudent = isStudentRole(selectedRoleId);

  if (selectedIsStudent && roleAssignments.value.length > 0) {
    toast.add({
      title: t('adminUsers.edit.feedback.updateError'),
      description: t('adminUsers.shared.validation.studentOnlyRole'),
      color: 'error',
    });
    return;
  }

  if (!selectedIsStudent && hasStudentRole) {
    toast.add({
      title: t('adminUsers.edit.feedback.updateError'),
      description: t('adminUsers.shared.validation.studentOnlyRole'),
      color: 'error',
    });
    return;
  }

  const newAssignment: RoleAssignment = { ...newRoleAssignment.value };
  const newAssignmentKey = getAssignmentKey(newAssignment);
  const hasDuplicate = roleAssignments.value.some(assignment => getAssignmentKey(assignment) === newAssignmentKey);

  if (hasDuplicate) {
    toast.add({
      title: t('adminUsers.edit.feedback.updateError'),
      description: t('adminUsers.shared.validation.roleAssignmentDuplicate'),
      color: 'error',
    });
    return;
  }

  roleAssignments.value.push(newAssignment);
  showRoleError.value = false;
  newRoleAssignment.value = { roleId: null, facultyId: null, departmentId: null };
  open.value = false;
}

// User details
const { data: userData } = await useFetch<UserDetail>(`/api/users/${userId}`);

const updateUserSchema = z.object({
  studentId: z.string().optional(),
  staffId: z.string().optional(),
  titleEn: z.string().max(20),
  firstNameEn: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.firstNameEn') })),
  lastNameEn: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.lastNameEn') })),
  titleTh: z.string().max(20),
  firstNameTh: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.firstNameTh') })),
  lastNameTh: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.lastNameTh') })),
  email: z.email(t('common.validation.invalidEmail')),
}).superRefine((data, ctx) => {
  const hasStudentId = Boolean(data.studentId?.trim());
  const hasStaffId = Boolean(data.staffId?.trim());

  if (hasStudentId && hasStaffId) {
    const message = t('adminUsers.shared.validation.studentStaffExclusive');
    ctx.addIssue({ code: 'custom', path: ['studentId'], message });
    ctx.addIssue({ code: 'custom', path: ['staffId'], message });
  }
});

type UpdateUserSchema = z.output<typeof updateUserSchema>;

const form = ref<Partial<UpdateUserSchema>>({
  studentId: '',
  staffId: '',
  titleEn: '',
  firstNameEn: '',
  lastNameEn: '',
  titleTh: '',
  firstNameTh: '',
  lastNameTh: '',
  email: '',
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
      studentId: newData.studentId || '',
      staffId: newData.staffId || '',
      firstNameEn: newData.firstNameEn || '',
      lastNameEn: newData.lastNameEn || '',
      titleEn: newData.titleEn || '',
      firstNameTh: newData.firstNameTh || '',
      lastNameTh: newData.lastNameTh || '',
      titleTh: newData.titleTh || '',
      email: newData.email || '',
    };

    roleAssignments.value = mapAssignmentsToRoleAssignments(newData.assignments || []);
  }
  loading.value = false;
}, { immediate: true });

// Detect form changes to set dirty state
watch([form, roleAssignments], ([newForm, newRoles]) => {
  const initialRoles = mapAssignmentsToRoleAssignments(userData.value?.assignments || []);

  const formDirty = JSON.stringify(newForm) !== JSON.stringify({
    studentId: userData.value?.studentId,
    staffId: userData.value?.staffId,
    firstNameEn: userData.value?.firstNameEn,
    lastNameEn: userData.value?.lastNameEn,
    titleEn: userData.value?.titleEn,
    firstNameTh: userData.value?.firstNameTh,
    lastNameTh: userData.value?.lastNameTh,
    titleTh: userData.value?.titleTh,
    email: userData.value?.email,
  });

  const rolesDirty = JSON.stringify(newRoles) !== JSON.stringify(initialRoles);

  isDirty.value = formDirty || rolesDirty;
}, { deep: true });

function handleCancel() {
  // Navigate back to users list
  navigateTo(localPath('/admin/users'));
}

function resolveUpdateUserErrorMessage(error: unknown) {
  const apiError = error as {
    data?: {
      code?: string;
      fields?: string[];
      message?: string;
      data?: {
        code?: string;
        fields?: string[];
      };
    };
    message?: string;
  };

  const errorCode = apiError.data?.code ?? apiError.data?.data?.code;
  const duplicateFields = apiError.data?.fields ?? apiError.data?.data?.fields ?? [];

  if (errorCode === 'STUDENT_STAFF_EXCLUSIVE') {
    return t('adminUsers.shared.validation.studentStaffExclusive');
  }

  if (errorCode === 'DUPLICATE_USER_FIELDS') {
    const fieldMessages = duplicateFields.map((field) => {
      switch (field) {
        case 'email':
          return t('adminUsers.edit.feedback.duplicateEmail');
        case 'studentId':
          return t('adminUsers.edit.feedback.duplicateStudentId');
        case 'staffId':
          return t('adminUsers.edit.feedback.duplicateStaffId');
        default:
          return '';
      }
    }).filter(Boolean);

    if (fieldMessages.length > 0) {
      return fieldMessages.join(' ');
    }

    return t('adminUsers.edit.feedback.userAlreadyExists');
  }

  if (errorCode === 'LAST_ADMIN_ROLE_LOCKED') {
    return apiError.data?.message || apiError.message;
  }

  return undefined;
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
        studentId: event.data.studentId,
        staffId: event.data.staffId,
        titleEn: event.data.titleEn,
        firstNameEn: event.data.firstNameEn,
        lastNameEn: event.data.lastNameEn,
        titleTh: event.data.titleTh,
        firstNameTh: event.data.firstNameTh,
        lastNameTh: event.data.lastNameTh,
        email: event.data.email,
      },
    });

    // Rewrite only role IDs whose assignment sets have changed.
    // This avoids unnecessary delete/reinsert flows (important for guarded roles like Admin).
    if (userData.value?.assignments) {
      const currentRoleAssignments = mapAssignmentsToRoleAssignments(userData.value.assignments);
      const newRoleAssignments = roleAssignments.value;

      const roleIdsToCheck = new Set<number>([
        ...currentRoleAssignments.map(role => role.roleId).filter((roleId): roleId is number => Boolean(roleId)),
        ...newRoleAssignments.map(role => role.roleId).filter((roleId): roleId is number => Boolean(roleId)),
      ]);

      for (const roleId of roleIdsToCheck) {
        const currentForRole = currentRoleAssignments.filter(role => role.roleId === roleId);
        const nextForRole = newRoleAssignments.filter(role => role.roleId === roleId);

        const currentKeys = [...new Set(currentForRole.map(getAssignmentKey))].sort();
        const nextKeys = [...new Set(nextForRole.map(getAssignmentKey))].sort();

        if (JSON.stringify(currentKeys) === JSON.stringify(nextKeys)) {
          continue;
        }

        if (currentForRole.length > 0) {
          await $fetch('/api/user-role', {
            method: 'DELETE',
            body: { userId, roleId },
          });
        }

        for (const role of nextForRole) {
          await $fetch('/api/user-role', {
            method: 'POST',
            body: { userId, roleId, facultyId: role.facultyId, departmentId: role.departmentId },
          });
        }
      }
    }

    isDirty.value = false;

    toast.add({ title: t('adminUsers.edit.feedback.updateSuccess'), color: 'success' });
    navigateTo(localPath('/admin/users'));
  }
  catch (error) {
    console.error('Error updating user:', error);

    toast.add({
      title: t('adminUsers.edit.feedback.updateError'),
      description: resolveUpdateUserErrorMessage(error),
      color: 'error',
    });
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
    title: t('common.dialog.discardTitle'),
    description: t('common.dialog.discardDescription'),
    cancelButton: {
      label: t('common.actions.cancel'),
    },
    confirmButton: {
      label: t('common.actions.leave'),
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
      {{ t('common.actions.backTo', { page: t('adminUsers.list.title') }) }}
    </UButton>

    <div v-if="userData">
      <!-- Main Content -->
      <UForm ref="formRef" :schema="updateUserSchema" :state="form" class="flex-1 max-w-360 mx-auto w-full space-y-6" @submit.prevent="handleUpdateUser">
        <!-- Page Header -->
        <div>
          <h1 class="text-2xl font-bold mb-4">
            {{ t('adminUsers.edit.title') }}
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
                    {{ t('adminUsers.shared.sections.basic') }}
                  </h2>
                </div>
              </template>
              <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div class="col-span-1 md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-6">
                  <UFormField
                    :label="t('common.form.id')"
                    name="id"
                    required
                    class="col-span-1 md:col-span-2"
                  >
                    <UInput
                      v-model="userData.id"
                      disabled
                      variant="subtle"
                      class="w-full"
                    />
                  </UFormField>

                  <!-- Student ID -->
                  <UFormField
                    :label="t('adminUsers.shared.form.studentId')"
                    name="studentId"
                    class="col-span-1 md:col-span-2"
                  >
                    <UInput
                      v-model="form.studentId"
                      :disabled="Boolean(form.staffId?.trim())"
                      :variant="Boolean(form.staffId?.trim()) ? 'subtle' : undefined"
                      class="w-full"
                    />
                  </UFormField>

                  <!-- Staff ID -->
                  <UFormField
                    :label="t('adminUsers.shared.form.staffId')"
                    name="staffId"
                    class="col-span-1 md:col-span-2"
                  >
                    <UInput
                      v-model="form.staffId"
                      :disabled="Boolean(form.studentId?.trim())"
                      :variant="Boolean(form.studentId?.trim()) ? 'subtle' : undefined"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <!-- Title (EN) -->
                <UFormField
                  :label="t('adminUsers.shared.form.titleEn')"
                  name="titleEn"
                  class="col-span-1 md:col-span-2"
                >
                  <UInput
                    v-model="form.titleEn"
                    class="w-full"
                  />
                </UFormField>

                <!-- First Name (EN) -->
                <UFormField
                  :label="t('adminUsers.shared.form.firstNameEn')"
                  name="firstNameEn"
                  required
                  class="col-span-1 md:col-span-5"
                >
                  <UInput
                    v-model="form.firstNameEn"
                    class="w-full"
                  />
                </UFormField>

                <!-- Last Name (EN) -->
                <UFormField
                  :label="t('adminUsers.shared.form.lastNameEn')"
                  name="lastNameEn"
                  required
                  class="col-span-1 md:col-span-5"
                >
                  <UInput
                    v-model="form.lastNameEn"
                    class="w-full"
                  />
                </UFormField>

                <!-- Title (TH) -->
                <UFormField
                  :label="t('adminUsers.shared.form.titleTh')"
                  name="titleTh"
                  class="col-span-1 md:col-span-2"
                >
                  <UInput
                    v-model="form.titleTh"
                    class="w-full"
                  />
                </UFormField>

                <!-- First Name (TH) -->
                <UFormField
                  :label="t('adminUsers.shared.form.firstNameTh')"
                  name="firstNameTh"
                  class="col-span-1 md:col-span-5"
                  required
                >
                  <UInput
                    v-model="form.firstNameTh"
                    class="w-full"
                  />
                </UFormField>

                <!-- Last Name (TH) -->
                <UFormField
                  :label="t('adminUsers.shared.form.lastNameTh')"
                  name="lastNameTh"
                  class="col-span-1 md:col-span-5"
                  required
                >
                  <UInput
                    v-model="form.lastNameTh"
                    class="w-full"
                  />
                </UFormField>

                <!-- Email -->
                <UFormField
                  :label="t('common.form.email')"
                  name="email"
                  required
                  class="col-span-1 md:col-span-3"
                >
                  <UInput
                    v-model="form.email"
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
                      {{ t('adminUsers.shared.sections.roles') }}
                    </h2>
                  </div>
                  <UModal v-model:open="open" :title="t('adminUsers.shared.roleTable.modalTitle')" :ui="{ footer: 'justify-end' }">
                    <UButton icon="i-lucide-plus" :label="t('adminUsers.shared.roleTable.modalTitle')" variant="soft" :disabled="hasAssignedStudentRole" :class="hasAssignedStudentRole ? 'cursor-not-allowed!' : ''" />

                    <template #body>
                      <div class="space-y-4">
                        <!-- Role -->
                        <UFormField
                          :label="t('common.table.role')"
                          name="role"
                          required
                        >
                          <USelectMenu v-model="newRoleAssignment.roleId" :items="availableRolesForAssignment" :label-key="locale === 'th' ? 'labelTh' : 'label'" value-key="value" :placeholder="t('adminUsers.shared.roleTable.selectRole')" :clear="true" size="xl" class="w-full" />
                        </UFormField>
                        <!-- Faculty -->
                        <UFormField
                          :label="t('common.table.faculty')"
                          name="faculty"
                          required
                        >
                          <USelectMenu v-model="newRoleAssignment.facultyId" :items="faculties || []" :label-key="locale === 'th' ? 'labelTh' : 'label'" value-key="value" :placeholder="t('adminUsers.shared.roleTable.selectFaculty')" :clear="true" size="xl" class="w-full" />
                        </UFormField>
                        <!-- Department -->
                        <UFormField
                          :label="t('common.table.department')"
                          name="department"
                        >
                          <USelectMenu v-model="newRoleAssignment.departmentId" :items="filteredDepartments" :label-key="locale === 'th' ? 'labelTh' : 'label'" value-key="value" :placeholder="t('adminUsers.shared.roleTable.selectDept')" :clear="true" size="xl" class="w-full" />
                        </UFormField>
                      </div>
                    </template>

                    <template #footer="{ close }">
                      <UButton :label="t('common.actions.cancel')" color="neutral" variant="outline" @click="close" />
                      <UButton :label="t('adminUsers.shared.roleTable.addBtn')" color="primary" :disabled="!newRoleAssignment.roleId || !newRoleAssignment.facultyId || !canAssignSelectedRole" @click="addRoleAssignment" />
                    </template>
                  </UModal>
                </div>
              </template>

              <UAlert
                v-if="showRoleError"
                color="error"
                variant="subtle"
                :title="t('adminUsers.shared.validation.roleRequired')"
                :description="t('adminUsers.shared.validation.roleRequiredDesc')"
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
            :label="t('common.actions.cancel')"
            @click="handleCancel"
          />
          <UButton
            type="button"
            color="primary"
            :label="t('adminUsers.edit.updateUser')"
            :loading="loading"
            @click="handleSubmit"
          />
        </div>
      </UForm>
    </div>
    <div v-else>
      <p>{{ t('adminUsers.edit.feedback.userNotFound', { id: route.params.id }) }}</p>
    </div>
  </div>
</template>
