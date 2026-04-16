<script setup lang="ts">
import { getAutoDateTimeFormatConfig } from '~~/shared/auto-date-time-format';
import { getFieldDisplayInstanceNumber, getNextFieldInstanceNumber } from '~~/shared/field-instance-number';

import type { FieldInstance, FieldVisibilityRule, FileTypeValue, PdfRef, SigningStep, WizardStep } from '~/types/template';

import { placeField } from '~/utils/place-field';
import {
  buildPastedFieldInstance,
  readTemplateFieldsFromClipboard,
  writeTemplateFieldsToSystemClipboard,
} from '~/utils/template-field-clipboard';

type Field = any;

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

definePageMeta({
  title: 'editTemplate',
  middleware: ['permission'],
  permission: 'template.edit',
});

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();

function tr(key: string, params?: Record<string, unknown>) {
  return params ? t(`adminTemplates.edit.${key}`, params) : t(`adminTemplates.edit.${key}`);
}

// ─── Template ID ──────────────────────────────────────────────────────────────

const templateId = computed<string | undefined>(() => {
  const id = route.query.id;
  if (typeof id === 'string')
    return id;
  if (Array.isArray(id) && typeof id[0] === 'string')
    return id[0];
  return undefined;
});

// ─── State ────────────────────────────────────────────────────────────────────

const isLoading = ref<boolean>(true);
const isSaving = ref<boolean>(false);
const templateData = ref<any>(null);
const templateName = ref<string>('');
const templateNameError = ref<string>('');
const hasChanges = ref<boolean>(false);
const fileWasReplaced = ref<boolean>(false);

// File / PDF
const uploadedFile = ref<File | null>(null);
const fileType = ref<FileTypeValue>(null);
const currentPdfPage = ref<number>(1);

// Fields
const placedFields = ref<FieldInstance[]>([]);
const selectedFieldInstanceIds = ref<string[]>([]);

const MAX_FIELDS_UNDO = 50;
const placedFieldsUndoStack = ref<FieldInstance[][]>([]);

function clonePlacedFieldsSnapshot(): FieldInstance[] {
  return JSON.parse(JSON.stringify(placedFields.value)) as FieldInstance[];
}

function pushPlacedFieldsUndoSnapshot(): void {
  placedFieldsUndoStack.value.push(clonePlacedFieldsSnapshot());
  if (placedFieldsUndoStack.value.length > MAX_FIELDS_UNDO) {
    placedFieldsUndoStack.value.shift();
  }
}

function undoPlacedFieldsChange(): void {
  const prev = placedFieldsUndoStack.value.pop();
  if (!prev) {
    return;
  }
  placedFields.value = prev;
  selectedFieldInstanceIds.value = selectedFieldInstanceIds.value.filter(id =>
    placedFields.value.some(f => f.instanceId === id),
  );
  schedulePreviewRefresh();
  hasChanges.value = true;
}

function onFieldDragStart(): void {
  pushPlacedFieldsUndoSnapshot();
}
const availableFields = ref<Field[]>([]);
const isLoadingFields = ref<boolean>(false);
const isSavingFieldDefaults = ref<boolean>(false);
const searchQuery = ref<string>('');
const previewImageUrl = ref<string | null>(null);
const previewPdfFile = ref<File | null>(null);
const previewFieldValues = ref<Record<string, string>>({});
const previewSyncedFieldValues = ref<Record<string, string>>({});
const isRefreshingPreview = ref<boolean>(false);
const isPreviewOutputEnabled = ref<boolean>(true);

// Modals
const isCreateFieldModalOpen = ref<boolean>(false);
const isEditFieldModalOpen = ref<boolean>(false);
const editingField = ref<Field | null>(null);

// Refs
const templatePdfRef = ref<PdfRef | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref<boolean>(false);

// Zoom
const scale = ref<number>(1);
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const zoomPresetOptions = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
] as const;
const zoomCustomPercentInput = ref('100');

watch(scale, (s) => {
  zoomCustomPercentInput.value = String(Math.round(s * 100));
}, { immediate: true });

function setCanvasZoomScale(next: number) {
  scale.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100));
}

function applyZoomCustomPercentFromInput() {
  const raw = String(zoomCustomPercentInput.value || '').replace('%', '').replace(',', '.').trim();
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) {
    zoomCustomPercentInput.value = String(Math.round(scale.value * 100));
    return;
  }
  const pct = Math.min(200, Math.max(50, Math.round(n)));
  scale.value = pct / 100;
  zoomCustomPercentInput.value = String(pct);
}

// Additional state (mirrored from create page)
const imageLoaded = ref<boolean>(false);
const selectedContractId = ref<string | number | null>(null);
const templateDescription = ref<string>('');

// === WIZARD STATE ===
const currentWizardStep = ref<WizardStep>(1);
const signingSteps = ref<SigningStep[]>([]);

let previewRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let previewRequestToken = 0;
let previewRequestAbortController: AbortController | null = null;
let lastPreviewRequestSignature = '';

function abortPreviewRequest(): void {
  if (previewRequestAbortController) {
    previewRequestAbortController.abort();
    previewRequestAbortController = null;
  }
}

function buildPreviewRequestSignature(fieldValueSnapshot: Record<string, string>): string {
  const file = uploadedFile.value;
  const fileKey = file ? `${file.name}:${file.size}:${file.lastModified}` : 'no-file';
  const fieldsKey = placedFields.value
    .map((field) => {
      const key = getPreviewFieldKey(field);
      return [
        key,
        String(field.pageNumber ?? ''),
        String(field.normalizedX ?? ''),
        String(field.normalizedY ?? ''),
        String(field.normalizedWidth ?? ''),
        String(field.normalizedHeight ?? ''),
        String(field.x ?? ''),
        String(field.y ?? ''),
        String(field.width ?? ''),
        String(field.height ?? ''),
        normalizeFieldValue(fieldValueSnapshot[key] || ''),
      ].join('|');
    })
    .join(';');

  return `${fileKey}::${fieldsKey}`;
}

const wizardSteps = computed(() => [
  { step: 1 as WizardStep, label: tr('wizard.placeFields'), icon: 'i-heroicons-document-text' },
  { step: 2 as WizardStep, label: tr('wizard.signingFlow'), icon: 'i-heroicons-queue-list' },
  { step: 3 as WizardStep, label: tr('wizard.reviewAndSave'), icon: 'i-heroicons-clipboard-document-check' },
]);

const canProceedToStep2 = computed<boolean>(() => {
  const name = templateName.value.trim();
  return !!(name && name.length >= 3 && name.length <= 100 && uploadedFile.value && placedFields.value.length > 0);
});

const canProceedToStep3 = computed<boolean>(() => {
  if (signingSteps.value.length === 0)
    return false;
  const assignableFields = placedFields.value.filter(f => !isAutoGeneratedField(f));
  const allAssigned = assignableFields.every(f => f.signerStepId);
  return allAssigned;
});

// ─── Computed ─────────────────────────────────────────────────────────────────

