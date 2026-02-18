<script lang="ts" setup>
definePageMeta({
  title: 'requestDetails',
});

// --- Types ---
type FieldValue = {
  fieldId: number;
  value: string;
};

type RequestData = {
  id: number;
  templateId: number | null;
  status: string;
  filledDocumentUrl: string | null;
  createdAt: string;
  submittedAt: string | null;
};

type TemplateData = {
  id: number;
  name: string;
  documentUrl: string | null;
  placedFieldsData: any[] | null;
};

type Attachment = {
  id: number;
  requestId: number;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
};

// --- State ---
const route = useRoute();
const requestId = route.params.id;
const isLoading = ref(true);
const isSaving = ref(false);
const error = ref<string | null>(null);
const successMessage = ref('');

// Request data
const requestData = ref<RequestData | null>(null);
const templateData = ref<TemplateData | null>(null);
const pdfFile = ref<File | null>(null);
const placedFields = ref<any[]>([]);
const fieldValues = ref<Record<number, string>>({});
const scale = ref(1);

// Attachments
const attachments = ref<Attachment[]>([]);
const isUploadingAttachment = ref(false);
const isDeletingAttachment = ref<number | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// --- Methods ---
// Convert URL to File object
async function urlToFile(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }
  catch (err) {
    console.error('Error converting URL to File:', err);
    throw err;
  }
}

// Fetch request and field values
async function fetchRequestData() {
  isLoading.value = true;
  error.value = null;

  try {
    // Fetch request details
    const requestResult: any = await $fetch(`/api/requests/${requestId}`);

    if (requestResult.success && requestResult.data) {
      requestData.value = requestResult.data.request as RequestData;

      // Load existing field values
      if (requestResult.data.fieldValues) {
        requestResult.data.fieldValues.forEach((fv: any) => {
          fieldValues.value[fv.fieldId] = fv.value || '';
        });
      }

      // Fetch template details
      if (requestData.value?.templateId) {
        const templateResult: any = await $fetch(`/api/pdf-templates/${requestData.value.templateId}`);

        if (templateResult.success && templateResult.data) {
          templateData.value = templateResult.data as TemplateData;

          // Load PDF file from URL
          if (templateData.value?.documentUrl) {
            const filename = templateData.value.documentUrl.split('/').pop() || 'template.pdf';
            pdfFile.value = await urlToFile(templateData.value.documentUrl, filename);
          }

          // Set placed fields
          if (templateData.value?.placedFieldsData) {
            placedFields.value = (templateData.value.placedFieldsData as any[]).filter(
              (field: any) => field.isFillable !== false,
            );
          }
        }
      }
    }
    else {
      error.value = 'Request not found';
    }
  }
  catch (err: any) {
    console.error('Error fetching request:', err);
    error.value = err?.message || 'Failed to load request';
  }
  finally {
    isLoading.value = false;
  }
}

// Save field values
async function saveFieldValues() {
  isSaving.value = true;
  error.value = null;
  successMessage.value = '';

  try {
    const fieldValuesArray: FieldValue[] = Object.entries(fieldValues.value).map(
      ([fieldId, value]) => ({
        fieldId: Number.parseInt(fieldId),
        value: value || '',
      }),
    );

    const result: any = await $fetch(`/api/requests/${requestId}/field-values`, {
      method: 'POST',
      body: {
        fieldValues: fieldValuesArray,
      },
    });

    if (result.success) {
      successMessage.value = 'Saved successfully!';
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
    }
    else {
      error.value = (result.error as string) || 'Failed to save';
    }
  }
  catch (err: any) {
    console.error('Error saving field values:', err);
    error.value = err?.message || 'Failed to save field values';
  }
  finally {
    isSaving.value = false;
  }
}

// Submit request
async function submitRequest() {
  isSaving.value = true;
  error.value = null;

  try {
    // 1. Save field values first
    await saveFieldValues();

    if (error.value) {
      return; // Stop if saving failed
    }

    // 2. Generate filled PDF
    const pdfResult = await $fetch(`/api/requests/${requestId}/generate-filled-pdf`, {
      method: 'POST',
    });

    if (!pdfResult.success) {
      error.value = 'Failed to generate PDF';
      return;
    }

    // 3. Update request status to submitted
    const updateResult: any = await $fetch(`/api/requests/${requestId}`, {
      method: 'PATCH',
      body: {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      },
    });

    if (updateResult.success) {
      // Success! Navigate back to my requests
      navigateTo('/student/my-requests');
    }
    else {
      error.value = (updateResult.error as string) || 'Failed to submit request';
    }
  }
  catch (err: any) {
    console.error('Error submitting request:', err);
    error.value = err?.message || 'Failed to submit request';
  }
  finally {
    isSaving.value = false;
  }
}

// Get fillable fields only
const fillableFields = computed(() => {
  return placedFields.value.filter((field: any) => field.isFillable !== false);
});

// Open PDF in new tab
function openPdfInNewTab(url: string) {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
}

