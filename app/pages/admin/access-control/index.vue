<script setup lang="ts">
import { LazyAdminEditRoleModal, LazyBaseConfirmDialog } from '#components';

definePageMeta({
  title: 'adminAccessControl.title',
  middleware: ['permission'],
  permission: 'role.view',
});

const { t, locale } = useI18n();
const localPath = useLocalePath();
const toast = useToast();
const overlay = useOverlay();

const authStore = useAuthStore();

// ── State ──
const searchQuery = ref('');

// ── Fetch roles with user counts ──
const { data: roles, refresh: refreshRoles } = await useFetch<{
  id: number;
  name: string;
  nameTh: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
  userCount: number;
}[]>('/api/roles');

// ── Auto-select first role immediately ──
const selectedRoleId = ref<number | null>(null);

// ── Fetch all permissions ──
const { data: permissions } = await useFetch<{
  id: number;
  code: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
}[]>('/api/permissions');

// ── Fetch role permissions (reactive to selected role) ──
const { data: rolePermissionIds, refresh: refreshRolePermissions } = useFetch<number[]>(
  () => `/api/roles/${selectedRoleId.value}/permissions`,
);

// ── Edit Role ──
const editRoleModal = overlay.create(LazyAdminEditRoleModal);

async function handleEditRole(role: { id: number; name: string; nameTh: string; descriptionEn: string | null; descriptionTh: string | null }) {
  const instance = editRoleModal.open({ role });
  const result = await instance.result;
  if (result) {
    await refreshRoles();
  }
}

// ── Delete Role ──
const confirmDialog = overlay.create(LazyBaseConfirmDialog);

function isAdminRole(roleName: string) {
  return roleName.toLowerCase() === 'admin';
}

async function handleDeleteRole(role: { id: number; name: string; nameTh: string; userCount: number }) {
  if (isAdminRole(role.name)) {
    toast.add({
      title: t('adminAccessControl.deleteRole'),
      description: t('adminAccessControl.adminRoleDeleteLocked'),
      color: 'error',
    });
    return;
  }

  if (role.userCount > 0) {
    toast.add({
      title: t('adminAccessControl.deleteRole'),
      description: t('adminAccessControl.roleDeleteInUse', { count: role.userCount }),
      color: 'error',
    });
    return;
  }

  const instance = confirmDialog.open({
    title: t('adminAccessControl.deleteRole'),
    description: t('adminAccessControl.deleteRoleConfirm', { name: locale.value === 'th' ? role.nameTh : role.name }),
    cancelButton: { label: t('cancel') },
    confirmButton: { label: t('delete'), color: 'error' },
  });

  const confirmed = await instance.result;
  if (!confirmed)
    return;

  try {
    await $fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    toast.add({ title: t('adminAccessControl.deleteRole'), description: t('adminAccessControl.roleDeletedSuccess'), color: 'success' });

    // If deleted role was selected, clear selection
    if (selectedRoleId.value === role.id) {
      selectedRoleId.value = null;
    }

    await refreshRoles();
  }
  catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const errorData = (error as { data?: { code?: string; userCount?: number } })?.data;

    if (statusCode === 409 && errorData?.code === 'ROLE_IN_USE') {
      toast.add({
        title: t('adminAccessControl.deleteRole'),
        description: t('adminAccessControl.roleDeleteInUse', { count: errorData.userCount ?? role.userCount }),
        color: 'error',
      });
      return;
    }

    if (statusCode === 409 && errorData?.code === 'ADMIN_ROLE_DELETE_LOCKED') {
      toast.add({
        title: t('adminAccessControl.deleteRole'),
        description: t('adminAccessControl.adminRoleDeleteLocked'),
        color: 'error',
      });
      return;
    }

    toast.add({ title: t('error'), description: t('adminAccessControl.roleDeleteFailed'), color: 'error' });
  }
}

// ── Local state for permission checkboxes (dirty tracking) ──
const localPermissionIds = ref<Set<number>>(new Set());
const originalPermissionIds = ref<Set<number>>(new Set());

watch(rolePermissionIds, (ids) => {
  if (ids) {
    localPermissionIds.value = new Set(ids);
    originalPermissionIds.value = new Set(ids);
  }
});

// ── Selected role object ──
const selectedRole = computed(() =>
  roles.value?.find(r => r.id === selectedRoleId.value) ?? null,
);

const isAdminRoleSelected = computed(() => selectedRole.value?.name.toLowerCase() === 'admin');

function isAdminRolePermissionLocked(permissionCode: string) {
  return isAdminRoleSelected.value
    && (permissionCode.startsWith('role.') || permissionCode.startsWith('permission.'));
}

// ── Group permissions by module (code prefix before the dot) ──
const permissionModules = computed(() => {
  if (!permissions.value)
    return [];

  const moduleMap = new Map<string, typeof permissions.value>();

  for (const perm of permissions.value) {
    const moduleKey = perm.code.split('.')[0] ?? perm.code;
    if (!moduleMap.has(moduleKey)) {
      moduleMap.set(moduleKey, []);
    }
    moduleMap.get(moduleKey)!.push(perm);
  }

  return Array.from(moduleMap.entries()).map(([key, perms]) => ({
    key,
    permissions: perms,
  }));
});

