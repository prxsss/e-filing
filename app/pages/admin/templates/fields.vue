<script setup>
definePageMeta({ layout: 'admin' });

const supabase = useSupabaseClient();
const fields = ref([]);
const loading = ref(false);
const errorMessage = ref(null);
const isEditing = ref(false);

const availableIcons = ref([
  { name: 'Signature', class: 'fas fa-signature' },
  { name: 'Check Mark', class: 'fas fa-check' },
  { name: 'Stamp', class: 'fas fa-stamp' },
  { name: 'Certificate', class: 'fas fa-certificate' },
  { name: 'File', class: 'fas fa-file-alt' },
  { name: 'User', class: 'fas fa-user' },
  { name: 'Calendar', class: 'fas fa-calendar' },
  { name: 'Clock', class: 'fas fa-clock' },
  { name: 'Building', class: 'fas fa-building' },
  { name: 'Company', class: 'fas fa-landmark' },
  { name: 'Phone', class: 'fas fa-phone' },
  { name: 'Email', class: 'fas fa-envelope' },
  { name: 'Location', class: 'fas fa-map-marker-alt' },
  { name: 'Document', class: 'fas fa-file-contract' },
  { name: 'Money', class: 'fas fa-money-bill' },
]);

// Use pagination composable
const {
  currentPage,
  totalItems,
  itemsPerPage,
  getPaginatedItems,
  changePage,
  setTotalItems,
} = usePagination(10);

// Computed: Paginated fields
const paginatedFields = computed(() => {
  return getPaginatedItems(fields.value);
});

function getTypeIcon(type) {
  switch (type) {
    case 'Text':
      return 'fa-font';
    case 'Credit number':
      return 'fa-credit-card';
    case 'Signature':
      return 'fa-signature';
    case 'Icon':
      return 'fa-icons';
    default:
      return 'fa-cube';
  }
}

const currentField = ref({
  id: null,
  name: '',
  label: '',
  type: 'Text',
  icon: '',
  default_width: 150,
  default_height: 40,
  is_fillable: false,
});

async function getFields() {
  try {
    const { data, error } = await supabase
      .from('contract_fields')
      .select(
        'id, name, label, type, icon, default_width, default_height, is_fillable',
      )
      .order('name');

    if (error)
      throw error;
    fields.value = data;
    setTotalItems(data.length);
  }
  catch (error) {
    console.error('Error fetching fields:', error);
  }
}

function openEditModal(field) {
  isEditing.value = true;
  currentField.value = {
    ...field,
    default_width: field.default_width || 150,
    default_height: field.default_height || 40,
    icon: field.icon || '',
  };
  $('#addFieldModal').modal('show');
}

function resetForm() {
  isEditing.value = false;
  currentField.value = {
    id: null,
    name: '',
    label: '',
    type: 'Text',
    icon: '',
    default_width: 150,
    default_height: 40,
    is_fillable: false,
  };
  errorMessage.value = null;
}

function onFillableChange() {
  if (currentField.value.is_fillable) {
    currentField.value.label = '';
  }
}

async function saveField() {
  loading.value = true;
  errorMessage.value = null;

  if (
    !currentField.value.is_fillable
    && currentField.value.type !== 'Signature'
    && currentField.value.type !== 'Icon'
    && !currentField.value.label.trim()
  ) {
    errorMessage.value = 'Label is required for non-fillable fields';
    loading.value = false;
    return;
  }

  if (
    currentField.value.default_width < 10
    || currentField.value.default_width > 1000
  ) {
    errorMessage.value = 'Width must be between 10 and 1000 pixels';
    loading.value = false;
    return;
  }

  if (
    currentField.value.default_height < 10
    || currentField.value.default_height > 500
  ) {
    errorMessage.value = 'Height must be between 10 and 500 pixels';
    loading.value = false;
    return;
  }

  try {
    let error;
    const fieldData = {
      name: currentField.value.name,
      label:
        currentField.value.type === 'Signature'
        || currentField.value.type === 'Icon'
          ? ''
          : currentField.value.label,
      type: currentField.value.type,
      icon: currentField.value.icon || null,
      default_width: currentField.value.default_width,
      default_height: currentField.value.default_height,
      is_fillable: currentField.value.is_fillable,
    };

    if (isEditing.value) {
      ({ error } = await supabase
        .from('contract_fields')
        .update(fieldData)
        .eq('id', currentField.value.id));
    }
    else {
      ({ error } = await supabase.from('contract_fields').insert([fieldData]));
    }

    if (error)
      throw error;

    const modalElement = $('#addFieldModal');
    modalElement.modal('hide');

    modalElement.one('hidden.bs.modal', () => {
      $('.modal-backdrop').remove();
      $('body').removeClass('modal-open').css('padding-right', '');
      resetForm();
    });

    await getFields();
  }
  catch (err) {
    console.error('Error saving field:', err);
    errorMessage.value = err.message;
  }
  finally {
    loading.value = false;
  }
}

