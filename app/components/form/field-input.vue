<script setup>
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
});

const emit = defineEmits(['update:modelValue']);

const fieldType = computed(() => String(props.field?.type || props.field?.fieldType || '').toLowerCase());
const isNumericField = computed(() => fieldType.value === 'number');
const isCheckboxField = computed(() => fieldType.value === 'checkbox');
const isDateField = computed(() => fieldType.value === 'date');
const isTimeField = computed(() => fieldType.value === 'time');

const isMultilineTextField = computed(() =>
  !isCheckboxField.value
  && !isNumericField.value
  && !isDateField.value
  && !isTimeField.value,
);

/** From template Form Layout (`formRequired`); default required when unset */
const showRequiredAsterisk = computed(() => {
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
  get: () => normalizeInputValue(props.modelValue),
  set: value => emit('update:modelValue', normalizeInputValue(value)),
});

function handleCheckboxChange(event) {
  const target = event.target;
  emit('update:modelValue', target?.checked ? 'true' : '');
}

watch(
  () => props.modelValue,
  (newValue) => {
    const normalizedValue = normalizeInputValue(newValue);
    if (normalizedValue !== String(newValue ?? '')) {
      emit('update:modelValue', normalizedValue);
    }
  },
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
          type="checkbox"
          :disabled="disabled"
          class="form-checkbox"
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
        :disabled="disabled"
        :maxlength="maxLength || undefined"
        rows="1"
        class="form-input form-textarea"
        @input="adjustTextareaHeight"
      />
      <input
        v-else
        v-model="localValue"
        :type="inputType"
        :inputmode="inputMode"
        :placeholder="placeholder"
        :disabled="disabled"
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
