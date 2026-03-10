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
  signingFlowData: Array<{ id: string; roleName: string }> | null;
};

type Attachment = {
  id: number;
  requestId: number;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
};

type FlowStep = {
  id: number;
  stepOrder: number;
  roleName: string;
  status: string;
  signedBy: string | null;
  signedAt: string | null;
};

type SigningStatus = {
  status: string;
  note: string | null;
  flowSteps: FlowStep[];
};

// --- State ---
const route = useRoute();
const requestId = route.params.id;
const localePath = useLocalePath();
const { user } = useUserSession();
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

// Signing flow
const signingStatus = ref<SigningStatus | null>(null);

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

          // Set placed fields — show only the student's own fields (by signerStepId) or unassigned fields
          if (templateData.value?.placedFieldsData) {
            const currentRoleName = user.value?.currentRole ?? '';
            const signingFlow = (templateData.value.signingFlowData ?? []) as Array<{ id: string; roleName: string }>;
            const studentStep = signingFlow.find(s => s.roleName === currentRoleName);
            const studentStepId = studentStep?.id ?? null;

            placedFields.value = (templateData.value.placedFieldsData as any[]).filter(
              (field: any) => {
                if (field.isFillable === false || field.is_fillable === false)
                  return false;
                if (field.type === 'Signature')
                  return false;
                if (studentStepId) {
                  const stepId = field.signerStepId ?? field.signer_step_id ?? null;
                  return !stepId || stepId === studentStepId;
                }
                return true;
              },
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
      method: 'PATCH' as any,
      body: {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      },
    });

    if (updateResult.success) {
      navigateTo(localePath('/student/my-requests'));
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

// Student-fillable fields: exclude Signature fields (those belong to signing roles, not the student)
const studentFields = computed(() => {
  return fillableFields.value.filter((f: any) => f.type?.toLowerCase() !== 'signature');
});

// Format a date string for Thai locale
function formatDate(dateStr: string | null): string {
  if (!dateStr)
    return '—';
  return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

type BadgeColor = 'success' | 'error' | 'primary' | 'secondary' | 'info' | 'warning' | 'neutral';
const _statusColorMap: Record<string, BadgeColor> = {
  draft: 'neutral',
  submitted: 'info',
  pending: 'warning',
  in_progress: 'warning',
  rejected: 'error',
  completed: 'success',
};
const _statusLabelMap: Record<string, string> = {
  draft: 'ร่าง',
  submitted: 'รอดำเนินการ',
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  rejected: 'ปฏิเสธ',
  completed: 'สำเร็จแล้ว',
};
const statusColor = computed<BadgeColor>(() => _statusColorMap[requestData.value?.status ?? ''] ?? 'neutral');
const statusLabel = computed(() => _statusLabelMap[requestData.value?.status ?? ''] ?? (requestData.value?.status ?? '—'));

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
  const maxSize = 30 * 1024 * 1024;
  if (file.size > maxSize) {
    error.value = 'ขนาดไฟล์ต้องไม่เกิน 30 MB';
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
  // eslint-disable-next-line no-alert
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
function _formatFileSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchSigningStatus() {
  try {
    const result: any = await $fetch(`/api/requests/${requestId}/signing-status`);
    if (result.success) {
      signingStatus.value = {
        status: result.data.status,
        note: result.data.note ?? null,
        flowSteps: result.data.flowSteps ?? [],
      };
    }
  }
  catch (err: any) {
    console.error('Failed to load signing status:', err?.message);
  }
}

const flowStepColor: Record<string, string> = {
  waiting: 'bg-slate-300',
  pending: 'bg-amber-500',
  signed: 'bg-green-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-slate-300',
};

const flowStepLabel: Record<string, string> = {
  waiting: 'รอดำเนินการ',
  pending: 'รอลงนาม',
  signed: 'ลงนามแล้ว',
  rejected: 'ปฏิเสธ',
  cancelled: 'ยกเลิก',
};

function formatSignedAt(dateStr: string | null): string {
  if (!dateStr)
    return '';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  fetchRequestData();
  fetchAttachments();
  fetchSigningStatus();
});
</script>

<template>
  <div class="min-h-screen pb-12">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
      <div>
        <UBreadcrumb
          :links="[
            { label: 'คำร้องของฉัน', to: localePath('/student/my-requests') },
            { label: templateData?.name || `#${requestId}` },
          ]"
          class="mb-2"
        />
        <h1 class="text-2xl font-bold">
          {{ templateData?.name || 'รายละเอียดคำร้อง' }}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          ติดตามสถานะและรายละเอียดคำร้อง
        </p>
      </div>
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        :to="localePath('/student/my-requests')"
      >
        กลับ
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center h-96">
      <div class="text-center text-gray-400">
        <UIcon name="i-lucide-loader" class="w-10 h-10 animate-spin mx-auto mb-3" />
        <p class="text-sm">
          กำลังโหลด...
        </p>
      </div>
    </div>

    <!-- Fatal Error -->
    <UAlert
      v-else-if="error && !requestData"
      color="error"
      icon="i-lucide-alert-triangle"
      :title="error"
      class="mb-4"
    >
      <template #description>
        <UButton size="xs" :to="localePath('/student/my-requests')">
          กลับ
        </UButton>
      </template>
    </UAlert>

    <!-- Main Content -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- ── Left: PDF Preview ── -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Zoom Controls -->
        <div class="flex items-center gap-3 bg-white rounded-xl border px-4 py-2.5">
          <span class="text-sm text-gray-500">Zoom:</span>
          <UButton
            icon="i-lucide-minus"
            size="xs"
            variant="ghost"
            :disabled="scale <= 0.5"
            @click="scale = Math.max(0.5, scale - 0.25)"
          />
          <span class="text-sm font-semibold w-12 text-center">{{ Math.round(scale * 100) }}%</span>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            :disabled="scale >= 3"
            @click="scale = Math.min(3, scale + 0.25)"
          />
          <UButton size="xs" variant="ghost" @click="scale = 1">
            Reset
          </UButton>
        </div>

        <!-- PDF Viewer -->
        <div
          v-if="pdfFile"
          class="bg-gray-100/50 overflow-auto p-6 rounded-xl border"
          style="min-height: 600px"
        >
          <template-pdf-create
            :pdf-file="pdfFile"
            :placed-fields="studentFields"
            :selected-field="undefined"
            :ui-scale="scale"
            :read-only="true"
          />
        </div>
        <div
          v-else
          class="flex items-center justify-center h-64 bg-white rounded-xl border text-gray-400"
        >
          <div class="text-center">
            <UIcon name="i-lucide-file" class="w-12 h-12 mb-2 mx-auto opacity-40" />
            <p class="text-sm">
              ไม่พบไฟล์เอกสาร
            </p>
          </div>
        </div>
      </div>

      <!-- ── Right Column ── -->
      <div class="space-y-4">
        <!-- Inline alerts -->
        <UAlert v-if="successMessage" color="success" icon="i-lucide-check-circle" :title="successMessage" />
        <UAlert v-if="error" color="error" icon="i-lucide-alert-circle" :title="error" />

        <!-- 1. REQUEST STATUS ─── top of right column -->
        <UCard v-if="requestData">
          <template #header>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              สถานะคำร้อง
            </h3>
          </template>
          <dl class="space-y-2.5 text-sm">
            <div class="flex justify-between items-center">
              <dt class="text-gray-500">
                สถานะ
              </dt>
              <dd>
                <UBadge :color="statusColor" variant="subtle">
                  {{ statusLabel }}
                </UBadge>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">
                สร้างเมื่อ
              </dt>
              <dd class="font-medium">
                {{ formatDate(requestData.createdAt) }}
              </dd>
            </div>
            <div v-if="requestData.submittedAt" class="flex justify-between">
              <dt class="text-gray-500">
                ยื่นเมื่อ
              </dt>
              <dd class="font-medium">
                {{ formatDate(requestData.submittedAt) }}
              </dd>
            </div>
          </dl>
        </UCard>

        <!-- 2. SIGNING TIMELINE ─── top of right column -->
        <UCard v-if="signingStatus && signingStatus.flowSteps.length > 0">
          <template #header>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <UIcon name="i-lucide-list-ordered" class="text-primary-500" />
              ลำดับการลงนาม
            </h3>
          </template>

          <UAlert
            v-if="signingStatus.status === 'rejected' && signingStatus.note"
            icon="i-lucide-x-circle"
            color="error"
            variant="soft"
            :title="`ปฏิเสธ: ${signingStatus.note}`"
            class="mb-3"
          />

          <div class="space-y-2">
            <div
              v-for="step in signingStatus.flowSteps"
              :key="step.id"
              class="flex items-start gap-3 p-2.5 rounded-lg"
              :class="step.status === 'pending' ? 'bg-amber-50 border border-amber-200' : step.status === 'rejected' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'"
            >
              <span
                class="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                :class="flowStepColor[step.status] ?? 'bg-slate-300'"
              >
                <UIcon v-if="step.status === 'signed'" name="i-lucide-check" class="w-3 h-3" />
                <UIcon v-else-if="step.status === 'rejected'" name="i-lucide-x" class="w-3 h-3" />
                <template v-else>{{ step.stepOrder }}</template>
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-800">
                  {{ step.roleName }}
                </p>
                <p v-if="step.signedAt" class="text-xs text-slate-400 mt-0.5">
                  {{ formatSignedAt(step.signedAt) }}
                </p>
              </div>
              <UBadge
                :color="step.status === 'signed' ? 'success' : step.status === 'pending' ? 'warning' : step.status === 'rejected' ? 'error' : 'neutral'"
                :label="flowStepLabel[step.status] ?? step.status"
                variant="soft"
                size="xs"
              />
            </div>
          </div>
        </UCard>

        <!-- 3. REQUEST INFORMATION ─── student-filled fields only, no Signature fields -->
        <UCard>
          <template #header>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              ข้อมูลคำร้อง
            </h3>
          </template>

          <!-- DRAFT: editable inputs -->
          <div v-if="requestData?.status === 'draft'" class="space-y-4">
            <div v-for="field in studentFields" :key="field.instanceId">
              <form-field-input
                v-model="fieldValues[field.id]"
                :field="field"
                :disabled="isSaving"
              />
            </div>
            <div v-if="studentFields.length === 0" class="text-center py-6 text-gray-400 text-sm">
              ไม่มีฟิลด์ที่ต้องกรอก
            </div>
          </div>

          <!-- SUBMITTED / IN_PROGRESS / COMPLETED / REJECTED: read-only display -->
          <div v-else class="space-y-3">
            <div
              v-for="field in studentFields"
              :key="field.instanceId"
              class="flex flex-col gap-0.5"
            >
              <span class="text-xs text-gray-400 font-medium">{{ field.label || field.name }}</span>
              <span class="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 min-h-9 flex items-center">
                {{ fieldValues[field.id] || '—' }}
              </span>
            </div>
            <div v-if="studentFields.length === 0" class="text-center py-6 text-gray-400 text-sm">
              ไม่มีข้อมูลที่กรอก
            </div>
          </div>
        </UCard>

        <!-- 4. ATTACHMENTS -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                ไฟล์แนบ
              </h3>
              <UButton
                v-if="requestData?.status === 'draft'"
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-paperclip"
                :loading="isUploadingAttachment"
                @click="triggerFileUpload"
              >
                เพิ่มไฟล์
              </UButton>
            </div>
          </template>

          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept="*/*"
            @change="handleFileUpload"
          >

          <div class="space-y-2">
            <div
              v-for="attachment in attachments"
              :key="attachment.id"
              class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100 group"
            >
              <UIcon :name="getFileIcon(attachment.fileName)" class="w-5 h-5 text-gray-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">
                  {{ attachment.fileName }}
                </p>
                <p class="text-xs text-gray-400">
                  {{ new Date(attachment.createdAt).toLocaleDateString('th-TH') }}
                </p>
              </div>
              <div class="flex items-center gap-1.5">
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-eye"
                  @click="openPdfInNewTab(attachment.fileUrl!)"
                >
                  ดู
                </UButton>
                <UButton
                  v-if="requestData?.status === 'draft'"
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  :loading="isDeletingAttachment === attachment.id"
                  @click="deleteAttachment(attachment.id)"
                />
              </div>
            </div>

            <div v-if="attachments.length === 0 && !isUploadingAttachment" class="text-center py-6 text-gray-400">
              <UIcon name="i-lucide-paperclip" class="w-8 h-8 mx-auto mb-1.5 opacity-40" />
              <p class="text-sm">
                ยังไม่มีไฟล์แนบ
              </p>
            </div>

            <div v-if="isUploadingAttachment" class="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <UIcon name="i-lucide-loader" class="animate-spin text-blue-500 w-4 h-4" />
              <span class="text-sm text-blue-700">กำลังอัปโหลด...</span>
            </div>
          </div>
        </UCard>

        <!-- 5. ACTION BUTTONS -->
        <div class="flex flex-col gap-2.5">
          <template v-if="requestData?.status === 'draft'">
            <UButton
              block
              color="primary"
              size="lg"
              icon="i-lucide-save"
              :loading="isSaving"
              :disabled="studentFields.length === 0"
              @click="saveFieldValues"
            >
              บันทึก
            </UButton>
            <UButton
              block
              color="success"
              size="lg"
              icon="i-lucide-send"
              :loading="isSaving"
              :disabled="studentFields.length === 0"
              @click="submitRequest"
            >
              ยืนยันการยื่นคำร้อง
            </UButton>
          </template>
          <UButton
            block
            variant="outline"
            color="neutral"
            icon="i-lucide-arrow-left"
            :to="localePath('/student/my-requests')"
          >
            กลับไปยังคำร้องของฉัน
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
