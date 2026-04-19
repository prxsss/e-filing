<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'departments',
  middleware: ['permission'],
  permission: 'department.view',
});

type DepartmentListItem = {
  id: number;
  departmentCode: string;
  nameEn: string;
  nameTh: string;
  faculty: {
    id: number;
    nameEn: string;
    nameTh: string;
  } | null;
  headOfDeptEn: string | null;
  headOfDeptTh: string | null;
};

const UButton = resolveComponent('UButton');

const route = useRoute();
const router = useRouter();
const localPath = useLocalePath();
const { locale, t } = useI18n();
const toast = useToast();
const overlay = useOverlay();

const authStore = useAuthStore();

const deletingDepartmentId = ref<number | null>(null);

function getSearchQueryValue(queryValue: unknown) {
  if (Array.isArray(queryValue)) {
    const firstValue = queryValue[0];
    return typeof firstValue === 'string' ? firstValue.trim() : '';
  }

  return typeof queryValue === 'string' ? queryValue.trim() : '';
}

function getFacultyIdQueryValue(queryValue: unknown) {
  const rawValue = getSearchQueryValue(queryValue);
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return parsedValue;
}

const initialSearch = getSearchQueryValue(route.query.search);
const initialFacultyId = getFacultyIdQueryValue(route.query.facultyId);

const searchInput = ref(initialSearch);
const appliedSearch = ref(initialSearch);
const showClearSearchButton = computed(() => appliedSearch.value.length > 0);
const selectedFacultyId = ref<number | undefined>(initialFacultyId);
// const appliedFacultyId = ref<number | undefined>(undefined);

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const { data: faculties } = useFetch('/api/faculties');

const facultyOptions = computed(() => {
  return (faculties.value ?? []).map(faculty => ({
    label: locale.value === 'en' ? faculty.nameEn : faculty.nameTh,
    value: faculty.id,
  }));
});

const { rows, isLoading, page, pageSize, total, refresh } = useDepartments({
  search: appliedSearch,
  facultyId: selectedFacultyId,
});

function resolveDeleteDepartmentErrorMessage(error: unknown) {
  const fetchError = error as {
    data?: {
      code?: string;
      message?: string;
      data?: {
        code?: string;
      };
    };
    message?: string;
  };

  const errorCode = fetchError.data?.code ?? fetchError.data?.data?.code;
  const backendMessage = fetchError.data?.message ?? fetchError.message;

  if (
    errorCode === 'DEPARTMENT_HAS_LINKED_USERS'
    || backendMessage === 'Cannot delete this department because it still has users linked to it.'
  ) {
    return t('adminDepartments.error.deleteBlockedByLinkedUsers');
  }

  return backendMessage || t('adminDepartments.error.delete');
}

function applySearch() {
  const normalizedSearch = searchInput.value.trim();
  appliedSearch.value = normalizedSearch;
  page.value = 1;

  const nextQuery = { ...route.query } as Record<string, string | (string | null)[] | null | undefined>;
  if (normalizedSearch) {
    nextQuery.search = normalizedSearch;
  }
  else {
    delete nextQuery.search;
  }

  if (selectedFacultyId.value) {
    nextQuery.facultyId = String(selectedFacultyId.value);
  }
  else {
    delete nextQuery.facultyId;
  }

  void router.replace({ query: nextQuery });
}

function clearSearch() {
  searchInput.value = '';
  appliedSearch.value = '';
  page.value = 1;

  const nextQuery = { ...route.query } as Record<string, string | (string | null)[] | null | undefined>;
  delete nextQuery.search;

  void router.replace({ query: nextQuery });
}

watch(selectedFacultyId, (value) => {
  const nextQuery = { ...route.query } as Record<string, string | (string | null)[] | null | undefined>;
  if (value) {
    nextQuery.facultyId = String(value);
  }
  else {
    delete nextQuery.facultyId;
  }

  void router.replace({ query: nextQuery });
});

function getFacultyName(row: DepartmentListItem) {
  if (!row.faculty)
    return '-';

  return locale.value === 'en' ? row.faculty.nameEn : row.faculty.nameTh;
}

function handleAddDepartment() {
  navigateTo(localPath('/admin/departments/create'));
}

function handleEditDepartment(id: number) {
  navigateTo(localPath(`/admin/departments/${id}/edit`));
}

