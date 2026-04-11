<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import { h, resolveComponent } from 'vue';

definePageMeta({
  title: 'faculties',
  middleware: ['permission'],
  permission: 'faculty.view',
});

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const localPath = useLocalePath();
const { locale, t } = useI18n();
const router = useRouter();
const toast = useToast();
const overlay = useOverlay();

const authStore = useAuthStore();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);
const deletingFacultyId = ref<number | null>(null);
const searchInput = ref('');
const appliedSearch = ref('');

type FacultyListItem = {
  id: number;
  facultyCode: string;
  nameEn: string;
  nameTh: string;
  departmentCount: number;
  deanNameEn: string;
  deanNameTh: string;
};

const { rows, isLoading, page, pageSize, total, refresh } = useFaculties({
  search: appliedSearch,
});

function resolveDeleteFacultyErrorMessage(error: unknown) {
  const fetchError = error as {
    data?: {
      message?: string;
    };
    message?: string;
  };

  const backendMessage = fetchError.data?.message ?? fetchError.message;

  switch (backendMessage) {
    case 'Cannot delete this faculty because it still has departments linked to it.':
      return t('adminFaculties.error.deleteBlockedByDepartments');
    case 'Cannot delete this faculty because it is still used in role assignments.':
      return t('adminFaculties.error.deleteBlockedByRoleAssignments');
    default:
      return t('adminFaculties.error.deleteErrorMessage', {
        message: backendMessage || t('common.status.unknownError'),
      });
  }
}

function applySearch() {
  appliedSearch.value = searchInput.value.trim();
  page.value = 1;
}

const columns: TableColumn<FacultyListItem>[] = [
  {
    id: 'no',
    header: t('common.table.no'),
    meta: {
      class: {
        th: 'w-20 text-right',
        td: 'text-right',
      },
    },
    cell: ({ row }) => (row.index + 1 + (page.value - 1) * pageSize.value).toLocaleString(),
  },
  {
    accessorKey: 'facultyCode',
    header: t('adminFaculties.list.columns.facultyCode'),
  },
  {
    accessorKey: 'name',
    header: t('adminFaculties.list.columns.name'),
    cell: ({ row }) => {
      const name = locale.value === 'en' ? row.original.nameEn : row.original.nameTh;
      return h('div', null, name);
    },
  },
  {
    accessorKey: 'departmentCount',
    header: t('adminFaculties.list.columns.departments'),
    cell: ({ row }) => h('div', null, h(UBadge, { variant: 'soft', color: 'neutral', class: 'font-bold rounded-full' }, row.original.departmentCount)),
  },
  {
    accessorKey: 'deanName',
    header: t('adminFaculties.list.columns.deanName'),
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
      const canEditFaculty = authStore.can('faculty.edit');
      const canDeleteFaculty = authStore.can('faculty.delete');

      const actionButtons = [];

      if (canEditFaculty) {
        actionButtons.push(
          h(UButton, {
            color: 'primary',
            variant: 'ghost',
            icon: 'i-lucide-pencil',
            onClick: () => router.push(localPath(`/admin/faculties/${row.original.id}/edit`)),
          }),
        );
      }

      if (canDeleteFaculty) {
        actionButtons.push(
          h(UButton, {
            color: 'error',
            variant: 'ghost',
            icon: 'i-lucide-trash-2',
            loading: deletingFacultyId.value === row.original.id,
            disabled: deletingFacultyId.value === row.original.id,
            onClick: async () => {
              const instance = confirmDialog.open({
                title: t('common.dialog.confirmDelete'),
                description: t('common.dialog.deleteMessage', {
                  name: locale.value === 'en' ? row.original.nameEn : row.original.nameTh,
                }),
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
                  deletingFacultyId.value = row.original.id;

                  await $fetch(`/api/admin/faculties/${row.original.id}`, {
                    method: 'DELETE',
                  });

                  toast.add({
                    title: t('adminFaculties.success.deleteSuccess'),
                    color: 'success',
                  });

                  await refresh();
                }
                catch (error) {
                  toast.add({
                    title: t('adminFaculties.error.deleteError'),
                    description: resolveDeleteFacultyErrorMessage(error),
                    color: 'error',
                  });
                }
                finally {
                  deletingFacultyId.value = null;
                }
              }
            },
          }),
        );
      }

      return h('div', { class: 'flex items-center justify-end gap-2' }, actionButtons);
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          {{ t('adminFaculties.list.title') }}
        </h1>
        <p>{{ t('adminFaculties.description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="authStore.can('faculty.create')" icon="i-lucide-plus" size="md" :to="localPath('/admin/faculties/create')">
          {{ t('adminFaculties.list.addButton') }}
        </UButton>
      </div>
    </div>
    <div class="w-full">
      <div class="max-w-md ml-auto">
        <UFieldGroup class="w-full">
          <UInput v-model="searchInput" class="w-full" icon="i-lucide-search" size="lg" variant="outline" :placeholder="t('adminFaculties.list.search')" @keyup.enter="applySearch" />
          <UButton icon="i-lucide-search" :label="t('adminFaculties.list.search')" color="primary" variant="solid" :loading="isLoading" @click="applySearch" />
        </UFieldGroup>
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
