<script setup lang="ts">
import { LazyBaseConfirmDialog } from '#components';

definePageMeta({
  title: 'adminAccessControl.presets.title',
  middleware: ['permission'],
  permission: 'permission_preset.view',
});

const { t, locale } = useI18n();
const localPath = useLocalePath();
const toast = useToast();
const overlay = useOverlay();
const authStore = useAuthStore();
const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const { data: presets, refresh } = await useFetch<{
  id: number;
  name: string;
  nameTh: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
  permissionIds: number[];
}[]>('/api/admin/permission-presets');

async function handleDeletePreset(preset: { id: number; name: string; nameTh: string }) {
  const instance = confirmDialog.open({
    title: t('common.dialog.confirmDelete'),
    description: t('common.dialog.deleteMessage', { name: locale.value === 'th' ? preset.nameTh : preset.name }),
    cancelButton: { label: t('cancel') },
    confirmButton: { label: t('delete'), color: 'error' },
  });

  const confirmed = await instance.result;
  if (!confirmed)
    return;

  try {
    await $fetch(`/api/admin/permission-presets/${preset.id}`, { method: 'DELETE' });
    toast.add({ title: t('adminAccessControl.messages.success.presetDeleted'), color: 'success' });
    await refresh();
  }
  catch {
    toast.add({
      title: t('adminAccessControl.messages.error.presetDeleteFailed'),
      color: 'error',
    });
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
      <div>
        <UButton
          type="button"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          :to="localPath('/admin/access-control')"
          class="mb-3"
        >
          {{ t('common.actions.backTo', { page: t('adminAccessControl.title') }) }}
        </UButton>
        <h1 class="text-xl font-bold leading-none">
          {{ t('adminAccessControl.presets.title') }}
        </h1>
        <p class="text-sm text-muted mt-1">
          {{ t('adminAccessControl.presets.description') }}
        </p>
      </div>

      <UButton
        v-if="authStore.can('permission_preset.create')"
        icon="i-lucide-plus"
        size="md"
        :to="localPath('/admin/access-control/presets/create')"
      >
        {{ t('adminAccessControl.presets.addPreset') }}
      </UButton>
    </div>

    <div v-if="!presets || presets.length === 0" class="flex items-center justify-center py-24 border border-default rounded-xl bg-white dark:bg-neutral-900">
      <div class="text-center">
        <UIcon name="i-lucide-package-open" class="size-12 text-muted mx-auto mb-3" />
        <p class="text-sm text-muted">
          {{ t('adminAccessControl.presets.empty') }}
        </p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard v-for="preset in presets" :key="preset.id">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-base font-semibold truncate">
              {{ locale === 'th' ? preset.nameTh : preset.name }}
            </h2>
            <p class="text-sm text-muted mt-1 line-clamp-2">
              {{ locale === 'th' ? preset.descriptionTh : preset.descriptionEn }}
            </p>
          </div>

          <UDropdownMenu
            v-if="authStore.canAny(['permission_preset.edit', 'permission_preset.delete'])"
            :items="[
              {
                label: t('common.actions.edit'),
                icon: 'i-lucide-pencil',
                to: localPath(`/admin/access-control/presets/${preset.id}/edit`),
                visible: authStore.can('permission_preset.edit'),
              },
              {
                label: t('common.actions.delete'),
                icon: 'i-lucide-trash',
                color: 'error' as const,
                onSelect: () => handleDeletePreset(preset),
                visible: authStore.can('permission_preset.delete'),
              },
            ].filter((item) => item.visible)"
          >
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" />
          </UDropdownMenu>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <UBadge icon="i-lucide-key" color="primary" variant="soft">
            {{ t('adminAccessControl.state.selectedCount', { count: preset.permissionIds.length }) }}
          </UBadge>
        </div>
      </UCard>
    </div>
  </div>
</template>
