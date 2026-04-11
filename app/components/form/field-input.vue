<script setup>
import { getStudentYear } from '../../utils/student';

const props = defineProps({
  field: {
    type: Object,
    required: true,
  },
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  renderAsRadio: {
    type: Boolean,
    default: false,
  },
  hideRequiredAsterisk: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);
const { user } = useUserSession();

const fieldType = computed(() => String(props.field?.type || props.field?.fieldType || '').toLowerCase());
const sessionFieldBinding = computed(() => {
  const binding = String(props.field?.sessionField ?? props.field?.session_field ?? '').trim();
  if (['studentName', 'studentId', 'studentYearCurrent', 'facultyNameTh', 'departmentNameTh', 'departmentCode', 'titleThAutoChecked', 'titleThMrChecked', 'titleThMissChecked', 'titleThMrsChecked'].includes(binding)) {
    return binding;
  }

  const fallbackName = String(props.field?.name ?? props.field?.label ?? '').trim().toLowerCase();
  if (['student name', 'ชื่อนิสิต', 'ชื่อ นิสิต'].includes(fallbackName)) {
    return 'studentName';
  }
  if (['student id', 'รหัสนิสิต', 'รหัส นิสิต'].includes(fallbackName)) {
    return 'studentId';
  }
  if (['student year', 'year level', 'ชั้นปี', 'ชั้นปีนิสิต'].includes(fallbackName)) {
    return 'studentYearCurrent';
  }
  if (['faculty', 'คณะ'].includes(fallbackName)) {
    return 'facultyNameTh';
  }
  if (['department', 'major', 'สาขา'].includes(fallbackName)) {
    return 'departmentNameTh';
  }
  if (['department code', 'major code', 'รหัสสาขา'].includes(fallbackName)) {
    return 'departmentCode';
  }

  return null;
});
const isSessionBoundField = computed(() => sessionFieldBinding.value !== null);
const isStudentNameField = computed(() => sessionFieldBinding.value === 'studentName');
const isStudentIdField = computed(() => sessionFieldBinding.value === 'studentId');
const isStudentYearField = computed(() => sessionFieldBinding.value === 'studentYearCurrent');
const isFacultyNameField = computed(() => sessionFieldBinding.value === 'facultyNameTh');
const isDepartmentNameField = computed(() => sessionFieldBinding.value === 'departmentNameTh');
const isDepartmentCodeField = computed(() => sessionFieldBinding.value === 'departmentCode');
const isTitleAutoCheckboxField = computed(() => sessionFieldBinding.value === 'titleThAutoChecked');
const isTitleMrCheckboxField = computed(() => sessionFieldBinding.value === 'titleThMrChecked');
const isTitleMissCheckboxField = computed(() => sessionFieldBinding.value === 'titleThMissChecked');
const isTitleMrsCheckboxField = computed(() => sessionFieldBinding.value === 'titleThMrsChecked');
const sessionFullNameTh = computed(() => String(user.value?.fullNameTh ?? user.value?.fullNameEn ?? ''));
const sessionStudentId = computed(() => String(user.value?.studentId ?? ''));
const sessionTitleTh = computed(() => String(user.value?.titleTh ?? '').trim());
const sessionFacultyNameTh = computed(() => String(user.value?.facultyNameTh ?? ''));
const sessionDepartmentNameTh = computed(() => String(user.value?.departmentNameTh ?? ''));
const sessionDepartmentCode = computed(() => String(user.value?.departmentCode ?? ''));
const sessionStudentYearCurrent = computed(() => {
  const studentId = String(user.value?.studentId ?? '').trim();
  if (!studentId) {
    return '';
  }
  const currentYear = getStudentYear(studentId);
  return Number.isFinite(currentYear) ? String(currentYear) : '';
});

function inferTitleFromField(field) {
  const candidates = [field?.formQuestionLabel, field?.label, field?.name]
    .map(value => String(value ?? '').trim().toLowerCase())
    .filter(value => value.length > 0);

  for (const text of candidates) {
    if (text.includes('นางสาว') || text.includes('miss') || text.includes('ms.')) {
      return 'นางสาว';
    }
    if (text.includes('นาง') || text.includes('mrs')) {
      return 'นาง';
    }
    if (text.includes('นาย') || text.includes(' mr') || text.startsWith('mr')) {
      return 'นาย';
    }
  }

  return null;
}

const sessionBoundValue = computed(() => {
  if (isStudentNameField.value) {
    return sessionFullNameTh.value;
  }
  if (isStudentIdField.value) {
    return sessionStudentId.value;
  }
  if (isStudentYearField.value) {
    return sessionStudentYearCurrent.value;
  }
  if (isFacultyNameField.value) {
    return sessionFacultyNameTh.value;
  }
  if (isDepartmentNameField.value) {
    return sessionDepartmentNameTh.value;
  }
  if (isDepartmentCodeField.value) {
    return sessionDepartmentCode.value;
  }
  if (isTitleAutoCheckboxField.value) {
    const fieldTitle = inferTitleFromField(props.field);
    return fieldTitle !== null && sessionTitleTh.value === fieldTitle ? 'true' : '';
  }
  if (isTitleMrCheckboxField.value) {
    return sessionTitleTh.value === 'นาย' ? 'true' : '';
  }
  if (isTitleMissCheckboxField.value) {
    return sessionTitleTh.value === 'นางสาว' ? 'true' : '';
  }
  if (isTitleMrsCheckboxField.value) {
    return sessionTitleTh.value === 'นาง' ? 'true' : '';
  }
  return '';
});
const isNumericField = computed(() => fieldType.value === 'number');
const isCheckboxField = computed(() => fieldType.value === 'checkbox');
const isDateField = computed(() => fieldType.value === 'date');
const isTimeField = computed(() => fieldType.value === 'time');
const isDropdownField = computed(() => fieldType.value === 'dropdown');
const checkboxGroupId = computed(() => String(props.field?.groupId ?? '').trim());
const renderCheckboxAsRadio = computed(() => {
  return Boolean(props.renderAsRadio) && isCheckboxField.value && checkboxGroupId.value.length > 0;
});

const isMultilineTextField = computed(() =>
  !isCheckboxField.value
  && !isDropdownField.value
  && !isNumericField.value
  && !isDateField.value
  && !isTimeField.value,
);

const dropdownConfig = computed(() => {
  const rawConfig = props.field?.dropdownConfig ?? props.field?.dropdown_config;
  if (!rawConfig || typeof rawConfig !== 'object') {
    return null;
  }

  const sourceTable = String(rawConfig.sourceTable ?? rawConfig.source_table ?? '').trim();
  const labelColumn = String(rawConfig.labelColumn ?? rawConfig.label_column ?? '').trim();
  const roleId = Number.parseInt(String(rawConfig.roleId ?? rawConfig.role_id ?? ''), 10);
  const dataLabel = String(rawConfig.dataLabel ?? rawConfig.data_label ?? '').trim();
  if (!sourceTable) {
    return null;
  }

  if (sourceTable === 'users') {
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return null;
    }

    return {
      sourceTable,
      roleId,
      dataLabel,
    };
  }

  if (!labelColumn) {
    return null;
  }

  return {
    sourceTable,
    labelColumn,
    dataLabel,
  };
});

