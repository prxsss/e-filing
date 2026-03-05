<script setup lang="ts">
import type { DropdownMenuItem, TableColumn, TabsItem } from '@nuxt/ui';

import { LazyBaseConfirmDialogWithReason } from '#components';
import { h, resolveComponent } from 'vue';

import type { UserDetail } from '~/types/user';
import type { RequestStatus } from '~/utils/request-status';

import { getRequestStatusColor } from '~/utils/request-status';

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const route = useRoute();
const router = useRouter();

const localPath = useLocalePath();

const overlay = useOverlay();
const toast = useToast();

const confirmDialogWithReason = overlay.create(LazyBaseConfirmDialogWithReason);

const { data: user, execute: refreshUser } = await useFetch<UserDetail>(`/api/users/${route.params.id}`);

const statusSummary = reactive({
  totalRequests: 12,
  pendingAction: 3,
  approved: 7,
});

type Request = {
  id: string;
  title: string;
  status: RequestStatus;
  role: string;
};

const requests = ref<Request[]>([
  {
    id: 'REQ-001',
    title: 'Research Grant Application_Q4.pdf',
    status: 'pending',
    role: 'Created by user',
  },
  {
    id: 'REQ-002',
    title: 'Annual Lab Safety Report.docx',
    status: 'approved',
    role: 'Signed by user',
  },
  {
    id: 'REQ-003',
    title: 'Staff Reimbursement #RE-901',
    status: 'action_required',
    role: 'Waiting action',
  },
  {
    id: 'REQ-004',
    title: 'Equipment Purchase Request #EQ-456',
    status: 'rejected',
    role: 'Created by user',
  },
]);

const columns: TableColumn<Request>[] = [
  {
    accessorKey: 'id',
    header: 'Request ID',
  },
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const color = getRequestStatusColor(row.getValue('status'));

      const label = ({
        pending: 'Pending',
        approved: 'Approved',
        action_required: 'Action Required',
        rejected: 'Rejected',
      })[row.getValue('status') as string];
      return h(UBadge, { class: 'capitalize', variant: 'soft', color }, label);
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
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
  {
    label: 'Activity',
    description: 'Review the activity log for this user, including recent actions, logins, and changes made to their account.',
    icon: 'i-lucide-history',
    slot: 'activity' as const,
    value: 'activity',
  },
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
  {
    label: 'Reset Password',
    icon: 'i-lucide-rotate-ccw',
    color: 'neutral',
    visible: computed(() => true), // Always visible
  },
  {
    label: 'Ban User',
    icon: 'i-lucide-user-x',
    color: 'error',
    visible: computed(() => !user.value?.banned),
    onSelect: async () => {
      const instance = confirmDialogWithReason.open({
        title: 'Ban User',
        description: `Are you sure you want to ban ${user.value?.fullNameEN}? This will prevent them from accessing their account.`,
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
          description: `User ${user.value?.fullNameEN} has been banned.`,
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
    visible: computed(() => user.value?.banned),
    onSelect: async () => {
      await $fetch(`/api/users/${user.value?.id}/unban`, {
        method: 'PATCH',
      });

      toast.add({
        title: 'User Unbanned',
        description: `User ${user.value?.fullNameEN} has been unbanned.`,
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
                :text="user.image ? '' : user.firstNameEN.charAt(0).toUpperCase() + user.lastNameEN.charAt(0).toUpperCase()"
                :alt="user.fullNameEN"
                size="3xl"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight">
                  {{ user.fullNameEN }}
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
                {{ user.email }}
              </p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            color="primary"
            icon="i-lucide-pencil"
            :to="localPath(`/admin/users/${user.id}/edit`)"
          >
            Edit
          </UButton>
          <UDropdownMenu
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
          <AdminUsersDetailUserOverviewTab :user="user" :status-summary="statusSummary" />
        </template>
        <!-- <template #permissions>
            <AdminUsersDetailUserPermissionsTab :roles="user.roles" />
          </template>
          <template #signature>
            <AdminUsersDetailUserSignatureTab :user="user" :signature-details="signatureDetails" />
          </template> -->
        <template #requests>
          <AdminUsersDetailUserRequestsTab :requests="requests" :columns="columns" />
        </template>
        <template #activity>
          <AdminUsersDetailUserActivityTab />
        </template>
      </UTabs>
    </div>
    <div v-else>
      <p>
        Sorry, user with ID {{ route.params.id }} not found.
      </p>
    </div>
  </div>
</template>
