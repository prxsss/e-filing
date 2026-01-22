<script setup>
definePageMeta({
  title: 'createTemplate',
});

// const supabase = useSupabaseClient(); // Temporarily disabled
const router = useRouter();
const toast = useToast();
const hasChanges = ref(false);
const isSaving = ref(false);
const isDragging = ref(false);
const fileInput = ref(null);

const newTemplateName = ref('');
const templateNameError = ref('');
const previewImageUrl = ref(null);
const placedFields = ref([]);
const selectedField = ref(null);
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

// Available fields for the template
const availableFields = [
  { id: 1, name: 'Student Name', label: 'Student Name', type: 'Text', icon: 'i-heroicons-user', default_width: 200, default_height: 40 },
  { id: 2, name: 'Student ID', label: 'Student ID', type: 'Text', icon: 'i-heroicons-identification', default_width: 150, default_height: 40 },
  { id: 3, name: 'Email', label: 'Email Address', type: 'Text', icon: 'i-heroicons-envelope', default_width: 250, default_height: 40 },
  { id: 4, name: 'Phone', label: 'Phone Number', type: 'Text', icon: 'i-heroicons-phone', default_width: 150, default_height: 40 },
  { id: 5, name: 'Date', label: 'Date', type: 'Date', icon: 'i-heroicons-calendar', default_width: 150, default_height: 40 },
  { id: 'sig', name: 'Signature', label: 'Signature', type: 'Signature', icon: 'i-heroicons-pencil-square', default_width: 200, default_height: 60 },
];

// Computed property for filtered fields based on search
const filteredFields = computed(() => {
  if (!searchQuery.value)
    return availableFields;
  return availableFields.filter(f =>
    f.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
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
  <div class="h-screen flex flex-col bg-gray-50 overflow-hidden">
    <!-- === TOP HEADER (Toolbar) === -->
    <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20 shadow-sm shrink-0">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="router.back()"
        />
        <div class="h-6 w-px bg-gray-200 mx-1 hidden md:block" />

        <!-- Template Name Input -->
        <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Template Name</label>
          <input
            v-model="newTemplateName"
            type="text"
            class="bg-transparent border-none p-0 text-gray-800 font-semibold focus:ring-0 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-1 transition-colors"
            placeholder="Enter template name..."
            @input="validateTemplateName"
          >
          <div v-if="templateNameError" class="text-red-500 text-[10px] mt-0.5">
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

      <div class="flex items-center gap-3">
        <UButton
          :loading="isSaving"
          icon="i-heroicons-check"
          color="neutral"
          label="Save Template"
          size="sm"
          class="px-6 font-bold"
          @click="handleTemplateSaved"
        />
      </div>
    </header>

    <!-- === WORKSPACE === -->
    <div class="flex-1 flex overflow-hidden">
      <!-- [LEFT SIDEBAR] Tools & Assets -->
      <aside class="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">
        <!-- Tabs / Sections -->
        <div class="p-4 border-b border-gray-100">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <UIcon name="i-heroicons-swatch" class="text-primary-500" />
            เครื่องมือ (Tools)
          </h3>
        </div>

        <div class="overflow-y-auto flex-1 p-4 space-y-6">
          <!-- Upload Section -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-semibold text-gray-500 uppercase">เอกสารตั้นต้นฉบับ</label>
              <UBadge v-if="uploadedFile" color="success" variant="subtle" size="xs">
                Uploaded
              </UBadge>
            </div>

            <div
              v-if="!uploadedFile"
              class="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 hover:border-primary-400 transition-all cursor-pointer group"
              :class="{ 'border-primary-500 bg-primary-50': isDragging }"
              @click="triggerFileInput"
              @drop.prevent="handleFileDrop"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
            >
              <div class="bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white group-hover:text-primary-500 transition-colors text-gray-400">
                <UIcon name="i-heroicons-cloud-arrow-up" class="w-6 h-6" />
              </div>
              <p class="text-sm font-medium text-gray-600">
                คลิกเพื่ออัปโหลด
              </p>
              <p class="text-xs text-gray-400 mt-1">
                PDF หรือ รูปภาพ (JPG, PNG)
              </p>
            </div>

            <!-- Uploaded State -->
            <div v-else class="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-3">
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
            </div>

            <!-- Search -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="ค้นหา..."
              size="sm"
              class="mb-3 w-full"
            />

            <!-- Field List -->
            <div class="space-y-2">
              <button
                v-for="field in filteredFields"
                :key="field.id"
                class="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-primary-400 hover:shadow-sm transition-all text-left group"
                @click="addFieldToPreview(field)"
              >
                <div class="w-8 h-8 rounded-md bg-gray-50 text-gray-500 flex items-center justify-center group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                  <UIcon :name="field.icon" class="w-5 h-5" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {{ field.name }}
                  </p>
                  <p class="text-[10px] text-gray-400">
                    {{ field.type }}
                  </p>
                </div>
                <UIcon name="i-heroicons-plus" class="ml-auto text-gray-300 group-hover:text-primary-500" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- [CENTER] Canvas Area -->
      <section class="flex-1 bg-gray-100/50 relative overflow-hidden flex flex-col">
        <!-- Toolbar (Zoom etc.) -->
        <div class="h-10 border-b border-gray-200 bg-white px-4 flex items-center justify-between shrink-0">
          <div class="text-xs text-gray-400">
            <span v-if="!uploadedFile">ยังไม่มีไฟล์</span>
            <span v-else-if="fileType === 'pdf'">เอกสาร PDF - หน้า {{ currentPdfPage }}</span>
            <span v-else>เอกสารรูปภาพ</span>
          </div>
          <div class="flex items-center gap-2">
            <UButton icon="i-heroicons-minus" size="xs" color="neutral" variant="ghost" @click="scale = Math.max(0.5, scale - 0.1)" />
            <span class="text-xs font-mono w-12 text-center text-gray-600">{{ Math.round(scale * 100) }}%</span>
            <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click="scale = Math.min(2, scale + 0.1)" />
          </div>
        </div>

        <!-- Scrollable Canvas Container -->
        <div class="flex-1 overflow-auto p-8 flex justify-center items-start">
          <!-- Canvas Wrapper with Scale -->
          <div
            class="transition-transform duration-200 ease-out origin-top"
            :style="{ transform: `scale(${scale})` }"
          >
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

            <div v-else class="bg-white shadow-lg border border-gray-200 rounded-lg" style="width: 595px; min-height: 842px;">
              <div class="flex flex-col items-center justify-center h-full py-20 text-gray-300">
                <UIcon name="i-heroicons-document" class="w-16 h-16 mb-2" />
                <p class="text-sm">
                  พื้นที่แสดงเอกสาร
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- [RIGHT SIDEBAR] Properties -->
      <aside class="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 z-10">
        <div class="p-4 border-b border-gray-100">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <UIcon name="i-heroicons-adjustments-horizontal" class="text-gray-500" />
            คุณสมบัติ (Properties)
          </h3>
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          <field-properties
            v-if="selectedField"
            :selected-field="selectedField"
            @field-updated="handleFieldUpdate"
            @field-removed="handleFieldRemoval"
          />

          <!-- Empty State -->
          <div v-else class="text-center py-10 opacity-60">
            <UIcon name="i-heroicons-cursor-arrow-rays" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p class="text-sm text-gray-500 font-medium">
              คลิกเลือก Field บนเอกสาร<br>เพื่อแก้ไขคุณสมบัติ
            </p>
          </div>
        </div>
      </aside>
    </div>
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
