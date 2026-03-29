<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';

import { computed, h, ref, resolveComponent } from 'vue';
import * as z from 'zod';

import type { Department } from '~/types/department';
import type { Faculty } from '~/types/faculty';
import type { Role } from '~/types/user';

definePageMeta({
  title: 'profile.title',
  middleware: ['permission'],
  permission: 'request.sign',
});

type RoleAssignment = {
  roleId: number | null;
  facultyId: number | null;
  departmentId: number | null;
};

type ProfilePayload = {
  profile: {
    id: string;
    titleEn: string | null;
    firstNameEn: string;
    lastNameEn: string;
    titleTh: string | null;
    firstNameTh: string;
    lastNameTh: string;
    email: string;
    roleAssignments: RoleAssignment[];
  };
  roles: {
    id: number;
    name: string;
    nameTh: string;
  }[];
};

const { t, locale } = useI18n();
const toast = useToast();
const authStore = useAuthStore();
const UButton = resolveComponent('UButton');

const open = ref(false);
const saving = ref(false);
const showRoleError = ref(false);

const schema = z.object({
  titleEn: z.string().max(20).optional(),
  firstNameEn: z.string().trim().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.firstNameEn') })),
  lastNameEn: z.string().trim().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.lastNameEn') })),
  titleTh: z.string().max(20).optional(),
  firstNameTh: z.string().trim().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.firstNameTh') })),
  lastNameTh: z.string().trim().min(1, t('common.validation.required', { field: t('adminUsers.shared.form.lastNameTh') })),
  roleAssignments: z.array(z.object({
    roleId: z.number().int().positive(),
    facultyId: z.number().int().positive().nullable(),
    departmentId: z.number().int().positive().nullable(),
  })).min(1, t('adminUsers.shared.validation.roleRequired')),
});

type Schema = z.output<typeof schema>;
type SelectedRoleAssignment = Schema['roleAssignments'][number];

const formRef = ref<any>(null);

const form = reactive<Schema>({
  titleEn: '',
  firstNameEn: '',
  lastNameEn: '',
  titleTh: '',
  firstNameTh: '',
  lastNameTh: '',
  roleAssignments: [],
});

const newRoleAssignment = ref<RoleAssignment>({
  roleId: null,
  facultyId: null,
  departmentId: null,
});

const { data: faculties } = await useFetch('/api/faculties', {
  transform: res => res.map((f: Faculty) => ({ label: f.nameEn, labelTh: f.nameTh, value: f.id })),
});

const { data: departments } = await useFetch('/api/departments', {
  transform: res => res.map((d: Department) => ({ label: d.nameEn, labelTh: d.nameTh, value: d.id, facultyId: d.facultyId })),
  lazy: true,
});

const { data, status, error, refresh } = await useFetch<ProfilePayload>('/api/profile', {
  default: () => ({
    profile: {
      id: '',
      titleEn: null,
      firstNameEn: '',
      lastNameEn: '',
      titleTh: null,
      firstNameTh: '',
      lastNameTh: '',
      email: '',
      roleAssignments: [],
    },
    roles: [],
  }),
});

watch(
  () => data.value?.profile,
  (profile) => {
    if (!profile)
      return;

    form.titleEn = profile.titleEn ?? '';
    form.firstNameEn = profile.firstNameEn;
    form.lastNameEn = profile.lastNameEn;
    form.titleTh = profile.titleTh ?? '';
    form.firstNameTh = profile.firstNameTh;
    form.lastNameTh = profile.lastNameTh;
    const mappedAssignments: SelectedRoleAssignment[] = [];
    const sourceAssignments = Array.isArray(profile.roleAssignments)
      ? profile.roleAssignments
      : profile.roleAssignments ? [profile.roleAssignments] : [];

    for (const item of sourceAssignments) {
      if (!item.roleId)
        continue;

      mappedAssignments.push({
        roleId: item.roleId,
        facultyId: item.facultyId,
        departmentId: item.departmentId,
      });
    }

    form.roleAssignments = mappedAssignments;
  },
  { immediate: true },
);

const roleItems = computed(() =>
  (data.value?.roles ?? []).map((role: Role) => ({
    value: role.id,
    label: role.name,
    labelTh: role.nameTh,
  })),
);

const filteredDepartments = computed(() => {
  if (!departments.value)
    return [];
  if (!newRoleAssignment.value.facultyId)
    return departments.value;
  return departments.value.filter(item => item.facultyId === newRoleAssignment.value.facultyId);
});

const availableRolesForAssignment = computed(() => {
  const selectedRoleIds = new Set(
    form.roleAssignments
      .map(item => item.roleId)
      .filter((value): value is number => Boolean(value)),
  );

  return roleItems.value.filter(role => !selectedRoleIds.has(role.value));
});

const columns = computed<TableColumn<SelectedRoleAssignment>[]>(() => [
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
      const role = roleItems.value.find(item => item.value === roleId);
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
      const faculty = faculties.value?.find(item => item.value === facultyId);
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
      const department = departments.value?.find(item => item.value === departmentId);
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
    cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-2' }, [
      h(UButton, {
        color: 'error',
        variant: 'soft',
        icon: 'i-lucide-trash-2',
        onClick() {
          form.roleAssignments = form.roleAssignments.filter(item => item !== row.original);
          showRoleError.value = form.roleAssignments.length === 0;
        },
      }),
    ]),
  },
]);

