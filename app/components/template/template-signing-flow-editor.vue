<script setup lang="ts">
import type { FieldInstance, FileTypeValue, SigningStep } from '~/types/template';

import { SIGNER_COLORS } from '~/types/template';

const props = defineProps<{
  signingSteps: SigningStep[];
  placedFields: FieldInstance[];
  pdfFile: File | null;
  fileType: FileTypeValue;
  uiScale: number;
}>();

const emit = defineEmits<{
  'update:signingSteps': [steps: SigningStep[]];
  'update:placedFields': [fields: FieldInstance[]];
}>();

const { t, locale } = useI18n();

// Local state
const selectedStepId = ref<string | null>(null);
const isAddingStep = ref(false);
const newStepRoleId = ref<number | undefined>(undefined);
const newStepIsRequired = ref(true);

// Fetch roles from database
type RoleRecord = { id: number; name: string; descriptionEn: string | null; descriptionTh: string | null };
const roles = ref<RoleRecord[]>([]);
const isLoadingRoles = ref(false);

function getRoleDescription(role: RoleRecord | null | undefined): string | undefined {
  if (!role)
    return undefined;
  return (locale.value === 'th' ? role.descriptionTh : role.descriptionEn) ?? role.descriptionEn ?? undefined;
}

async function fetchRoles(): Promise<void> {
  isLoadingRoles.value = true;
  try {
    const data = await $fetch<RoleRecord[]>('/api/roles');
    roles.value = data;
  }
  catch (error) {
    console.error('Failed to fetch roles:', error);
  }
  finally {
    isLoadingRoles.value = false;
  }
}

// Fetch users by role for person selection
type UserRecord = { id: string; fullNameEn: string; fullNameTh: string; email: string };
const usersByRole = ref<Record<number, UserRecord[]>>({});
const loadingUsersByRole = ref<Record<number, boolean>>({});

async function fetchAllUsersForRoles(): Promise<void> {
  const roleIds = roles.value.map(r => r.id);
  await Promise.all(roleIds.map(async (roleId) => {
    if (usersByRole.value[roleId])
      return;
    loadingUsersByRole.value[roleId] = true;
    try {
      const data = await $fetch<UserRecord[]>(`/api/users/by-role/${roleId}`);
      usersByRole.value[roleId] = data;
    }
    catch (error) {
      console.error(`Failed to fetch users for role ${roleId}:`, error);
      usersByRole.value[roleId] = [];
    }
    finally {
      loadingUsersByRole.value[roleId] = false;
    }
  }));
}

onMounted(async () => {
  await fetchRoles();
  await fetchAllUsersForRoles();
});

function getUserItems(roleId: number | undefined) {
  if (!roleId)
    return [];
  const list = usersByRole.value[roleId] ?? [];
  return list.map(u => ({
    label: locale.value === 'th' ? u.fullNameTh : u.fullNameEn,
    value: u.id,
  }));
}

function getUserDisplayName(userId: string, roleId: number | undefined): string {
  if (!roleId)
    return '';
  const list = usersByRole.value[roleId] ?? [];
  const user = list.find(u => u.id === userId);
  if (!user)
    return '';
  return locale.value === 'th' ? user.fullNameTh : user.fullNameEn;
}

function onUserSelected(stepId: string, userId: string | undefined): void {
  const updatedSteps = props.signingSteps.map((s) => {
    if (s.id === stepId) {
      return {
        ...s,
        assignedUserId: userId || undefined,
        assignedUserName: userId ? getUserDisplayName(userId, s.roleId) : undefined,
      };
    }
    return s;
  });
  emit('update:signingSteps', updatedSteps);
}

// Roles formatted for USelect (filter out already-used roles)
const roleItems = computed(() => {
  const usedRoleIds = props.signingSteps.map(s => s.roleId).filter(Boolean);
  return roles.value
    .filter(r => !usedRoleIds.includes(r.id))
    .map(r => ({
      label: r.name,
      value: r.id,
      description: getRoleDescription(r),
    }));
});

// Selected role object (for auto-filling description)
const selectedNewRole = computed(() => {
  if (!newStepRoleId.value)
    return null;
  return roles.value.find(r => r.id === newStepRoleId.value) ?? null;
});

// Computed
const selectedStep = computed<SigningStep | null>(() => {
  if (!selectedStepId.value)
    return null;
  return props.signingSteps.find(s => s.id === selectedStepId.value) || null;
});

const unassignedFields = computed<FieldInstance[]>(() => {
  return props.placedFields.filter(f => !f.signerStepId && !f.isAutoGenerate);
});

const autoGenerateFields = computed<FieldInstance[]>(() => {
  return props.placedFields.filter(f => f.isAutoGenerate);
});

