<script setup>
const emit = defineEmits(['fieldAdded']);
// const supabase = useSupabaseClient(); // Temporarily disabled

// Mock fields data
const availableFields = ref([
  { id: 1, name: 'Student Name', label: 'Student Name', type: 'Text', icon: 'fas fa-user', is_fillable: true, default_width: 200, default_height: 40 },
  { id: 2, name: 'Student ID', label: 'Student ID', type: 'Text', icon: 'fas fa-id-card', is_fillable: true, default_width: 150, default_height: 40 },
  { id: 3, name: 'Email', label: 'Email Address', type: 'Text', icon: 'fas fa-envelope', is_fillable: true, default_width: 250, default_height: 40 },
  { id: 4, name: 'Phone', label: 'Phone Number', type: 'Text', icon: 'fas fa-phone', is_fillable: true, default_width: 150, default_height: 40 },
  { id: 5, name: 'Date', label: 'Date', type: 'Date', icon: 'fas fa-calendar', is_fillable: true, default_width: 150, default_height: 40 },
  { id: 'default-signature', name: 'Signature Box', label: 'Signature', type: 'Signature', icon: 'fas fa-signature', is_fillable: false, default_width: 200, default_height: 80 },
  { id: 'default-checkmark', name: 'Check Mark', label: 'Check Mark', type: 'Icon', icon: 'fas fa-check', is_fillable: false, default_width: 30, default_height: 30 },
]);
const searchQuery = ref('');

const filteredFields = computed(() => {
  if (!searchQuery.value.trim()) {
    return availableFields.value;
  }

  const query = searchQuery.value.toLowerCase();
  return availableFields.value.filter((field) => {
    const name = (field.name || '').toLowerCase();
    const label = (field.label || '').toLowerCase();
    return name.includes(query) || label.includes(query);
  });
});

async function fetchFields() {
  // Temporarily disabled - using mock data instead
  console.warn('Using mock fields data - database fetch disabled');

  /*
  try {
    const { data, error } = await supabase
      .from("contract_fields")
      .select("*")
      .order("name");

    if (!error) {
      availableFields.value = data || [];
    }
  } catch (err) {
    console.error(err);
  }
  */
}

function addField(field) {
  emit('fieldAdded', field);
}

onMounted(async () => {
  await fetchFields();
});
</script>

<template>
  <div class="card shadow-sm">
    <div class="card-header">
      <i class="fas fa-list-alt mr-2" />Available Fields
    </div>
    <div class="card-body p-2">
      <input
        v-model="searchQuery"
        type="text"
        class="form-control form-control-sm mb-2 search-input"
        placeholder="Search fields..."
      >

      <div class="fields-list">
        <div v-for="field in filteredFields" :key="field.id" class="field-item">
          <div class="field-info">
            <i :class="field.icon || 'fas fa-edit'" class="field-icon" />
            <span class="field-name">{{ field.label || field.name }}</span>
          </div>
          <button class="btn-add" title="Add field" @click="addField(field)">
            <i class="fas fa-plus" />
          </button>
        </div>

        <div v-if="filteredFields.length === 0" class="no-results">
          <i class="fas fa-search" />
          <span>No fields found</span>
        </div>
      </div>
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

/* Search Input */
.search-input {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.15);
  outline: none;
}

/* Fields List */
.fields-list {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

.fields-list::-webkit-scrollbar {
  width: 6px;
}

.fields-list::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

.fields-list::-webkit-scrollbar-thumb {
  background: #dee2e6;
  border-radius: 3px;
}

.fields-list::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

/* Field Item */
.field-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.5rem;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s ease;
}

.field-item:hover {
  background: #f8f9fa;
  border-radius: 6px;
  border-color: #007bff;
}

.field-item:last-child {
  border-bottom: none;
}

.field-info {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
  min-width: 0;
  color: #495057;
}

.field-icon {
  color: #6c757d;
  font-size: 0.875rem;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.field-name {
  font-size: 0.875rem;
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

/* Add Button */
.btn-add {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-add:hover {
  background-color: #0056b3;
  border-color: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.25);
}

.btn-add:active {
  transform: translateY(0);
}

/* No Results */
.no-results {
  text-align: center;
  padding: 2.5rem 1rem;
  color: #6c757d;
}

.no-results i {
  display: block;
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

.no-results span {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Utility Classes */
.mr-2 {
  margin-right: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}
</style>
