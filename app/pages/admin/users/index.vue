<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { h, resolveComponent } from 'vue';

import type { UserListItem } from '~/types/user';

definePageMeta({
  title: 'users',
  middleware: ['permission'],
  permission: 'user.view',
});

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const router = useRouter();
const localPath = useLocalePath();
const { locale, t } = useI18n();

const authStore = useAuthStore();

type SelectOption<T = number | string> = {
  label: string;
  value: T;
};

type FacultyApiItem = {
  id: number;
  nameEn: string;
  nameTh: string;
};

type DepartmentApiItem = {
  id: number;
  nameEn: string;
  nameTh: string;
  facultyId: number;
};

type RoleApiItem = {
  id: number;
  name: string;
  nameTh: string;
};

type AdvancedSearchFilters = {
  facultyId: number | null;
  departmentId: number | null;
  roleId: number | null;
  status: 'active' | 'banned' | 'inactive' | null;
};

function defaultAdvancedFilters(): AdvancedSearchFilters {
  return {
    facultyId: null,
    departmentId: null,
    roleId: null,
    status: null,
  };
}

const searchInput = ref('');
const appliedSearch = ref('');

const advancedFilters = ref<AdvancedSearchFilters>(defaultAdvancedFilters());
const appliedAdvancedFilters = ref<AdvancedSearchFilters>(defaultAdvancedFilters());

const { data: facultiesData } = await useFetch<FacultyApiItem[]>('/api/faculties');
const { data: departmentsData } = await useFetch<DepartmentApiItem[]>('/api/departments');
const { data: rolesData } = await useFetch<RoleApiItem[]>('/api/roles');

const facultyOptions = computed<SelectOption<number>[]>(() => {
  return (facultiesData.value ?? []).map(faculty => ({
    label: locale.value === 'th' ? faculty.nameTh : faculty.nameEn,
    value: faculty.id,
  }));
});

const departmentOptions = computed<(SelectOption<number> & { facultyId: number })[]>(() => {
  return (departmentsData.value ?? []).map((department) => {
    const facultyId = department.facultyId;

    return {
      label: locale.value === 'th' ? department.nameTh : department.nameEn,
      value: department.id,
      facultyId,
    };
  });
});

const roleOptions = computed<SelectOption<number>[]>(() => {
  return (rolesData.value ?? []).map(role => ({
    label: locale.value === 'th' ? role.nameTh : role.name,
    value: role.id,
  }));
});

const statusOptions: SelectOption<'active' | 'banned' | 'inactive'>[] = [
  { label: t('common.status.active'), value: 'active' },
  { label: t('common.status.banned'), value: 'banned' },
  { label: t('common.status.inactive'), value: 'inactive' },
];

const filteredDepartmentOptions = computed(() => {
  const selectedFacultyId = advancedFilters.value.facultyId;
  if (!selectedFacultyId) {
    return departmentOptions.value;
  }

  return departmentOptions.value.filter(department => department.facultyId === selectedFacultyId);
});

watch(() => advancedFilters.value.facultyId, () => {
  const currentDepartmentId = advancedFilters.value.departmentId;
  if (!currentDepartmentId) {
    return;
  }

  const hasDepartmentInFaculty = filteredDepartmentOptions.value.some(option => option.value === currentDepartmentId);
  if (!hasDepartmentInFaculty) {
    advancedFilters.value.departmentId = null;
  }
});

const facultyFilterModel = computed<number | undefined>({
  get: () => advancedFilters.value.facultyId ?? undefined,
  set: value => advancedFilters.value.facultyId = value ?? null,
});

const departmentFilterModel = computed<number | undefined>({
  get: () => advancedFilters.value.departmentId ?? undefined,
  set: value => advancedFilters.value.departmentId = value ?? null,
});

const roleFilterModel = computed<number | undefined>({
  get: () => advancedFilters.value.roleId ?? undefined,
  set: value => advancedFilters.value.roleId = value ?? null,
});

const statusFilterModel = computed<'active' | 'banned' | 'inactive' | undefined>({
  get: () => advancedFilters.value.status ?? undefined,
  set: value => advancedFilters.value.status = value ?? null,
});

const appliedFacultyId = computed(() => appliedAdvancedFilters.value.facultyId);
const appliedDepartmentId = computed(() => appliedAdvancedFilters.value.departmentId);
const appliedRoleId = computed(() => appliedAdvancedFilters.value.roleId);
const appliedStatus = computed(() => appliedAdvancedFilters.value.status);