async function deleteField(fieldId) {
  // User confirmation removed - replace with console warning
  console.warn('Attempting to delete field:', fieldId);

  try {
    const { error } = await supabase
      .from('contract_fields')
      .delete()
      .eq('id', fieldId);
    if (error)
      throw error;
    await getFields();
  }
  catch (error) {
    console.error('Error deleting field:', error);
  }
}

onMounted(async () => {
  await getFields();

  await nextTick();

  $('#addFieldModal').on('hide.bs.modal', () => {
    resetForm();
  });
});

watch(
  () => currentField.value.type,
  (newType) => {
    if (newType === 'Signature' || newType === 'Icon') {
      currentField.value.label = '';
    }

    if (newType !== 'Text') {
      currentField.value.is_fillable = false;
    }
  },
);
</script>

<template>
  <div>
    <div class="card card-primary shadow-sm">
      <div class="card-header bg-gradient-primary">
        <h3 class="card-title text-white">
          <i class="fas fa-list-alt mr-2" />All Fields
        </h3>
        <div class="card-tools">
          <button
            class="btn btn-light btn-sm px-4"
            data-toggle="modal"
            data-target="#addFieldModal"
          >
            <i class="fas fa-plus mr-2" /> Add New Field
          </button>
        </div>
      </div>
      <div class="card-body p-3">
        <div class="table-responsive">
          <table class="table custom-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 50px">
                  #
                </th>
                <th>Field Name</th>
                <th>Field Label</th>
                <th class="text-center" style="width: 200px">
                  Field Type
                </th>
                <th class="text-center" style="width: 100px">
                  User Input
                </th>
                <th class="text-center" style="width: 150px">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(field, index) in paginatedFields" :key="field.id">
                <td class="text-center text-muted">
                  {{ (currentPage - 1) * itemsPerPage + index + 1 }}
                </td>
                <td>
                  <span class="font-weight-medium">{{ field.name }}</span>
                </td>
                <td>{{ field.label || "-" }}</td>
                <td class="text-center">
                  <span
                    class="type-badge"
                    :class="
                      `type-${field.type.toLowerCase().replace(' ', '-')}`
                    "
                  >
                    <i class="fas" :class="getTypeIcon(field.type)" />
                    {{ field.type }}
                  </span>
                </td>
                <td class="text-center">
                  <span
                    class="status-badge"
                    :class="
                      field.is_fillable ? 'status-active' : 'status-inactive'
                    "
                  >
                    {{ field.is_fillable ? "Yes" : "No" }}
                  </span>
                </td>
                <td class="text-center">
                  <div class="action-buttons">
                    <button
                      class="btn btn-icon"
                      title="Edit"
                      @click="openEditModal(field)"
                    >
                      <i class="fas fa-edit text-warning" />
                    </button>
                    <button
                      class="btn btn-icon text-danger"
                      title="Delete"
                      @click="deleteField(field.id)"
                    >
                      <i class="fas fa-trash" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!fields || fields.length === 0">
                <td colspan="6" class="text-center py-4">
                  <div class="empty-state">
                    <i class="fas fa-list-alt fa-2x text-muted mb-2" />
                    <p class="text-muted">
                      No fields found.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Component -->
        <table-pagination
          :current-page="currentPage"
          :total-items="totalItems"
          :items-per-page="itemsPerPage"
          @page-changed="changePage"
        />
      </div>
    </div>

    <div
      id="addFieldModal"
      class="modal fade"
      tabindex="-1"
      role="dialog"
      aria-labelledby="addFieldModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="addFieldModalLabel" class="modal-title">
              <i class="fas fa-edit text-primary mr-2" />
              {{ isEditing ? "Edit Field" : "Add New Field" }}
            </h5>
            <button
              type="button"
              class="close"
              data-dismiss="modal"
              aria-label="Close"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <form @submit.prevent="saveField">
            <div class="modal-body p-4">
              <!-- Field Name and Type Row -->
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="font-weight-semibold">
                      <i class="fas fa-tag text-primary mr-1" />Field Name
                    </label>
                    <input
                      id="fieldName"
                      v-model="currentField.name"
                      type="text"
                      class="form-control form-control-lg"
                      placeholder="Enter field name"
                      required
                    >
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="font-weight-semibold">
                      <i class="fas fa-cube text-primary mr-1" />Field Type
                    </label>
                    <select
                      id="fieldType"
                      v-model="currentField.type"
                      class="form-control form-control-lg"
                      required
                    >
                      <option>Text</option>
                      <option>Credit number</option>
                      <option>Signature</option>
                      <option>Icon</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Field Label (conditional) -->
              <div
                v-if="
                  currentField.type !== 'Icon'
                    && currentField.type !== 'Signature'
                    && !currentField.is_fillable
                "
                class="form-group"
              >
                <label class="font-weight-semibold">
                  <i class="fas fa-tag text-primary mr-1" />Field Label
                  <span class="text-danger">*</span>
                </label>
                <input
                  id="fieldLabel"
                  v-model="currentField.label"
                  type="text"
                  class="form-control form-control-lg"
                  placeholder="Enter field label"
                  required
                >
              </div>

              <!-- Icon Select (conditional) -->
              <div v-if="currentField.type === 'Icon'" class="form-group">
                <label class="font-weight-semibold">
                  <i class="fas fa-icons text-primary mr-1" />Select Icon
                </label>
                <div class="input-group">
                  <select
                    id="fieldIcon"
                    v-model="currentField.icon"
                    class="form-control form-control-lg"
                    required
                  >
                    <option value="" hidden>
                      Select an icon
                    </option>
                    <option
                      v-for="icon in availableIcons"
                      :key="icon.class"
                      :value="icon.class"
                    >
                      {{ icon.name }}
                    </option>
                  </select>
                  <div v-if="currentField.icon" class="input-group-append">
                    <span class="input-group-text icon-preview">
                      <i :class="currentField.icon" />
                    </span>
                  </div>
                </div>
              </div>

              <!-- Width and Height Row -->
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="font-weight-semibold">
                      <i class="fas fa-arrows-alt-h text-primary mr-1" />Default Width (px)
                    </label>
                    <input
                      id="fieldWidth"
                      v-model.number="currentField.default_width"
                      type="number"
                      class="form-control form-control-lg"
                      min="10"
                      max="1000"
                      placeholder="150"
                      required
                    >
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="font-weight-semibold">
                      <i class="fas fa-arrows-alt-v text-primary mr-1" />Default Height (px)
                    </label>
                    <input
                      id="fieldHeight"
                      v-model.number="currentField.default_height"
                      type="number"
                      class="form-control form-control-lg"
                      min="10"
                      max="500"
                      placeholder="40"
                      required
                    >
                  </div>
                </div>
              </div>

              <!-- User Input Checkbox (conditional) -->
              <div
                v-if="
                  currentField.type === 'Text'
                    || currentField.type === 'Credit number'
                "
                class="form-group"
              >
                <div class="custom-control custom-switch">
                  <input
                    id="fieldIsFillable"
                    v-model="currentField.is_fillable"
                    type="checkbox"
                    class="custom-control-input"
                    @change="onFillableChange"
                  >
                  <label
                    class="custom-control-label font-weight-semibold"
                    for="fieldIsFillable"
                  >
                    <i class="fas fa-keyboard text-primary mr-1" />User Input?
                  </label>
                </div>
                <small class="form-text text-muted ml-4">
                  Check if this field should be filled by users. Uncheck if it
                  displays static content.
                </small>
              </div>

              <!-- Error Message -->
              <div
                v-if="errorMessage"
                class="alert alert-danger border-left-danger"
              >
                <i class="fas fa-exclamation-circle mr-2" />{{ errorMessage }}
              </div>
            </div>
            <div class="modal-footer bg-light">
              <button
                type="button"
                class="btn btn-light btn-lg"
                data-dismiss="modal"
                @click="resetForm"
              >
                <i class="fas fa-times mr-2" />Close
              </button>
              <button
                type="submit"
                class="btn btn-primary btn-lg"
                :disabled="loading"
              >
                <i class="fas fa-save mr-2" />
                {{ loading ? "Saving..." : "Save Field" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Same styles as before - truncated for brevity */
.card {
  border: none;
  border-radius: 10px;
  overflow: hidden;
}

.card-body {
  background-color: #ffffff;
}

.custom-table {
  margin-bottom: 0;
  border-spacing: 0 0.5rem !important;
  border-collapse: separate !important;
}

.custom-table th {
  background-color: #f8f9fa;
  border: none;
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
  padding: 1rem;
}

.custom-table td {
  padding: 0.5rem;
  vertical-align: middle;
  background-color: #ffffff;
  border: none;
  border-top: 1px solid #f0f0f0;
  font-size: 0.95rem;
}

.custom-table tbody tr:hover td {
  background-color: #f8f9fa;
}

.type-badge {
  padding: 0.35rem 0.8rem;
  border-radius: 50rem;
  font-size: 0.8rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.type-text {
  background-color: #e3f2fd;
  color: #1976d2;
}

.type-credit-number {
  background-color: #fff3e0;
  color: #ef6c00;
}

.type-signature {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.type-icon {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.status-badge {
  padding: 0.35rem 0.8rem;
  border-radius: 50rem;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-active {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-inactive {
  background-color: #f5f5f5;
  color: #757575;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  background-color: #ffffff;
  color: #495057;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background-color: #f8f9fa;
  border-color: #c1c9d0;
  transform: translateY(-1px);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  color: #6c757d;
}

.font-weight-medium {
  font-weight: 500;
}

.modal-content {
  border: none;
  border-radius: 10px;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.modal-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 1rem 1.5rem;
}

.modal-title {
  font-weight: 600;
  font-size: 1.1rem;
  color: #212529;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
  padding: 1rem 1.5rem;
}

.form-control-lg {
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
}

.form-control-lg:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.15);
}
</style>
