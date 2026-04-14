<script setup lang="ts">
import { getFieldDisplayBadgeText, getFieldDisplayInstanceNumber } from '../../../shared/field-instance-number';
import { placeField } from '../../utils/place-field';

type Field = any;
type RenderTask = any;
type PDFDocumentProxy = any;
type PDFJSType = any;

const props = defineProps({
  pdfFile: { type: File, default: null },
  placedFields: { type: Array as () => Field[], default: () => [] },
  selectedField: { type: Object, default: null },
  newTemplateName: { type: String, default: '' },
  selectedContractId: { type: [String, Number], default: null },
  uiScale: { type: Number, default: 1 }, // UI zoom scale from parent
  readOnly: { type: Boolean, default: false }, // Read-only mode (no editing)
  signingSteps: { type: Array as () => { id: string; color: string; roleName: string }[], default: () => [] }, // Signing steps for color-coding fields
  fieldValues: { type: Object as () => Record<string, string>, default: () => ({}) }, // Live typed values or overlay values for WYSIWYG preview
  fillMode: { type: Boolean, default: false }, // Show typed values in field boxes for WYSIWYG
  /** Full template fields for strike-group detection when `placedFields` is a filtered overlay subset */
  strikeGroupContextFields: { type: Array as () => Field[], default: null },
  /** When set (e.g. admin builder), enables multi-select highlights and group drag. */
  selectedInstanceIds: { type: Array as () => string[], default: () => [] },
  /** Highlights one field instance in read-only/fill mode (used by side form sync). */
  highlightedFieldInstanceId: { type: String, default: '' },
});

const emit = defineEmits<{
  fieldSelected: [field: Field | null, options?: { shiftKey?: boolean }];
  fieldDragStart: [];
  pdfLoaded: [];
  templateSaved: [data: any];
  currentPageChanged: [pageNumber: number];
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
  fieldClicked: [field: Field];
  fieldHovered: [field: Field | null];
}>();

const { t } = useI18n();

function tr(key: string, params?: Record<string, unknown>) {
  const messageKey = `adminTemplates.create.pdfCreate.${key}`;
  const translate = t as unknown as (message: string, values?: Record<string, unknown>) => string;
  return translate(messageKey, params);
}

type PositionOverride = {
  normalizedX?: number;
  normalizedY?: number;
  normalizedWidth?: number;
  normalizedHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

// Helper: get signing step color for a field
function getFieldSignerColor(field: Field): string | null {
  if (!field.signerStepId || !props.signingSteps.length)
    return null;
  const step = props.signingSteps.find((s: any) => s.id === field.signerStepId);
  return step ? step.color : null;
}

// Helper: get signing step role name for a field
function getFieldSignerRole(field: Field): string | null {
  if (!field.signerStepId || !props.signingSteps.length)
    return null;
  const step = props.signingSteps.find((s: any) => s.id === field.signerStepId);
  return step ? step.roleName : null;
}

function isFieldInstanceSelected(field: Field): boolean {
  const ids = props.selectedInstanceIds;
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.includes(field.instanceId);
  }
  return props.selectedField?.instanceId === field.instanceId;
}

function resolveDisplayFontFamily(fontFamily?: string): string {
  const value = (fontFamily || '').trim();
  return value || 'Sarabun';
}

function resolveFieldValueEntry(field: Field): { hasEntry: boolean; value: string } {
  const instanceKey = field?.instanceId ? String(field.instanceId) : '';
  const idKey = field?.id !== undefined && field?.id !== null ? String(field.id) : '';

  if (instanceKey && Object.prototype.hasOwnProperty.call(props.fieldValues, instanceKey)) {
    return {
      hasEntry: true,
      value: props.fieldValues[instanceKey] || '',
    };
  }

  if (idKey && Object.prototype.hasOwnProperty.call(props.fieldValues, idKey)) {
    return {
      hasEntry: true,
      value: props.fieldValues[idKey] || '',
    };
  }

  return {
    hasEntry: false,
    value: '',
  };
}

function hasFieldTextOverride(field: Field): boolean {
  return resolveFieldValueEntry(field).hasEntry;
}

function getFieldTextOverride(field: Field): string {
  return resolveFieldValueEntry(field).value;
}

function isCheckboxField(field: Field): boolean {
  const fieldType = String(field?.type || field?.fieldType || '').toLowerCase();
  const fieldName = String(field?.name || '').trim().toLowerCase();
  return fieldType === 'checkbox' || fieldName === 'check mark';
}

function isStrikeThroughGroupModeEnabled(field: Field): boolean {
  if (Object.prototype.hasOwnProperty.call(field || {}, 'strikeThroughGroupMode')) {
    return field?.strikeThroughGroupMode === true;
  }
  return field?.strike_through_group_mode === true;
}

function isStrikeThroughGroupField(field: Field): boolean {
  if (!isCheckboxField(field)) {
    return false;
  }

  return isStrikeThroughGroupModeEnabled(field);
}

function getStrikeGroupContextPool(): Field[] {
  const extra = props.strikeGroupContextFields;
  if (extra != null && Array.isArray(extra) && extra.length > 0) {
    return extra;
  }
  return props.placedFields as Field[];
}

function normalizeCheckboxRawValue(raw: string): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

function hasCheckedCheckboxInStrikeGroup(groupId: string): boolean {
  const id = String(groupId ?? '').trim();
  if (!id) {
    return false;
  }

  return getStrikeGroupContextPool().some((candidate) => {
    if (!isCheckboxField(candidate) || String(candidate?.groupId ?? '').trim() !== id) {
      return false;
    }
    const { value } = resolveFieldValueEntry(candidate);
    return normalizeCheckboxRawValue(value);
  });
}

/** Student fill overlay: unchecked strike option while another in the group is checked — PDF shows dash only; hide HTML frame */
function isStrikeThroughUncheckedShowingDash(field: Field): boolean {
  const groupId = String(field?.groupId ?? '').trim();
  if (!isStrikeThroughGroupField(field) || !groupId) {
    return false;
  }
  if (!hasCheckedCheckboxInStrikeGroup(groupId)) {
    return false;
  }
  const { value } = resolveFieldValueEntry(field);
  return !normalizeCheckboxRawValue(value);
}

function getCheckboxBadgeText(field: Field): string {
  const baseText = getFieldDisplayBadgeText(field, props.placedFields);
  if (isStrikeThroughGroupField(field)) {
    return `${baseText} -`;
  }
  return baseText;
}

function isSignatureField(field: Field): boolean {
  const fieldType = String(field?.type || field?.fieldType || '').toLowerCase();
  return fieldType === 'signature';
}

function hasSignatureImage(field: Field): boolean {
  if (!isSignatureField(field)) {
    return false;
  }

  return String(field?.imageUrl ?? '').trim().length > 0;
}

