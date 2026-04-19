<script setup lang="ts">
type Field = any;
type RenderTask = any;
type PDFDocumentProxy = any;
type PDFJSType = any;

const props = defineProps({
  /** URL of the PDF document to render */
  pdfUrl: { type: String, required: true },
  /** Array of placed field instances with normalized coordinates */
  placedFields: { type: Array as () => Field[], default: () => [] },
  /** When set, show a button to open this URL in a new tab (e.g. signed PDF link) */
  openInNewTabUrl: { type: String, default: null },
  /** Label for the open-in-new-tab button */
  openInNewTabLabel: { type: String, default: '' },
  /** Highlight specific field on preview by instanceId */
  highlightedFieldInstanceId: { type: String, default: '' },
  /** Enable field click interactions on preview */
  interactiveFields: { type: Boolean, default: false },
});

const emit = defineEmits<{
  fieldClicked: [instanceId: string];
}>();

const { t } = useI18n();

// --- Refs ---
const viewerArea = ref<HTMLDivElement | null>(null);
const pdfCanvas = ref<HTMLCanvasElement | null>(null);
const containerWidth = ref(0);

const pdfLoaded = ref(false);
const loadError = ref<string | null>(null);
const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);
const pdfjsLib = shallowRef<PDFJSType | null>(null);
const totalPages = ref(1);
const currentPage = ref(1);
const renderScale = ref(1.5); // Internal canvas render resolution
const pdfNaturalDimensions = ref({ width: 0, height: 0 });
const renderTask = shallowRef<RenderTask | null>(null);
const isRendering = ref(false);

const resolvedOpenInNewTabLabel = computed(() => props.openInNewTabLabel || t('adminTemplates.shared.pdfPreview.openInNewTab'));

// Zoom
const uiScale = ref(1);
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

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

// --- Coordinate Conversion ---
// Maps normalized (0-1) coords to the fit-to-width display size
function normalizedToDisplay(
  normX: number,
  normY: number,
  normWidth: number,
  normHeight: number,
) {
  const dw = displayWidth.value;
  const dh = displayHeight.value;
  if (!dw || !dh) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: normX * dw,
    y: normY * dh,
    width: normWidth * dw,
    height: normHeight * dh,
  };
}

// --- Computed ---
// Canvas CSS display size: scaled to fill the container width
const canvasDisplayStyle = computed(() => ({
  width: `${displayWidth.value}px`,
  height: `${displayHeight.value}px`,
}));

// Scaled wrapper dimensions for proper scrollbar behavior when zoomed
const scaledDimensions = computed(() => {
  const dw = displayWidth.value;
  const dh = displayHeight.value;
  if (!dw || !dh) {
    return { width: 0, height: 0 };
  }
  return {
    width: dw * uiScale.value,
    height: dh * uiScale.value,
  };
});

