<script setup lang="ts">
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
});

const emit = defineEmits<{
  fieldSelected: [field: Field];
  pdfLoaded: [];
  templateSaved: [data: any];
  currentPageChanged: [pageNumber: number];
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
  fieldClicked: [field: Field];
}>();

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

const viewerArea = ref<HTMLDivElement | null>(null);
const previewContainer = ref<HTMLDivElement | null>(null);
const pdfPageContainer = ref<HTMLDivElement | null>(null);
const pdfCanvas = ref<HTMLCanvasElement | null>(null);
const containerWidth = ref(0);

const pdfLoaded = ref(false);
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
  field: Field | null;
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

// Pan scrolling state
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

// ========================================
// Coordinate Conversion Functions (Simplified)
// ใช้ normalized coordinates (0-1) เป็นหลัก
// Note: Uses canvas.width/height (actual rendering dimensions) NOT getBoundingClientRect()
// because getBoundingClientRect() includes CSS transforms, which would cause coordinate
// shifts when zoom (uiScale) changes. The CSS transform handles all visual scaling.
// ========================================

// Helper: Get actual canvas rendering dimensions (NOT affected by CSS transforms)
// IMPORTANT: Uses canvas.width/height directly, not getBoundingClientRect()
function getCanvasRenderingDimensions() {
  if (!pdfCanvas.value) {
    return { width: 0, height: 0 };
  }
  // Use the actual canvas rendering dimensions (set during PDF render)
  // NOT getBoundingClientRect() which includes CSS transforms
  return { width: pdfCanvas.value.width, height: pdfCanvas.value.height };
}

// แปลง canvas pixel coordinates → normalized (0-1)
// Uses actual canvas rendering dimensions (unaffected by CSS zoom transforms)
function canvasToNormalized(x: number, y: number, width: number, height: number) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Use actual canvas rendering dimensions, NOT getBoundingClientRect()
  // This ensures zoom (uiScale) does NOT affect coordinate conversion
  const canvasDims = getCanvasRenderingDimensions();
  const canvasWidth = canvasDims.width;
  const canvasHeight = canvasDims.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  if (!canvasWidth || !canvasHeight) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Canvas pixel → Natural PDF coordinates
  const naturalX = (x / canvasWidth) * naturalWidth;
  const naturalY = (y / canvasHeight) * naturalHeight;
  const naturalW = (width / canvasWidth) * naturalWidth;
  const naturalH = (height / canvasHeight) * naturalHeight;

  // Natural → Normalized (0-1)
  return {
    x: naturalX / naturalWidth,
    y: naturalY / naturalHeight,
    width: naturalW / naturalWidth,
    height: naturalH / naturalHeight,
  };
}

// แปลง normalized (0-1) → canvas pixel coordinates
// Uses actual canvas rendering dimensions (unaffected by CSS zoom transforms)
function normalizedToCanvas(normX: number, normY: number, normWidth: number, normHeight: number) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  // Use actual canvas rendering dimensions, NOT getBoundingClientRect()
  // This ensures zoom (uiScale) does NOT affect coordinate conversion
  const canvasDims = getCanvasRenderingDimensions();
  const canvasWidth = canvasDims.width;
  const canvasHeight = canvasDims.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  if (!canvasWidth || !canvasHeight) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  // Normalized → Natural PDF coordinates
  const naturalX = normX * naturalWidth;
  const naturalY = normY * naturalHeight;
  const naturalW = normWidth * naturalWidth;
  const naturalH = normHeight * naturalHeight;

  // Natural → Canvas pixels
  return {
    x: (naturalX / naturalWidth) * canvasWidth,
    y: (naturalY / naturalHeight) * canvasHeight,
    width: (naturalW / naturalWidth) * canvasWidth,
    height: (naturalH / naturalHeight) * canvasHeight,
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

// Pan scrolling state
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

// ========================================
// Coordinate Conversion Functions (Simplified)
// ใช้ normalized coordinates (0-1) เป็นหลัก
// Note: Uses canvas.width/height (actual rendering dimensions) NOT getBoundingClientRect()
// because getBoundingClientRect() includes CSS transforms, which would cause coordinate
// shifts when zoom (uiScale) changes. The CSS transform handles all visual scaling.
// ========================================

// แปลง canvas pixel coordinates → normalized (0-1)
function canvasToNormalized(x, y, width, height) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  if (!canvasWidth || !canvasHeight) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Canvas pixel → Natural PDF coordinates
  const naturalX = (x / canvasWidth) * naturalWidth;
  const naturalY = (y / canvasHeight) * naturalHeight;
  const naturalW = (width / canvasWidth) * naturalWidth;
  const naturalH = (height / canvasHeight) * naturalHeight;

  // Natural → Normalized (0-1)
  return {
    x: naturalX / naturalWidth,
    y: naturalY / naturalHeight,
    width: naturalW / naturalWidth,
    height: naturalH / naturalHeight,
  };
}