// --- Attachment Methods ---
// Fetch attachments
async function fetchAttachments() {
  try {
    const result: any = await $fetch(`/api/requests/${requestId}/attachments`);
    if (result.success && result.data) {
      attachments.value = result.data;
    }
  }
  catch (err: any) {
    console.error('Error fetching attachments:', err);
  }
}

// Trigger file input
function triggerFileUpload() {
  fileInputRef.value?.click();
}

// Handle file upload
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  // Validate file size (max 30MB)
  const maxSize = 30 * 1024 * 1024; // 30MB
  if (file.size > maxSize) {
    error.value = 'File size must be less than 10MB';
    return;
  }

  isUploadingAttachment.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const result: any = await $fetch(`/api/requests/${requestId}/attachments/upload`, {
      method: 'POST',
      body: formData,
    });

    if (result.success && result.data) {
      // Add new attachment to list
      attachments.value.push(result.data);
      successMessage.value = 'File uploaded successfully!';
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
    }
    else {
      error.value = 'Failed to upload file';
    }
  }
  catch (err: any) {
    console.error('Error uploading file:', err);
    error.value = err?.message || 'Failed to upload file';
  }
  finally {
    isUploadingAttachment.value = false;
    // Reset file input
    if (target) {
      target.value = '';
    }
  }
}

