<script setup lang="ts">
import { getAutoDateTimeFormatConfig } from '../../../shared/auto-date-time-format';

type Field = any;

const props = withDefaults(defineProps<{
  selectedField?: Field;
  pdfRef?: any;
  scale?: number;
  isSavingDefaults?: boolean;
}>(), {
  isSavingDefaults: false,
});

const emit = defineEmits<{
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
  saveDefaults: [data: { fieldId: number | string; defaults: any }];
}>();

const localField = ref<any>({});

function normalizeMaxLength(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return null;
  return parsed;
}

const selectedFieldType = computed(() => String(props.selectedField?.type || props.selectedField?.fieldType || '').toLowerCase());
const isDateField = computed(() => selectedFieldType.value === 'date');
const isTimeField = computed(() => selectedFieldType.value === 'time');

const supportsMaxLength = computed(() => {
  return selectedFieldType.value !== 'signature' && selectedFieldType.value !== 'icon' && selectedFieldType.value !== 'date' && selectedFieldType.value !== 'time';
});

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

// Editable values that user can modify (Still keeping X, Y in state to preserve them when saving other properties)
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
      const autoDateTimeConfig = getAutoDateTimeFormatConfig(newField);
      localField.value = {
        ...newField,
        ...autoDateTimeConfig,
        fontWeight: newField.fontWeight || 'normal',
        fontStyle: newField.fontStyle || 'normal',
        textDecoration: newField.textDecoration || 'none',
        textAlign: newField.textAlign || 'left',
        letterSpacing: newField.letterSpacing ?? 0,
        lineHeight: newField.lineHeight ?? 1.5,
        maxLength: normalizeMaxLength(newField.maxLength ?? newField.max_length),
      };
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

  const autoDateTimeConfig = getAutoDateTimeFormatConfig(localField.value);

  const dateTimeFormatUpdates = isDateField.value
    ? {
        dateSeparator: autoDateTimeConfig.dateSeparator,
        dateShowDay: autoDateTimeConfig.dateShowDay,
        dateShowMonth: autoDateTimeConfig.dateShowMonth,
        dateShowYear: autoDateTimeConfig.dateShowYear,
      }
    : isTimeField.value
      ? {
          timeSeparator: autoDateTimeConfig.timeSeparator,
          timeShowHour: autoDateTimeConfig.timeShowHour,
          timeShowMinute: autoDateTimeConfig.timeShowMinute,
        }
      : {};

  const commonStyleUpdates = {
    fontSize: localField.value.fontSize || 14,
    fontFamily: localField.value.fontFamily || 'Arial',
    fontWeight: localField.value.fontWeight || 'normal',
    fontStyle: localField.value.fontStyle || 'normal',
    textDecoration: localField.value.textDecoration || 'none',
    textAlign: localField.value.textAlign || 'left',
    letterSpacing: localField.value.letterSpacing ?? 0,
    lineHeight: localField.value.lineHeight ?? 1.5,
    maxLength: supportsMaxLength.value ? normalizeMaxLength(localField.value.maxLength) : null,
    ...dateTimeFormatUpdates,
  };

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
          ...commonStyleUpdates,
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
      ...commonStyleUpdates,
    },
  });
}

