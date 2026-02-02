<script setup>
const props = defineProps({
  modelValue: Boolean,
  mode: {
    type: String,
    default: 'create', // 'create' or 'edit'
  },
  editField: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'fieldCreated', 'fieldUpdated', 'fieldDeleted', 'fieldUpdated', 'fieldDeleted']);

const toast = useToast();
const isSubmitting = ref(false);
const isDeleting = ref(false);
const showDeleteConfirm = ref(false);

const formData = ref({
  name: '',
  label: '',
  type: 'Text',
  icon: 'i-heroicons-document',
  width: 150,
  height: 40,
  isFillable: true,
  font: 'Sarabun',
  fontSize: 14,
});

const fieldTypes = ['Text', 'Date', 'Signature', 'Number', 'Email', 'Phone'];

const iconOptions = [
  { value: 'i-heroicons-document', label: 'Document', icon: 'i-heroicons-document' },
  { value: 'i-heroicons-user', label: 'User', icon: 'i-heroicons-user' },
  { value: 'i-heroicons-identification', label: 'ID', icon: 'i-heroicons-identification' },
  { value: 'i-heroicons-envelope', label: 'Email', icon: 'i-heroicons-envelope' },
  { value: 'i-heroicons-phone', label: 'Phone', icon: 'i-heroicons-phone' },
  { value: 'i-heroicons-calendar', label: 'Calendar', icon: 'i-heroicons-calendar' },
  { value: 'i-heroicons-pencil-square', label: 'Signature', icon: 'i-heroicons-pencil-square' },
  { value: 'i-heroicons-hashtag', label: 'Number', icon: 'i-heroicons-hashtag' },
  { value: 'i-heroicons-map-pin', label: 'Location', icon: 'i-heroicons-map-pin' },
  { value: 'i-heroicons-building-office', label: 'Office', icon: 'i-heroicons-building-office' },
];

const fontOptions = ['Sarabun', 'Prompt', 'Kanit', 'Anuphan', 'Noto Sans Thai', 'Arial', 'Helvetica', 'Times New Roman'];

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

// Watch for edit field changes
watch(() => props.editField, (newField) => {
  if (newField && props.mode === 'edit') {
    formData.value = {
      name: newField.name || '',
      label: newField.label || '',
      type: newField.type || 'Text',
      icon: newField.icon || 'i-heroicons-document',
      width: newField.default_width || newField.width || 150,
      height: newField.default_height || newField.height || 40,
      isFillable: newField.isFillable ?? true,
      font: newField.font || 'Sarabun',
      fontSize: newField.fontSize || 14,
    };
  }
}, { immediate: true });

function resetForm() {
  formData.value = {
    name: '',
    label: '',
    type: 'Text',
    icon: 'i-heroicons-document',
    width: 150,
    height: 40,
    isFillable: true,
    font: 'Sarabun',
    fontSize: 14,
  };
}

function closeModal() {
  isOpen.value = false;
  resetForm();
}

async function handleSubmit() {
  if (!formData.value.name || !formData.value.label) {
    toast.add({
      title: 'กรุณากรอกข้อมูลให้ครบ',
      color: 'error',
    });
    return;
  }

  isSubmitting.value = true;
  try {
    if (props.mode === 'edit' && props.editField?.id) {
      // Update existing field
      const response = await $fetch(`/api/template-fields/${props.editField.id}`, {
        method: 'PUT',
        body: formData.value,
      });

      if (response.success) {
        toast.add({
          title: 'อัพเดท Field สำเร็จ',
          color: 'success',
        });
        emit('fieldUpdated', response.data);
        closeModal();
      }
      else {
        toast.add({
          title: 'เกิดข้อผิดพลาด',
          description: response.error,
          color: 'error',
        });
      }
    }
    else {
      // Create new field
      const response = await $fetch('/api/template-fields', {
        method: 'POST',
        body: formData.value,
      });

      if (response.success) {
        toast.add({
          title: 'สร้าง Field สำเร็จ',
          color: 'success',
        });
        emit('fieldCreated', response.data);
        closeModal();
      }
      else {
        toast.add({
          title: 'เกิดข้อผิดพลาด',
          description: response.error,
          color: 'error',
        });
      }
    }
  }
  catch (error) {
    console.error('Error submitting field:', error);
    toast.add({
      title: props.mode === 'edit' ? 'ไม่สามารถอัพเดท Field ได้' : 'ไม่สามารถสร้าง Field ได้',
      description: error.message,
      color: 'error',
    });
  }
  finally {
    isSubmitting.value = false;
  }
}

