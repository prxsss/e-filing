<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, ref, resolveComponent } from 'vue';
import * as z from 'zod';

import type { Department } from '~/types/department';
import type { Faculty } from '~/types/faculty';
import type { Role } from '~/types/user';

definePageMeta({
  title: 'adminUsers.create.title',
  middleware: ['permission'],
  permission: 'user.create',
});

const UButton = resolveComponent('UButton');
// const UBadge = resolveComponent('UBadge');

const localPath = useLocalePath();
const toast = useToast();
const { locale, t } = useI18n();
const overlay = useOverlay();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const open = ref(false);
// const show = ref(false);
const loading = ref(false);
const isDirty = ref(false);

const formRef = ref<any>(null);

const createUserSchema = z.object({
  // id: z.string().min(1, 'ID is required'),
  studentId: z.string().optional(),
  staffId: z.string().optional(),
  titleEn: z.string(),
  firstNameEn: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.firstNameEn') })),
  lastNameEn: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.lastNameEn') })),
  titleTh: z.string(),
  firstNameTh: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.firstNameTh') })),
  lastNameTh: z.string().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.lastNameTh') })),
  email: z.email(t('common.validation.invalidEmail')),
  // password: z.string().min(8, 'Password must be at least 8 characters'),
});

type CreateUserSchema = z.output<typeof createUserSchema>;

type RoleAssignment = {
  roleId: number | null;
  facultyId: number | null;
  departmentId: number | null;
};

const form = ref<Partial<CreateUserSchema>>({
  // id: '',
  studentId: '',
  staffId: '',
  titleEn: '',
  firstNameEn: '',
  lastNameEn: '',
  titleTh: '',
  firstNameTh: '',
  lastNameTh: '',
  email: '',
  // password: '',
});

const roleAssignments = ref<RoleAssignment[]>([]);

// Faculty options
const { data: faculties } = await useFetch('/api/faculties', {
  transform: res => res.map((f: Faculty) => ({ label: f.nameEn, labelTh: f.nameTh, value: f.id })),
  lazy: true,
});

// Role options
const { data: roles } = await useFetch('/api/roles', {
  transform: res => res.map((r: Role) => ({ label: r.name, labelTh: r.nameTh, value: r.id })),
  lazy: true,
});

// Department options
const { data: departments } = await useFetch('/api/departments', {
  transform: res => res.map((d: Department) => ({ label: d.nameEn, labelTh: d.nameTh, value: d.id, facultyId: d.facultyId })),
  lazy: true,
});

