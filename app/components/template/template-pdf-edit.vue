<script setup lang="ts">
import type { FieldInstance, PdfDimensions } from '~/types/template';

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
}>({
  isDragging: false,
  field: null,
  offsetX: 0,
  offsetY: 0,
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
  const rect = canvas.getBoundingClientRect();
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;
  return {
    displayWidth: rect.width,
    displayHeight: rect.height,
    naturalWidth,
    naturalHeight,
    scaleX: naturalWidth / rect.width,
    scaleY: naturalHeight / rect.height,
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

const placedFieldsOnCurrentPage = computed<FieldInstance[]>(() => {
  return (props.placedFields as FieldInstance[]).filter(
    field => !field.pageNumber || field.pageNumber === currentPage.value,
  );
});

// Converts normalized coords → display coords for rendering
const fieldsWithDisplayCoords = computed<FieldInstance[]>(() => {
  const _scale = scale.value;
  const _canvas = pdfCanvas.value;
  const _dims = pdfNaturalDimensions.value;
  const _canvasSize = canvasDisplaySize.value;

  if (!_canvas || !_dims.width)
    return [];

  return placedFieldsOnCurrentPage.value.map((field) => {
    if (
      field.normalizedX !== undefined
      && field.normalizedY !== undefined
      && field.normalizedWidth !== undefined
      && field.normalizedHeight !== undefined
    ) {
      const d = normalizedToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight);
      return { ...field, displayX: d.x, displayY: d.y, displayWidth: d.width, displayHeight: d.height };
    }
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

  activeDrag.value = {
    isDragging: true,
    field,
    offsetX: coords.clientX - containerRect.left - (field.x || 50),
    offsetY: coords.clientY - containerRect.top - (field.y || 50),
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
  if (!activeDrag.value.isDragging || !activeDrag.value.field || !previewContainer.value)
    return;
  event.preventDefault();
  event.stopPropagation();

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();

  let newX = coords.clientX - containerRect.left - activeDrag.value.offsetX;
  let newY = coords.clientY - containerRect.top - activeDrag.value.offsetY;

  const field = activeDrag.value.field;
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;
  const fieldWidth = field.width || 150;
  const fieldHeight = field.height || 40;

  newX = Math.max(0, Math.min(newX, containerWidth - fieldWidth));
  newY = Math.max(0, Math.min(newY, containerHeight - fieldHeight));

  field.x = Math.round(newX);
  field.y = Math.round(newY);
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

  const deltaX = event.clientX - activeResize.value.startX;
  const deltaY = event.clientY - activeResize.value.startY;
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
    const bytesToUse = props.originalPdfBytes || props.pdfBytes;

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

// ─── Toolbar Handlers ─────────────────────────────────────────────────────────

function handleFieldUpdate(data: { instanceId: string; updates: any }): void {
  const field = (props.placedFields as FieldInstance[]).find(f => f.instanceId === data.instanceId);
  if (field)
    Object.assign(field, data.updates);
  emit('fieldUpdated', data);
}

function handleFieldRemoval(instanceId: string): void {
  const idx = (props.placedFields as FieldInstance[]).findIndex(f => f.instanceId === instanceId);
  if (idx > -1)
    (props.placedFields as FieldInstance[]).splice(idx, 1);
  emit('fieldRemoved', instanceId);
}

// Expose pdfRef for toolbar and parent keyboard handler
const pdfRef = reactive<any>({
  normalizedToDisplay,
  displayToNormalized,
  saveTemplate,
  pdfNaturalDimensions,
});

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
    await nextTick();
    await loadPdf();
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
});
</script>

<template>
  <div class="card flex flex-col h-full">
    <!-- Field Toolbar – Fixed at Top when a field is selected -->
    <field-toolbar
      v-if="selectedField"
      :selected-field="selectedField"
      :pdf-ref="pdfRef"
      :scale="scale"
      @field-updated="handleFieldUpdate"
      @field-removed="handleFieldRemoval"
    />

    <!-- Canvas Area – Scrollable -->
    <div class="card-body p-3 flex-1 overflow-auto">
      <div
        id="pdf-preview-container"
        ref="previewContainer"
        class="preview-area"
      >
        <!-- PDF Page -->
        <div ref="pdfPageContainer" class="pdf-container">
          <div v-if="!pdfLoaded" class="text-center py-5">
            <i class="fas fa-file-pdf fa-3x text-muted mb-3" />
            <p class="text-muted mb-0">
              Loading PDF...
            </p>
          </div>

          <canvas
            v-show="pdfLoaded"
            ref="pdfCanvas"
            class="pdf-canvas"
          />
        </div>

        <!-- Placed Fields Overlay -->
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
            zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 1,
          }"
          @mousedown="startDrag($event, field)"
          @touchstart="startDrag($event, field)"
          @click="selectField(field)"
        >
          <div class="field-content">
            <i v-if="field.name === 'Check Mark'" :class="field.icon" />
            <span v-if="field.label">{{ field.label }}</span>
            <span v-if="field.isGrouped" class="instance-num">#{{ field.instanceNumber }}</span>
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

        <!-- Page Selector -->
        <div v-if="pdfLoaded && totalPages > 1" class="page-selector">
          <label class="form-label small mb-1">Page:</label>
          <select
            v-model="currentPage"
            class="form-select form-select-sm"
            @change="renderCurrentPage"
          >
            <option v-for="i in totalPages" :key="i" :value="i">
              Page {{ i }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.preview-area {
  position: relative;
  background:
    linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  min-height: 400px;
  margin: 0 auto;
  width: 100%;
  max-width: 100%;
}

.pdf-container {
  position: relative;
  width: 100%;
  margin: 0 auto;
  max-width: 100%;
  display: flex;
  justify-content: center;
}

.pdf-canvas {
  max-width: 100%;
  height: auto;
  display: block;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
}

.placed-field {
  position: absolute;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
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
  align-items: center;
  gap: 0.25rem;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  width: 100%;
  padding: 2px 5px;
}

.field-content span {
  font-size: 0.75rem;
  font-weight: bold;
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

.page-selector {
  text-align: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  margin-top: 0.5rem;
}
</style>
