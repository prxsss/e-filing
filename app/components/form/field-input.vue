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

const localValue = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

// Get appropriate input type based on field type
const inputType = computed(() => {
  switch (props.field.type?.toLowerCase()) {
    case 'date':
      return 'date';
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'phone':
      return 'tel';
    default:
      return 'text';
  }
});

// Get placeholder text
const placeholder = computed(() => {
  if (props.field.label) {
    return `Enter ${props.field.label}`;
  }
  return `Enter ${props.field.name || 'value'}`;
});
</script>

<template>
  <div class="field-input">
    <label v-if="field.label || field.name" class="field-label">
      <i v-if="field.icon" :class="field.icon" class="mr-2" />
      {{ field.label || field.name }}
    </label>

    <input
      v-model="localValue"
      :type="inputType"
      :placeholder="placeholder"
      :disabled="disabled"
      class="form-input"
    >
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

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: all 0.2s;
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
</style>
