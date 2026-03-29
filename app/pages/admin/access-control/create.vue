<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';

import { LazyBaseConfirmDialog } from '#components';
import * as z from 'zod';

definePageMeta({
  title: 'adminAccessControl.addRole',
  middleware: ['permission'],
  permission: 'role.create',
});

const { t, locale } = useI18n();
const localPath = useLocalePath();
const toast = useToast();
const overlay = useOverlay();
const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const loading = ref(false);
const isDirty = ref(false);
const searchQuery = ref('');

// ── Form Schema ──
const createRoleSchema = z.object({
  name: z.string().min(1, t('common.validation.required', { field: t('adminAccessControl.roleForm.nameEn') })),
  nameTh: z.string().min(1, t('common.validation.required', { field: t('adminAccessControl.roleForm.nameTh') })),
  descriptionEn: z.string().optional(),
  descriptionTh: z.string().optional(),
  permissionIds: z.array(z.number()),
});

type CreateRoleSchema = z.output<typeof createRoleSchema>;

const form = ref<Partial<CreateRoleSchema>>({
  name: '',
  nameTh: '',
  descriptionEn: '',
  descriptionTh: '',
  permissionIds: [],
});

// ── Fetch all permissions ──
const { data: permissions } = await useFetch<{
  id: number;
  code: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
}[]>('/api/permissions');

// ── Group permissions by module ──
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
function togglePermission(permId: number) {
  const ids = [...(form.value.permissionIds ?? [])];
  const idx = ids.indexOf(permId);
  if (idx >= 0) {
    ids.splice(idx, 1);
  }
  else {
    ids.push(permId);
  }
  form.value.permissionIds = ids;
}

// ── Selected count ──
const selectedCount = computed(() => form.value.permissionIds?.length ?? 0);

// ── Dirty tracking ──
watch(form, () => {
  isDirty.value = !!(
    form.value.name
    || form.value.nameTh
    || form.value.descriptionEn
    || form.value.descriptionTh
    || (form.value.permissionIds && form.value.permissionIds.length > 0)
  );
}, { deep: true });

// ── Submit ──
async function handleCreateRole(event: FormSubmitEvent<CreateRoleSchema>) {
  loading.value = true;

  try {
    await $fetch('/api/roles', {
      method: 'POST',
      body: {
        name: event.data.name,
        nameTh: event.data.nameTh,
        descriptionEn: event.data.descriptionEn,
        descriptionTh: event.data.descriptionTh,
        permissionIds: event.data.permissionIds,
      },
    });

    isDirty.value = false;
    toast.add({ title: t('adminAccessControl.messages.success.created'), color: 'success' });
    navigateTo(localPath('/admin/access-control'));
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || t('adminAccessControl.messages.error.createFailed');
    toast.add({ title: t('error'), description: message, color: 'error' });
  }
  finally {
    loading.value = false;
  }
}

// ── Cancel ──
function handleCancel() {
  navigateTo(localPath('/admin/access-control'));
}

// ── Unsaved changes guard ──
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (isDirty.value) {
    event.preventDefault();
  }
}

onBeforeRouteLeave(async () => {
  if (!isDirty.value)
    return true;

  const instance = confirmDialog.open({
    title: t('common.dialog.discardTitle'),
    description: t('common.dialog.discardDescription'),
    cancelButton: { label: t('cancel') },
    confirmButton: { label: t('common.actions.leave'), color: 'error' },
  });

  const result = await instance.result;
  return Boolean(result);
});

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload));
</script>

<template>
  <div class="flex flex-col relative">
    <UForm :schema="createRoleSchema" :state="form" class="flex-1 max-w-360 mx-auto w-full space-y-6" @submit.prevent="handleCreateRole">
      <!-- Back Button -->
      <UButton
        type="button"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        :to="localPath('/admin/access-control')"
      >
        {{ t('common.actions.backTo', { page: t('adminAccessControl.title') }) }}
      </UButton>

      <!-- Page Header -->
      <div>
        <h1 class="text-2xl font-bold mb-1">
          {{ t('adminAccessControl.addRole') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('adminAccessControl.description') }}
        </p>
      </div>

      <!-- Role Information Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-shield" class="text-primary" />
            <h2 class="font-semibold text-base">
              {{ t('adminAccessControl.sections.roleInformation') }}
            </h2>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Role Name (EN) -->
          <UFormField :label="t('adminAccessControl.roleForm.nameEn')" name="name" required>
            <UInput
              v-model="form.name"
              :placeholder="t('adminAccessControl.roleForm.namePlaceholder')"
              class="w-full"
            />
          </UFormField>

          <!-- Role Name (TH) -->
          <UFormField :label="t('adminAccessControl.roleForm.nameTh')" name="nameTh" required>
            <UInput
              v-model="form.nameTh"
              :placeholder="t('adminAccessControl.roleForm.nameThPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <!-- Description EN -->
          <UFormField :label="t('adminAccessControl.roleForm.descEn')" name="descriptionEn">
            <UTextarea
              v-model="form.descriptionEn"
              :placeholder="t('adminAccessControl.roleForm.descEnPlaceholder')"
              class="w-full"
              :rows="3"
            />
          </UFormField>

          <!-- Description TH -->
          <UFormField :label="t('adminAccessControl.roleForm.descTh')" name="descriptionTh">
            <UTextarea
              v-model="form.descriptionTh"
              :placeholder="t('adminAccessControl.roleForm.descThPlaceholder')"
              class="w-full"
              :rows="3"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Permissions Card -->
      <UCard>
        <template #header>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-key" class="text-primary" />
              <div>
                <h2 class="font-semibold text-base">
                  {{ t('adminAccessControl.sections.assignPermissions') }}
                </h2>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <UBadge v-if="selectedCount > 0" color="primary" variant="soft" size="sm">
                {{ t('adminAccessControl.state.selectedCount', { count: selectedCount }) }}
              </UBadge>
              <div class="shrink-0 w-full sm:w-56">
                <UInput
                  v-model="searchQuery"
                  icon="i-lucide-search"
                  :placeholder="t('adminAccessControl.state.searchPlaceholder')"
                  variant="subtle"
                  class="w-full"
                />
              </div>
            </div>
          </div>
        </template>

        <div class="space-y-8">
          <!-- No results -->
          <div v-if="filteredModules.length === 0" class="text-center py-12">
            <UIcon name="i-lucide-search-x" class="size-12 text-muted mx-auto mb-3" />
            <p class="text-sm text-muted">
              {{ t('adminAccessControl.state.noPermissionsFound') }}
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
                class="flex items-start p-4 border border-default rounded-xl hover:bg-elevated/50 transition-all cursor-pointer group"
                :class="{ 'bg-elevated/30': form.permissionIds?.includes(perm.id) }"
              >
                <UCheckbox
                  :model-value="form.permissionIds?.includes(perm.id)"
                  class="mt-0.5"
                  @update:model-value="togglePermission(perm.id)"
                />
                <div class="ml-3">
                  <span class="block text-sm font-semibold">{{ perm.code }}</span>
                  <span class="block text-xs text-dimmed italic mt-0.5">
                    {{ locale === 'en' ? perm.descriptionEn : perm.descriptionTh }}
                  </span>
                </div>
              </label>
            </div>
          </section>
        </div>
      </UCard>

      <!-- Footer Actions -->
      <div class="flex items-center justify-end gap-4">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          :label="t('cancel')"
          @click="handleCancel"
        />
        <UButton
          type="submit"
          color="primary"
          :label="t('adminAccessControl.addRole')"
          :loading
        />
      </div>
    </UForm>
  </div>
</template>
