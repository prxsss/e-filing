<script setup lang="ts">
import type { FieldInstance, PdfDimensions } from '~/types/template';

import { getFieldDisplayBadgeText, getFieldDisplayInstanceNumber } from '../../../shared/field-instance-number';

type Field = FieldInstance;

type Props = {
  pdfBytes?: Uint8Array | null;
  originalPdfBytes?: Uint8Array | null;
  placedFields?: FieldInstance[];
  selectedField?: FieldInstance | null;
  templateName?: string;
  selectedContractId?: string | number | null;
  templateId?: string | number | null;
  originalCompositeUrl?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  uiScale?: number; // UI zoom scale from parent component
};

const props = withDefaults(defineProps<Props>(), {
  pdfBytes: null,
  originalPdfBytes: null,
  placedFields: () => [],
  selectedField: null,
  templateName: '',
  selectedContractId: null,
  templateId: null,
  originalCompositeUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  uiScale: 1,
});

const emit = defineEmits<{
  fieldSelected: [field: FieldInstance];
  pdfLoaded: [];
  templateSaved: [data: any];
  currentPageChanged: [pageNumber: number];
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
}>();

// Refs
const previewContainer = ref<HTMLDivElement | null>(null);
const pdfPageContainer = ref<HTMLDivElement | null>(null);
const pdfCanvas = ref<HTMLCanvasElement | null>(null);

// PDF State
const cachedPdfBytes = ref<Uint8Array | null>(null);
const cachedOriginalPdfBytes = ref<Uint8Array | null>(null);
const pdfLoaded = ref<boolean>(false);
const pdfDoc = shallowRef<any>(null);
const pdfjsLib = shallowRef<any>(null);
const totalPages = ref<number>(1);
const currentPage = ref<number>(1);
const scale = ref<number>(1.5);
const pdfNaturalDimensions = ref<PdfDimensions>({ width: 0, height: 0 });
const canvasDisplaySize = ref<{ width: number; height: number }>({ width: 0, height: 0 });
const renderTask = shallowRef<any>(null);
const isRendering = ref(false);

// Drag State
const activeDrag = ref<{
  isDragging: boolean;
  field: FieldInstance | null;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}>({
  isDragging: false,
  field: null,
  offsetX: 0,
  offsetY: 0,
  displayWidth: 150,
  displayHeight: 40,
});

// Resize State
const activeResize = ref<{
  isResizing: boolean;
  field: FieldInstance | null;
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

// ─── Coordinate Helpers ──────────────────────────────────────────────────────

function getPdfBounds() {
  if (!pdfCanvas.value) {
    return { displayWidth: 0, displayHeight: 0, naturalWidth: 0, naturalHeight: 0, scaleX: 1, scaleY: 1 };
  }
  const canvas = pdfCanvas.value;
  // Use canvas buffer dimensions (canvas.width/height) instead of getBoundingClientRect().
  // getBoundingClientRect() returns 0 when the canvas is hidden via v-show="pdfLoaded",
  // which causes fields to render at (0,0) on initial load.
  const canvasWidth = canvas.width || 0;
  const canvasHeight = canvas.height || 0;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;
  return {
    displayWidth: canvasWidth,
    displayHeight: canvasHeight,
    naturalWidth,
    naturalHeight,
    scaleX: canvasWidth > 0 ? naturalWidth / canvasWidth : 1,
    scaleY: canvasHeight > 0 ? naturalHeight / canvasHeight : 1,
  };
}

function normalizedToDisplay(
  normX: number,
  normY: number,
  normWidth: number,
  normHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }
  const bounds = getPdfBounds();
  const nw = pdfNaturalDimensions.value.width;
  const nh = pdfNaturalDimensions.value.height;
  return {
    x: (normX * nw) / bounds.scaleX,
    y: (normY * nh) / bounds.scaleY,
    width: (normWidth * nw) / bounds.scaleX,
    height: (normHeight * nh) / bounds.scaleY,
  };
}

