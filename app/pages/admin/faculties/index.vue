<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'faculties',
});
const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const localPath = useLocalePath();
const { locale } = useI18n();
const router = useRouter();
const toast = useToast();
const overlay = useOverlay();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);
const deletingFacultyId = ref<number | null>(null);

type FacultyListItem = {
  id: number;
  facultyCode: string;
  nameEn: string;
  nameTh: string;
  departmentCount: number;
  deanNameEn: string;
  deanNameTh: string;
};

const { rows, isLoading, page, pageSize, total, refresh } = useFaculties();

const columns: TableColumn<FacultyListItem>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Faculty Name',
    cell: ({ row }) => {
      const name = locale.value === 'en' ? row.original.nameEn : row.original.nameTh;
      return h('div', null, name);
    },
  },
  {
    accessorKey: 'departmentCount',
    header: 'Departments',
    cell: ({ row }) => h('div', null, h(UBadge, { variant: 'soft', color: 'neutral', class: 'font-bold rounded-full' }, row.original.departmentCount)),
  },
  {
    accessorKey: 'deanName',
    header: 'Dean Name',
    cell: ({ row }) => {
      const deanName = locale.value === 'en' ? row.original.deanNameEn : row.original.deanNameTh;
      return h('div', null, deanName ?? '-');
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
        h(UButton, {
          color: 'primary',
          variant: 'ghost',
          icon: 'i-lucide-pencil',
          onClick: () => router.push(localPath(`/admin/faculties/${row.original.id}/edit`)),
        }),
        h(UButton, {
          color: 'error',
          variant: 'ghost',
          icon: 'i-lucide-trash-2',
          loading: deletingFacultyId.value === row.original.id,
          disabled: deletingFacultyId.value === row.original.id,
          onClick: async () => {
            const instance = confirmDialog.open({
              title: 'Confirm Deletion',
              description: `Are you sure you want to delete the faculty "${locale.value === 'en' ? row.original.nameEn : row.original.nameTh}"? This action cannot be undone.`,
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
                deletingFacultyId.value = row.original.id;

                await $fetch(`/api/admin/faculties/${row.original.id}`, {
                  method: 'DELETE',
                });

                toast.add({
                  title: 'Success',
                  description: 'Faculty has been deleted successfully.',
                  color: 'success',
                });

                await refresh();
              }
              catch (error: any) {
                toast.add({
                  title: 'Cannot delete faculty',
                  description: error?.data?.message || 'Failed to delete faculty. Please try again.',
                  color: 'error',
                });
              }
              finally {
                deletingFacultyId.value = null;
              }
            }
          },
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
          Faculties
        </h1>
        <p>
          View and organize all university faculties and their respective deans.
        </p>
      </div>
      <UButton icon="i-lucide-plus" size="md" :to="localPath('/admin/faculties/create')">
        Add New Faculty
      </UButton>
    </div>

    <div class="w-full">
      <div class="max-w-sm">
        <UInput class="w-full" icon="i-lucide-search" size="lg" variant="outline" placeholder="Search by faculty name..." />
      </div>
    </div>

    <UCard>
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