// ── Module icon mapping ──
const moduleIcons: Record<string, string> = {
  request: 'i-lucide-file-text',
  template: 'i-lucide-file',
  user: 'i-lucide-users',
  audit_log: 'i-lucide-clipboard-list',
  role: 'i-lucide-shield',
  permission: 'i-lucide-key',
  faculty: 'i-lucide-building',
  department: 'i-lucide-building-2',
  dashboard: 'i-lucide-layout-dashboard',
};

// ── Filtered modules based on search ──
const filteredModules = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query)
    return permissionModules.value;

  return permissionModules.value
    .map((mod) => {
      const filtered = mod.permissions.filter(
        p =>
          p.code.toLowerCase().includes(query)
          || p.descriptionEn?.toLowerCase().includes(query)
          || p.descriptionTh?.toLowerCase().includes(query),
      );
      return { ...mod, permissions: filtered };
    })
    .filter(mod => mod.permissions.length > 0);
});

// ── Toggle permission ──
function togglePermission(permId: number, permissionCode: string) {
  if (isAdminRolePermissionLocked(permissionCode)) {
    return;
  }

  const s = new Set(localPermissionIds.value);
  if (s.has(permId)) {
    s.delete(permId);
  }
  else {
    s.add(permId);
  }
  localPermissionIds.value = s;
}

// ── Has changes ──
const hasChanges = computed(() => {
  if (localPermissionIds.value.size !== originalPermissionIds.value.size)
    return true;
  for (const id of localPermissionIds.value) {
    if (!originalPermissionIds.value.has(id))
      return true;
  }
  return false;
});

// ── Reset ──
function resetChanges() {
  localPermissionIds.value = new Set(originalPermissionIds.value);
}

// ── Save ──
const saving = ref(false);

async function saveChanges() {
  if (!selectedRoleId.value)
    return;

  saving.value = true;
  try {
    await $fetch(`/api/roles/${selectedRoleId.value}/permissions`, {
      method: 'PUT',
      body: { permissionIds: Array.from(localPermissionIds.value) },
    });
    await refreshRolePermissions();
    toast.add({ title: t('saveChanges'), description: t('adminAccessControl.permissionUpdatedSuccess'), color: 'success' });
  }
  catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const errorData = (error as { data?: { code?: string } })?.data;

    if (statusCode === 409 && errorData?.code === 'ADMIN_CRITICAL_PERMISSIONS_LOCKED') {
      toast.add({
        title: t('adminAccessControl.permissionSettings'),
        description: t('adminAccessControl.adminRolePermissionLocked'),
        color: 'error',
      });
      await refreshRolePermissions();
      return;
    }

    toast.add({ title: t('error'), description: t('adminAccessControl.permissionUpdateFailed'), color: 'error' });
  }
  finally {
    saving.value = false;
  }
}

