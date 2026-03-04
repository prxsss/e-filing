<script setup>
definePageMeta({
  title: 'createTemplate',
});

const router = useRouter();
const toast = useToast();
const hasChanges = ref(false);
const isSaving = ref(false);
const isPreviewing = ref(false);
const isPreviewOpen = ref(false);
const previewBlobUrl = ref(null);
const isDragging = ref(false);
const fileInput = ref(null);
const templatePdfRef = ref(null);

const newTemplateName = ref('');
const templateNameError = ref('');
const previewImageUrl = ref(null);
const placedFields = ref([]);
const selectedFieldInstanceId = ref(null); // Store instanceId instead of field object
const scale = ref(1); // Zoom level
// Mock contracts data
// const contracts = ref([
//   { id: 1, name: 'Student Agreement', is_active: true },
//   { id: 2, name: 'Course Registration', is_active: true },
//   { id: 3, name: 'Internship Contract', is_active: true },
// ]);
const selectedContractId = ref(null);
const imageLoaded = ref(false);
const uploadedFile = ref(null);
const fileType = ref(null);
const currentPdfPage = ref(1);
const searchQuery = ref('');

// Security constants
const _MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const _ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  pdf: ['application/pdf'],
};

// Available fields for the template - load from database
const availableFields = ref([]);
const isLoadingFields = ref(false);
const isCreateFieldModalOpen = ref(false);
const isEditFieldModalOpen = ref(false);
const editingField = ref(null);

// Computed property for filtered fields based on search
const filteredFields = computed(() => {
  if (!searchQuery.value)
    return availableFields.value;
  return availableFields.value.filter(f =>
    f.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

// Computed property for selected field
// Returns null if no field selected, otherwise returns the field object with display coordinates
// Display coordinates are calculated from normalized coordinates using current scale
const selectedField = computed(() => {
  if (!selectedFieldInstanceId.value) {
    return null;
  }

  // Find the field from placedFields
  const field = placedFields.value.find(f => f.instanceId === selectedFieldInstanceId.value);
  if (!field) {
    return null;
  }

  // For PDF files with normalized coordinates, calculate display coords
  if (fileType.value === 'pdf' && templatePdfRef.value && field.normalizedX !== undefined) {
    if (typeof templatePdfRef.value.normalizedToDisplay === 'function') {
      const display = templatePdfRef.value.normalizedToDisplay(
        field.normalizedX,
        field.normalizedY,
        field.normalizedWidth,
        field.normalizedHeight,
      );
      return {
        ...field,
        displayX: display.x,
        displayY: display.y,
        displayWidth: display.width,
        displayHeight: display.height,
      };
    }
  }

  // For images or fields without normalized coordinates
  return {
    ...field,
    displayX: field.x,
    displayY: field.y,
    displayWidth: field.width,
    displayHeight: field.height,
  };
});

async function _fetchContracts() {
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

async function fetchTemplateFields() {
  isLoadingFields.value = true;
  try {
    const response = await $fetch('/api/template-fields');

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
    toast.add({
      title: 'ไม่สามารถโหลดข้อมูล Fields ได้',
      description: error.message || 'กรุณาลองใหม่อีกครั้ง',
      color: 'error',
    });
  }
  finally {
    isLoadingFields.value = false;
  }
}

function handleFieldCreated(newField) {
  // เพิ่ม field ใหม่เข้า list
  availableFields.value.push(newField);
  toast.add({
    title: 'เพิ่ม Field สำเร็จ',
    description: `Field "${newField.name}" ถูกเพิ่มแล้ว`,
    color: 'success',
  });
}

function openEditField(field) {
  editingField.value = field;
  isEditFieldModalOpen.value = true;
}

function handleFieldUpdated(updatedField) {
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

function handleFieldDeleted(fieldId) {
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

function triggerFileInput() {
  fileInput.value?.click();
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file)
    processFile(file);
}

function handleFileDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer.files[0];
  if (file)
    processFile(file);
}

// Security: Verify PDF magic bytes
async function verifyPdfMagicBytes(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result);
      // PDF files should start with %PDF-
      const header = String.fromCharCode.apply(null, arr.slice(0, 5));
      resolve(header === '%PDF-');
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 5));
  });
}