function getFieldVisibilityRule(field: Field) {
  const rawRule = field?.visibilityRule ?? field?.visibility_rule;
  if (!rawRule || typeof rawRule !== 'object') {
    return null;
  }

  const sourceFieldInstanceId = String(rawRule.sourceFieldInstanceId ?? rawRule.source_field_instance_id ?? '').trim();
  const sourceGroupId = String(rawRule.sourceGroupId ?? rawRule.source_group_id ?? '').trim();
  if (!sourceFieldInstanceId.length && !sourceGroupId.length) {
    return null;
  }

  return {
    sourceFieldInstanceId: sourceFieldInstanceId || null,
    sourceGroupId: sourceGroupId || null,
    operator: rawRule.operator === 'isUnchecked' ? 'isUnchecked' : 'isChecked',
  };
}

function hasVisibilityRule(field: Field): boolean {
  return Boolean(getFieldVisibilityRule(field));
}

function getVisibilitySourceLabel(sourceFieldInstanceId: string): string {
  const sourceField = props.placedFields.find(
    candidate => String(candidate?.instanceId ?? '').trim() === sourceFieldInstanceId,
  );

  if (!sourceField) {
    return tr('visibility.checkboxFallback', { id: sourceFieldInstanceId.slice(0, 8) });
  }

  const baseLabel = String(sourceField.label || sourceField.name || tr('visibility.checkboxLabel')).trim();
  const instanceSuffix = ` #${getFieldDisplayInstanceNumber(sourceField, props.placedFields)}`;
  return `${baseLabel}${instanceSuffix}`;
}

function getVisibilityGroupSourceLabel(sourceGroupId: string): string {
  const sourceField = props.placedFields.find(
    candidate => String(candidate?.groupId ?? '').trim() === sourceGroupId && isCheckboxField(candidate),
  );

  if (!sourceField) {
    return tr('visibility.checkboxGroupFallback', { id: sourceGroupId.slice(0, 8) });
  }

  const baseLabel = String(sourceField.label || sourceField.name || tr('visibility.checkboxGroupLabel')).trim();
  return tr('visibility.groupAllLabel', { label: baseLabel });
}

function getVisibilityOperatorText(operator: string): string {
  return operator === 'isUnchecked' ? tr('visibility.isUnchecked') : tr('visibility.isChecked');
}

function getVisibilityConditionText(field: Field): string {
  const rule = getFieldVisibilityRule(field);
  if (!rule) {
    return '';
  }

  const sourceLabel = rule.sourceGroupId
    ? getVisibilityGroupSourceLabel(rule.sourceGroupId)
    : getVisibilitySourceLabel(String(rule.sourceFieldInstanceId || ''));
  const operatorText = getVisibilityOperatorText(rule.operator);
  return tr('visibility.conditionText', { sourceLabel, operatorText });
}

function getVisibilityBadgeTitle(field: Field): string {
  return getVisibilityConditionText(field);
}

function isAutoGeneratedField(field: Field): boolean {
  const fieldType = String(field?.type || field?.fieldType || '').toLowerCase();
  const isAutoGenerate = field?.isAutoGenerate === true || field?.isAutoGenerated === true || field?.is_auto_generated === true;
  return isAutoGenerate && (fieldType === 'date' || fieldType === 'time');
}

function supportsLetterSpacing(field: Field): boolean {
  const fieldType = String(field?.type || field?.fieldType || '').toLowerCase();
  return fieldType !== 'date' && fieldType !== 'time';
}

const viewerArea = ref<HTMLDivElement | null>(null);
const previewContainer = ref<HTMLDivElement | null>(null);
const pdfPageContainer = ref<HTMLDivElement | null>(null);
const pdfCanvas = ref<HTMLCanvasElement | null>(null);
const containerWidth = ref(0);

const pdfLoaded = ref(false);
const hasRenderedPdfOnce = ref(false);
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);
const pdfjsLib = shallowRef<PDFJSType | null>(null);
const totalPages = ref(1);
const currentPage = ref(1);
const pdfBytes = ref<Uint8Array | null>(null);
const scale = ref(1.5);
const pdfNaturalDimensions = ref({ width: 0, height: 0 });
const renderTask = shallowRef<RenderTask | null>(null);
const isRendering = ref(false);

const activeDrag = ref<{
  isDragging: boolean;
  mode: 'single' | 'group';
  field: Field | null;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  groupStartNormalized?: Record<string, { nx: number; ny: number; nw: number; nh: number }>;
}>({
  isDragging: false,
  mode: 'single',
  field: null,
  offsetX: 0,
  offsetY: 0,
  displayWidth: 150,
  displayHeight: 40,
});
const activeResize = ref<{
  isResizing: boolean;
  field: Field | null;
  direction: string | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}>({
  isResizing: false,
  field: null,
  direction: null,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0,
});

// Pan: drag past threshold on background scrolls viewerArea; short click deselects field (no @click — avoids deselect after pan).
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
const PAN_DRAG_THRESHOLD_PX = 6;
const panPointerDown = ref<{ clientX: number; clientY: number } | null>(null);

// Local position overrides during drag/resize (multi-key for group drag)
const fieldPositionOverrides = ref<Record<string, PositionOverride>>({});

// --- Fit-to-width ---
// Scale factor to make the PDF fill the container width
const fitScale = computed(() => {
  const natW = pdfNaturalDimensions.value.width;
  if (!natW || !containerWidth.value)
    return 1;
  return containerWidth.value / natW;
});

const displayWidth = computed(() => {
  if (!pdfNaturalDimensions.value.width || !containerWidth.value)
    return 0;
  return containerWidth.value;
});

const displayHeight = computed(() => {
  const natH = pdfNaturalDimensions.value.height;
  if (!natH)
    return 0;
  return natH * fitScale.value;
});

// Canvas CSS display size: scaled to fill the container width
const canvasDisplayStyle = computed(() => ({
  width: `${displayWidth.value}px`,
  height: `${displayHeight.value}px`,
}));

// Computed: Calculate wrapper dimensions after scale for proper scrolling
const scaledDimensions = computed(() => {
  const dw = displayWidth.value;
  const dh = displayHeight.value;
  if (!dw || !dh) {
    return { width: 0, height: 0 };
  }
  const currentScale = props.uiScale || 1;
  return {
    width: dw * currentScale,
    height: dh * currentScale,
  };
});

// ========================================
// Coordinate Conversion Functions (Fit-to-width)
// ใช้ normalized coordinates (0-1) เป็นหลัก
// Maps between normalized (0-1) and fit-to-width display coordinates.
// The CSS transform: scale(uiScale) handles all visual zoom scaling.
// ========================================

// แปลง display pixel coordinates → normalized (0-1)
// Uses fit-to-width display dimensions (unaffected by CSS zoom transforms)
function displayToNorm(x: number, y: number, width: number, height: number) {
  const dw = displayWidth.value;
  const dh = displayHeight.value;
  if (!dw || !dh) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: x / dw,
    y: y / dh,
    width: width / dw,
    height: height / dh,
  };
}

