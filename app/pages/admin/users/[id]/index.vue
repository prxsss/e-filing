<script setup lang="ts">
import type { TableColumn, TabsItem } from '@nuxt/ui';

import { h, resolveComponent } from 'vue';

import type { User } from '~/types/user';
import type { RequestStatus } from '~/utils/request-status';

import { getRequestStatusColor } from '~/utils/request-status';
import { getUserStatusColor } from '~/utils/user-status';

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');

const route = useRoute();
const router = useRouter();

const localPath = useLocalePath();

const { data: user } = await useFetch<User>(`/api/users/${route.params.id}`, {
  lazy: true,
});

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
</script>

<template>
  <UPage>
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
                  :src="user.image"
                  :text="user.image ? '' : user.name.split(' ').map(word => word[0]).join('').toUpperCase()"
                  :alt="user.name"
                  size="3xl"
                />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="text-2xl font-bold tracking-tight">
                    {{ user.name }}
                  </h1>
                  <UBadge
                    :color="getUserStatusColor(user.status)"
                    variant="subtle"
                    class="uppercase text-xs"
                  >
                    {{ user.status }}
                  </UBadge>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ user.email }}
                </p>
              </div>
            </div>
          </div>
          <UButton
            color="primary"
            trailing-icon="i-lucide-chevron-down"
          >
            Actions
          </UButton>
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
        <p class="text-center text-gray-500 dark:text-gray-400">
          Loading user details...
        </p>
      </div>
    </div>
  </UPage>
</template>
