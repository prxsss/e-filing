<script setup lang="ts">
import type { DropdownMenuItem, TableColumn, TabsItem } from '@nuxt/ui';

import { LazyBaseConfirmDialogWithReason } from '#components';
import { h, resolveComponent } from 'vue';

import type { UserDetail } from '~/types/user';
import type { RequestStatus } from '~/utils/request-status';

import { formatDate } from '~/utils/formatters';
import { getRequestStatusColor } from '~/utils/request-status';

definePageMeta({
  title: 'user-detail',
  middleware: ['permission'],
  permission: 'user.view',
});

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const route = useRoute();
const router = useRouter();
const localPath = useLocalePath();
const overlay = useOverlay();
const toast = useToast();
const { locale } = useI18n();

const authStore = useAuthStore();

const confirmDialogWithReason = overlay.create(LazyBaseConfirmDialogWithReason);

const { data: user, execute: refreshUser } = await useFetch<UserDetail>(`/api/users/${route.params.id}`);

type Request = {
  id: string;
  title: string;
  status: RequestStatus;
  submittedAt: string;
};

type RequestApiResult = {
  success: boolean;
  data: Request[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    statusCounts: {
      in_progress: number;
      rejected: number;
      completed: number;
    };
  };
};

const page = ref(1);
const pageSize = ref(10);

const { data: requestApiResult } = await useFetch<RequestApiResult> ('/api/requests', {
  query: computed(() => ({
    page: page.value,
    limit: pageSize.value,
    requesterId: route.params.id as string,
  })),
});

const columns: TableColumn<Request>[] = [
  {
    header: 'No.',
    meta: {
      class: {
        th: 'w-12 text-right',
        td: 'text-right',
      },
    },
    cell: ({ row }) => row.index + 1 + (requestApiResult.value ? (requestApiResult.value.meta.page - 1) * requestApiResult.value.meta.limit : 0),
  },
  {
    accessorKey: 'templateName',
    header: 'Title',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const color = getRequestStatusColor(row.getValue('status'));

      const label = ({
        in_progress: 'In Progress',
        completed: 'Completed',
        rejected: 'Rejected',
      })[row.getValue('status') as string];
      return h(UBadge, { class: 'capitalize', variant: 'soft', color }, label);
    },
  },
  {
    accessorKey: 'submittedAt',
    header: 'Submitted At',
    cell: ({ row }) => {
      const date = new Date(row.getValue('submittedAt'));
      return formatDate(date, locale.value);
    },
  },
  {
    id: 'actions',
    header: '',
    meta: {
      class: {
        td: 'text-right',
      },
    },
  },
];

const items = [
  {
    label: 'Overview',
    description: 'View and edit basic profile information, department affiliation, and account status here.',
    icon: 'i-lucide-layout-dashboard',
    slot: 'overview' as const,
    value: 'overview',
  },
  // {
  //   label: 'Permissions',
  //   description: 'Manage group memberships and specific permissions assigned to this user. Add or remove from groups to control access levels.',
  //   icon: 'i-lucide-shield-user',
  //   slot: 'permissions' as const,
  //   value: 'permissions',
  // },
  // {
  //   label: 'Signature',
  //   description: 'Manage your digital signature here. This will be used for signing documents.',
  //   icon: 'i-lucide-signature',
  //   slot: 'signature' as const,
  //   value: 'signature',
  // },
  {
    label: 'Requests',
    description: 'View all requests and documents associated with this user. Check statuses and take necessary actions.',
    icon: 'i-lucide-file-text',
    slot: 'requests' as const,
    value: 'requests',
  },
  // {
  //   label: 'Activity',
  //   description: 'Review the activity log for this user, including recent actions, logins, and changes made to their account.',
  //   icon: 'i-lucide-history',
  //   slot: 'activity' as const,
  //   value: 'activity',
  // },
] satisfies TabsItem[];

const active = computed({
  get() {
    return (route.query.tab as string) || 'overview';
  },
  set(tab) {
    router.push({
      path: localPath(`/admin/users/${route.params.id}`),
      query: { tab },
    });
  },
});

type DropdownMenuItemWithVisibility = {
  visible: ComputedRef<boolean>;
} & DropdownMenuItem;