const assignedFieldsForSelectedStep = computed<FieldInstance[]>(() => {
  if (!selectedStepId.value)
    return [];
  return props.placedFields.filter(f => f.signerStepId === selectedStepId.value);
});

const unassignedCount = computed(() => unassignedFields.value.length);

// Get the next available color
function getNextColor(): string {
  const usedColors = props.signingSteps.map(s => s.color);
  const available = SIGNER_COLORS.filter(c => !usedColors.includes(c));
  return available.length > 0 ? available[0]! : SIGNER_COLORS[props.signingSteps.length % SIGNER_COLORS.length]!;
}

// Add a new signing step
function addStep(): void {
  if (!selectedNewRole.value)
    return;

  // Capture role info before resetting form
  const role = selectedNewRole.value;

  const newStep: SigningStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    order: props.signingSteps.length + 1,
    roleId: role.id,
    roleName: role.name,
    description: getRoleDescription(role) || undefined,
    isRequired: newStepIsRequired.value,
    assignedFieldInstanceIds: [],
    color: getNextColor(),
  };

  const updatedSteps = [...props.signingSteps, newStep];
  emit('update:signingSteps', updatedSteps);

  // Reset form
  newStepRoleId.value = undefined;
  newStepIsRequired.value = true;
  isAddingStep.value = false;

  // Auto-select the new step
  selectedStepId.value = newStep.id;
}

// Remove a signing step
function removeStep(stepId: string): void {
  // Unassign all fields from this step
  const updatedFields = props.placedFields.map((f) => {
    if (f.signerStepId === stepId) {
      return { ...f, signerStepId: undefined };
    }
    return f;
  });
  emit('update:placedFields', updatedFields);

  // Remove the step and re-order
  const updatedSteps = props.signingSteps
    .filter(s => s.id !== stepId)
    .map((s, index) => ({ ...s, order: index + 1 }));
  emit('update:signingSteps', updatedSteps);

  // Clear selection if the removed step was selected
  if (selectedStepId.value === stepId) {
    selectedStepId.value = updatedSteps.length > 0 ? updatedSteps[0]!.id : null;
  }
}

// Move step up in order
function moveStepUp(stepId: string): void {
  const idx = props.signingSteps.findIndex(s => s.id === stepId);
  if (idx <= 0)
    return;

  const updatedSteps = [...props.signingSteps];
  const temp = updatedSteps[idx - 1]!;
  updatedSteps[idx - 1] = updatedSteps[idx]!;
  updatedSteps[idx] = temp;

  // Re-assign order numbers
  updatedSteps.forEach((s, i) => {
    s.order = i + 1;
  });
  emit('update:signingSteps', updatedSteps);
}

// Move step down in order
function moveStepDown(stepId: string): void {
  const idx = props.signingSteps.findIndex(s => s.id === stepId);
  if (idx < 0 || idx >= props.signingSteps.length - 1)
    return;

  const updatedSteps = [...props.signingSteps];
  const temp = updatedSteps[idx + 1]!;
  updatedSteps[idx + 1] = updatedSteps[idx]!;
  updatedSteps[idx] = temp;

  // Re-assign order numbers
  updatedSteps.forEach((s, i) => {
    s.order = i + 1;
  });
  emit('update:signingSteps', updatedSteps);
}

// Handle field click from PDF preview — assign/unassign to selected step
function handleFieldClicked(field: FieldInstance): void {
  if (!selectedStepId.value)
    return;

  const updatedFields = props.placedFields.map((f) => {
    if (f.instanceId === field.instanceId) {
      // Toggle: if already assigned to this step, unassign; otherwise assign
      const newSignerStepId = f.signerStepId === selectedStepId.value ? undefined : selectedStepId.value;
      return { ...f, signerStepId: newSignerStepId };
    }
    return f;
  }) as FieldInstance[];
  emit('update:placedFields', updatedFields);

  // Update step's assignedFieldInstanceIds
  syncStepFieldIds(updatedFields);
}

// Assign a field from the right panel
function assignFieldToStep(fieldInstanceId: string): void {
  if (!selectedStepId.value)
    return;

  const updatedFields = props.placedFields.map((f) => {
    if (f.instanceId === fieldInstanceId) {
      return { ...f, signerStepId: selectedStepId.value! };
    }
    return f;
  }) as FieldInstance[];
  emit('update:placedFields', updatedFields);
  syncStepFieldIds(updatedFields);
}

// Unassign a field from the selected step
function unassignFieldFromStep(fieldInstanceId: string): void {
  const updatedFields = props.placedFields.map((f) => {
    if (f.instanceId === fieldInstanceId) {
      return { ...f, signerStepId: undefined };
    }
    return f;
  }) as FieldInstance[];
  emit('update:placedFields', updatedFields);
  syncStepFieldIds(updatedFields);
}

