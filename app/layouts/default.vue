<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

import NotificationBell from '../components/notification-bell.vue';

const authStore = useAuthStore();

const route = useRoute();
const { locale, locales, t, setLocale } = useI18n();
const localePath = useLocalePath();

const { data: deanDelegationAccess } = await useFetch<{ success: boolean; canAccess: boolean }>(
  '/api/requests/dean-delegation-access',
);
const canSeeDeanDelegationMenu = computed(() => deanDelegationAccess.value?.canAccess === true);

const open = ref(false);

type NavigationMenuItemWithVisibility = {
  visible: ComputedRef<boolean>;
} & NavigationMenuItem;

const sidebarItems = computed<NavigationMenuItemWithVisibility[]>(() => ([
  {
    label: t('dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/student'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('dashboard.student.view')),
  },
  {
    label: t('dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/signer'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('dashboard.signer.view')),
  },
  {
    label: t('dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: localePath('/admin'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('dashboard.admin.view')),
  },
  {
    label: t('newRequest'),
    icon: 'i-lucide-plus',
    to: localePath('/student/new-request'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('request.create')),
  },
  {
    label: t('myRequests'),
    icon: 'i-lucide-file-pen-line',
    to: localePath('/student/my-requests'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('request.view_own')),
  },
  {
    label: t('toSign'),
    icon: 'i-lucide-pen-tool',
    to: localePath('/signer/to-sign'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('request.to_sign.view')),
  },
  {
    label: t('signedHistory'),
    icon: 'i-lucide-circle-check',
    to: localePath('/signer/signed-history'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('request.sign_history.view')),
  },
  {
    label: t('deanDelegatedToSign'),
    icon: 'i-lucide-user-check',
    to: localePath('/signer/dean-to-sign'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('request.to_sign.view') && canSeeDeanDelegationMenu.value),
  },
  // {
  //   label: t('profile.menu'),
  //   icon: 'i-lucide-user-pen',
  //   to: localePath('/profile'),
  //   onSelect: () => {
  //     open.value = false;
  //   },
  //   visible: computed(() => authStore.can('request.sign')),
  // },
  {
    label: t('requests'),
    icon: 'i-lucide-files',
    to: localePath('/admin/requests'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('request.view')),
  },
  {
    label: t('templates'),
    icon: 'i-lucide-file',
    to: localePath('/admin/templates'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('template.view')),
  },
  {
    label: t('users'),
    icon: 'i-lucide-users',
    to: localePath('/admin/users'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('user.view')),
  },
  {
    label: t('adminAccessControl.title'),
    icon: 'i-lucide-shield-check',
    to: localePath('/admin/access-control'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('role.view') && authStore.can('permission.view')),
  },
  {
    label: t('faculties'),
    icon: 'i-lucide-building',
    to: localePath('/admin/faculties'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('faculty.view')),
  },
  {
    label: t('departments'),
    icon: 'i-lucide-building-2',
    to: localePath('/admin/departments'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('department.view')),
  },
  {
    label: t('adminDelegations.title'),
    icon: 'i-lucide-user-check',
    to: localePath('/admin/delegations'),
    onSelect: () => {
      open.value = false;
    },
    visible: computed(() => authStore.can('faculty.view')),
  },
] as NavigationMenuItemWithVisibility[]).filter(item => item.visible.value));

const languageItems = computed(() =>
  locales.value.map(l => ({
    name: l.name,
    code: l.code,
    icon: l.icon as string,
  })),
);

const navbarTitle = computed(() => {
  const titleKey = route.meta.title as string;
  return titleKey ? t(titleKey) : t('untitled');
});

const selectedLanguageIcon = computed(() =>
  languageItems.value.find(l => l.code === locale.value)?.icon,
);

function joinNameParts(...parts: Array<string | null | undefined>) {
  return parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

const userDisplayName = computed(() => {
  const user = authStore.session.user!; // We can assert this because of the auth.global middleware

  return locale.value === 'en'
    ? joinNameParts(user.titleEn, user.fullNameEn)
    : joinNameParts(user.titleTh, user.fullNameTh);
});

const userRoles = computed(() => {
  const { user } = authStore.session;
  const roles = locale.value === 'en' ? user?.roles : user?.rolesTh;
  return roles || [];
});

const limitedRolesDisplay = computed(() => {
  const roles = userRoles.value;
  if (!roles || roles.length === 0)
    return '';

  if (roles.length <= 2) {
    return roles.join(', ');
  }

  return `${roles[0]}, ${roles[1]}`;
});

const showMoreRolesIndicator = computed(() => {
  const roles = userRoles.value;
  return roles && roles.length > 2;
});

const remainingRoles = computed(() => {
  const roles = userRoles.value;
  if (!roles || roles.length <= 2)
    return [];
  return roles.slice(2);
});

const remainingRolesText = computed(() => {
  const remaining = remainingRoles.value;
  return remaining.join(', ');
});
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <KuSrcLogo v-if="!collapsed" class="h-auto w-25 shrink-0" />
        <KuLogo v-else class="h-5 w-auto mx-auto" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="sidebarItems"
          orientation="vertical"
          tooltip
          popover
          :ui="{
            link: 'py-3',
          }"
        />
      </template>
      <template v-if="authStore.session.loggedIn" #footer="{ collapsed }">
        <UButton
          icon="i-lucide-log-out"
          :label="collapsed ? undefined : t('logout')"
          color="neutral"
          variant="ghost"
          class="w-full py-3"
          :block="collapsed"
          @click="authStore.logout()"
        />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="navbarTitle" :ui="{ right: 'gap-3' }">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>

          <template #right>
            <!-- Language Selector -->
            <USelect class="hidden sm:inline-flex" :model-value="locale" :items="languageItems" label-key="name" value-key="code" :icon="selectedLanguageIcon" @update:model-value="setLocale($event)" />

            <!-- Color Mode Button -->
            <!-- <UColorModeButton /> -->

            <!-- Notifications Button -->
            <NotificationBell v-if="authStore.session.loggedIn" />

            <div class="pl-4 border-l-2 border-slate-200">
              <!-- User Info -->
              <div v-if="authStore.session.loggedIn" class="flex items-center gap-3">
                <div class="text-right hidden sm:block">
                  <p class="font-semibold text-sm">
                    {{ userDisplayName }}
                  </p>
                  <p class="text-xs capitalize">
                    {{ limitedRolesDisplay }}
                    <UTooltip
                      v-if="showMoreRolesIndicator"
                      :shortcuts="[]"
                      arrow
                      :delay-duration="0"
                    >
                      <span class="cursor-pointer hover:underline">(+{{ remainingRoles.length }} {{ t('common.more') }})</span>

                      <template #content>
                        <div class="whitespace-nowrap">
                          {{ remainingRolesText }}
                        </div>
                      </template>
                    </UTooltip>
                  </p>
                </div>

                <UAvatar
                  icon="i-lucide-user"
                  size="lg"
                  class="hidden sm:inline-flex"
                />

                <!-- Mobile User Info -->
                <UPopover class="inline-flex sm:hidden" arrow>
                  <UAvatar

                    icon="i-lucide-user"
                    size="lg"
                  />

                  <template #content>
                    <div class="w-72">
                      <div class="p-4">
                        <p class="font-semibold text-sm">
                          {{ userDisplayName }}
                        </p>
                        <div class="flex flex-wrap gap-1 mt-1">
                          <UBadge v-for="(role, index) in userRoles" :key="index" :label="role" variant="soft" color="neutral" />
                        </div>
                      </div>
                      <div class="border-b border-slate-200" />
                      <div class="p-4">
                        <USelect class="w-full" :model-value="locale" :items="languageItems" label-key="name" value-key="code" :icon="selectedLanguageIcon" @update:model-value="setLocale($event)" />
                      </div>
                    </div>
                  </template>
                </UPopover>
              </div>
              <div v-else class="flex items-center gap-3">
                <div class="hidden md:block space-y-1">
                  <USkeleton class="h-4 w-24" />
                  <USkeleton class="h-3 w-16 ml-auto" />
                </div>
                <USkeleton class="h-10 w-10 rounded-full" />
              </div>
            </div>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <!-- Main content goes here... -->
        <slot class="relative" />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