const actionMenuItems = computed<DropdownMenuItemWithVisibility[]>(() => ([
  // For any menu that will be added in the future,
  // make sure to check the permission at UDropdownMenu level with v-if,
  // so that the menu will be hidden if the user doesn't have permission to do any action in the menu.
  // This is to prevent confusion for users when they see an empty "Actions" dropdown.
  {
    label: 'Reset Password',
    icon: 'i-lucide-rotate-ccw',
    color: 'neutral',
    visible: computed(() => authStore.can('user.reset_password')),
  },
  {
    label: 'Ban User',
    icon: 'i-lucide-user-x',
    color: 'error',
    visible: computed(() => !user.value?.banned && authStore.can('user.status')),
    onSelect: async () => {
      const instance = confirmDialogWithReason.open({
        title: 'Ban User',
        description: `Are you sure you want to ban ${user.value?.fullNameEn}? This will prevent them from accessing their account.`,
        reasonRequired: true,
        reasonPlaceholder: 'Please provide a reason for banning this user',
        reasonErrorMessage: 'Ban reason is required',
        cancelButton: {
          label: 'Cancel',
        },
        confirmButton: {
          label: 'Ban',
          color: 'error',
        },
      });

      const result = await instance.result;
      if (result.confirmed) {
        await $fetch(`/api/users/${user.value?.id}/ban`, {
          method: 'PATCH',
          body: {
            banReason: result.confirmationReason || 'No reason provided',
          },
        });

        toast.add({
          title: 'User Banned',
          description: `User ${user.value?.fullNameEn} has been banned.`,
          color: 'success',
        });

        await refreshUser();
      }
    },
  },
  {
    label: 'Unban User',
    icon: 'i-lucide-user-check',
    color: 'success',
    visible: computed(() => user.value?.banned && authStore.can('user.status')),
    onSelect: async () => {
      await $fetch(`/api/users/${user.value?.id}/unban`, {
        method: 'PATCH',
      });

      toast.add({
        title: 'User Unbanned',
        description: `User ${user.value?.fullNameEn} has been unbanned.`,
        color: 'success',
      });

      await refreshUser();
    },
  },
] as DropdownMenuItemWithVisibility[]).filter(item => item.visible.value));
</script>

<template>
  <div>
    <UButton
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      :to="localPath('/admin/users')"
      class="mb-6"
    >
      Back to Users
    </UButton>

    <div v-if="user">
      <!-- Header Section -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-4">
            <div class="relative">
              <UAvatar
                :src="user.image || undefined"
                :text="user.image ? '' : user.firstNameEn.charAt(0).toUpperCase() + user.lastNameEn.charAt(0).toUpperCase()"
                :alt="user.fullNameEn"
                size="3xl"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight">
                  {{ user.fullNameEn }}
                </h1>
                <UBadge
                  :color="user.banned ? 'error' : 'success'"
                  variant="subtle"
                  class="uppercase text-xs"
                >
                  {{ user.banned ? 'Banned' : 'Active' }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                ID: {{ user.id }}
              </p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="authStore.can('user.edit')"
            color="primary"
            icon="i-lucide-pencil"
            :to="localPath(`/admin/users/${user.id}/edit`)"
          >
            Edit
          </UButton>
          <UDropdownMenu
            v-if="authStore.canAny(['user.reset_password', 'user.status'])"
            :items="actionMenuItems"
            :content="{
              align: 'end',
              side: 'bottom',
            }"
          >
            <UButton
              color="neutral"
              variant="soft"
              trailing-icon="i-lucide-chevron-down"
            >
              Actions
            </UButton>
          </UDropdownMenu>
        </div>
      </div>
      <UTabs
        v-model="active" :items="items" size="lg" variant="link" :ui="{
        }" class="gap-8 w-full"
      >
        <template #overview>
          <AdminUsersDetailUserOverviewTab :user="user" />
        </template>
        <!-- <template #permissions>
            <AdminUsersDetailUserPermissionsTab :roles="user.roles" />
          </template>
          <template #signature>
            <AdminUsersDetailUserSignatureTab :user="user" :signature-details="signatureDetails" />
          </template> -->
        <template #requests>
          <AdminUsersDetailUserRequestsTab v-model:page="page" v-model:page-size="pageSize" :requests="requestApiResult?.data ?? []" :total="requestApiResult?.meta.total" :columns="columns" />
        </template>
        <!-- <template #activity>
          <AdminUsersDetailUserActivityTab />
        </template> -->
      </UTabs>
    </div>
    <div v-else>
      <p>
        Sorry, user with ID {{ route.params.id }} not found.
      </p>
    </div>
  </div>
</template>
