<script setup lang="ts">
definePageMeta({
  title: 'requestDetails',
  middleware: ['permission'],
  permission: 'request.view',
});

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
const pdfFile = ref<File | null>(null);
const isFilledPdf = ref(false); // true = filledDocumentUrl loaded (no overlay needed)
const scale = ref(1);
const signingStatus = ref<SigningStatus | null>(null);
const attachments = ref<Attachment[]>([]);

// --- Helpers ---
async function urlToFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

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

// --- All fillable (non-signature) fields, no role filter ---
const allFillableFields = computed(() =>
  allFields.value.filter(
    (f: any) => f.isFillable !== false && f.type?.toLowerCase() !== 'signature',
  ),
);

function getFileIcon(fileName: string | null) {
  if (!fileName)
    return 'i-heroicons-document';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf')
    return 'i-heroicons-document-text';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext ?? ''))
    return 'i-heroicons-photo';
  if (['doc', 'docx'].includes(ext ?? ''))
    return 'i-heroicons-document-text';
  return 'i-heroicons-document';
}

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

    // PDF to display: prefer the filled/signed version, fall back to blank template
    const filledUrl = requestData.value?.filledDocumentUrl;
    if (filledUrl) {
      // Already has content baked in — show as-is, no field overlays needed
      const filename = filledUrl.split('/').pop() || 'filled.pdf';
      pdfFile.value = await urlToFile(filledUrl, filename);
      isFilledPdf.value = true;
    }
    else if (templateData.value?.documentUrl) {
      // No filled PDF yet (draft stage) — show blank template with field overlays
      const filename = templateData.value.documentUrl.split('/').pop() || 'template.pdf';
      pdfFile.value = await urlToFile(templateData.value.documentUrl, filename);
      isFilledPdf.value = false;
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
  <div class="min-h-screen pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
      <div>
        <UBreadcrumb
          :links="[
            { label: 'คำร้องทั้งหมด', to: localePath('/admin/requests') },
            { label: templateData?.name || `#${requestId}` },
          ]"
          class="mb-2"
        />
        <h1 class="text-2xl font-bold">
          {{ templateData?.name || 'รายละเอียดคำร้อง' }}
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          มุมมองผู้ดูแลระบบ — แสดงข้อมูลทั้งหมด
        </p>
      </div>
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        :to="localePath('/admin/requests')"
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

    <!-- Error -->
    <UAlert
      v-else-if="error && !requestData"
      color="error"
      icon="i-lucide-alert-triangle"
      :title="error"
      class="mb-4"
    />

    <!-- Main Content -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: PDF Preview -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Zoom Controls -->
        <div class="flex items-center gap-3 bg-white rounded-xl border px-4 py-2.5">
          <span class="text-sm text-gray-500">Zoom:</span>
          <UButton icon="i-lucide-minus" size="xs" variant="ghost" :disabled="scale <= 0.5" @click="scale = Math.max(0.5, scale - 0.25)" />
          <span class="text-sm font-semibold w-12 text-center">{{ Math.round(scale * 100) }}%</span>
          <UButton icon="i-lucide-plus" size="xs" variant="ghost" :disabled="scale >= 3" @click="scale = Math.min(3, scale + 0.25)" />
          <UButton size="xs" variant="ghost" @click="scale = 1">
            Reset
          </UButton>
          <div class="ml-auto">
            <UButton
              v-if="requestData?.filledDocumentUrl"
              size="xs"
              icon="i-lucide-external-link"
              variant="soft"
              color="primary"
              @click="openInNewTab(requestData!.filledDocumentUrl!)"
            >
              เปิด PDF ที่ลงนามแล้ว
            </UButton>
          </div>
        </div>

        <!-- PDF Viewer -->
        <div
          v-if="pdfFile"
          class="bg-gray-100/50 overflow-auto p-6 rounded-xl border"
          style="min-height: 600px"
        >
          <!-- Filled/signed PDF: content already baked in, no overlay -->
          <!-- Blank template: show field overlays to indicate positions -->
          <template-pdf-create
            :pdf-file="pdfFile"
            :placed-fields="isFilledPdf ? [] : allFillableFields"
            :selected-field="undefined"
            :ui-scale="scale"
            :read-only="true"
          />
        </div>
        <div v-else class="flex items-center justify-center h-64 bg-white rounded-xl border text-gray-400">
          <div class="text-center">
            <UIcon name="i-lucide-file" class="w-12 h-12 mb-2 mx-auto opacity-40" />
            <p class="text-sm">
              ไม่พบไฟล์เอกสาร
            </p>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="space-y-4">
        <!-- Request Status -->
        <UCard v-if="requestData">
          <template #header>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              สถานะคำร้อง
            </h3>
          </template>
          <dl class="space-y-2.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">
                รหัสคำร้อง
              </dt>
              <dd class="font-mono font-medium">
                #{{ requestData.id }}
              </dd>
            </div>
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
                ผู้ยื่น (User ID)
              </dt>
              <dd class="font-medium text-xs break-all">
                {{ requestData.userId || '—' }}
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
            <div v-if="requestData.note" class="flex flex-col gap-1">
              <dt class="text-gray-500">
                หมายเหตุ
              </dt>
              <dd class="text-sm bg-gray-50 rounded px-2 py-1.5 border">
                {{ requestData.note }}
              </dd>
            </div>
          </dl>
        </UCard>

        <!-- Signing Timeline -->
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
                <p v-if="step.signedBy" class="text-xs text-slate-400 mt-0.5">
                  โดย: {{ step.signedBy }}
                </p>
                <p v-else-if="step.assignedUserId" class="text-xs text-slate-400 mt-0.5">
                  โดย: {{ step.assignedUserId }}
                </p>
                <p v-if="step.signedAt" class="text-xs text-slate-400">
                  {{ formatDate(step.signedAt) }}
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

        <!-- All Filled Fields (admin sees everything) -->
        <UCard>
          <template #header>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              ข้อมูลที่กรอก (ทั้งหมด)
            </h3>
          </template>

          <div class="space-y-3">
            <div
              v-for="field in allFillableFields"
              :key="field.instanceId"
              class="flex flex-col gap-0.5"
            >
              <span class="text-xs text-gray-400 font-medium">{{ field.label || field.name }}</span>
              <span class="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 min-h-9 flex items-center">
                {{ fieldValues[field.id] || '—' }}
              </span>
            </div>
            <div v-if="allFillableFields.length === 0" class="text-center py-6 text-gray-400 text-sm">
              ไม่มีข้อมูลที่กรอก
            </div>
          </div>
        </UCard>

        <!-- Attachments -->
        <UCard v-if="attachments.length > 0">
          <template #header>
            <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              ไฟล์แนบ
            </h3>
          </template>
          <div class="space-y-2">
            <div
              v-for="attachment in attachments"
              :key="attachment.id"
              class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100"
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
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-eye"
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
</template>