function addRoleAssignment() {
  if (!newRoleAssignment.value.roleId)
    return;

  const duplicate = form.roleAssignments.some(item =>
    item.roleId === newRoleAssignment.value.roleId
    && item.facultyId === newRoleAssignment.value.facultyId
    && item.departmentId === newRoleAssignment.value.departmentId,
  );

  if (duplicate) {
    toast.add({
      title: t('profile.feedback.roleDuplicate'),
      color: 'warning',
    });
    return;
  }

  form.roleAssignments.push({
    roleId: newRoleAssignment.value.roleId,
    facultyId: newRoleAssignment.value.facultyId,
    departmentId: newRoleAssignment.value.departmentId,
  });

  showRoleError.value = false;
  newRoleAssignment.value = { roleId: null, facultyId: null, departmentId: null };
  open.value = false;
}

async function handleSubmit(event: FormSubmitEvent<Schema>) {
  if (form.roleAssignments.length === 0) {
    showRoleError.value = true;
    return;
  }

  try {
    saving.value = true;

    await $fetch('/api/profile', {
      method: 'PUT',
      body: event.data,
    });

    await Promise.all([refresh(), authStore.session.fetch()]);

    toast.add({
      title: t('profile.feedback.saveSuccess'),
      color: 'success',
    });
  }
  catch (submitError: any) {
    const message = submitError?.data?.message || t('profile.feedback.saveError');

    toast.add({
      title: t('profile.feedback.saveError'),
      description: message,
      color: 'error',
    });
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <UContainer class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold">
        {{ t('profile.title') }}
      </h1>
      <p class="text-sm text-muted">
        {{ t('profile.description') }}
      </p>
    </div>

    <UAlert
      v-if="status === 'error'"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('profile.feedback.loadError')"
      :description="error?.message"
    />

    <UCard v-else>
      <UForm ref="formRef" :schema="schema" :state="form" class="space-y-6" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <UFormField :label="t('common.form.email')" class="md:col-span-12">
            <UInput :model-value="data?.profile?.email ?? ''" disabled variant="subtle" class="w-full" />
          </UFormField>

          <UFormField :label="t('adminUsers.shared.form.titleEn')" name="titleEn" class="md:col-span-3">
            <UInput v-model="form.titleEn" class="w-full" />
          </UFormField>

          <UFormField :label="t('adminUsers.shared.form.firstNameEn')" name="firstNameEn" required class="md:col-span-4">
            <UInput v-model="form.firstNameEn" class="w-full" />
          </UFormField>

          <UFormField :label="t('adminUsers.shared.form.lastNameEn')" name="lastNameEn" required class="md:col-span-5">
            <UInput v-model="form.lastNameEn" class="w-full" />
          </UFormField>

          <UFormField :label="t('adminUsers.shared.form.titleTh')" name="titleTh" class="md:col-span-3">
            <UInput v-model="form.titleTh" class="w-full" />
          </UFormField>

          <UFormField :label="t('adminUsers.shared.form.firstNameTh')" name="firstNameTh" required class="md:col-span-4">
            <UInput v-model="form.firstNameTh" class="w-full" />
          </UFormField>

          <UFormField :label="t('adminUsers.shared.form.lastNameTh')" name="lastNameTh" required class="md:col-span-5">
            <UInput v-model="form.lastNameTh" class="w-full" />
          </UFormField>

          <div class="md:col-span-12">
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
                    <UButton icon="i-lucide-plus" :label="t('adminUsers.shared.roleTable.modalTitle')" variant="soft" />

                    <template #body>
                      <div class="space-y-4">
                        <UFormField
                          :label="t('common.table.role')"
                          required
                        >
                          <USelectMenu
                            v-model="newRoleAssignment.roleId"
                            :items="availableRolesForAssignment"
                            :label-key="locale === 'th' ? 'labelTh' : 'label'"
                            value-key="value"
                            :placeholder="t('adminUsers.shared.roleTable.selectRole')"
                            :clear="true"
                            size="xl"
                            class="w-full"
                          />
                        </UFormField>

                        <UFormField
                          :label="t('common.table.faculty')"
                          required
                        >
                          <USelectMenu
                            v-model="newRoleAssignment.facultyId"
                            :items="faculties || []"
                            :label-key="locale === 'th' ? 'labelTh' : 'label'"
                            value-key="value"
                            :placeholder="t('adminUsers.shared.roleTable.selectFaculty')"
                            :clear="true"
                            size="xl"
                            class="w-full"
                          />
                        </UFormField>

                        <UFormField
                          :label="t('common.table.department')"
                        >
                          <USelectMenu
                            v-model="newRoleAssignment.departmentId"
                            :items="filteredDepartments"
                            :label-key="locale === 'th' ? 'labelTh' : 'label'"
                            value-key="value"
                            :placeholder="t('adminUsers.shared.roleTable.selectDept')"
                            :clear="true"
                            size="xl"
                            class="w-full"
                          />
                        </UFormField>
                      </div>
                    </template>

                    <template #footer="{ close }">
                      <UButton :label="t('common.actions.cancel')" color="neutral" variant="outline" @click="close" />
                      <UButton :label="t('adminUsers.shared.roleTable.addBtn')" color="primary" :disabled="!newRoleAssignment.roleId || !newRoleAssignment.facultyId" @click="addRoleAssignment" />
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
                :data="form.roleAssignments"
                :columns="columns"
                class=""
              />
            </UCard>
          </div>
        </div>

        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-shield-check"
          :title="t('profile.form.roleRestrictionTitle')"
          :description="t('profile.form.roleRestrictionDescription')"
        />

        <div class="flex justify-end">
          <UButton type="submit" color="primary" :loading="saving" :disabled="status === 'pending'">
            {{ t('common.actions.save') }}
          </UButton>
        </div>
      </UForm>
    </UCard>
  </UContainer>
</template>
