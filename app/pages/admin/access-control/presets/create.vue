<script setup lang="ts">
definePageMeta({
  title: 'adminAccessControl.presets.addPreset',
  middleware: ['permission'],
  permission: 'permission_preset.create',
});

const { t } = useI18n();
const localPath = useLocalePath();

function handleCancel() {
  navigateTo(localPath('/admin/access-control/presets'));
}

function handleSaved() {
  navigateTo(localPath('/admin/access-control/presets'));
}
</script>

<template>
  <div class="flex flex-col relative">
    <div class="max-w-360 mx-auto w-full space-y-6 mb-6">
      <UButton
        type="button"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        :to="localPath('/admin/access-control/presets')"
      >
        {{ t('common.actions.backTo', { page: t('adminAccessControl.presets.title') }) }}
      </UButton>

      <div>
        <h1 class="text-2xl font-bold mb-1">
          {{ t('adminAccessControl.presets.addPreset') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('adminAccessControl.presets.description') }}
        </p>
      </div>
    </div>

    <AdminPermissionPresetForm mode="create" @cancel="handleCancel" @saved="handleSaved" />
  </div>
</template>