const { rows: data, isLoading, page, pageSize, total, refresh } = useUsers({
  search: appliedSearch,
  facultyId: appliedFacultyId,
  departmentId: appliedDepartmentId,
  roleId: appliedRoleId,
  status: appliedStatus,
});

const columns: TableColumn<UserListItem>[] = [
  {
    id: 'no',
    header: t('common.table.no'),
    meta: {
      class: {
        th: 'text-right w-20',
        td: 'text-right',
      },
    },
    cell: ({ row }) => (row.index + 1 + (page.value - 1) * pageSize.value).toLocaleString(),
  },
  {
    header: t('adminUsers.list.columns.fullName'),
    cell: ({ row }) => {
      const fullName = locale.value === 'en' ? row.original.fullNameEn : row.original.fullNameTh;
      return h('div', null, fullName);
    },
  },
  {
    accessorKey: 'studentId',
    header: t('adminUsers.list.columns.studentId'),
    cell: ({ getValue }) => {
      const studentId = getValue() as string | null;
      if (!studentId) {
        return h('div', { class: 'text-slate-500' }, '-');
      }
      return h('div', null, studentId);
    },
  },
  {
    accessorKey: 'staffId',
    header: t('adminUsers.list.columns.staffId'),
    cell: ({ getValue }) => {
      const staffId = getValue() as string | null;
      if (!staffId) {
        return h('div', { class: 'text-slate-500' }, '-');
      }
      return h('div', null, staffId);
    },
  },
  {
    accessorKey: 'email',
    header: t('common.table.email'),
  },
  {
    accessorKey: 'roles',
    header: t('common.table.role'),
    cell: ({ row }) => {
      const roles = row.getValue('roles') as { name: string; nameTh: string; count: number }[];
      if (roles.length === 0) {
        return h('div', { class: 'text-slate-500' }, '-');
      }
      return h('div', { class: 'flex flex-wrap gap-1' }, roles?.map(role => h(UBadge, { variant: 'soft', color: 'primary' }, `${locale.value === 'th' ? role.nameTh : role.name} ${role.count > 1 ? `(${role.count})` : ''}`)));
    },
  },
  {
    accessorKey: 'faculties',
    header: t('common.table.faculty'),
    cell: ({ row }) => {
      const faculties = row.getValue('faculties') as { nameEn: string; nameTh: string }[];
      if (faculties.length === 0) {
        return h('div', { class: 'text-slate-500' }, '-');
      }
      return h('div', { class: 'flex flex-wrap gap-1' }, faculties.map(faculty => h('span', null, locale.value === 'en' ? faculty.nameEn : faculty.nameTh)));
    },
  },
  {
    accessorKey: 'banned',
    header: t('common.table.status'),
    cell: ({ row }) => {
      const { banned, isActive } = row.original;
      const color = banned ? 'error' : isActive ? 'success' : 'neutral';
      const statusText = banned ? t('common.status.banned') : isActive ? t('common.status.active') : t('common.status.inactive');
      return h(UBadge, { variant: 'soft', color }, statusText);
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
      const actionButtons = [
        // For view button, the permission middleware will handle access control at the route level,
        // so we show the button regardless of permissions
        h(
          UButton,
          {
            'color': 'neutral',
            'variant': 'ghost',
            'icon': 'i-lucide-eye',
            'aria-label': t('common.table.actions'),
            onClick() {
            // Navigate to user details page
              router.push(localPath(`/admin/users/${row.original.id}?tab=overview`));
            },
          },
        ),
      ];

      if (authStore.can('user.edit')) {
        actionButtons.push(
          h(
            UButton,
            {
              'color': 'primary',
              'variant': 'ghost',
              'icon': 'i-lucide-pencil',
              'aria-label': t('common.table.actions'),
              onClick() {
                // Navigate to user edit page
                router.push(localPath(`/admin/users/${row.original.id}/edit`));
              },
            },
          ),
        );
      }

      return h('div', { class: 'flex items-center justify-end gap-2' }, actionButtons);
    },
  },
];

const advancedSearchOpen = ref(false);

function applySearch() {
  appliedSearch.value = searchInput.value.trim();
  page.value = 1;
}

function clearAdvancedSearch() {
  advancedFilters.value = defaultAdvancedFilters();
  appliedAdvancedFilters.value = { ...advancedFilters.value };
  page.value = 1;
  advancedSearchOpen.value = false;
}

