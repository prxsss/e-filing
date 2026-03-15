<script setup lang="ts">
definePageMeta({ title: 'requestDetails' });

// --- Types ---
type RequestData = {
  id: number;
  templateId: number | null;
  status: string;
  filledDocumentUrl: string | null;
  createdAt: string;
  submittedAt: string | null;
  userId: string | null;
  note: string | null;
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
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
};

type FlowStep = {
  id: number;
  stepOrder: number;
  roleName: string;
  status: string;
  assignedUserId: string | null;
  signedBy: string | null;
  signedAt: string | null;
};

type SigningStatus = {
  status: string;
  note: string | null;
  flowSteps: FlowStep[];
};

type WorkflowDisplayStatus = 'completed' | 'in-progress' | 'pending' | 'rejected';
type WorkflowStep = {
  id: number;
  title: string;
  status: WorkflowDisplayStatus;
  icon: string;
  subtitle?: string;
};

// --- State ---
const route = useRoute();
const localePath = useLocalePath();
const requestId = route.params.id;

const isLoading = ref(true);
const error = ref<string | null>(null);

const requestData = ref<RequestData | null>(null);
const templateData = ref<TemplateData | null>(null);
const fieldValues = ref<Record<number, string>>({});
const allFields = ref<any[]>([]);
const signingStatus = ref<SigningStatus | null>(null);
const attachments = ref<Attachment[]>([]);