function displayToNormalized(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const bounds = getPdfBounds();
  const nw = pdfNaturalDimensions.value.width;
  const nh = pdfNaturalDimensions.value.height;
  return {
    x: (x * bounds.scaleX) / nw,
    y: (y * bounds.scaleY) / nh,
    width: (width * bounds.scaleX) / nw,
    height: (height * bounds.scaleY) / nh,
  };
}

// ─── Computed ────────────────────────────────────────────────────────────────

// Computed: Calculate wrapper dimensions after scale for proper scrolling
const scaledDimensions = computed(() => {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { width: 0, height: 0 };
  }
  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;
  const currentScale = props.uiScale || 1;
  return {
    width: canvasWidth * currentScale,
    height: canvasHeight * currentScale,
  };
});

const placedFieldsOnCurrentPage = computed<FieldInstance[]>(() => {
  return (props.placedFields as FieldInstance[]).filter(
    field => !field.pageNumber || field.pageNumber === currentPage.value,
  );
});

function supportsLetterSpacing(field: FieldInstance): boolean {
  const fieldType = String(field?.type || field?.fieldType || '').toLowerCase();
  return fieldType !== 'date' && fieldType !== 'time';
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

function getCheckboxBadgeText(field: Field): string {
  const baseText = getFieldDisplayBadgeText(field, props.placedFields);
  if (isStrikeThroughGroupField(field)) {
    return `${baseText} -`;
  }
  return baseText;
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
    return `Checkbox (${sourceFieldInstanceId.slice(0, 8)})`;
  }

  const baseLabel = String(sourceField.label || sourceField.name || 'Checkbox').trim();
  const instanceSuffix = ` #${getFieldDisplayInstanceNumber(sourceField, props.placedFields)}`;
  return `${baseLabel}${instanceSuffix}`;
}

function getVisibilityGroupSourceLabel(sourceGroupId: string): string {
  const sourceField = props.placedFields.find(
    candidate => String(candidate?.groupId ?? '').trim() === sourceGroupId && isCheckboxField(candidate),
  );

  if (!sourceField) {
    return `Checkbox Group (${sourceGroupId.slice(0, 8)})`;
  }

  const baseLabel = String(sourceField.label || sourceField.name || 'Checkbox Group').trim();
  return `${baseLabel} (ทั้งกลุ่ม)`;
}

function getVisibilityOperatorText(operator: string): string {
  return operator === 'isUnchecked' ? 'ไม่ติ๊ก' : 'ติ๊ก';
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
  return `แสดงช่องใส่ข้อมูลเมื่อ ${sourceLabel} ${operatorText}`;
}

function getVisibilityBadgeTitle(field: Field): string {
  return getVisibilityConditionText(field);
}

// Converts normalized coords → display coords for rendering
const fieldsWithDisplayCoords = computed<FieldInstance[]>(() => {
  const _scale = scale.value;
  const _canvas = pdfCanvas.value;
  const _dims = pdfNaturalDimensions.value;
  const _canvasSize = canvasDisplaySize.value;

  // Don't render fields until PDF is loaded and canvas dimensions are set
  if (!_canvas || !_dims.width || !pdfLoaded.value)
    return [];

  return placedFieldsOnCurrentPage.value.map((field) => {
    // Ensure normalized coordinates are available
    if (
      field.normalizedX !== undefined
      && field.normalizedY !== undefined
      && field.normalizedWidth !== undefined
      && field.normalizedHeight !== undefined
    ) {
      const d = normalizedToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight);
      return { ...field, displayX: d.x, displayY: d.y, displayWidth: d.width, displayHeight: d.height };
    }
    // Fallback for fields with pixel coordinates
    return {
      ...field,
      displayX: field.x || 50,
      displayY: field.y || 50,
      displayWidth: field.width || 150,
      displayHeight: field.height || 40,
    };
  });
});

// ─── PDF Loading & Rendering ─────────────────────────────────────────────────

async function initPdfJs(): Promise<any> {
  if (pdfjsLib.value)
    return pdfjsLib.value;
  try {
    const pdfjs = await import('pdfjs-dist');
    if (import.meta.client) {
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      (pdfjs as any).GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    }
    pdfjsLib.value = pdfjs;
    return pdfjs;
  }
  catch (error) {
    console.error('Error loading PDF.js:', error);
    throw new Error('Failed to load PDF library');
  }
}