// แปลง normalized (0-1) → canvas pixel coordinates
function normalizedToCanvas(normX, normY, normWidth, normHeight) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  if (!canvasWidth || !canvasHeight) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  // Normalized → Natural PDF coordinates
  const naturalX = normX * naturalWidth;
  const naturalY = normY * naturalHeight;
  const naturalW = normWidth * naturalWidth;
  const naturalH = normHeight * naturalHeight;

  // Natural → Canvas pixels
  return {
    x: (naturalX / naturalWidth) * canvasWidth,
    y: (naturalY / naturalHeight) * canvasHeight,
    width: (naturalW / naturalWidth) * canvasWidth,
    height: (naturalH / naturalHeight) * canvasHeight,
  };
}

// Legacy aliases for backward compatibility
const displayToNormalized = canvasToNormalized;
const normalizedToDisplay = normalizedToCanvas;

// Security: Validate normalized coordinates
function isValidNormalizedCoord(value) {
  return typeof value === 'number'
    && !Number.isNaN(value)
    && Number.isFinite(value)
    && value >= 0
    && value <= 1;
}

function validateNormalizedField(field) {
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

// Pan scrolling state
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

// ========================================
// Coordinate Conversion Functions (Simplified)
// ใช้ normalized coordinates (0-1) เป็นหลัก
// Note: Uses canvas.width/height (actual rendering dimensions) NOT getBoundingClientRect()
// because getBoundingClientRect() includes CSS transforms, which would cause coordinate
// shifts when zoom (uiScale) changes. The CSS transform handles all visual scaling.
// ========================================

// แปลง canvas pixel coordinates → normalized (0-1)
function canvasToNormalized(x, y, width, height) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  if (!canvasWidth || !canvasHeight) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Canvas pixel → Natural PDF coordinates
  const naturalX = (x / canvasWidth) * naturalWidth;
  const naturalY = (y / canvasHeight) * naturalHeight;
  const naturalW = (width / canvasWidth) * naturalWidth;
  const naturalH = (height / canvasHeight) * naturalHeight;

  // Natural → Normalized (0-1)
  return {
    x: naturalX / naturalWidth,
    y: naturalY / naturalHeight,
    width: naturalW / naturalWidth,
    height: naturalH / naturalHeight,
  };
}

// แปลง normalized (0-1) → canvas pixel coordinates
function normalizedToCanvas(normX, normY, normWidth, normHeight) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  if (!canvasWidth || !canvasHeight) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  // Normalized → Natural PDF coordinates
  const naturalX = normX * naturalWidth;
  const naturalY = normY * naturalHeight;
  const naturalW = normWidth * naturalWidth;
  const naturalH = normHeight * naturalHeight;

  // Natural → Canvas pixels
  return {
    x: (naturalX / naturalWidth) * canvasWidth,
    y: (naturalY / naturalHeight) * canvasHeight,
    width: (naturalW / naturalWidth) * canvasWidth,
    height: (naturalH / naturalHeight) * canvasHeight,
  };
}

// Legacy aliases for backward compatibility
const displayToNormalized = canvasToNormalized;
const normalizedToDisplay = normalizedToCanvas;

// Security: Validate normalized coordinates
function isValidNormalizedCoord(value) {
  return typeof value === 'number'
    && !Number.isNaN(value)
    && Number.isFinite(value)
    && value >= 0
    && value <= 1;
}