// Delete attachment
async function deleteAttachment(attachmentId: number) {
  if (!confirm('Are you sure you want to delete this file?')) {
    return;
  }

  isDeletingAttachment.value = attachmentId;
  error.value = null;

  try {
    const result: any = await $fetch(`/api/requests/${requestId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });

    if (result.success) {
      // Remove from list
      attachments.value = attachments.value.filter(a => a.id !== attachmentId);
      successMessage.value = 'File deleted successfully!';
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
    }
    else {
      error.value = 'Failed to delete file';
    }
  }
  catch (err: any) {
    console.error('Error deleting attachment:', err);
    error.value = err?.message || 'Failed to delete file';
  }
  finally {
    isDeletingAttachment.value = null;
  }
}

// Get file icon based on extension
function getFileIcon(fileName: string | null) {
  if (!fileName)
    return 'i-heroicons-document';

  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'i-heroicons-document-text';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'i-heroicons-photo';
    case 'doc':
    case 'docx':
      return 'i-heroicons-document-text';
    case 'xls':
    case 'xlsx':
      return 'i-heroicons-table-cells';
    case 'zip':
    case 'rar':
      return 'i-heroicons-archive-box';
    default:
      return 'i-heroicons-document';
  }
}

// Format file size
function formatFileSize(url: string | null) {
  // This is a placeholder - actual file size would need to be stored in DB
  return 'Unknown size';
}

onMounted(() => {
  fetchRequestData();
  fetchAttachments();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: 'My Requests', to: '/student/my-requests' },
            { label: `Request #${requestId}`, to: `/student/my-requests/${requestId}` },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ templateData?.name || 'Fill Request Form' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              Complete the form below and submit your request
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
          <p class="text-gray-500">
            Loading request...
          </p>
        </div>
      </div>

      <!-- Error State -->
      <UCard v-else-if="error && !requestData">
        <div class="text-center py-8">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton @click="$router.push('/student/my-requests')">
            Back to My Requests
          </UButton>
        </div>
      </UCard>

      <!-- Form Content -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: PDF Preview (Read-only) -->
        <div class="lg:col-span-2">
          <!-- Zoom Controls -->
          <div class="mb-4 flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-2">
            <span class="text-sm text-gray-600">Zoom:</span>
            <UButton
              icon="i-heroicons-minus"
              size="xs"
              variant="ghost"
              :disabled="scale <= 0.5"
              @click="scale = Math.max(0.5, scale - 0.25)"
            />
            <span class="text-sm font-medium w-12 text-center">{{ Math.round(scale * 100) }}%</span>
            <UButton
              icon="i-heroicons-plus"
              size="xs"
              variant="ghost"
              :disabled="scale >= 3"
              @click="scale = Math.min(3, scale + 0.25)"
            />
            <UButton
              size="xs"
              variant="ghost"
              @click="scale = 1"
            >
              Reset
            </UButton>
          </div>

          <!-- PDF Viewer (Read-only Display) -->
          <div
            v-if="pdfFile"
            class="bg-gray-100/50 overflow-auto p-8 rounded-lg border border-gray-200"
            style="min-height: 600px;"
          >
            <template-pdf-create
              :pdf-file="pdfFile"
              :placed-fields="placedFields"
              :selected-field="undefined"
              :ui-scale="scale"
              :read-only="true"
            />
          </div>
        </div>

        <!-- Right: Form Fields -->
        <div class="space-y-6">
          <!-- Success Message -->
          <UCard v-if="successMessage" class="bg-green-50 border-green-200">
            <div class="flex items-center gap-2 text-green-800">
              <i class="fas fa-check-circle" />
              <span class="font-medium">{{ successMessage }}</span>
            </div>
          </UCard>

          <!-- Error Message -->
          <UCard v-if="error" class="bg-red-50 border-red-200">
            <div class="flex items-center gap-2 text-red-800">
              <i class="fas fa-exclamation-circle" />
              <span class="font-medium">{{ error }}</span>
            </div>
          </UCard>

          <!-- Form Fields Card -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Request Information
              </h3>
            </template>

            <div class="space-y-4">
              <!-- Render field inputs -->
              <div
                v-for="field in fillableFields"
                :key="field.instanceId"
                class="field-group"
              >
                <form-field-input
                  v-model="fieldValues[field.id]"
                  :field="field"
                  :disabled="isSaving"
                />
              </div>

              <!-- Empty state -->
              <div v-if="fillableFields.length === 0" class="text-center py-8 text-gray-500">
                <i class="fas fa-inbox text-3xl mb-2" />
                <p class="text-sm">
                  No fillable fields in this template
                </p>
              </div>
            </div>
          </UCard>

          <!-- Attachments Card -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-500 uppercase">
                  Attachments
                </h3>
                <UButton
                  v-if="requestData?.status === 'draft' || !requestData?.status"
                  size="xs"
                  color="primary"
                  icon="i-heroicons-paper-clip"
                  :loading="isUploadingAttachment"
                  @click="triggerFileUpload"
                >
                  Add File
                </UButton>
              </div>
            </template>

            <div class="space-y-3">
              <!-- Hidden file input -->
              <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                accept="*/*"
                @change="handleFileUpload"
              >

              <!-- Attachment list -->
              <div
                v-for="attachment in attachments"
                :key="attachment.id"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <UIcon
                    :name="getFileIcon(attachment.fileName)"
                    class="w-5 h-5 text-gray-600 shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">
                      {{ attachment.fileName }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ new Date(attachment.createdAt).toLocaleDateString() }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-heroicons-book-open"
                    @click="openPdfInNewTab(attachment.fileUrl!)"
                  >
                    View
                  </UButton>
                  <UButton
                    v-if="requestData?.status === 'draft' || !requestData?.status"
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-heroicons-trash"
                    :loading="isDeletingAttachment === attachment.id"
                    @click="deleteAttachment(attachment.id)"
                  >
                    Delete
                  </UButton>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="attachments.length === 0" class="text-center py-8 text-gray-500">
                <i class="fas fa-paperclip text-3xl mb-2" />
                <p class="text-sm">
                  No attachments yet
                </p>
                <p class="text-xs mt-1">
                  Add supporting documents for your request
                </p>
              </div>

              <!-- Upload progress -->
              <div
                v-if="isUploadingAttachment"
                class="flex items-center gap-2 p-3 bg-blue-50 rounded-lg"
              >
                <i class="fas fa-spinner fa-spin text-blue-600" />
                <span class="text-sm text-blue-800">Uploading file...</span>
              </div>
            </div>
          </UCard>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-3">
            <!-- Show download button if PDF is generated -->
            <UButton
              v-if="requestData?.filledDocumentUrl"
              block
              color="primary"
              size="lg"
              icon="i-heroicons-arrow-down-tray"
              @click="openPdfInNewTab(requestData.filledDocumentUrl)"
            >
              Download Filled PDF
            </UButton>

            <!-- Show save/submit buttons only for draft status -->
            <template v-if="requestData?.status === 'draft' || !requestData?.status">
              <UButton
                block
                color="primary"
                size="lg"
                :loading="isSaving"
                :disabled="fillableFields.length === 0"
                @click="saveFieldValues"
              >
                <i class="fas fa-save mr-2" />
                Save Progress
              </UButton>

              <UButton
                block
                color="success"
                size="lg"
                :loading="isSaving"
                :disabled="fillableFields.length === 0"
                @click="submitRequest"
              >
                <i class="fas fa-paper-plane mr-2" />
                Submit Request
              </UButton>
            </template>

            <UButton
              block
              variant="ghost"
              color="neutral"
              @click="$router.push('/student/my-requests')"
            >
              <i class="fas fa-arrow-left mr-2" />
              Back to My Requests
            </UButton>
          </div>

          <!-- Request Status -->
          <UCard v-if="requestData">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Request Status
              </h3>
            </template>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Status:</span>
                <UBadge :color="requestData.status === 'draft' ? 'neutral' : requestData.status === 'submitted' ? 'success' : 'primary'">
                  {{ requestData.status || 'Draft' }}
                </UBadge>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Created:</span>
                <span class="font-medium">
                  {{ new Date(requestData.createdAt).toLocaleDateString() }}
                </span>
              </div>
              <div v-if="requestData.submittedAt" class="flex justify-between">
                <span class="text-gray-600">Submitted:</span>
                <span class="font-medium">
                  {{ new Date(requestData.submittedAt).toLocaleDateString() }}
                </span>
              </div>
              <div v-if="requestData.filledDocumentUrl" class="flex justify-between items-center pt-2 mt-2 border-t">
                <span class="text-gray-600">Filled PDF:</span>
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-heroicons-arrow-down-tray"
                  @click="openPdfInNewTab(requestData.filledDocumentUrl)"
                >
                  Download
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-group {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.field-group:last-child {
  border-bottom: none;
}
</style>