// แปลง normalized (0-1) → display pixel coordinates (fit-to-width)
function normToDisplay(normX: number, normY: number, normWidth: number, normHeight: number) {
  const dw = displayWidth.value;
  const dh = displayHeight.value;
  if (!dw || !dh) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }
  return {
    x: normX * dw,
    y: normY * dh,
    width: normWidth * dw,
    height: normHeight * dh,
  };
}

// Security: Validate normalized coordinates
function isValidNormalizedCoord(value: unknown) {
  return typeof value === 'number'
    && !Number.isNaN(value)
    && Number.isFinite(value)
    && value >= 0
    && value <= 1;
}

function _validateNormalizedField(field: Field) {
  if (!field) {
    return { valid: false, error: 'Field is null or undefined' };
  }

  if (!isValidNormalizedCoord(field.normalizedX)) {
    return { valid: false, error: `Invalid normalizedX: ${field.normalizedX}` };
  }

  if (!isValidNormalizedCoord(field.normalizedY)) {
    return { valid: false, error: `Invalid normalizedY: ${field.normalizedY}` };
  }

  if (!isValidNormalizedCoord(field.normalizedWidth) || field.normalizedWidth === 0) {
    return { valid: false, error: `Invalid normalizedWidth: ${field.normalizedWidth}` };
  }

  if (!isValidNormalizedCoord(field.normalizedHeight) || field.normalizedHeight === 0) {
    return { valid: false, error: `Invalid normalizedHeight: ${field.normalizedHeight}` };
  }

  return { valid: true };
}

async function initPdfJs(): Promise<PDFJSType> {
  if (pdfjsLib.value)
    return pdfjsLib.value;

  try {
    const pdfjs = await import('pdfjs-dist');
    if (import.meta.client) {
      // Use local worker from node_modules instead of CDN
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      (pdfjs as any).GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    }
    pdfjsLib.value = pdfjs as PDFJSType;
    return pdfjs as PDFJSType;
  }
  catch (error) {
    console.error('Error loading PDF.js:', error);
    throw new Error('Failed to load PDF library');
  }
}

async function loadPdf(): Promise<void> {
  if (!props.pdfFile)
    return;

  try {
    if (!hasRenderedPdfOnce.value) {
      pdfLoaded.value = false;
    }
    if (!pdfPageContainer.value)
      throw new Error('PDF container not found');

    const arrayBuffer = await props.pdfFile.arrayBuffer();
    // Clone the ArrayBuffer to prevent detachment when transferred to worker
    pdfBytes.value = new Uint8Array(arrayBuffer.slice(0));

    const pdfjs = await initPdfJs();
    const loadingTask = (pdfjs as any).getDocument({
      data: pdfBytes.value,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });

    const loadedDoc = await loadingTask.promise;
    pdfDoc.value = loadedDoc as PDFDocumentProxy;
    totalPages.value = loadedDoc.numPages;
    currentPage.value = 1;

    const firstPage = await loadedDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    pdfNaturalDimensions.value = {
      width: viewport.width,
      height: viewport.height,
    };

    await nextTick();
    setTimeout(async () => {
      await renderCurrentPage();
      pdfLoaded.value = true;
      hasRenderedPdfOnce.value = true;
      emit('pdfLoaded');
    }, 100);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error loading PDF:', error);
    console.error(`Error loading PDF: ${errorMessage}`);
    if (!hasRenderedPdfOnce.value) {
      pdfLoaded.value = false;
    }
  }
}

