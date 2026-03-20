<script lang="ts" setup>
import { LazyBaseConfirmDialog } from '#components';

definePageMeta({
  title: 'documentReview',
  middleware: ['permission'],
  permission: 'template.view',
});

// --- Types ---
type Template = {
  id: number;
  name: string | null;
  description: string | null;
  version: string | null;
  isActive: boolean | null;
  createdBy: number | null;
  createdAt: string;
  documentUrl: string | null;
  documentWidth: number | null;
  documentHeight: number | null;
  placedFieldsData: unknown;
  signingFlowData: unknown;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SigningStepSummary = {
  id: string;
  order: number;
  roleName: string;
  description: string | null;
  isRequired: boolean;
  color: string;
};

const DEFAULT_SIGNING_STEP_COLOR = '#94A3B8';

// --- State ---
const route = useRoute();
const router = useRouter();
const overlay = useOverlay();
const toast = useToast();
const templateId = computed(() => {
  const value = route.params.id;
  return Array.isArray(value) ? value[0] : value;
});
const template = ref<Template | null>(null);
const isLoading = ref(true);
const isDeleting = ref(false);
const error = ref<string | null>(null);

const authStore = useAuthStore();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const placedFields = ref<any[]>([]);
const previewFieldValues = ref<Record<string, string>>({});
const isEditingFormLayout = ref(false);
const formSectionTitle = ref('Request Information');
const formFieldLayout = ref<Array<{ instanceId: string; questionLabel: string }>>([]);
const isSavingFormLayout = ref(false);
const activeEditingFieldId = ref<string | null>(null);

/** Snapshot when entering layout edit (for cancel restore). */
type FormLayoutEditSnapshot = {
  sectionTitle: string;
  layout: Array<{ instanceId: string; questionLabel: string }>;
};
const formLayoutEditSnapshot = ref<FormLayoutEditSnapshot | null>(null);

const signingSteps = computed<SigningStepSummary[]>(() => normalizeSigningFlowData(template.value?.signingFlowData));

const templateDescriptionPreview = computed(() => {
  if (isLoading.value)
    return 'Loading...';

  return template.value?.description?.trim() || 'ยังไม่มีคำอธิบาย';
});

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string')
    return value;

  try {
    return JSON.parse(value);
  }
  catch {
    return value;
  }
}

