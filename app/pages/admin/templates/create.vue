<script setup>
definePageMeta({
  pageTitle: 'createTemplate',
});

// const supabase = useSupabaseClient(); // Temporarily disabled
const router = useRouter();
const hasChanges = ref(false);
const isSaving = ref(false);
const isDragging = ref(false);
const fileInput = ref(null);

const newTemplateName = ref('');
const templateNameError = ref('');
const previewImageUrl = ref(null);
const placedFields = ref([]);
const selectedField = ref(null);
// Mock contracts data
const contracts = ref([
  { id: 1, name: 'Student Agreement', is_active: true },
  { id: 2, name: 'Course Registration', is_active: true },
  { id: 3, name: 'Internship Contract', is_active: true },
]);
const selectedContractId = ref(null);
const imageLoaded = ref(false);
const uploadedFile = ref(null);
const fileType = ref(null);
const currentPdfPage = ref(1);

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

function processFile(file) {
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    console.error('File size too large. Max 50MB.');
    return;
  }

  const fileName = file.name.toLowerCase();
  const fileTypeFromMime = file.type.toLowerCase();
  const fileExtension = fileName.split('.').pop();
  const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const validExtensions = [...validImageExtensions, 'pdf'];

  if (!validExtensions.includes(fileExtension)) {
    console.error('Invalid file type. Upload image or PDF.');
    return;
  }

  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
    previewImageUrl.value = null;
  }

  placedFields.value = [];
  selectedField.value = null;
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
      x: 50 + i * 40,
      y: 50,
      width: fieldToAdd.default_width || 150,
      height: fieldToAdd.default_height || 40,
      label: fieldToAdd.name === 'Check Mark' ? '' : fieldToAdd.label,
      pageNumber: currentPdfPage.value,
    };

    placedFields.value.push(newFieldInstance);
    if (i === amount - 1) {
      selectedField.value = newFieldInstance;
    }
  }
}

function selectField(field) {
  selectedField.value = field;
}

function onImageLoad() {
  imageLoaded.value = true;
}

function handlePdfPageChange(pageNumber) {
  currentPdfPage.value = pageNumber;
}

function removeSelectedField() {
  if (!selectedField.value)
    return;
  const idx = placedFields.value.findIndex(
    f => f.instanceId === selectedField.value.instanceId,
  );
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedField.value = null;
  }
}

function handleKeyDown(event) {
  if (!selectedField.value)
    return;
  const step = event.shiftKey ? 10 : 1;

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      selectedField.value.y = Math.max(0, (selectedField.value.y || 0) - step);
      break;
    case 'ArrowDown':
      event.preventDefault();
      selectedField.value.y = (selectedField.value.y || 0) + step;
      break;
    case 'ArrowLeft':
      event.preventDefault();
      selectedField.value.x = Math.max(0, (selectedField.value.x || 0) - step);
      break;
    case 'ArrowRight':
      event.preventDefault();
      selectedField.value.x = (selectedField.value.x || 0) + step;
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
    Object.assign(placedFields.value[idx], data.updates);
  }
}

function handleFieldRemoval(instanceId) {
  const idx = placedFields.value.findIndex(f => f.instanceId === instanceId);
  if (idx > -1) {
    placedFields.value.splice(idx, 1);
    selectedField.value = null;
  }
}

function validateTemplateName() {
  const result = validateTemplateNameFormat(newTemplateName.value);
  templateNameError.value = result.isValid ? '' : result.message;
  return result.isValid;
}

function handleTemplateSaved() {
  if (!validateTemplateName())
    return;
  isSaving.value = true;
  router.back();
}

