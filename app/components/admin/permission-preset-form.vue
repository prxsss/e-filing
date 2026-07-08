<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';

import * as z from 'zod';

type PermissionPreset = {
  id: number;
  name: string;
  nameTh: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
  permissionIds: number[];
};

const props = defineProps<{
  mode: 'create' | 'edit';
  preset?: PermissionPreset | null;
}>();

const emit = defineEmits<{
  cancel: [];
  saved: [];
}>();

const { t, locale } = useI18n();
const toast = useToast();

const loading = ref(false);
const searchQuery = ref('');
const dashboardPermissionCodes = new Set([
  'dashboard.student.view',
  'dashboard.signer.view',
  'dashboard.admin.view',
]);

const permissionPresetSchema = z.object({
  name: z.string().min(1, t('common.validation.required', { field: t('adminAccessControl.presetForm.nameEn') })),
  nameTh: z.string().min(1, t('common.validation.required', { field: t('adminAccessControl.presetForm.nameTh') })),
  descriptionEn: z.string().optional(),
  descriptionTh: z.string().optional(),
  permissionIds: z.array(z.number()),
});

type PermissionPresetSchema = z.output<typeof permissionPresetSchema>;

const form = ref<Partial<PermissionPresetSchema>>({
  name: '',
  nameTh: '',
  descriptionEn: '',
  descriptionTh: '',
  permissionIds: [],
});

watch(
  () => props.preset,
  (preset) => {
    if (!preset) {
      form.value = {
        name: '',
        nameTh: '',
        descriptionEn: '',
        descriptionTh: '',
        permissionIds: [],
      };
      return;
    }

    form.value = {
      name: preset.name,
      nameTh: preset.nameTh,
      descriptionEn: preset.descriptionEn ?? '',
      descriptionTh: preset.descriptionTh ?? '',
      permissionIds: [...preset.permissionIds],
    };
  },
  { immediate: true },
);

const { data: permissions } = await useFetch<{
  id: number;
  code: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
}[]>('/api/permissions');