async function renderCurrentPage(): Promise<void> {
  if (!pdfDoc.value || !pdfCanvas.value)
    return;

  // Cancel any ongoing render operation
  if (renderTask.value) {
    try {
      await (renderTask.value as any).cancel();
    }
    catch {
      // Ignore cancellation errors
    }
    renderTask.value = null;
  }

  // Wait if currently rendering
  if (isRendering.value) {
    return;
  }

  try {
    isRendering.value = true;
    const pageNumber = currentPage.value;
    const page = await (pdfDoc.value as any).getPage(pageNumber);
    const viewport = page.getViewport({ scale: scale.value });

    // Render on an offscreen canvas first, then swap in one step to avoid visible blank/flicker.
    const stagingCanvas = document.createElement('canvas');
    stagingCanvas.height = viewport.height;
    stagingCanvas.width = viewport.width;
    const stagingContext = stagingCanvas.getContext('2d');
    if (!stagingContext)
      throw new Error('Failed to get staging canvas context');

    // Store render task for potential cancellation
    renderTask.value = page.render({ canvasContext: stagingContext, viewport });
    await (renderTask.value as any).promise;
    renderTask.value = null;

    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Failed to get canvas context');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(stagingCanvas, 0, 0);

    // Note: canvas dimensions don't change with zoom
    // The CSS transform: scale() on parent handles all visual scaling

    emit('currentPageChanged', pageNumber);
  }
  catch (error: unknown) {
    const err = error as any;
    if (err?.name === 'RenderingCancelledException') {
      console.warn('PDF rendering was cancelled');
    }
    else {
      console.error('Error rendering PDF:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error rendering PDF: ${errorMessage}`);
    }
  }
  finally {
    isRendering.value = false;
  }
}

function selectField(field: Field, event?: MouseEvent): void {
  emit('fieldSelected', field, { shiftKey: Boolean(event?.shiftKey) });
}

function handleFieldMouseEnter(field: Field) {
  emit('fieldHovered', field);
}

function handleFieldMouseLeave() {
  emit('fieldHovered', null);
}

function getEventCoordinates(event: any): { clientX: number; clientY: number } {
  if (event.touches && event.touches.length > 0) {
    return {
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY,
    };
  }
  return { clientX: event.clientX, clientY: event.clientY };
}

function startDrag(event: any, field: Field): void {
  if (!previewContainer.value || !field)
    return;

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();
  const uiScale = props.uiScale || 1;

  // Shift+multi-select is handled on `click` only. Emitting here *and* on click toggles twice
  // (add on mousedown, remove on click) so the selection flickers and appears broken.
  if (event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // Use displayX/displayY from computed field, or fall back to x/y
  const fieldDisplayX = (field as any).displayX ?? field.x ?? 50;
  const fieldDisplayY = (field as any).displayY ?? field.y ?? 50;

  // Mouse coords (screen space) → Canvas coords
  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  // Snapshot the field state — does NOT keep a reference to the prop object
  const fieldSnapshot = { ...((props.placedFields as Field[]).find((f: Field) => f.instanceId === field.instanceId) || field) };

  const sel = (props.selectedInstanceIds as string[]) || [];
  const pageFiltered = (props.placedFields as Field[]).filter(
    f =>
      (!f.pageNumber || f.pageNumber === currentPage.value)
      && sel.includes(f.instanceId)
      && f.normalizedX !== undefined
      && f.normalizedWidth !== undefined,
  );
  const useGroup = !props.readOnly
    && sel.length > 1
    && sel.includes(field.instanceId)
    && pageFiltered.length > 1;

  emit('fieldDragStart');
  fieldPositionOverrides.value = {};

  if (useGroup) {
    const groupStartNormalized: Record<string, { nx: number; ny: number; nw: number; nh: number }> = {};
    for (const f of pageFiltered) {
      groupStartNormalized[f.instanceId] = {
        nx: f.normalizedX!,
        ny: f.normalizedY ?? 0,
        nw: f.normalizedWidth ?? 0,
        nh: f.normalizedHeight ?? 0,
      };
    }
    if (Object.keys(groupStartNormalized).length >= 2) {
      activeDrag.value = {
        isDragging: true,
        mode: 'group',
        field: fieldSnapshot,
        offsetX: mouseCanvasX - fieldDisplayX,
        offsetY: mouseCanvasY - fieldDisplayY,
        displayWidth: (field as any).displayWidth ?? field.width ?? 150,
        displayHeight: (field as any).displayHeight ?? field.height ?? 40,
        groupStartNormalized,
      };
      emit('fieldSelected', field);
      event.preventDefault();
      event.stopPropagation();

      document.addEventListener('mousemove', drag, { passive: false });
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('touchend', stopDrag);
      return;
    }
  }

  activeDrag.value = {
    isDragging: true,
    mode: 'single',
    field: fieldSnapshot,
    offsetX: mouseCanvasX - fieldDisplayX,
    offsetY: mouseCanvasY - fieldDisplayY,
    displayWidth: (field as any).displayWidth ?? field.width ?? 150,
    displayHeight: (field as any).displayHeight ?? field.height ?? 40,
  };

  emit('fieldSelected', field);
  event.preventDefault();
  event.stopPropagation();

  document.addEventListener('mousemove', drag, { passive: false });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', stopDrag);
}

function drag(event: any): void {
  if (
    !activeDrag.value.isDragging
    || !activeDrag.value.field
    || !previewContainer.value
    || !pdfCanvas.value
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();
  const uiScale = props.uiScale || 1;

  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  const field = activeDrag.value.field;

  const dw = displayWidth.value || 1;
  const dh = displayHeight.value || 1;

  const fieldDisplayWidth = activeDrag.value.displayWidth;
  const fieldDisplayHeight = activeDrag.value.displayHeight;

  if (activeDrag.value.mode === 'group' && activeDrag.value.groupStartNormalized) {
    const gsm = activeDrag.value.groupStartNormalized;
    let newDisplayX = mouseCanvasX - activeDrag.value.offsetX;
    let newDisplayY = mouseCanvasY - activeDrag.value.offsetY;
    newDisplayX = Math.max(0, Math.min(newDisplayX, dw - fieldDisplayWidth));
    newDisplayY = Math.max(0, Math.min(newDisplayY, dh - fieldDisplayHeight));

    const primaryId = field!.instanceId;
    const startN = gsm[primaryId];
    if (!startN) {
      return;
    }

    const startPrimaryDisplay = normToDisplay(startN.nx, startN.ny, startN.nw, startN.nh);
    const newPrimaryNorm = displayToNorm(newDisplayX, newDisplayY, startPrimaryDisplay.width, startPrimaryDisplay.height);

    const dnx = newPrimaryNorm.x - startN.nx;
    const dny = newPrimaryNorm.y - startN.ny;

    const next: Record<string, PositionOverride> = {};
    for (const id of Object.keys(gsm)) {
      const s = gsm[id]!;
      let nx = s.nx + dnx;
      let ny = s.ny + dny;
      nx = Math.max(0, Math.min(nx, 1 - s.nw));
      ny = Math.max(0, Math.min(ny, 1 - s.nh));
      next[id] = {
        normalizedX: nx,
        normalizedY: ny,
        normalizedWidth: s.nw,
        normalizedHeight: s.nh,
      };
    }
    fieldPositionOverrides.value = next;
    return;
  }

  let newDisplayX = mouseCanvasX - activeDrag.value.offsetX;
  let newDisplayY = mouseCanvasY - activeDrag.value.offsetY;
  newDisplayX = Math.max(0, Math.min(newDisplayX, dw - fieldDisplayWidth));
  newDisplayY = Math.max(0, Math.min(newDisplayY, dh - fieldDisplayHeight));

  if (field!.normalizedX !== undefined && field!.normalizedWidth !== undefined) {
    const normalized = displayToNorm(newDisplayX, newDisplayY, fieldDisplayWidth, fieldDisplayHeight);
    fieldPositionOverrides.value = {
      [field!.instanceId]: {
        normalizedX: normalized.x,
        normalizedY: normalized.y,
        normalizedWidth: normalized.width,
        normalizedHeight: normalized.height,
      },
    };
  }
  else {
    fieldPositionOverrides.value = {
      [field!.instanceId]: {
        x: Math.round(newDisplayX),
        y: Math.round(newDisplayY),
      },
    };
  }
}

function stopDrag(): void {
  if (activeDrag.value.isDragging) {
    const ovMap = fieldPositionOverrides.value;
    const keys = Object.keys(ovMap);
    if (keys.length > 0) {
      for (const instanceId of keys) {
        const ov = ovMap[instanceId];
        if (!ov) {
          continue;
        }
        if (ov.normalizedX !== undefined) {
          emit('fieldUpdated', {
            instanceId,
            updates: {
              normalizedX: ov.normalizedX,
              normalizedY: ov.normalizedY,
              normalizedWidth: ov.normalizedWidth,
              normalizedHeight: ov.normalizedHeight,
            },
          });
        }
        else if (ov.x !== undefined) {
          emit('fieldUpdated', {
            instanceId,
            updates: { x: ov.x, y: ov.y },
          });
        }
      }
    }
    fieldPositionOverrides.value = {};

    activeDrag.value.isDragging = false;
    activeDrag.value.field = null;
    activeDrag.value.mode = 'single';
    activeDrag.value.groupStartNormalized = undefined;

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
  }
}

function startResize(event: any, field: Field, direction: string): void {
  if (!field)
    return;

  event.preventDefault();
  event.stopPropagation();

  emit('fieldDragStart');
  fieldPositionOverrides.value = {};

  // Get current display size from normalized coordinates
  const currentDisplay = field.normalizedWidth !== undefined
    ? normToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight)
    : { width: 150, height: 40 };

  // Snapshot the field state — does NOT keep a reference to the prop object
  const fieldSnapshot = { ...((props.placedFields as Field[]).find((f: Field) => f.instanceId === field.instanceId) || field) };

  activeResize.value = {
    isResizing: true,
    field: fieldSnapshot,
    direction,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: currentDisplay.width,
    startHeight: currentDisplay.height,
  };

  emit('fieldSelected', field);

  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
}

function handleResize(event: any): void {
  if (!activeResize.value.isResizing || !activeResize.value.field)
    return;

  event.preventDefault();

  const uiScale = props.uiScale || 1;
  // Adjust mouse delta for CSS transform scale
  const deltaX = (event.clientX - activeResize.value.startX) / uiScale;
  const deltaY = (event.clientY - activeResize.value.startY) / uiScale;

  const field = activeResize.value.field as Field;
  const direction = activeResize.value.direction;

  let newWidth = activeResize.value.startWidth;
  let newHeight = activeResize.value.startHeight;

  if (direction === 'right' || direction === 'corner') {
    newWidth = Math.max(20, activeResize.value.startWidth + deltaX);
  }

  if (direction === 'bottom' || direction === 'corner') {
    newHeight = Math.max(20, activeResize.value.startHeight + deltaY);
  }

  // Convert display coords back to normalized and update override — does NOT mutate the prop
  if (field.normalizedX !== undefined) {
    const currentDisplay = normToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight);
    const normalized = displayToNorm(currentDisplay.x, currentDisplay.y, newWidth, newHeight);
    fieldPositionOverrides.value = {
      [field.instanceId]: {
        normalizedX: normalized.x,
        normalizedY: normalized.y,
        normalizedWidth: normalized.width,
        normalizedHeight: normalized.height,
      },
    };
  }
  else {
    field.width = Math.round(newWidth);
    field.height = Math.round(newHeight);
    fieldPositionOverrides.value = {
      [field.instanceId]: {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      },
    };
  }
}

function stopResize(): void {
  if (activeResize.value.isResizing) {
    const ovMap = fieldPositionOverrides.value;
    const keys = Object.keys(ovMap);
    if (keys.length > 0) {
      for (const instanceId of keys) {
        const ov = ovMap[instanceId];
        if (!ov) {
          continue;
        }
        if (ov.normalizedX !== undefined) {
          emit('fieldUpdated', {
            instanceId,
            updates: {
              normalizedX: ov.normalizedX,
              normalizedY: ov.normalizedY,
              normalizedWidth: ov.normalizedWidth,
              normalizedHeight: ov.normalizedHeight,
            },
          });
        }
        else if (activeResize.value.field?.instanceId === instanceId) {
          emit('fieldUpdated', {
            instanceId,
            updates: {
              width: activeResize.value.field.width,
              height: activeResize.value.field.height,
            },
          });
        }
      }
    }
    fieldPositionOverrides.value = {};

    activeResize.value.isResizing = false;
    activeResize.value.field = null;

    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
}

// async function saveImagesToStorage(templateName, _compositePdfBytes) {
//   // Temporarily disabled - return mock URLs
//   console.warn('Storage upload disabled - using mock URLs');

//   const timestamp = Date.now();
//   const fileExtension = props.pdfFile.name.split('.').pop();
//   const originalFileName = `${templateName}_${timestamp}.${fileExtension}`;
//   const compositeFileName = `${templateName}_${timestamp}_composite.pdf`;

//   return {
//     originalImageUrl: `https://example.com/templates/${originalFileName}`,
//     compositeImageUrl: `https://example.com/composites/${compositeFileName}`,
//   };

//   /*
//   const originalFilePath = `templates/${originalFileName}`;

// //   const { error: uploadError1 } = await supabase.storage
// //     .from("contract")
// //     .upload(originalFilePath, props.pdfFile, {
// //       cacheControl: "3600",
// //       upsert: false,
// //     });
// //   if (uploadError1)
// //     throw new Error("Error uploading original PDF: " + uploadError1.message);

// //   const { data: publicUrlData1 } = supabase.storage
// //     .from("contract")
// //     .getPublicUrl(originalFilePath);

// //   const compositeFilePath = `composites/${compositeFileName}`;
// //   const compositeBlob = new Blob([compositePdfBytes], {
// //     type: "application/pdf",
// //   });

// //   const { error: uploadError2 } = await supabase.storage
// //     .from("contract")
// //     .upload(compositeFilePath, compositeBlob, {
// //       cacheControl: "3600",
// //       upsert: false,
// //     });
// //   if (uploadError2)
// //     throw new Error("Error uploading composite PDF: " + uploadError2.message);

// //   const { data: publicUrlData2 } = supabase.storage
// //     .from("contract")
// //     .getPublicUrl(compositeFilePath);

// //   return {
// //     originalImageUrl: publicUrlData1.publicUrl,
// //     compositeImageUrl: publicUrlData2.publicUrl,
// //   };
// //   */
// }

async function saveTemplate() {
  try {
    // Validate prerequisites
    if (!props.pdfFile) {
      throw new Error(tr('errors.uploadPdfFirst'));
    }

    if (props.placedFields.length === 0) {
      throw new Error(tr('errors.addAtLeastOneField'));
    }

    const templateName = props.newTemplateName?.trim();
    if (!templateName) {
      throw new Error(tr('errors.enterTemplateName'));
    }

    if (!pdfNaturalDimensions.value.width || !pdfNaturalDimensions.value.height) {
      throw new Error(tr('errors.pdfDimensionsNotLoaded'));
    }

    // Step 1: Upload PDF file
    const formData = new FormData();
    formData.append('file', props.pdfFile);

    const uploadResponse = await $fetch('/api/upload-template-file', {
      method: 'POST',
      body: formData,
    }) as any;

    if (!uploadResponse.success || !uploadResponse.url) {
      throw new Error(tr('errors.uploadPdfFailed'));
    }

    const documentUrl = uploadResponse.url;

    // Step 2: Normalize field coordinates (use serializer to keep payload minimal)
    const normalizedFields = (props.placedFields as Field[]).map((field: Field) => {
      const normalizedX = Math.round((field.x / pdfNaturalDimensions.value.width) * 10000) / 10000;
      const normalizedY = Math.round((field.y / pdfNaturalDimensions.value.height) * 10000) / 10000;
      const normalizedWidth = Math.round((field.width / pdfNaturalDimensions.value.width) * 10000) / 10000;
      const normalizedHeight = Math.round((field.height / pdfNaturalDimensions.value.height) * 10000) / 10000;
      const fieldCopy = { ...field, normalizedX, normalizedY, normalizedWidth, normalizedHeight };
      return placeField(fieldCopy, { preserveFormLayout: true });
    });

    // Step 3: Prepare template payload
    const templatePayload = {
      name: templateName,
      description: null,
      version: '1.0.0',
      isActive: false,
      createdBy: null,
      documentUrl,
      documentWidth: Math.round(pdfNaturalDimensions.value.width),
      documentHeight: Math.round(pdfNaturalDimensions.value.height),
      placedFieldsData: normalizedFields,
    };

    // Step 4: Save template metadata to database
    const saveResponse = await $fetch('/api/pdf-templates', {
      method: 'POST',
      body: templatePayload,
    }) as any;

    if (!saveResponse.success || !saveResponse.data) {
      throw new Error(tr('errors.saveTemplateFailed'));
    }

    // Step 5: Emit success event
    emit('templateSaved', {
      success: true,
      data: saveResponse.data,
      message: tr('messages.templateSaved', { name: templateName }),
    });
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Save template error:', error);

    // Emit error event
    emit('templateSaved', {
      success: false,
      error: true,
      message: errorMessage || tr('errors.saveTemplateFallback'),
    });
  }
}

// Coordinate conversion helper functions (exposed to parent)
// These use fit-to-width display coordinates
function normalizedToDisplay(
  normalizedX: number,
  normalizedY: number,
  normalizedWidth: number,
  normalizedHeight: number,
): { x: number; y: number; width: number; height: number } {
  return normToDisplay(normalizedX, normalizedY, normalizedWidth, normalizedHeight);
}

function displayToNormalized(
  dispX: number,
  dispY: number,
  dispW: number,
  dispH: number,
): { x: number; y: number; width: number; height: number } {
  return displayToNorm(dispX, dispY, dispW, dispH);
}

// Computed: fields with display coordinates for rendering in the template
const fieldsWithDisplayCoords = computed(() => {
  return props.placedFields
    .filter((field: Field) => !field.pageNumber || field.pageNumber === currentPage.value)
    .map((field: Field) => {
      const ov = fieldPositionOverrides.value[field.instanceId];
      const activeField = ov ? { ...field, ...ov } : field;

      if (activeField.normalizedX !== undefined) {
        const display = normToDisplay(
          activeField.normalizedX,
          activeField.normalizedY,
          activeField.normalizedWidth,
          activeField.normalizedHeight,
        );
        return {
          ...field,
          displayX: display.x,
          displayY: display.y,
          displayWidth: display.width,
          displayHeight: display.height,
        };
      }
      return {
        ...field,
        displayX: activeField.x || 50,
        displayY: activeField.y || 50,
        displayWidth: (activeField as any).width ?? field.width ?? 150,
        displayHeight: (activeField as any).height ?? field.height ?? 40,
      };
    });
});

watch(
  () => props.pdfFile,
  async (newFile: File | null) => {
    if (newFile) {
      await nextTick();
      await loadPdf();
    }
  },
  { immediate: true },
);

watch(
  currentPage,
  () => {
    if (pdfLoaded.value)
      renderCurrentPage();
  },
);

// Auto-calculate normalized coordinates for fields that don't have them yet
watch(
  () => [props.placedFields, pdfLoaded.value, pdfNaturalDimensions.value],
  () => {
    if (!pdfLoaded.value || !pdfNaturalDimensions.value.width)
      return;

    // Emit normalized coords for new fields instead of mutating the prop directly
    (props.placedFields as Field[]).forEach((field) => {
      if (field.normalizedX === undefined || field.normalizedY === undefined) {
        const normalized = displayToNorm(
          field.x || 50,
          field.y || 50,
          field.width || 150,
          field.height || 40,
        );
        emit('fieldUpdated', {
          instanceId: field.instanceId,
          updates: {
            normalizedX: normalized.x,
            normalizedY: normalized.y,
            normalizedWidth: normalized.width,
            normalizedHeight: normalized.height,
          },
        });
      }
    });
  },
  { deep: true },
);

// ========================================
// Pan scrolling (drag past threshold → scroll viewerArea; release without drag → deselect)
// ========================================
function isPanExcludedTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest)
    return true;
  return Boolean(
    el.closest('.placed-field')
    || el.closest('.resize-handle')
    || el.closest('.preview-page-bar')
    || el.closest('select')
    || el.closest('button')
    || el.closest('a')
    || el.closest('input')
    || el.closest('textarea')
    || el.closest('label'),
  );
}