const dropdownOptions = ref([]);
const isLoadingDropdownOptions = ref(false);

async function loadDropdownOptions() {
  if (!isDropdownField.value || !dropdownConfig.value) {
    dropdownOptions.value = [];
    return;
  }

  isLoadingDropdownOptions.value = true;
  try {
    const response = await $fetch('/api/template-fields/dropdown-options', {
      query: {
        table: dropdownConfig.value.sourceTable,
        labelColumn: dropdownConfig.value.labelColumn,
        roleId: dropdownConfig.value.roleId,
      },
    });

    if (response?.success && Array.isArray(response.data)) {
      dropdownOptions.value = response.data
        .filter(item => item && (item.id ?? null) !== null)
        .map(item => ({
          value: String(item.id),
          label: String(item.label ?? item.id),
        }));
      return;
    }

    dropdownOptions.value = [];
  }
  catch (error) {
    console.error('Error loading dropdown options:', error);
    dropdownOptions.value = [];
  }
  finally {
    isLoadingDropdownOptions.value = false;
  }
}

/** From template Form Layout (`formRequired`); default required when unset */
const showRequiredAsterisk = computed(() => {
  if (props.hideRequiredAsterisk) {
    return false;
  }

  const f = props.field;
  if (!f || typeof f !== 'object') {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(f, 'formRequired')) {
    return f.formRequired !== false;
  }
  if (Object.prototype.hasOwnProperty.call(f, 'form_required')) {
    return f.form_required !== false;
  }
  return true;
});

function normalizeCheckboxValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
}

const checkboxChecked = computed(() => normalizeCheckboxValue(props.modelValue) === 'true');

const maxLength = computed(() => {
  const rawValue = props.field?.maxLength ?? props.field?.max_length;
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
});

function normalizeInputValue(value) {
  let normalizedValue = String(value ?? '');

  if (isCheckboxField.value) {
    return normalizeCheckboxValue(normalizedValue);
  }

  if (isDropdownField.value) {
    const trimmed = normalizedValue.trim();
    if (!trimmed) {
      return '';
    }

    if (!dropdownOptions.value.length) {
      return trimmed;
    }

    const hasOption = dropdownOptions.value.some(option => option.value === trimmed);
    return hasOption ? trimmed : '';
  }

  // Number fields are rendered as text with numeric input mode so maxlength
  // can block extra typing in real-time.
  if (isNumericField.value) {
    // Allow digits, one decimal point and an optional leading minus sign.
    normalizedValue = normalizedValue.replace(/[^0-9.\-]/g, '');
    // Keep only the first dot
    const firstDot = normalizedValue.indexOf('.');
    if (firstDot !== -1) {
      normalizedValue = normalizedValue.slice(0, firstDot + 1) + normalizedValue.slice(firstDot + 1).replace(/\./g, '');
    }
    // Allow only one leading minus; move any minus to the front
    const hasMinus = normalizedValue.includes('-');
    normalizedValue = normalizedValue.replace(/-/g, '');
    if (hasMinus) {
      normalizedValue = `-${normalizedValue}`;
    }
  }

  if (!maxLength.value || fieldType.value === 'date' || fieldType.value === 'time') {
    return normalizedValue;
  }
  if (normalizedValue.length <= maxLength.value) {
    return normalizedValue;
  }
  return normalizedValue.slice(0, maxLength.value);
}

const localValue = computed({
  get: () => {
    if (isSessionBoundField.value) {
      return sessionBoundValue.value;
    }

    return normalizeInputValue(props.modelValue);
  },
  set: (value) => {
    if (isSessionBoundField.value) {
      emit('update:modelValue', sessionBoundValue.value);
      return;
    }

    emit('update:modelValue', normalizeInputValue(value));
  },
});

function handleCheckboxChange(event) {
  const target = event.target;
  if (renderCheckboxAsRadio.value) {
    if (target?.checked) {
      emit('update:modelValue', 'true');
    }
    return;
  }

  emit('update:modelValue', target?.checked ? 'true' : '');
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (isSessionBoundField.value) {
      if (String(newValue ?? '') !== sessionBoundValue.value) {
        emit('update:modelValue', sessionBoundValue.value);
      }
      return;
    }

    const normalizedValue = normalizeInputValue(newValue);
    if (normalizedValue !== String(newValue ?? '')) {
      emit('update:modelValue', normalizedValue);
    }
  },
);

watch(
  [isSessionBoundField, sessionBoundValue],
  ([isTargetField, boundValue]) => {
    if (!isTargetField) {
      return;
    }

    if (String(props.modelValue ?? '') !== boundValue) {
      emit('update:modelValue', boundValue);
    }
  },
  { immediate: true },
);

// Get appropriate input type based on field type
const inputType = computed(() => {
  switch (fieldType.value) {
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'number':
      return 'text';
    default:
      return 'text';
  }
});

