<script setup lang="ts">
import type { Role } from '~/types/user';

defineProps<{
  roles: Role[] | undefined;
}>();
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-users-20-solid" class="text-gray-400" />
          <h2 class="font-semibold">
            Permissions & Groups
          </h2>
        </div>
        <UButton
          icon="i-heroicons-plus-20-solid"
          color="primary"
          variant="link"
          label="Add Group"
          size="sm"
        />
      </div>
    </template>

    <div class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <UBadge
          v-for="role in roles"
          :key="role.id"
          color="primary"
          variant="subtle"
          class="text-sm flex items-center gap-2"
        >
          {{ role.name }}
          <UButton
            icon="i-heroicons-x-mark-20-solid"
            color="primary"
            variant="ghost"
            size="xs"
          />
        </UBadge>
      </div>

      <!-- <div class="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/30 flex items-center justify-between">
        <span class="text-sm text-gray-500 dark:text-gray-400 italic">
          Select a group to assign additional permissions...
        </span>
        <UIcon name="i-heroicons-menu-alt-2-20-solid" class="text-gray-400" />
      </div> -->
    </div>
  </UCard>
</template>