function onPanPointerDown(event: MouseEvent) {
  if (activeDrag.value.isDragging || activeResize.value.isResizing)
    return;
  if (isPanExcludedTarget(event.target))
    return;
  if (event.button !== 0)
    return;

  panPointerDown.value = { clientX: event.clientX, clientY: event.clientY };
}

function handlePan(event: MouseEvent) {
  if (panPointerDown.value && !isPanning.value) {
    const dx = event.clientX - panPointerDown.value.clientX;
    const dy = event.clientY - panPointerDown.value.clientY;
    if (dx * dx + dy * dy >= PAN_DRAG_THRESHOLD_PX * PAN_DRAG_THRESHOLD_PX) {
      const scroller = viewerArea.value;
      if (!scroller)
        return;
      isPanning.value = true;
      panStart.value = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
      };
      panPointerDown.value = null;
    }
  }

  if (isPanning.value && viewerArea.value) {
    const dx = event.clientX - panStart.value.x;
    const dy = event.clientY - panStart.value.y;
    viewerArea.value.scrollLeft = panStart.value.scrollLeft - dx;
    viewerArea.value.scrollTop = panStart.value.scrollTop - dy;
  }
}

function stopPan() {
  if (panPointerDown.value && !isPanning.value && !props.readOnly) {
    emit('fieldSelected', null);
    nextTick(() => {
      viewerArea.value?.focus({ preventScroll: true });
    });
  }
  panPointerDown.value = null;
  isPanning.value = false;
}