async function loadPdf(): Promise<void> {
  if (!props.pdfBytes)
    return;
  try {
    pdfLoaded.value = false;
    if (!pdfPageContainer.value)
      throw new Error('PDF container not found');

    const pdfjs = await initPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: props.pdfBytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });

    const loadedDoc = await loadingTask.promise;
    pdfDoc.value = loadedDoc;
    totalPages.value = loadedDoc.numPages;
    currentPage.value = 1;

    const firstPage = await loadedDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    pdfNaturalDimensions.value = { width: viewport.width, height: viewport.height };

    await nextTick();
    setTimeout(async () => {
      await renderCurrentPage();
      pdfLoaded.value = true;
      // Wait for v-show to unhide the canvas, then update display size
      await nextTick();
      updateCanvasSize();
      emit('pdfLoaded');
    }, 100);
  }
  catch (error) {
    console.error('Error loading PDF:', error);
    pdfLoaded.value = false;
  }
}

async function renderCurrentPage(): Promise<void> {
  if (!pdfDoc.value || !pdfCanvas.value)
    return;

  if (renderTask.value) {
    try {
      await (renderTask.value as any).cancel();
    }
    catch (error) {
      console.warn('Failed to cancel render task:', error);
    }
    renderTask.value = null;
  }
  if (isRendering.value)
    return;

  try {
    isRendering.value = true;
    const page = await pdfDoc.value.getPage(currentPage.value);
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const viewport = page.getViewport({ scale: scale.value });

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    context.clearRect(0, 0, canvas.width, canvas.height);

    renderTask.value = page.render({ canvasContext: context, viewport });
    await (renderTask.value as any).promise;
    renderTask.value = null;

    updateCanvasSize();
    // Ensure canvas layout is finalized before rendering fields
    await new Promise(resolve => requestAnimationFrame(resolve));
    emit('currentPageChanged', currentPage.value);
  }
  catch (error: any) {
    if (error?.name !== 'RenderingCancelledException') {
      console.error('Error rendering PDF:', error);
    }
  }
  finally {
    isRendering.value = false;
  }
}

function updateCanvasSize(): void {
  if (pdfCanvas.value) {
    const rect = pdfCanvas.value.getBoundingClientRect();
    canvasDisplaySize.value = { width: rect.width, height: rect.height };
  }
}

// ─── Field Interaction ────────────────────────────────────────────────────────

function selectField(field: FieldInstance): void {
  emit('fieldSelected', field);
}

function getEventCoordinates(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
  if ('touches' in event && event.touches?.[0]) {
    return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
  }
  return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
}

