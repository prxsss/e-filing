<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

import NotificationBell from '../components/notification-bell.vue';

const authStore = useAuthStore();

const route = useRoute();
const { locale, locales, t, setLocale } = useI18n();
const localePath = useLocalePath();

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
    label: t('accessControl'),
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
            <USelect :model-value="locale" :items="languageItems" label-key="name" value-key="code" :icon="selectedLanguageIcon" @update:model-value="setLocale($event)" />

            <!-- Color Mode Button -->
            <!-- <UColorModeButton /> -->

            <!-- Notifications Button -->
            <NotificationBell v-if="authStore.session.loggedIn" />

            <div class="pl-4 border-l-2 border-slate-200">
              <div v-if="false" class="flex items-center gap-3">
                <div class="hidden md:block space-y-1">
                  <USkeleton class="h-4 w-24" />
                  <USkeleton class="h-3 w-16 ml-auto" />
                </div>
                <USkeleton class="h-10 w-10 rounded-full" />
              </div>

              <!-- User Info -->
              <div v-else-if="authStore.session.loggedIn" class="flex items-center gap-3">
                <div class="text-right hidden md:block">
                  <p class="font-semibold text-sm">
                    {{ locale === 'en' ? authStore.session.user?.fullNameEn : authStore.session.user?.fullNameTh }}
                  </p>
                  <p class="text-xs capitalize">
                    {{ authStore.session.user?.currentRole }}
                  </p>
                </div>
                <UAvatar
                  icon="i-lucide-user"
                  size="lg"
                />
              </div>

              <!-- Login Button -->
              <UButton v-else :to="localePath('/login')" icon="i-lucide-log-in">
                {{ t('login') }}
              </UButton>
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
