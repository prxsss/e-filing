<script setup lang="ts">
type Field = any;

const props = defineProps<{
  selectedField?: Field;
  pdfRef?: any;
  scale?: number;
}>();

const emit = defineEmits<{
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
}>();

const localField = ref<any>({});

// Use computed for display coordinates to ensure they recalculate when scale changes
const displayCoords = computed(() => {
  const field = props.selectedField;
  const _scale = props.scale; // Force dependency tracking on scale
  const pdfRef = props.pdfRef; // Force dependency tracking on pdfRef

  if (!field) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // For PDF with normalized coordinates, calculate display coords using scale
  if (pdfRef && field.normalizedX !== undefined && field.normalizedY !== undefined) {
    if (typeof pdfRef.normalizedToDisplay === 'function') {
      const display = pdfRef.normalizedToDisplay(
        field.normalizedX,
        field.normalizedY,
        field.normalizedWidth,
        field.normalizedHeight,
      );
      return {
        x: Math.round(display.x),
        y: Math.round(display.y),
        width: Math.round(display.width),
        height: Math.round(display.height),
      };
    }
  }

  // For images or fields without normalized coords, use pixel coordinates
  return {
    x: field.displayX !== undefined ? Math.round(field.displayX) : (field.x || 50),
    y: field.displayY !== undefined ? Math.round(field.displayY) : (field.y || 50),
    width: field.displayWidth !== undefined ? Math.round(field.displayWidth) : (field.width || 150),
    height: field.displayHeight !== undefined ? Math.round(field.displayHeight) : (field.height || 40),
  };
});

// Editable values that user can modify
const editableX = ref(0);
const editableY = ref(0);
const editableWidth = ref(0);
const editableHeight = ref(0);

// Watch displayCoords and update editable values
watch(displayCoords, (newCoords) => {
  editableX.value = newCoords.x;
  editableY.value = newCoords.y;
  editableWidth.value = newCoords.width;
  editableHeight.value = newCoords.height;
}, { immediate: true });

// Watch selectedField for font properties
watch(
  () => props.selectedField,
  (newField) => {
    if (newField) {
      localField.value = { ...newField };
    }
    else {
      localField.value = {};
    }
  },
  { immediate: true },
);

function onPropertyChange() {
  if (!localField.value || !props.selectedField)
    return;

  // For PDF with normalized coordinates, convert display back to normalized
  if (props.pdfRef && props.selectedField.normalizedX !== undefined) {
    if (typeof props.pdfRef.displayToNormalized === 'function') {
      const normalized = props.pdfRef.displayToNormalized(
        editableX.value,
        editableY.value,
        editableWidth.value,
        editableHeight.value,
      );

      // Emit normalized coordinates directly
      emit('fieldUpdated', {
        instanceId: props.selectedField.instanceId,
        updates: {
          normalizedX: normalized.x,
          normalizedY: normalized.y,
          normalizedWidth: normalized.width,
          normalizedHeight: normalized.height,
          fontSize: localField.value.fontSize || 14,
          fontFamily: localField.value.fontFamily || 'Arial',
        },
      });
      return;
    }
  }

  // For images, emit pixel coordinates
  emit('fieldUpdated', {
    instanceId: props.selectedField.instanceId,
    updates: {
      x: editableX.value,
      y: editableY.value,
      width: editableWidth.value,
      height: editableHeight.value,
      fontSize: localField.value.fontSize || 14,
      fontFamily: localField.value.fontFamily || 'Arial',
    },
  });
}

function removeField() {
  if (!props.selectedField)
    return;
  emit('fieldRemoved', props.selectedField.instanceId);
}
</script>

<template>
  <div class="sticky top-0 z-50 w-full h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 shadow-md">
    <!-- Identity Section -->
    <div class="flex items-center gap-2 min-w-fit">
      <div class="flex flex-col">
        <span class="text-xs font-semibold text-gray-900">{{ selectedField.name }}</span>
        <span v-if="selectedField.instanceNumber > 1" class="text-xs text-gray-500">
          #{{ selectedField.instanceNumber }}
        </span>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-8 w-px bg-gray-300" />

    <!-- Position Section X, Y -->
    <div class="flex items-end gap-2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">X</label>
        <input
          v-model.number="editableX"
          type="number"
          class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          min="0"
          @input="onPropertyChange"
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">Y</label>
        <input
          v-model.number="editableY"
          type="number"
          class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          min="0"
          @input="onPropertyChange"
        >
      </div>
    </div>

    <!-- Separator -->
    <div class="h-8 w-px bg-gray-300" />

    <!-- Size Section -->
    <div class="flex items-end gap-2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">W</label>
        <input
          v-model.number="editableWidth"
          type="number"
          class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          min="10"
          @input="onPropertyChange"
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-gray-600">H</label>
        <input
          v-model.number="editableHeight"
          type="number"
          class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          min="10"
          @input="onPropertyChange"
        >
      </div>
    </div>

    <!-- Font Section - only for text fields -->
    <template v-if="selectedField.type !== 'Icon' && selectedField.type !== 'Signature'">
      <!-- Separator -->
      <div class="h-8 w-px bg-gray-300" />

      <div class="flex items-end gap-2">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Font Size</label>
          <input
            v-model.number="localField.fontSize"
            type="number"
            class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="8"
            max="72"
            placeholder="14"
            @input="onPropertyChange"
          >
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Font</label>
          <select
            v-model="localField.fontFamily"
            class="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            @change="onPropertyChange"
          >
            <option value="Arial">
              Arial
            </option>
            <option value="Helvetica">
              Helvetica
            </option>
            <option value="Times New Roman">
              Times New Roman
            </option>
            <option value="Courier New">
              Courier New
            </option>
            <option value="Georgia">
              Georgia
            </option>
            <option value="Verdana">
              Verdana
            </option>
            <option value="Tahoma">
              Tahoma
            </option>
            <option value="Sarabun">
              Sarabun (Thai)
            </option>
            <option value="Prompt">
              Prompt (Thai)
            </option>
            <option value="Mitr">
              Mitr (Thai)
            </option>
          </select>
        </div>
      </div>
    </template>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Actions Section -->
    <div class="flex items-end gap-2">
      <button
        class="px-3 py-1 text-sm font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
        @click="removeField"
      >
        <UIcon name="i-heroicons-trash-20-solid" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
div {
  -webkit-user-select: none;
  user-select: none;
}

/* Ensure smooth transitions and interactions */
input,
select {
  -webkit-user-select: text;
  user-select: text;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

input:focus,
select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}
</style>