function handleBeforeUnload(e) {
  if (hasChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(async () => {
  // await fetchContracts(); // Temporarily disabled - using mock data
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

watch([newTemplateName, placedFields, uploadedFile], () => {
  hasChanges.value = true;
});

watch(
  selectedField,
  (newField) => {
    if (newField && typeof newField === 'object') {
      if (typeof newField.x !== 'number')
        newField.x = 50;
      if (typeof newField.y !== 'number')
        newField.y = 50;
      if (typeof newField.width !== 'number')
        newField.width = 150;
      if (typeof newField.height !== 'number')
        newField.height = 40;
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
  <div class="w-full">
    <!-- Template Info Section -->
    <div class="bg-white rounded-lg shadow-sm mb-4">
      <div class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Template Name</label>
            <input
              v-model="newTemplateName"
              type="text"
              class="w-full px-3 py-2 border rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :class="templateNameError ? 'border-red-500' : 'border-gray-300'"
              placeholder="Enter template name"
              @input="validateTemplateName"
            >
            <div v-if="templateNameError" class="text-red-500 text-xs mt-1">
              {{ templateNameError }}
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Contract</label>
            <select
              v-model="selectedContractId"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option hidden :value="null">
                -- Choose Contract --
              </option>
              <option
                v-for="contract in contracts"
                :key="contract.id"
                :value="contract.id"
              >
                {{ contract.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-12 gap-4">
      <!-- Left Sidebar -->
      <div class="col-span-12 lg:col-span-2">
        <!-- Upload -->
        <div class="bg-white rounded-lg shadow-sm mb-4 overflow-hidden">
          <div class="bg-blue-500 px-4 py-3 text-white font-semibold text-sm flex items-center">
            <i class="fas fa-cloud-upload-alt mr-2" />
            <span>Upload Background</span>
          </div>
          <div class="p-3">
            <div
              class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer bg-gray-50 transition-all hover:border-blue-500 hover:bg-blue-50"
              :class="{ 'border-blue-500 bg-blue-100 scale-105': isDragging, 'border-gray-300': !isDragging }"
              @click="triggerFileInput"
              @drop.prevent="handleFileDrop"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
            >
              <i class="fas fa-cloud-upload-alt text-4xl text-gray-500 mb-3 block" />
              <span class="block font-medium text-gray-700 mb-1 text-sm">Click or drop file</span>
              <small class="block text-gray-500 text-xs">Image or PDF</small>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*,application/pdf"
              class="hidden"
              @change="handleImageUpload"
            >
          </div>
        </div>

        <!-- Fields -->
        <field-list @field-added="addFieldToPreview" />
      </div>

      <!-- Center - Preview -->
      <div class="col-span-12 lg:col-span-8">
        <template-image-create
          v-if="fileType === 'image' && previewImageUrl"
          :preview-image-url="previewImageUrl"
          :placed-fields="placedFields"
          :selected-field="selectedField"
          :new-template-name="newTemplateName"
          :selected-contract-id="selectedContractId"
          :original-file="uploadedFile"
          @field-selected="selectField"
          @image-loaded="onImageLoad"
          @template-saved="handleTemplateSaved"
        />

        <template-pdf-create
          v-else-if="fileType === 'pdf' && uploadedFile"
          :pdf-file="uploadedFile"
          :placed-fields="placedFields"
          :selected-field="selectedField"
          :new-template-name="newTemplateName"
          :selected-contract-id="selectedContractId"
          @field-selected="selectField"
          @pdf-loaded="onImageLoad"
          @template-saved="handleTemplateSaved"
          @current-page-changed="handlePdfPageChange"
        />

        <div v-else class="bg-white rounded-lg shadow-sm overflow-hidden">
          <div class="p-20 text-center">
            <i class="fas fa-image text-6xl text-gray-400 mb-4 block" />
            <p class="text-gray-500">
              Upload a file to start
            </p>
          </div>
        </div>
      </div>

      <!-- Right Sidebar -->
      <div class="col-span-12 lg:col-span-2">
        <field-properties
          v-if="selectedField"
          :selected-field="selectedField"
          @field-updated="handleFieldUpdate"
          @field-removed="handleFieldRemoval"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Remove all Bootstrap styles - using Tailwind only */
</style>