async function processFile(file) {
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
  const fileExtension = fileName.split('.').pop();
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

function addFieldToPreview(fieldToAdd) {
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
      // Normalized coordinates will be auto-calculated by component when PDF loads
      // Initial display position: 50 + i*40, 50 with default size 150x40 will be converted to normalized
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

function selectField(field) {
  selectedFieldInstanceId.value = field?.instanceId || null;
}

function onImageLoad() {
  imageLoaded.value = true;
}

function handlePdfPageChange(pageNumber) {
  currentPdfPage.value = pageNumber;
}

function removeSelectedField() {
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

function handleKeyDown(event) {
  if (!selectedFieldInstanceId.value || !templatePdfRef.value)
    return;

  // Mutate the actual field in placedFields (not the computed spread copy)
  const field = placedFields.value.find(f => f.instanceId === selectedFieldInstanceId.value);
  if (!field)
    return;

  const step = event.shiftKey ? 10 : 1;

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      if (field.normalizedY !== undefined) {
        // Get current display position
        const display = templatePdfRef.value.normalizedToDisplay(
          field.normalizedX,
          field.normalizedY,
          field.normalizedWidth,
          field.normalizedHeight,
        );
        // Update display position
        const newY = Math.max(0, display.y - step);
        // Convert back to normalized
        const normalized = templatePdfRef.value.displayToNormalized(
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
        const display = templatePdfRef.value.normalizedToDisplay(
          field.normalizedX,
          field.normalizedY,
          field.normalizedWidth,
          field.normalizedHeight,
        );
        const newY = display.y + step;
        const normalized = templatePdfRef.value.displayToNormalized(
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
        const display = templatePdfRef.value.normalizedToDisplay(
          field.normalizedX,
          field.normalizedY,
          field.normalizedWidth,
          field.normalizedHeight,
        );
        const newX = Math.max(0, display.x - step);
        const normalized = templatePdfRef.value.displayToNormalized(
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
        const display = templatePdfRef.value.normalizedToDisplay(
          field.normalizedX,
          field.normalizedY,
          field.normalizedWidth,
          field.normalizedHeight,
        );
        const newX = display.x + step;
        const normalized = templatePdfRef.value.displayToNormalized(
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

function handleFieldUpdate(data) {
  const idx = placedFields.value.findIndex(
    field => field.instanceId === data.instanceId,
  );
  if (idx > -1) {
    // Updates already contain normalized or pixel coordinates from Properties component
    // No need to convert here
    Object.assign(placedFields.value[idx], data.updates);
  }
}

function handleFieldRemoval(instanceId) {
  const idx = placedFields.value.findIndex(f => f.instanceId === instanceId);
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedFieldInstanceId.value = null;
  }
}

function validateTemplateName() {
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

function handleSaveTemplate() {
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

  // Save template — parent handles the entire save process
  performSave();
}

async function performSave() {
  isSaving.value = true;

  try {
    // Step 1: Upload PDF file
    const formData = new FormData();
    formData.append('file', uploadedFile.value);

    const uploadResponse = await $fetch('/api/upload-template-file', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.success || !uploadResponse.url) {
      throw new Error('Failed to upload PDF file');
    }

    const documentUrl = uploadResponse.url;

    // Step 2: Get PDF natural dimensions from child component
    let docWidth = 0;
    let docHeight = 0;
    if (templatePdfRef.value && templatePdfRef.value.getPdfNaturalDimensions) {
      const dims = templatePdfRef.value.getPdfNaturalDimensions();
      docWidth = Math.round(dims.width || 0);
      docHeight = Math.round(dims.height || 0);
    }

    // Step 3: Normalize field coordinates
    const normalizedFields = placedFields.value.map(field => ({
      id: field.id,
      instanceId: field.instanceId,
      instanceNumber: field.instanceNumber,
      type: field.fieldType || field.type,
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
    }));

    // Step 4: Save template to database
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
    };

    const saveResponse = await $fetch('/api/pdf-templates', {
      method: 'POST',
      body: templatePayload,
    });

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
  catch (error) {
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

function handleTemplateSaved(templateData) {
  isSaving.value = false;

  if (!templateData || templateData.error) {
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: templateData?.message || 'ไม่สามารถบันทึก Template ได้',
      color: 'error',
    });
    return;
  }

  // Navigate to templates list
  toast.add({
    title: 'บันทึกสำเร็จ',
    description: `Template "${templateData?.name || 'ใหม่'}" ถูกบันทึกแล้ว`,
    color: 'success',
  });

  setTimeout(() => {
    router.push('/admin/templates');
  }, 500);
}

function handleBeforeUnload(e) {
  if (hasChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

async function handlePreview() {
  if (!uploadedFile.value) {
    toast.add({ title: 'ข้อผิดพลาด', description: 'กรุณาอัพโหลดไฟล์ PDF ก่อน', color: 'error' });
    return;
  }

  if (fileType.value !== 'pdf') {
    toast.add({ title: 'รองรับเฉพาะ PDF', description: 'Preview ใช้ได้กับไฟล์ PDF เท่านั้น', color: 'warning' });
    return;
  }

  if (placedFields.value.length === 0) {
    toast.add({ title: 'ยังไม่มี Field', description: 'กรุณาวาง field อย่างน้อย 1 field ก่อน Preview', color: 'warning' });
    return;
  }

  isPreviewing.value = true;
  try {
    const naturalDims = templatePdfRef.value?.pdfNaturalDimensions || {};

    const formData = new FormData();
    formData.append('pdfFile', uploadedFile.value);
    formData.append('fields', JSON.stringify(placedFields.value));
    formData.append('templateInfo', JSON.stringify({
      documentWidth: naturalDims.width || 595,
      documentHeight: naturalDims.height || 842,
    }));

    const response = await $fetch('/api/preview-template-pdf', {
      method: 'POST',
      body: formData,
      responseType: 'blob',
    });

    if (previewBlobUrl.value) {
      URL.revokeObjectURL(previewBlobUrl.value);
    }
    previewBlobUrl.value = URL.createObjectURL(response);
    isPreviewOpen.value = true;
  }
  catch (error) {
    toast.add({
      title: 'ไม่สามารถสร้าง Preview ได้',
      description: error?.message || 'กรุณาลองใหม่อีกครั้ง',
      color: 'error',
    });
  }
  finally {
    isPreviewing.value = false;
  }
}

function closePreview() {
  isPreviewOpen.value = false;
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value);
    previewBlobUrl.value = null;
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
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value);
  }
});

watch([newTemplateName, placedFields, uploadedFile], () => {
  hasChanges.value = true;
});

watch(
  selectedFieldInstanceId,
  (newId) => {
    if (!newId)
      return;
    const field = placedFields.value.find(f => f.instanceId === newId);
    if (field) {
      // Ensure required properties exist on the actual placedFields entry
      if (typeof field.label !== 'string')
        field.label = '';
      if (!field.instanceId)
        field.instanceId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
);
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- === TOP HEADER (Toolbar) === -->
    <header class="h-16 flex items-center justify-between px-4 z-20 shadow-sm shrink-0">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="router.back()"
        />

        <!-- Template Name Input -->
        <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold tracking-wider">Template Name</label>
          <input
            v-model="newTemplateName"
            type="text"
            :class="templateNameError ? 'border border-red-500 bg-red-50' : 'border bg-transparent'"
            class="p-2 font-semibold focus:ring-1 focus:ring-red-500 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-2 transition-colors"
            placeholder="Enter template name..."
            @input="validateTemplateName"
          >
          <div v-if="templateNameError" class="flex items-center gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-semibold">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0" />
            {{ templateNameError }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <UButton
          :loading="isPreviewing"
          :disabled="!uploadedFile || fileType !== 'pdf' || placedFields.length === 0"
          icon="i-heroicons-eye"
          color="primary"
          variant="soft"
          label="Preview"
          size="xl"
          class="px-6 font-bold"
          @click="handlePreview"
        />
        <UButton
          :loading="isSaving"
          icon="i-heroicons-check"
          color="neutral"
          label="Save Template"
          size="xl"
          class="px-6 font-bold"
          @click="handleSaveTemplate"
        />
      </div>
    </header>

    <!-- === WORKSPACE === -->
    <div class="flex-1 flex overflow-hidden">
      <!-- [LEFT SIDEBAR] Tools & Assets -->
      <aside class="w-72  flex flex-col shrink-0 z-10">
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
              <div class=" w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white group-hover:text-primary-500 transition-colors text-gray-400">
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
      <section class="flex-1 relative overflow-hidden flex flex-col bg-gray-50">
        <!-- Field Toolbar (Shows when field is selected) -->
        <field-toolbar
          v-if="selectedField && uploadedFile"
          :selected-field="selectedField"
          :pdf-ref="fileType === 'pdf' ? templatePdfRef : undefined"
          :scale="scale"
          @field-updated="handleFieldUpdate"
          @field-removed="handleFieldRemoval"
        />

        <!-- Toolbar (Zoom etc.) -->
        <div class="h-10 border-b px-4 flex items-center justify-between shrink-0 bg-white">
          <div class="text-xs">
            <span v-if="!uploadedFile">ยังไม่มีไฟล์</span>
            <span v-else-if="fileType === 'pdf'">เอกสาร PDF - หน้า {{ currentPdfPage }}</span>
            <span v-else>เอกสารรูปภาพ</span>
          </div>
          <div class="flex items-center gap-2">
            <UButton icon="i-heroicons-minus" size="xs" color="neutral" variant="ghost" @click="scale = Math.max(0.5, scale - 0.1)" />
            <span class="text-xs font-mono w-12 text-center">{{ Math.round(scale * 100) }}%</span>
            <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click="scale = Math.min(2, scale + 0.1)" />
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
            :selected-contract-id="selectedContractId"
            :original-file="uploadedFile"
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
            :selected-contract-id="selectedContractId"
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

    <!-- PDF Preview Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isPreviewOpen"
          class="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
        >
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-3 bg-white shadow shrink-0">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-eye" class="w-5 h-5 text-primary-600" />
              <h2 class="font-bold text-lg">
                Preview: {{ newTemplateName || 'Template' }}
              </h2>
              <UBadge color="primary" variant="subtle" size="sm">
                ตัวอย่างข้อมูล
              </UBadge>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                icon="i-heroicons-arrow-top-right-on-square"
                color="neutral"
                variant="soft"
                label="เปิดใน Tab ใหม่"
                size="sm"
                :href="previewBlobUrl"
                target="_blank"
                as="a"
              />
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="closePreview"
              />
            </div>
          </div>

          <!-- PDF Iframe -->
          <div class="flex-1 overflow-hidden p-4">
            <iframe
              v-if="previewBlobUrl"
              :src="previewBlobUrl"
              class="w-full h-full rounded-lg shadow-lg bg-white"
              style="border: none;"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
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
