<script setup lang="ts">
// --- 1. State & Logic ---

// Meta
definePageMeta({
  title: 'createTemplate',
});

// Router & UI State
const router = useRouter();
const toast = useToast();
const isSaving = ref(false);

// Template Data
const templateName = ref('Untitled Template');

// Canvas State
const uploadedFile = ref<File | null>(null);
const previewImageUrl = ref<string | null>(null);
const fileType = ref<'image' | 'pdf' | null>(null);
const scale = ref(1); // Zoom level

// Fields Data
type FieldType = 'Text' | 'Date' | 'Signature' | 'Icon';
type FieldTemplate = {
  id: number | string;
  name: string;
  label: string;
  type: FieldType;
  icon: string;
  default_width: number;
  default_height: number;
};

type PlacedField = {
  instanceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
} & FieldTemplate;

const availableFields: FieldTemplate[] = [
  { id: 1, name: 'Student Name', label: 'Student Name', type: 'Text', icon: 'i-heroicons-user', default_width: 200, default_height: 40 },
  { id: 2, name: 'Student ID', label: 'Student ID', type: 'Text', icon: 'i-heroicons-identification', default_width: 150, default_height: 40 },
  { id: 3, name: 'Email', label: 'Email Address', type: 'Text', icon: 'i-heroicons-envelope', default_width: 250, default_height: 40 },
  { id: 4, name: 'Phone', label: 'Phone Number', type: 'Text', icon: 'i-heroicons-phone', default_width: 150, default_height: 40 },
  { id: 5, name: 'Date', label: 'Date', type: 'Date', icon: 'i-heroicons-calendar', default_width: 150, default_height: 40 },
  { id: 'sig', name: 'Signature', label: 'Signature', type: 'Signature', icon: 'i-heroicons-pencil-square', default_width: 200, default_height: 60 },
];

const placedFields = ref<PlacedField[]>([]);
const selectedField = ref<PlacedField | null>(null);
const searchQuery = ref('');

// --- 2. Methods ---

// File Handling
const fileInputRef = ref<HTMLInputElement | null>(null);

const triggerFileUpload = () => fileInputRef.value?.click();

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file)
    processFile(file);
}

function processFile(file: File) {
  uploadedFile.value = file;
  const isPdf = file.type === 'application/pdf';
  fileType.value = isPdf ? 'pdf' : 'image';

  if (!isPdf) {
    // For images: create object URL
    previewImageUrl.value = URL.createObjectURL(file);
  }
  else {
    // For PDFs: generate preview using pdf-lib
    generatePdfPreview(file);
  }
}

function generatePdfPreview(file: File) {
  try {
    // Create a simple canvas preview for PDF
    // Shows file info and allows field placement
    const canvas = document.createElement('canvas');
    canvas.width = 595; // A4 width in pixels at 72 DPI
    canvas.height = 842; // A4 height in pixels at 72 DPI

    const ctx = canvas.getContext('2d');
    if (!ctx)
      return;

    // Draw background (light gray gradient to indicate PDF)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#F3F4F6');
    gradient.addColorStop(1, '#E5E7EB');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // Draw PDF icon
    ctx.fillStyle = '#9CA3AF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📄', canvas.width / 2, 150);

    // Draw file info
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PDF Document', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#6B7280';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(file.name, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText(`${(file.size / 1024).toFixed(2)} KB`, canvas.width / 2, canvas.height / 2 + 50);

    // Draw footer instruction
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click on the left panel to add fields to this template', canvas.width / 2, canvas.height - 50);

    previewImageUrl.value = canvas.toDataURL('image/png');
    toast.add({ title: 'PDF loaded successfully', color: 'success' });
  }
  catch (error) {
    console.error('Error generating PDF preview:', error);
    toast.add({ title: 'Failed to load PDF', color: 'error' });
  }
}

