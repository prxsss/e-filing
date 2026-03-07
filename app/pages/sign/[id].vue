<script setup lang="ts">
definePageMeta({ title: 'Sign Document' });

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

type SigningStatus = {
  requestId: number;
  status: string;
  filledDocumentUrl: string | null;
  templateName: string | null;
  flowSteps: FlowStep[];
  pendingStep: FlowStep | null;
};

const route = useRoute();
const requestId = Number(route.params.id);

const isLoading = ref(true);
const isSigning = ref(false);
const error = ref<string | null>(null);
const successMessage = ref('');

const signingStatus = ref<SigningStatus | null>(null);
const signatureDataUrl = ref<string | null>(null);
const showSignaturePad = ref(false);

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
      showSignaturePad.value = false;
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
};

const statusLabel: Record<string, string> = {
  waiting: 'รอดำเนินการ',
  pending: 'รอลงนาม',
  signed: 'ลงนามแล้ว',
};

onMounted(fetchStatus);
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
          to="/student/to-sign"
        />
        <div>
          <h1 class="text-xl font-bold text-slate-800">
            {{ signingStatus?.templateName ?? 'ลงนามเอกสาร' }}
          </h1>
          <p class="text-sm text-slate-500">
            คำร้อง #{{ requestId }}
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
              ลำดับการลงนาม
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
                  'bg-slate-300': step.status === 'waiting',
                }"
              >
                <UIcon v-if="step.status === 'signed'" name="i-lucide-check" class="w-4 h-4" />
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

        <!-- PDF viewer -->
        <UCard v-if="signingStatus.filledDocumentUrl">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold text-slate-800 flex items-center gap-2">
                <UIcon name="i-lucide-file-text" class="text-green-600" />
                เอกสาร
              </h2>
              <UButton
                :to="signingStatus.filledDocumentUrl"
                target="_blank"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-external-link"
              >
                เปิดในแท็บใหม่
              </UButton>
            </div>
          </template>
          <div class="rounded-lg overflow-hidden border border-slate-200">
            <iframe
              :src="signingStatus.filledDocumentUrl"
              class="w-full"
              style="height: 600px;"
              title="เอกสาร"
            />
          </div>
        </UCard>

        <!-- Signature section — shown when it's the current user's turn -->
        <UCard v-if="signingStatus.pendingStep">
          <template #header>
            <h2 class="font-semibold text-slate-800 flex items-center gap-2">
              <UIcon name="i-lucide-pen-line" class="text-amber-500" />
              ลงลายเซ็น — ขั้นตอนที่ {{ signingStatus.pendingStep.stepOrder }}
              ({{ signingStatus.pendingStep.roleName }})
            </h2>
            <p class="text-sm text-slate-500 mt-1">
              วาดลายเซ็นของคุณในกรอบด้านล่าง แล้วกดยืนยัน
            </p>
          </template>

          <div class="space-y-4">
            <SignatureCanvas
              :disabled="isSigning"
              @confirm="handleSignatureConfirmed"
            />

            <!-- Preview after confirming signature -->
            <div v-if="signatureDataUrl" class="border rounded-lg p-3 bg-green-50">
              <p class="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                <UIcon name="i-lucide-check-circle" />
                ลายเซ็นพร้อมแล้ว — ตรวจสอบก่อนส่ง
              </p>
              <img
                :src="signatureDataUrl"
                alt="Signature preview"
                class="max-h-24 border border-green-200 rounded bg-white"
              >
            </div>

            <div class="flex gap-3">
              <UButton
                color="success"
                size="lg"
                icon="i-lucide-send"
                :loading="isSigning"
                :disabled="!signatureDataUrl"
                @click="submitSignature"
              >
                ส่งลายเซ็นและดำเนินการต่อ
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Completed state -->
        <UCard v-else-if="signingStatus.status === 'completed'">
          <div class="text-center py-8">
            <UIcon name="i-lucide-circle-check-big" class="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 class="text-xl font-bold text-slate-800 mb-2">
              เอกสารดำเนินการเสร็จสมบูรณ์
            </h3>
            <p class="text-slate-500 mb-4">
              ทุกขั้นตอนการลงนามเสร็จเรียบร้อยแล้ว
            </p>
            <UButton
              v-if="signingStatus.filledDocumentUrl"
              :to="signingStatus.filledDocumentUrl"
              target="_blank"
              color="success"
              icon="i-lucide-download"
            >
              ดาวน์โหลดเอกสาร
            </UButton>
          </div>
        </UCard>

        <!-- Not your turn -->
        <UCard v-else-if="!signingStatus.pendingStep && signingStatus.status !== 'completed'">
          <div class="text-center py-8">
            <UIcon name="i-lucide-clock" class="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 class="font-semibold text-slate-800 mb-2">
              ยังไม่ถึงคิวของคุณ
            </h3>
            <p class="text-sm text-slate-500">
              กำลังรอขั้นตอนก่อนหน้าดำเนินการให้เสร็จ
            </p>
          </div>
        </UCard>
      </template>

      <!-- Error state -->
      <div v-else class="text-center py-16">
        <UIcon name="i-lucide-triangle-alert" class="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 class="font-semibold text-slate-800 mb-2">
          ไม่สามารถโหลดเอกสารได้
        </h3>
        <p class="text-sm text-slate-500">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>
