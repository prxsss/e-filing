<script setup lang="ts">
definePageMeta({
  title: 'adminAccessControl.presets.editPreset',
  middleware: ['permission'],
  permission: 'permission_preset.edit',
});

const { t } = useI18n();
const localPath = useLocalePath();
const route = useRoute();

const presetId = computed(() => Number(route.params.id));

const { data: preset, error } = await useFetch<{
  id: number;
  name: string;
  nameTh: string;
  descriptionEn: string | null;
  descriptionTh: string | null;
  permissionIds: number[];
}>(() => `/api/admin/permission-presets/${presetId.value}`);

if (Number.isNaN(presetId.value) || error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Permission preset not found' });
}

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
          {{ t('adminAccessControl.presets.editPreset') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('adminAccessControl.presets.description') }}
        </p>
      </div>
    </div>

    <AdminPermissionPresetForm v-if="preset" mode="edit" :preset="preset" @cancel="handleCancel" @saved="handleSaved" />
  </div>
</template>