// --- Measure container width ---
function updateContainerWidth() {
  if (viewerArea.value) {
    const style = getComputedStyle(viewerArea.value);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    containerWidth.value = viewerArea.value.clientWidth - paddingLeft - paddingRight;
  }
}

async function focusFieldByInstanceId(instanceId: string) {
  const id = String(instanceId ?? '').trim();
  if (!id) {
    return;
  }

  const targetField = (props.placedFields as Field[]).find(field => String(field?.instanceId ?? '').trim() === id);
  if (!targetField) {
    return;
  }

  const targetPage = Number.parseInt(String(targetField?.pageNumber ?? ''), 10);
  if (Number.isFinite(targetPage) && targetPage > 0 && targetPage !== currentPage.value) {
    currentPage.value = targetPage;
    await nextTick();
    await renderCurrentPage();
    await nextTick();
  }

  const scroller = viewerArea.value;
  if (!scroller) {
    return;
  }

  const fieldElement = scroller.querySelector<HTMLElement>(`.placed-field[data-field-instance-id="${CSS.escape(id)}"]`);
  if (!fieldElement) {
    return;
  }

  fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

let resizeObserver: ResizeObserver | null = null;

// Lifecycle
onMounted(() => {
  // loadPdf() is handled by the watch on props.pdfFile with { immediate: true }

  // Measure container width for fit-to-width
  updateContainerWidth();
  if (viewerArea.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    resizeObserver.observe(viewerArea.value);
  }

  if (previewContainer.value) {
    previewContainer.value.addEventListener('mousedown', onPanPointerDown);
  }
  document.addEventListener('mousemove', handlePan);
  document.addEventListener('mouseup', stopPan);
  document.addEventListener('mouseleave', stopPan);
});

onUnmounted(() => {
  resizeObserver?.disconnect();

  previewContainer.value?.removeEventListener('mousedown', onPanPointerDown);

  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);

  document.removeEventListener('mousemove', handlePan);
  document.removeEventListener('mouseup', stopPan);
  document.removeEventListener('mouseleave', stopPan);
});

// Expose functions and refs for parent component
defineExpose<{
  saveTemplate: () => Promise<void>;
  focusFieldByInstanceId: (instanceId: string) => Promise<void>;
  normalizedToDisplay: (
    normalizedX: number,
    normalizedY: number,
    normalizedWidth: number,
    normalizedHeight: number,
  ) => { x: number; y: number; width: number; height: number };
  displayToNormalized: (
    displayX: number,
    displayY: number,
    displayWidth: number,
    displayHeight: number,
  ) => { x: number; y: number; width: number; height: number };
  getPdfNaturalDimensions: () => { width: number; height: number };
}>({
  saveTemplate,
  focusFieldByInstanceId,
  normalizedToDisplay,
  displayToNormalized,
  getPdfNaturalDimensions: () => pdfNaturalDimensions.value,
});
</script>

