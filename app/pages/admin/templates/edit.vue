<script setup lang="ts">
import type { FieldInstance, FileTypeValue, PdfRef, SigningStep, WizardStep } from '~/types/template';

type Field = any;

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

definePageMeta({
  title: 'editTemplate',
});

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();

// ─── Template ID ──────────────────────────────────────────────────────────────

const templateId = computed<string | undefined>(() => {
  const id = route.query.id;
  if (typeof id === 'string')
    return id;
  if (Array.isArray(id) && typeof id[0] === 'string')
    return id[0];
  return undefined;
});

// ─── State ────────────────────────────────────────────────────────────────────

const isLoading = ref<boolean>(true);
const isSaving = ref<boolean>(false);
const templateData = ref<any>(null);
const templateName = ref<string>('');
const templateNameError = ref<string>('');
const hasChanges = ref<boolean>(false);
const fileWasReplaced = ref<boolean>(false);

// File / PDF
const uploadedFile = ref<File | null>(null);
const fileType = ref<FileTypeValue>('pdf');
const currentPdfPage = ref<number>(1);

// Fields
const placedFields = ref<FieldInstance[]>([]);
const selectedFieldInstanceId = ref<string | null>(null);
const availableFields = ref<Field[]>([]);
const isLoadingFields = ref<boolean>(false);
const searchQuery = ref<string>('');

// Modals
const isCreateFieldModalOpen = ref<boolean>(false);
const isEditFieldModalOpen = ref<boolean>(false);
const editingField = ref<Field | null>(null);

// Refs
const templatePdfRef = ref<PdfRef | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref<boolean>(false);

// Zoom
const scale = ref<number>(1);

// === WIZARD STATE ===
const currentWizardStep = ref<WizardStep>(1);
const signingSteps = ref<SigningStep[]>([]);

const wizardSteps = computed(() => [
  { step: 1 as WizardStep, label: t('placeFields'), icon: 'i-heroicons-document-text' },
  { step: 2 as WizardStep, label: t('signingFlow'), icon: 'i-heroicons-queue-list' },
  { step: 3 as WizardStep, label: t('reviewAndSave'), icon: 'i-heroicons-clipboard-document-check' },
]);

const canProceedToStep2 = computed<boolean>(() => {
  const name = templateName.value.trim();
  return !!(name && name.length >= 3 && name.length <= 100 && uploadedFile.value && placedFields.value.length > 0);
});

const canProceedToStep3 = computed<boolean>(() => {
  if (signingSteps.value.length === 0)
    return false;
  const assignableFields = placedFields.value.filter(f => !f.isAutoGenerate);
  const allAssigned = assignableFields.every(f => f.signerStepId);
  return allAssigned;
});

// ─── Computed ─────────────────────────────────────────────────────────────────