function applyAdvancedSearch() {
  appliedAdvancedFilters.value = { ...advancedFilters.value };
  page.value = 1;
  advancedSearchOpen.value = false;
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          {{ t('adminUsers.list.title') }}
        </h1>
        <p>{{ t('adminUsers.description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <AdminUsersImportCsvModal v-if="authStore.can('user.import')" @imported="refresh" />

        <UButton v-if="authStore.can('user.create')" icon="i-lucide-plus" size="md" :to="localPath('/admin/users/create')">
          {{ t('adminUsers.list.addButton') }}
        </UButton>
      </div>
    </div>
    <div class="w-full">
      <div class="max-w-md ml-auto">
        <UFieldGroup class="w-full">
          <UInput v-model="searchInput" class="w-full" icon="i-lucide-search" size="lg" variant="outline" :placeholder="t('adminUsers.list.search')" @keyup.enter="applySearch" />
          <UButton icon="i-lucide-search" :label="t('adminUsers.list.search')" color="primary" variant="solid" :loading="isLoading" @click="applySearch" />
          <UPopover
            v-model:open="advancedSearchOpen"
            :content="{
              align: 'end',
              side: 'bottom',
            }"
          >
            <UButton
              color="primary" variant="ghost" :leading-icon="advancedSearchOpen ? 'i-lucide-x' : 'i-lucide-sliders-horizontal'" :ui="{
                leadingIcon: `${advancedSearchOpen ? 'rotate-180' : ''} transition-transform duration-200`,
              }"
            />
            <template #content>
              <div class="w-lg p-4 space-y-4">
                <div class="grid grid-cols-2 gap-3">
                  <UFormField :label="t('adminUsers.list.advancedSearch.fields.faculty')">
                    <!--
                      Issue: Hover doesn't work for USelectMenu inside UPopover (unless `search-input` is enabled).
                      Workaround: Keep `search-input` enabled and hide it via CSS.
                      TODO: Investigate root cause and replace this workaround.
                      -->
                    <USelectMenu
                      v-model="facultyFilterModel"
                      class="w-full"
                      :items="facultyOptions"
                      label-key="label"
                      value-key="value"
                      :placeholder="t('common.status.all')"
                      clear
                      :ui="{
                        input: 'hidden',
                        content: 'min-w-fit',
                      }"
                    />
                  </UFormField>

                  <UFormField :label="t('adminUsers.list.advancedSearch.fields.department')">
                    <USelectMenu
                      v-model="departmentFilterModel"
                      class="w-full"
                      arrow
                      :items="filteredDepartmentOptions"
                      label-key="label"
                      value-key="value"
                      :placeholder="t('common.status.all')"
                      clear
                      :ui="{
                        content: 'min-w-fit',
                      }"
                    />
                  </UFormField>

                  <UFormField :label="t('adminUsers.list.advancedSearch.fields.role')">
                    <USelectMenu
                      v-model="roleFilterModel"
                      class="w-full"
                      arrow
                      :items="roleOptions"
                      label-key="label"
                      value-key="value"
                      :placeholder="t('common.status.all')"
                      clear
                    />
                  </UFormField>

                  <UFormField :label="t('adminUsers.list.advancedSearch.fields.status')">
                    <!--
                      Issue: Hover doesn't work for USelectMenu inside UPopover (unless `search-input` is enabled).
                      Workaround: Keep `search-input` enabled and hide it via CSS.
                      TODO: Investigate root cause and replace this workaround.
                      -->
                    <USelectMenu
                      v-model="statusFilterModel"
                      class="w-full"
                      :items="statusOptions"
                      label-key="label"
                      value-key="value"
                      :placeholder="t('common.status.all')"
                      clear
                      :ui="{
                        input: 'hidden',
                      }"
                    />
                  </UFormField>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t border-default">
                  <UButton
                    color="neutral" variant="ghost" :ui="{
                      base: 'rounded-md!',
                    }" @click="clearAdvancedSearch"
                  >
                    {{ t('common.actions.clear') }}
                  </UButton>
                  <UButton
                    color="primary" :ui="{
                      base: 'rounded-md!',
                    }" @click="applyAdvancedSearch"
                  >
                    {{ t('common.actions.applySearch') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
        </UFieldGroup>
      </div>
    </div>
    <UCard>
      <UTable
        :data="data"
        :columns
        :loading="isLoading"
        class="flex-1"
      />
      <div class="flex justify-center gap-2 border-t border-default pt-4 px-4">
        <UPagination
          v-model:page="page"
          :items-per-page="pageSize"
          :total="total"
          show-edges
        />
        <USelect v-model="pageSize" :items="[5, 10, 20, 50]" />
      </div>
    </UCard>
  </div>
</template>
