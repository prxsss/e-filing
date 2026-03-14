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
const { locale } = useI18n();

const authStore = useAuthStore();

// const { data, status } = await useFetch<UserListItem[]>('/api/users', {
//   query: computed(() => ({
//     page: page.value,
//     pageSize: pageSize.value,
//   })),
// });

const { rows: data, isLoading, page, pageSize, total } = useUsers();

const columns: TableColumn<UserListItem>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'fullNameEn',
    header: 'Full Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.getValue('roles') as { name: string; count: number }[];
      if (roles.length === 0) {
        return h('div', { class: 'text-slate-500' }, 'No roles');
      }
      return h('div', { class: 'flex flex-wrap gap-1 capitalize' }, roles?.map(role => h(UBadge, { variant: 'soft', color: 'primary' }, `${role.name} ${role.count > 1 ? `(${role.count})` : ''}`)));
    },
  },
  {
    accessorKey: 'faculties',
    header: 'Faculty',
    cell: ({ row }) => {
      const faculties = row.getValue('faculties') as { nameEn: string; nameTh: string }[];
      if (faculties.length === 0) {
        return h('div', { class: 'text-slate-500' }, 'No faculties');
      }
      return h('div', { class: 'flex flex-wrap gap-1' }, faculties.map(faculty => h('span', null, locale.value === 'en' ? faculty.nameEn : faculty.nameTh)));
    },
  },
  // {
  //   accessorKey: 'departmentNameEn',
  //   header: 'Department',
  //   cell: ({ row }) => {
  //     const department = row.getValue('departmentNameEn') as string | null;
  //     return department || h('div', '-');
  //   },
  // },
  {
    accessorKey: 'banned',
    header: 'Status',
    cell: ({ row }) => {
      const color = row.getValue('banned') ? 'error' : 'success';
      const statusText = row.getValue('banned') ? 'Banned' : 'Active';
      return h(UBadge, { class: 'capitalize', variant: 'soft', color }, statusText);
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
            'aria-label': 'View user details',
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
              'aria-label': 'Edit user details',
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
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold mb-4">
          Users
        </h1>
        <p>Manage system users and access permissions.</p>
      </div>
      <UButton v-if="authStore.can('user.create')" icon="i-lucide-plus" size="md" :to="localPath('/admin/users/create')">
        Add User
      </UButton>
    </div>
    <div class="w-full">
      <div class="max-w-sm">
        <UInput class="w-full" icon="i-lucide-search" size="lg" variant="outline" placeholder="Search by name, email, or ID..." />
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
