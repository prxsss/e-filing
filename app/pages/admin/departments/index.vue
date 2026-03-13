<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, resolveComponent, watch } from 'vue';

definePageMeta({
  title: 'departments',
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

const localPath = useLocalePath();
const { locale } = useI18n();
const toast = useToast();
const overlay = useOverlay();

const searchTerm = ref('');
const selectedFacultyId = ref<number | 'all'>('all');
const page = ref(1);
const pageSize = ref(5);
const deletingDepartmentId = ref<number | null>(null);

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const { data: departmentsData, status, refresh } = await useFetch<DepartmentListItem[]>('/api/admin/departments');

function getFacultyName(row: DepartmentListItem) {
  if (!row.faculty)
    return '-';

  return locale.value === 'en' ? row.faculty.nameEn : row.faculty.nameTh;
}

function getHeadOfDeptName(row: DepartmentListItem) {
  if (locale.value === 'en')
    return row.headOfDeptEn ?? row.headOfDeptTh ?? '-';

  return row.headOfDeptTh ?? row.headOfDeptEn ?? '-';
}

const filteredRows = computed(() => {
  const rows = departmentsData.value ?? [];
  const term = searchTerm.value.trim().toLowerCase();

  return rows.filter((row) => {
    const departmentName = locale.value === 'en' ? row.nameEn : row.nameTh;
    const facultyName = getFacultyName(row);

    const matchFaculty = selectedFacultyId.value === 'all' || row.faculty?.id === selectedFacultyId.value;
    const matchSearch = !term
      || row.departmentCode.toLowerCase().includes(term)
      || departmentName.toLowerCase().includes(term)
      || facultyName.toLowerCase().includes(term);

    return matchFaculty && matchSearch;
  });
});

const total = computed(() => filteredRows.value.length);

const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

watch([searchTerm, selectedFacultyId, pageSize], () => {
  page.value = 1;
});

watch(total, () => {
  const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value));
  if (page.value > maxPage)
    page.value = maxPage;
});

function handleAddDepartment() {
  navigateTo(localPath('/admin/departments/create'));
}

function handleEditDepartment(id: number) {
  navigateTo(localPath(`/admin/departments/${id}/edit`));
}

async function handleDeleteDepartment(id: number, name: string) {
  const instance = confirmDialog.open({
    title: 'Confirm Deletion',
    description: `Are you sure you want to delete the department "${name}"? This action cannot be undone.`,
    cancelButton: {
      label: 'Cancel',
    },
    confirmButton: {
      label: 'Delete',
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
        title: 'Success',
        description: 'Department has been deleted successfully.',
        color: 'success',
      });

      await refresh();
    }
    catch (error: any) {
      toast.add({
        title: 'Cannot delete department',
        description: error?.data?.message || 'Failed to delete department. Please try again.',
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
    accessorKey: 'id',
    header: 'ID',
  },
  {
    id: 'name',
    header: 'Department Name',
    cell: ({ row }) => {
      const name = locale.value === 'en' ? row.original.nameEn : row.original.nameTh;
      return h('div', null, name);
    },
  },
  {
    id: 'faculty',
    header: 'Faculty',
    cell: ({ row }) => {
      const facultyName = getFacultyName(row.original);
      return h('div', null, facultyName);
    },
  },
  {
    id: 'head',
    header: 'Head of Dept.',
    cell: ({ row }) => h('div', { class: 'text-muted' }, getHeadOfDeptName(row.original)),
  },
  {
    id: 'actions',
    header: 'Actions',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right',
      },
    },
    cell: ({ row }) => {
      const departmentName = locale.value === 'en' ? row.original.nameEn : row.original.nameTh;

      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(UButton, {
          color: 'primary',
          variant: 'ghost',
          icon: 'i-lucide-pencil',
          onClick: () => handleEditDepartment(row.original.id),
        }),
        h(UButton, {
          color: 'error',
          variant: 'ghost',
          icon: 'i-lucide-trash-2',
          loading: deletingDepartmentId.value === row.original.id,
          disabled: deletingDepartmentId.value === row.original.id,
          onClick: async () => await handleDeleteDepartment(row.original.id, departmentName),
        }),
      ]);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          Departments
        </h1>
        <p>
          Manage and organize university academic departments.
        </p>
      </div>
      <UButton icon="i-lucide-plus" @click="handleAddDepartment">
        Add Department
      </UButton>
    </div>

    <div class="w-full">
      <div class="max-w-sm">
        <UInput class="w-full" icon="i-lucide-search" size="lg" variant="outline" placeholder="Search by name, email, or ID..." />
      </div>
    </div>

    <UCard>
      <UTable :data="paginatedRows" :columns="columns" :loading="status === 'pending'" class="flex-1" />

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