function selectRole(roleId: number) {
  selectedRoleId.value = roleId;
  searchQuery.value = '';
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
      <div>
        <div>
          <h1 class="text-xl font-bold leading-none">
            {{ t('adminAccessControl.title') }}
          </h1>
          <p class="text-sm text-muted mt-1">
            {{ t('adminAccessControl.description') }}
          </p>
        </div>
      </div>
      <UButton v-if="authStore.can('role.create')" icon="i-lucide-plus" size="md" :to="localPath('/admin/access-control/create')">
        {{ t('adminAccessControl.addRole') }}
      </UButton>
    </div>

    <!-- Main Content -->
    <div class="flex flex-col lg:flex-row gap-8 items-start">
      <!-- Left: Role List -->
      <aside class="w-full lg:w-80 shrink-0 space-y-6">
        <UCard :ui="{ body: 'p-2!' }">
          <template #header>
            <h2 class="text-sm font-bold uppercase tracking-wider text-muted">
              {{ t('adminAccessControl.systemRoles') }}
            </h2>
          </template>

          <div v-if="authStore.can('role.view')" class="space-y-1 max-h-100 overflow-y-auto">
            <UButton
              v-for="role in roles"
              :key="role.id"
              :color="selectedRoleId === role.id ? 'primary' : 'neutral'"
              :variant="selectedRoleId === role.id ? 'subtle' : 'ghost'"
              size="xl"
              block
              class="justify-between p-4"
              @click="selectRole(role.id)"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  name="i-lucide-shield"
                  class="size-5"
                />
                <span class="text-sm font-medium capitalize">
                  {{ locale === 'en' ? role.name : role.nameTh }}
                </span>
              </div>
              <UDropdownMenu
                v-if="authStore.canAny(['role.edit', 'role.delete'])"
                :items="[
                  {
                    label: t('adminAccessControl.editRole'),
                    icon: 'i-lucide-pencil',
                    onSelect: () => handleEditRole(role),
                    visible: authStore.can('role.edit'),
                  },
                  {
                    label: t('adminAccessControl.deleteRole'),
                    icon: 'i-lucide-trash',
                    color: 'error' as const,
                    onSelect: () => handleDeleteRole(role),
                    visible: authStore.can('role.delete') && !isAdminRole(role.name),
                  },
                ].filter((i) => i.visible)"
              >
                <UIcon name="i-lucide-ellipsis-vertical" />
              </UDropdownMenu>
            </UButton>
          </div>
          <div v-else class="flex items-center justify-center py-12">
            <div class="text-center">
              <UIcon name="i-lucide-lock" class="size-10 text-muted mx-auto mb-2" />
              <p class="text-sm text-muted">
                {{ t('adminAccessControl.noRolesPermission') }}
              </p>
            </div>
          </div>
        </UCard>
      </aside>

      <!-- Right: Permissions Panel -->
      <div class="flex-1 w-full bg-white dark:bg-neutral-900 rounded-xl border border-default shadow-sm ">
        <!-- Toolbar -->
        <div class="p-6 border-b border-default space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold">
                {{ t('adminAccessControl.permissionSettings') }}: <span>{{ selectedRole ? locale === 'en' ? selectedRole.name : selectedRole.nameTh : '' }}</span>
              </h2>
              <p class="text-sm text-muted">
                {{ t('adminAccessControl.permissionSettingsDescription', { role: selectedRole ? locale === 'en' ? selectedRole.name : selectedRole.nameTh : '' }) }}
              </p>
            </div>
            <div v-if="selectedRole && authStore.can('permission.view')" class="shrink-0 w-full sm:w-64">
              <UInput
                v-model="searchQuery"
                icon="i-lucide-search"
                :placeholder="t('adminAccessControl.searchPermissions')"
                variant="subtle"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div v-if="selectedRole" class="p-6 space-y-8 pb-32">
          <!-- No results -->
          <div v-if="filteredModules.length === 0" class="text-center py-12">
            <UIcon name="i-lucide-search-x" class="size-12 text-muted mx-auto mb-3" />
            <p class="text-sm text-muted">
              {{ t('adminAccessControl.noPermissionsFound') }}
            </p>
          </div>

          <!-- Module sections -->
          <section v-for="mod in filteredModules" :key="mod.key">
            <div class="flex items-center gap-2 mb-4">
              <UIcon :name="moduleIcons[mod.key] ?? 'i-lucide-settings'" class="size-5 text-primary" />
              <h3 class="text-sm font-bold uppercase tracking-wide">
                {{ mod.key }}
              </h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label
                v-for="perm in mod.permissions"
                :key="perm.id"
                class="flex p-4 border border-default rounded-xl hover:bg-elevated/50 transition-all group"
                :class="{
                  'bg-elevated/30': localPermissionIds.has(perm.id),
                  'items-start': authStore.can('role.assign_permission'),
                  'items-center': !authStore.can('role.assign_permission'),
                  'justify-between': !authStore.can('role.assign_permission'),
                  'cursor-pointer': authStore.can('role.assign_permission'),
                }"
              >
                <UCheckbox
                  v-if="authStore.can('role.assign_permission')"
                  :model-value="localPermissionIds.has(perm.id)"
                  :disabled="isAdminRolePermissionLocked(perm.code)"
                  class="mt-0.5"
                  @update:model-value="togglePermission(perm.id, perm.code)"
                />
                <div class="ml-3">
                  <span class="block text-sm font-semibold">{{ perm.code }}</span>
                  <span class="block text-xs text-dimmed italic mt-0.5">
                    {{ locale === 'en' ? perm.descriptionEn : perm.descriptionTh }}
                  </span>
                  <span v-if="isAdminRolePermissionLocked(perm.code)" class="block text-xs text-error mt-1">
                    {{ t('adminAccessControl.adminRolePermissionLocked') }}
                  </span>
                </div>
                <UBadge v-if="!authStore.can('role.assign_permission') && localPermissionIds.has(perm.id)" icon="i-lucide-dot" color="primary" variant="soft" class="rounded-full">{{ t('adminAccessControl.permissionGranted') }}</UBadge>
              </label>
            </div>
          </section>
        </div>

        <!-- Empty State -->
        <div v-else class="flex items-center justify-center py-24">
          <div class="text-center">
            <UIcon name="i-lucide-shield" class="size-12 text-muted mx-auto mb-3" />
            <p class="text-sm text-muted">
              {{ t('adminAccessControl.selectRolePrompt') }}
            </p>
          </div>
        </div>

        <!-- Sticky Footer -->
        <div
          v-if="selectedRole && authStore.can('role.assign_permission') && authStore.can('permission.view')"
          class="mt-auto p-6 border-t border-default bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm rounded-b-xl sticky -bottom-6 flex items-center justify-end gap-3"
        >
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="!hasChanges"
            @click="resetChanges"
          >
            {{ t('adminAccessControl.resetChanges') }}
          </UButton>
          <UButton
            :loading="saving"
            :disabled="!hasChanges"
            @click="saveChanges"
          >
            {{ t('saveChanges') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
