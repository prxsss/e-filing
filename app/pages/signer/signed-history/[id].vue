<script setup lang="ts">
import { LazyBaseConfirmDialogWithReason } from '#components';

definePageMeta({
  title: 'signerSignedHistory.title',
  middleware: ['permission'],
  permission: 'request.sign_history.view',
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
const { t } = useI18n();

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
const showSignaturePad = ref(false);
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
      // Auto-show signature pad if there's a pending step
      if (result.data.pendingStep) {
        showSignaturePad.value = true;
      }
    }
    else {
      error.value = result.error ?? t('signerSignedHistoryDetail.errors.loadSigningStatus');
    }
  }
  catch (err: any) {
    error.value = err?.message ?? t('signerSignedHistoryDetail.errors.loadDocument');
  }
  finally {
    isLoading.value = false;
  }
}

function handleSignatureConfirmed(dataUrl: string) {
  signatureDataUrl.value = dataUrl;
}

async function rejectRequest() {
  const instance = confirmDialogWithReason.open({
    title: t('signerSignedHistoryDetail.rejectDialog.title'),
    description: t('signerSignedHistoryDetail.rejectDialog.description', {
      step: signingStatus.value?.pendingStep?.stepOrder,
      role: signingStatus.value?.pendingStep?.roleName,
    }),
    reasonRequired: true,
    reasonPlaceholder: t('signerSignedHistoryDetail.rejectDialog.reasonPlaceholder'),
    reasonErrorMessage: t('signerSignedHistoryDetail.rejectDialog.reasonErrorMessage'),
    cancelButton: { label: t('common.actions.cancel') },
    confirmButton: { label: t('signerSignedHistoryDetail.rejectDialog.confirm'), color: 'error' },
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
        title: t('signerSignedHistoryDetail.toast.rejectedTitle'),
        description: t('signerSignedHistoryDetail.toast.rejectedDescription'),
        color: 'error',
      });
      signatureDataUrl.value = null;
      showSignaturePad.value = false;
      await fetchStatus();
    }
    else {
      error.value = res.error ?? t('signerSignedHistoryDetail.errors.rejectFailed');
    }
  }
  catch (err: any) {
    error.value = err?.message ?? t('signerSignedHistoryDetail.errors.generic');
  }
  finally {
    isRejecting.value = false;
  }
}

async function submitSignature() {
  if (!signatureDataUrl.value) {
    error.value = t('signerSignedHistoryDetail.errors.signatureRequired');
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
        successMessage.value = t('signerSignedHistoryDetail.success.completed');
      }
      else {
        successMessage.value = t('signerSignedHistoryDetail.success.forwarded', {
          role: result.data?.nextRole ?? t('signerSignedHistoryDetail.success.nextStepFallback'),
        });
      }
      signatureDataUrl.value = null;
      showSignaturePad.value = false;
      await fetchStatus();
    }
    else {
      error.value = result.error ?? t('signerSignedHistoryDetail.errors.signFailed');
    }
  }
  catch (err: any) {
    error.value = err?.message ?? t('signerSignedHistoryDetail.errors.generic');
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

const statusLabel = computed<Record<string, string>>(() => ({
  waiting: t('signerSignedHistoryDetail.status.waiting'),
  pending: t('signerSignedHistoryDetail.status.pending'),
  signed: t('signerSignedHistoryDetail.status.signed'),
  rejected: t('signerSignedHistoryDetail.status.rejected'),
  cancelled: t('signerSignedHistoryDetail.status.cancelled'),
}));

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
    return 'i-lucide-file';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf')
    return 'i-lucide-file-text';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? ''))
    return 'i-lucide-image';
  if (['doc', 'docx'].includes(ext ?? ''))
    return 'i-lucide-file-type';
  return 'i-lucide-file';
}

