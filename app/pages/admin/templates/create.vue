<script setup lang="ts">
import type { FieldInstance, FileTypeValue, PdfRef, SigningStep, WizardStep } from '~/types/template';

type Field = any;

definePageMeta({
  title: 'createTemplate',
});

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const hasChanges = ref<boolean>(false);
const isSaving = ref<boolean>(false);
const isDragging = ref<boolean>(false);
const fileInput = ref<HTMLInputElement | null>(null);
const templatePdfRef = ref<PdfRef | null>(null);

const newTemplateName = ref<string>('');
const templateNameError = ref<string>('');
const previewImageUrl = ref<string | null>(null);
const placedFields = ref<FieldInstance[]>([]);
const selectedFieldInstanceId = ref<string | null>(null); // Store instanceId instead of field object
const scale = ref<number>(1); // Zoom level
const selectedContractId = ref<string | number | null>(null);
const imageLoaded = ref<boolean>(false);
const uploadedFile = ref<File | null>(null);
const fileType = ref<FileTypeValue>(null);
const currentPdfPage = ref<number>(1);
const searchQuery = ref<string>('');

// === WIZARD STATE ===
const currentWizardStep = ref<WizardStep>(1);
const signingSteps = ref<SigningStep[]>([]);

// Wizard step definitions
const wizardSteps = computed(() => [
  { step: 1 as WizardStep, label: t('placeFields'), icon: 'i-heroicons-document-text' },
  { step: 2 as WizardStep, label: t('signingFlow'), icon: 'i-heroicons-queue-list' },
  { step: 3 as WizardStep, label: t('reviewAndSave'), icon: 'i-heroicons-clipboard-document-check' },
]);

// Validation for proceeding from step 1 to step 2
const canProceedToStep2 = computed<boolean>(() => {
  const name = newTemplateName.value.trim();
  return !!(name && name.length >= 3 && name.length <= 100 && uploadedFile.value && placedFields.value.length > 0);
});

// Validation for proceeding from step 2 to step 3
const canProceedToStep3 = computed<boolean>(() => {
  if (signingSteps.value.length === 0)
    return false;
  const allAssigned = placedFields.value.every(f => f.signerStepId);
  return allAssigned;
});