// Field Operations
function addField(field: FieldTemplate) {
  if (!uploadedFile.value) {
    toast.add({ title: 'กรุณาอัปโหลดไฟล์เอกสารก่อนเริ่มวาง Field', color: 'error' });
    return;
  }

  const newField: PlacedField = {
    ...field,
    instanceId: `field_${Date.now()}`,
    x: 50, // Default position
    y: 50,
    width: field.default_width,
    height: field.default_height,
    fontSize: 14,
    fontFamily: 'Prompt',
  };

  placedFields.value.push(newField);
  selectedField.value = newField;
}

function selectField(field: PlacedField) {
  selectedField.value = field;
}

function removeField(instanceId: string) {
  placedFields.value = placedFields.value.filter(f => f.instanceId !== instanceId);
  if (selectedField.value?.instanceId === instanceId) {
    selectedField.value = null;
  }
}

function saveTemplate() {
  if (!templateName.value) {
    toast.add({ title: 'กรุณาระบุชื่อ Template', color: 'error' });
    return;
  }
  if (!uploadedFile.value) {
    toast.add({ title: 'กรุณาอัปโหลดไฟล์', color: 'error' });
    return;
  }

  isSaving.value = true;
  setTimeout(() => {
    isSaving.value = false;
    toast.add({ title: 'บันทึก Template เรียบร้อย', color: 'success' });
    // router.push('/admin/templates')
  }, 1000);
}