const moduleIcons: Record<string, string> = {
  request: 'i-lucide-file-text',
  template: 'i-lucide-file',
  user: 'i-lucide-users',
  audit_log: 'i-lucide-clipboard-list',
  role: 'i-lucide-shield',
  permission: 'i-lucide-key',
  permission_preset: 'i-lucide-package-check',
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

const dashboardPermissionIds = computed(() => {
  if (!permissions.value) {
    return new Set<number>();
  }

  return new Set(
    permissions.value
      .filter(permission => dashboardPermissionCodes.has(permission.code))
      .map(permission => permission.id),
  );
});

const selectedDashboardPermissionCount = computed(() => {
  const selectedPermissionIds = form.value.permissionIds ?? [];
  return selectedPermissionIds.filter(permissionId => dashboardPermissionIds.value.has(permissionId)).length;
});

const selectedCount = computed(() => form.value.permissionIds?.length ?? 0);

function togglePermission(permId: number) {
  const ids = [...(form.value.permissionIds ?? [])];
  const isDashboardPermission = dashboardPermissionIds.value.has(permId);

  if (isDashboardPermission) {
    const nextIds = ids.filter(id => !dashboardPermissionIds.value.has(id));

    if (!ids.includes(permId)) {
      nextIds.push(permId);
    }

    form.value.permissionIds = nextIds;
    return;
  }

  const idx = ids.indexOf(permId);
  if (idx >= 0) {
    ids.splice(idx, 1);
  }
  else {
    ids.push(permId);
  }
  form.value.permissionIds = ids;
}

function resolvePresetErrorMessage(error: unknown) {
  const fetchError = error as {
    data?: {
      code?: string;
      statusMessage?: string;
      message?: string;
      data?: {
        code?: string;
      };
    };
    message?: string;
  };

  const errorCode = fetchError.data?.code ?? fetchError.data?.data?.code;
  const backendMessage = fetchError.data?.statusMessage ?? fetchError.data?.message ?? fetchError.message;

  if (errorCode === 'PERMISSION_PRESET_NAME_ALREADY_EXISTS') {
    return t('adminAccessControl.messages.error.duplicatePresetName');
  }

  if (errorCode === 'INVALID_DASHBOARD_PERMISSION_COUNT') {
    return t('adminAccessControl.messages.error.presetDashboardPermissionRequired');
  }

  if (errorCode === 'INVALID_PERMISSION_IDS') {
    return t('adminAccessControl.messages.error.invalidPermissionIds');
  }

  return backendMessage || t('adminAccessControl.messages.error.presetSaveFailed');
}

async function handleSubmit(event: FormSubmitEvent<PermissionPresetSchema>) {
  if (selectedDashboardPermissionCount.value !== 1) {
    toast.add({
      title: t('adminAccessControl.messages.error.presetSaveFailed'),
      description: t('adminAccessControl.messages.error.presetDashboardPermissionRequired'),
      color: 'error',
    });
    return;
  }

  loading.value = true;

  try {
    const body = {
      name: event.data.name,
      nameTh: event.data.nameTh,
      descriptionEn: event.data.descriptionEn,
      descriptionTh: event.data.descriptionTh,
      permissionIds: event.data.permissionIds,
    };

    if (props.mode === 'edit' && props.preset) {
      await $fetch(`/api/admin/permission-presets/${props.preset.id}`, {
        method: 'PATCH',
        body,
      });
      toast.add({ title: t('adminAccessControl.messages.success.presetUpdated'), color: 'success' });
    }
    else {
      await $fetch('/api/admin/permission-presets', {
        method: 'POST',
        body,
      });
      toast.add({ title: t('adminAccessControl.messages.success.presetCreated'), color: 'success' });
    }

    emit('saved');
  }
  catch (error: unknown) {
    toast.add({
      title: t('adminAccessControl.messages.error.presetSaveFailed'),
      description: resolvePresetErrorMessage(error),
      color: 'error',
    });
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm :schema="permissionPresetSchema" :state="form" class="flex-1 max-w-360 mx-auto w-full space-y-6" @submit.prevent="handleSubmit">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-package-check" class="text-primary" />
          <h2 class="font-semibold text-base">
            {{ t('adminAccessControl.sections.presetInformation') }}
          </h2>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UFormField :label="t('adminAccessControl.presetForm.nameEn')" name="name" required>
          <UInput v-model="form.name" :placeholder="t('adminAccessControl.presetForm.namePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('adminAccessControl.presetForm.nameTh')" name="nameTh" required>
          <UInput v-model="form.nameTh" :placeholder="t('adminAccessControl.presetForm.nameThPlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('adminAccessControl.presetForm.descEn')" name="descriptionEn">
          <UTextarea v-model="form.descriptionEn" :placeholder="t('adminAccessControl.presetForm.descEnPlaceholder')" class="w-full" :rows="3" />
        </UFormField>

        <UFormField :label="t('adminAccessControl.presetForm.descTh')" name="descriptionTh">
          <UTextarea v-model="form.descriptionTh" :placeholder="t('adminAccessControl.presetForm.descThPlaceholder')" class="w-full" :rows="3" />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-key" class="text-primary" />
            <h2 class="font-semibold text-base">
              {{ t('adminAccessControl.sections.assignPermissions') }}
            </h2>
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
        <div v-if="filteredModules.length === 0" class="text-center py-12">
          <UIcon name="i-lucide-search-x" class="size-12 text-muted mx-auto mb-3" />
          <p class="text-sm text-muted">
            {{ t('adminAccessControl.state.noPermissionsFound') }}
          </p>
        </div>

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

    <div class="flex items-center justify-end gap-4">
      <UButton type="button" color="neutral" variant="ghost" :label="t('cancel')" @click="emit('cancel')" />
      <UButton
        type="submit"
        color="primary"
        :label="mode === 'edit' ? t('common.actions.save') : t('adminAccessControl.presets.addPreset')"
        :loading
      />
    </div>
  </UForm>
</template>
