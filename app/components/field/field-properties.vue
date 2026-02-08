<script setup>
const props = defineProps({
  selectedField: {
    type: Object,
    default: null,
  },
  pdfRef: {
    type: Object,
    default: null,
  },
  scale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(['fieldUpdated', 'fieldRemoved']);
const localField = ref({});

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
  <div class="card shadow-sm">
    <div class="card-header">
      <i class="fas fa-sliders-h mr-2" />Properties
    </div>
    <div class="card-body p-3">
      <div class="field-title">
        <span class="field-title-text">{{ selectedField.name }}</span>
        <span v-if="selectedField.instanceNumber > 1" class="instance-badge">
          #{{ selectedField.instanceNumber }}
        </span>
      </div>

      <div class="prop-section">
        <label class="prop-label">
          <i class="fas fa-arrows-alt mr-1" />Position
        </label>
        <div class="prop-row">
          <div class="prop-input-group">
            <small class="input-label">X</small>
            <input
              v-model.number="editableX"
              type="number"
              class="prop-input"
              min="0"
              @input="onPropertyChange"
            >
          </div>
          <div class="prop-input-group">
            <small class="input-label">Y</small>
            <input
              v-model.number="editableY"
              type="number"
              class="prop-input"
              min="0"
              @input="onPropertyChange"
            >
          </div>
        </div>
      </div>

      <div class="prop-section">
        <label class="prop-label">
          <i class="fas fa-expand-arrows-alt mr-1" />Size
        </label>
        <div class="prop-row">
          <div class="prop-input-group">
            <small class="input-label">Width</small>
            <input
              v-model.number="editableWidth"
              type="number"
              class="prop-input"
              min="10"
              @input="onPropertyChange"
            >
          </div>
          <div class="prop-input-group">
            <small class="input-label">Height</small>
            <input
              v-model.number="editableHeight"
              type="number"
              class="prop-input"
              min="10"
              @input="onPropertyChange"
            >
          </div>
        </div>
      </div>

      <div v-if="selectedField.type !== 'Icon' && selectedField.type !== 'Signature'" class="prop-section">
        <label class="prop-label">
          <i class="fas fa-font mr-1" />Font
        </label>
        <div class="prop-input-group mb-2">
          <small class="input-label">Font Size</small>
          <input
            v-model.number="localField.fontSize"
            type="number"
            class="prop-input"
            min="8"
            max="72"
            placeholder="14"
            @input="onPropertyChange"
          >
        </div>
        <div class="prop-input-group">
          <small class="input-label">Font Family</small>
          <select
            v-model="localField.fontFamily"
            class="prop-input"
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

      <button class="btn-remove" @click="removeField">
        <i class="fas fa-trash mr-2" />Remove Field
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Card Styling */
.card {
  border: none;
  border-radius: 10px;
  overflow: hidden;
}

.shadow-sm {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
}

.card-header {
  background: #007bff;
  border-bottom: none;
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #ffffff;
  font-size: 0.9rem;
}

.card-body {
  background-color: #ffffff;
}

/* Field Title */
.field-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
}

.field-title-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.instance-badge {
  background: rgba(0, 123, 255, 0.1);
  color: #007bff;
  padding: 0.25rem 0.5rem;
  border-radius: 50rem;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

/* Property Section */
.prop-section {
  margin-bottom: 1.25rem;
}

.prop-label {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.prop-row {
  display: flex;
  gap: 0.625rem;
}

.prop-input-group {
  flex: 1;
}

.input-label {
  display: block;
  font-size: 0.75rem;
  color: #6c757d;
  margin-bottom: 0.375rem;
  font-weight: 500;
}

.prop-input {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  font-weight: 500;
  color: #495057;
}

.prop-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.15);
}

.prop-input:hover {
  border-color: #007bff;
  box-shadow: 0 0 0 0.1rem rgba(0, 123, 255, 0.1);
}

/* Remove Button */
.btn-remove {
  width: 100%;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.625rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  border: 1px solid #dc3545;
}

.btn-remove:hover {
  background: #c82333;
  border-color: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.25);
}

.btn-remove:active {
  transform: translateY(0);
}

/* Utility Classes */
.mr-1 {
  margin-right: 0.25rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #dee2e6;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}
</style>