onMounted(() => {
  fetchStatus();
  fetchAttachments();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          to="/signer/signed-history"
        />
        <div>
          <h1 class="text-xl font-bold text-slate-800">
            {{ signingStatus?.templateName ?? $t('signerSignedHistoryDetail.header.defaultTitle') }}
          </h1>
          <p class="text-sm text-slate-500">
            {{ $t('signerSignedHistoryDetail.header.requestNumber', { id: requestId }) }}
          </p>
        </div>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center py-20">
        <UIcon name="i-lucide-loader-circle" class="w-10 h-10 text-green-600 animate-spin" />
      </div>

      <template v-else-if="signingStatus">
        <!-- Success banner -->
        <UAlert
          v-if="successMessage"
          icon="i-lucide-circle-check"
          color="success"
          variant="soft"
          :title="successMessage"
        />

        <!-- Error banner -->
        <UAlert
          v-if="error"
          icon="i-lucide-triangle-alert"
          color="error"
          variant="soft"
          :title="error"
        />

        <!-- Signing flow progress -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-slate-800 flex items-center gap-2">
              <UIcon name="i-lucide-list-ordered" class="text-green-600" />
              {{ $t('signerSignedHistoryDetail.signFlow.title') }}
            </h2>
          </template>
          <div class="space-y-2">
            <div
              v-for="step in signingStatus.flowSteps"
              :key="step.id"
              class="flex items-center gap-3 p-3 rounded-lg"
              :class="step.status === 'pending' ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'"
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
                <UIcon v-if="step.status === 'signed'" name="i-lucide-check" class="w-4 h-4" />
                <UIcon v-else-if="step.status === 'rejected'" name="i-lucide-x" class="w-4 h-4" />
                <template v-else>{{ step.stepOrder }}</template>
              </span>
              <span class="font-medium text-sm">{{ step.roleName }}</span>
              <UBadge
                :color="(statusColor[step.status] ?? 'neutral') as any"
                :label="statusLabel[step.status] ?? step.status"
                variant="soft"
                size="sm"
                class="ml-auto"
              />
            </div>
          </div>
        </UCard>

        <!-- Attachments -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-slate-800 flex items-center gap-2">
              <UIcon name="i-lucide-paperclip" class="text-green-600" />
              {{ $t('signerSignedHistoryDetail.attachments.title') }}
              <UBadge v-if="attachments.length > 0" :label="String(attachments.length)" color="neutral" variant="soft" size="sm" />
            </h2>
          </template>
          <!-- Empty state -->
          <p v-if="attachments.length === 0" class="text-sm text-slate-400 py-2">
            {{ $t('signerSignedHistoryDetail.attachments.empty') }}
          </p>
          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="att in attachments"
              :key="att.id"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <UIcon :name="getFileIcon(att.fileName)" class="w-5 h-5 text-slate-400 shrink-0" />
              <span class="text-sm text-slate-700 truncate flex-1">{{ att.fileName ?? $t('signerSignedHistoryDetail.attachments.unnamed') }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <UButton
                  v-if="att.fileUrl"
                  size="xs"
                  variant="soft"
                  color="primary"
                  icon="i-lucide-eye"
                  @click="openPreview(att)"
                >
                  {{ $t('signerSignedHistoryDetail.attachments.actions.preview') }}
                </UButton>
                <UButton
                  v-if="att.fileUrl"
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-external-link"
                  :to="att.fileUrl"
                  target="_blank"
                >
                  {{ $t('signerSignedHistoryDetail.attachments.actions.openNew') }}
                </UButton>
              </div>
            </div>
          </div>
        </UCard>
        <UModal v-model:open="isPreviewOpen" class="max-w-4xl" @close="closePreview">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon :name="getFileIcon(previewAttachment?.fileName ?? null)" class="text-slate-500" />
              <span class="font-semibold text-slate-800 truncate">{{ previewAttachment?.fileName ?? $t('signerSignedHistoryDetail.attachments.title') }}</span>
            </div>
          </template>
          <template #body>
            <div v-if="previewAttachment?.fileUrl" class="w-full">
              <!-- PDF preview -->
              <iframe
                v-if="previewAttachment.fileName?.toLowerCase().endsWith('.pdf')"
                :src="previewAttachment.fileUrl"
                class="w-full rounded"
                style="height: 70vh;"
                frameborder="0"
              />
              <!-- Image preview -->
              <img
                v-else-if="/\.(jpe?g|png|gif|webp)$/i.test(previewAttachment.fileName ?? '')"
                :src="previewAttachment.fileUrl"
                :alt="previewAttachment.fileName ?? ''"
                class="max-w-full mx-auto rounded"
              >
              <!-- Fallback -->
              <div v-else class="text-center py-12 text-slate-500">
                <UIcon name="i-lucide-file" class="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p class="text-sm">
                  {{ $t('signerSignedHistoryDetail.attachments.previewNotAvailable') }}
                </p>
                <UButton
                  :to="previewAttachment.fileUrl"
                  target="_blank"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-download"
                  class="mt-3"
                >
                  {{ $t('signerSignedHistoryDetail.attachments.actions.download') }}
                </UButton>
              </div>
            </div>
          </template>
        </UModal>

        <!-- PDF viewer -->
        <UCard v-if="signingStatus.filledDocumentUrl">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold text-slate-800 flex items-center gap-2">
                <UIcon name="i-lucide-file-text" class="text-green-600" />
                {{ $t('signerSignedHistoryDetail.document.title') }}
              </h2>
              <UButton
                :to="signingStatus.filledDocumentUrl"
                target="_blank"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-external-link"
              >
                {{ $t('signerSignedHistoryDetail.document.openInNewTab') }}
              </UButton>
            </div>
          </template>
          <TemplatePdfPreview
            :pdf-url="signingStatus.filledDocumentUrl!"
            :placed-fields="signatureFieldsForDisplay"
          />
        </UCard>

        <!-- Signature section — shown when it's the current user's turn -->
        <UCard v-if="signingStatus.pendingStep">
          <template #header>
            <h2 class="font-semibold text-slate-800 flex items-center gap-2">
              <UIcon name="i-lucide-pen-line" class="text-amber-500" />
              {{ $t('signerSignedHistoryDetail.signature.title', { step: signingStatus.pendingStep.stepOrder, role: signingStatus.pendingStep.roleName }) }}
            </h2>
            <p class="text-sm text-slate-500 mt-1">
              {{ $t('signerSignedHistoryDetail.signature.description') }}
            </p>
          </template>

          <div class="space-y-4">
            <SignatureCanvas
              :disabled="isSigning"
              :aspect-ratio="signatureFieldAspectRatio"
              :pdf-field-width-pt="signatureFieldWidthPt"
              @confirm="handleSignatureConfirmed"
            />

            <div class="flex flex-wrap gap-3">
              <UButton
                color="success"
                size="lg"
                icon="i-lucide-send"
                :loading="isSigning"
                :disabled="!signatureDataUrl || isRejecting"
                @click="submitSignature"
              >
                {{ $t('signerSignedHistoryDetail.signature.submit') }}
              </UButton>
              <UButton
                color="error"
                variant="soft"
                size="lg"
                icon="i-lucide-x-circle"
                :loading="isRejecting"
                :disabled="isSigning"
                @click="rejectRequest"
              >
                {{ $t('signerSignedHistoryDetail.signature.reject') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Rejected state -->
        <UCard v-else-if="signingStatus.status === 'rejected'">
          <div class="text-center py-8">
            <UIcon name="i-lucide-x-circle" class="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 class="text-xl font-bold text-slate-800 mb-2">
              {{ $t('signerSignedHistoryDetail.rejected.title') }}
            </h3>
            <p v-if="signingStatus.note" class="text-slate-500 mb-4 max-w-md mx-auto">
              {{ $t('signerSignedHistoryDetail.rejected.reasonPrefix') }}: {{ signingStatus.note }}
            </p>
            <p v-else class="text-slate-500 mb-4">
              {{ $t('signerSignedHistoryDetail.rejected.description') }}
            </p>
          </div>
        </UCard>

        <!-- Completed state -->
        <UCard v-else-if="signingStatus.status === 'completed'">
          <div class="text-center py-8">
            <UIcon name="i-lucide-circle-check-big" class="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 class="text-xl font-bold text-slate-800 mb-2">
              {{ $t('signerSignedHistoryDetail.completed.title') }}
            </h3>
            <p class="text-slate-500 mb-4">
              {{ $t('signerSignedHistoryDetail.completed.description') }}
            </p>
            <UButton
              v-if="signingStatus.filledDocumentUrl"
              :to="signingStatus.filledDocumentUrl"
              target="_blank"
              color="success"
              icon="i-lucide-download"
            >
              {{ $t('signerSignedHistoryDetail.completed.download') }}
            </UButton>
          </div>
        </UCard>

        <!-- Not your turn -->
        <UCard v-else-if="!signingStatus.pendingStep && signingStatus.status !== 'completed'">
          <div class="text-center py-8">
            <UIcon name="i-lucide-clock" class="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 class="font-semibold text-slate-800 mb-2">
              {{ $t('signerSignedHistoryDetail.notYourTurn.title') }}
            </h3>
            <p class="text-sm text-slate-500">
              {{ $t('signerSignedHistoryDetail.notYourTurn.description') }}
            </p>
          </div>
        </UCard>
      </template>

      <!-- Error state -->
      <div v-else class="text-center py-16">
        <UIcon name="i-lucide-triangle-alert" class="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 class="font-semibold text-slate-800 mb-2">
          {{ $t('signerSignedHistoryDetail.errors.loadDocumentTitle') }}
        </h3>
        <p class="text-sm text-slate-500">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>