<template>
  <div class="w-full h-full flex flex-col">
    <!-- Canvas Area – Scrollable -->
    <div
      ref="viewerArea"
      tabindex="-1"
      class="flex-1 overflow-auto bg-gray-100 p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 rounded-sm"
    >
      <div
        id="pdf-preview-container"
        ref="previewContainer"
        class="preview-area"
        :class="{ panning: isPanning }"
      >
        <!-- Wrapper ที่รับ transform: scale() เพื่อให้ PDF และ fields ขยายพร้อมกัน -->
        <div
          class="pdf-scale-wrapper"
          :style="{
            transform: `scale(${props.uiScale || 1})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease-out',
            minWidth: scaledDimensions.width ? `${scaledDimensions.width}px` : 'auto',
            minHeight: scaledDimensions.height ? `${scaledDimensions.height}px` : 'auto',
          }"
        >
          <div ref="pdfPageContainer" class="pdf-container">
            <div v-if="!pdfLoaded && !hasRenderedPdfOnce" class="text-center py-5">
              <i class="fas fa-file-pdf fa-3x text-muted mb-3" />
              <p class="text-muted mb-0">
                {{ tr('loadingPdf') }}
              </p>
            </div>

            <canvas
              v-show="pdfLoaded || hasRenderedPdfOnce"
              ref="pdfCanvas"
              class="pdf-canvas"
              :style="canvasDisplayStyle"
            />

            <!-- Fields อยู่ใน pdf-container เดียวกับ canvas เพื่อให้ position: absolute ทำงานถูกต้อง -->
            <div
              v-for="field in fieldsWithDisplayCoords"
              :key="field.instanceId"
              class="placed-field"
              :class="{
                'field-selected': isFieldInstanceSelected(field) && !props.readOnly,
                'field-sync-highlight': props.highlightedFieldInstanceId === field.instanceId,
                'field-has-visibility-rule': hasVisibilityRule(field),
                'fill-mode': props.readOnly && props.fillMode,
                'fill-mode--strike-omit': props.readOnly && props.fillMode && isStrikeThroughUncheckedShowingDash(field),
                'read-only': props.readOnly && !props.fillMode && !props.signingSteps.length,
                'field-unassigned': props.signingSteps.length > 0 && !field.signerStepId,
                'field-clickable': props.readOnly && props.signingSteps.length > 0,
                'signature-field': hasSignatureImage(field),
              }"
              :style="{
                left: `${field.displayX}px`,
                top: `${field.displayY}px`,
                width: `${field.displayWidth}px`,
                height: `${field.displayHeight}px`,
                zIndex: isFieldInstanceSelected(field) ? 1000 : 100,
                fontSize: `${(field.fontSize || 14) * fitScale}px`,
                fontFamily: resolveDisplayFontFamily(field.fontFamily),
                fontWeight: field.fontWeight || 'normal',
                fontStyle: field.fontStyle || 'normal',
                textDecoration: field.textDecoration || 'none',
                fontKerning: 'none',
                justifyContent: field.textAlign === 'right' ? 'flex-end' : field.textAlign === 'center' ? 'center' : 'flex-start',
                letterSpacing: supportsLetterSpacing(field) && field.letterSpacing ? `${field.letterSpacing * fitScale}px` : undefined,
                lineHeight: field.lineHeight ?? 1.5,
                cursor: props.readOnly ? (props.signingSteps.length > 0 ? 'pointer' : 'default') : 'grab',
                borderColor: getFieldSignerColor(field) || undefined,
                borderWidth: getFieldSignerColor(field) ? '2px' : undefined,
                borderStyle: getFieldSignerColor(field) ? 'solid' : undefined,
                backgroundColor: getFieldSignerColor(field) ? `${getFieldSignerColor(field)}15` : undefined,
              }"
              :data-field-instance-id="field.instanceId"
              data-field-surface="pdf"
              @mousedown.stop.prevent="!props.readOnly && startDrag($event, field)"
              @touchstart.stop.prevent="!props.readOnly && startDrag($event, field)"
              @click.stop="props.readOnly && props.signingSteps.length > 0 ? emit('fieldClicked', field) : !props.readOnly && selectField(field, $event)"
              @mouseenter="handleFieldMouseEnter(field)"
              @mouseleave="handleFieldMouseLeave"
            >
              <div
                v-if="!props.readOnly && hasVisibilityRule(field)"
                class="condition-tag"
                :class="{ 'condition-tag--stacked': isCheckboxField(field) }"
                :title="getVisibilityBadgeTitle(field)"
              >
                {{ getVisibilityConditionText(field) }}
              </div>

              <div
                v-if="!props.readOnly && isCheckboxField(field)"
                class="checkbox-tag"
                :class="{ 'checkbox-tag--stacked': hasVisibilityRule(field) }"
                :title="getCheckboxBadgeText(field)"
              >
                {{ getCheckboxBadgeText(field) }}
              </div>

              <div class="field-content">
                <template v-if="hasSignatureImage(field)">
                  <img
                    :src="field.imageUrl"
                    class="signature-img"
                    :alt="tr('signaturePreviewAlt')"
                  >
                </template>
                <template v-else-if="isCheckboxField(field)">
                  <!-- Keep checkbox box visually empty in builder preview -->
                </template>
                <template v-else>
                  <template v-if="hasFieldTextOverride(field)">
                    <span
                      v-if="getFieldTextOverride(field)"
                      class="field-value-text"
                      :style="field.textAlign !== 'center' && field.textAlign !== 'right' && Number(field.textIndent ?? 0) > 0
                        ? { textIndent: `${Number(field.textIndent ?? 0) * fitScale}px` }
                        : undefined"
                      :title="getFieldTextOverride(field)"
                    ><span class="field-text-content">{{ getFieldTextOverride(field) }}</span></span>
                  </template>
                  <span
                    v-else-if="!props.fillMode || props.readOnly || !isAutoGeneratedField(field)"
                    class="field-label-text"
                    :title="String(field.formQuestionLabel || field.label || field.name || '')"
                  ><span class="field-text-content">{{ field.formQuestionLabel || field.label || field.name }}</span></span>
                </template>
                <span
                  v-if="field.isGrouped && !hasSignatureImage(field) && !isCheckboxField(field) && !isStrikeThroughGroupField(field)"
                  class="instance-num"
                >#{{ field.instanceNumber }}</span>
              </div>
              <!-- Signer role tag (visible in read-only mode with signing steps) -->
              <div
                v-if="props.signingSteps.length > 0 && getFieldSignerRole(field)"
                class="signer-tag"
                :style="{ backgroundColor: getFieldSignerColor(field) || '#6B7280' }"
              >
                {{ getFieldSignerRole(field) }}
              </div>

              <!-- Resize handles (hidden in read-only mode) -->
              <div
                v-if="selectedField?.instanceId === field.instanceId && !props.readOnly"
                class="resize-handle resize-handle-right"
                @mousedown.stop.prevent="startResize($event, field, 'right')"
                @click.stop
              />
              <div
                v-if="selectedField?.instanceId === field.instanceId && !props.readOnly"
                class="resize-handle resize-handle-bottom"
                @mousedown.stop.prevent="startResize($event, field, 'bottom')"
                @click.stop
              />
              <div
                v-if="selectedField?.instanceId === field.instanceId && !props.readOnly"
                class="resize-handle resize-handle-corner"
                @mousedown.stop.prevent="startResize($event, field, 'corner')"
                @click.stop
              />
            </div>
          </div>
        </div>
        <!-- End of scale wrapper -->

        <!-- Page Selector -->
        <div v-if="pdfLoaded && totalPages > 1" class="preview-page-bar absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-md px-4 py-2 flex items-center gap-2 border border-gray-200">
          <label class="text-xs font-semibold text-gray-600">{{ tr('pageLabel') }}</label>
          <select
            v-model="currentPage"
            class="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            @change="renderCurrentPage"
          >
            <option v-for="i in totalPages" :key="i" :value="i">
              {{ i }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-area {
  position: relative;
  background:
    linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%),
    linear-gradient(45deg, #ddd 75%, transparent 75%), linear-gradient(-45deg, #ddd 75%, transparent 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    0 -10px;
  background-color: #f0f0f0;
  min-height: 400px;
  margin: 0 auto;
  width: 100%;
  max-width: 100%;
}

.preview-area.panning {
  cursor: grabbing;
}

/* Wrapper ที่รับ transform: scale() */
.pdf-scale-wrapper {
  position: relative;
  transform-origin: top left;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
  display: block;
  width: fit-content;
  /* Fixed dimensions - do NOT scale responsively */
}

.pdf-container {
  position: relative;
  /* Fixed dimensions based on PDF - NOT responsive */
  display: flex;
  justify-content: flex-start;
  cursor: default;
}

.pdf-canvas {
  /* Fixed dimensions - do NOT use max-width: 100% */
  display: block;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
  cursor: default;
  /* Canvas internal resolution used only for rendering */
  /* Displayed size controlled by getBoundingClientRect() in coordinate functions */
}

.placed-field {
  position: absolute;
  cursor: grab;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.25rem;
  z-index: 100;
  box-sizing: border-box;
  transform: translateZ(0);
  container-type: size;
}

.placed-field:hover {
  background: rgba(255, 255, 255, 0.4);
}

.placed-field.field-sync-highlight {
  border-color: #0ea5e9 !important;
  border-width: 2px !important;
  background: rgba(14, 165, 233, 0.18) !important;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
}

.placed-field:active {
  cursor: grabbing;
}

.placed-field.read-only {
  cursor: default !important;
  pointer-events: none;
}

.placed-field.field-clickable {
  cursor: pointer !important;
  pointer-events: auto;
}

.placed-field.field-unassigned {
  border: 2px dashed #9ca3af !important;
  background: rgba(156, 163, 175, 0.1) !important;
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.signer-tag {
  position: absolute;
  bottom: -8px;
  right: -4px;
  top: auto;
  font-size: 0.55rem;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.2;
  font-weight: 600;
  pointer-events: none;
  z-index: 1002;
}

.condition-tag {
  position: absolute;
  top: -8px;
  left: -4px;
  font-size: 0.55rem;
  color: #78350f;
  background-color: #fef3c7;
  border: 1px solid #fcd34d;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.2;
  letter-spacing: normal;
  font-weight: 700;
  pointer-events: none;
  z-index: 1002;
}

.checkbox-tag {
  position: absolute;
  top: -8px;
  left: -4px;
  font-size: 0.55rem;
  color: #78350f;
  background-color: #fef3c7;
  border: 1px solid #fcd34d;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.2;
  letter-spacing: normal;
  font-weight: 700;
  pointer-events: none;
  z-index: 1002;
}

.condition-tag--stacked {
  top: -8px;
}

.checkbox-tag--stacked {
  top: -22px;
}

.field-selected {
  border: 2px dashed rgba(0, 0, 255, 0.3) !important;
  background: rgba(0, 0, 255, 0.05) !important;
}

.field-content {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  width: 100%; /* required for text-align / justifyContent to work */
  height: 100%;
}

.field-content span {
  word-break: normal;
  overflow-wrap: break-word;
  white-space: normal;
  min-width: 0;
  flex: 1 1 auto;
}

/* Fill-mode: field boxes look like soft input zones (student fill page) */
.placed-field.fill-mode {
  cursor: default !important;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.88) !important;
  border: none !important;
  outline: 1px dashed rgba(59, 130, 246, 0.35) !important;
  outline-offset: 0;
}

/* Strike-through siblings: PDF already draws the line — hide overlay box so it looks “filled” */
.placed-field.fill-mode.fill-mode--strike-omit {
  background: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}

.placed-field.signature-field {
  background: rgba(255, 255, 255, 0.92) !important;
}

.signature-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

/* Actual typed value — inherits all styling from .placed-field */
.field-value-text {
  display: block;
  width: 100%;
  min-width: 0;
}

/* Field label in builder/overlay mode: fixed centered helper text */
.field-label-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 0.125rem;
  text-align: center;
  font-family: 'Sarabun', sans-serif !important;
  font-size: clamp(7px, 60cqh, 16px) !important;
  font-weight: 500 !important;
  font-style: normal !important;
  line-height: 1.2 !important;
  letter-spacing: 0 !important;
  text-decoration: none !important;
  white-space: normal;
  word-break: normal;
  overflow-wrap: break-word;
  min-width: 0;
  color: rgba(17, 24, 39, 0.72);
  font-kerning: none;
}

.field-text-content {
  display: block;
  width: 100%;
  min-width: 0;
  word-break: normal;
  overflow-wrap: break-word;
  white-space: normal;
}

/* Fill preview should stay legible inside tight boxes: truncate to one readable line */
.placed-field.fill-mode .field-text-content,
.placed-field.field-has-visibility-rule .field-text-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.instance-num {
  font-size: 0.65rem;
  color: #666;
  background: rgba(255, 255, 255, 0.8);
  padding: 1px 3px;
  border-radius: 2px;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  background: #0056b3;
  z-index: 1001;
  opacity: 0.8;
}

.resize-handle-right {
  width: 2px;
  height: 100%;
  top: 0;
  right: -1px;
  cursor: ew-resize;
}

.resize-handle-bottom {
  width: 100%;
  height: 2px;
  left: 0;
  bottom: -1px;
  cursor: ns-resize;
}

.resize-handle-corner {
  width: 8px;
  height: 8px;
  right: -4px;
  bottom: -4px;
  cursor: nwse-resize;
  border-radius: 50%;
}
</style>
