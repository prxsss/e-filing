<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

import { h, resolveComponent } from 'vue';

import type { User } from '~/types/user';

import { getUserStatusColor } from '~/utils/user-status';

definePageMeta({
  title: 'users',
});

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const router = useRouter();

const localPath = useLocalePath();

const { data, status } = await useFetch<User[]>('/api/users', {
  lazy: true,
});

const columns: TableColumn<User>[] = [
  {
    accessorKey: 'institutionId',
    header: 'Institution ID',

  },
  {
    accessorKey: 'name',
    header: 'Full Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'faculty',
    header: 'Faculty',
    cell: ({ row }) => {
      const faculty = row.getValue('faculty') as string | null;
      return faculty || h('div', { class: 'text-slate-500' }, 'No faculty');
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const color = getUserStatusColor(row.getValue('status'));
      return h(UBadge, { class: 'capitalize', variant: 'soft', color }, row.getValue('status'));
    },
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.getValue('roles') as string[];
      if (roles.length === 0) {
        return h('div', { class: 'text-slate-500' }, 'No roles');
      }
      return h('div', { class: 'flex flex-wrap gap-1' }, roles?.map(role => h(UBadge, { variant: 'soft', color: 'primary' }, role)));
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
            'color': 'neutral',
            'variant': 'soft',
            'aria-label': 'View user details',
            onClick() {
            // Navigate to user details page
              router.push(localPath(`/admin/users/${row.original.id}?tab=overview`));
            },
          },
          () => 'View',
        ),
        h(
          UButton,
          {
            'color': 'neutral',
            'variant': 'soft',
            'aria-label': 'Edit user details',
            onClick() {
            // Navigate to user details page
              router.push(localPath(`/admin/users/${row.original.id}/edit`));
            },
          },
          () => 'Edit',
        ),
      ])

      ;
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
      <UButton icon="i-lucide-plus" size="md" :to="localPath('/admin/users/create')">
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
        :loading="status === 'pending'"
        class="flex-1"
      />
    </UCard>
  </div>
</template>