function saveDefaults() {
  const fieldId = props.selectedField?.id;
  if (fieldId === undefined || fieldId === null) {
    return;
  }

  const autoDateTimeConfig = getAutoDateTimeFormatConfig(localField.value);

  const dateTimeDefaults = isDateField.value
    ? {
        dateSeparator: autoDateTimeConfig.dateSeparator,
        dateShowDay: autoDateTimeConfig.dateShowDay,
        dateShowMonth: autoDateTimeConfig.dateShowMonth,
        dateShowYear: autoDateTimeConfig.dateShowYear,
      }
    : isTimeField.value
      ? {
          timeSeparator: autoDateTimeConfig.timeSeparator,
          timeShowHour: autoDateTimeConfig.timeShowHour,
          timeShowMinute: autoDateTimeConfig.timeShowMinute,
        }
      : {};

  emit('saveDefaults', {
    fieldId,
    defaults: {
      width: editableWidth.value,
      height: editableHeight.value,
      font: localField.value.fontFamily || localField.value.font || 'Arial',
      fontSize: localField.value.fontSize || 14,
      fontWeight: localField.value.fontWeight || 'normal',
      fontStyle: localField.value.fontStyle || 'normal',
      textDecoration: localField.value.textDecoration || 'none',
      textAlign: localField.value.textAlign || 'left',
      letterSpacing: localField.value.letterSpacing ?? 0,
      lineHeight: localField.value.lineHeight ?? 1.5,
      maxLength: supportsMaxLength.value ? normalizeMaxLength(localField.value.maxLength) : null,
      ...dateTimeDefaults,
    },
  });
}

function toggleDatePart(partKey: 'dateShowDay' | 'dateShowMonth' | 'dateShowYear') {
  const parts: Array<'dateShowDay' | 'dateShowMonth' | 'dateShowYear'> = ['dateShowDay', 'dateShowMonth', 'dateShowYear'];
  const activeCount = parts.filter(key => localField.value[key] !== false).length;
  const isActive = localField.value[partKey] !== false;

  if (isActive && activeCount <= 1) {
    return;
  }

  localField.value[partKey] = !isActive;
  onPropertyChange();
}

function toggleTimePart(partKey: 'timeShowHour' | 'timeShowMinute') {
  const parts: Array<'timeShowHour' | 'timeShowMinute'> = ['timeShowHour', 'timeShowMinute'];
  const activeCount = parts.filter(key => localField.value[key] !== false).length;
  const isActive = localField.value[partKey] !== false;

  if (isActive && activeCount <= 1) {
    return;
  }

  localField.value[partKey] = !isActive;
  onPropertyChange();
}

function removeField() {
  if (!props.selectedField)
    return;
  emit('fieldRemoved', props.selectedField.instanceId);
}
</script>