function validateNormalizedField(field) {
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

// Pan scrolling state
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

// function getPdfBounds() {
//   if (!pdfCanvas.value) {
//     return {
//       displayWidth: 0,
//       displayHeight: 0,
//       naturalWidth: 0,
//       naturalHeight: 0,
//       scaleX: 1,
//       scaleY: 1,
//     };
//   }

//   const canvas = pdfCanvas.value;
//   const canvasRect = canvas.getBoundingClientRect();
//   const displayWidth = canvasRect.width;
//   const displayHeight = canvasRect.height;
//   const naturalWidth = pdfNaturalDimensions.value.width;
//   const naturalHeight = pdfNaturalDimensions.value.height;
//   const scaleX = naturalWidth / displayWidth;
//   const scaleY = naturalHeight / displayHeight;

//   return {
//     displayWidth,
//     displayHeight,
//     naturalWidth,
//     naturalHeight,
//     scaleX,
//     scaleY,
//   };
// }

async function loadPdf(): Promise<void> {
  if (!props.pdfFile)
    return;

  try {
    pdfLoaded.value = false;
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
      emit('pdfLoaded');
    }, 100);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error loading PDF:', error);
    console.error(`Error loading PDF: ${errorMessage}`);
    pdfLoaded.value = false;
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
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Failed to get canvas context');
    const viewport = page.getViewport({ scale: scale.value });

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Store render task for potential cancellation
    renderTask.value = page.render({ canvasContext: context, viewport });
    await (renderTask.value as any).promise;
    renderTask.value = null;

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

function selectField(field: Field): void {
  emit('fieldSelected', field);
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

  // Use displayX/displayY from computed field, or fall back to x/y
  const fieldDisplayX = (field as any).displayX ?? field.x ?? 50;
  const fieldDisplayY = (field as any).displayY ?? field.y ?? 50;

  // Mouse coords (screen space) → Canvas coords
  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  // Find the original field in placedFields to track which one we're dragging
  const originalField = (props.placedFields as Field[]).find((f: Field) => f.instanceId === field.instanceId);

  activeDrag.value = {
    isDragging: true,
    field: originalField || field,
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

  // Mouse coords (screen space) → Canvas coords
  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  const field = activeDrag.value.field;

  // Use fit-to-width display dimensions for bounds (not affected by CSS transform)
  const dw = displayWidth.value || 1;
  const dh = displayHeight.value || 1;

  // Use display dimensions captured at drag start
  const fieldDisplayWidth = activeDrag.value.displayWidth;
  const fieldDisplayHeight = activeDrag.value.displayHeight;

  // Constrain to display bounds
  let newDisplayX = mouseCanvasX - activeDrag.value.offsetX;
  let newDisplayY = mouseCanvasY - activeDrag.value.offsetY;
  newDisplayX = Math.max(0, Math.min(newDisplayX, dw - fieldDisplayWidth));
  newDisplayY = Math.max(0, Math.min(newDisplayY, dh - fieldDisplayHeight));

  // Convert display coordinates back to normalized for storage
  if (field!.normalizedX !== undefined && field!.normalizedWidth !== undefined) {
    const normalized = displayToNorm(newDisplayX, newDisplayY, fieldDisplayWidth, fieldDisplayHeight);
    field!.normalizedX = normalized.x;
    field!.normalizedY = normalized.y;
    field!.normalizedWidth = normalized.width;
    field!.normalizedHeight = normalized.height;
  }
  else {
    field!.x = Math.round(newDisplayX);
    field!.y = Math.round(newDisplayY);
  }
}

function stopDrag(): void {
  if (activeDrag.value.isDragging) {
    const field = activeDrag.value.field;
    // Emit final position to parent for synchronization
    if (field && field.normalizedX !== undefined) {
      emit('fieldUpdated', {
        instanceId: field.instanceId,
        updates: {
          normalizedX: field.normalizedX,
          normalizedY: field.normalizedY,
          normalizedWidth: field.normalizedWidth,
          normalizedHeight: field.normalizedHeight,
        },
      });
    }

    activeDrag.value.isDragging = false;
    activeDrag.value.field = null;

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

  // Get current display size from normalized coordinates
  const currentDisplay = field.normalizedWidth !== undefined
    ? normToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight)
    : { width: 150, height: 40 };

  // Find the original field in placedFields for direct mutation
  const originalField = (props.placedFields as Field[]).find((f: Field) => f.instanceId === field.instanceId);

  activeResize.value = {
    isResizing: true,
    field: originalField || field,
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

  // Convert display coords back to normalized and directly mutate the field
  if (field.normalizedX !== undefined) {
    const currentDisplay = normToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight);
    const normalized = displayToNorm(currentDisplay.x, currentDisplay.y, newWidth, newHeight);
    field.normalizedX = normalized.x;
    field.normalizedY = normalized.y;
    field.normalizedWidth = normalized.width;
    field.normalizedHeight = normalized.height;
  }
  else {
    field.width = Math.round(newWidth);
    field.height = Math.round(newHeight);
  }
}

function stopResize(): void {
  if (activeResize.value.isResizing) {
    const field = activeResize.value.field;
    // Emit final size to parent for synchronization
    if (field && field.normalizedX !== undefined) {
      emit('fieldUpdated', {
        instanceId: field.instanceId,
        updates: {
          normalizedX: field.normalizedX,
          normalizedY: field.normalizedY,
          normalizedWidth: field.normalizedWidth,
          normalizedHeight: field.normalizedHeight,
        },
      });
    }

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
      throw new Error('Please upload a PDF file first');
    }

    if (props.placedFields.length === 0) {
      throw new Error('Please add at least one field');
    }

    const templateName = props.newTemplateName?.trim();
    if (!templateName) {
      throw new Error('Please enter a template name');
    }

    if (!pdfNaturalDimensions.value.width || !pdfNaturalDimensions.value.height) {
      throw new Error('PDF dimensions not loaded');
    }

    // Step 1: Upload PDF file
    const formData = new FormData();
    formData.append('file', props.pdfFile);

    const uploadResponse = await $fetch('/api/upload-template-file', {
      method: 'POST',
      body: formData,
    }) as any;

    if (!uploadResponse.success || !uploadResponse.url) {
      throw new Error('Failed to upload PDF file');
    }

    const documentUrl = uploadResponse.url;

    // Step 2: Normalize field coordinates
    const normalizedFields = (props.placedFields as Field[]).map((field: Field) => ({
      id: field.id,
      instanceId: field.instanceId,
      instanceNumber: field.instanceNumber,
      type: field.type,
      name: field.name,
      label: field.label,
      fontSize: field.fontSize || 14,
      fontFamily: field.fontFamily || 'Arial',
      // Normalize coordinates to 0-1 scale based on PDF dimensions
      normalizedX: Math.round((field.x / pdfNaturalDimensions.value.width) * 10000) / 10000,
      normalizedY: Math.round((field.y / pdfNaturalDimensions.value.height) * 10000) / 10000,
      normalizedWidth: Math.round((field.width / pdfNaturalDimensions.value.width) * 10000) / 10000,
      normalizedHeight: Math.round((field.height / pdfNaturalDimensions.value.height) * 10000) / 10000,
      // Grouping information
      groupId: field.groupId || null,
      isGrouped: field.isGrouped || false,
      groupSize: field.groupSize || 1,
      groupPosition: field.groupPosition || 0,
      // Page information
      pageNumber: field.pageNumber || 1,
    }));

    // Step 3: Prepare template payload
    const templatePayload = {
      name: templateName,
      description: null,
      category: null,
      version: '1.0.0',
      isActive: true,
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
      throw new Error('Failed to save template to database');
    }

    // Step 5: Emit success event
    emit('templateSaved', {
      success: true,
      data: saveResponse.data,
      message: `Template "${templateName}" saved successfully`,
    });
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Save template error:', error);

    // Emit error event
    emit('templateSaved', {
      success: false,
      error: true,
      message: errorMessage || 'Failed to save template',
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
      if (field.normalizedX !== undefined) {
        const display = normToDisplay(
          field.normalizedX,
          field.normalizedY,
          field.normalizedWidth,
          field.normalizedHeight,
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
        displayX: field.x || 50,
        displayY: field.y || 50,
        displayWidth: field.width || 150,
        displayHeight: field.height || 40,
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

    // Auto-calculate normalized coordinates for new fields (direct mutation like edit version)
    (props.placedFields as Field[]).forEach((field) => {
      if (field.normalizedX === undefined || field.normalizedY === undefined) {
        const normalized = displayToNorm(
          field.x || 50,
          field.y || 50,
          field.width || 150,
          field.height || 40,
        );
        field.normalizedX = normalized.x;
        field.normalizedY = normalized.y;
        field.normalizedWidth = normalized.width;
        field.normalizedHeight = normalized.height;
      }
    });
  },
  { deep: true },
);

// ========================================
// Pan Scrolling (Drag to Scroll)
// ========================================
function startPan(event: MouseEvent) {
  // ไม่ pan ถ้ากำลังลาก field หรือ resize
  if (activeDrag.value.isDragging || activeResize.value.isResizing)
    return;

  // ไม่ pan ถ้าคลิกบน field
  if ((event.target as HTMLElement)?.closest('.placed-field'))
    return;

  // ใช้เฉพาะ left click (button 0)
  if (event.button !== 0)
    return;

  if (!previewContainer.value)
    return;

  isPanning.value = true;
  panStart.value = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: previewContainer.value.scrollLeft,
    scrollTop: previewContainer.value.scrollTop,
  };

  event.preventDefault();
}

function handlePan(event: MouseEvent) {
  if (!isPanning.value || !previewContainer.value)
    return;

  const dx = event.clientX - panStart.value.x;
  const dy = event.clientY - panStart.value.y;

  previewContainer.value.scrollLeft = panStart.value.scrollLeft - dx;
  previewContainer.value.scrollTop = panStart.value.scrollTop - dy;
}

function stopPan() {
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
    previewContainer.value.addEventListener('mousedown', startPan);
    document.addEventListener('mousemove', handlePan);
    document.addEventListener('mouseup', stopPan);
    document.addEventListener('mouseleave', stopPan);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();

  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);

  // Remove pan scrolling listeners
  document.removeEventListener('mousemove', handlePan);
  document.removeEventListener('mouseup', stopPan);
  document.removeEventListener('mouseleave', stopPan);
});

// Expose functions and refs for parent component
defineExpose<{
  saveTemplate: () => Promise<void>;
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
  normalizedToDisplay,
  displayToNormalized,
  getPdfNaturalDimensions: () => pdfNaturalDimensions.value,
});
</script>

<template>
  <div class="w-full h-full flex flex-col">
    <!-- Canvas Area – Scrollable -->
    <div ref="viewerArea" class="flex-1 overflow-auto bg-gray-100 p-4">
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
              :style="canvasDisplayStyle"
            />

            <!-- Fields อยู่ใน pdf-container เดียวกับ canvas เพื่อให้ position: absolute ทำงานถูกต้อง -->
            <div
              v-for="field in fieldsWithDisplayCoords"
              :key="field.instanceId"
              class="placed-field"
              :class="{
                'field-selected': selectedField?.instanceId === field.instanceId && !props.readOnly,
                'read-only': props.readOnly && !props.signingSteps.length,
                'field-unassigned': props.signingSteps.length > 0 && !field.signerStepId,
                'field-clickable': props.readOnly && props.signingSteps.length > 0,
              }"
              :style="{
                left: `${field.displayX}px`,
                top: `${field.displayY}px`,
                width: `${field.displayWidth}px`,
                height: `${field.displayHeight}px`,
                zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 100,
                fontSize: `${field.fontSize || 14}px`,
                fontFamily: field.fontFamily || 'Arial',
                cursor: props.readOnly ? (props.signingSteps.length > 0 ? 'pointer' : 'default') : 'grab',
                borderColor: getFieldSignerColor(field) || undefined,
                borderWidth: getFieldSignerColor(field) ? '2px' : undefined,
                borderStyle: getFieldSignerColor(field) ? 'solid' : undefined,
                backgroundColor: getFieldSignerColor(field) ? `${getFieldSignerColor(field)}15` : undefined,
              }"
              @mousedown.stop.prevent="!props.readOnly && startDrag($event, field)"
              @touchstart.stop.prevent="!props.readOnly && startDrag($event, field)"
              @click.stop="props.readOnly && props.signingSteps.length > 0 ? emit('fieldClicked', field) : !props.readOnly && selectField(field)"
            >
              <div class="field-content">
                <i v-if="field.name === 'Check Mark'" :class="field.icon" />
                <span v-if="field.label">{{ field.label }}</span>
                <span v-if="field.isGrouped" class="instance-num">#{{ field.instanceNumber }}</span>
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
              />
              <div
                v-if="selectedField?.instanceId === field.instanceId && !props.readOnly"
                class="resize-handle resize-handle-bottom"
                @mousedown.stop.prevent="startResize($event, field, 'bottom')"
              />
              <div
                v-if="selectedField?.instanceId === field.instanceId && !props.readOnly"
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
}

.pdf-canvas {
  /* Fixed dimensions - do NOT use max-width: 100% */
  display: block;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
  /* Canvas internal resolution used only for rendering */
  /* Displayed size controlled by getBoundingClientRect() in coordinate functions */
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
  z-index: 100;
  box-sizing: border-box;
  transform: translateZ(0);
}

.placed-field:hover {
  background: rgba(255, 255, 255, 0.4);
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
  top: -8px;
  right: -4px;
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