async function handleDeleteDepartment(id: number, name: string) {
  const instance = confirmDialog.open({
    title: t('common.dialog.confirmDelete'),
    description: t('common.dialog.deleteMessage', { name }),
    cancelButton: {
      label: t('common.actions.cancel'),
    },
    confirmButton: {
      label: t('common.actions.delete'),
      color: 'error',
    },
  });

  const shouldDelete = await instance.result;
  if (shouldDelete) {
    try {
      deletingDepartmentId.value = id;

      await $fetch(`/api/admin/departments/${id}`, {
        method: 'DELETE',
      });

      toast.add({
        title: t('adminDepartments.success.delete'),
        color: 'success',
      });

      await refresh();
    }
    catch (error) {
      toast.add({
        title: t('adminDepartments.error.delete'),
        description: resolveDeleteDepartmentErrorMessage(error),
        color: 'error',
      });
    }
    finally {
      deletingDepartmentId.value = null;
    }
  }
}

const columns: TableColumn<DepartmentListItem>[] = [
  {
    accessorKey: 'rowNo',
    header: '#',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ row }) => (row.index + 1 + (page.value - 1) * pageSize.value).toLocaleString(),
  },
  {
    accessorKey: 'departmentCode',
    header: t('adminDepartments.list.columns.departmentCode'),
  },
  {
    id: 'name',
    header: t('adminDepartments.list.columns.name'),
    cell: ({ row }) => {
      const name = locale.value === 'en' ? row.original.nameEn : row.original.nameTh;
      return h('div', null, name);
    },
  },
  {
    id: 'faculty',
    header: t('adminDepartments.list.columns.faculty'),
    cell: ({ row }) => {
      const facultyName = getFacultyName(row.original);
      return h('div', null, facultyName);
    },
  },
  {
    id: 'headOfDepartment',
    header: t('adminDepartments.list.columns.headOfDepartment'),
    cell: ({ row }) => {
      const headOfDepartment = locale.value === 'en' ? row.original.headOfDeptEn : row.original.headOfDeptTh;
      return h('div', null, headOfDepartment ?? '-');
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
      const departmentName = locale.value === 'en' ? row.original.nameEn : row.original.nameTh;
      const canEditDepartment = authStore.can('department.edit');
      const canDeleteDepartment = authStore.can('department.delete');

      const actionButtons = [];

      if (canEditDepartment) {
        actionButtons.push(
          h(UButton, {
            color: 'primary',
            variant: 'ghost',
            icon: 'i-lucide-pencil',
            onClick: () => handleEditDepartment(row.original.id),
          }),
        );
      }

      if (canDeleteDepartment) {
        actionButtons.push(
          h(UButton, {
            color: 'error',
            variant: 'ghost',
            icon: 'i-lucide-trash-2',
            loading: deletingDepartmentId.value === row.original.id,
            disabled: deletingDepartmentId.value === row.original.id,
            onClick: async () => await handleDeleteDepartment(row.original.id, departmentName),
          }),
        );
      }

      return h('div', { class: 'flex items-center justify-end gap-1' }, actionButtons);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          {{ t('adminDepartments.title') }}
        </h1>
        <p>{{ t('adminDepartments.description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="authStore.can('department.create')" icon="i-lucide-plus" size="md" @click="handleAddDepartment">
          {{ t('adminDepartments.list.addButton') }}
        </UButton>
      </div>
    </div>
    <div class="w-full">
      <div class="max-w-md ml-auto">
        <UFieldGroup class="w-full">
          <UInput
            v-model="searchInput"
            class="w-full"
            icon="i-lucide-search"
            size="lg"
            variant="outline"
            :placeholder="t('adminDepartments.list.search')"
            @keyup.enter="applySearch"
          >
            <template v-if="showClearSearchButton" #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                aria-label="Clear input"
                @click="clearSearch"
              />
            </template>
          </UInput>
          <UButton icon="i-lucide-search" :label="t('adminDepartments.list.search')" color="primary" variant="solid" :loading="isLoading" @click="applySearch" />
        </UFieldGroup>
      </div>
    </div>

    <UCard>
      <div class="flex justify-end">
        <!--
            Issue: Hover doesn't work for USelectMenu (unless `search-input` is enabled).
            Workaround: Keep `search-input` enabled and hide it via CSS.
            TODO: Investigate root cause and replace this workaround.
          -->
        <USelectMenu
          v-model="selectedFacultyId"
          :items="facultyOptions"
          label-key="label"
          value-key="value"
          :placeholder="t('adminDepartments.list.columns.faculty')"
          clear
          :ui="{
            input: 'hidden',
            content: 'min-w-fit',
          }"
        />
      </div>

      <UTable :data="rows" :columns="columns" :loading="isLoading" class="flex-1" />

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