function normalizePlacedFieldsData(value: unknown): any[] {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function getFieldType(field: any): string {
  return String(field?.type || field?.fieldType || '').toLowerCase();
}

function isCheckboxField(field: any): boolean {
  const fieldType = getFieldType(field);
  const fieldName = String(field?.name || '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

function normalizeCheckboxValue(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
}

function getFieldValueKey(field: any): string {
  const instanceKey = String(field?.instanceId ?? '').trim();
  if (instanceKey.length > 0) {
    return instanceKey;
  }
  const idKey = String(field?.id ?? '').trim();
  return idKey;
}

function getVisibilityRule(field: any) {
  const rawRule = field?.visibilityRule ?? field?.visibility_rule;
  if (!rawRule || typeof rawRule !== 'object') {
    return null;
  }
  const sourceFieldInstanceId = String(rawRule.sourceFieldInstanceId ?? rawRule.source_field_instance_id ?? '').trim();
  const sourceGroupId = String(rawRule.sourceGroupId ?? rawRule.source_group_id ?? '').trim();
  if (!sourceFieldInstanceId.length && !sourceGroupId.length) {
    return null;
  }
  return {
    enabled: rawRule.enabled !== false,
    sourceFieldInstanceId: sourceFieldInstanceId || null,
    sourceGroupId: sourceGroupId || null,
    operator: rawRule.operator === 'isUnchecked' ? 'isUnchecked' : 'isChecked',
  };
}

function resolveCurrentFieldValue(field: any): string {
  const key = getFieldValueKey(field);
  const value = key ? (previewFieldValues.value[key] || '') : '';
  if (isCheckboxField(field)) {
    return normalizeCheckboxValue(value);
  }
  return value;
}

function isFieldVisible(field: any): boolean {
  const rule = getVisibilityRule(field);
  if (!rule || rule.enabled === false) {
    return true;
  }
  let isChecked = false;
  if (rule.sourceGroupId) {
    const groupCheckboxes = placedFields.value.filter((candidate) => {
      return isCheckboxField(candidate) && String(candidate?.groupId ?? '').trim() === rule.sourceGroupId;
    });
    isChecked = groupCheckboxes.some(candidate => normalizeCheckboxValue(resolveCurrentFieldValue(candidate)) === 'true');
  }
  else {
    const sourceField = placedFields.value.find(
      candidate => String(candidate?.instanceId ?? '').trim() === String(rule.sourceFieldInstanceId ?? ''),
    );
    if (!sourceField) {
      return true;
    }
    isChecked = normalizeCheckboxValue(resolveCurrentFieldValue(sourceField)) === 'true';
  }
  return rule.operator === 'isUnchecked' ? !isChecked : isChecked;
}

/** All student-fillable fields for the layout editor (ignore conditional visibility so every field can be reordered). */
const layoutEditorFillableFields = computed(() => {
  return placedFields.value.filter((field: any) =>
    field.isFillable !== false
    && field.is_fillable !== false
    && getFieldType(field) !== 'signature',
  );
});

const layoutEditorFieldsById = computed(() => {
  const map = new Map<string, any>();
  for (const field of layoutEditorFillableFields.value) {
    map.set(String(field.instanceId), field);
  }
  return map;
});

const orderedLayoutEditorFields = computed(() => {
  const layoutIds = new Set(formFieldLayout.value.map(item => item.instanceId));
  const ordered = formFieldLayout.value
    .map(item => layoutEditorFieldsById.value.get(item.instanceId))
    .filter(Boolean);
  const remaining = layoutEditorFillableFields.value.filter(field => !layoutIds.has(String(field.instanceId)));
  return [...ordered, ...remaining];
});

function syncFormFieldLayout() {
  const existing = new Map(formFieldLayout.value.map(item => [item.instanceId, item]));
  const sourceFields = [...layoutEditorFillableFields.value].sort((a: any, b: any) => {
    const aOrder = Number.isFinite(Number(a?.formOrder)) ? Number(a.formOrder) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b?.formOrder)) ? Number(b.formOrder) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return String(a?.instanceId ?? '').localeCompare(String(b?.instanceId ?? ''));
  });

  formFieldLayout.value = sourceFields.map((field: any) => {
    const key = String(field.instanceId);
    const existingItem = existing.get(key);
    return {
      instanceId: key,
      questionLabel: existingItem?.questionLabel || String(field.formQuestionLabel || field.label || field.name || 'Question'),
    };
  });

  const sectionFromField = sourceFields.find((field: any) => String(field?.formSectionTitle || '').trim().length > 0);
  if (sectionFromField) {
    formSectionTitle.value = String(sectionFromField.formSectionTitle);
  }
}

function getQuestionLabel(field: any): string {
  const item = formFieldLayout.value.find(layout => layout.instanceId === String(field.instanceId));
  // Allow the input to be truly empty (questionLabel === '') while editing.
  // Fallback to template label only when questionLabel is null/undefined.
  if (!item) {
    return String(field.label || field.name || 'Question');
  }
  if (item.questionLabel === undefined || item.questionLabel === null) {
    return String(field.label || field.name || 'Question');
  }
  return String(item.questionLabel);
}

function setQuestionLabel(instanceId: string, value: string) {
  const item = formFieldLayout.value.find(layout => layout.instanceId === instanceId);
  if (!item) {
    return;
  }
  item.questionLabel = value;
}

function revertQuestionLabelIfEmpty(instanceId: string) {
  if (!isEditingFormLayout.value) {
    return;
  }
  const snap = formLayoutEditSnapshot.value;
  if (!snap) {
    return;
  }

  const current = String(formFieldLayout.value.find(item => item.instanceId === instanceId)?.questionLabel ?? '');
  if (current.trim().length > 0) {
    return;
  }

  const original = snap.layout.find(item => item.instanceId === instanceId);
  if (original && original.questionLabel !== undefined) {
    setQuestionLabel(instanceId, String(original.questionLabel));
    return;
  }

  // Fallback to the template label if snapshot doesn't exist for some reason.
  const templateField = placedFields.value.find((f: any) => String(f?.instanceId ?? '') === instanceId);
  setQuestionLabel(instanceId, templateField ? String(templateField.label || templateField.name || 'Question') : '');
}

function revertSectionTitleIfEmpty() {
  if (!isEditingFormLayout.value) {
    return;
  }
  const snap = formLayoutEditSnapshot.value;
  if (!snap) {
    return;
  }

  const current = String(formSectionTitle.value ?? '');
  if (current.trim().length > 0) {
    return;
  }

  formSectionTitle.value = String(snap.sectionTitle ?? '');
}

function focusLayoutInputByInstanceId(instanceId: string) {
  if (!instanceId) {
    return;
  }

  activeEditingFieldId.value = instanceId;
  const row = document.getElementById(`form-layout-row-${instanceId}`);
  if (!row) {
    return;
  }

  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const input = row.querySelector('input');
  if (input) {
    setTimeout(() => {
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).select();
    }, 120);
  }
}

