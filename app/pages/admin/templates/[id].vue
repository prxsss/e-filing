<script lang="ts" setup>
import { LazyBaseConfirmDialog } from '#components';

definePageMeta({
  title: 'documentReview',
  middleware: ['permission'],
  permission: 'template.view',
});

// --- Types ---
type Template = {
  id: number;
  name: string | null;
  description: string | null;
  version: string | null;
  isActive: boolean | null;
  createdBy: number | null;
  createdAt: string;
  documentUrl: string | null;
  documentWidth: number | null;
  documentHeight: number | null;
  placedFieldsData: unknown;
  signingFlowData: unknown;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type RequestDetailUpdateData = {
  id: number;
  description: string | null;
};

type SigningStepSummary = {
  id: string;
  order: number;
  roleName: string;
  description: string | null;
  isRequired: boolean;
  color: string;
};

const DEFAULT_SIGNING_STEP_COLOR = '#94A3B8';

// --- State ---
const route = useRoute();
const router = useRouter();
const overlay = useOverlay();
const toast = useToast();
const templateId = computed(() => {
  const value = route.params.id;
  return Array.isArray(value) ? value[0] : value;
});
const template = ref<Template | null>(null);
const isLoading = ref(true);
const isDeleting = ref(false);
const error = ref<string | null>(null);
const isEditingRequestDetail = ref(false);
const isSavingRequestDetail = ref(false);
const requestDescriptionDraft = ref('');

const authStore = useAuthStore();

const confirmDialog = overlay.create(LazyBaseConfirmDialog);

const placedFields = ref<any[]>([]);

const requestDescriptionItems = computed(() => {
  const rawDescription = template.value?.description;
  if (!rawDescription)
    return [];

  return rawDescription
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
});

const requestDetailItems = computed(() => {
  return requestDescriptionItems.value;
});

const signingSteps = computed<SigningStepSummary[]>(() => normalizeSigningFlowData(template.value?.signingFlowData));

const templateDescriptionPreview = computed(() => {
  if (isLoading.value)
    return 'Loading...';

  return template.value?.description?.trim() || 'ยังไม่มีคำอธิบาย';
});

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string')
    return value;

  try {
    return JSON.parse(value);
  }
  catch {
    return value;
  }
}

function normalizePlacedFieldsData(value: unknown): any[] {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeSigningFlowData(value: unknown): SigningStepSummary[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed))
    return [];

  return parsed
    .map((step: any, index: number) => ({
      id: typeof step?.id === 'string' && step.id.trim().length > 0 ? step.id : `step-${index + 1}`,
      order: typeof step?.order === 'number' ? step.order : index + 1,
      roleName: typeof step?.roleName === 'string' && step.roleName.trim().length > 0
        ? step.roleName.trim()
        : `Signer ${index + 1}`,
      description: typeof step?.description === 'string' && step.description.trim().length > 0
        ? step.description.trim()
        : null,
      isRequired: step?.isRequired !== false,
      color: typeof step?.color === 'string' && step.color.trim().length > 0
        ? step.color
        : DEFAULT_SIGNING_STEP_COLOR,
    }))
    .sort((a, b) => a.order - b.order);
}

function startEditRequestDetail() {
  requestDescriptionDraft.value = template.value?.description || '';
  isEditingRequestDetail.value = true;
}

function cancelEditRequestDetail() {
  isEditingRequestDetail.value = false;
  requestDescriptionDraft.value = '';
}

async function saveRequestDetail() {
  if (!templateId.value || !template.value)
    return;

  isSavingRequestDetail.value = true;

  try {
    const normalizedDescription = requestDescriptionDraft.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    const result = await $fetch<ApiResponse<RequestDetailUpdateData>>(`/api/pdf-templates/${templateId.value}/request-detail`, {
      method: 'PATCH',
      body: {
        description: normalizedDescription || null,
      },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to update request detail');
    }

    template.value = {
      ...template.value,
      description: result.data.description,
    };
    isEditingRequestDetail.value = false;
    requestDescriptionDraft.value = '';

    toast.add({
      title: 'บันทึกสำเร็จ',
      description: 'อัปเดตรายละเอียดคำร้องแล้ว',
      color: 'success',
    });
  }
  catch (err) {
    console.error('Error updating request detail:', err);
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: err instanceof Error ? err.message : 'ไม่สามารถอัปเดตรายละเอียดคำร้องได้',
      color: 'error',
    });
  }
  finally {
    isSavingRequestDetail.value = false;
  }
}

