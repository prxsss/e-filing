<script setup lang="ts">
import { getAutoDateTimeFormatConfig } from '../../../shared/auto-date-time-format';
import { getFieldDisplayInstanceNumber } from '../../../shared/field-instance-number';

type Field = any;

const props = withDefaults(defineProps<{
  selectedField?: Field;
  placedFields?: Field[];
  pdfRef?: any;
  scale?: number;
  isSavingDefaults?: boolean;
}>(), {
  placedFields: () => [],
  isSavingDefaults: false,
});

const emit = defineEmits<{
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
  saveDefaults: [data: { fieldId: number | string; defaults: any }];
}>();

const localField = ref<any>({});

function getFieldType(field?: Field): string {
  return String(field?.type || field?.fieldType || '').toLowerCase();
}

function supportsConditionalSource(field?: Field): boolean {
  if (!field) {
    return false;
  }

  const fieldType = getFieldType(field);
  const fieldName = String(field.name || '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

function normalizeVisibilityRule(rawRule: any) {
  if (!rawRule || typeof rawRule !== 'object') {
    return null;
  }

  const sourceFieldInstanceId = String(rawRule.sourceFieldInstanceId ?? rawRule.source_field_instance_id ?? '').trim();
  if (!sourceFieldInstanceId.length) {
    return null;
  }

  return {
    enabled: rawRule.enabled !== false,
    sourceFieldInstanceId,
    operator: rawRule.operator === 'isUnchecked' ? 'isUnchecked' : 'isChecked',
    // Always preserve hidden field values.
    clearWhenHidden: false,
  };
}

function getConditionalSourceLabel(field?: Field): string {
  if (!field) {
    return 'Checkbox';
  }

  const baseLabel = String(field.label || field.name || 'Checkbox').trim();
  const instanceSuffix = ` #${getFieldDisplayInstanceNumber(field, props.placedFields)}`;
  return `${baseLabel}${instanceSuffix}`;
}

const conditionalSourceOptions = computed(() => {
  const selectedInstanceId = String(props.selectedField?.instanceId || '').trim();

  return (props.placedFields || [])
    .filter((field: any) => {
      if (!field) {
        return false;
      }

      const instanceId = String(field.instanceId || '').trim();
      if (!instanceId.length || instanceId === selectedInstanceId) {
        return false;
      }

      return supportsConditionalSource(field);
    })
    .map((field: any) => {
      return {
        value: String(field.instanceId),
        label: getConditionalSourceLabel(field),
      };
    });
});

function normalizeMaxLength(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return null;
  return parsed;
}

function normalizeFontSize(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0)
    return 14;
  return parsed;
}

const fontSizeInput = ref('');
const fontSizeCommitted = ref(14);

function setFontSize(nextFontSize: unknown): void {
  const normalizedFontSize = normalizeFontSize(nextFontSize);
  fontSizeCommitted.value = normalizedFontSize;
  fontSizeInput.value = String(normalizedFontSize);
  localField.value.fontSize = normalizedFontSize;
  onPropertyChange();
}

function handleFontSizeInput(): void {
  const rawValue = String(fontSizeInput.value ?? '').trim();
  if (!rawValue.length) {
    return;
  }

  const parsedFontSize = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedFontSize) || parsedFontSize <= 0) {
    return;
  }

  localField.value.fontSize = parsedFontSize;
  onPropertyChange();
}

function handleFontSizeBlur(): void {
  const rawValue = String(fontSizeInput.value ?? '').trim();
  const restoredFontSize = fontSizeCommitted.value || 14;

  if (!rawValue.length) {
    setFontSize(restoredFontSize);
    return;
  }

  const parsedFontSize = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedFontSize) || parsedFontSize <= 0) {
    setFontSize(restoredFontSize);
    return;
  }

  setFontSize(parsedFontSize);
}

const selectedFieldType = computed(() => String(props.selectedField?.type || props.selectedField?.fieldType || '').toLowerCase());
const isDateField = computed(() => selectedFieldType.value === 'date');
const isTimeField = computed(() => selectedFieldType.value === 'time');

const supportsMaxLength = computed(() => {
  return selectedFieldType.value !== 'signature'
    && selectedFieldType.value !== 'icon'
    && selectedFieldType.value !== 'date'
    && selectedFieldType.value !== 'time'
    && selectedFieldType.value !== 'checkbox';
});