const filteredFields = computed<Field[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const source = !query
    ? availableFields.value
    : availableFields.value.filter(f => f.name.toLowerCase().includes(query));

  return [...source].sort((a, b) => {
    const aNumericId = Number(a.id);
    const bNumericId = Number(b.id);

    if (Number.isFinite(aNumericId) && Number.isFinite(bNumericId)) {
      return aNumericId - bNumericId;
    }

    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
});

/** Provides display coordinates from normalized coordinates when available. */
const selectedField = computed<FieldInstance | null>(() => {
  if (selectedFieldInstanceIds.value.length !== 1) {
    return null;
  }

  const field = placedFields.value.find(f => f.instanceId === selectedFieldInstanceIds.value[0]);
  if (!field) {
    return null;
  }

  if (templatePdfRef.value && field.normalizedX !== undefined && field.normalizedY !== undefined) {
    if (typeof templatePdfRef.value.normalizedToDisplay === 'function') {
      const display = templatePdfRef.value.normalizedToDisplay(
        field.normalizedX,
        field.normalizedY,
        field.normalizedWidth || 0,
        field.normalizedHeight || 0,
      );
      return {
        ...field,
        displayX: display.x,
        displayY: display.y,
        displayWidth: display.width,
        displayHeight: display.height,
      } as FieldInstance;
    }
  }
  return { ...field, displayX: field.x, displayY: field.y, displayWidth: field.width, displayHeight: field.height } as FieldInstance;
});

function getPreviewFieldKey(field?: { instanceId?: string; id?: string | number } | null): string {
  if (!field) {
    return '';
  }
  if (field.instanceId) {
    return String(field.instanceId);
  }
  if (field.id !== undefined && field.id !== null) {
    return String(field.id);
  }
  return '';
}

function normalizeFieldValue(value: unknown): string {
  return String(value ?? '').trim();
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = String(value ?? '').trim() as T;
  if (allowed.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeAutoGenerateFlag(field: any): boolean {
  return Boolean(field?.isAutoGenerated ?? field?.isAutoGenerate ?? field?.is_auto_generated ?? false);
}

function normalizeFieldAutoGenerateShape<T extends Record<string, any>>(field: T): T {
  const normalized = normalizeAutoGenerateFlag(field);
  return {
    ...field,
    isAutoGenerated: normalized,
    isAutoGenerate: normalized,
    is_auto_generated: normalized,
  };
}

function toAutoDateTimeFormatPayload(field: any) {
  // Merge stored config (from DB dateFormatConfig) with direct field properties;
  // direct properties (set by toolbar) take precedence over stored config
  const merged = { ...(field?.dateFormatConfig ?? {}), ...field };
  const config = getAutoDateTimeFormatConfig(merged);
  return {
    dateSeparator: config.dateSeparator,
    dateSeparatorSpacing: config.dateSeparatorSpacing,
    dateShowDay: config.dateShowDay,
    dateShowMonth: config.dateShowMonth,
    dateShowYear: config.dateShowYear,
    dateShowDayOfWeek: config.dateShowDayOfWeek,
    dateDayOfWeekStyle: config.dateDayOfWeekStyle,
    dateDayOfWeekGap: config.dateDayOfWeekGap,
    dateMonthStyle: config.dateMonthStyle,
    dateCalendar: config.dateCalendar,
    timeSeparator: config.timeSeparator,
    timeSeparatorSpacing: config.timeSeparatorSpacing,
    timeShowHour: config.timeShowHour,
    timeShowMinute: config.timeShowMinute,
  };
}

function getFieldType(field?: any): string {
  return String(field?.type || field?.fieldType || '').toLowerCase();
}

function normalizeCheckboxPreviewValue(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked', 'on'].includes(normalized) ? 'true' : '';
}

function isCheckboxField(field?: any): boolean {
  if (!field) {
    return false;
  }

  const fieldType = getFieldType(field);
  const fieldName = String(field.name || '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

function sanitizeFieldVisibilityRule(rawRule: any): FieldVisibilityRule | null {
  if (!rawRule || typeof rawRule !== 'object') {
    return null;
  }

  const sourceFieldInstanceId = String(rawRule.sourceFieldInstanceId ?? rawRule.source_field_instance_id ?? '').trim();
  const sourceGroupId = String(rawRule.sourceGroupId ?? rawRule.source_group_id ?? '').trim();
  if (!sourceFieldInstanceId.length && !sourceGroupId.length) {
    return null;
  }

  return {
    enabled: rawRule.enabled !== false,
    sourceFieldInstanceId: sourceFieldInstanceId || null,
    sourceGroupId: sourceGroupId || null,
    operator: rawRule.operator === 'isUnchecked' ? 'isUnchecked' : 'isChecked',
    clearWhenHidden: false,
  };
}

function getFieldVisibilityRule(field?: any): FieldVisibilityRule | null {
  if (!field) {
    return null;
  }

  return sanitizeFieldVisibilityRule((field as any).visibilityRule ?? (field as any).visibility_rule);
}

function hasFieldVisibilityRule(field?: any): boolean {
  return Boolean(getFieldVisibilityRule(field));
}

function isAutoGeneratedField(field?: any): boolean {
  if (!field) {
    return false;
  }

  return normalizeAutoGenerateFlag(field);
}

function getFieldMaxLength(field?: { maxLength?: unknown; max_length?: unknown } | null): number | null {
  if (!field) {
    return null;
  }
  return parsePositiveInteger((field as any).maxLength ?? (field as any).max_length);
}

function applyFieldMaxLength(value: string, field?: { maxLength?: unknown; max_length?: unknown } | null): string {
  const maxLength = getFieldMaxLength(field);
  if (!maxLength) {
    return value;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function isAutoGeneratedDateOrTimeField(field?: any): boolean {
  if (!field) {
    return false;
  }

  const fieldType = getFieldType(field);
  return isAutoGeneratedField(field) && (fieldType === 'date' || fieldType === 'time');
}

function clearPreviewRefreshTimer() {
  if (previewRefreshTimer) {
    clearTimeout(previewRefreshTimer);
    previewRefreshTimer = null;
  }
}

function togglePreviewOutput(): void {
  isPreviewOutputEnabled.value = !isPreviewOutputEnabled.value;

  if (!isPreviewOutputEnabled.value) {
    clearPreviewRefreshTimer();
    abortPreviewRequest();
    previewPdfFile.value = null;
    previewSyncedFieldValues.value = {};
    lastPreviewRequestSignature = '';
    return;
  }

  schedulePreviewRefresh();
}

const canTypePreviewValue = computed<boolean>(() => {
  if (!selectedField.value || fileType.value !== 'pdf') {
    return false;
  }

  const fieldType = String(selectedField.value.type || selectedField.value.fieldType || '').toLowerCase();
  if (fieldType === 'signature' || fieldType === 'icon' || isCheckboxField(selectedField.value)) {
    return false;
  }

  return !isAutoGeneratedDateOrTimeField(selectedField.value);
});

const canTogglePreviewCheckbox = computed<boolean>(() => {
  if (!selectedField.value || fileType.value !== 'pdf') {
    return false;
  }

  const fieldType = String(selectedField.value.type || selectedField.value.fieldType || '').toLowerCase();
  if (fieldType === 'signature' || fieldType === 'icon') {
    return false;
  }

  return isCheckboxField(selectedField.value);
});

const hasAutoGeneratedPreviewFields = computed<boolean>(() => {
  return placedFields.value.some(field => isAutoGeneratedDateOrTimeField(field));
});

const hasPreviewInputs = computed<boolean>(() => {
  return hasAutoGeneratedPreviewFields.value || Object.values(previewFieldValues.value).some(value => normalizeFieldValue(value).length > 0);
});

function fieldHasPreviewContent(field?: any): boolean {
  if (!field) {
    return false;
  }

  const key = getPreviewFieldKey(field);
  const previewValue = key ? normalizeFieldValue(previewFieldValues.value[key] || '') : '';
  if (previewValue.length > 0) {
    return true;
  }

  return isAutoGeneratedDateOrTimeField(field);
}

const isPreviewFillModeActive = computed<boolean>(() => {
  return isPreviewOutputEnabled.value && hasPreviewInputs.value;
});

const previewDisplayFile = computed<File | null>(() => {
  if (fileType.value !== 'pdf') {
    return uploadedFile.value;
  }
  return previewPdfFile.value || uploadedFile.value;
});

const selectedFieldPreviewValue = computed<string>({
  get: () => {
    const key = getPreviewFieldKey(selectedField.value);
    return key ? (previewFieldValues.value[key] || '') : '';
  },
  set: (value) => {
    const key = getPreviewFieldKey(selectedField.value);
    if (!key) {
      return;
    }

    const limitedValue = applyFieldMaxLength(String(value ?? ''), selectedField.value);

    if (limitedValue) {
      previewFieldValues.value[key] = limitedValue;
    }
    else {
      delete previewFieldValues.value[key];
      delete previewSyncedFieldValues.value[key];
    }
  },
});

const selectedFieldMaxLength = computed<number | null>(() => getFieldMaxLength(selectedField.value));

const selectedFieldPreviewCharacterCount = computed<number>(() => {
  return selectedFieldPreviewValue.value.length;
});

const selectedFieldPreviewChecked = computed<boolean>({
  get: () => {
    const key = getPreviewFieldKey(selectedField.value);
    if (!key) {
      return false;
    }

    return normalizeCheckboxPreviewValue(previewFieldValues.value[key]) === 'true';
  },
  set: (checked) => {
    const key = getPreviewFieldKey(selectedField.value);
    if (!key) {
      return;
    }

    if (checked) {
      previewFieldValues.value[key] = 'true';
    }
    else {
      delete previewFieldValues.value[key];
      delete previewSyncedFieldValues.value[key];
    }
  },
});

function handlePreviewInput(event: Event) {
  const input = event.target as HTMLInputElement;

  function normalizeNumericPreviewInput(val: string) {
    let v = String(val ?? '');
    // Allow digits, one decimal point and optional leading minus
    v = v.replace(/[^0-9.\-]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    const hasMinus = v.includes('-');
    v = v.replace(/-/g, '');
    if (hasMinus)
      v = `-${v}`;
    return v;
  }

  let filteredValue: string;
  if (selectedField.value && getFieldType(selectedField.value) === 'number') {
    filteredValue = normalizeNumericPreviewInput(input.value);
  }
  else {
    // Allow only letters, combining marks (Thai vowels/tones), numbers and whitespace.
    filteredValue = input.value.replace(/[^\p{L}\p{M}\d\s]/gu, '');
  }

  const limitedValue = applyFieldMaxLength(filteredValue, selectedField.value);
  if (input.value !== limitedValue) {
    input.value = limitedValue;
  }
  selectedFieldPreviewValue.value = limitedValue;
}

function handlePreviewCheckboxChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFieldPreviewChecked.value = Boolean(input?.checked);
}

const previewOverlayFieldValues = computed<Record<string, string>>(() => {
  const values: Record<string, string> = {};

  for (const field of placedFields.value) {
    const key = getPreviewFieldKey(field);
    if (!key) {
      continue;
    }

    const currentValue = previewFieldValues.value[key] || '';
    const normalizedCurrent = normalizeFieldValue(currentValue);
    if (!normalizedCurrent.length) {
      continue;
    }

    const normalizedSynced = normalizeFieldValue(previewSyncedFieldValues.value[key]);
    values[key] = normalizedCurrent === normalizedSynced ? '' : currentValue;
  }

  return values;
});

const activePreviewOverlayFieldValues = computed<Record<string, string>>(() => {
  if (!isPreviewOutputEnabled.value) {
    return {};
  }

  return previewOverlayFieldValues.value;
});

// ─── Wizard Navigation ────────────────────────────────────────────────────────

function goToStep(step: WizardStep): void {
  if (step === 2 && !canProceedToStep2.value) {
    if (!templateName.value.trim() || templateName.value.trim().length < 3) {
      toast.add({ title: tr('wizard.placeFields'), description: tr('toasts.stepValidation.templateNameMin3'), color: 'error' });
    }
    else if (!uploadedFile.value) {
      toast.add({ title: tr('toasts.stepValidation.uploadFile'), color: 'error' });
    }
    else if (placedFields.value.length === 0) {
      toast.add({ title: tr('toasts.stepValidation.addAtLeastOneField'), color: 'error' });
    }
    return;
  }
  if (step === 3 && !canProceedToStep3.value) {
    if (signingSteps.value.length === 0) {
      toast.add({ title: tr('toasts.stepValidation.signingStepRequired'), color: 'error' });
    }
    else {
      toast.add({ title: tr('toasts.stepValidation.allFieldsMustBeAssigned'), color: 'error' });
    }
    return;
  }
  currentWizardStep.value = step;
}

function goNext(): void {
  if (currentWizardStep.value < 3) {
    goToStep((currentWizardStep.value + 1) as WizardStep);
  }
}

function goPrevious(): void {
  if (currentWizardStep.value > 1) {
    currentWizardStep.value = (currentWizardStep.value - 1) as WizardStep;
  }
}

// ─── Signing Flow Handlers ────────────────────────────────────────────────────

function handleSigningStepsUpdate(steps: SigningStep[]): void {
  signingSteps.value = steps;
}

function handlePlacedFieldsUpdate(fields: FieldInstance[]): void {
  placedFields.value = fields;
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

async function fetchTemplate(): Promise<void> {
  isLoading.value = true;
  try {
    const result = await $fetch<ApiResponse<any>>(`/api/pdf-templates/${templateId.value}`);
    if (!result.success || !result.data)
      throw new Error(tr('errors.fetchTemplateFailed'));

    templateData.value = result.data;
    templateName.value = result.data.name || '';
    templateDescription.value = result.data.description || '';

    if (result.data.documentUrl) {
      const documentUrl = String(result.data.documentUrl || '');
      const fileNameFromUrl = documentUrl.split('/').pop()?.split('?')[0] || `template_${templateId.value}`;
      const file = await urlToFile(documentUrl, fileNameFromUrl);
      uploadedFile.value = file;
      previewPdfFile.value = null;
      previewFieldValues.value = {};
      previewSyncedFieldValues.value = {};

      const extension = (file.name.split('.').pop() || '').toLowerCase();
      const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);

      if (previewImageUrl.value) {
        URL.revokeObjectURL(previewImageUrl.value);
        previewImageUrl.value = null;
      }

      if (isImage) {
        fileType.value = 'image';
        previewImageUrl.value = URL.createObjectURL(file);
      }
      else {
        fileType.value = 'pdf';
      }
    }

    if (Array.isArray(result.data.placedFieldsData)) {
      placedFields.value = (result.data.placedFieldsData as FieldInstance[]).map(field => normalizeFieldAutoGenerateShape(field));
    }

    if (Array.isArray(result.data.signingFlowData)) {
      signingSteps.value = result.data.signingFlowData as SigningStep[];
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.add({ title: tr('toasts.common.errorTitle'), description: tr('toasts.load.templateFailed', { message }), color: 'error' });
  }
  finally {
    isLoading.value = false;
  }
}

async function fetchTemplateFields(): Promise<void> {
  isLoadingFields.value = true;
  try {
    const response = await $fetch<{ success: boolean; data?: Field[]; error?: string }>('/api/template-fields');
    if (response.success && response.data) {
      availableFields.value = response.data.map(field => normalizeFieldAutoGenerateShape(field));
    }
    else {
      toast.add({ title: tr('toasts.fields.notFoundTitle'), description: response.error || tr('toasts.fields.notFoundDescription'), color: 'warning' });
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.add({ title: tr('toasts.fields.loadErrorTitle'), description: message, color: 'error' });
  }
  finally {
    isLoadingFields.value = false;
  }
}

// Security: Verify PDF magic bytes
async function verifyPdfMagicBytes(file: File): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>): void => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer);
      const header = String.fromCharCode(...Array.from(arr.slice(0, 5)));
      resolve(header === '%PDF-');
    };
    reader.onerror = (): void => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 5));
  });
}

async function refreshPreviewPdf(): Promise<void> {
  if (!isPreviewOutputEnabled.value || !uploadedFile.value || fileType.value !== 'pdf' || !hasPreviewInputs.value) {
    abortPreviewRequest();
    previewPdfFile.value = null;
    previewSyncedFieldValues.value = {};
    isRefreshingPreview.value = false;
    lastPreviewRequestSignature = '';
    return;
  }

  const requestToken = ++previewRequestToken;
  const fieldValueSnapshot = Object.fromEntries(
    placedFields.value.map(field => [getPreviewFieldKey(field), previewFieldValues.value[getPreviewFieldKey(field)] || '']),
  );
  const requestSignature = buildPreviewRequestSignature(fieldValueSnapshot);
  if (requestSignature === lastPreviewRequestSignature && previewPdfFile.value) {
    return;
  }

  abortPreviewRequest();
  const abortController = new AbortController();
  previewRequestAbortController = abortController;

  const formData = new FormData();
  formData.append('pdfFile', uploadedFile.value, uploadedFile.value.name);
  formData.append('fields', JSON.stringify(
    placedFields.value.map((field: FieldInstance) => ({
      ...field,
      sampleValue: fieldValueSnapshot[getPreviewFieldKey(field)] || '',
      useFallbackLabel: false,
      showFieldHighlight: false,
    })),
  ));

  isRefreshingPreview.value = true;

  try {
    const response = await fetch('/api/preview-template-pdf', {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Preview request failed with status ${response.status}`);
    }

    const previewBytes = await response.arrayBuffer();

    if (requestToken !== previewRequestToken) {
      return;
    }

    previewPdfFile.value = new File([
      previewBytes,
    ], `template-preview-${Date.now()}.pdf`, { type: 'application/pdf' });
    previewSyncedFieldValues.value = fieldValueSnapshot;
    lastPreviewRequestSignature = requestSignature;
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    console.error('Failed to refresh template preview PDF:', error);
  }
  finally {
    if (previewRequestAbortController === abortController) {
      previewRequestAbortController = null;
    }
    if (requestToken === previewRequestToken) {
      isRefreshingPreview.value = false;
    }
  }
}

function schedulePreviewRefresh() {
  clearPreviewRefreshTimer();

  if (!isPreviewOutputEnabled.value || !uploadedFile.value || fileType.value !== 'pdf' || !hasPreviewInputs.value) {
    abortPreviewRequest();
    previewPdfFile.value = null;
    previewSyncedFieldValues.value = {};
    isRefreshingPreview.value = false;
    lastPreviewRequestSignature = '';
    return;
  }

  previewRefreshTimer = setTimeout(() => {
    void refreshPreviewPdf();
  }, 100);
}

// ─── File Upload (replace PDF) ────────────────────────────────────────────────

function triggerFileInput(): void {
  fileInput.value?.click();
}

function handleFileDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file)
    processFile(file);
}

async function handleFileInput(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file)
    processFile(file);
}

async function processFile(file: File): Promise<void> {
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.add({ title: tr('toasts.file.tooLargeTitle'), description: tr('toasts.file.tooLargeDescription'), color: 'error' });
    return;
  }

  if (file.size === 0) {
    toast.add({ title: tr('toasts.file.corruptedTitle'), color: 'error' });
    return;
  }

  const fileName = file.name.toLowerCase();
  const fileTypeFromMime = file.type.toLowerCase();
  const fileExtension = (fileName.split('.').pop() || '').toLowerCase();
  const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const validExtensions = [...validImageExtensions, 'pdf'];

  if (!validExtensions.includes(fileExtension)) {
    toast.add({ title: tr('toasts.file.unsupportedTypeTitle'), description: tr('toasts.file.unsupportedTypeDescription'), color: 'error' });
    return;
  }

  if (fileTypeFromMime === 'application/pdf' || fileExtension === 'pdf') {
    const isValidPdf = await verifyPdfMagicBytes(file);
    if (!isValidPdf) {
      toast.add({ title: tr('toasts.file.invalidPdfTitle'), description: tr('toasts.file.invalidPdfDescription'), color: 'error' });
      return;
    }
  }

  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
    previewImageUrl.value = null;
  }

  clearPreviewRefreshTimer();
  abortPreviewRequest();

  previewPdfFile.value = null;
  previewFieldValues.value = {};
  previewSyncedFieldValues.value = {};
  lastPreviewRequestSignature = '';

  uploadedFile.value = file;
  fileWasReplaced.value = true;
  placedFields.value = [];
  selectedFieldInstanceIds.value = [];
  currentPdfPage.value = 1;

  if (fileTypeFromMime.startsWith('image/') || validImageExtensions.includes(fileExtension)) {
    fileType.value = 'image';
    previewImageUrl.value = URL.createObjectURL(file);
  }
  else if (fileTypeFromMime === 'application/pdf' || fileExtension === 'pdf') {
    fileType.value = 'pdf';
  }
}

// ─── Field Management ─────────────────────────────────────────────────────────

function addFieldToPreview(fieldToAdd: Field): void {
  if (!fieldToAdd)
    return;
  if (!uploadedFile.value) {
    toast.add({ title: tr('toasts.file.uploadFirstTitle'), color: 'error' });
    return;
  }

  const amount = fieldToAdd.amount || 1;
  const groupId = amount > 1 ? `group_${fieldToAdd.id}_${Date.now()}` : null;
  const defaultWidth = parsePositiveInteger((fieldToAdd as any).default_width ?? (fieldToAdd as any).width) ?? 150;
  const defaultHeight = parsePositiveInteger((fieldToAdd as any).default_height ?? (fieldToAdd as any).height) ?? 40;
  const defaultFontSize = parsePositiveInteger((fieldToAdd as any).fontSize) ?? 14;
  const defaultFontFamily = String((fieldToAdd as any).font ?? (fieldToAdd as any).fontFamily ?? 'Arial');
  const defaultFontWeight = normalizeEnum((fieldToAdd as any).fontWeight, ['normal', 'bold'], 'normal');
  const defaultFontStyle = normalizeEnum((fieldToAdd as any).fontStyle, ['normal', 'italic'], 'normal');
  const defaultTextDecoration = normalizeEnum((fieldToAdd as any).textDecoration, ['none', 'underline'], 'none');
  const defaultTextAlign = normalizeEnum((fieldToAdd as any).textAlign, ['left', 'center', 'right'], 'left');
  const defaultLetterSpacing = ['date', 'time'].includes(getFieldType(fieldToAdd))
    ? 0
    : parseFiniteNumber((fieldToAdd as any).letterSpacing, 0);
  const defaultLineHeight = parseFiniteNumber((fieldToAdd as any).lineHeight, 1.5);
  const isCheckboxGroup = getFieldType(fieldToAdd) === 'checkbox' && amount > 1;
  const defaultStrikeThroughGroupMode = isCheckboxGroup
    ? Boolean((fieldToAdd as any).strikeThroughGroupMode ?? (fieldToAdd as any).strike_through_group_mode ?? false)
    : false;
  const defaultStrikeLineThickness = parseFiniteNumber((fieldToAdd as any).strikeLineThickness ?? (fieldToAdd as any).strike_line_thickness, 1.5);
  const defaultMaxLength = parsePositiveInteger((fieldToAdd as any).maxLength ?? (fieldToAdd as any).max_length);
  const defaultAutoDateTimeFormat = toAutoDateTimeFormatPayload(fieldToAdd);
  const nextInstanceNumber = getNextFieldInstanceNumber(placedFields.value, fieldToAdd);
  let selectedSourceField: FieldInstance | null = null;
  if (
    selectedField.value
    && isCheckboxField(selectedField.value)
    && String(selectedField.value.instanceId || '').trim().length > 0
  ) {
    selectedSourceField = selectedField.value;
  }

  let autoVisibilityRule: FieldVisibilityRule | null = null;
  if (selectedSourceField && !isCheckboxField(fieldToAdd)) {
    autoVisibilityRule = sanitizeFieldVisibilityRule({
      enabled: true,
      sourceFieldInstanceId: selectedSourceField.instanceId,
      operator: 'isChecked',
      clearWhenHidden: false,
    });
  }
  let shouldRefreshPreview = false;

  for (let i = 0; i < amount; i++) {
    const instance: FieldInstance = {
      ...fieldToAdd,
      instanceId: `field_${fieldToAdd.id}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      instanceNumber: nextInstanceNumber + i,
      groupId,
      isGrouped: amount > 1,
      groupSize: amount,
      groupPosition: i,
      x: 50 + i * 40,
      y: 50 + i * 40,
      width: defaultWidth,
      height: defaultHeight,
      label: fieldToAdd.name === 'Check Mark' ? '' : fieldToAdd.label,
      pageNumber: currentPdfPage.value,
      fontSize: defaultFontSize,
      fontFamily: defaultFontFamily,
      fontWeight: defaultFontWeight,
      fontStyle: defaultFontStyle,
      textDecoration: defaultTextDecoration,
      textAlign: defaultTextAlign,
      letterSpacing: defaultLetterSpacing,
      lineHeight: defaultLineHeight,
      strikeThroughGroupMode: defaultStrikeThroughGroupMode,
      strikeLineThickness: Math.min(8, Math.max(0.5, defaultStrikeLineThickness || 1.5)),
      isAutoGenerate: Boolean((fieldToAdd as any).isAutoGenerated ?? (fieldToAdd as any).isAutoGenerate ?? (fieldToAdd as any).is_auto_generated),
      isAutoGenerated: Boolean((fieldToAdd as any).isAutoGenerated ?? (fieldToAdd as any).isAutoGenerate ?? (fieldToAdd as any).is_auto_generated),
      maxLength: defaultMaxLength,
      visibilityRule: autoVisibilityRule,
      ...defaultAutoDateTimeFormat,
      formRequired: getFieldType(fieldToAdd) !== 'signature'
        && !((fieldToAdd as any).isAutoGenerated ?? (fieldToAdd as any).isAutoGenerate ?? (fieldToAdd as any).is_auto_generated),
    };
    placedFields.value.push(instance);
    if (fieldHasPreviewContent(instance)) {
      shouldRefreshPreview = true;
    }
    if (i === amount - 1) {
      selectedFieldInstanceIds.value = [instance.instanceId];
    }
  }

  if (shouldRefreshPreview) {
    schedulePreviewRefresh();
  }
}

function selectField(field: FieldInstance | null, opts?: { shiftKey?: boolean }): void {
  if (!field) {
    selectedFieldInstanceIds.value = [];
    return;
  }
  const id = field.instanceId;
  if (opts?.shiftKey) {
    const idx = selectedFieldInstanceIds.value.indexOf(id);
    if (idx >= 0) {
      selectedFieldInstanceIds.value = selectedFieldInstanceIds.value.filter(x => x !== id);
    }
    else {
      selectedFieldInstanceIds.value = [...selectedFieldInstanceIds.value, id];
    }
    return;
  }
  selectedFieldInstanceIds.value = [id];
}

function onImageLoad(): void {
  imageLoaded.value = true;
}

function removeSelectedField(): void {
  const ids = selectedFieldInstanceIds.value;
  if (ids.length === 0) {
    return;
  }
  pushPlacedFieldsUndoSnapshot();
  const idSet = new Set(ids);
  const toRemove = placedFields.value.filter(f => idSet.has(f.instanceId));
  if (toRemove.length === 0) {
    return;
  }
  let shouldRefreshPreview = false;
  for (const removedField of toRemove) {
    if (fieldHasPreviewContent(removedField)) {
      shouldRefreshPreview = true;
    }
    const key = getPreviewFieldKey(removedField);
    if (key) {
      delete previewFieldValues.value[key];
      delete previewSyncedFieldValues.value[key];
    }
  }

  placedFields.value = placedFields.value.filter(f => !idSet.has(f.instanceId));
  selectedFieldInstanceIds.value = [];
  hasChanges.value = true;
  if (shouldRefreshPreview) {
    schedulePreviewRefresh();
  }
}

function handleFieldUpdate(data: { instanceId: string; updates: any }): void {
  const hasAnyStrikeUpdate = (updates: any) => {
    const keys = ['strikeThroughGroupMode', 'strike_through_group_mode', 'strikeLineThickness', 'strike_line_thickness'];
    return keys.some(key => Object.prototype.hasOwnProperty.call(updates || {}, key));
  };

  const syncStrikeConfigToGroup = (sourceField: any) => {
    const groupId = String(sourceField?.groupId || '').trim();
    if (!isCheckboxField(sourceField) || !groupId) {
      return;
    }

    const nextMode = Boolean(sourceField.strikeThroughGroupMode ?? sourceField.strike_through_group_mode ?? false);
    const nextThickness = Math.min(8, Math.max(0.5, parseFiniteNumber(sourceField.strikeLineThickness ?? sourceField.strike_line_thickness, 1.5)));

    placedFields.value.forEach((field) => {
      if (!isCheckboxField(field) || String((field as any).groupId || '').trim() !== groupId) {
        return;
      }
      (field as any).strikeThroughGroupMode = nextMode;
      (field as any).strike_through_group_mode = nextMode;
      (field as any).strikeLineThickness = nextThickness;
      (field as any).strike_line_thickness = nextThickness;
    });
  };

  const idx = placedFields.value.findIndex(
    field => field.instanceId === data.instanceId,
  );
  if (idx > -1 && placedFields.value[idx]) {
    Object.assign(placedFields.value[idx]!, data.updates);

    if (Object.prototype.hasOwnProperty.call(data.updates || {}, 'visibilityRule')) {
      placedFields.value[idx]!.visibilityRule = sanitizeFieldVisibilityRule(data.updates.visibilityRule);
    }

    const updatedField = placedFields.value[idx]!;
    if (hasAnyStrikeUpdate(data.updates)) {
      syncStrikeConfigToGroup(updatedField);
    }

    const updateKeys = Object.keys(data.updates || {});
    const hasLayoutUpdate = updateKeys.some(key => [
      'x',
      'y',
      'width',
      'height',
      'normalizedX',
      'normalizedY',
      'normalizedWidth',
      'normalizedHeight',
      'pageNumber',
      'strikeThroughGroupMode',
      'strike_through_group_mode',
      'strikeLineThickness',
      'strike_line_thickness',
    ].includes(key));

    if (fieldHasPreviewContent(placedFields.value[idx]) || hasLayoutUpdate) {
      schedulePreviewRefresh();
    }
  }
}

function handleFieldRemoval(instanceId: string): void {
  const idx = placedFields.value.findIndex(f => f.instanceId === instanceId);
  if (idx > -1) {
    const removedField = placedFields.value[idx];
    const shouldRefreshPreview = fieldHasPreviewContent(removedField);
    const key = getPreviewFieldKey(removedField);
    if (key) {
      delete previewFieldValues.value[key];
      delete previewSyncedFieldValues.value[key];
    }

    placedFields.value.splice(idx, 1);
    selectedFieldInstanceIds.value = selectedFieldInstanceIds.value.filter(x => x !== instanceId);

    if (shouldRefreshPreview) {
      schedulePreviewRefresh();
    }
  }
}

function handlePdfPageChange(pageNumber: number): void {
  currentPdfPage.value = pageNumber;
}

// ─── Sidebar: Available Fields CRUD ──────────────────────────────────────────

function openEditField(field: Field): void {
  editingField.value = field;
  isEditFieldModalOpen.value = true;
}

function handleFieldCreated(newField: Field): void {
  availableFields.value.push(normalizeFieldAutoGenerateShape(newField));
  toast.add({ title: tr('toasts.field.addedTitle'), description: tr('toasts.field.addedDescription', { name: newField.name }), color: 'success' });
}

function updateAvailableFieldCache(updatedField: Field): void {
  const idx = availableFields.value.findIndex(f => String(f.id) === String(updatedField.id));
  if (idx !== -1) {
    availableFields.value.splice(idx, 1, {
      ...(availableFields.value[idx] || {}),
      ...normalizeFieldAutoGenerateShape(updatedField),
    });
  }
}

function handleFieldUpdated(updatedField: Field): void {
  updateAvailableFieldCache(updatedField);
  toast.add({ title: tr('toasts.field.updatedTitle'), description: tr('toasts.field.updatedDescription', { name: updatedField.name }), color: 'success' });
}

async function handleSaveFieldDefaultsFromToolbar(payload: { fieldId: number | string; defaults: any }): Promise<void> {
  const fieldDefinition = availableFields.value.find(f => String(f.id) === String(payload.fieldId));
  const selectedFieldData = selectedField.value;

  if (!fieldDefinition) {
    toast.add({ title: tr('toasts.field.notFoundTitle'), description: tr('toasts.field.saveDefaultsFailedDescription'), color: 'error' });
    return;
  }

  const type = String(fieldDefinition.type || fieldDefinition.fieldType || selectedFieldData?.type || 'Text');
  const typeLower = type.toLowerCase();
  const width = parsePositiveInteger(payload.defaults?.width ?? (fieldDefinition as any).default_width ?? (fieldDefinition as any).width) ?? 150;
  const height = parsePositiveInteger(payload.defaults?.height ?? (fieldDefinition as any).default_height ?? (fieldDefinition as any).height) ?? 40;
  const fontSize = parsePositiveInteger(payload.defaults?.fontSize ?? fieldDefinition.fontSize) ?? 14;
  const maxLength = !['signature', 'icon', 'date', 'time'].includes(typeLower)
    ? parsePositiveInteger(payload.defaults?.maxLength ?? (fieldDefinition as any).maxLength ?? (fieldDefinition as any).max_length)
    : null;

  const requestBody = {
    name: fieldDefinition.name || selectedFieldData?.name,
    label: fieldDefinition.label || selectedFieldData?.label,
    type,
    icon: fieldDefinition.icon || selectedFieldData?.icon || 'i-heroicons-document',
    amount: parsePositiveInteger((fieldDefinition as any).amount) ?? 1,
    width,
    height,
    font: String(payload.defaults?.font ?? payload.defaults?.fontFamily ?? fieldDefinition.font ?? selectedFieldData?.fontFamily ?? 'Sarabun'),
    fontSize,
    fontWeight: normalizeEnum(payload.defaults?.fontWeight ?? (fieldDefinition as any).fontWeight, ['normal', 'bold'], 'normal'),
    fontStyle: normalizeEnum(payload.defaults?.fontStyle ?? (fieldDefinition as any).fontStyle, ['normal', 'italic'], 'normal'),
    textDecoration: normalizeEnum(payload.defaults?.textDecoration ?? (fieldDefinition as any).textDecoration, ['none', 'underline'], 'none'),
    textAlign: normalizeEnum(payload.defaults?.textAlign ?? (fieldDefinition as any).textAlign, ['left', 'center', 'right'], 'left'),
    letterSpacing: ['date', 'time'].includes(typeLower)
      ? 0
      : parseFiniteNumber(payload.defaults?.letterSpacing ?? (fieldDefinition as any).letterSpacing, 0),
    lineHeight: parseFiniteNumber(payload.defaults?.lineHeight ?? (fieldDefinition as any).lineHeight, 1.5),
    sessionField: (() => {
      const rawSessionField = String(payload.defaults?.sessionField ?? (fieldDefinition as any).sessionField ?? (fieldDefinition as any).session_field ?? '').trim();
      return ['studentName', 'studentId', 'studentYearCurrent', 'facultyNameTh', 'departmentNameTh', 'departmentCode', 'titleThAutoChecked', 'titleThMrChecked', 'titleThMissChecked', 'titleThMrsChecked'].includes(rawSessionField) ? rawSessionField : null;
    })(),
    strikeThroughGroupMode: typeLower === 'checkbox' && (parsePositiveInteger((fieldDefinition as any).amount) ?? 1) > 1
      ? Boolean(payload.defaults?.strikeThroughGroupMode ?? (fieldDefinition as any).strikeThroughGroupMode ?? (fieldDefinition as any).strike_through_group_mode ?? false)
      : false,
    strikeLineThickness: Math.min(
      8,
      Math.max(
        0.5,
        parseFiniteNumber(payload.defaults?.strikeLineThickness ?? (fieldDefinition as any).strikeLineThickness ?? (fieldDefinition as any).strike_line_thickness, 1.5),
      ),
    ),
    maxLength,
    ...toAutoDateTimeFormatPayload(payload.defaults ?? fieldDefinition ?? selectedFieldData),
    isFillable: fieldDefinition.isFillable ?? true,
    isAutoGenerated: ['date', 'time'].includes(typeLower)
      ? Boolean(payload.defaults?.isAutoGenerated ?? fieldDefinition.isAutoGenerated ?? (fieldDefinition as any).is_auto_generated ?? false)
      : false,
  };

  if (!requestBody.name || !requestBody.label) {
    toast.add({ title: tr('toasts.field.incompleteDataTitle'), description: tr('toasts.field.saveDefaultsFailedDescription'), color: 'error' });
    return;
  }

  isSavingFieldDefaults.value = true;
  try {
    const response = await $fetch<{ success: boolean; data?: Field; error?: string }>(`/api/template-fields/${fieldDefinition.id}`, {
      method: 'PUT',
      body: requestBody,
    });

    if (response.success && response.data) {
      updateAvailableFieldCache(response.data);
      toast.add({ title: tr('toasts.field.defaultsSavedTitle'), description: tr('toasts.field.defaultsSavedDescription', { name: response.data.name }), color: 'success' });
    }
    else {
      toast.add({ title: tr('toasts.field.saveFailedTitle'), description: response.error || tr('toasts.field.saveDefaultsFailedDescription'), color: 'error' });
    }
  }
  catch (error) {
    console.error('Error saving field defaults from toolbar:', error);
    const message = error instanceof Error ? error.message : String(error);
    toast.add({ title: tr('toasts.field.saveFailedTitle'), description: message, color: 'error' });
  }
  finally {
    isSavingFieldDefaults.value = false;
  }
}

function handleFieldDeleted(fieldId: number | string): void {
  const idx = availableFields.value.findIndex(f => f.id === fieldId);
  if (idx !== -1)
    availableFields.value.splice(idx, 1);
  toast.add({ title: tr('toasts.field.deletedTitle'), color: 'success' });
}

// ─── Save ─────────────────────────────────────────────────────────────────────

function validateTemplateName(): boolean {
  const name = templateName.value.trim();
  if (!name) {
    templateNameError.value = tr('validation.nameRequired');
    return false;
  }
  if (name.length < 3) {
    templateNameError.value = tr('validation.nameMin3');
    return false;
  }
  if (name.length > 100) {
    templateNameError.value = tr('validation.nameMax100');
    return false;
  }
  templateNameError.value = '';
  return true;
}

const isSaveDisabled = computed(() => {
  return !templateDescription.value || templateDescription.value.trim() === '';
});

function handleSaveTemplate(): void {
  if (!validateTemplateName())
    return;
  if (!uploadedFile.value) {
    toast.add({ title: tr('toasts.common.errorTitle'), description: tr('toasts.save.uploadFirstDescription'), color: 'error' });
    return;
  }
  if (placedFields.value.length === 0) {
    toast.add({ title: tr('toasts.common.errorTitle'), description: tr('toasts.save.addAtLeastOneFieldDescription'), color: 'error' });
    return;
  }
  if (signingSteps.value.length === 0) {
    toast.add({ title: tr('toasts.stepValidation.signingStepRequired'), color: 'error' });
    return;
  }
  if (!placedFields.value.filter(f => !isAutoGeneratedField(f)).every(f => f.signerStepId)) {
    toast.add({ title: tr('toasts.stepValidation.allFieldsMustBeAssigned'), color: 'error' });
    return;
  }
  if (isSaveDisabled.value) {
    toast.add({
      title: tr('toasts.common.errorTitle'),
      description: tr('toasts.save.descriptionRequired'),
      color: 'error',
    });
    return;
  }
  performSave();
}

async function performSave(): Promise<void> {
  isSaving.value = true;

  try {
    // Step 1: If file was replaced, upload the new PDF
    let documentUrl = templateData.value?.documentUrl || '';
    if (fileWasReplaced.value && uploadedFile.value) {
      const formData = new FormData();
      formData.append('file', uploadedFile.value);

      const uploadResponse = await $fetch('/api/upload-template-file', {
        method: 'POST',
        body: formData,
      }) as any;

      if (!uploadResponse.success || !uploadResponse.url) {
        throw new Error(tr('errors.uploadPdfFailed'));
      }
      documentUrl = uploadResponse.url;
    }

    // Step 2: Get PDF natural dimensions from child component
    let docWidth = templateData.value?.documentWidth || 0;
    let docHeight = templateData.value?.documentHeight || 0;
    if (templatePdfRef.value) {
      const ref = templatePdfRef.value as any;
      if (ref.getPdfNaturalDimensions) {
        const dims = ref.getPdfNaturalDimensions();
        docWidth = Math.round(dims.width || 0);
        docHeight = Math.round(dims.height || 0);
      }
    }

    // Step 3: Normalize field coordinates (use serializer to keep payload minimal)
    const normalizedFields = placedFields.value.map((field: FieldInstance) => {
      const instanceNumber = getFieldDisplayInstanceNumber(field, placedFields.value);
      const fieldCopy = { ...field, instanceNumber };
      return placeField(fieldCopy, { preserveFormLayout: true });
    });

    // Step 4: Prepare signing flow data
    const signingFlowData = signingSteps.value.map(step => ({
      id: step.id,
      order: step.order,
      roleName: step.roleName,
      description: step.description || null,
      isRequired: step.isRequired,
      assignedFieldInstanceIds: step.assignedFieldInstanceIds,
      color: step.color,
    }));

    // Step 5: Save template to database
    const saveResponse = await $fetch(`/api/pdf-templates/${templateId.value}/save`, {
      method: 'POST',
      body: {
        name: templateName.value.trim(),
        description: templateDescription.value.trim(),
        originalCompositeUrl: documentUrl,
        placedFieldsData: normalizedFields,
        signingFlowData,
        documentWidth: docWidth,
        documentHeight: docHeight,
      },
    }) as any;

    if (!saveResponse.success || !saveResponse.data) {
      throw new Error(tr('errors.saveTemplateFailed'));
    }

    toast.add({ title: tr('toasts.save.savedTitle'), description: tr('toasts.save.savedDescription', { name: templateName.value }), color: 'success' });
    hasChanges.value = false;
    setTimeout(() => router.push('/admin/templates'), 500);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.add({ title: tr('toasts.save.saveFailedTitle'), description: errorMessage || tr('toasts.save.saveFailedDescription'), color: 'error' });
  }
  finally {
    isSaving.value = false;
  }
}

function handleTemplateSaved(templateData: any): void {
  isSaving.value = false;

  if (!templateData || templateData.error) {
    toast.add({
      title: tr('toasts.common.errorTitle'),
      description: templateData?.message || tr('toasts.save.saveFailedDescription'),
      color: 'error',
    });
    return;
  }

  toast.add({
    title: tr('toasts.save.savedTitle'),
    description: tr('toasts.save.savedGenericDescription'),
    color: 'success',
  });

  setTimeout(() => {
    router.push('/admin/templates');
  }, 500);
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

function handleKeyDown(event: KeyboardEvent): void {
  const activeEl = document.activeElement;
  const activeTag = activeEl?.tagName?.toLowerCase();
  const isEditableTarget = activeTag === 'input'
    || activeTag === 'textarea'
    || activeTag === 'select'
    || (activeEl instanceof HTMLElement && activeEl.isContentEditable);

  if (isEditableTarget) {
    return;
  }

  const mod = event.ctrlKey || event.metaKey;

  if (mod && event.code === 'KeyZ' && !event.shiftKey && currentWizardStep.value === 1 && uploadedFile.value) {
    event.preventDefault();
    undoPlacedFieldsChange();
    return;
  }

  // Physical KeyC/KeyV so copy/paste works with Thai keyboard layouts (event.key is not 'c'/'v').
  if (mod && (event.code === 'KeyC' || event.code === 'KeyV') && currentWizardStep.value === 1 && uploadedFile.value) {
    if (event.code === 'KeyC') {
      if (selectedFieldInstanceIds.value.length === 0) {
        return;
      }
      const sources = selectedFieldInstanceIds.value
        .map(id => placedFields.value.find(f => f.instanceId === id))
        .filter((f): f is FieldInstance => Boolean(f));
      if (sources.length === 0) {
        return;
      }
      event.preventDefault();
      void writeTemplateFieldsToSystemClipboard(sources);
      return;
    }
    if (event.code === 'KeyV') {
      event.preventDefault();
      void (async () => {
        const snapshots = await readTemplateFieldsFromClipboard();
        if (!snapshots?.length) {
          return;
        }
        pushPlacedFieldsUndoSnapshot();
        const pastedGroupSizeBySourceId: Record<string, number> = {};
        for (const snapshot of snapshots) {
          const sourceGroupId = String(snapshot?.groupId ?? '').trim();
          if (!sourceGroupId) {
            continue;
          }
          pastedGroupSizeBySourceId[sourceGroupId] = (pastedGroupSizeBySourceId[sourceGroupId] ?? 0) + 1;
        }
        const groupIdMapBySourceId: Record<string, string> = {};
        const groupPositionCursorBySourceId: Record<string, number> = {};
        const newIds: string[] = [];
        let shouldRefresh = false;
        for (let i = 0; i < snapshots.length; i++) {
          const newField = buildPastedFieldInstance(snapshots[i]!, placedFields.value, {
            pdfRef: templatePdfRef.value,
            fileType: fileType.value,
            currentPage: currentPdfPage.value,
            groupIdMapBySourceId,
            pastedGroupSizeBySourceId,
            groupPositionCursorBySourceId,
          });
          placedFields.value.push(newField);
          newIds.push(newField.instanceId);
          if (fieldHasPreviewContent(newField)) {
            shouldRefresh = true;
          }
        }
        selectedFieldInstanceIds.value = newIds;
        hasChanges.value = true;
        if (shouldRefresh) {
          schedulePreviewRefresh();
        }
      })();
      return;
    }
  }

  if (selectedFieldInstanceIds.value.length === 0 || !templatePdfRef.value) {
    return;
  }

  const targets = selectedFieldInstanceIds.value
    .map(id => placedFields.value.find(f => f.instanceId === id))
    .filter((f): f is FieldInstance => Boolean(f));
  if (targets.length === 0) {
    return;
  }

  const step = event.shiftKey ? 10 : 1;

  const refreshPreviewForMovedField = () => {
    if (isPreviewOutputEnabled.value && hasPreviewInputs.value) {
      schedulePreviewRefresh();
    }
  };

  const moveAllNormalized = (fn: (field: FieldInstance) => void) => {
    const normTargets = targets.filter(
      f => f.normalizedX !== undefined && f.normalizedY !== undefined,
    );
    if (normTargets.length === 0) {
      return;
    }
    event.preventDefault();
    pushPlacedFieldsUndoSnapshot();
    let moved = false;
    for (const field of normTargets) {
      const beforeX = field.normalizedX;
      const beforeY = field.normalizedY;
      fn(field);
      if (field.normalizedX !== beforeX || field.normalizedY !== beforeY) {
        moved = true;
      }
    }
    if (moved) {
      hasChanges.value = true;
      refreshPreviewForMovedField();
    }
  };

  switch (event.key) {
    case 'ArrowUp':
      moveAllNormalized((field) => {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX || 0,
          field.normalizedY!,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newY = Math.max(0, display.y - step);
        const normalized = templatePdfRef.value!.displayToNormalized(
          display.x,
          newY,
          display.width,
          display.height,
        );
        field.normalizedY = normalized.y;
      });
      break;
    case 'ArrowDown':
      moveAllNormalized((field) => {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX || 0,
          field.normalizedY!,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newY = display.y + step;
        const normalized = templatePdfRef.value!.displayToNormalized(
          display.x,
          newY,
          display.width,
          display.height,
        );
        field.normalizedY = normalized.y;
      });
      break;
    case 'ArrowLeft':
      moveAllNormalized((field) => {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX!,
          field.normalizedY || 0,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newX = Math.max(0, display.x - step);
        const normalized = templatePdfRef.value!.displayToNormalized(
          newX,
          display.y,
          display.width,
          display.height,
        );
        field.normalizedX = normalized.x;
      });
      break;
    case 'ArrowRight':
      moveAllNormalized((field) => {
        const display = templatePdfRef.value!.normalizedToDisplay(
          field.normalizedX!,
          field.normalizedY || 0,
          field.normalizedWidth || 0,
          field.normalizedHeight || 0,
        );
        const newX = display.x + step;
        const normalized = templatePdfRef.value!.displayToNormalized(
          newX,
          display.y,
          display.width,
          display.height,
        );
        field.normalizedX = normalized.x;
      });
      break;
    case 'Delete':
      event.preventDefault();
      removeSelectedField();
      break;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function handleBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(async () => {
  await Promise.all([fetchTemplate(), fetchTemplateFields()]);
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  clearPreviewRefreshTimer();
  abortPreviewRequest();
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
  }
});

watch([uploadedFile, fileType, previewFieldValues, isPreviewOutputEnabled], () => {
  schedulePreviewRefresh();
}, { deep: true, immediate: true });

watch([templateName, placedFields, uploadedFile, signingSteps], (): void => {
  hasChanges.value = true;
});

watch(
  selectedField,
  (newField: FieldInstance | null): void => {
    if (newField && typeof newField === 'object') {
      if (typeof newField.label !== 'string')
        newField.label = '';
      if (!newField.instanceId)
        newField.instanceId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  { deep: true },
);
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- ═══════════════ TOP HEADER (Toolbar with Step Indicator) ═══════════════ -->
    <header class="h-16 flex items-center justify-between px-4 z-20 shadow-sm shrink-0 bg-white border-b border-gray-200">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="currentWizardStep > 1 ? goPrevious() : router.back()"
        />

        <!-- Template Name Input (visible across all steps) -->
        <div class="flex flex-col">
          <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">{{ tr('header.templateNameLabel') }}</label>
          <input
            v-model="templateName"
            type="text"
            :class="templateNameError ? 'border border-red-500 bg-red-50' : 'border bg-transparent'"
            class="p-2 font-semibold focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-300 w-64 hover:bg-gray-50 rounded px-2 transition-colors"
            :placeholder="tr('header.templateNamePlaceholder')"
            :disabled="isLoading || currentWizardStep > 1"
            @input="validateTemplateName"
          >
          <div v-if="templateNameError && currentWizardStep === 1" class="flex items-center gap-2 mt-1 text-red-600 text-xs font-semibold">
            <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0" />
            {{ templateNameError }}
          </div>
        </div>

        <div class="h-6 w-px bg-gray-200 mx-1 hidden md:block" />
      </div>

      <!-- Step Indicator (center) -->
      <div class="flex items-center gap-1">
        <template v-for="(ws, idx) in wizardSteps" :key="ws.step">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            :class="{
              'bg-primary-100 text-primary-700': currentWizardStep === ws.step,
              'bg-primary-50 text-primary-500': currentWizardStep > ws.step,
              'bg-gray-100 text-gray-400': currentWizardStep < ws.step,
            }"
            @click="ws.step <= currentWizardStep ? goToStep(ws.step) : undefined"
          >
            <UIcon :name="ws.icon" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ ws.label }}</span>
          </button>
          <div v-if="idx < wizardSteps.length - 1" class="w-6 h-px" :class="currentWizardStep > ws.step ? 'bg-primary-400' : 'bg-gray-200'" />
        </template>
      </div>

      <!-- Right actions -->
      <div class="flex items-center gap-3">
        <UButton
          v-if="currentWizardStep > 1"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          :label="tr('actions.previous')"
          @click="goPrevious"
        />
        <UButton
          v-if="currentWizardStep < 3"
          icon="i-heroicons-arrow-right"
          trailing
          color="primary"
          :label="tr('actions.next')"
          size="xl"
          class="px-6 font-bold"
          @click="goNext"
        />
        <UButton
          v-if="currentWizardStep === 3"
          :loading="isSaving"
          :disabled="isLoading"
          icon="i-heroicons-check"
          color="primary"
          :label="tr('actions.saveTemplate')"
          size="xl"
          class="px-6 font-bold"
          @click="handleSaveTemplate"
        />
      </div>
    </header>

    <!-- ═══════════════ STEP 1: Upload & Place Fields ═══════════════ -->
    <div v-if="currentWizardStep === 1" class="flex-1 flex overflow-hidden">
      <!-- ─── LEFT SIDEBAR ─── -->
      <aside class="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">
        <div class="p-4 border-b">
          <h3 class="font-bold flex items-center gap-2">
            <UIcon name="i-heroicons-swatch" class="text-primary-500" />
            {{ tr('sidebar.tools') }}
          </h3>
        </div>

        <div class="overflow-y-auto flex-1 p-4 space-y-6">
          <!-- ── File Section ── -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-xs font-semibold uppercase text-gray-500">{{ tr('sidebar.document') }}</label>
              <UBadge v-if="uploadedFile" color="success" variant="subtle" size="xs">
                {{ tr('sidebar.loaded') }}
              </UBadge>
            </div>

            <!-- Loaded state -->
            <div v-if="uploadedFile" class="rounded-lg p-3 bg-gray-50 flex items-center gap-3 border border-gray-200">
              <div class="w-10 h-10 bg-white border border-gray-200 rounded flex items-center justify-center text-gray-400 shrink-0">
                <UIcon :name="fileType === 'pdf' ? 'i-heroicons-document-text' : 'i-heroicons-photo'" class="w-6 h-6" />
              </div>
              <div class="overflow-hidden">
                <p class="text-sm font-medium text-gray-900 truncate">
                  {{ uploadedFile.name }}
                </p>
                <button class="text-xs text-primary-600 hover:underline" @click="triggerFileInput">
                  {{ tr('sidebar.replaceFile') }}
                </button>
              </div>
            </div>

            <!-- Empty / drop zone -->
            <div
              v-else
              class="border-2 border-dashed rounded-xl p-6 text-center hover:bg-gray-50 hover:border-primary-400 transition-all cursor-pointer group"
              :class="{ 'border-primary-500 bg-primary-50': isDragging }"
              @click="triggerFileInput"
              @drop.prevent="handleFileDrop"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
            >
              <UIcon name="i-heroicons-cloud-arrow-up" class="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-primary-500 transition-colors" />
              <p class="text-sm font-medium text-gray-600">
                {{ tr('sidebar.clickToUpload') }}
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ tr('sidebar.supportedFileTypes') }}
              </p>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept="application/pdf,image/*"
              class="hidden"
              @change="handleFileInput"
            >
          </div>

          <!-- ── Available Fields ── -->
          <div>
            <div class="flex justify-between items-center mb-3">
              <label class="text-xs font-semibold uppercase text-gray-500">{{ tr('sidebar.fields') }}</label>
              <div class="flex items-center gap-2">
                <UBadge v-if="!isLoadingFields && availableFields.length > 0" color="primary" variant="subtle" size="xs">
                  {{ availableFields.length }}
                </UBadge>
                <UButton
                  icon="i-heroicons-plus"
                  size="xs"
                  color="primary"
                  variant="soft"
                  :title="tr('sidebar.addNewField')"
                  @click="isCreateFieldModalOpen = true"
                />
              </div>
            </div>

            <!-- Search -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              :placeholder="tr('sidebar.searchPlaceholder')"
              size="sm"
              class="mb-3 w-full"
              :disabled="isLoadingFields"
            />

            <!-- Loading skeleton -->
            <div v-if="isLoadingFields" class="space-y-2">
              <div v-for="i in 3" :key="i" class="w-full h-16 rounded-lg bg-gray-100 animate-pulse" />
            </div>

            <!-- Empty state -->
            <div v-else-if="availableFields.length === 0" class="text-center py-8">
              <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p class="text-sm text-gray-500">
                {{ tr('sidebar.noFieldsFound') }}
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ tr('sidebar.clickPlusToAddFields') }}
              </p>
            </div>

            <!-- Field list -->
            <div v-else class="space-y-2">
              <div
                v-for="field in filteredFields"
                :key="field.id"
                class="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-primary-400 hover:shadow-sm transition-all group"
              >
                <button
                  class="flex-1 flex items-center gap-3 text-left"
                  @click="addFieldToPreview(field)"
                >
                  <div class="w-8 h-8 rounded-md bg-gray-50 text-gray-500 flex items-center justify-center group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                    <UIcon :name="field.icon" class="w-5 h-5" />
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                      {{ field.name }}
                    </p>
                    <p class="text-[10px] text-gray-400">
                      {{ field.type }}
                    </p>
                  </div>
                </button>
                <UButton
                  icon="i-heroicons-pencil-square"
                  size="xs"
                  color="primary"
                  variant="ghost"
                  square
                  :title="tr('sidebar.editField')"
                  @click.stop="openEditField(field)"
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ─── CENTER CANVAS ─── -->
      <section class="flex-1 relative overflow-hidden flex flex-col bg-gray-100">
        <!-- Canvas toolbar — fixed height so layout does not jump when field-toolbar mounts -->
        <div class="min-h-12 bg-white border-b border-gray-200 px-4 flex items-center shrink-0">
          <!-- Left: page info -->
          <div class="flex items-center shrink-0 w-20 self-stretch">
            <span class="text-xs text-gray-400 font-medium">
              <template v-if="isLoading">{{ tr('canvas.pageInfo.loading') }}</template>
              <template v-else-if="!uploadedFile">{{ tr('canvas.pageInfo.noFile') }}</template>
              <template v-else>{{ tr('canvas.pageInfo.page', { page: currentPdfPage }) }}</template>
            </span>
          </div>

          <!-- Center: field toolbar (reserved slot keeps bar height when empty) -->
          <div class="flex-1 flex justify-center items-center min-w-0 min-h-12 self-stretch">
            <field-toolbar
              v-if="selectedField"
              :selected-field="selectedField"
              :placed-fields="placedFields"
              :pdf-ref="templatePdfRef"
              :scale="scale"
              :is-saving-defaults="isSavingFieldDefaults"
              @field-updated="handleFieldUpdate"
              @field-removed="handleFieldRemoval"
              @save-defaults="handleSaveFieldDefaultsFromToolbar"
            />
          </div>

          <!-- Right: zoom controls -->
          <div class="flex items-center gap-1.5 shrink-0 justify-end self-stretch">
            <UButton
              :icon="isPreviewOutputEnabled ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="isPreviewOutputEnabled ? tr('canvas.previewToggle.hide') : tr('canvas.previewToggle.show')"
              @click="togglePreviewOutput"
            />
            <UPopover :content="{ align: 'end', side: 'bottom', sideOffset: 4 }" :ui="{ content: 'w-auto min-w-0 p-0 overflow-visible' }">
              <template #default="{ open }">
                <UTooltip :text="tr('canvas.zoom.title')" :popper="{ placement: 'left' }">
                  <UButton
                    icon="i-heroicons-magnifying-glass"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :class="open ? 'ring-1 ring-inset ring-primary-400 bg-primary-50/80' : ''"
                    :aria-label="tr('canvas.zoom.ariaLabel')"
                  />
                </UTooltip>
              </template>
              <template #content>
                <div class="w-44 p-2.5 rounded-xl bg-white shadow-lg border border-gray-200/80">
                  <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-0.5">
                    {{ tr('canvas.zoom.level') }}
                  </p>
                  <div class="flex flex-col gap-0.5">
                    <button
                      v-for="opt in zoomPresetOptions"
                      :key="opt.label"
                      type="button"
                      class="w-full text-left text-sm px-2 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                      :class="Math.round(scale * 100) === Math.round(opt.value * 100) ? 'bg-primary-50 text-primary-700 font-semibold' : ''"
                      @click="setCanvasZoomScale(opt.value)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                  <div class="border-t border-gray-200 mt-2 pt-2">
                    <label class="text-[11px] text-gray-500 block mb-1 px-0.5">{{ tr('canvas.zoom.customPercent') }}</label>
                    <div class="flex gap-1.5 items-center">
                      <input
                        v-model="zoomCustomPercentInput"
                        type="text"
                        inputmode="numeric"
                        class="flex-1 min-w-0 h-8 rounded-lg border border-gray-200 px-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        :placeholder="tr('canvas.zoom.placeholderPercent')"
                        @keydown.enter.prevent="applyZoomCustomPercentFromInput"
                      >
                      <UButton size="xs" color="neutral" variant="soft" @click="applyZoomCustomPercentFromInput">
                        {{ tr('actions.apply') }}
                      </UButton>
                    </div>
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </div>

        <div v-if="isPreviewOutputEnabled && uploadedFile && fileType === 'pdf'" class="min-h-12 bg-white border-b border-gray-200 px-4 py-2 flex items-center shrink-0 gap-3">
          <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 shrink-0">{{ tr('canvas.previewOutput.title') }}</span>

          <template v-if="!selectedField">
            <input
              type="text"
              disabled
              class="flex-1 min-w-0 h-8 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400 cursor-not-allowed"
              :placeholder="tr('canvas.previewOutput.selectFieldPlaceholder')"
            >
          </template>

          <template v-else>
            <span class="text-xs text-gray-600 truncate max-w-40 shrink-0">{{ selectedField.label || selectedField.name }}</span>
            <UBadge
              v-if="hasFieldVisibilityRule(selectedField)"
              color="warning"
              variant="subtle"
              size="xs"
              class="shrink-0"
            >
              {{ tr('canvas.previewOutput.conditional') }}
            </UBadge>

            <template v-if="canTypePreviewValue">
              <input
                :value="selectedFieldPreviewValue"
                :maxlength="selectedFieldMaxLength || undefined"
                type="text"
                class="flex-1 min-w-0 h-8 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                :placeholder="tr('canvas.previewOutput.typeSamplePlaceholder')"
                @input="handlePreviewInput"
              >
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="!selectedFieldPreviewValue"
                @click="selectedFieldPreviewValue = ''"
              >
                {{ tr('actions.clear') }}
              </UButton>
              <span v-if="selectedFieldMaxLength" class="text-[11px] text-gray-400 shrink-0">{{ selectedFieldPreviewCharacterCount }}/{{ selectedFieldMaxLength }}</span>
            </template>

            <template v-else-if="canTogglePreviewCheckbox">
              <label class="flex-1 min-w-0 h-8 rounded-md border border-gray-300 px-3 text-sm text-gray-700 flex items-center gap-2">
                <input
                  :checked="selectedFieldPreviewChecked"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  @change="handlePreviewCheckboxChange"
                >
                <span class="truncate">{{ tr('canvas.previewOutput.checkboxHint') }}</span>
              </label>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="!selectedFieldPreviewChecked"
                @click="selectedFieldPreviewChecked = false"
              >
                {{ tr('actions.clear') }}
              </UButton>
            </template>

            <template v-else>
              <span class="flex-1 min-w-0 text-xs text-gray-500">{{ tr('canvas.previewOutput.noInputHint') }}</span>
            </template>
          </template>

          <span class="text-[11px] text-gray-400 shrink-0">{{ isRefreshingPreview ? tr('canvas.previewOutput.syncing') : tr('canvas.previewOutput.previewOnly') }}</span>
        </div>

        <!-- Scrollable Canvas -->
        <div class="flex-1 overflow-auto p-8 flex justify-center items-start">
          <!-- Loading state -->
          <div v-if="isLoading" class="flex items-center justify-center w-full h-full min-h-96">
            <div class="text-center text-gray-400">
              <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 mx-auto mb-3 animate-spin" />
              <p class="text-sm">
                {{ tr('canvas.loadingTemplate') }}
              </p>
            </div>
          </div>

          <!-- PDF Editor -->
          <template-pdf-create
            v-else-if="fileType === 'pdf' && previewDisplayFile"
            ref="templatePdfRef"
            :pdf-file="previewDisplayFile"
            :placed-fields="placedFields"
            :selected-field="selectedField || undefined"
            :selected-instance-ids="selectedFieldInstanceIds"
            :new-template-name="templateName"
            :selected-contract-id="(selectedContractId as string | number | undefined)"
            :signing-steps="signingSteps"
            :ui-scale="scale"
            :field-values="activePreviewOverlayFieldValues"
            :fill-mode="isPreviewFillModeActive"
            @field-selected="selectField"
            @field-drag-start="onFieldDragStart"
            @field-updated="handleFieldUpdate"
            @field-removed="handleFieldRemoval"
            @pdf-loaded="onImageLoad"
            @template-saved="handleTemplateSaved"
            @current-page-changed="handlePdfPageChange"
          />

          <!-- Empty placeholder -->
          <div
            v-else
            class="bg-white shadow-lg border border-gray-200 rounded-lg"
            style="width: 595px; min-height: 842px;"
          >
            <div class="flex flex-col items-center justify-center h-full py-20 text-gray-300">
              <UIcon name="i-heroicons-document" class="w-16 h-16 mb-2" />
              <p class="text-sm">
                {{ tr('canvas.noDocumentLoaded') }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══════════════ STEP 2: Signing Flow ═══════════════ -->
    <template-signing-flow-editor
      v-else-if="currentWizardStep === 2"
      :signing-steps="signingSteps"
      :placed-fields="placedFields"
      :pdf-file="uploadedFile"
      :file-type="fileType"
      :ui-scale="scale"
      @update:signing-steps="handleSigningStepsUpdate"
      @update:placed-fields="handlePlacedFieldsUpdate"
    />

    <!-- ═══════════════ STEP 3: Review & Save ═══════════════ -->
    <template-review-summary
      v-else-if="currentWizardStep === 3"
      v-model:template-description="templateDescription"
      :template-name="templateName"
      :uploaded-file="uploadedFile"
      :file-type="fileType"
      :placed-fields="placedFields"
      :signing-steps="signingSteps"
      :pdf-file="uploadedFile"
      :ui-scale="scale"
      @confirm="handleSaveTemplate"
    />

    <!-- ─── Modals ─── -->
    <template-field-create-modal
      v-model="isCreateFieldModalOpen"
      @field-created="handleFieldCreated"
    />

    <template-field-create-modal
      v-model="isEditFieldModalOpen"
      mode="edit"
      :edit-field="editingField"
      @field-updated="handleFieldUpdated"
      @field-deleted="handleFieldDeleted"
    />
  </div>
</template>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