const inputMode = computed(() => {
  if (isNumericField.value) {
    // Prefer decimal input mode on supporting browsers for decimal and minus
    return 'decimal';
  }

  return undefined;
});

// Get placeholder text
const placeholder = computed(() => {
  if (isDropdownField.value) {
    const dataLabel = String(dropdownConfig.value?.dataLabel ?? '').trim();
    return dataLabel.length > 0 ? `เลือก${dataLabel}` : 'เลือกข้อมูล';
  }

  if (props.field.label) {
    return `Enter ${props.field.label}`;
  }
  return `Enter ${props.field.name || 'value'}`;
});

const currentLength = computed(() => localValue.value.length);

const textAreaRef = ref(null);

function adjustTextareaHeight() {
  const el = textAreaRef.value;
  if (!el || !isMultilineTextField.value) {
    return;
  }
  el.style.height = 'auto';
  const minPx = 40;
  el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
}

watch(localValue, () => {
  nextTick(adjustTextareaHeight);
});

watch(isMultilineTextField, () => {
  nextTick(adjustTextareaHeight);
});

watch([isDropdownField, dropdownConfig], async () => {
  await loadDropdownOptions();
}, { immediate: true });

onMounted(() => {
  nextTick(adjustTextareaHeight);
});
</script>

<template>
  <div class="field-input">
    <template v-if="isCheckboxField">
      <label class="field-checkbox-row">
        <input
          :checked="checkboxChecked"
          :type="renderCheckboxAsRadio ? 'radio' : 'checkbox'"
          :name="renderCheckboxAsRadio ? checkboxGroupId : undefined"
          :disabled="disabled || isSessionBoundField"
          :class="renderCheckboxAsRadio ? 'form-radio' : 'form-checkbox'"
          @change="handleCheckboxChange"
        >
        <span class="field-label mb-0">
          <i v-if="field.icon" :class="field.icon" class="mr-2" />
          {{ field.label || field.name }}
          <abbr v-if="showRequiredAsterisk" class="text-red-500 no-underline ml-0.5 font-semibold" title="จำเป็นต้องกรอก">*</abbr>
        </span>
      </label>
    </template>
    <template v-else>
      <label v-if="field.label || field.name" class="field-label">
        <i v-if="field.icon" :class="field.icon" class="mr-2" />
        {{ field.label || field.name }}
        <abbr v-if="showRequiredAsterisk" class="text-red-500 no-underline ml-0.5 font-semibold" title="จำเป็นต้องกรอก">*</abbr>
      </label>

      <textarea
        v-if="isMultilineTextField"
        :id="field.instanceId ? `field-text-${field.instanceId}` : undefined"
        ref="textAreaRef"
        v-model="localValue"
        :placeholder="placeholder"
        :disabled="disabled || isSessionBoundField"
        :maxlength="maxLength || undefined"
        rows="1"
        class="form-input form-textarea"
        @input="adjustTextareaHeight"
      />
      <select
        v-else-if="isDropdownField"
        v-model="localValue"
        :disabled="disabled || isLoadingDropdownOptions"
        class="form-input"
      >
        <option value="">
          {{ isLoadingDropdownOptions ? 'กำลังโหลดข้อมูล...' : placeholder }}
        </option>
        <option v-for="option in dropdownOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        v-else
        v-model="localValue"
        :type="inputType"
        :inputmode="inputMode"
        :placeholder="placeholder"
        :disabled="disabled || isSessionBoundField"
        :maxlength="maxLength || undefined"
        class="form-input"
      >
      <p v-if="maxLength" class="field-helper">
        {{ currentLength }}/{{ maxLength }} characters
      </p>
    </template>
  </div>
</template>

<style scoped>
.field-input {
  margin-bottom: 1rem;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.field-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #10b981;
  flex-shrink: 0;
}

.form-radio {
  width: 1rem;
  height: 1rem;
  accent-color: #10b981;
  flex-shrink: 0;
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-textarea {
  display: block;
  resize: none;
  overflow-y: hidden;
  min-height: 2.5rem;
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.field-helper {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: #6b7280;
  text-align: right;
}
</style>