<template>
  <div class="field-toolbar-wrapper bg-white shadow-sm border border-gray-200 rounded-lg px-3 py-1.5 mx-auto">
    <div class="field-toolbar-inline">
      <!-- Identity Section -->
      <UTooltip text="ประเภทของช่องข้อมูล" :popper="{ placement: 'top' }">
        <div class="flex items-center gap-1.5 bg-primary-50 px-2 py-1 rounded-md border border-primary-100">
          <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 text-primary-500" />
          <span class="text-xs font-semibold text-primary-700 truncate max-w-32">{{ selectedField.name }}</span>
          <span v-if="selectedField.instanceNumber > 1" class="text-[10px] bg-white text-primary-600 px-1 rounded shadow-sm font-mono">
            #{{ selectedField.instanceNumber }}
          </span>
        </div>
      </UTooltip>

      <div class="h-5 w-px bg-gray-200" />

      <!-- Size Section (Width and Height) -->
      <div class="flex items-center gap-1.5">
        <UTooltip text="ความกว้าง (Width)" :popper="{ placement: 'top' }">
          <div class="toolbar-input-group">
            <span class="toolbar-prefix">W</span>
            <input v-model.number="editableWidth" type="number" class="toolbar-input w-12" min="10" @input="onPropertyChange">
          </div>
        </UTooltip>

        <UTooltip text="ความสูง (Height)" :popper="{ placement: 'top' }">
          <div class="toolbar-input-group">
            <span class="toolbar-prefix">H</span>
            <input v-model.number="editableHeight" type="number" class="toolbar-input w-12" min="10" @input="onPropertyChange">
          </div>
        </UTooltip>
      </div>

      <!-- Font (text fields only) -->
      <template v-if="selectedField.type !== 'Icon' && selectedField.type !== 'Signature'">
        <div class="h-5 w-px bg-gray-200" />

        <div class="flex items-center gap-1.5">
          <UTooltip text="ขนาดตัวอักษร" :popper="{ placement: 'top' }">
            <div class="toolbar-input-group">
              <span class="toolbar-prefix text-gray-400">
                <UIcon name="i-lucide-type" class="w-3.5 h-3.5" />
              </span>
              <input
                v-model.number="localField.fontSize"
                type="number"
                class="toolbar-input w-10"
                min="8"
                max="72"
                placeholder="14"
                @input="onPropertyChange"
              >
            </div>
          </UTooltip>

          <UTooltip text="รูปแบบฟอนต์" :popper="{ placement: 'top' }">
            <select
              v-model="localField.fontFamily"
              class="toolbar-select"
              @change="onPropertyChange"
            >
              <optgroup label="ฟอนต์ภาษาไทย">
                <option value="Sarabun">
                  Sarabun (สารบรรณ)
                </option>
                <option value="Prompt">
                  Prompt (พร้อม)
                </option>
                <option value="Mitr">
                  Mitr (มิตร)
                </option>
              </optgroup>
              <optgroup label="ฟอนต์ภาษาอังกฤษ">
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
              </optgroup>
            </select>
          </UTooltip>

          <div class="h-5 w-px bg-gray-200" />

          <!-- Bold / Italic / Underline -->
          <div class="flex items-center gap-0.5">
            <UTooltip text="ตัวหนา (Bold)" :popper="{ placement: 'top' }">
              <button
                class="toolbar-fmt-btn"
                :class="{ active: localField.fontWeight === 'bold' }"
                @click="localField.fontWeight = localField.fontWeight === 'bold' ? 'normal' : 'bold'; onPropertyChange()"
              >
                <strong>B</strong>
              </button>
            </UTooltip>
            <UTooltip text="ตัวเอียง (Italic)" :popper="{ placement: 'top' }">
              <button
                class="toolbar-fmt-btn"
                :class="{ active: localField.fontStyle === 'italic' }"
                @click="localField.fontStyle = localField.fontStyle === 'italic' ? 'normal' : 'italic'; onPropertyChange()"
              >
                <em>I</em>
              </button>
            </UTooltip>
            <UTooltip text="ขีดเส้นใต้ (Underline)" :popper="{ placement: 'top' }">
              <button
                class="toolbar-fmt-btn"
                :class="{ active: localField.textDecoration === 'underline' }"
                @click="localField.textDecoration = localField.textDecoration === 'underline' ? 'none' : 'underline'; onPropertyChange()"
              >
                <span style="text-decoration: underline;">U</span>
              </button>
            </UTooltip>
          </div>

          <div class="h-5 w-px bg-gray-200" />

          <!-- Text alignment -->
          <div class="flex items-center gap-0.5">
            <UTooltip text="ชิดซ้าย" :popper="{ placement: 'top' }">
              <button
                class="toolbar-fmt-btn"
                :class="{ active: !localField.textAlign || localField.textAlign === 'left' }"
                @click="localField.textAlign = 'left'; onPropertyChange()"
              >
                <UIcon name="i-heroicons-bars-3-bottom-left" class="w-3.5 h-3.5" />
              </button>
            </UTooltip>
            <UTooltip text="กึ่งกลาง" :popper="{ placement: 'top' }">
              <button
                class="toolbar-fmt-btn"
                :class="{ active: localField.textAlign === 'center' }"
                @click="localField.textAlign = 'center'; onPropertyChange()"
              >
                <UIcon name="i-heroicons-bars-3" class="w-3.5 h-3.5" />
              </button>
            </UTooltip>
            <UTooltip text="ชิดขวา" :popper="{ placement: 'top' }">
              <button
                class="toolbar-fmt-btn"
                :class="{ active: localField.textAlign === 'right' }"
                @click="localField.textAlign = 'right'; onPropertyChange()"
              >
                <UIcon name="i-heroicons-bars-3-bottom-right" class="w-3.5 h-3.5" />
              </button>
            </UTooltip>
          </div>

          <div class="h-5 w-px bg-gray-200" />

          <!-- Letter spacing -->
          <UTooltip text="ระยะห่างตัวอักษร (Letter Spacing)" :popper="{ placement: 'top' }">
            <div class="toolbar-input-group">
              <span class="toolbar-prefix text-gray-400">
                <UIcon name="i-heroicons-arrows-pointing-out" class="w-3.5 h-3.5" />
              </span>
              <input
                v-model.number="localField.letterSpacing"
                type="number"
                class="toolbar-input w-12"
                min="-5"
                max="20"
                step="0.5"
                placeholder="0"
                @input="onPropertyChange"
              >
            </div>
          </UTooltip>

          <div class="h-5 w-px bg-gray-200" />

          <!-- Line Height -->
          <UTooltip text="ความห่างบรรทัด (Line Height)" :popper="{ placement: 'top' }">
            <div class="toolbar-input-group">
              <span class="toolbar-prefix text-gray-400">
                <UIcon name="i-heroicons-arrows-up-down" class="w-3.5 h-3.5" />
              </span>
              <input
                v-model.number="localField.lineHeight"
                type="number"
                class="toolbar-input w-12"
                min="0.5"
                max="5"
                step="0.1"
                placeholder="1.5"
                @input="onPropertyChange"
              >
            </div>
          </UTooltip>

          <template v-if="supportsMaxLength">
            <div class="h-5 w-px bg-gray-200" />

            <UTooltip text="จำนวนตัวอักษรสูงสุด (เว้นว่าง = ไม่จำกัด)" :popper="{ placement: 'top' }">
              <div class="toolbar-input-group">
                <span class="toolbar-prefix text-gray-400">
                  <UIcon name="i-heroicons-hashtag" class="w-3.5 h-3.5" />
                </span>
                <input
                  v-model.number="localField.maxLength"
                  type="number"
                  class="toolbar-input w-14"
                  min="1"
                  max="5000"
                  step="1"
                  placeholder="∞"
                  @input="onPropertyChange"
                >
              </div>
            </UTooltip>
          </template>

          <template v-if="isDateField">
            <div class="h-5 w-px bg-gray-200" />

            <UTooltip text="ตัวคั่นวันที่ (เว้นว่าง = ไม่คั่น)" :popper="{ placement: 'top' }">
              <div class="toolbar-input-group">
                <span class="toolbar-prefix">/</span>
                <input
                  v-model="localField.dateSeparator"
                  type="text"
                  class="toolbar-input w-10"
                  maxlength="3"
                  placeholder="/"
                  @input="onPropertyChange"
                >
              </div>
            </UTooltip>

            <div class="flex items-center gap-0.5">
              <UTooltip text="แสดงวัน" :popper="{ placement: 'top' }">
                <button
                  class="toolbar-fmt-btn"
                  :class="{ active: localField.dateShowDay !== false }"
                  @click="toggleDatePart('dateShowDay')"
                >
                  D
                </button>
              </UTooltip>
              <UTooltip text="แสดงเดือน" :popper="{ placement: 'top' }">
                <button
                  class="toolbar-fmt-btn"
                  :class="{ active: localField.dateShowMonth !== false }"
                  @click="toggleDatePart('dateShowMonth')"
                >
                  M
                </button>
              </UTooltip>
              <UTooltip text="แสดงปี" :popper="{ placement: 'top' }">
                <button
                  class="toolbar-fmt-btn"
                  :class="{ active: localField.dateShowYear !== false }"
                  @click="toggleDatePart('dateShowYear')"
                >
                  Y
                </button>
              </UTooltip>
            </div>
          </template>

          <template v-if="isTimeField">
            <div class="h-5 w-px bg-gray-200" />

            <UTooltip text="ตัวคั่นเวลา (เว้นว่าง = ไม่คั่น)" :popper="{ placement: 'top' }">
              <div class="toolbar-input-group">
                <span class="toolbar-prefix">:</span>
                <input
                  v-model="localField.timeSeparator"
                  type="text"
                  class="toolbar-input w-10"
                  maxlength="3"
                  placeholder=":"
                  @input="onPropertyChange"
                >
              </div>
            </UTooltip>

            <div class="flex items-center gap-0.5">
              <UTooltip text="แสดงชั่วโมง" :popper="{ placement: 'top' }">
                <button
                  class="toolbar-fmt-btn"
                  :class="{ active: localField.timeShowHour !== false }"
                  @click="toggleTimePart('timeShowHour')"
                >
                  H
                </button>
              </UTooltip>
              <UTooltip text="แสดงนาที" :popper="{ placement: 'top' }">
                <button
                  class="toolbar-fmt-btn"
                  :class="{ active: localField.timeShowMinute !== false }"
                  @click="toggleTimePart('timeShowMinute')"
                >
                  M
                </button>
              </UTooltip>
            </div>
          </template>
        </div>
      </template>

      <div class="h-5 w-px bg-gray-200" />

      <!-- Save as default -->
      <UTooltip text="บันทึกค่าช่องนี้เป็นค่าเริ่มต้นของ Field" :popper="{ placement: 'top' }">
        <button
          class="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!selectedField?.id || isSavingDefaults"
          @click="saveDefaults"
        >
          <UIcon :name="isSavingDefaults ? 'i-heroicons-arrow-path' : 'i-heroicons-bookmark-square'" class="w-4 h-4" :class="{ 'animate-spin': isSavingDefaults }" />
        </button>
      </UTooltip>

      <div class="h-5 w-px bg-gray-200" />

      <!-- Delete -->
      <UTooltip text="ลบช่องข้อมูลนี้" :popper="{ placement: 'top' }">
        <button
          class="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          @click="removeField"
        >
          <UIcon name="i-heroicons-trash-20-solid" class="w-4 h-4" />
        </button>
      </UTooltip>
    </div>
  </div>