function moveLayoutItem(index: number, direction: -1 | 1) {
  const orderedFields = orderedLayoutEditorFields.value;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= orderedFields.length) {
    return;
  }
  const reorderedIds = orderedFields.map(field => String(field.instanceId));
  const [moved] = reorderedIds.splice(index, 1);
  reorderedIds.splice(nextIndex, 0, moved!);
  const layoutById = new Map(formFieldLayout.value.map(item => [item.instanceId, item]));
  formFieldLayout.value = reorderedIds
    .map(id => layoutById.get(id))
    .filter((item): item is { instanceId: string; questionLabel: string } => Boolean(item));
}

function getFieldCardClass(field: any): string {
  const isActive = activeEditingFieldId.value === String(field.instanceId);
  return isActive
    ? 'rounded-md border border-yellow-300 p-2 bg-yellow-50'
    : 'rounded-md border border-gray-100 p-2 bg-gray-50';
}

async function saveFormLayout(): Promise<boolean> {
  if (!templateId.value) {
    return false;
  }

  isSavingFormLayout.value = true;
  try {
    // If user cleared inputs but didn't provide any value, restore the original values
    // from when editing started (avoids accidental fallback and keeps UX consistent).
    if (formLayoutEditSnapshot.value) {
      revertSectionTitleIfEmpty();
      for (const item of formFieldLayout.value) {
        revertQuestionLabelIfEmpty(item.instanceId);
      }
    }

    const payload = {
      sectionTitle: String(formSectionTitle.value || 'Request Information').trim(),
      fields: formFieldLayout.value.map((item, index) => ({
        instanceId: item.instanceId,
        questionLabel: String(item.questionLabel || '').trim(),
        order: index + 1,
      })),
    };

    const result = await $fetch<{ success: boolean; data?: { placedFieldsData?: any[] }; error?: string }>(`/api/pdf-templates/${templateId.value}/form-layout`, {
      method: 'PATCH',
      body: payload,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to save form layout');
    }

    if (Array.isArray(result.data?.placedFieldsData)) {
      placedFields.value = result.data!.placedFieldsData!;
      syncFormFieldLayout();
    }
    else {
      await fetchTemplate();
    }

    toast.add({
      title: 'บันทึกสำเร็จ',
      description: 'บันทึกการจัดรูปแบบฟอร์มแล้ว',
      color: 'success',
    });
    return true;
  }
  catch (err) {
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: err instanceof Error ? err.message : 'ไม่สามารถบันทึก Form Layout ได้',
      color: 'error',
    });
    return false;
  }
  finally {
    isSavingFormLayout.value = false;
  }
}

function startEditFormLayout() {
  formLayoutEditSnapshot.value = {
    sectionTitle: String(formSectionTitle.value || ''),
    layout: formFieldLayout.value.map(item => ({ ...item })),
  };
  isEditingFormLayout.value = true;
}

async function confirmAndSaveFormLayout() {
  const instance = confirmDialog.open({
    title: 'ยืนยันการบันทึก',
    description: 'ยืนยันการบันทึกไปใช้กับฟอร์มฝั่งนิสิต?',
    cancelButton: { label: 'ยกเลิก' },
    confirmButton: { label: 'บันทึก', color: 'primary' },
  });
  const confirmed = await instance.result;
  if (!confirmed) {
    return;
  }
  const ok = await saveFormLayout();
  if (ok) {
    isEditingFormLayout.value = false;
    activeEditingFieldId.value = null;
    formLayoutEditSnapshot.value = null;
  }
}