function startDrag(event: MouseEvent | TouchEvent, field: FieldInstance): void {
  if (!previewContainer.value || !field)
    return;

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();
  const uiScale = props.uiScale || 1;

  // Use displayX/displayY from computed field, or fall back to x/y
  const fieldDisplayX = (field as any).displayX ?? field.x ?? 50;
  const fieldDisplayY = (field as any).displayY ?? field.y ?? 50;

  // Convert mouse screen coords to canvas space (account for CSS transform scale)
  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  // Find the original field in placedFields to track which one we're dragging
  const originalField = (props.placedFields as FieldInstance[]).find(f => f.instanceId === field.instanceId);

  activeDrag.value = {
    isDragging: true,
    field: originalField || field, // Keep reference to original field
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

function drag(event: MouseEvent | TouchEvent): void {
  if (!activeDrag.value.isDragging || !activeDrag.value.field || !previewContainer.value || !pdfCanvas.value)
    return;
  event.preventDefault();
  event.stopPropagation();

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();
  const uiScale = props.uiScale || 1;

  // Convert mouse screen coords to canvas space (account for CSS transform scale)
  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  let newDisplayX = mouseCanvasX - activeDrag.value.offsetX;
  let newDisplayY = mouseCanvasY - activeDrag.value.offsetY;

  const field = activeDrag.value.field;

  // Use canvas buffer dimensions for bounds (not affected by CSS transform)
  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;

  // Use display dimensions captured at drag start
  const fieldDisplayWidth = activeDrag.value.displayWidth;
  const fieldDisplayHeight = activeDrag.value.displayHeight;

  // Constrain to canvas bounds
  newDisplayX = Math.max(0, Math.min(newDisplayX, canvasWidth - fieldDisplayWidth));
  newDisplayY = Math.max(0, Math.min(newDisplayY, canvasHeight - fieldDisplayHeight));

  // Convert display coordinates back to normalized for storage
  if (field.normalizedX !== undefined && field.normalizedWidth !== undefined) {
    // Field uses normalized coordinates
    const normalized = displayToNormalized(newDisplayX, newDisplayY, fieldDisplayWidth, fieldDisplayHeight);
    field.normalizedX = normalized.x;
    field.normalizedY = normalized.y;
    field.normalizedWidth = normalized.width;
    field.normalizedHeight = normalized.height;
  }
  else {
    // Field uses pixel coordinates
    field.x = Math.round(newDisplayX);
    field.y = Math.round(newDisplayY);
  }
}

function stopDrag(): void {
  if (activeDrag.value.isDragging) {
    activeDrag.value.isDragging = false;
    activeDrag.value.field = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
  }
}

function startResize(event: MouseEvent, field: FieldInstance, direction: string): void {
  if (!field)
    return;
  event.preventDefault();
  event.stopPropagation();

  // Get current display dimensions to use as resize start values
  const display = field.normalizedX !== undefined
    ? normalizedToDisplay(field.normalizedX, field.normalizedY || 0, field.normalizedWidth || 0, field.normalizedHeight || 0)
    : { x: field.x || 50, y: field.y || 50, width: field.width || 150, height: field.height || 40 };

  activeResize.value = {
    isResizing: true,
    field,
    direction,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: display.width,
    startHeight: display.height,
  };

  emit('fieldSelected', field);
  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
}

function handleResize(event: MouseEvent): void {
  if (!activeResize.value.isResizing || !activeResize.value.field)
    return;
  event.preventDefault();

  const uiScale = props.uiScale || 1;
  // Adjust mouse delta for CSS transform scale
  const deltaX = (event.clientX - activeResize.value.startX) / uiScale;
  const deltaY = (event.clientY - activeResize.value.startY) / uiScale;
  const field = activeResize.value.field;
  const direction = activeResize.value.direction;

  let newDisplayWidth = activeResize.value.startWidth;
  let newDisplayHeight = activeResize.value.startHeight;

  if (direction === 'right' || direction === 'corner')
    newDisplayWidth = Math.max(20, activeResize.value.startWidth + deltaX);
  if (direction === 'bottom' || direction === 'corner')
    newDisplayHeight = Math.max(20, activeResize.value.startHeight + deltaY);

  if (field.normalizedX !== undefined) {
    // Get current display position
    const display = normalizedToDisplay(field.normalizedX, field.normalizedY || 0, field.normalizedWidth || 0, field.normalizedHeight || 0);
    const normalized = displayToNormalized(display.x, display.y, newDisplayWidth, newDisplayHeight);
    field.normalizedWidth = normalized.width;
    field.normalizedHeight = normalized.height;
  }
  else {
    field.width = newDisplayWidth;
    field.height = newDisplayHeight;
  }
}

function stopResize(): void {
  if (activeResize.value.isResizing) {
    activeResize.value.isResizing = false;
    activeResize.value.field = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
}

// ─── Template Save ────────────────────────────────────────────────────────────

function validateNormalizedField(field: FieldInstance): { valid: boolean; error?: string } {
  if (!field.normalizedX || !field.normalizedY || !field.normalizedWidth || !field.normalizedHeight)
    return { valid: false, error: 'Field missing normalized coordinates' };
  if (field.normalizedX < 0 || field.normalizedX > 1)
    return { valid: false, error: 'Field X out of bounds' };
  if (field.normalizedY < 0 || field.normalizedY > 1)
    return { valid: false, error: 'Field Y out of bounds' };
  if (field.normalizedWidth <= 0 || field.normalizedWidth > 1)
    return { valid: false, error: 'Field width invalid' };
  if (field.normalizedHeight <= 0 || field.normalizedHeight > 1)
    return { valid: false, error: 'Field height invalid' };
  return { valid: true };
}

async function saveTemplate(): Promise<void> {
  try {
    // Use cached bytes to ensure they're always available
    const bytesToUse = cachedOriginalPdfBytes.value || cachedPdfBytes.value;

    if (!bytesToUse || bytesToUse.length === 0) {
      emit('templateSaved', { success: false, error: true, message: 'PDF not loaded' });
      return;
    }
    if ((props.placedFields as FieldInstance[]).length === 0) {
      emit('templateSaved', { success: false, error: true, message: 'Please add at least one field' });
      return;
    }
    if (!props.templateName?.trim()) {
      emit('templateSaved', { success: false, error: true, message: 'Please enter a template name' });
      return;
    }
    if (!props.templateId) {
      emit('templateSaved', { success: false, error: true, message: 'Template ID not found' });
      return;
    }

    // Validate PDF header
    let header: string;
    try {
      header = String.fromCharCode.apply(null, Array.from(bytesToUse.slice(0, 5)) as number[]);
    }
    catch {
      emit('templateSaved', { success: false, error: true, message: 'Error accessing PDF data' });
      return;
    }
    if (header !== '%PDF-') {
      emit('templateSaved', { success: false, error: true, message: 'Invalid PDF file' });
      return;
    }

    const naturalWidth = pdfNaturalDimensions.value.width;
    const naturalHeight = pdfNaturalDimensions.value.height;

    // Group fields by page and build pixel coordinates for composite generation
    const fieldsByPage: { [key: number]: FieldInstance[] } = {};
    (props.placedFields as FieldInstance[]).forEach((field) => {
      const pageNum = field.pageNumber || 1;
      if (!fieldsByPage[pageNum])
        fieldsByPage[pageNum] = [];
      fieldsByPage[pageNum].push({
        ...field,
        x: (field.normalizedX || 0) * naturalWidth,
        y: (field.normalizedY || 0) * naturalHeight,
        width: (field.normalizedWidth || 0) * naturalWidth,
        height: (field.normalizedHeight || 0) * naturalHeight,
      });
    });

    // Generate composite PDF
    const { generateCompositePdf } = usePdfOperations();
    let compositePdfBytes = bytesToUse;
    for (const [pageNum, pageFields] of Object.entries(fieldsByPage)) {
      compositePdfBytes = await generateCompositePdf(compositePdfBytes, pageFields, Number.parseInt(pageNum));
    }
    if (!compositePdfBytes) {
      emit('templateSaved', { success: false, error: true, message: 'Failed to generate composite PDF' });
      return;
    }

    // Validate and build normalized fields payload
    const normalizedFields: any[] = [];
    for (const field of props.placedFields as FieldInstance[]) {
      const validation = validateNormalizedField(field);
      if (!validation.valid)
        continue;
      const rawThickness = (field as any).strikeLineThickness ?? (field as any).strike_line_thickness;
      const strikeThickness = Math.min(8, Math.max(0.5, Number(rawThickness) || 1.5));
      normalizedFields.push({
        id: field.id,
        instanceId: field.instanceId,
        instanceNumber: field.instanceNumber,
        normalizedX: Math.max(0, Math.min(1, field.normalizedX || 0)),
        normalizedY: Math.max(0, Math.min(1, field.normalizedY || 0)),
        normalizedWidth: Math.max(0, Math.min(1, field.normalizedWidth || 0)),
        normalizedHeight: Math.max(0, Math.min(1, field.normalizedHeight || 0)),
        type: field.fieldType,
        groupId: field.groupId,
        isGrouped: field.isGrouped,
        groupSize: field.groupSize,
        groupPosition: field.groupPosition,
        pageNumber: field.pageNumber || 1,
        label: field.label?.substring(0, 255) || '',
        fontSize: Math.max(8, Math.min(72, field.fontSize || 14)),
        fontFamily: field.fontFamily || 'Arial',
        strikeThroughGroupMode: Boolean((field as any).strikeThroughGroupMode ?? (field as any).strike_through_group_mode ?? false),
        strikeLineThickness: strikeThickness,
      });
    }

    if (normalizedFields.length === 0) {
      emit('templateSaved', { success: false, error: true, message: 'No valid fields to save' });
      return;
    }

    const response = await $fetch(`/api/pdf-templates/${props.templateId}/save`, {
      method: 'POST',
      body: {
        name: props.templateName.trim(),
        compositePdfBytes: Array.from(compositePdfBytes),
        originalCompositeUrl: props.originalCompositeUrl,
        placedFieldsData: normalizedFields,
        documentWidth: Math.round(naturalWidth),
        documentHeight: Math.round(naturalHeight),
      },
    }) as any;

    if (!response?.success) {
      emit('templateSaved', { success: false, error: true, message: response?.error || 'Unknown error' });
      return;
    }

    emit('templateSaved', { success: true, data: response.data });
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit('templateSaved', { success: false, error: true, message });
  }
}

// ─── Auto-calculate normalized coords for fields that lack them ───────────────

watch(
  () => [props.placedFields, pdfLoaded.value, pdfNaturalDimensions.value],
  () => {
    if (!pdfLoaded.value || !pdfNaturalDimensions.value.width)
      return;
    (props.placedFields as FieldInstance[]).forEach((field) => {
      if (field.normalizedX === undefined || field.normalizedY === undefined) {
        const normalized = displayToNormalized(field.x || 50, field.y || 50, field.width || 150, field.height || 40);
        field.normalizedX = normalized.x;
        field.normalizedY = normalized.y;
        field.normalizedWidth = normalized.width;
        field.normalizedHeight = normalized.height;
      }
    });
  },
  { deep: true },
);

watch(() => props.pdfBytes, async (newBytes) => {
  if (newBytes && newBytes.length > 0) {
    cachedPdfBytes.value = newBytes;
    await nextTick();
    await loadPdf();
  }
}, { immediate: true });

watch(() => props.originalPdfBytes, (newBytes) => {
  if (newBytes && newBytes.length > 0) {
    cachedOriginalPdfBytes.value = newBytes;
  }
}, { immediate: true });

watch(currentPage, () => {
  if (pdfLoaded.value)
    renderCurrentPage();
});

onMounted(() => {
  window.addEventListener('resize', updateCanvasSize);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize);
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
});

defineExpose({
  saveTemplate,
  normalizedToDisplay,
  displayToNormalized,
  getPdfBounds,
  pdfNaturalDimensions,
  pdfCanvas,
  cachedPdfBytes,
  cachedOriginalPdfBytes,
});
</script>

<template>
  <div class="w-full h-full flex flex-col">
    <!-- Canvas Area – Scrollable -->
    <div class="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center items-start">
      <div
        id="pdf-preview-container"
        ref="previewContainer"
        class="preview-area"
      >
        <!-- Scale wrapper: scales PDF and fields together via CSS transform -->
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
          <!-- PDF Page -->
          <div ref="pdfPageContainer" class="pdf-container">
            <div v-if="!pdfLoaded" class="absolute inset-0 flex flex-col items-center justify-center bg-white rounded border border-gray-200">
              <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 mb-3" />
              <p class="text-sm text-gray-500">
                Loading PDF...
              </p>
            </div>

            <canvas
              v-show="pdfLoaded"
              ref="pdfCanvas"
              class="pdf-canvas"
            />

            <!-- Placed Fields Overlay (inside pdf-container so position: absolute aligns with canvas) -->
            <div
              v-for="field in fieldsWithDisplayCoords"
              :key="field.instanceId"
              class="placed-field"
              :class="{ 'field-selected': selectedField?.instanceId === field.instanceId }"
              :style="{
                left: `${field.displayX}px`,
                top: `${field.displayY}px`,
                width: `${field.displayWidth}px`,
                height: `${field.displayHeight}px`,
                fontSize: `${field.fontSize || 14}px`,
                fontFamily: field.fontFamily || 'Arial',
                fontWeight: field.fontWeight || 'normal',
                fontStyle: field.fontStyle || 'normal',
                textDecoration: field.textDecoration || 'none',
                fontKerning: 'none',
                justifyContent: field.textAlign === 'right' ? 'flex-end' : field.textAlign === 'center' ? 'center' : 'flex-start',
                letterSpacing: supportsLetterSpacing(field) && field.letterSpacing ? `${field.letterSpacing}px` : undefined,
                lineHeight: field.lineHeight ?? 1.5,
                zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 1,
              }"
              @mousedown="startDrag($event, field)"
              @touchstart="startDrag($event, field)"
              @click="selectField(field)"
            >
              <div
                v-if="hasVisibilityRule(field)"
                class="condition-tag"
                :class="{ 'condition-tag--stacked': isCheckboxField(field) }"
                :title="getVisibilityBadgeTitle(field)"
              >
                {{ getVisibilityConditionText(field) }}
              </div>

              <div
                v-if="isCheckboxField(field)"
                class="checkbox-tag"
                :class="{ 'checkbox-tag--stacked': hasVisibilityRule(field) }"
                :title="getCheckboxBadgeText(field)"
              >
                {{ getCheckboxBadgeText(field) }}
              </div>

              <div class="field-content">
                <template v-if="isCheckboxField(field)">
                  <!-- Keep checkbox box visually empty in builder preview -->
                </template>
                <template v-else>
                  <span v-if="field.label">{{ field.label }}</span>
                  <span
                    v-if="field.isGrouped && !isStrikeThroughGroupField(field)"
                    class="instance-num"
                  >#{{ field.instanceNumber }}</span>
                </template>
              </div>

              <!-- Resize handles (only when selected) -->
              <div
                v-if="selectedField?.instanceId === field.instanceId"
                class="resize-handle resize-handle-right"
                @mousedown.stop.prevent="startResize($event, field, 'right')"
              />
              <div
                v-if="selectedField?.instanceId === field.instanceId"
                class="resize-handle resize-handle-bottom"
                @mousedown.stop.prevent="startResize($event, field, 'bottom')"
              />
              <div
                v-if="selectedField?.instanceId === field.instanceId"
                class="resize-handle resize-handle-corner"
                @mousedown.stop.prevent="startResize($event, field, 'corner')"
              />
            </div>
          </div>
        </div>
        <!-- End of scale wrapper -->

        <!-- Page Selector -->
        <div v-if="pdfLoaded && totalPages > 1" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-md px-4 py-2 flex items-center gap-2 border border-gray-200">
          <label class="text-xs font-semibold text-gray-600">Page</label>
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
    10px 0,
    10px -10px,
    0 -10px;
  background-color: #f0f0f0;
  min-height: 400px;
  margin: 0 auto;
  width: 100%;
  max-width: 100%;
}

/* Scale wrapper for CSS transform zoom */
.pdf-scale-wrapper {
  position: relative;
  transform-origin: top left;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
  display: block;
  width: fit-content;
}

.pdf-container {
  position: relative;
  display: flex;
  justify-content: flex-start;
}

.pdf-canvas {
  /* Fixed dimensions - do NOT use max-width: 100% */
  /* Canvas buffer size is the source of truth for coordinate conversion */
  display: block;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
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
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}

.placed-field * {
  user-select: none;
  pointer-events: none;
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

.condition-tag--stacked {
  top: -8px;
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

.checkbox-tag--stacked {
  top: -22px;
}

.placed-field:hover {
  background: rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.placed-field:active {
  cursor: grabbing;
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
  width: 100%;
  height: 100%;
  padding: 2px 5px;
}

.field-content span {
  font-size: 0.75rem;
  font-weight: bold;
  word-break: break-all;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  min-width: 0;
  flex: 1 1 auto;
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
  z-index: 10;
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
