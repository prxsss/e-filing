<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const route = useRoute();
const { locale, locales, t, setLocale } = useI18n();
const localePath = useLocalePath();

const open = ref(false);

const sidebarItems = computed(() => [{
  label: t('dashboard'),
  icon: 'i-lucide-layout-dashboard',
  to: localePath('/'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('newRequest'),
  icon: 'i-lucide-plus',
  to: localePath('/new-request'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('myRequests'),
  icon: 'i-lucide-file-pen-line',
  to: localePath('/my-requests'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('toSign'),
  icon: 'i-lucide-pen-tool',
  to: localePath('/to-sign'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('completed'),
  icon: 'i-lucide-circle-check',
  to: localePath('/completed'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('templates'),
  icon: 'i-lucide-file',
  to: localePath('/admin/templates'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('requests'),
  icon: 'i-lucide-files',
  to: localePath('/admin/requests'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('users'),
  icon: 'i-lucide-users',
  to: localePath('/admin/users'),
  onSelect: () => {
    open.value = false;
  },
}, {
  label: t('permissionGroups'),
  icon: 'i-lucide-shield-check',
  to: localePath('/admin/permission-groups'),
  onSelect: () => {
    open.value = false;
  },
}] satisfies NavigationMenuItem[]);

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
        <Logo v-if="!collapsed" class="h-5 w-auto shrink-0" />
        <UIcon v-else name="i-simple-icons-nuxtdotjs" class="size-5 text-primary mx-auto" />
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

      <template #footer="{ collapsed }">
        <UButton
          icon="i-lucide-log-out"
          :label="collapsed ? undefined : t('logout')"
          color="neutral"
          variant="ghost"
          class="w-full py-3"
          :block="collapsed"
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
            <UColorModeButton />

            <!-- Notifications Button -->
            <UButton
              color="neutral"
              variant="ghost"
              square
            >
              <UChip color="error" inset>
                <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
              </UChip>
            </UButton>

            <!-- User Info -->
            <div class="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div class="text-right hidden md:block">
                <p class="font-semibold text-sm">
                  Admin System
                </p>
                <p class="text-xs">
                  IT Services
                </p>
              </div>
              <UAvatar
                icon="i-lucide-user"
                size="lg"
              />
            </div>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <!-- Main content goes here... -->
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