</template>

<style scoped>
.field-toolbar-wrapper {
  display: inline-flex;
  box-shadow:
    0 2px 8px -2px rgba(0, 0, 0, 0.05),
    0 4px 16px -4px rgba(0, 0, 0, 0.02);
}

.field-toolbar-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  -webkit-user-select: none;
  user-select: none;
}

/* Figma-style Input Group */
.toolbar-input-group {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.15s ease-in-out;
}

.toolbar-input-group:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.toolbar-prefix {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f9fafb;
  color: #6b7280;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0 6px;
  height: 26px;
  border-right: 1px solid #e5e7eb;
}

.toolbar-input {
  width: 2.75rem;
  height: 26px;
  padding: 0 4px;
  font-size: 0.75rem;
  text-align: center;
  color: #374151;
  border: none;
  background: transparent;
  outline: none;
  -webkit-user-select: text;
  user-select: text;
}

.toolbar-input:focus {
  outline: none;
}

.toolbar-select {
  height: 26px;
  padding: 0 24px 0 8px;
  font-size: 0.75rem;
  color: #374151;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  max-width: 9rem;
  -webkit-user-select: text;
  user-select: text;
  transition: all 0.15s ease-in-out;
  cursor: pointer;
}

.toolbar-select:focus {
  outline: none;
}

.toolbar-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

/* Hide number spin buttons completely */
.toolbar-input::-webkit-inner-spin-button,
.toolbar-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.toolbar-input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* Format toggle buttons (Bold / Italic / Underline / Alignment) */
.toolbar-fmt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #6b7280;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  padding: 0;
  line-height: 1;
}

.toolbar-fmt-btn:hover {
  background-color: #f3f4f6;
  border-color: #e5e7eb;
  color: #374151;
}

.toolbar-fmt-btn.active {
  background-color: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}
</style>
