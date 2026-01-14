<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const route = useRoute();

const open = ref(false);

const sidebarItems = [{
  label: 'Dashboard',
  icon: 'i-lucide-layout-dashboard',
  to: '/',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'New Request',
  icon: 'i-lucide-plus',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'My Requests',
  icon: 'i-lucide-file-pen-line',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'To Sign',
  icon: 'i-lucide-pen-tool',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'Completed',
  icon: 'i-lucide-circle-check',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'Templates',
  icon: 'i-lucide-file',
  to: '/admin/templates',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'Requests',
  icon: 'i-lucide-files',
  to: '/admin/requests',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'Users',
  icon: 'i-lucide-users',
  to: '/admin/users',
  onSelect: () => {
    open.value = false;
  },
}, {
  label: 'Permission Groups',
  icon: 'i-lucide-shield-check',
  to: '/admin/permission-groups',
  onSelect: () => {
    open.value = false;
  },
}] satisfies NavigationMenuItem[];

const flatItems = computed(() =>
  sidebarItems.flat().filter(item => item.to));

const navbarTitle = computed(() => {
  const current = flatItems.value.find(item =>
    item.to === route.path);

  // For development purposes
  if (!current) {
    console.warn('[Navbar] title not found', route.path);
    return 'Home';
  }

  return current.label;
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
          :label="collapsed ? undefined : 'Logout'"
          color="neutral"
          variant="ghost"
          class="w-full py-3 cursor-pointer"
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
            <UTooltip text="Notifications" :shortcuts="['N']">
              <UButton
                color="neutral"
                variant="ghost"
                square
              >
                <UChip color="error" inset>
                  <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
                </UChip>
              </UButton>
            </UTooltip>
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