// Navigate wizard
function goToStep(step: WizardStep): void {
  if (step === 2 && !canProceedToStep2.value) {
    if (!newTemplateName.value.trim() || newTemplateName.value.trim().length < 3) {
      toast.add({ title: 'กรุณาป้อนชื่อเทมเพลต (อย่างน้อย 3 ตัวอักษร)', color: 'error' });
    }
    else if (!uploadedFile.value) {
      toast.add({ title: 'กรุณาอัปโหลดไฟล์', color: 'error' });
    }
    else if (placedFields.value.length === 0) {
      toast.add({ title: 'กรุณาเพิ่ม field อย่างน้อย 1 field', color: 'error' });
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

// Handle signing steps update from editor
function handleSigningStepsUpdate(steps: SigningStep[]): void {
  signingSteps.value = steps;
}

// Handle placed fields update from editor (with signerStepId changes)
function handlePlacedFieldsUpdate(fields: FieldInstance[]): void {
  placedFields.value = fields;
}

// Available fields for the template - load from database
const availableFields = ref<Field[]>([]);
const isLoadingFields = ref<boolean>(false);
const isCreateFieldModalOpen = ref<boolean>(false);
const isEditFieldModalOpen = ref<boolean>(false);
const editingField = ref<Field | null>(null);

// Computed property for filtered fields based on search
const filteredFields = computed<Field[]>(() => {
  if (!searchQuery.value)
    return availableFields.value;
  return availableFields.value.filter(f =>
    f.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

// Computed property for selected field
// Returns null if no field selected, otherwise returns the field object with display coordinates
// Display coordinates are calculated from normalized coordinates using current scale
const selectedField = computed<FieldInstance | null>(() => {
  if (!selectedFieldInstanceId.value) {
    return null;
  }

  // Find the field from placedFields
  const field = placedFields.value.find(f => f.instanceId === selectedFieldInstanceId.value);
  if (!field) {
    return null;
  }

  // For PDF files with normalized coordinates, calculate display coords
  if (fileType.value === 'pdf' && templatePdfRef.value && field.normalizedX !== undefined && field.normalizedY !== undefined) {
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

  // For images or fields without normalized coordinates
  return {
    ...field,
    displayX: field.x,
    displayY: field.y,
    displayWidth: field.width,
    displayHeight: field.height,
  } as FieldInstance;
});

async function _fetchContracts(): Promise<void> {
  // Temporarily disabled - using mock data instead
  console.warn('Using mock contracts data - database fetch disabled');

  /*
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("is_active", true);
    if (!error) {
      contracts.value = data || [];
    }
  } catch (err) {
    console.error(err);
  }
  */
}

async function fetchTemplateFields(): Promise<void> {
  isLoadingFields.value = true;
  try {
    const response = await $fetch<{
      success: boolean;
      data?: Field[];
      error?: string;
    }>('/api/template-fields');

    if (response.success && response.data) {
      // ข้อมูลจาก API พร้อมใช้งานแล้ว ไม่ต้อง map
      availableFields.value = response.data;
    }
    else {
      console.warn('API returned no data or error:', response);
      toast.add({
        title: 'ไม่พบข้อมูล Fields',
        description: response.error || 'กรุณาเพิ่มข้อมูลในตาราง request_template_fields',
        color: 'warning',
      });
    }
  }
  catch (error) {
    console.error('Error fetching template fields:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.add({
      title: 'ไม่สามารถโหลดข้อมูล Fields ได้',
      description: errorMessage || 'กรุณาลองใหม่อีกครั้ง',
      color: 'error',
    });
  }
  finally {
    isLoadingFields.value = false;
  }
}

function handleFieldCreated(newField: Field): void {
  // เพิ่ม field ใหม่เข้า list
  availableFields.value.push(newField);
  toast.add({
    title: 'เพิ่ม Field สำเร็จ',
    description: `Field "${newField.name}" ถูกเพิ่มแล้ว`,
    color: 'success',
  });
}

function openEditField(field: Field): void {
  editingField.value = field;
  isEditFieldModalOpen.value = true;
}

function handleFieldUpdated(updatedField: Field): void {
  // อัพเดท field ใน list
  const index = availableFields.value.findIndex(f => f.id === updatedField.id);
  if (index !== -1) {
    availableFields.value[index] = updatedField;
  }
  toast.add({
    title: 'อัพเดท Field สำเร็จ',
    description: `Field "${updatedField.name}" ถูกอัพเดทแล้ว`,
    color: 'success',
  });
}

function handleFieldDeleted(fieldId: number | string): void {
  // ลบ field จาก list
  const index = availableFields.value.findIndex(f => f.id === fieldId);
  if (index !== -1) {
    availableFields.value.splice(index, 1);
  }
  toast.add({
    title: 'ลบ Field สำเร็จ',
    color: 'success',
  });
}

function triggerFileInput(): void {
  fileInput.value?.click();
}

function handleImageUpload(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file)
    processFile(file);
}

function handleFileDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file)
    processFile(file);
}

// Security: Validate template name format
// function validateTemplateNameFormat(name) {
//   if (!name || typeof name !== 'string') {
//     return { isValid: false, message: 'กรุณากรอกชื่อ template' };
//   }

//   const trimmedName = name.trim();

//   if (trimmedName.length < 3) {
//     return { isValid: false, message: 'ชื่อ template ต้องมีอย่างน้อย 3 ตัวอักษร' };
//   }

//   if (trimmedName.length > 100) {
//     return { isValid: false, message: 'ชื่อ template ต้องไม่เกิน 100 ตัวอักษร' };
//   }

//   // Allow Thai, English, numbers, spaces, hyphens, underscores
//   const validPattern = /^[\u0E00-\u0E7F\w\s\-]+$/;
//   if (!validPattern.test(trimmedName)) {
//     return { isValid: false, message: 'ชื่อ template มีอักขระที่ไม่อนุญาต' };
//   }

//   // Prevent path traversal
//   if (trimmedName.includes('..') || trimmedName.includes('/') || trimmedName.includes('\\')) {
//     return { isValid: false, message: 'ชื่อ template มีอักขระที่ไม่อนุญาต' };
//   }

//   return { isValid: true, message: '' };
// }

// Security: Verify PDF magic bytes
async function verifyPdfMagicBytes(file: File): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>): void => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer);
      // PDF files should start with %PDF-
      const header = String.fromCharCode(...Array.from(arr.slice(0, 5)));
      resolve(header === '%PDF-');
    };
    reader.onerror = (): void => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 5));
  });
}