const columns = computed<TableColumn<RoleAssignment>[]>(() => [
  {
    id: 'no',
    header: t('common.table.no'),
    meta: {
      class: {
        th: 'text-right w-20',
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

function getRoleById(roleId: number | null) {
  if (!roleId)
    return null;
  return roles.value?.find(r => r.value === roleId) ?? null;
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

  // Student role must be the only role assignment for a user.
  if (selectedIsStudent && roleAssignments.value.length > 0) {
    toast.add({
      title: t('adminUsers.create.feedback.createError'),
      description: t('adminUsers.shared.validation.studentOnlyRole'),
      color: 'error',
    });
    return;
  }

  if (!selectedIsStudent && hasStudentRole) {
    toast.add({
      title: t('adminUsers.create.feedback.createError'),
      description: t('adminUsers.shared.validation.studentOnlyRole'),
      color: 'error',
    });
    return;
  }

  roleAssignments.value.push({ ...newRoleAssignment.value });
  showRoleError.value = false;
  newRoleAssignment.value = { roleId: null, facultyId: null, departmentId: null };
  open.value = false;
}

function handleCancel() {
  // Navigate back to users list
  navigateTo(localPath('/admin/users'));
}

async function handleCreateUser(event: FormSubmitEvent<CreateUserSchema>) {
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

    // Create the user
    const response = await $fetch('/api/users', {
      method: 'POST',
      body: {
        // id: event.data.id,
        studentId: event.data.studentId,
        staffId: event.data.staffId,
        titleEn: event.data.titleEn,
        firstNameEn: event.data.firstNameEn,
        lastNameEn: event.data.lastNameEn,
        titleTh: event.data.titleTh,
        firstNameTh: event.data.firstNameTh,
        lastNameTh: event.data.lastNameTh,
        email: event.data.email,
        // password: event.data.password,
        roleAssignments: roleAssignments.value,
      },
    });
    if (!response.success) {
      throw new Error('Failed to create user');
    }

    isDirty.value = false;

    toast.add({ title: t('adminUsers.create.feedback.createSuccess'), color: 'success' });
    navigateTo(localPath('/admin/users'));
  }
  catch (error) {
    console.error('Error creating user:', error);
    toast.add({ title: t('adminUsers.create.feedback.createError'), color: 'error' });
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

watch(form, (newData) => {
  isDirty.value = JSON.stringify(newData) !== JSON.stringify({
    // id: '',
    studentId: '',
    staffId: '',
    titleEn: '',
    firstNameEn: '',
    lastNameEn: '',
    titleTh: '',
    firstNameTh: '',
    lastNameTh: '',
    email: '',
    // password: '',
  });
}, { deep: true });

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
  <div class="flex flex-col relative">
    <!-- Main Content -->
    <UForm ref="formRef" :schema="createUserSchema" :state="form" class="flex-1 max-w-360 mx-auto w-full space-y-6" @submit.prevent="handleCreateUser">
      <UButton
        type="button"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        :to="localPath('/admin/users')"
      >
        {{ t('common.actions.backTo', { page: t('adminUsers.list.title') }) }}
      </UButton>

      <!-- Page Header -->
      <div>
        <h1 class="text-2xl font-bold mb-4">
          {{ t('adminUsers.create.title') }}
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
                <!-- ID -->
                <!-- <UFormField
                  label="ID"
                  name="id"
                  required
                  class="col-span-1 md:col-span-2"
                >
                  <UInput
                    v-model="form.id"
                    class="w-full"
                  />
                </UFormField> -->

                <!-- Student ID -->
                <UFormField
                  :label="t('adminUsers.shared.form.studentId')"
                  name="studentId"
                  class="col-span-1 md:col-span-2"
                >
                  <UInput
                    v-model="form.studentId"
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
                required
                class="col-span-1 md:col-span-5"
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
                        <USelectMenu v-model="newRoleAssignment.roleId" :items="availableRolesForAssignment" :label-key="locale === 'th' ? 'labelTh' : 'label'" value-key="value" :placeholder="t('adminUsers.shared.roleTable.selectRole')" :clear="true" size="lg" class="w-full" />
                      </UFormField>
                      <!-- Faculty -->
                      <UFormField
                        :label="t('common.table.faculty')"
                        name="faculty"
                      >
                        <!--
                          Issue: Hover doesn't work for USelectMenu inside UPopover (unless `search-input` is enabled).
                          Workaround: Keep `search-input` enabled and hide it via CSS.
                          TODO: Investigate root cause and replace this workaround.
                        -->
                        <USelectMenu
                          v-model="newRoleAssignment.facultyId" :items="faculties || []" :label-key="locale === 'th' ? 'labelTh' : 'label'" value-key="value" :placeholder="t('adminUsers.shared.roleTable.selectFaculty')" :clear="true" size="lg" class="w-full"
                        />
                      </UFormField>
                      <!-- Department -->
                      <UFormField
                        :label="t('common.table.department')"
                        name="department"
                      >
                        <!--
                          Issue: Hover doesn't work for USelectMenu inside UPopover (unless `search-input` is enabled).
                          Workaround: Keep `search-input` enabled and hide it via CSS.
                          TODO: Investigate root cause and replace this workaround.
                        -->
                        <USelectMenu
                          v-model="newRoleAssignment.departmentId" :items="filteredDepartments" :label-key="locale === 'th' ? 'labelTh' : 'label'" value-key="value" :placeholder="t('adminUsers.shared.roleTable.selectDept')" :clear="true" size="lg" class="w-full"
                        />
                      </UFormField>
                    </div>
                  </template>

                  <template #footer="{ close }">
                    <UButton :label="t('common.actions.cancel')" color="neutral" variant="outline" @click="close" />
                    <UButton :label="t('adminUsers.shared.roleTable.addBtn')" color="primary" :disabled="!newRoleAssignment.roleId || !canAssignSelectedRole" @click="addRoleAssignment" />
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
              icon="i-lucide-triangle-alert"
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
          :label="t('adminUsers.list.addButton')"
          :loading
          @click="handleSubmit"
        />
      </div>
    </UForm>
  </div>
</template>