async function confirmAndCancelFormLayoutEdit() {
  const instance = confirmDialog.open({
    title: 'ยืนยันการยกเลิก',
    description: 'ยกเลิกการแก้ไข การเปลี่ยนแปลงที่ยังไม่บันทึกจะถูกยกเลิก',
    cancelButton: { label: 'กลับไปแก้ไข' },
    confirmButton: { label: 'ยกเลิกการแก้ไข', color: 'error' },
  });
  const confirmed = await instance.result;
  if (!confirmed) {
    return;
  }
  const snap = formLayoutEditSnapshot.value;
  if (snap) {
    formSectionTitle.value = snap.sectionTitle;
    formFieldLayout.value = snap.layout.map(item => ({ ...item }));
  }
  isEditingFormLayout.value = false;
  activeEditingFieldId.value = null;
  formLayoutEditSnapshot.value = null;
}

function updatePreviewValue(field: any, value: string) {
  const key = getFieldValueKey(field);
  if (!key) {
    return;
  }
  if (!isCheckboxField(field)) {
    previewFieldValues.value[key] = String(value ?? '');
    return;
  }
  const groupId = String(field?.groupId ?? '').trim();
  const normalized = normalizeCheckboxValue(value);
  if (!groupId) {
    previewFieldValues.value[key] = normalized;
    return;
  }
  if (normalized === 'true') {
    for (const candidate of placedFields.value) {
      if (!isCheckboxField(candidate) || String(candidate?.groupId ?? '').trim() !== groupId) {
        continue;
      }
      const candidateKey = getFieldValueKey(candidate);
      if (!candidateKey) {
        continue;
      }
      previewFieldValues.value[candidateKey] = candidateKey === key ? 'true' : '';
    }
    return;
  }
  previewFieldValues.value[key] = '';
}

function isPreviewCheckboxDisabled(field: any): boolean {
  if (!isCheckboxField(field)) {
    return false;
  }
  const groupId = String(field?.groupId ?? '').trim();
  if (!groupId) {
    return false;
  }
  const currentKey = getFieldValueKey(field);
  const isCurrentChecked = normalizeCheckboxValue(resolveCurrentFieldValue(field)) === 'true';
  if (isCurrentChecked) {
    return false;
  }
  return placedFields.value.some((candidate) => {
    if (!isCheckboxField(candidate) || String(candidate?.groupId ?? '').trim() !== groupId) {
      return false;
    }
    const candidateKey = getFieldValueKey(candidate);
    if (!candidateKey || candidateKey === currentKey) {
      return false;
    }
    return normalizeCheckboxValue(resolveCurrentFieldValue(candidate)) === 'true';
  });
}

function normalizeSigningFlowData(value: unknown): SigningStepSummary[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed))
    return [];

  return parsed
    .map((step: any, index: number) => ({
      id: typeof step?.id === 'string' && step.id.trim().length > 0 ? step.id : `step-${index + 1}`,
      order: typeof step?.order === 'number' ? step.order : index + 1,
      roleName: typeof step?.roleName === 'string' && step.roleName.trim().length > 0
        ? step.roleName.trim()
        : `Signer ${index + 1}`,
      description: typeof step?.description === 'string' && step.description.trim().length > 0
        ? step.description.trim()
        : null,
      isRequired: step?.isRequired !== false,
      color: typeof step?.color === 'string' && step.color.trim().length > 0
        ? step.color
        : DEFAULT_SIGNING_STEP_COLOR,
    }))
    .sort((a, b) => a.order - b.order);
}