async function processFile(file: File): Promise<void> {
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.add({ title: 'ไฟล์มีขนาดใหญ่เกินไป', description: 'ขนาดสูงสุด 50MB', color: 'error' });
    return;
  }

  if (file.size === 0) {
    toast.add({ title: 'ไฟล์เสียหาย', color: 'error' });
    return;
  }

  const fileName = file.name.toLowerCase();
  const fileTypeFromMime = file.type.toLowerCase();
  const fileExtension = (fileName.split('.').pop() || '').toLowerCase();
  const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const validExtensions = [...validImageExtensions, 'pdf'];

  if (!validExtensions.includes(fileExtension)) {
    toast.add({ title: 'ไฟล์ไม่ถูกต้อง', description: 'รองรับเฉพาะ PDF, JPG, PNG, GIF, WebP, BMP', color: 'error' });
    return;
  }

  // Security: Verify PDF magic bytes for PDF files
  if (fileTypeFromMime === 'application/pdf' || fileExtension === 'pdf') {
    const isValidPdf = await verifyPdfMagicBytes(file);
    if (!isValidPdf) {
      toast.add({ title: 'ไฟล์ PDF ไม่ถูกต้อง', description: 'ไฟล์อาจเสียหายหรือไม่ใช่ PDF จริง', color: 'error' });
      return;
    }
  }

  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
    previewImageUrl.value = null;
  }

  placedFields.value = [];
  selectedFieldInstanceId.value = null;
  currentPdfPage.value = 1;
  uploadedFile.value = file;

  if (
    fileTypeFromMime.startsWith('image/')
    || validImageExtensions.includes(fileExtension)
  ) {
    fileType.value = 'image';
    previewImageUrl.value = URL.createObjectURL(file);
  }
  else if (
    fileTypeFromMime === 'application/pdf'
    || fileExtension === 'pdf'
  ) {
    fileType.value = 'pdf';
  }
}