// --- Helpers ---
function formatDate(dateStr: string | null): string {
  if (!dateStr)
    return '—';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type BadgeColor = 'success' | 'error' | 'warning' | 'info' | 'neutral';
const statusColorMap: Record<string, BadgeColor> = {
  draft: 'neutral',
  submitted: 'info',
  pending: 'warning',
  in_progress: 'warning',
  rejected: 'error',
  completed: 'success',
};
const statusLabelMap: Record<string, string> = {
  draft: 'ร่าง',
  submitted: 'ส่งแล้ว',
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  rejected: 'ปฏิเสธ',
  completed: 'สำเร็จแล้ว',
};
const statusColor = computed<BadgeColor>(() => statusColorMap[requestData.value?.status ?? ''] ?? 'neutral');
const statusLabel = computed(() => statusLabelMap[requestData.value?.status ?? ''] ?? (requestData.value?.status ?? '—'));

const workflowSteps = computed<WorkflowStep[]>(() => {
  const steps = signingStatus.value?.flowSteps ?? [];
  const firstPendingIndex = steps.findIndex(step => step.status === 'pending');

  return steps.map((step, index) => {
    let status: WorkflowDisplayStatus = 'pending';
    if (step.status === 'signed') {
      status = 'completed';
    }
    else if (step.status === 'rejected') {
      status = 'rejected';
    }
    else if (step.status === 'pending' && index === firstPendingIndex) {
      status = 'in-progress';
    }

    return {
      id: step.id,
      title: step.roleName,
      status,
      icon: 'i-heroicons-user-circle',
      subtitle: step.signedBy || step.assignedUserId || undefined,
    };
  });
});

// --- All fillable (non-signature) fields, no role filter ---
const allFillableFields = computed(() =>
  allFields.value.filter(
    (f: any) => f.isFillable !== false && f.type?.toLowerCase() !== 'signature',
  ),
);

// PDF to display: prefer filled/signed version, fall back to blank template
const displayPdfUrl = computed(() =>
  requestData.value?.filledDocumentUrl ?? templateData.value?.documentUrl ?? null,
);
const isFilledPdf = computed(() => !!requestData.value?.filledDocumentUrl);

function openInNewTab(url: string) {
  if (typeof window !== 'undefined')
    window.open(url, '_blank');
}

// --- Fetch ---
async function loadAll() {
  isLoading.value = true;
  error.value = null;
  try {
    const [reqResult, attachResult, sigResult] = await Promise.all([
      $fetch<any>(`/api/requests/${requestId}`),
      $fetch<any>(`/api/requests/${requestId}/attachments`),
      $fetch<any>(`/api/requests/${requestId}/signing-status`),
    ]);

    if (!reqResult.success) {
      error.value = reqResult.error || 'ไม่พบคำร้อง';
      return;
    }

    requestData.value = reqResult.data.request;

    // field values
    if (reqResult.data.fieldValues) {
      reqResult.data.fieldValues.forEach((fv: any) => {
        fieldValues.value[fv.fieldId] = fv.value || '';
      });
    }

    // attachments
    if (attachResult.success)
      attachments.value = attachResult.data ?? [];

    // signing status
    if (sigResult.success) {
      signingStatus.value = {
        status: sigResult.data.status,
        note: sigResult.data.note ?? null,
        flowSteps: sigResult.data.flowSteps ?? [],
      };
    }

    // template metadata (for field labels in right panel)
    if (requestData.value?.templateId) {
      const tplResult = await $fetch<any>(`/api/pdf-templates/${requestData.value.templateId}`);
      if (tplResult.success && tplResult.data) {
        templateData.value = tplResult.data;

        // all placed fields — NO role filter, admin sees everything
        if (templateData.value?.placedFieldsData) {
          allFields.value = (templateData.value.placedFieldsData as any[]).filter(
            (f: any) => f.isFillable !== false && f.is_fillable !== false,
          );
        }
      }
    }
  }
  catch (err: any) {
    error.value = err?.message || 'เกิดข้อผิดพลาด';
  }
  finally {
    isLoading.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Breadcrumb -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb
          :links="[
            { label: 'คำร้องทั้งหมด', to: localePath('/admin/requests') },
            { label: templateData?.name || `#${requestId}` },
          ]"
        />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ templateData?.name || 'รายละเอียดคำร้อง' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              มุมมองผู้ดูแลระบบ — แสดงข้อมูลทั้งหมด
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-heroicons-arrow-left"
              :to="localePath('/admin/requests')"
            >
              กลับ
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <UIcon name="i-heroicons-arrow-path" class="text-4xl text-gray-400 mb-4 animate-spin" />
          <p class="text-gray-500">
            กำลังโหลด...
          </p>
        </div>
      </div>

      <!-- Error -->
      <UCard v-else-if="error && !requestData">
        <div class="text-center py-8">
          <UIcon name="i-heroicons-exclamation-triangle" class="text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error }}
          </p>
          <UButton :to="localePath('/admin/requests')">
            กลับไปหน้ารายการคำร้อง
          </UButton>
        </div>
      </UCard>

      <!-- Content Grid -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: PDF Preview -->
        <div class="lg:col-span-2 space-y-4">
          <!-- PDF Viewer -->
          <div v-if="displayPdfUrl">
            <template-pdf-preview
              :pdf-url="displayPdfUrl"
              :placed-fields="isFilledPdf ? [] : allFillableFields"
              :open-in-new-tab-url="requestData?.filledDocumentUrl ?? undefined"
              open-in-new-tab-label="เปิด PDF ในแท็บใหม่"
            />
          </div>
          <div v-else class="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 text-gray-400 shadow-sm">
            <div class="text-center">
              <UIcon name="i-heroicons-document" class="w-12 h-12 mb-2 mx-auto opacity-40" />
              <p class="text-sm">
                ไม่พบไฟล์เอกสาร
              </p>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="space-y-6">
          <!-- Request Status -->
          <UCard v-if="requestData">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                สถานะคำร้อง
              </h3>
            </template>
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between items-center">
                <dt class="text-gray-500 font-medium">
                  รหัสคำร้อง
                </dt>
                <dd class="font-mono font-medium text-gray-900">
                  #{{ requestData.id }}
                </dd>
              </div>
              <div class="flex justify-between items-center">
                <dt class="text-gray-500 font-medium">
                  สถานะ
                </dt>
                <dd>
                  <UBadge :color="statusColor" variant="subtle">
                    {{ statusLabel }}
                  </UBadge>
                </dd>
              </div>
              <div class="flex justify-between items-center">
                <dt class="text-gray-500 font-medium">
                  ผู้ยื่น (User ID)
                </dt>
                <dd class="font-medium text-xs text-gray-900 break-all max-w-[60%] text-right">
                  {{ requestData.userId || '—' }}
                </dd>
              </div>
              <div class="flex justify-between items-center">
                <dt class="text-gray-500 font-medium">
                  สร้างเมื่อ
                </dt>
                <dd class="font-medium text-gray-900">
                  {{ formatDate(requestData.createdAt) }}
                </dd>
              </div>
              <div v-if="requestData.submittedAt" class="flex justify-between items-center">
                <dt class="text-gray-500 font-medium">
                  ยื่นเมื่อ
                </dt>
                <dd class="font-medium text-gray-900">
                  {{ formatDate(requestData.submittedAt) }}
                </dd>
              </div>
              <div v-if="requestData.note" class="flex flex-col gap-1.5 mt-2">
                <dt class="text-gray-500 font-medium">
                  หมายเหตุ
                </dt>
                <dd class="text-sm bg-gray-50 rounded border border-gray-200 px-3 py-2 text-gray-800">
                  {{ requestData.note }}
                </dd>
              </div>
            </dl>
          </UCard>

          <!-- Signing Timeline -->
          <UCard v-if="signingStatus && workflowSteps.length > 0">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                Order of signing
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

            <div class="space-y-0">
              <template
                v-for="(step, index) in workflowSteps"
                :key="step.id"
              >
                <div class="flex items-center gap-3 py-2">
                  <div
                    class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border"
                    :class="{
                      'bg-green-50 border-green-200': step.status === 'completed',
                      'bg-blue-50 border-blue-200': step.status === 'in-progress',
                      'bg-red-50 border-red-200': step.status === 'rejected',
                      'bg-gray-50 border-gray-200': step.status === 'pending',
                    }"
                  >
                    <UIcon
                      :name="step.icon"
                      :class="{
                        'text-green-600': step.status === 'completed',
                        'text-blue-600': step.status === 'in-progress',
                        'text-red-600': step.status === 'rejected',
                        'text-gray-400': step.status === 'pending',
                      }"
                      class="text-xl"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-medium"
                      :class="{
                        'text-gray-900': step.status !== 'pending',
                        'text-gray-500': step.status === 'pending',
                      }"
                    >
                      {{ step.title }}
                    </p>
                    <p v-if="step.subtitle" class="text-xs text-gray-400 mt-0.5 truncate">
                      โดย: {{ step.subtitle }}
                    </p>
                    <UBadge
                      v-if="step.status === 'completed'"
                      color="success"
                      variant="subtle"
                      size="xs"
                      class="mt-1.5"
                    >
                      Signed
                    </UBadge>
                    <UBadge
                      v-else-if="step.status === 'in-progress'"
                      color="info"
                      variant="subtle"
                      size="xs"
                      class="mt-1.5"
                    >
                      In Progress
                    </UBadge>
                    <UBadge
                      v-else-if="step.status === 'rejected'"
                      color="error"
                      variant="subtle"
                      size="xs"
                      class="mt-1.5"
                    >
                      Rejected
                    </UBadge>
                  </div>
                </div>

                <div
                  v-if="index < workflowSteps.length - 1"
                  class="flex items-center gap-3"
                >
                  <div class="w-10 flex justify-center py-0.5">
                    <UIcon
                      name="i-heroicons-arrow-down"
                      class="text-gray-300 text-sm"
                    />
                  </div>
                </div>
              </template>
            </div>
          </UCard>

          <!-- All Filled Fields (admin sees everything) -->
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                ข้อมูลที่กรอก (ทั้งหมด)
              </h3>
            </template>

            <div class="space-y-2">
              <div
                v-for="(field, index) in allFillableFields"
                :key="field.instanceId"
                class="p-2.5 bg-gray-50 rounded-lg text-xs border border-gray-200"
              >
                <div class="font-medium text-gray-900">
                  {{ index + 1 }}. {{ field.label || field.name }}
                </div>
                <div class="text-gray-600 mt-1">
                  {{ fieldValues[field.id] || '—' }}
                </div>
              </div>
              <div v-if="allFillableFields.length === 0" class="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                ไม่มีข้อมูลที่กรอก
              </div>
            </div>
          </UCard>

          <!-- Attachments -->
          <UCard v-if="attachments.length > 0">
            <template #header>
              <h3 class="text-sm font-semibold text-gray-500 uppercase">
                ไฟล์แนบ
              </h3>
            </template>
            <div class="space-y-2">
              <div
                v-for="attachment in attachments"
                :key="attachment.id"
                class="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <UIcon name="i-heroicons-paper-clip" class="w-5 h-5 text-gray-400 shrink-0" />
                  <div class="min-w-0">
                    <p class="font-medium text-sm text-gray-900 truncate">
                      {{ attachment.fileName || 'ไฟล์แนบ' }}
                    </p>
                    <p class="text-xs text-gray-500 mt-0.5">
                      {{ new Date(attachment.createdAt).toLocaleDateString('th-TH') }}
                    </p>
                  </div>
                </div>
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-heroicons-eye"
                  @click="openInNewTab(attachment.fileUrl!)"
                >
                  ดู
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
