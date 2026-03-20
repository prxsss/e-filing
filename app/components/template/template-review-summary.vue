<script setup lang="ts">
import type { FieldInstance, FileTypeValue, SigningStep } from '~/types/template';

const props = defineProps<{
  templateName: string;
  templateDescription: string;
  uploadedFile: File | null;
  fileType: FileTypeValue;
  placedFields: FieldInstance[];
  signingSteps: SigningStep[];
  pdfFile: File | null;
  uiScale: number;
}>();

const emit = defineEmits<{
  'update:templateDescription': [value: string];
}>();

const { t } = useI18n();

const descriptionInput = ref<any>(null);
const isDescriptionError = ref(false);

const localDescription = computed({
  get: () => props.templateDescription,
  set: value => emit('update:templateDescription', value),
});

// Clear error state as soon as the user starts typing
watch(localDescription, (newVal) => {
  if (newVal && String(newVal).trim() !== '') {
    isDescriptionError.value = false;
  }
});

// Validation and Focus logic exposed for the parent (create.vue) save button to trigger
function validateAndFocus(): boolean {
  if (!localDescription.value || String(localDescription.value).trim() === '') {
    isDescriptionError.value = true;

    // Focus the text area
    nextTick(() => {
      if (descriptionInput.value) {
        // Try focusing the Nuxt UI component directly, fallback to native textarea
        if (typeof descriptionInput.value.focus === 'function') {
          descriptionInput.value.focus();
        }
        else {
          const el = descriptionInput.value.$el || descriptionInput.value;
          const textarea = el.tagName === 'TEXTAREA' ? el : el.querySelector('textarea');
          if (textarea)
            textarea.focus();
        }
      }
    });
    return false;
  }

  isDescriptionError.value = false;
  return true;
}

// Expose the method so the parent (create.vue) can trigger it
defineExpose({ validateAndFocus });

function getFieldCountForStep(step: SigningStep, fields: FieldInstance[]): number {
  return fields.filter(f => f.signerStepId === step.id).length;
}
</script>

<template>
  <div class="flex-1 overflow-auto p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Header -->
      <div class="text-center mb-8">
        <UIcon name="i-heroicons-clipboard-document-check" class="w-12 h-12 mx-auto mb-3 text-primary-500" />
        <h2 class="text-xl font-bold text-gray-900">
          {{ t('templateSummary') }}
        </h2>
        <p class="text-sm text-gray-500 mt-1">
          ตรวจสอบข้อมูลทั้งหมดก่อนบันทึกเทมเพลต
        </p>
      </div>

      <!-- Template Info Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="text-primary-500" />
          ข้อมูลเทมเพลต
        </h3>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label class="text-xs font-semibold text-gray-500 uppercase">{{ t('templateName') }}</label>
            <p class="text-sm font-medium text-gray-900 mt-1">
              {{ templateName }}
            </p>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-500 uppercase">{{ t('fileName') }}</label>
            <p class="text-sm font-medium text-gray-900 mt-1">
              {{ uploadedFile?.name || '-' }}
            </p>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-500 uppercase">{{ t('fileType') }}</label>
            <p class="text-sm mt-1">
              <UBadge :color="fileType === 'pdf' ? 'error' : 'info'" variant="subtle" size="xs">
                {{ fileType === 'pdf' ? 'PDF' : 'Image' }}
              </UBadge>
            </p>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-500 uppercase">{{ t('fieldCount') }}</label>
            <p class="text-sm font-medium text-gray-900 mt-1">
              {{ placedFields.length }} {{ t('fields') }}
            </p>
          </div>
        </div>

        <!-- Required Template Description Input -->
        <div class="border-t border-gray-100 pt-5 mt-2">
          <div class="bg-primary-50/50 p-4 rounded-lg border border-primary-100 transition-colors" :class="{ 'border-red-200 bg-red-50/50': isDescriptionError }">
            <UFormGroup
              label="รายละเอียดเทมเพลต"
              description="คำอธิบายนี้จะช่วยให้ผู้ใช้เข้าใจจุดประสงค์ของเทมเพลตนี้ได้ง่ายขึ้น"
              required
              :error="isDescriptionError ? 'กรุณาระบุรายละเอียดเทมเพลตก่อนยืนยัน' : false"
            >
              <UTextarea
                ref="descriptionInput"
                v-model="localDescription"
                placeholder="ระบุรายละเอียด..."
                :rows="3"
                class="mt-1 w-full"
                autofocus
              />
            </UFormGroup>
          </div>
        </div>
      </div>

      <!-- Signing Flow Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-queue-list" class="text-primary-500" />
          {{ t('signingFlowOverview') }}
        </h3>

        <!-- Flow Timeline -->
        <div class="space-y-0">
          <div v-for="(step, index) in signingSteps" :key="step.id" class="relative">
            <!-- Connector line -->
            <div
              v-if="index < signingSteps.length - 1"
              class="absolute left-3.75 top-9 w-0.5 h-8 bg-gray-200"
            />

            <div class="flex items-start gap-3 pb-4">
              <!-- Step circle -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                :style="{ backgroundColor: step.color }"
              >
                {{ step.order }}
              </div>

              <!-- Step info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-gray-900">{{ step.roleName }}</span>
                  <UBadge :color="step.isRequired ? 'primary' : 'neutral'" variant="subtle" size="xs">
                    {{ step.isRequired ? t('required') : t('optional') }}
                  </UBadge>
                </div>
                <p v-if="step.description" class="text-xs text-gray-500 mt-0.5">
                  {{ step.description }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ getFieldCountForStep(step, placedFields) }} {{ t('assignedFields') }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PDF Preview Card -->
      <div v-if="fileType === 'pdf' && pdfFile" class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-eye" class="text-primary-500" />
          ตัวอย่างเอกสาร
        </h3>
        <div class="overflow-hidden rounded-lg border border-gray-200 overflow-y-auto max-h-150">
          <template-pdf-create
            :pdf-file="pdfFile"
            :placed-fields="placedFields"
            :ui-scale="1"
            :read-only="true"
            :signing-steps="signingSteps"
          />
        </div>
      </div>
    </div>
  </div>
</template>
