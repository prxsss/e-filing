<script setup lang="ts">
import type { FieldInstance, FileTypeValue, PdfRef } from '~/types/template';

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

// File / PDF
const uploadedFile = ref<File | null>(null);
const pdfBytes = ref<Uint8Array | null>(null);
const originalPdfBytes = ref<Uint8Array | null>(null);
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
const templatePdfEditRef = ref<PdfRef | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref<boolean>(false);

// Zoom
const scale = ref<number>(1);

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

  if (templatePdfEditRef.value && field.normalizedX !== undefined && field.normalizedY !== undefined) {
    if (typeof templatePdfEditRef.value.normalizedToDisplay === 'function') {
      const display = templatePdfEditRef.value.normalizedToDisplay(
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      pdfBytes.value = bytes;
      originalPdfBytes.value = bytes;
      fileType.value = 'pdf';
    }

    if (Array.isArray(result.data.placedFieldsData)) {
      placedFields.value = result.data.placedFieldsData as FieldInstance[];
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
  placedFields.value = [];
  selectedFieldInstanceId.value = null;
  currentPdfPage.value = 1;

  if (ext === 'pdf') {
    fileType.value = 'pdf';
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfBytes.value = bytes;
    originalPdfBytes.value = bytes;
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
  if (templatePdfEditRef.value?.saveTemplate) {
    isSaving.value = true;
    templatePdfEditRef.value.saveTemplate();
  }
}

function handleTemplateSaved(data: any): void {
  isSaving.value = false;
  if (!data || data.error) {
    toast.add({ title: 'Save Failed', description: data?.message || 'Unable to save template', color: 'error' });
    return;
  }
  toast.add({ title: 'Saved', description: `Template "${templateName.value}" updated successfully`, color: 'success' });
  setTimeout(() => router.push('/admin/templates'), 500);
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

function handleKeyDown(event: KeyboardEvent): void {
  if (!selectedFieldInstanceId.value || !templatePdfEditRef.value)
    return;
  const field = selectedField.value;
  if (!field)
    return;

  const step = event.shiftKey ? 10 : 1;

  const moveField = (axis: 'x' | 'y', delta: number) => {
    if (field.normalizedX === undefined)
      return;
    const display = templatePdfEditRef.value!.normalizedToDisplay(
      field.normalizedX || 0,
      field.normalizedY || 0,
      field.normalizedWidth || 0,
      field.normalizedHeight || 0,
    );
    const newX = axis === 'x' ? Math.max(0, display.x + delta) : display.x;
    const newY = axis === 'y' ? Math.max(0, display.y + delta) : display.y;
    const normalized = templatePdfEditRef.value!.displayToNormalized(newX, newY, display.width, display.height);
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

onMounted(async () => {
  await Promise.all([fetchTemplate(), fetchTemplateFields()]);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ═══════════════ TOP HEADER ═══════════════ -->
    <header class="h-16 flex items-center justify-between px-4 z-20 shadow-sm shrink-0 bg-white border-b border-gray-200">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="router.back()"
        />

        <!-- Template Name -->
        <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">Template Name</label>
          <input
            v-model="templateName"
            type="text"
            :class="templateNameError ? 'border border-red-500 bg-red-50' : 'border bg-transparent'"
            class="p-2 font-semibold focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-2 transition-colors"
            placeholder="Enter template name..."
            :disabled="isLoading"
            @input="validateTemplateName"
          >
          <div v-if="templateNameError" class="flex items-center gap-2 mt-1 text-red-600 text-xs font-semibold">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0" />
            {{ templateNameError }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <UButton
          :loading="isSaving"
          :disabled="isLoading"
          icon="i-heroicons-check"
          color="neutral"
          label="Save Changes"
          size="xl"
          class="px-6 font-bold"
          @click="handleSaveTemplate"
        />
      </div>
    </header>

    <!-- ═══════════════ WORKSPACE ═══════════════ -->
    <div class="flex-1 flex overflow-hidden">
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
        <!-- Canvas toolbar (zoom + page info) -->
        <div class="h-10 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0">
          <div class="text-xs text-gray-500">
            <span v-if="isLoading">Loading template...</span>
            <span v-else-if="!uploadedFile">No file loaded</span>
            <span v-else>PDF — Page {{ currentPdfPage }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UButton icon="i-heroicons-minus" size="xs" color="neutral" variant="ghost" :disabled="scale <= 0.5" @click="scale = Math.max(0.5, scale - 0.1)" />
            <span class="text-xs font-mono w-12 text-center">{{ Math.round(scale * 100) }}%</span>
            <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" :disabled="scale >= 2" @click="scale = Math.min(2, scale + 0.1)" />
            <UButton size="xs" color="neutral" variant="ghost" @click="scale = 1">
              Reset
            </UButton>
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
          <template-pdf-edit
            v-else-if="pdfBytes && uploadedFile"
            ref="templatePdfEditRef"
            :pdf-bytes="pdfBytes"
            :original-pdf-bytes="originalPdfBytes"
            :placed-fields="placedFields"
            :selected-field="selectedField"
            :template-name="templateName"
            :template-id="templateId"
            :original-composite-url="templateData?.compositeImageUrl"
            @field-selected="selectField"
            @field-updated="handleFieldUpdate"
            @field-removed="handleFieldRemoval"
            @pdf-loaded="() => {}"
            @template-saved="handleTemplateSaved"
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