const filteredFields = computed<Field[]>(() => {
  if (!searchQuery.value)
    return availableFields.value;
  return availableFields.value.filter(f =>
    f.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

/** Provides display coordinates from normalized coordinates when available. */
const selectedField = computed<FieldInstance | null>(() => {
  if (!selectedFieldInstanceId.value)
    return null;

  const field = placedFields.value.find(f => f.instanceId === selectedFieldInstanceId.value);
  if (!field)
    return null;

  if (templatePdfRef.value && field.normalizedX !== undefined && field.normalizedY !== undefined) {
    if (typeof templatePdfRef.value.normalizedToDisplay === 'function') {
      const display = templatePdfRef.value.normalizedToDisplay(
        field.normalizedX,
        field.normalizedY,
        field.normalizedWidth || 0,
        field.normalizedHeight || 0,
      );
      return {
        ...field,
        displayX: display.x,
        displayY: display.y,
        displayWidth: display.width,
        displayHeight: display.height,
      } as FieldInstance;
    }
  }
  return { ...field, displayX: field.x, displayY: field.y, displayWidth: field.width, displayHeight: field.height } as FieldInstance;
});

// ─── Wizard Navigation ────────────────────────────────────────────────────────

function goToStep(step: WizardStep): void {
  if (step === 2 && !canProceedToStep2.value) {
    if (!templateName.value.trim() || templateName.value.trim().length < 3) {
      toast.add({ title: t('placeFields'), description: 'Template name must be at least 3 characters', color: 'error' });
    }
    else if (!uploadedFile.value) {
      toast.add({ title: 'Please upload a file', color: 'error' });
    }
    else if (placedFields.value.length === 0) {
      toast.add({ title: 'Please add at least one field', color: 'error' });
    }
    return;
  }
  if (step === 3 && !canProceedToStep3.value) {
    if (signingSteps.value.length === 0) {
      toast.add({ title: t('signingStepRequired'), color: 'error' });
    }
    else {
      toast.add({ title: t('allFieldsMustBeAssigned'), color: 'error' });
    }
    return;
  }
  currentWizardStep.value = step;
}

function goNext(): void {
  if (currentWizardStep.value < 3) {
    goToStep((currentWizardStep.value + 1) as WizardStep);
  }
}

function goPrevious(): void {
  if (currentWizardStep.value > 1) {
    currentWizardStep.value = (currentWizardStep.value - 1) as WizardStep;
  }
}

// ─── Signing Flow Handlers ────────────────────────────────────────────────────

function handleSigningStepsUpdate(steps: SigningStep[]): void {
  signingSteps.value = steps;
}

function handlePlacedFieldsUpdate(fields: FieldInstance[]): void {
  placedFields.value = fields;
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

async function fetchTemplate(): Promise<void> {
  isLoading.value = true;
  try {
    const result = await $fetch<ApiResponse<any>>(`/api/pdf-templates/${templateId.value}`);
    if (!result.success || !result.data)
      throw new Error('Failed to fetch template');

    templateData.value = result.data;
    templateName.value = result.data.name || '';

    if (result.data.documentUrl) {
      const file = await urlToFile(result.data.documentUrl, `template_${templateId.value}.pdf`);
      uploadedFile.value = file;
      fileType.value = 'pdf';
    }

    if (Array.isArray(result.data.placedFieldsData)) {
      placedFields.value = result.data.placedFieldsData as FieldInstance[];
    }

    if (Array.isArray(result.data.signingFlowData)) {
      signingSteps.value = result.data.signingFlowData as SigningStep[];
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.add({ title: 'Error', description: `Failed to load template: ${message}`, color: 'error' });
  }
  finally {
    isLoading.value = false;
  }
}

async function fetchTemplateFields(): Promise<void> {
  isLoadingFields.value = true;
  try {
    const response = await $fetch<{ success: boolean; data?: Field[]; error?: string }>('/api/template-fields');
    if (response.success && response.data) {
      availableFields.value = response.data;
    }
    else {
      toast.add({ title: 'No Fields Found', description: response.error || 'Add fields in the database.', color: 'warning' });
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.add({ title: 'Failed to Load Fields', description: message, color: 'error' });
  }
  finally {
    isLoadingFields.value = false;
  }
}

// ─── File Upload (replace PDF) ────────────────────────────────────────────────

function triggerFileInput(): void {
  fileInput.value?.click();
}

function handleFileDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file)
    processFile(file);
}

async function handleFileInput(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file)
    processFile(file);
}

async function processFile(file: File): Promise<void> {
  if (file.size > 50 * 1024 * 1024) {
    toast.add({ title: 'File too large', description: 'Max 50 MB', color: 'error' });
    return;
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext !== 'pdf' && !['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    toast.add({ title: 'Unsupported file type', description: 'PDF or image files only', color: 'error' });
    return;
  }

  uploadedFile.value = file;
  fileWasReplaced.value = true;
  placedFields.value = [];
  selectedFieldInstanceId.value = null;
  currentPdfPage.value = 1;

  if (ext === 'pdf') {
    fileType.value = 'pdf';
  }
}

// ─── Field Management ─────────────────────────────────────────────────────────

function addFieldToPreview(fieldToAdd: Field): void {
  if (!fieldToAdd)
    return;
  if (!uploadedFile.value) {
    toast.add({ title: 'Upload a file first', color: 'error' });
    return;
  }

  const amount = fieldToAdd.amount || 1;
  const groupId = amount > 1 ? `group_${fieldToAdd.id}_${Date.now()}` : null;

  for (let i = 0; i < amount; i++) {
    const instance: FieldInstance = {
      ...fieldToAdd,
      instanceId: `field_${fieldToAdd.id}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      instanceNumber: i + 1,
      groupId,
      isGrouped: amount > 1,
      groupSize: amount,
      groupPosition: i,
      x: 50 + i * 40,
      y: 50 + i * 40,
      width: 150,
      height: 40,
      label: fieldToAdd.name === 'Check Mark' ? '' : fieldToAdd.label,
      pageNumber: currentPdfPage.value,
      fontSize: fieldToAdd.fontSize || 14,
      fontFamily: fieldToAdd.font || 'Arial',
    };
    placedFields.value.push(instance);
    if (i === amount - 1)
      selectedFieldInstanceId.value = instance.instanceId;
  }
}

function selectField(field: FieldInstance | null): void {
  selectedFieldInstanceId.value = field?.instanceId || null;
}

function removeSelectedField(): void {
  if (!selectedFieldInstanceId.value)
    return;
  const idx = placedFields.value.findIndex(f => f.instanceId === selectedFieldInstanceId.value);
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedFieldInstanceId.value = null;
  }
}

function handleFieldUpdate(data: { instanceId: string; updates: any }): void {
  const idx = placedFields.value.findIndex(f => f.instanceId === data.instanceId);
  if (idx > -1)
    Object.assign(placedFields.value[idx]!, data.updates);
}

function handleFieldRemoval(instanceId: string): void {
  const idx = placedFields.value.findIndex(f => f.instanceId === instanceId);
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedFieldInstanceId.value = null;
  }
}

function handlePdfPageChange(pageNumber: number): void {
  currentPdfPage.value = pageNumber;
}

// ─── Sidebar: Available Fields CRUD ──────────────────────────────────────────

function openEditField(field: Field): void {
  editingField.value = field;
  isEditFieldModalOpen.value = true;
}

function handleFieldCreated(newField: Field): void {
  availableFields.value.push(newField);
  toast.add({ title: 'Field Added', description: `"${newField.name}" added`, color: 'success' });
}

function handleFieldUpdated(updatedField: Field): void {
  const idx = availableFields.value.findIndex(f => f.id === updatedField.id);
  if (idx !== -1)
    availableFields.value[idx] = updatedField;
  toast.add({ title: 'Field Updated', description: `"${updatedField.name}" updated`, color: 'success' });
}

function handleFieldDeleted(fieldId: number | string): void {
  const idx = availableFields.value.findIndex(f => f.id === fieldId);
  if (idx !== -1)
    availableFields.value.splice(idx, 1);
  toast.add({ title: 'Field Deleted', color: 'success' });
}

// ─── Save ─────────────────────────────────────────────────────────────────────

function validateTemplateName(): boolean {
  const name = templateName.value.trim();
  if (!name) {
    templateNameError.value = 'Please enter a template name';
    return false;
  }
  if (name.length < 3) {
    templateNameError.value = 'Name must be at least 3 characters';
    return false;
  }
  if (name.length > 100) {
    templateNameError.value = 'Name must not exceed 100 characters';
    return false;
  }
  templateNameError.value = '';
  return true;
}

function handleSaveTemplate(): void {
  if (!validateTemplateName())
    return;
  if (!uploadedFile.value) {
    toast.add({ title: 'Error', description: 'Please upload a PDF file first', color: 'error' });
    return;
  }
  if (placedFields.value.length === 0) {
    toast.add({ title: 'Error', description: 'Please add at least one field', color: 'error' });
    return;
  }
  if (signingSteps.value.length === 0) {
    toast.add({ title: t('signingStepRequired'), color: 'error' });
    return;
  }
  if (!placedFields.value.filter(f => !f.isAutoGenerate).every(f => f.signerStepId)) {
    toast.add({ title: t('allFieldsMustBeAssigned'), color: 'error' });
    return;
  }
  performSave();
}

async function performSave(): Promise<void> {
  isSaving.value = true;

  try {
    // Step 1: If file was replaced, upload the new PDF
    let documentUrl = templateData.value?.documentUrl || '';
    if (fileWasReplaced.value && uploadedFile.value) {
      const formData = new FormData();
      formData.append('file', uploadedFile.value);

      const uploadResponse = await $fetch('/api/upload-template-file', {
        method: 'POST',
        body: formData,
      }) as any;

      if (!uploadResponse.success || !uploadResponse.url) {
        throw new Error('Failed to upload PDF file');
      }
      documentUrl = uploadResponse.url;
    }

    // Step 2: Get PDF natural dimensions from child component
    let docWidth = templateData.value?.documentWidth || 0;
    let docHeight = templateData.value?.documentHeight || 0;
    if (templatePdfRef.value) {
      const ref = templatePdfRef.value as any;
      if (ref.getPdfNaturalDimensions) {
        const dims = ref.getPdfNaturalDimensions();
        docWidth = Math.round(dims.width || 0);
        docHeight = Math.round(dims.height || 0);
      }
    }

    // Step 3: Normalize field coordinates
    const normalizedFields = placedFields.value.map((field: FieldInstance) => ({
      id: field.id,
      instanceId: field.instanceId,
      instanceNumber: field.instanceNumber,
      type: field.fieldType || (field as any).type,
      name: field.name,
      label: field.label,
      fontSize: field.fontSize || 14,
      fontFamily: field.fontFamily || 'Arial',
      normalizedX: field.normalizedX,
      normalizedY: field.normalizedY,
      normalizedWidth: field.normalizedWidth,
      normalizedHeight: field.normalizedHeight,
      groupId: field.groupId || null,
      isGrouped: field.isGrouped || false,
      groupSize: field.groupSize || 1,
      groupPosition: field.groupPosition || 0,
      pageNumber: field.pageNumber || 1,
      signerStepId: field.signerStepId || null,
      isAutoGenerate: field.isAutoGenerate || false,
    }));

    // Step 4: Prepare signing flow data
    const signingFlowData = signingSteps.value.map(step => ({
      id: step.id,
      order: step.order,
      roleName: step.roleName,
      description: step.description || null,
      isRequired: step.isRequired,
      assignedFieldInstanceIds: step.assignedFieldInstanceIds,
      color: step.color,
    }));

    // Step 5: Save template to database
    const saveResponse = await $fetch(`/api/pdf-templates/${templateId.value}/save`, {
      method: 'POST',
      body: {
        name: templateName.value.trim(),
        originalCompositeUrl: documentUrl,
        placedFieldsData: normalizedFields,
        signingFlowData,
        documentWidth: docWidth,
        documentHeight: docHeight,
      },
    }) as any;

    if (!saveResponse.success || !saveResponse.data) {
      throw new Error('Failed to save template to database');
    }

    toast.add({ title: 'Saved', description: `Template "${templateName.value}" updated successfully`, color: 'success' });
    hasChanges.value = false;
    setTimeout(() => router.push('/admin/templates'), 500);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.add({ title: 'Save Failed', description: errorMessage || 'Unable to save template', color: 'error' });
  }
  finally {
    isSaving.value = false;
  }
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

function handleKeyDown(event: KeyboardEvent): void {
  if (!selectedFieldInstanceId.value || !templatePdfRef.value)
    return;
  const field = selectedField.value;
  if (!field)
    return;

  const step = event.shiftKey ? 10 : 1;

  const moveField = (axis: 'x' | 'y', delta: number) => {
    if (field.normalizedX === undefined)
      return;
    const display = templatePdfRef.value!.normalizedToDisplay(
      field.normalizedX || 0,
      field.normalizedY || 0,
      field.normalizedWidth || 0,
      field.normalizedHeight || 0,
    );
    const newX = axis === 'x' ? Math.max(0, display.x + delta) : display.x;
    const newY = axis === 'y' ? Math.max(0, display.y + delta) : display.y;
    const normalized = templatePdfRef.value!.displayToNormalized(newX, newY, display.width, display.height);
    if (axis === 'x')
      field.normalizedX = normalized.x;
    else field.normalizedY = normalized.y;
  };

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      moveField('y', -step);
      break;
    case 'ArrowDown':
      event.preventDefault();
      moveField('y', step);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      moveField('x', -step);
      break;
    case 'ArrowRight':
      event.preventDefault();
      moveField('x', step);
      break;
    case 'Delete':
      event.preventDefault();
      removeSelectedField();
      break;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function handleBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(async () => {
  await Promise.all([fetchTemplate(), fetchTemplateFields()]);
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

watch([templateName, placedFields, uploadedFile, signingSteps], (): void => {
  hasChanges.value = true;
});
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ═══════════════ TOP HEADER (Toolbar with Step Indicator) ═══════════════ -->
    <header class="h-16 flex items-center justify-between px-4 z-20 shadow-sm shrink-0 bg-white border-b border-gray-200">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="currentWizardStep > 1 ? goPrevious() : router.back()"
        />

        <!-- Template Name Input (visible across all steps) -->
        <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">Template Name</label>
          <input
            v-model="templateName"
            type="text"
            :class="templateNameError ? 'border border-red-500 bg-red-50' : 'border bg-transparent'"
            class="p-2 font-semibold focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-2 transition-colors"
            placeholder="Enter template name..."
            :disabled="isLoading || currentWizardStep > 1"
            @input="validateTemplateName"
          >
          <div v-if="templateNameError && currentWizardStep === 1" class="flex items-center gap-2 mt-1 text-red-600 text-xs font-semibold">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0" />
            {{ templateNameError }}
          </div>
        </div>

        <div class="h-6 w-px bg-gray-200 mx-1 hidden md:block" />
      </div>

      <!-- Step Indicator (center) -->
      <div class="flex items-center gap-1">
        <template v-for="(ws, idx) in wizardSteps" :key="ws.step">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            :class="{
              'bg-primary-100 text-primary-700': currentWizardStep === ws.step,
              'bg-primary-50 text-primary-500': currentWizardStep > ws.step,
              'bg-gray-100 text-gray-400': currentWizardStep < ws.step,
            }"
            @click="ws.step <= currentWizardStep ? goToStep(ws.step) : undefined"
          >
            <UIcon :name="ws.icon" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ ws.label }}</span>
          </button>
          <div v-if="idx < wizardSteps.length - 1" class="w-6 h-px" :class="currentWizardStep > ws.step ? 'bg-primary-400' : 'bg-gray-200'" />
        </template>
      </div>

      <!-- Right actions -->
      <div class="flex items-center gap-3">
        <UButton
          v-if="currentWizardStep > 1"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          :label="t('previous')"
          @click="goPrevious"
        />
        <UButton
          v-if="currentWizardStep < 3"
          icon="i-heroicons-arrow-right"
          trailing
          color="primary"
          :label="t('next')"
          size="xl"
          class="px-6 font-bold"
          @click="goNext"
        />
        <UButton
          v-if="currentWizardStep === 3"
          :loading="isSaving"
          :disabled="isLoading"
          icon="i-heroicons-check"
          color="primary"
          :label="t('saveTemplate')"
          size="xl"
          class="px-6 font-bold"
          @click="handleSaveTemplate"
        />
      </div>
    </header>

    <!-- ═══════════════ STEP 1: Upload & Place Fields ═══════════════ -->
    <div v-if="currentWizardStep === 1" class="flex-1 flex overflow-hidden">
      <!-- ─── LEFT SIDEBAR ─── -->
      <aside class="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">
        <div class="p-4 border-b">
          <h3 class="font-bold flex items-center gap-2">
            <UIcon name="i-heroicons-swatch" class="text-primary-500" />
            Tools
          </h3>
        </div>

        <div class="overflow-y-auto flex-1 p-4 space-y-6">
          <!-- ── File Section ── -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-semibold uppercase text-gray-500">Document</label>
              <UBadge v-if="uploadedFile" color="success" variant="subtle" size="xs">
                Loaded
              </UBadge>
            </div>

            <!-- Loaded state -->
            <div v-if="uploadedFile" class="rounded-lg p-3 bg-gray-50 flex items-center gap-3 border border-gray-200">
              <div class="w-10 h-10 bg-white border border-gray-200 rounded flex items-center justify-center text-gray-400 shrink-0">
                <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
              </div>
              <div class="overflow-hidden">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ uploadedFile.name }}
                </p>
                <button class="text-xs text-primary-600 hover:underline" @click="triggerFileInput">
                  Replace file
                </button>
              </div>
            </div>

            <!-- Empty / drop zone -->
            <div
              v-else
              class="border-2 border-dashed rounded-xl p-6 text-center hover:bg-gray-50 hover:border-primary-400 transition-all cursor-pointer group"
              :class="{ 'border-primary-500 bg-primary-50': isDragging }"
              @click="triggerFileInput"
              @drop.prevent="handleFileDrop"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
            >
              <UIcon name="i-heroicons-cloud-arrow-up" class="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-500 transition-colors" />
              <p class="text-sm font-medium text-gray-600">
                Click to upload
              </p>
              <p class="text-xs text-gray-400 mt-1">
                PDF (max 50 MB)
              </p>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept="application/pdf,image/*"
              class="hidden"
              @change="handleFileInput"
            >
          </div>

          <!-- ── Available Fields ── -->
          <div>
            <div class="flex justify-between items-center mb-3">
              <label class="text-xs font-semibold uppercase text-gray-500">Fields</label>
              <div class="flex items-center gap-2">
                <UBadge v-if="!isLoadingFields && availableFields.length > 0" color="primary" variant="subtle" size="xs">
                  {{ availableFields.length }}
                </UBadge>
                <UButton
                  icon="i-heroicons-plus"
                  size="xs"
                  color="primary"
                  variant="soft"
                  title="Add new field"
                  @click="isCreateFieldModalOpen = true"
                />
              </div>
            </div>

            <!-- Search -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="Search..."
              size="sm"
              class="mb-3 w-full"
              :disabled="isLoadingFields"
            />

            <!-- Loading skeleton -->
            <div v-if="isLoadingFields" class="space-y-2">
              <div v-for="i in 3" :key="i" class="w-full h-16 rounded-lg bg-gray-100 animate-pulse" />
            </div>

            <!-- Empty state -->
            <div v-else-if="availableFields.length === 0" class="text-center py-8">
              <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p class="text-sm text-gray-500">
                No fields found
              </p>
              <p class="text-xs text-gray-400 mt-1">
                Click + to add fields
              </p>
            </div>

            <!-- Field list -->
            <div v-else class="space-y-2">
              <div
                v-for="field in filteredFields"
                :key="field.id"
                class="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-primary-400 hover:shadow-sm transition-all group"
              >
                <button
                  class="flex-1 flex items-center gap-3 text-left"
                  @click="addFieldToPreview(field)"
                >
                  <div class="w-8 h-8 rounded-md bg-gray-50 text-gray-500 flex items-center justify-center group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                    <UIcon :name="field.icon" class="w-5 h-5" />
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                      {{ field.name }}
                    </p>
                    <p class="text-[10px] text-gray-400">
                      {{ field.type }}
                    </p>
                  </div>
                </button>
                <UButton
                  icon="i-heroicons-pencil-square"
                  size="xs"
                  color="primary"
                  variant="ghost"
                  square
                  title="Edit field"
                  @click.stop="openEditField(field)"
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ─── CENTER CANVAS ─── -->
      <section class="flex-1 relative overflow-hidden flex flex-col bg-gray-100">
        <!-- Canvas toolbar (page info | centered field toolbar | zoom) -->
        <div class="h-11 bg-white border-b border-gray-200 px-4 flex items-center shrink-0">
          <!-- Left: page info -->
          <div class="flex items-center shrink-0 w-20">
            <span class="text-xs text-gray-400 font-medium">
              <template v-if="isLoading">Loading...</template>
              <template v-else-if="!uploadedFile">No file</template>
              <template v-else>Page {{ currentPdfPage }}</template>
            </span>
          </div>

          <!-- Center: field toolbar -->
          <div class="flex-1 flex justify-center">
            <field-toolbar
              v-if="selectedField"
              :selected-field="selectedField"
              :pdf-ref="templatePdfRef"
              :scale="scale"
              @field-updated="handleFieldUpdate"
              @field-removed="handleFieldRemoval"
            />
          </div>

          <!-- Right: zoom controls -->
          <div class="flex items-center gap-1.5 shrink-0 w-20 justify-end">
            <UButton icon="i-heroicons-minus" size="xs" color="neutral" variant="ghost" :disabled="scale <= 0.5" @click="scale = Math.max(0.5, +(scale - 0.1).toFixed(1))" />
            <button
              class="text-xs font-mono text-gray-500 hover:text-gray-700 w-10 text-center"
              title="Reset zoom"
              @click="scale = 1"
            >
              {{ Math.round(scale * 100) }}%
            </button>
            <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" :disabled="scale >= 2" @click="scale = Math.min(2, +(scale + 0.1).toFixed(1))" />
          </div>
        </div>

        <!-- Scrollable Canvas -->
        <div class="flex-1 overflow-auto p-8 flex justify-center items-start">
          <!-- Loading state -->
          <div v-if="isLoading" class="flex items-center justify-center w-full h-full min-h-96">
            <div class="text-center text-gray-400">
              <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 mx-auto mb-3 animate-spin" />
              <p class="text-sm">
                Loading template...
              </p>
            </div>
          </div>

          <!-- PDF Editor -->
          <template-pdf-create
            v-else-if="fileType === 'pdf' && uploadedFile"
            ref="templatePdfRef"
            :pdf-file="uploadedFile"
            :placed-fields="placedFields"
            :selected-field="selectedField || undefined"
            :new-template-name="templateName"
            :signing-steps="signingSteps"
            :ui-scale="scale"
            @field-selected="selectField"
            @field-updated="handleFieldUpdate"
            @field-removed="handleFieldRemoval"
            @pdf-loaded="() => {}"
            @current-page-changed="handlePdfPageChange"
          />

          <!-- Empty placeholder -->
          <div
            v-else
            class="bg-white shadow-lg border border-gray-200 rounded-lg"
            style="width: 595px; min-height: 842px;"
          >
            <div class="flex flex-col items-center justify-center h-full py-20 text-gray-300">
              <UIcon name="i-heroicons-document" class="w-16 h-16 mb-2" />
              <p class="text-sm">
                No document loaded
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══════════════ STEP 2: Signing Flow ═══════════════ -->
    <template-signing-flow-editor
      v-else-if="currentWizardStep === 2"
      :signing-steps="signingSteps"
      :placed-fields="placedFields"
      :pdf-file="uploadedFile"
      :file-type="fileType"
      :ui-scale="scale"
      @update:signing-steps="handleSigningStepsUpdate"
      @update:placed-fields="handlePlacedFieldsUpdate"
    />

    <!-- ═══════════════ STEP 3: Review & Save ═══════════════ -->
    <template-review-summary
      v-else-if="currentWizardStep === 3"
      :template-name="templateName"
      :uploaded-file="uploadedFile"
      :file-type="fileType"
      :placed-fields="placedFields"
      :signing-steps="signingSteps"
      :pdf-file="uploadedFile"
      :ui-scale="scale"
      @confirm="handleSaveTemplate"
    />

    <!-- ─── Modals ─── -->
    <template-field-create-modal
      v-model="isCreateFieldModalOpen"
      @field-created="handleFieldCreated"
    />

    <template-field-create-modal
      v-model="isEditFieldModalOpen"
      mode="edit"
      :edit-field="editingField"
      @field-updated="handleFieldUpdated"
      @field-deleted="handleFieldDeleted"
    />
  </div>
</template>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
