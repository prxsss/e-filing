<script setup lang="ts">
import type { DropdownMenuItem, TableColumn, TabsItem } from '@nuxt/ui';

import { LazyBaseConfirmDialogWithReason } from '#components';
import { h, resolveComponent } from 'vue';

import type { UserDetail } from '~/types/user';
import type { RequestStatus } from '~/utils/request-status';

import { formatDate } from '~/utils/formatters';
import { getRequestStatusColor } from '~/utils/request-status';

definePageMeta({
  title: 'adminUsers.detail.title',
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
const { locale, t } = useI18n();

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
    header: t('common.table.no'),
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
    header: t('common.table.requestName'),
  },
  {
    accessorKey: 'status',
    header: t('common.table.status'),
    cell: ({ row }) => {
      const color = getRequestStatusColor(row.getValue('status'));

      const label = ({
        in_progress: t('inProgress'),
        completed: t('completed'),
        rejected: t('rejected'),
      })[row.getValue('status') as string];
      return h(UBadge, { class: 'capitalize', variant: 'soft', color }, label);
    },
  },
  {
    accessorKey: 'submittedAt',
    header: t('common.table.submittedAt'),
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
    label: t('adminUsers.detail.tabs.overview'),
    icon: 'i-lucide-layout-dashboard',
    slot: 'overview' as const,
    value: 'overview',
  },
  // {
  //   label: 'Permissions',
  //   icon: 'i-lucide-shield-user',
  //   slot: 'permissions' as const,
  //   value: 'permissions',
  // },
  // {
  //   label: 'Signature',
  //   icon: 'i-lucide-signature',
  //   slot: 'signature' as const,
  //   value: 'signature',
  // },
  {
    label: t('adminUsers.detail.tabs.requests'),
    icon: 'i-lucide-file-text',
    slot: 'requests' as const,
    value: 'requests',
  },
  // {
  //   label: 'Activity',
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
  // {
  //   label: t('adminUsers.detail.actions.resetPassword'),
  //   icon: 'i-lucide-rotate-ccw',
  //   color: 'neutral',
  //   visible: computed(() => authStore.can('user.reset_password')),
  // },
  {
    label: t('adminUsers.detail.actions.banUser'),
    icon: 'i-lucide-user-x',
    color: 'error',
    visible: computed(() => !user.value?.banned && user.value?.id !== authStore.session.user?.id && authStore.can('user.status')),
    onSelect: async () => {
      const instance = confirmDialogWithReason.open({
        title: t('adminUsers.detail.banDialog.confirm'),
        description: t('adminUsers.detail.banDialog.message'),
        reasonRequired: true,
        reasonPlaceholder: t('adminUsers.detail.banDialog.reasonPlaceholder'),
        reasonErrorMessage: t('adminUsers.detail.banDialog.reasonErrorMessage'),
        cancelButton: {
          label: t('common.actions.cancel'),
        },
        confirmButton: {
          label: t('adminUsers.detail.actions.banUser'),
          color: 'error',
        },
      });

      const result = await instance.result;
      if (result.confirmed) {
        await $fetch(`/api/users/${user.value?.id}/ban`, {
          method: 'PATCH',
          body: {
            banReason: result.confirmationReason!,
          },
        });

        toast.add({
          title: t('adminUsers.detail.feedback.banSuccess'),
          description: t('adminUsers.detail.feedback.banSuccessDescription', { name: locale.value === 'en' ? user.value?.fullNameEn : user.value?.fullNameTh }),
          color: 'success',
        });

        await refreshUser();
      }
    },
  },
  {
    label: t('adminUsers.detail.actions.unbanUser'),
    icon: 'i-lucide-user-check',
    color: 'success',
    visible: computed(() => user.value?.banned && authStore.can('user.status')),
    onSelect: async () => {
      await $fetch(`/api/users/${user.value?.id}/unban`, {
        method: 'PATCH',
      });

      toast.add({
        title: t('adminUsers.detail.feedback.unbanSuccess'),
        description: t('adminUsers.detail.feedback.unbanSuccessDescription', { name: locale.value === 'en' ? user.value?.fullNameEn : user.value?.fullNameTh }),
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
      {{ t('common.actions.backTo', { page: t('adminUsers.title') }) }}
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
                <h1 class="text-xl font-bold tracking-tight">
                  {{ locale === 'en' ? user.fullNameEn : user.fullNameTh }}
                </h1>
                <UBadge
                  :color="user.banned ? 'error' : user.isActive ? 'success' : 'neutral'"
                  variant="subtle"
                  class="uppercase text-xs"
                >
                  {{ user.banned ? t('common.status.banned') : user.isActive ? t('common.status.active') : t('common.status.inactive') }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ [user.studentId ? `${t('adminUsers.shared.form.studentId')}: ${user.studentId}` : null, user.staffId ? `${t('adminUsers.shared.form.staffId')}: ${user.staffId}` : null].filter(Boolean).join(' / ') || user.email }}
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
            {{ t('common.actions.edit') }}
          </UButton>
          <UDropdownMenu
            v-if="actionMenuItems.length > 0"
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
              {{ t('common.table.actions') }}
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
        {{ t('adminUsers.edit.feedback.userNotFound', { id: route.params.id }) }}
      </p>
    </div>
  </div>
</template>
