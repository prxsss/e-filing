<script setup lang="ts">
import { LazyBaseConfirmDialogWithReason } from '#components';

definePageMeta({
  title: 'signDocument',
  middleware: ['permission'],
  permission: 'request.sign',
});

type FlowStep = {
  id: number;
  requestId: number;
  stepId: string;
  stepOrder: number;
  roleId: number;
  roleName: string;
  assignedFieldInstanceIds: string[];
  status: string;
  signedBy: string | null;
  signedAt: string | null;
};

type SignatureField = {
  instanceId: string;
  pageNumber: number;
  normalizedX?: number;
  normalizedY?: number;
  normalizedWidth?: number;
  normalizedHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type Attachment = {
  id: number;
  requestId: number;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
};

type SigningStatus = {
  requestId: number;
  status: string;
  filledDocumentUrl: string | null;
  templateName: string | null;
  note: string | null;
  flowSteps: FlowStep[];
  pendingStep: FlowStep | null;
  signatureFields: SignatureField[];
  documentWidth?: number;
  documentHeight?: number;
};

const route = useRoute();
const requestId = Number(route.params.id);

const overlay = useOverlay();
const toast = useToast();
const confirmDialogWithReason = overlay.create(LazyBaseConfirmDialogWithReason);

const isLoading = ref(true);
const isSigning = ref(false);
const isRejecting = ref(false);
const error = ref<string | null>(null);
const successMessage = ref('');

const signingStatus = ref<SigningStatus | null>(null);
const signatureDataUrl = ref<string | null>(null);
const showSignaturePopup = ref(false);
const attachments = ref<Attachment[]>([]);
const previewAttachment = ref<Attachment | null>(null);
const isPreviewOpen = ref(false);

function openPreview(att: Attachment) {
  previewAttachment.value = att;
  isPreviewOpen.value = true;
}

function closePreview() {
  isPreviewOpen.value = false;
  previewAttachment.value = null;
}

// Compute aspect ratio (width / height) of the pending signature field so the canvas
// matches the actual field box defined in the PDF template.
const pendingSignatureField = computed<SignatureField | undefined>(() => {
  const status = signingStatus.value;
  if (!status?.pendingStep)
    return undefined;
  const assignedIds = status.pendingStep.assignedFieldInstanceIds;
  return status.signatureFields.find(f => assignedIds.includes(f.instanceId))
    ?? status.signatureFields[0];
});

const signatureFieldAspectRatio = computed<number | undefined>(() => {
  const status = signingStatus.value;
  const field = pendingSignatureField.value;
  if (!status || !field)
    return undefined;

  const { normalizedWidth: nw, normalizedHeight: nh } = field;
  const docW = status.documentWidth ?? 595;
  const docH = status.documentHeight ?? 842;

  // Prefer normalized dimensions (template-relative), then fall back to absolute values.
  if (nw && nh) {
    return (nw * docW) / (nh * docH);
  }

  if (field.width && field.height) {
    return field.width / field.height;
  }

  return undefined;
});

// Real field width in PDF points — lets the canvas calibrate stroke thickness
// so lines appear identical in the PDF regardless of canvas CSS size.
const signatureFieldWidthPt = computed<number | undefined>(() => {
  const status = signingStatus.value;
  const field = pendingSignatureField.value;
  if (!status || !field)
    return undefined;

  if (field.normalizedWidth) {
    return field.normalizedWidth * (status.documentWidth ?? 595);
  }

  return field.width;
});

const signatureFieldScale = 4;

function getPositiveDimension(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getSignaturePopupFieldDimensions(
  field: SignatureField | undefined,
  status: SigningStatus | null,
): { width: number | null; height: number | null } {
  if (!field || !status) {
    return { width: null, height: null };
  }

  const documentWidth = getPositiveDimension(status.documentWidth) ?? 595;
  const documentHeight = getPositiveDimension(status.documentHeight) ?? 842;

  const normalizedWidth = getPositiveDimension(field.normalizedWidth);
  const normalizedHeight = getPositiveDimension(field.normalizedHeight);
  if (normalizedWidth !== null && normalizedHeight !== null) {
    return {
      width: Math.round(normalizedWidth * documentWidth * signatureFieldScale),
      height: Math.round(normalizedHeight * documentHeight * signatureFieldScale),
    };
  }

  const displayWidth = getPositiveDimension((field as any).displayWidth);
  const displayHeight = getPositiveDimension((field as any).displayHeight);
  if (displayWidth !== null && displayHeight !== null) {
    return {
      width: Math.round(displayWidth * signatureFieldScale),
      height: Math.round(displayHeight * signatureFieldScale),
    };
  }

  const width = getPositiveDimension(field.width);
  const height = getPositiveDimension(field.height);
  if (width !== null && height !== null) {
    return {
      width: Math.round(width * signatureFieldScale),
      height: Math.round(height * signatureFieldScale),
    };
  }

  return {
    width: null,
    height: null,
  };
}

const signaturePopupStyle = computed(() => {
  const dimensions = getSignaturePopupFieldDimensions(pendingSignatureField.value, signingStatus.value);
  const popupWidth = (dimensions.width ?? 320) + 32;

  return {
    width: `min(calc(100vw - 2rem), ${popupWidth}px)`,
    maxHeight: 'calc(100vh - 2rem)',
  };
});

const signatureFieldBoxStyle = computed(() => {
  const dimensions = getSignaturePopupFieldDimensions(pendingSignatureField.value, signingStatus.value);

  return {
    width: `${dimensions.width ?? 320}px`,
    maxWidth: '100%',
  };
});

function openSignaturePopup() {
  showSignaturePopup.value = true;
}

function closeSignaturePopup() {
  showSignaturePopup.value = false;
}

// Enriches signature fields with the confirmed signature image URL so TemplatePdfPreview can overlay it
const signatureFieldsForDisplay = computed(() => {
  const fields = signingStatus.value?.signatureFields ?? [];
  return fields.map(f => ({
    ...f,
    type: 'Signature',
    ...(signatureDataUrl.value ? { imageUrl: signatureDataUrl.value } : {}),
  }));
});

async function fetchStatus() {
  isLoading.value = true;
  error.value = null;
  try {
    const result = await $fetch<{ success: boolean; data: SigningStatus; error?: string }>(
      `/api/requests/${requestId}/signing-status`,
    );
    if (result.success) {
      signingStatus.value = result.data;
    }
    else {
      error.value = result.error ?? 'Failed to load signing status';
    }
  }
  catch (err: any) {
    error.value = err?.message ?? 'Failed to load document';
  }
  finally {
    isLoading.value = false;
  }
}

function handleSignatureConfirmed(dataUrl: string) {
  signatureDataUrl.value = dataUrl;
  showSignaturePopup.value = false;
}

async function rejectRequest() {
  const instance = confirmDialogWithReason.open({
    title: 'ปฏิเสธการลงนาม',
    description: `ขั้นตอนที่ ${signingStatus.value?.pendingStep?.stepOrder} (${signingStatus.value?.pendingStep?.roleName}) — กรุณาระบุเหตุผลในการปฏิเสธ`,
    reasonRequired: true,
    reasonPlaceholder: 'ระบุเหตุผลในการปฏิเสธ เช่น ข้อมูลไม่ถูกต้อง / เอกสารไม่ครบ...',
    reasonErrorMessage: 'กรุณาระบุเหตุผลในการปฏิเสธ',
    cancelButton: { label: 'ยกเลิก' },
    confirmButton: { label: 'ยืนยันการปฏิเสธ', color: 'error' },
  });

  const result = await instance.result;
  if (!result.confirmed)
    return;

  isRejecting.value = true;
  error.value = null;

  try {
    const res = await $fetch<{ success: boolean; data: any; error?: string }>(
      `/api/requests/${requestId}/reject`,
      {
        method: 'POST',
        body: { reason: result.confirmationReason },
      },
    );

    if (res.success) {
      toast.add({
        title: 'ปฏิเสธการลงนามแล้ว',
        description: 'คำร้องถูกปฏิเสธเรียบร้อย',
        color: 'error',
      });
      signatureDataUrl.value = null;
      showSignaturePopup.value = false;
      await fetchStatus();
    }
    else {
      error.value = res.error ?? 'ไม่สามารถปฏิเสธคำร้องได้';
    }
  }
  catch (err: any) {
    error.value = err?.message ?? 'เกิดข้อผิดพลาด';
  }
  finally {
    isRejecting.value = false;
  }
}

async function submitSignature() {
  if (!signatureDataUrl.value) {
    error.value = 'กรุณาลงลายเซ็นให้เรียบร้อยก่อน';
    return;
  }

  isSigning.value = true;
  error.value = null;

  try {
    const result = await $fetch<{ success: boolean; data: any; error?: string }>(
      `/api/requests/${requestId}/sign`,
      {
        method: 'POST',
        body: { signatureDataUrl: signatureDataUrl.value },
      },
    );

    if (result.success) {
      const newStatus = result.data?.status;
      if (newStatus === 'completed') {
        successMessage.value = 'ลงนามสำเร็จ! เอกสารดำเนินการเสร็จสมบูรณ์';
      }
      else {
        successMessage.value = `ลงนามสำเร็จ! ส่งต่อไปยัง ${result.data?.nextRole ?? 'ขั้นตอนถัดไป'} แล้ว`;
      }
      signatureDataUrl.value = null;
      showSignaturePopup.value = false;
      await fetchStatus();
    }
    else {
      error.value = result.error ?? 'ลงนามไม่สำเร็จ';
    }
  }
  catch (err: any) {
    error.value = err?.message ?? 'เกิดข้อผิดพลาด';
  }
  finally {
    isSigning.value = false;
  }
}

const statusColor: Record<string, string> = {
  waiting: 'neutral',
  pending: 'warning',
  signed: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

const statusLabel: Record<string, string> = {
  waiting: 'รอดำเนินการ',
  pending: 'รอลงนาม',
  signed: 'ลงนามแล้ว',
  rejected: 'ปฏิเสธ',
  cancelled: 'ยกเลิก',
};

async function fetchAttachments() {
  try {
    const result = await $fetch<{ success: boolean; data: Attachment[] }>(
      `/api/requests/${requestId}/attachments`,
    );
    if (result.success) {
      attachments.value = result.data;
    }
  }
  catch {}
}

function getFileIcon(fileName: string | null): string {
  if (!fileName)
    return 'i-heroicons-document';
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'i-heroicons-document-text';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif': return 'i-heroicons-photo';
    case 'doc':
    case 'docx': return 'i-heroicons-document-text';
    case 'xls':
    case 'xlsx': return 'i-heroicons-table-cells';
    case 'zip':
    case 'rar': return 'i-heroicons-archive-box';
    default: return 'i-heroicons-document';
  }
}

const breadcrumbLinks = computed(() => [
  { label: 'รายการที่ต้องลงนาม', to: '/signer/to-sign' },
  { label: signingStatus.value?.templateName ?? `คำร้อง #${requestId}` },
]);

const hasConfirmedSignature = computed(() => (signatureDataUrl.value ?? '').length > 0);

watch(
  () => signingStatus.value?.pendingStep,
  (pending) => {
    if (!pending)
      showSignaturePopup.value = false;
  },
);

onMounted(() => {
  fetchStatus();
  fetchAttachments();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header (aligned with student new-request) -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <UBreadcrumb :links="breadcrumbLinks" />
        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ signingStatus?.templateName ?? 'ลงนามเอกสาร' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500">
              คำร้อง #{{ requestId }} · ดูเอกสารด้านซ้าย ดำเนินการด้านขวา
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
          <p class="text-gray-500">
            กำลังโหลดเอกสาร...
          </p>
        </div>
      </div>

      <!-- Load error -->
      <UCard v-else-if="!signingStatus">
        <div class="text-center py-8">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
          <p class="text-red-600 mb-4">
            {{ error ?? 'ไม่สามารถโหลดข้อมูลได้' }}
          </p>
          <UButton to="/signer/to-sign">
            กลับไปรายการที่ต้องลงนาม
          </UButton>
        </div>
      </UCard>

      <template v-else>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <!-- Left: PDF preview (sticky on large screens) -->
          <div
            class="lg:col-span-2 lg:sticky lg:top-4 lg:z-10 lg:max-h-[min(100vh-5rem,100dvh-5rem)] lg:overflow-y-auto lg:pr-1 lg:-ml-1 lg:pl-1"
          >
            <div v-if="signingStatus.filledDocumentUrl" style="min-height: 600px;">
              <TemplatePdfPreview
                :pdf-url="signingStatus.filledDocumentUrl"
                :placed-fields="signatureFieldsForDisplay"
                :open-in-new-tab-url="signingStatus.filledDocumentUrl"
                open-in-new-tab-label="เปิดในแท็บใหม่"
              />
            </div>
            <div
              v-else
              class="flex items-center justify-center rounded-lg border border-gray-200 bg-white"
              style="min-height: 600px;"
            >
              <p class="text-sm text-gray-500 px-4 text-center">
                ยังไม่มีไฟล์ PDF สำหรับแสดงตัวอย่าง
              </p>
            </div>
          </div>

          <!-- Right: status, flow, attachments, actions -->
          <div class="space-y-6">
            <UCard v-if="successMessage" class="bg-green-50 border-green-200">
              <div class="flex items-center gap-2 text-green-800">
                <i class="fas fa-check-circle" />
                <span class="font-medium">{{ successMessage }}</span>
              </div>
            </UCard>

            <UCard v-if="error" class="bg-red-50 border-red-200">
              <div class="flex items-center gap-2 text-red-800">
                <i class="fas fa-exclamation-circle" />
                <span class="font-medium">{{ error }}</span>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <h3 class="text-sm font-semibold text-gray-500 uppercase">
                  ลำดับการลงนาม
                </h3>
              </template>
              <div class="space-y-2">
                <div
                  v-for="step in signingStatus.flowSteps"
                  :key="step.id"
                  class="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                  :class="step.status === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'"
                >
                  <span
                    class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    :class="{
                      'bg-green-500': step.status === 'signed',
                      'bg-amber-500': step.status === 'pending',
                      'bg-slate-300': step.status === 'waiting' || step.status === 'cancelled',
                      'bg-red-500': step.status === 'rejected',
                    }"
                  >
                    <UIcon v-if="step.status === 'signed'" name="i-heroicons-check" class="w-4 h-4" />
                    <UIcon v-else-if="step.status === 'rejected'" name="i-heroicons-x-mark" class="w-4 h-4" />
                    <template v-else>{{ step.stepOrder }}</template>
                  </span>
                  <span class="font-medium text-sm text-gray-900">{{ step.roleName }}</span>
                  <UBadge
                    :color="(statusColor[step.status] ?? 'neutral')"
                    :label="statusLabel[step.status] ?? step.status"
                    variant="soft"
                    size="sm"
                    class="ml-auto"
                  />
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold text-gray-500 uppercase">
                    เอกสารแนบ
                  </h3>
                  <UBadge
                    v-if="attachments.length > 0"
                    :label="String(attachments.length)"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                </div>
              </template>

              <div v-if="attachments.length === 0" class="text-center py-8 text-gray-500">
                <i class="fas fa-paperclip text-3xl mb-2" />
                <p class="text-sm">
                  ไม่มีเอกสารแนบ
                </p>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="att in attachments"
                  :key="att.id"
                  class="flex items-center justify-between gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <UIcon
                      :name="getFileIcon(att.fileName)"
                      class="w-5 h-5 text-blue-600 shrink-0"
                    />
                    <span class="text-sm font-medium text-gray-900 truncate">{{ att.fileName ?? 'ไม่ระบุชื่อ' }}</span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <UButton
                      v-if="att.fileUrl"
                      size="xs"
                      variant="soft"
                      color="primary"
                      icon="i-heroicons-eye"
                      @click="openPreview(att)"
                    >
                      ดูไฟล์
                    </UButton>
                    <UButton
                      v-if="att.fileUrl"
                      size="xs"
                      variant="outline"
                      color="neutral"
                      icon="i-heroicons-arrow-top-right-on-square"
                      :to="att.fileUrl"
                      target="_blank"
                    >
                      เปิดใหม่
                    </UButton>
                  </div>
                </div>
              </div>
            </UCard>

            <UAlert
              v-if="signingStatus.pendingStep"
              color="info"
              variant="soft"
              icon="i-heroicons-pencil-square"
              title="ต้องลงลายเซ็นในขั้นตอนนี้"
              :description="`ขั้นตอนที่ ${signingStatus.pendingStep.stepOrder} (${signingStatus.pendingStep.roleName}) — กดปุ่มด้านล่างเพื่อเปิดกล่องเซ็นลายมือชื่อ`"
            />

            <UCard v-if="signingStatus.pendingStep">
              <template #header>
                <h3 class="text-sm font-semibold text-gray-500 uppercase">
                  ลงลายเซ็น
                </h3>
              </template>

              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p class="text-xs text-gray-500">
                    กดปุ่มเพื่อเปิด popup เซ็นเอกสาร จากนั้นวาดและกดยืนยันในกล่อง
                  </p>
                  <UButton
                    color="primary"
                    icon="i-heroicons-pencil-square"
                    @click="openSignaturePopup"
                  >
                    {{ hasConfirmedSignature ? 'แก้ไขลายเซ็น' : 'เปิดกล่องเซ็นลายมือชื่อ' }}
                  </UButton>
                </div>

                <p
                  v-if="hasConfirmedSignature"
                  class="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2"
                >
                  ยืนยันลายเซ็นแล้ว กดส่งเพื่อดำเนินการต่อ
                </p>
                <!-- Action buttons moved out of the signature card for layout parity with student new-request -->
              </div>
            </UCard>

            <div v-if="signingStatus.pendingStep" class="flex flex-col gap-3">
              <UButton
                color="success"
                size="lg"
                block
                icon="i-heroicons-paper-airplane"
                :loading="isSigning"
                :disabled="!signatureDataUrl || isRejecting"
                @click="submitSignature"
              >
                ส่งลายเซ็นและดำเนินการต่อ
              </UButton>
              <UButton
                color="error"
                variant="soft"
                size="lg"
                block
                icon="i-heroicons-x-circle"
                :loading="isRejecting"
                :disabled="isSigning"
                @click="rejectRequest"
              >
                ปฏิเสธการลงนาม
              </UButton>
            </div>

            <UCard v-else-if="signingStatus.status === 'rejected'">
              <div class="text-center py-8">
                <UIcon name="i-heroicons-x-circle" class="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 class="text-xl font-bold text-gray-900 mb-2">
                  คำร้องถูกปฏิเสธ
                </h3>
                <p v-if="signingStatus.note" class="text-gray-500 mb-4 max-w-md mx-auto text-sm">
                  เหตุผล: {{ signingStatus.note }}
                </p>
                <p v-else class="text-gray-500 mb-4 text-sm">
                  คำร้องนี้ถูกปฏิเสธโดยผู้ลงนาม
                </p>
              </div>
            </UCard>

            <UCard v-else-if="signingStatus.status === 'completed'">
              <div class="text-center py-8">
                <UIcon name="i-heroicons-check-circle" class="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 class="text-xl font-bold text-gray-900 mb-2">
                  เอกสารดำเนินการเสร็จสมบูรณ์
                </h3>
                <p class="text-gray-500 mb-4 text-sm">
                  ทุกขั้นตอนการลงนามเสร็จเรียบร้อยแล้ว
                </p>
                <UButton
                  v-if="signingStatus.filledDocumentUrl"
                  :to="signingStatus.filledDocumentUrl"
                  target="_blank"
                  color="success"
                  icon="i-heroicons-arrow-down-tray"
                >
                  ดาวน์โหลดเอกสาร
                </UButton>
              </div>
            </UCard>

            <UCard v-else-if="!signingStatus.pendingStep && signingStatus.status !== 'completed'">
              <div class="text-center py-8">
                <UIcon name="i-heroicons-clock" class="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h3 class="font-semibold text-gray-900 mb-2">
                  ยังไม่ถึงคิวของคุณ
                </h3>
                <p class="text-sm text-gray-500">
                  กำลังรอขั้นตอนก่อนหน้าดำเนินการให้เสร็จ
                </p>
              </div>
            </UCard>

            <UButton
              block
              variant="ghost"
              color="neutral"
              to="/signer/to-sign"
            >
              <i class="fas fa-arrow-left mr-2" />
              กลับไปรายการที่ต้องลงนาม
            </UButton>
          </div>
        </div>

        <UModal v-model:open="isPreviewOpen" class="max-w-4xl" @close="closePreview">
          <template #header>
            <div class="flex items-center gap-2 min-w-0">
              <UIcon :name="getFileIcon(previewAttachment?.fileName ?? null)" class="text-gray-500 shrink-0" />
              <span class="font-semibold text-gray-900 truncate">{{ previewAttachment?.fileName ?? 'เอกสารแนบ' }}</span>
            </div>
          </template>
          <template #body>
            <div v-if="previewAttachment?.fileUrl" class="w-full">
              <iframe
                v-if="previewAttachment.fileName?.toLowerCase().endsWith('.pdf')"
                :src="previewAttachment.fileUrl"
                class="w-full rounded border border-gray-200"
                style="height: 70vh;"
                frameborder="0"
              />
              <img
                v-else-if="/\.(jpe?g|png|gif|webp)$/i.test(previewAttachment.fileName ?? '')"
                :src="previewAttachment.fileUrl"
                :alt="previewAttachment.fileName ?? ''"
                class="max-w-full mx-auto rounded"
              >
              <div v-else class="text-center py-12 text-gray-500">
                <UIcon name="i-heroicons-document" class="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p class="text-sm">
                  ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้
                </p>
                <UButton
                  :to="previewAttachment.fileUrl"
                  target="_blank"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-arrow-down-tray"
                  class="mt-3"
                >
                  ดาวน์โหลดไฟล์
                </UButton>
              </div>
            </div>
          </template>
        </UModal>

        <!-- Signature popup (same pattern as student new-request) -->
        <div
          v-if="showSignaturePopup && signingStatus.pendingStep"
          class="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]"
          @click.self="closeSignaturePopup"
        >
          <div class="absolute bottom-4 right-4" :style="signaturePopupStyle">
            <UCard class="overflow-hidden border border-gray-200 shadow-2xl bg-white">
              <template #header>
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-900">
                      เซ็นลายเซ็น — ขั้นตอนที่ {{ signingStatus.pendingStep.stepOrder }}
                      ({{ signingStatus.pendingStep.roleName }})
                    </h3>
                  </div>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-x-mark"
                    @click="closeSignaturePopup"
                  />
                </div>
              </template>

              <div class="space-y-3 p-1">
                <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <div class="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>เซ็นในช่องด้านล่าง แล้วกดยืนยัน</span>
                  </div>

                  <div :style="signatureFieldBoxStyle" class="mx-auto">
                    <SignatureCanvas
                      class="w-full"
                      :disabled="isSigning"
                      :aspect-ratio="signatureFieldAspectRatio"
                      :pdf-field-width-pt="signatureFieldWidthPt"
                      @confirm="handleSignatureConfirmed"
                    />
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