const fontSizeDropdownItems = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(size => ({
  label: String(size),
  onSelect: () => {
    setFontSize(size);
  },
}));

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
  () => props.selectedField?.instanceId,
  () => {
    const newField = props.selectedField;

    if (newField) {
      const fieldType = getFieldType(newField);
      const autoDateTimeConfig = getAutoDateTimeFormatConfig(newField);
      const visibilityRule = normalizeVisibilityRule(newField.visibilityRule ?? newField.visibility_rule);
      const fontSize = normalizeFontSize(newField.fontSize ?? newField.font_size);
      localField.value = {
        ...newField,
        fontSize,
        ...autoDateTimeConfig,
        fontWeight: newField.fontWeight || 'normal',
        fontStyle: newField.fontStyle || 'normal',
        textDecoration: newField.textDecoration || 'none',
        textAlign: newField.textAlign || 'left',
        letterSpacing: fieldType === 'date' || fieldType === 'time' ? 0 : (newField.letterSpacing ?? 0),
        lineHeight: newField.lineHeight ?? 1.5,
        maxLength: normalizeMaxLength(newField.maxLength ?? newField.max_length),
        conditionalEnabled: Boolean(visibilityRule),
        conditionalSourceFieldInstanceId: visibilityRule?.sourceFieldInstanceId || '',
        conditionalOperator: visibilityRule?.operator || 'isChecked',
      };

      fontSizeCommitted.value = fontSize;
      fontSizeInput.value = String(fontSize);
    }
    else {
      localField.value = {};
      fontSizeInput.value = '';
      fontSizeCommitted.value = 14;
    }
  },
  { immediate: true },
);

function toggleConditionalVisibility() {
  if (!localField.value) {
    return;
  }

  localField.value.conditionalEnabled = !localField.value.conditionalEnabled;
  if (!localField.value.conditionalEnabled) {
    localField.value.conditionalSourceFieldInstanceId = '';
  }

  onPropertyChange();
}