const fieldsWithDisplayCoords = computed(() => {
  return props.placedFields
    .filter((field: Field) => !field.pageNumber || field.pageNumber === currentPage.value)
    .map((field: Field) => {
      if (field.normalizedX !== undefined) {
        const display = normalizedToDisplay(
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

// --- PDF Loading ---
async function initPdfJs(): Promise<PDFJSType> {
  if (pdfjsLib.value)
    return pdfjsLib.value;

  try {
    const pdfjs = await import('pdfjs-dist');
    if (import.meta.client) {
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      (pdfjs as any).GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    }
    pdfjsLib.value = pdfjs as PDFJSType;
    return pdfjs as PDFJSType;
  }
  catch (err) {
    console.error('Error loading PDF.js:', err);
    throw new Error(t('adminTemplates.shared.pdfPreview.failedToLoadPdfLibrary'));
  }
}

async function loadPdf(): Promise<void> {
  if (!props.pdfUrl)
    return;

  try {
    pdfLoaded.value = false;
    loadError.value = null;

    const pdfjs = await initPdfJs();
    const loadingTask = (pdfjs as any).getDocument({
      url: props.pdfUrl,
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
    }, 100);
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error loading PDF:', err);
    loadError.value = message;
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
    catch {
      // Ignore cancellation errors
    }
    renderTask.value = null;
  }

  if (isRendering.value)
    return;

  try {
    isRendering.value = true;
    const page = await (pdfDoc.value as any).getPage(currentPage.value);
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Failed to get canvas context');

    const viewport = page.getViewport({ scale: renderScale.value });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    context.clearRect(0, 0, canvas.width, canvas.height);

    renderTask.value = page.render({ canvasContext: context, viewport });
    await (renderTask.value as any).promise;
    renderTask.value = null;
  }
  catch (err: unknown) {
    const e = err as any;
    if (e?.name === 'RenderingCancelledException') {
      console.warn('PDF rendering was cancelled');
    }
    else {
      console.error('Error rendering PDF:', err);
    }
  }
  finally {
    isRendering.value = false;
  }
}

// --- Zoom Controls ---
function zoomIn() {
  uiScale.value = Math.min(MAX_SCALE, uiScale.value + SCALE_STEP);
}

function zoomOut() {
  uiScale.value = Math.max(MIN_SCALE, uiScale.value - SCALE_STEP);
}

function zoomReset() {
  uiScale.value = 1;
}

function openPdfInNewTab() {
  if (props.openInNewTabUrl && typeof window !== 'undefined')
    window.open(props.openInNewTabUrl, '_blank');
}

// --- Page Navigation ---
function prevPage() {
  if (currentPage.value > 1)
    currentPage.value--;
}

function nextPage() {
  if (currentPage.value < totalPages.value)
    currentPage.value++;
}

// --- Watchers ---
watch(
  () => props.pdfUrl,
  async (newUrl: string) => {
    if (newUrl) {
      await nextTick();
      await loadPdf();
    }
  },
  { immediate: true },
);

watch(currentPage, () => {
  if (pdfLoaded.value)
    renderCurrentPage();
});

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

onMounted(() => {
  updateContainerWidth();
  if (viewerArea.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    resizeObserver.observe(viewerArea.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="pdf-preview w-full">
    <!-- Toolbar: Zoom + Page Navigation -->
    <div class="flex items-center gap-4 bg-white rounded-lg border border-gray-200 px-4 py-2 mb-4">
      <!-- Zoom Controls -->
      <span class="text-sm text-gray-600">{{ $t('adminTemplates.shared.pdfPreview.zoom') }}:</span>
      <UButton
        icon="i-heroicons-minus"
        size="xs"
        variant="ghost"
        :disabled="uiScale <= MIN_SCALE"
        @click="zoomOut"
      />
      <span class="text-sm font-medium w-12 text-center">{{ Math.round(uiScale * 100) }}%</span>
      <UButton
        icon="i-heroicons-plus"
        size="xs"
        variant="ghost"
        :disabled="uiScale >= MAX_SCALE"
        @click="zoomIn"
      />
      <UButton size="xs" variant="ghost" @click="zoomReset">
        {{ $t('adminTemplates.shared.pdfPreview.reset') }}
      </UButton>

      <!-- Open in new tab (optional) -->
      <div v-if="openInNewTabUrl" class="ml-auto">
        <UButton
          size="xs"
          icon="i-heroicons-arrow-top-right-on-square"
          variant="soft"
          color="primary"
          @click="openPdfInNewTab"
        >
          {{ resolvedOpenInNewTabLabel }}
        </UButton>
      </div>

      <!-- Divider -->
      <div v-if="pdfLoaded && totalPages > 1" class="w-px h-5 bg-gray-300" />

      <!-- Page Navigation -->
      <template v-if="pdfLoaded && totalPages > 1">
        <UButton
          icon="i-heroicons-chevron-left"
          size="xs"
          variant="ghost"
          :disabled="currentPage <= 1"
          @click="prevPage"
        />
        <span class="text-sm text-gray-600">
          {{ t('adminTemplates.shared.pdfPreview.page') }}
          <select
            v-model="currentPage"
            class="mx-1 px-1 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option v-for="i in totalPages" :key="i" :value="i">
              {{ i }}
            </option>
          </select>
          {{ t('adminTemplates.shared.pdfPreview.of') }} {{ totalPages }}
        </span>
        <UButton
          icon="i-heroicons-chevron-right"
          size="xs"
          variant="ghost"
          :disabled="currentPage >= totalPages"
          @click="nextPage"
        />
      </template>
    </div>

    <!-- PDF Viewer Area -->
    <div ref="viewerArea" class="pdf-viewer-area overflow-auto rounded-lg border border-gray-200 bg-gray-100/50 p-4" style="min-height: 600px;">
      <div class="preview-area">
        <!-- Scale Wrapper -->
        <div
          class="pdf-scale-wrapper"
          :style="{
            transform: `scale(${uiScale})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease-out',
            minWidth: scaledDimensions.width ? `${scaledDimensions.width}px` : 'auto',
            minHeight: scaledDimensions.height ? `${scaledDimensions.height}px` : 'auto',
          }"
        >
          <div class="pdf-container">
            <!-- Loading State -->
            <div v-if="!pdfLoaded && !loadError" class="text-center py-12">
              <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
              <p class="text-gray-500">
                {{ t('adminTemplates.shared.pdfPreview.loadingPdf') }}
              </p>
            </div>

            <!-- Error State -->
            <div v-if="loadError" class="text-center py-12">
              <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4" />
              <p class="text-red-600">
                {{ loadError }}
              </p>
            </div>

            <!-- Canvas: buffer at renderScale for crispness, CSS sized to natural PDF dims -->
            <canvas
              v-show="pdfLoaded"
              ref="pdfCanvas"
              class="pdf-canvas"
              :style="canvasDisplayStyle"
            />

            <!-- Field Overlays (read-only) -->
            <div
              v-for="field in fieldsWithDisplayCoords"
              :key="field.instanceId"
              class="placed-field"
              :class="{
                'signature-field': field.imageUrl || field.type === 'Signature',
                'highlighted-field': String(props.highlightedFieldInstanceId || '').trim() === String(field.instanceId || '').trim(),
              }"
              :style="{
                left: `${field.displayX}px`,
                top: `${field.displayY}px`,
                width: `${field.displayWidth}px`,
                height: `${field.displayHeight}px`,
                fontSize: `${field.fontSize || 14}px`,
                fontFamily: field.fontFamily || 'Arial',
                cursor: props.interactiveFields ? 'pointer' : 'default',
              }"
              @click="props.interactiveFields ? emit('fieldClicked', String(field.instanceId || '')) : undefined"
            >
              <div class="field-content">
                <!-- Signature image overlay when user has confirmed signature -->
                <img
                  v-if="field.imageUrl"
                  :src="field.imageUrl"
                  class="signature-img"
                  :alt="t('adminTemplates.shared.pdfPreview.signatureAlt')"
                >
                <template v-else>
                  <svg
                    v-if="field.name === 'Check Mark'"
                    class="checkbox-mark-svg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 13L9 17L19 7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span
                    v-if="field.label"
                    class="field-value-text"
                    :style="field.textAlign !== 'center' && field.textAlign !== 'right' && Number(field.textIndent ?? 0) > 0
                      ? { textIndent: `${Number(field.textIndent ?? 0)}px` }
                      : undefined"
                  >{{ field.label }}</span>
                  <span v-if="field.isGrouped" class="instance-num">#{{ field.instanceNumber }}</span>
                </template>
              </div>
            </div>
          </div>
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
  display: block;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
}

.placed-field {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.25rem;
  z-index: 100;
  box-sizing: border-box;
  pointer-events: auto;
  cursor: default;
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

.field-value-text {
  display: block;
  width: 100%;
  min-width: 0;
}

.checkbox-mark-svg {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  color: #111827;
  display: block;
}

.instance-num {
  font-size: 0.65rem;
  color: #666;
  background: rgba(255, 255, 255, 0.8);
  padding: 1px 3px;
  border-radius: 2px;
}

.signature-field {
  border: 1.5px dashed #22c55e;
  background: rgba(34, 197, 94, 0.05);
}

.signature-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.highlighted-field {
  border: 2px solid #facc15 !important;
  background: rgba(254, 240, 138, 0.25) !important;
  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.35);
  z-index: 1200;
}
</style>