function addFieldToPreview(fieldToAdd: Field): void {
  if (!fieldToAdd)
    return;

  if (!uploadedFile.value) {
    toast.add({ title: 'กรุณาอัปโหลดไฟล์เอกสารก่อนเริ่มวาง Field', color: 'error' });
    return;
  }

  const amount = fieldToAdd.amount || 1;
  const groupId = amount > 1 ? `group_${fieldToAdd.id}_${Date.now()}` : null;

  for (let i = 0; i < amount; i++) {
    const newFieldInstance = {
      ...fieldToAdd,
      instanceId: `field_${fieldToAdd.id}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      instanceNumber: i + 1,
      groupId,
      isGrouped: amount > 1,
      groupSize: amount,
      groupPosition: i,
      // Initial display position: offset each field by 40px diagonally
      // This ensures fields don't stack on top of each other
      x: 50 + (i * 40),
      y: 50 + (i * 40),
      width: 150,
      height: 40,
      // Normalized coordinates will be auto-calculated by component when PDF loads
      label: fieldToAdd.name === 'Check Mark' ? '' : fieldToAdd.label,
      pageNumber: currentPdfPage.value,
      fontSize: fieldToAdd.fontSize || 14,
      fontFamily: fieldToAdd.font || 'Arial',
    };

    placedFields.value.push(newFieldInstance);
    if (i === amount - 1) {
      selectedFieldInstanceId.value = newFieldInstance.instanceId;
    }
  }
}

function selectField(field: FieldInstance | null): void {
  selectedFieldInstanceId.value = field?.instanceId || null;
}

function onImageLoad(): void {
  imageLoaded.value = true;
}

function handlePdfPageChange(pageNumber: number): void {
  currentPdfPage.value = pageNumber;
}

function removeSelectedField(): void {
  if (!selectedFieldInstanceId.value)
    return;
  const idx = placedFields.value.findIndex(
    f => f.instanceId === selectedFieldInstanceId.value,
  );
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedFieldInstanceId.value = null;
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!selectedFieldInstanceId.value || !templatePdfRef.value)
    return;

  const field = selectedField.value;
  if (!field)
    return;

  const step = event.shiftKey ? 10 : 1;

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      if (field.normalizedY !== undefined) {
        // Get current display position
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX || 0,
          field.normalizedY,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        // Update display position
        const newY = Math.max(0, display.y - step);
        // Convert back to normalized
        const normalized = templatePdfRef.value!.displayToNormalized(
          display.x,
          newY,
          display.width,
          display.height,
        );
        field.normalizedY = normalized.y;
      }
      break;
    case 'ArrowDown':
      event.preventDefault();
      if (field.normalizedY !== undefined) {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX || 0,
          field.normalizedY,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newY = display.y + step;
        const normalized = templatePdfRef.value!.displayToNormalized(
          display.x,
          newY,
          display.width,
          display.height,
        );
        field.normalizedY = normalized.y;
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (field.normalizedX !== undefined) {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX,
          field.normalizedY || 0,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newX = Math.max(0, display.x - step);
        const normalized = templatePdfRef.value!.displayToNormalized(
          newX,
          display.y,
          display.width,
          display.height,
        );
        field.normalizedX = normalized.x;
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (field.normalizedX !== undefined) {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX,
          field.normalizedY || 0,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newX = display.x + step;
        const normalized = templatePdfRef.value!.displayToNormalized(
          newX,
          display.y,
          display.width,
          display.height,
        );
        field.normalizedX = normalized.x;
      }
      break;
    case 'Delete':
      event.preventDefault();
      removeSelectedField();
      break;
  }
}

function handleFieldUpdate(data: { instanceId: string; updates: any }): void {
  const idx = placedFields.value.findIndex(
    field => field.instanceId === data.instanceId,
  );
  if (idx > -1 && placedFields.value[idx]) {
    // Updates already contain normalized or pixel coordinates from Properties component
    // No need to convert here
    Object.assign(placedFields.value[idx]!, data.updates);
  }
}

function handleFieldRemoval(instanceId: string): void {
  const idx = placedFields.value.findIndex(f => f.instanceId === instanceId);
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedFieldInstanceId.value = null;
  }
}

function validateTemplateName(): boolean {
  const name = newTemplateName.value.trim();

  if (!name) {
    templateNameError.value = 'กรุณาป้อนชื่อเทมเพลต';
    return false;
  }

  if (name.length < 3) {
    templateNameError.value = 'ชื่อเทมเพลตต้องมีอย่างน้อย 3 ตัวอักษร';
    return false;
  }

  if (name.length > 100) {
    templateNameError.value = 'ชื่อเทมเพลตต้องไม่เกิน 100 ตัวอักษร';
    return false;
  }

  templateNameError.value = '';
  return true;
}

function handleSaveTemplate(): void {
  if (!validateTemplateName())
    return;

  if (!uploadedFile.value) {
    toast.add({
      title: 'กรุณาอัปโหลดไฟล์',
      description: 'อัปโหลดไฟล์ PDF ก่อนบันทึกเทมเพลต',
      color: 'error',
    });
    return;
  }

  if (placedFields.value.length === 0) {
    toast.add({
      title: 'ข้อผิดพลาด',
      description: 'กรุณาเพิ่ม field อย่างน้อย 1 field',
      color: 'error',
    });
    return;
  }

  if (signingSteps.value.length === 0) {
    toast.add({ title: t('signingStepRequired'), color: 'error' });
    return;
  }

  if (!placedFields.value.every(f => f.signerStepId)) {
    toast.add({ title: t('allFieldsMustBeAssigned'), color: 'error' });
    return;
  }

  // Save template with signing flow — parent handles the entire save
  performSave();
}

async function performSave(): Promise<void> {
  isSaving.value = true;

  try {
    // Step 1: Upload PDF file
    const formData = new FormData();
    formData.append('file', uploadedFile.value!);

    const uploadResponse = await $fetch('/api/upload-template-file', {
      method: 'POST',
      body: formData,
    }) as any;

    if (!uploadResponse.success || !uploadResponse.url) {
      throw new Error('Failed to upload PDF file');
    }

    const documentUrl = uploadResponse.url;

    // Step 2: Get PDF natural dimensions from child component
    let docWidth = 0;
    let docHeight = 0;
    if (templatePdfRef.value && (templatePdfRef.value as any).getPdfNaturalDimensions) {
      const dims = (templatePdfRef.value as any).getPdfNaturalDimensions();
      docWidth = Math.round(dims.width || 0);
      docHeight = Math.round(dims.height || 0);
    }

    // Step 3: Normalize field coordinates (fields already have normalized coords from the child)
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
    const templatePayload = {
      name: newTemplateName.value.trim(),
      description: null,
      category: null,
      version: '1.0.0',
      isActive: true,
      createdBy: null,
      documentUrl,
      documentWidth: docWidth,
      documentHeight: docHeight,
      placedFieldsData: normalizedFields,
      signingFlowData,
    };

    const saveResponse = await $fetch('/api/pdf-templates', {
      method: 'POST',
      body: templatePayload,
    }) as any;

    if (!saveResponse.success || !saveResponse.data) {
      throw new Error('Failed to save template to database');
    }

    toast.add({
      title: 'บันทึกสำเร็จ',
      description: `Template "${newTemplateName.value.trim()}" ถูกบันทึกแล้ว`,
      color: 'success',
    });

    hasChanges.value = false;

    setTimeout(() => {
      router.push('/admin/templates');
    }, 500);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Save template error:', error);
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: errorMessage || 'ไม่สามารถบันทึก Template ได้',
      color: 'error',
    });
  }
  finally {
    isSaving.value = false;
  }
}

function handleTemplateSaved(templateData: any): void {
  isSaving.value = false;

  if (!templateData || templateData.error) {
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: templateData?.message || 'ไม่สามารถบันทึก Template ได้',
      color: 'error',
    });
    return;
  }

  toast.add({
    title: 'บันทึกสำเร็จ',
    description: 'เทมเพลตถูกบันทึกแล้ว',
    color: 'success',
  });

  setTimeout(() => {
    router.push('/admin/templates');
  }, 500);
}

function handleBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(async () => {
  // await fetchContracts(); // Temporarily disabled - using mock data
  await fetchTemplateFields();
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
  }
});

watch([newTemplateName, placedFields, uploadedFile], (): void => {
  hasChanges.value = true;
});

watch(
  selectedField,
  (newField: FieldInstance | null): void => {
    if (newField && typeof newField === 'object') {
      // Ensure required properties exist
      if (typeof newField.label !== 'string')
        newField.label = '';
      if (!newField.instanceId)
        newField.instanceId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  { deep: true },
);
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- === TOP HEADER (Toolbar with Step Indicator) === -->
    <header class="h-16 flex items-center justify-between px-4 z-20 shadow-sm shrink-0">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="currentWizardStep > 1 ? goPrevious() : router.back()"
        />

        <!-- Template Name Input (visible across all steps) -->
        <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold tracking-wider">Template Name</label>
          <input
            v-model="newTemplateName"
            type="text"
            :class="templateNameError ? 'border border-red-500 bg-red-50' : 'border bg-transparent'"
            class="p-2 font-semibold focus:ring-1 focus:ring-red-500 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-2 transition-colors"
            placeholder="Enter template name..."
            :disabled="currentWizardStep > 1"
            @input="validateTemplateName"
          >
          <div v-if="templateNameError && currentWizardStep === 1" class="flex items-center gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-semibold">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0" />
            {{ templateNameError }}
          </div>
        </div>

        <div class="h-6 w-px bg-gray-200 mx-1 hidden md:block" />

        <!-- Contract Selector -->
        <!-- <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contract</label>
          <USelectMenu
            v-model="selectedContractId"
            :options="contracts"
            value-attribute="id"
            option-attribute="name"
            placeholder="Choose Contract"
            size="sm"
            class="w-48"
          />
        </div> -->
      </div>

      <!-- Step Indicator (center) -->
      <div class="flex items-center gap-1">
        <template v-for="(ws, idx) in wizardSteps" :key="ws.step">
          <!-- Step circle + label -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            :class="{
              'bg-primary-500 text-white': currentWizardStep === ws.step,
              'bg-primary-100 text-primary-700': currentWizardStep > ws.step,
              'bg-gray-100 text-gray-400': currentWizardStep < ws.step,
            }"
            @click="ws.step <= currentWizardStep ? goToStep(ws.step) : undefined"
          >
            <UIcon :name="ws.icon" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ ws.label }}</span>
          </button>
          <!-- Connector -->
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
          icon="i-heroicons-check"
          color="primary"
          :label="t('saveTemplate')"
          size="xl"
          class="px-6 font-bold"
          @click="handleSaveTemplate"
        />
      </div>
    </header>

    <!-- === STEP 1: Upload & Place Fields (existing functionality) === -->
    <div v-if="currentWizardStep === 1" class="flex-1 flex overflow-hidden">
      <!-- [LEFT SIDEBAR] Tools & Assets -->
      <aside class="w-72 flex flex-col shrink-0 z-10">
        <!-- Tabs / Sections -->
        <div class="p-4 border-b">
          <h3 class="font-bold flex items-center gap-2">
            <UIcon name="i-heroicons-swatch" class="text-primary-500" />
            เครื่องมือ (Tools)
          </h3>
        </div>

        <div class="overflow-y-auto flex-1 p-4 space-y-6">
          <!-- Upload Section -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-semibold uppercase">เอกสารตั้นต้นฉบับ</label>
              <UBadge v-if="uploadedFile" color="success" variant="subtle" size="xs">
                Uploaded
              </UBadge>
            </div>

            <div
              v-if="!uploadedFile"
              class="border-2 border-dashed rounded-xl p-6 text-center hover:bg-gray-50 hover:border-primary-400 transition-all cursor-pointer group"
              :class="{ 'border-primary-500 bg-primary-50': isDragging }"
              @click="triggerFileInput"
              @drop.prevent="handleFileDrop"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
            >
              <div class="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white group-hover:text-primary-500 transition-colors text-gray-400">
                <UIcon name="i-heroicons-cloud-arrow-up" class="w-6 h-6" />
              </div>
              <p class="text-sm font-medium">
                คลิกเพื่ออัปโหลด
              </p>
              <p class="text-xs mt-1">
                PDF หรือ รูปภาพ (JPG, PNG)
              </p>
            </div>

            <!-- Uploaded State -->
            <div v-else class="rounded-lg p-3 flex items-center gap-3">
              <div class="w-10 h-10 bg-white border border-gray-200 rounded flex items-center justify-center text-gray-400 shrink-0">
                <UIcon :name="fileType === 'pdf' ? 'i-heroicons-document-text' : 'i-heroicons-photo'" class="w-6 h-6" />
              </div>
              <div class="overflow-hidden">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ uploadedFile.name }}
                </p>
                <button class="text-xs text-primary-600 hover:underline" @click="triggerFileInput">
                  เปลี่ยนไฟล์
                </button>
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*,application/pdf"
              class="hidden"
              @change="handleImageUpload"
            >
          </div>

          <!-- Fields Section -->
          <div>
            <div class="flex justify-between items-center mb-3">
              <label class="text-xs font-semibold text-gray-500 uppercase">ข้อมูลที่เติมได้</label>
              <div class="flex items-center gap-2">
                <UBadge v-if="!isLoadingFields && availableFields.length > 0" color="primary" variant="subtle" size="xs">
                  {{ availableFields.length }} fields
                </UBadge>
                <UButton
                  icon="i-heroicons-plus"
                  size="xs"
                  color="primary"
                  variant="soft"
                  title="เพิ่ม Field ใหม่"
                  @click="isCreateFieldModalOpen = true"
                />
              </div>
            </div>

            <!-- Search -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="ค้นหา..."
              size="sm"
              class="mb-3 w-full"
              :disabled="isLoadingFields"
            />

            <!-- Loading State -->
            <div v-if="isLoadingFields" class="space-y-2">
              <div v-for="i in 3" :key="i" class="w-full h-16 rounded-lg bg-gray-100 animate-pulse" />
            </div>

            <!-- Empty State -->
            <div v-else-if="!isLoadingFields && availableFields.length === 0" class="text-center py-8">
              <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p class="text-sm text-gray-500">
                ไม่พบ Fields
              </p>
              <p class="text-xs text-gray-400 mt-1">
                กรุณาเพิ่ม Fields ในฐานข้อมูล
              </p>
            </div>

            <!-- Field List -->
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
                  title="แก้ไข"
                  @click.stop="openEditField(field)"
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- [CENTER] Canvas Area -->
      <section class="flex-1 relative overflow-hidden flex flex-col bg-gray-100">
        <!-- Canvas toolbar (page info | centered field toolbar | zoom) -->
        <div class="h-11 bg-white border-b border-gray-200 px-4 flex items-center shrink-0">
          <!-- Left: page info -->
          <div class="flex items-center shrink-0 w-20">
            <span class="text-xs text-gray-400 font-medium">
              <template v-if="!uploadedFile">ยังไม่มีไฟล์</template>
              <template v-else-if="fileType === 'pdf'">หน้า {{ currentPdfPage }}</template>
              <template v-else>รูปภาพ</template>
            </span>
          </div>

          <!-- Center: field toolbar -->
          <div class="flex-1 flex justify-center">
            <field-toolbar
              v-if="selectedField && uploadedFile"
              :selected-field="selectedField"
              :pdf-ref="fileType === 'pdf' ? templatePdfRef : undefined"
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

        <!-- Scrollable Canvas Container -->
        <div class="flex-1 overflow-auto p-8 flex justify-center items-start">
          <template-image-create
            v-if="fileType === 'image' && previewImageUrl"
            :preview-image-url="previewImageUrl"
            :placed-fields="placedFields"
            :selected-field="selectedField || undefined"
            :new-template-name="newTemplateName"
            :selected-contract-id="(selectedContractId as string | number | undefined)"
            :original-file="(uploadedFile as File | undefined)"
            @field-selected="selectField"
            @field-updated="handleFieldUpdate"
            @image-loaded="onImageLoad"
            @template-saved="handleTemplateSaved"
          />

          <template-pdf-create
            v-else-if="fileType === 'pdf' && uploadedFile"
            ref="templatePdfRef"
            :pdf-file="uploadedFile"
            :placed-fields="placedFields"
            :selected-field="selectedField || undefined"
            :new-template-name="newTemplateName"
            :selected-contract-id="(selectedContractId as string | number | undefined)"
            :ui-scale="scale"
            @field-selected="selectField"
            @field-updated="handleFieldUpdate"
            @field-removed="handleFieldRemoval"
            @pdf-loaded="onImageLoad"
            @template-saved="handleTemplateSaved"
            @current-page-changed="handlePdfPageChange"
          />

          <div v-else class="bg-white shadow-lg border border-gray-200 rounded-lg" style="width: 595px; min-height: 842px;">
            <div class="flex flex-col items-center justify-center h-full py-20 text-gray-300">
              <UIcon name="i-heroicons-document" class="w-16 h-16 mb-2" />
              <p class="text-sm">
                พื้นที่แสดงเอกสาร
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- === STEP 2: Signing Flow === -->
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

    <!-- === STEP 3: Review & Save === -->
    <template-review-summary
      v-else-if="currentWizardStep === 3"
      :template-name="newTemplateName"
      :uploaded-file="uploadedFile"
      :file-type="fileType"
      :placed-fields="placedFields"
      :signing-steps="signingSteps"
      :pdf-file="uploadedFile"
      :ui-scale="scale"
      @confirm="handleSaveTemplate"
    />

    <!-- Field Create Modal -->
    <template-field-create-modal
      v-model="isCreateFieldModalOpen"
      @field-created="handleFieldCreated"
    />

    <!-- Field Edit Modal -->
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
/* Custom styling for canvas if needed */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