function onPropertyChange() {
  if (!localField.value || !props.selectedField)
    return;

  const autoDateTimeConfig = getAutoDateTimeFormatConfig(localField.value);

  const dateTimeFormatUpdates = isDateField.value
    ? {
        dateSeparator: autoDateTimeConfig.dateSeparator,
        dateSeparatorSpacing: autoDateTimeConfig.dateSeparatorSpacing,
        dateShowDay: autoDateTimeConfig.dateShowDay,
        dateShowMonth: autoDateTimeConfig.dateShowMonth,
        dateShowYear: autoDateTimeConfig.dateShowYear,
      }
    : isTimeField.value
      ? {
          timeSeparator: autoDateTimeConfig.timeSeparator,
          timeSeparatorSpacing: autoDateTimeConfig.timeSeparatorSpacing,
          timeShowHour: autoDateTimeConfig.timeShowHour,
          timeShowMinute: autoDateTimeConfig.timeShowMinute,
        }
      : {};

  const commonStyleUpdates = {
    fontSize: normalizeFontSize(localField.value.fontSize),
    fontFamily: localField.value.fontFamily || 'Arial',
    fontWeight: localField.value.fontWeight || 'normal',
    fontStyle: localField.value.fontStyle || 'normal',
    textDecoration: localField.value.textDecoration || 'none',
    textAlign: localField.value.textAlign || 'left',
    letterSpacing: isDateField.value || isTimeField.value ? 0 : (localField.value.letterSpacing ?? 0),
    lineHeight: localField.value.lineHeight ?? 1.5,
    maxLength: supportsMaxLength.value ? normalizeMaxLength(localField.value.maxLength) : null,
    visibilityRule: localField.value.conditionalEnabled
      ? normalizeVisibilityRule({
          enabled: true,
          sourceFieldInstanceId: localField.value.conditionalSourceFieldInstanceId,
          operator: localField.value.conditionalOperator,
          clearWhenHidden: false,
        })
      : null,
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
        dateSeparatorSpacing: autoDateTimeConfig.dateSeparatorSpacing,
        dateShowDay: autoDateTimeConfig.dateShowDay,
        dateShowMonth: autoDateTimeConfig.dateShowMonth,
        dateShowYear: autoDateTimeConfig.dateShowYear,
      }
    : isTimeField.value
      ? {
          timeSeparator: autoDateTimeConfig.timeSeparator,
          timeSeparatorSpacing: autoDateTimeConfig.timeSeparatorSpacing,
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
      fontSize: normalizeFontSize(localField.value.fontSize),
      fontWeight: localField.value.fontWeight || 'normal',
      fontStyle: localField.value.fontStyle || 'normal',
      textDecoration: localField.value.textDecoration || 'none',
      textAlign: localField.value.textAlign || 'left',
      letterSpacing: isDateField.value || isTimeField.value ? 0 : (localField.value.letterSpacing ?? 0),
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
      <!-- Font (text fields only) -->
      <template v-if="selectedFieldType !== 'icon' && selectedFieldType !== 'signature' && selectedFieldType !== 'checkbox'">
        <div class="h-5 w-px bg-gray-200" />
        <div class="flex items-center gap-1.5">
          <UTooltip text="ขนาดตัวอักษร" :popper="{ placement: 'top' }">
            <div class="toolbar-input-group">
              <span class="toolbar-prefix text-gray-400">
                <UIcon name="i-lucide-type" class="w-3.5 h-3.5" />
              </span>
              <input
                v-model="fontSizeInput"
                type="number"
                class="toolbar-input w-10"
                min="8"
                max="72"
                placeholder="14"
                @input="handleFontSizeInput"
                @blur="handleFontSizeBlur"
              >

              <UDropdownMenu
                :items="fontSizeDropdownItems"
                :content="{
                  align: 'end',
                  side: 'bottom',
                }"
                :ui="{
                  content: 'min-w-15 w-15',
                }"
              >
                <button
                  type="button"
                  class="font-size-dropdown-trigger"
                  aria-label="เลือกขนาดตัวอักษร"
                >
                  <UIcon name="i-lucide-chevron-down" class="w-3.5 h-3.5" />
                </button>
              </UDropdownMenu>
            </div>
          </UTooltip>

          <UTooltip text="รูปแบบฟอนต์" :popper="{ placement: 'top' }">
            <select
              v-model="localField.fontFamily"
              class="toolbar-select"
              @change="onPropertyChange"
            >
              <option value="Sarabun">
                Sarabun (สารบรรณ)
              </option>
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

          <template v-if="!isDateField && !isTimeField">
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
          </template>

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

            <UTooltip text="ระยะห่างตัวคั่นวันที่" :popper="{ placement: 'top' }">
              <div class="toolbar-input-group">
                <span class="toolbar-prefix">gap</span>
                <input
                  v-model.number="localField.dateSeparatorSpacing"
                  type="number"
                  class="toolbar-input w-10"
                  min="0"
                  step="1"
                  placeholder="0"
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

            <UTooltip text="ระยะห่างตัวคั่นเวลา" :popper="{ placement: 'top' }">
              <div class="toolbar-input-group">
                <span class="toolbar-prefix">gap</span>
                <input
                  v-model.number="localField.timeSeparatorSpacing"
                  type="number"
                  class="toolbar-input w-10"
                  min="0"
                  step="1"
                  placeholder="0"
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

      <!-- Conditional visibility toggle (details shown in second row) -->
      <UTooltip text="แสดงช่องนี้ตามเงื่อนไขจาก Checkbox" :popper="{ placement: 'top' }">
        <button
          class="toolbar-fmt-btn"
          :class="{ active: localField.conditionalEnabled }"
          @click="toggleConditionalVisibility"
        >
          <UIcon name="i-heroicons-adjustments-horizontal" class="w-3.5 h-3.5" />
        </button>
      </UTooltip>

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

    <div v-if="localField.conditionalEnabled" class="conditional-toolbar-row">
      <div class="conditional-toolbar-inline">
        <span class="conditional-toolbar-label">
          <UIcon name="i-heroicons-funnel" class="w-3.5 h-3.5" />
          เงื่อนไขการแสดงผลจาก Checkbox
        </span>

        <select
          v-model="localField.conditionalSourceFieldInstanceId"
          class="toolbar-select conditional-select"
          @change="onPropertyChange"
        >
          <option value="" disabled>
            เลือก Checkbox
          </option>
          <option
            v-for="option in conditionalSourceOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <select
          v-model="localField.conditionalOperator"
          class="toolbar-select conditional-select"
          @change="onPropertyChange"
        >
          <option value="isChecked">
            ติ๊กแล้ว
          </option>
          <option value="isUnchecked">
            ไม่ติ๊ก
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-toolbar-wrapper {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  max-width: 100%;
  box-shadow:
    0 2px 8px -2px rgba(0, 0, 0, 0.05),
    0 4px 16px -4px rgba(0, 0, 0, 0.02);
}

.field-toolbar-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  -webkit-user-select: none;
  user-select: none;
}

.conditional-toolbar-row {
  border-top: 1px dashed #e5e7eb;
  padding-top: 0.5rem;
}

.conditional-toolbar-inline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.conditional-toolbar-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 9999px;
  padding: 0.2rem 0.5rem;
  white-space: nowrap;
}

.conditional-select {
  max-width: 16rem;
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

.font-size-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 26px;
  padding: 0;
  border: none;
  border-left: 1px solid #e5e7eb;
  background-color: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  flex-shrink: 0;
}

.font-size-dropdown-trigger:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.font-size-dropdown-trigger:focus {
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
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.toolbar-inline-checkbox {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: #6b7280;
  white-space: nowrap;
}

.toolbar-inline-checkbox input {
  width: 0.75rem;
  height: 0.75rem;
  accent-color: #3b82f6;
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