// --- Methods ---
async function fetchTemplate() {
  if (!templateId.value) {
    error.value = 'Template ID is required';
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const result = await $fetch<ApiResponse<Template>>(`/api/pdf-templates/${templateId.value}`);

    if (result.success && result.data) {
      template.value = result.data;
      placedFields.value = normalizePlacedFieldsData(result.data.placedFieldsData);
      syncFormFieldLayout();
    }
    else {
      error.value = 'Template not found';
    }
  }
  catch (err) {
    console.error('Error fetching template:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load template';
  }
  finally {
    isLoading.value = false;
  }
}

function downloadPdf() {
  if (template.value?.documentUrl) {
    window.open(template.value.documentUrl, '_blank');
  }
}

async function deleteTemplate() {
  if (!templateId.value)
    return;

  const instance = confirmDialog.open({
    title: 'ลบ Template',
    description: `คุณต้องการลบ "${template.value?.name}" หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
    cancelButton: { label: 'ยกเลิก' },
    confirmButton: { label: 'ลบ', color: 'error' },
  });

  const confirmed = await instance.result;
  if (!confirmed)
    return;

  isDeleting.value = true;
  try {
    await $fetch(`/api/pdf-templates/${templateId.value}`, { method: 'DELETE' });
    toast.add({
      title: 'ลบสำเร็จ',
      description: `Template "${template.value?.name}" ถูกลบแล้ว`,
      color: 'success',
    });
    router.push('/admin/templates');
  }
  catch (err) {
    console.error('Error deleting template:', err);
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: 'ไม่สามารถลบ Template ได้',
      color: 'error',
    });
  }
  finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  fetchTemplate();
});

watch(layoutEditorFillableFields, () => {
  if (isEditingFormLayout.value) {
    return;
  }
  syncFormFieldLayout();
}, { deep: true });
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Breadcrumb -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: 'Templates', to: '/admin/templates' },
            { label: template?.name || 'Loading...', to: templateId ? `/admin/templates/${templateId}` : '/admin/templates' },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ template?.name || 'Document Preview' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              {{ templateDescriptionPreview }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="ghost"
              color="neutral"
              @click="downloadPdf"
            />
            <UButton
              v-if="authStore.can('template.delete')"
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              :loading="isDeleting"
              @click="deleteTemplate"
            />
            <UButton
              v-if="authStore.can('template.edit')"
              :to="`/admin/templates/edit?id=${templateId}`"
              icon="i-heroicons-pencil-square"
              variant="solid"
              color="info"
            >
              Edit
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
          <p class="text-gray-500">
            กำลังโหลด Template...
          </p>
        </div>
      </div>

      <!-- Error State -->
      <UCard v-else-if="error">
        <div class="text-center py-8">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton @click="$router.push('/admin/templates')">
            กลับไปหน้ารายการ Templates
          </UButton>
        </div>
      </UCard>

      <!-- Template Content -->
      <div v-else-if="template && template.documentUrl" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: PDF Preview -->
        <div class="lg:col-span-2">
          <template-pdf-preview
            :pdf-url="template.documentUrl"
            :placed-fields="placedFields"
            :highlighted-field-instance-id="activeEditingFieldId || ''"
            :interactive-fields="true"
            @field-clicked="focusLayoutInputByInstanceId"
          />
        </div>

        <!-- Right: Sidebar -->
        <div class="space-y-6">
          <!-- Request Summary -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-500 uppercase">
                  Form Layout (Student View)
                </h3>
                <div class="flex items-center gap-1 justify-end">
                  <template v-if="!isEditingFormLayout">
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-heroicons-pencil-square"
                      @click="startEditFormLayout"
                    >
                      Edit Layout
                    </UButton>
                  </template>
                  <template v-else>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-heroicons-x-mark"
                      :disabled="isSavingFormLayout"
                      @click="confirmAndCancelFormLayoutEdit"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      size="xs"
                      color="primary"
                      icon="i-heroicons-check"
                      :loading="isSavingFormLayout"
                      @click="confirmAndSaveFormLayout"
                    >
                      Save Layout
                    </UButton>
                  </template>
                </div>
              </div>
            </template>
            <div class="space-y-3 w-full">
              <div>
                <label class="text-xs font-semibold text-gray-500 uppercase mb-1 block">Section Title</label>
                <UInput
                  v-model="formSectionTitle"
                  :disabled="!isEditingFormLayout"
                  @blur="revertSectionTitleIfEmpty"
                />
              </div>

              <div class="rounded-lg border border-gray-200 p-3">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">
                  {{ formSectionTitle || 'Request Information' }}
                </h4>
                <div class="space-y-3">
                  <div
                    v-for="(field, index) in orderedLayoutEditorFields"
                    :id="`form-layout-row-${field.instanceId}`"
                    :key="field.instanceId"
                    :class="getFieldCardClass(field)"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <UInput
                        :model-value="getQuestionLabel(field)"
                        :disabled="!isEditingFormLayout"
                        class="flex-1"
                        @focus="activeEditingFieldId = String(field.instanceId)"
                        @blur="() => { activeEditingFieldId = null; revertQuestionLabelIfEmpty(String(field.instanceId)); }"
                        @update:model-value="(value) => setQuestionLabel(String(field.instanceId), String(value ?? ''))"
                      />
                      <UButton
                        size="xs"
                        icon="i-heroicons-chevron-up"
                        variant="ghost"
                        :disabled="!isEditingFormLayout || index === 0"
                        @click="moveLayoutItem(index, -1)"
                      />
                      <UButton
                        size="xs"
                        icon="i-heroicons-chevron-down"
                        variant="ghost"
                        :disabled="!isEditingFormLayout || index === orderedLayoutEditorFields.length - 1"
                        @click="moveLayoutItem(index, 1)"
                      />
                    </div>
                    <form-field-input
                      v-if="isFieldVisible(field)"
                      :model-value="previewFieldValues[getFieldValueKey(field)]"
                      :field="{ ...field, label: getQuestionLabel(field) }"
                      :disabled="isPreviewCheckboxDisabled(field)"
                      @update:model-value="(value) => updatePreviewValue(field, String(value ?? ''))"
                    />
                    <p
                      v-else
                      class="text-xs text-gray-500 px-2 py-2 rounded border border-dashed border-gray-200 bg-gray-50/80"
                    >
                      ไม่แสดงผลตามเงื่อนไข (ติ๊ก checkbox ที่เกี่ยวข้องเพื่อดูตัวอย่าง)
                    </p>
                  </div>
                  <p v-if="orderedLayoutEditorFields.length === 0" class="text-sm text-gray-400 text-center py-3">
                    ไม่มีฟิลด์ที่นิสิตต้องกรอก
                  </p>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Workflow Progress -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Order of signing
              </h3>
            </template>
            <div v-if="signingSteps.length === 0" class="text-sm text-gray-500">
              ยังไม่มีการกำหนดลำดับการลงนาม
            </div>
            <div v-else class="space-y-0">
              <template
                v-for="(step, index) in signingSteps"
                :key="step.id"
              >
                <div class="flex items-start gap-3 py-2">
                  <div
                    class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                    :style="{ backgroundColor: step.color }"
                  >
                    {{ step.order }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">
                      {{ step.roleName }}
                    </p>
                    <p v-if="step.description" class="text-xs text-gray-500 mt-1">
                      {{ step.description }}
                    </p>
                    <UBadge
                      :color="step.isRequired ? 'primary' : 'neutral'"
                      variant="subtle"
                      size="xs"
                      class="mt-1"
                    >
                      {{ step.isRequired ? 'Required' : 'Optional' }}
                    </UBadge>
                  </div>
                </div>

                <!-- Arrow between items -->
                <div
                  v-if="index < signingSteps.length - 1"
                  class="flex items-center gap-3"
                >
                  <div class="w-10 flex justify-center">
                    <UIcon
                      name="i-heroicons-arrow-down"
                      class="text-gray-400 text-sm"
                    />
                  </div>
                </div>
              </template>
            </div>
          </UCard>

          <!-- Fields List -->
          <UCard v-if="placedFields.length > 0">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Fields ({{ placedFields.length }})
              </h3>
            </template>
            <div class="space-y-2">
              <div
                v-for="(field, index) in placedFields"
                :key="field.instanceId"
                class="p-2 bg-gray-50 rounded text-xs border border-gray-200"
              >
                <div class="font-medium text-gray-900">
                  {{ index + 1 }}. {{ field.label || field.name }}
                </div>
                <div class="text-gray-500 mt-1">
                  Type: {{ field.type || field.fieldType || '-' }} | Page {{ field.pageNumber || 1 }}
                </div>
              </div>
            </div>
          </UCard>
          <!-- Staff Comments -->
          <!-- <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Staff Comments
              </h3>
            </template>
            <UTextarea
              v-model="staffComment"
              placeholder="Add a note or reason for rejection..."
              :rows="4"
            />
          </UCard> -->

          <!-- Action Buttons -->
          <!-- <div class="space-y-3">
            <UButton
              block
              color="error"
              variant="outline"
              icon="i-heroicons-x-circle"
              @click="handleReject"
            >
              Reject Request
            </UButton>
            <UButton
              block
              color="success"
              icon="i-heroicons-pencil-square"
              @click="handleApprove"
            >
              Sign and Approve
            </UButton>
          </div> -->

          <!-- Footer Note -->
          <!-- <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-information-circle" class="text-blue-500 mt-0.5 shrink-0" />
              <p class="text-xs text-gray-600">
                By signing, you confirm that you have reviewed all attached evidence and queries of the grade change request.
              </p>
            </div>
          </UCard> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>
