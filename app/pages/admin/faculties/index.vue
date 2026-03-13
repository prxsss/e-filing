<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'faculties',
});
const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');
// const UIcon = resolveComponent('UIcon');

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

// const searchTerm = ref('');
</script>

<template>
  <div class="space-y-6 pt-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          Faculty Management
        </h1>
        <p>
          View and organize all university faculties and their respective deans.
        </p>
      </div>
      <UButton icon="i-lucide-plus" size="md" :to="localPath('/admin/faculties/create')">
        Add New Faculty
      </UButton>
    </div>

    <!-- <div class="flex flex-col md:flex-row gap-4 items-center">
      <div class="flex-1 w-full max-w-sm">
        <UInput
          v-model="searchTerm"
          icon="i-lucide-search"
          placeholder="Search by faculty name, dean or ID..."
          size="lg"
          variant="outline"
          class="w-full"
        />
      </div>
      <div class="flex items-center gap-2 w-full md:w-auto">
        <UButton color="neutral" variant="outline" icon="i-lucide-list-filter" size="md">
          Filters
        </UButton>
        <UButton color="neutral" variant="outline" icon="i-lucide-download" size="md">
          Export
        </UButton>
      </div>
    </div> -->
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
      <!-- <div class="flex justify-between items-center border-t border-default pt-4 px-4">
        <span class="text-sm font-medium text-slate-500 dark:text-slate-400">Showing 1 to 4 of {{ total }} faculties</span>
        <div class="flex justify-center gap-2">
          <UPagination
            v-model:page="page"
            :items-per-page="pageSize"
            :total="total"
            show-edges
          />
        </div>
      </div> -->
    </UCard>

    <!-- <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <UIcon name="i-lucide-building-2" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Faculties
            </p>
            <p class="text-2xl font-black leading-tight">
              12
            </p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
            <UIcon name="i-lucide-share-2" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Departments
            </p>
            <p class="text-2xl font-black leading-tight">
              48
            </p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <UIcon name="i-lucide-users" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Senior Staff
            </p>
            <p class="text-2xl font-black leading-tight">
              156
            </p>
          </div>
        </div>
      </UCard>
    </div> -->
  </div>
</template>