// Computed for Search
const filteredFields = computed(() => {
  return availableFields.filter(f =>
    f.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 overflow-hidden">
    <!-- === 1. TOP HEADER (Toolbar) === -->
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
            v-model="templateName"
            type="text"
            class="bg-transparent border-none p-0 text-gray-800 font-semibold focus:ring-0 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-1 transition-colors"
            placeholder="ตั้งชื่อเอกสาร..."
          >
        </div>
      </div>

      <div class="flex items-center gap-3">
        <UButton
          :loading="isSaving"
          icon="i-heroicons-check"
          color="neutral"
          label="บันทึก Template"
          size="sm"
          class="px-6 font-bold"
          @click="saveTemplate"
        />
      </div>
    </header>

    <!-- === 2. WORKSPACE === -->
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
              <label class="text-xs font-semibold text-gray-500 uppercase">เอกสารต้นฉบับ</label>
              <UBadge v-if="uploadedFile" color="success" variant="subtle" size="xs">
                Uploaded
              </UBadge>
            </div>

            <div
              v-if="!uploadedFile"
              class="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 hover:border-primary-400 transition-all cursor-pointer group"
              @click="triggerFileUpload"
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
                <button class="text-xs text-primary-600 hover:underline" @click="triggerFileUpload">
                  เปลี่ยนไฟล์
                </button>
              </div>
            </div>
            <input ref="fileInputRef" type="file" class="hidden" accept=".pdf,image/*" @change="handleFileUpload">
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
                @click="addField(field)"
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
            <span v-else>{{ fileType === 'pdf' ? 'PDF Document' : 'Image' }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UButton icon="i-heroicons-minus" size="xs" color="neutral" variant="ghost" @click="scale = Math.max(0.5, scale - 0.1)" />
            <span class="text-xs font-mono w-12 text-center text-gray-600">{{ Math.round(scale * 100) }}%</span>
            <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click="scale = Math.min(2, scale + 0.1)" />
          </div>
        </div>

        <!-- Scrollable Canvas Container -->
        <div class="flex-1 overflow-auto p-8 flex justify-center items-start">
          <!-- The Actual Canvas (Mock) -->
          <!-- ตรงนี้คือจุดที่คุณจะนำ Component template-image-create หรือ template-pdf-create มาใส่ -->
          <div
            class="relative bg-white shadow-lg transition-transform duration-200 ease-out origin-top border border-gray-200"
            :style="{
              width: '595px',
              minHeight: '842px',
              transform: `scale(${scale})`,
            }"
          >
            <!-- Background Image -->
            <img v-if="previewImageUrl" :src="previewImageUrl" class="w-full h-auto block select-none">

            <!-- Empty State -->
            <div v-if="!uploadedFile" class="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
              <UIcon name="i-heroicons-document" class="w-16 h-16 mb-2" />
              <p class="text-sm">
                พื้นที่แสดงเอกสาร
              </p>
            </div>

            <!-- Draggable Fields Overlay -->
            <div class="absolute inset-0">
              <div
                v-for="field in placedFields"
                :key="field.instanceId"
                class="absolute flex items-center justify-center cursor-move group select-none"
                :class="selectedField?.instanceId === field.instanceId ? 'ring-2 ring-primary-500 bg-primary-50/20 z-10' : 'border border-dashed border-gray-400 bg-white/50 hover:bg-white/70'"
                :style="{
                  left: `${field.x}px`,
                  top: `${field.y}px`,
                  width: `${field.width}px`,
                  height: `${field.height}px`,
                }"
                @click.stop="selectField(field)"
              >
                <!-- Resize Handles (Show only when selected) -->
                <template v-if="selectedField?.instanceId === field.instanceId">
                  <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary-500 rounded-full" />
                  <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary-500 rounded-full" />
                  <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary-500 rounded-full" />
                  <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary-500 rounded-full cursor-nwse-resize" />
                </template>

                <div class="flex items-center gap-1.5 px-2 overflow-hidden w-full justify-center">
                  <UIcon v-if="field.icon" :name="field.icon" class="w-4 h-4 text-gray-500 shrink-0" />
                  <span class="text-xs font-semibold text-gray-700 truncate">{{ field.label }}</span>
                </div>
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
          <div v-if="selectedField">
            <!-- Header Info -->
            <div class="mb-6 flex items-start gap-3">
              <div class="w-10 h-10 rounded bg-primary-50 text-primary-600 flex items-center justify-center text-xl shrink-0">
                <UIcon :name="selectedField.icon" class="w-6 h-6" />
              </div>
              <div>
                <h4 class="font-bold text-gray-900 leading-tight">
                  {{ selectedField.name }}
                </h4>
                <p class="text-xs text-gray-500 mt-1 font-mono">
                  ID: {{ selectedField.instanceId.slice(0, 8) }}
                </p>
              </div>
            </div>

            <!-- Form Groups -->
            <div class="space-y-5">
              <!-- Position & Size -->
              <div>
                <label class="text-xs font-bold text-gray-400 uppercase mb-3 block">ตำแหน่งและขนาด</label>
                <div class="grid grid-cols-2 gap-3 mb-3">
                  <UFormField label="X Axis">
                    <UInput v-model="selectedField.x" type="number" size="sm" />
                  </UFormField>
                  <UFormField label="Y Axis">
                    <UInput v-model="selectedField.y" type="number" size="sm" />
                  </UFormField>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="Width">
                    <UInput v-model="selectedField.width" type="number" size="sm">
                      <template #trailing>
                        <span class="text-gray-400 text-xs">px</span>
                      </template>
                    </UInput>
                  </UFormField>
                  <UFormField label="Height">
                    <UInput v-model="selectedField.height" type="number" size="sm">
                      <template #trailing>
                        <span class="text-gray-400 text-xs">px</span>
                      </template>
                    </UInput>
                  </UFormField>
                </div>
              </div>

              <!-- Style -->
              <div>
                <label class="text-xs font-bold text-gray-400 uppercase mb-3 block">รูปแบบข้อความ</label>
                <UFormField label="Font Family" class="mb-3">
                  <USelectMenu
                    v-model="selectedField.fontFamily"
                    :options="['Prompt', 'Sarabun', 'Arial', 'Courier New']"
                    size="sm"
                  />
                </UFormField>
                <UFormField label="Font Size">
                  <div class="flex items-center gap-2">
                    <USlider v-model="selectedField.fontSize" :min="8" :max="72" size="sm" class="flex-1" />
                    <UInput v-model="selectedField.fontSize" type="number" size="sm" class="w-16" />
                  </div>
                </UFormField>
              </div>

              <!-- Delete Action -->
              <div class="pt-4 mt-4 border-t border-gray-100">
                <UButton
                  block
                  color="error"
                  variant="soft"
                  icon="i-heroicons-trash"
                  label="ลบ Field นี้"
                  @click="removeField(selectedField.instanceId)"
                />
              </div>
            </div>
          </div>

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