// --- Methods ---
async function fetchTemplate() {
  if (!templateId.value) {
    error.value = 'Template ID is required';
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const result = await $fetch<ApiResponse<Template>>(`/api/pdf-templates/${templateId.value}`);

    if (result.success && result.data) {
      template.value = result.data;
      placedFields.value = normalizePlacedFieldsData(result.data.placedFieldsData);
    }
    else {
      error.value = 'Template not found';
    }
  }
  catch (err) {
    console.error('Error fetching template:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load template';
  }
  finally {
    isLoading.value = false;
  }
}

function downloadPdf() {
  if (template.value?.documentUrl) {
    window.open(template.value.documentUrl, '_blank');
  }
}

async function deleteTemplate() {
  if (!templateId.value)
    return;

  const instance = confirmDialog.open({
    title: 'ลบ Template',
    description: `คุณต้องการลบ "${template.value?.name}" หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
    cancelButton: { label: 'ยกเลิก' },
    confirmButton: { label: 'ลบ', color: 'error' },
  });

  const confirmed = await instance.result;
  if (!confirmed)
    return;

  isDeleting.value = true;
  try {
    await $fetch(`/api/pdf-templates/${templateId.value}`, { method: 'DELETE' });
    toast.add({
      title: 'ลบสำเร็จ',
      description: `Template "${template.value?.name}" ถูกลบแล้ว`,
      color: 'success',
    });
    router.push('/admin/templates');
  }
  catch (err) {
    console.error('Error deleting template:', err);
    toast.add({
      title: 'เกิดข้อผิดพลาด',
      description: 'ไม่สามารถลบ Template ได้',
      color: 'error',
    });
  }
  finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  fetchTemplate();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Breadcrumb -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: 'Templates', to: '/admin/templates' },
            { label: template?.name || 'Loading...', to: templateId ? `/admin/templates/${templateId}` : '/admin/templates' },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ template?.name || 'Document Preview' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              {{ templateDescriptionPreview }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="ghost"
              color="neutral"
              @click="downloadPdf"
            />
            <UButton
              v-if="authStore.can('template.delete')"
              icon="i-heroicons-trash"
              variant="ghost"
              color="error"
              :loading="isDeleting"
              @click="deleteTemplate"
            />
            <UButton
              v-if="authStore.can('template.edit')"
              :to="`/admin/templates/edit?id=${templateId}`"
              icon="i-heroicons-pencil-square"
              variant="solid"
              color="info"
            >
              Edit
            </UButton>
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
            กำลังโหลด Template...
          </p>
        </div>
      </div>

      <!-- Error State -->
      <UCard v-else-if="error">
        <div class="text-center py-8">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton @click="$router.push('/admin/templates')">
            กลับไปหน้ารายการ Templates
          </UButton>
        </div>
      </UCard>

      <!-- Template Content -->
      <div v-else-if="template && template.documentUrl" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: PDF Preview -->
        <div class="lg:col-span-2">
          <template-pdf-preview
            :pdf-url="template.documentUrl"
            :placed-fields="placedFields"
          />
        </div>

        <!-- Right: Sidebar -->
        <div class="space-y-6">
          <!-- Request Summary -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-500 uppercase">
                  Request Detail
                </h3>
                <div class="flex items-center gap-1">
                  <UButton
                    v-if="!isEditingRequestDetail"
                    size="xs"
                    variant="ghost"
                    icon="i-heroicons-pencil-square"
                    @click="startEditRequestDetail"
                  >
                    Edit
                  </UButton>
                  <template v-else>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :disabled="isSavingRequestDetail"
                      @click="cancelEditRequestDetail"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      size="xs"
                      color="primary"
                      :loading="isSavingRequestDetail"
                      @click="saveRequestDetail"
                    >
                      Save
                    </UButton>
                  </template>
                </div>
              </div>
            </template>
            <div class="space-y-3 w-full">
              <template v-if="isEditingRequestDetail">
                <p class="text-xs text-gray-500">
                  เพิ่มคำอธิบายได้โดยใส่ 1 บรรทัดต่อ 1 รายการ
                </p>
                <UTextarea
                  v-model="requestDescriptionDraft"
                  :rows="6"
                  class="w-full"
                  placeholder="ตัวอย่าง: ใช้สำหรับนิสิตระดับปริญญาตรี ส่งเอกสารภายใน 3 วันทำการ"
                />
              </template>
              <template v-else>
                <div v-if="requestDetailItems.length > 0" class="space-y-3">
                  <div
                    v-for="(item, index) in requestDetailItems"
                    :key="`${item}-${index}`"
                    class="flex items-start gap-2"
                  >
                    <UIcon name="i-heroicons-arrow-right-circle-solid" class="text-green-500 mt-0.5 shrink-0" />
                    <div class="text-sm">
                      <p class="text-gray-700">
                        {{ item }}
                      </p>
                    </div>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-500">
                  ยังไม่มีรายละเอียดคำร้อง
                </p>
              </template>
            </div>
          </UCard>

          <!-- Workflow Progress -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Order of signing
              </h3>
            </template>
            <div v-if="signingSteps.length === 0" class="text-sm text-gray-500">
              ยังไม่มีการกำหนดลำดับการลงนาม
            </div>
            <div v-else class="space-y-0">
              <template
                v-for="(step, index) in signingSteps"
                :key="step.id"
              >
                <div class="flex items-start gap-3 py-2">
                  <div
                    class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                    :style="{ backgroundColor: step.color }"
                  >
                    {{ step.order }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">
                      {{ step.roleName }}
                    </p>
                    <p v-if="step.description" class="text-xs text-gray-500 mt-1">
                      {{ step.description }}
                    </p>
                    <UBadge
                      :color="step.isRequired ? 'primary' : 'neutral'"
                      variant="subtle"
                      size="xs"
                      class="mt-1"
                    >
                      {{ step.isRequired ? 'Required' : 'Optional' }}
                    </UBadge>
                  </div>
                </div>

                <!-- Arrow between items -->
                <div
                  v-if="index < signingSteps.length - 1"
                  class="flex items-center gap-3"
                >
                  <div class="w-10 flex justify-center">
                    <UIcon
                      name="i-heroicons-arrow-down"
                      class="text-gray-400 text-sm"
                    />
                  </div>
                </div>
              </template>
            </div>
          </UCard>

          <!-- Fields List -->
          <UCard v-if="placedFields.length > 0">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Fields ({{ placedFields.length }})
              </h3>
            </template>
            <div class="space-y-2">
              <div
                v-for="(field, index) in placedFields"
                :key="field.instanceId"
                class="p-2 bg-gray-50 rounded text-xs border border-gray-200"
              >
                <div class="font-medium text-gray-900">
                  {{ index + 1 }}. {{ field.label || field.name }}
                </div>
                <div class="text-gray-500 mt-1">
                  Type: {{ field.type || field.fieldType || '-' }} | Page {{ field.pageNumber || 1 }}
                </div>
              </div>
            </div>
          </UCard>
          <!-- Staff Comments -->
          <!-- <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Staff Comments
              </h3>
            </template>
            <UTextarea
              v-model="staffComment"
              placeholder="Add a note or reason for rejection..."
              :rows="4"
            />
          </UCard> -->

          <!-- Action Buttons -->
          <!-- <div class="space-y-3">
            <UButton
              block
              color="error"
              variant="outline"
              icon="i-heroicons-x-circle"
              @click="handleReject"
            >
              Reject Request
            </UButton>
            <UButton
              block
              color="success"
              icon="i-heroicons-pencil-square"
              @click="handleApprove"
            >
              Sign and Approve
            </UButton>
          </div> -->

          <!-- Footer Note -->
          <!-- <UCard>
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-information-circle" class="text-blue-500 mt-0.5 shrink-0" />
              <p class="text-xs text-gray-600">
                By signing, you confirm that you have reviewed all attached evidence and queries of the grade change request.
              </p>
            </div>
          </UCard> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>