// Sync assignedFieldInstanceIds on all steps
function syncStepFieldIds(fields: FieldInstance[]): void {
  const updatedSteps = props.signingSteps.map(step => ({
    ...step,
    assignedFieldInstanceIds: fields
      .filter(f => f.signerStepId === step.id)
      .map(f => f.instanceId),
  }));
  emit('update:signingSteps', updatedSteps);
}

// Select first step by default when steps exist
watch(() => props.signingSteps.length, (newLen) => {
  if (newLen > 0 && !selectedStepId.value) {
    selectedStepId.value = props.signingSteps[0]!.id;
  }
}, { immediate: true });
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- LEFT PANEL: Signing Steps List -->
    <aside class="w-72 flex flex-col shrink-0 z-10 border-r border-gray-200">
      <div class="p-4 border-b">
        <h3 class="font-bold flex items-center gap-2">
          <UIcon name="i-heroicons-queue-list" class="text-primary-500" />
          {{ t('signingFlow') }}
        </h3>
      </div>

      <div class="overflow-y-auto flex-1 p-4 space-y-3">
        <!-- Step Cards -->
        <div
          v-for="step in signingSteps"
          :key="step.id"
          class="rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-sm"
          :class="selectedStepId === step.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'"
          @click="selectedStepId = step.id"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                :style="{ backgroundColor: step.color }"
              >
                {{ step.order }}
              </span>
              <span class="font-medium text-sm">{{ step.roleName }}</span>
            </div>
            <div class="flex items-center gap-0.5">
              <UButton
                icon="i-heroicons-chevron-up"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="step.order === 1"
                @click.stop="moveStepUp(step.id)"
              />
              <UButton
                icon="i-heroicons-chevron-down"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="step.order === signingSteps.length"
                @click.stop="moveStepDown(step.id)"
              />
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                color="error"
                variant="ghost"
                @click.stop="removeStep(step.id)"
              />
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <UBadge :color="step.isRequired ? 'primary' : 'neutral'" variant="subtle" size="xs">
              {{ step.isRequired ? t('required') : t('optional') }}
            </UBadge>
            <span>{{ step.assignedFieldInstanceIds.length }} {{ t('fields') }}</span>
          </div>
          <div v-if="step.roleId" class="mt-2" @click.stop>
            <USelect
              :model-value="step.assignedUserId"
              :items="getUserItems(step.roleId)"
              :placeholder="t('selectPerson')"
              value-key="value"
              label-key="label"
              size="xs"
              :loading="loadingUsersByRole[step.roleId]"
              icon="i-heroicons-user"
              class="w-full"
              @update:model-value="onUserSelected(step.id, $event as string | undefined)"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="signingSteps.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-pencil-square" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p class="text-sm text-gray-500">
            {{ t('noSigningSteps') }}
          </p>
          <p class="text-xs text-gray-400 mt-1">
            {{ t('addFirstStep') }}
          </p>
        </div>

        <!-- Add Step Form -->
        <div v-if="isAddingStep" class="rounded-lg border-2 border-dashed border-primary-300 bg-primary-50 p-3 space-y-2">
          <USelect
            v-model="newStepRoleId"
            :items="roleItems"
            :placeholder="t('selectRole')"
            value-key="value"
            label-key="label"
            size="sm"
            :loading="isLoadingRoles"
            icon="i-heroicons-user-circle"
          />
          <!-- Show selected role description -->
          <p v-if="getRoleDescription(selectedNewRole)" class="text-xs text-gray-500 bg-white rounded px-2 py-1.5 border border-gray-200">
            {{ getRoleDescription(selectedNewRole) }}
          </p>
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-xs">
              <input v-model="newStepIsRequired" type="checkbox" class="rounded">
              {{ t('required') }}
            </label>
            <div class="flex gap-1">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :label="t('previous')"
                @click="isAddingStep = false; newStepRoleId = undefined"
              />
              <UButton
                size="xs"
                color="primary"
                :label="t('addSigningStep')"
                :disabled="!newStepRoleId"
                @click="addStep"
              />
            </div>
          </div>
        </div>

        <!-- Add Step Button -->
        <UButton
          v-if="!isAddingStep"
          icon="i-heroicons-plus"
          :label="t('addSigningStep')"
          color="primary"
          variant="soft"
          block
          @click="isAddingStep = true"
        />
      </div>
    </aside>

    <!-- CENTER: PDF Preview with clickable fields -->
    <section class="flex-1 relative overflow-hidden flex flex-col bg-gray-100">
      <!-- Instruction bar -->
      <div class="h-11 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-cursor-arrow-rays" class="text-primary-500" />
          <span v-if="selectedStep" class="text-sm text-gray-600">
            {{ t('clickFieldToAssign') }}
            <span class="font-semibold" :style="{ color: selectedStep.color }">{{ selectedStep.roleName }}</span>
          </span>
          <span v-else class="text-sm text-gray-400">
            {{ t('signingStepRequired') }}
          </span>
        </div>
        <div v-if="unassignedCount > 0" class="flex items-center gap-1">
          <UBadge color="warning" variant="subtle" size="xs">
            {{ unassignedCount }} {{ t('unassignedFields') }}
          </UBadge>
        </div>
      </div>

      <!-- PDF Canvas (read-only mode) -->
      <div class="flex-1 overflow-auto p-8 flex justify-center items-start">
        <template-pdf-create
          v-if="fileType === 'pdf' && pdfFile"
          :pdf-file="pdfFile"
          :placed-fields="placedFields"
          :ui-scale="uiScale"
          :read-only="true"
          :signing-steps="signingSteps"
          @field-clicked="handleFieldClicked"
        />
      </div>
    </section>

    <!-- RIGHT PANEL: Step Details & Field Assignment -->
    <aside class="w-64 flex flex-col shrink-0 z-10 border-l border-gray-200">
      <div class="p-4 border-b">
        <h3 class="font-bold flex items-center gap-2">
          <UIcon name="i-heroicons-adjustments-horizontal" class="text-primary-500" />
          {{ t('stepDetails') }}
        </h3>
      </div>

      <div v-if="selectedStep" class="overflow-y-auto flex-1 p-4 space-y-4">
        <!-- Selected Step Info -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
              :style="{ backgroundColor: selectedStep.color }"
            >
              {{ selectedStep.order }}
            </span>
            <span class="font-semibold text-sm">{{ selectedStep.roleName }}</span>
          </div>
          <p v-if="selectedStep.description" class="text-xs text-gray-500">
            {{ selectedStep.description }}
          </p>
        </div>

        <!-- Assigned Fields -->
        <div>
          <label class="text-xs font-semibold text-gray-500 uppercase mb-2 block">
            {{ t('assignedFields') }} ({{ assignedFieldsForSelectedStep.length }})
          </label>
          <div class="space-y-1.5">
            <div
              v-for="field in assignedFieldsForSelectedStep"
              :key="field.instanceId"
              class="flex items-center justify-between p-2 rounded-md bg-white border border-gray-200"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :style="{ backgroundColor: selectedStep.color }"
                />
                <span class="text-xs text-gray-700 truncate">{{ field.label || field.name }}</span>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                size="xs"
                color="error"
                variant="ghost"
                @click="unassignFieldFromStep(field.instanceId)"
              />
            </div>
            <p v-if="assignedFieldsForSelectedStep.length === 0" class="text-xs text-gray-400 text-center py-2">
              {{ t('clickFieldToAssign') }}
            </p>
          </div>
        </div>

        <!-- Unassigned Fields -->
        <div>
          <label class="text-xs font-semibold text-gray-500 uppercase mb-2 block">
            {{ t('unassignedFields') }} ({{ unassignedCount }})
          </label>
          <div class="space-y-1.5">
            <div
              v-for="field in unassignedFields"
              :key="field.instanceId"
              class="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer transition-colors"
              @click="assignFieldToStep(field.instanceId)"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <div class="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                <span class="text-xs text-gray-600 truncate">{{ field.label || field.name }}</span>
              </div>
              <UIcon name="i-heroicons-plus-circle" class="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- No Step Selected -->
      <div v-else class="flex-1 flex items-center justify-center p-4">
        <p class="text-sm text-gray-400 text-center">
          {{ signingSteps.length > 0 ? t('clickFieldToAssign') : t('addFirstStep') }}
        </p>
      </div>

      <!-- System Auto-Fill Fields (always visible when auto-generate fields exist) -->
      <div v-if="autoGenerateFields.length > 0" class="p-4 border-t border-gray-200">
        <label class="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
          <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
          ระบบเติมอัตโนมัติ ({{ autoGenerateFields.length }})
        </label>
        <div class="space-y-1.5">
          <div
            v-for="field in autoGenerateFields"
            :key="field.instanceId"
            class="flex items-center gap-2 p-2 rounded-md bg-blue-50 border border-blue-200"
          >
            <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span class="text-xs text-blue-700 truncate">{{ field.label || field.name }}</span>
            <UBadge color="info" variant="subtle" size="xs" class="ml-auto shrink-0">
              Auto
            </UBadge>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