async function handleDelete() {
  if (!props.editField?.id)
    return;

  isDeleting.value = true;
  try {
    const response = await $fetch(`/api/template-fields/${props.editField.id}`, {
      method: 'DELETE',
    });

    if (response.success) {
      toast.add({
        title: 'ลบ Field สำเร็จ',
        color: 'success',
      });
      emit('fieldDeleted', props.editField.id);
      closeModal();
    }
    else {
      toast.add({
        title: 'เกิดข้อผิดพลาด',
        description: response.error,
        color: 'error',
      });
    }
  }
  catch (error) {
    console.error('Error deleting field:', error);
    toast.add({
      title: 'ไม่สามารถลบ Field ได้',
      description: error.message,
      color: 'error',
    });
  }
  finally {
    isDeleting.value = false;
    showDeleteConfirm.value = false;
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md">
        <div class="bg-white dark:bg-gray-900 px-6 pb-4 pt-5 sm:p-6 sm:pb-4">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold leading-6 text-gray-900 dark:text-white">
              {{ mode === 'edit' ? 'แก้ไข Field' : 'เพิ่ม Field ใหม่' }}
            </h3>
            <button
              type="button"
              class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
              @click="closeModal"
            >
              <UIcon name="i-heroicons-x-mark-20-solid" class="h-6 w-6" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Field Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                ชื่อ Field <span class="text-red-500">*</span>
              </label>
              <UInput
                v-model="formData.name"
                placeholder="เช่น Student Name"
                size="md"
              />
            </div>

            <!-- Field Label -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                ป้ายชื่อ (Label) <span class="text-red-500">*</span>
              </label>
              <UInput
                v-model="formData.label"
                placeholder="เช่น ชื่อนักศึกษา"
                size="md"
              />
            </div>

            <!-- Field Type & Icon -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  ประเภท
                </label>
                <select
                  v-model="formData.type"
                  class="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                >
                  <option v-for="type in fieldTypes" :key="type" :value="type">
                    {{ type }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  ไอคอน
                </label>
                <select
                  v-model="formData.icon"
                  class="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                >
                  <option v-for="option in iconOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Font & Font Size -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  ฟอนต์
                </label>
                <select
                  v-model="formData.font"
                  class="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 text-sm"
                >
                  <option v-for="font in fontOptions" :key="font" :value="font">
                    {{ font }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  ขนาดฟอนต์
                </label>
                <UInput
                  v-model.number="formData.fontSize"
                  type="number"
                  min="8"
                  max="72"
                  size="md"
                />
              </div>
            </div>

            <!-- Width & Height -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  ความกว้าง (px)
                </label>
                <UInput
                  v-model.number="formData.width"
                  type="number"
                  min="50"
                  max="500"
                  size="md"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  ความสูง (px)
                </label>
                <UInput
                  v-model.number="formData.height"
                  type="number"
                  size="md"
                />
              </div>
            </div>

            <!-- Is Fillable -->
            <div class="flex items-center gap-2 pt-2">
              <UCheckbox v-model="formData.isFillable" />
              <label class="text-sm text-gray-700 dark:text-gray-200">สามารถกรอกข้อมูลได้</label>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">
          <UButton
            :loading="isSubmitting"
            :label="mode === 'edit' ? 'บันทึก' : 'สร้าง Field'"
            @click="handleSubmit"
          />
          <UButton
            color="gray"
            variant="outline"
            label="ยกเลิก"
            @click="closeModal"
          />
          <UButton
            v-if="mode === 'edit'"
            color="red"
            label="ลบ"
            :loading="isDeleting"
            @click="showDeleteConfirm = true"
          />
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
          <div class="bg-white dark:bg-gray-900 px-4 pb-4 pt-5 sm:p-6">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6 text-red-600" />
              </div>
              <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                  ยืนยันการลบ
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    คุณต้องการลบ Field "{{ editField?.name }}" หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">
            <UButton
              color="red"
              :loading="isDeleting"
              label="ลบ"
              @click="handleDelete"
            />
            <UButton
              color="gray"
              variant="outline"
              label="ยกเลิก"
              @click="showDeleteConfirm = false"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
