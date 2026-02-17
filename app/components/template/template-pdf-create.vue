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
});

const emit = defineEmits<{
  fieldSelected: [field: Field];
  pdfLoaded: [];
  templateSaved: [data: any];
  currentPageChanged: [pageNumber: number];
  fieldUpdated: [data: { instanceId: string; updates: any }];
  fieldRemoved: [instanceId: string];
}>();

const previewContainer = ref<HTMLDivElement | null>(null);
const pdfPageContainer = ref<HTMLDivElement | null>(null);
const pdfCanvas = ref<HTMLCanvasElement | null>(null);

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
}>({
  isDragging: false,
  field: null,
  offsetX: 0,
  offsetY: 0,
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

const placedFieldsOnCurrentPage = computed<Field[]>(() => {
  return (props.placedFields as Field[]).filter(
    (field: Field) => !field.pageNumber || field.pageNumber === currentPage.value,
  );
});

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

    // Update canvas display size after render
    updateCanvasSize();

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

  // Get current canvas position
  const canvasPos = field.normalizedX !== undefined
    ? normalizedToCanvas(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight)
    : { x: field.x || 50, y: field.y || 50 };

  // Mouse coords (screen space) → Canvas coords
  // หาก uiScale เพื่อแปลง screen space → canvas space
  const mouseCanvasX = (coords.clientX - containerRect.left) / uiScale;
  const mouseCanvasY = (coords.clientY - containerRect.top) / uiScale;

  activeDrag.value = {
    isDragging: true,
    field,
    offsetX: mouseCanvasX - canvasPos.x,
    offsetY: mouseCanvasY - canvasPos.y,
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

  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;
  const fieldWidth = (activeDrag.value.field as Field).width || 150;
  const fieldHeight = (activeDrag.value.field as Field).height || 40;

  // ขนาด canvas จริง
  const canvasWidth = pdfCanvas.value.width;
  const canvasHeight = pdfCanvas.value.height;

  activeDrag.value.field!.x = Math.round(newX);
  activeDrag.value.field!.y = Math.round(newY);
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

function startResize(event: any, field: Field, direction: string): void {
  if (!field)
    return;

  event.preventDefault();
  event.stopPropagation();

  // Get current display size from normalized coordinates
  const currentDisplay = field.normalizedWidth !== undefined
    ? normalizedToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight)
    : { width: 150, height: 40 };

  activeResize.value = {
    isResizing: true,
    field,
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

  // Get current canvas position from normalized coordinates
  const canvasPos = field.normalizedX !== undefined
    ? normalizedToCanvas(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight)
    : { x: 50, y: 50 };

  // Canvas coords → Normalized (0-1)
  const normalized = canvasToNormalized(canvasPos.x, canvasPos.y, newWidth, newHeight);

  // Emit event
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

function stopResize(): void {
  if (activeResize.value.isResizing) {
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

function handleFieldUpdate(data: { instanceId: string; updates: any }): void {
  const field = (props.placedFields as Field[]).find(f => f.instanceId === data.instanceId);
  if (field) {
    Object.assign(field, data.updates);
  }
  // Also emit to parent for synchronization
  emit('fieldUpdated', data);
}

function handleFieldRemoval(instanceId: string): void {
  const idx = (props.placedFields as Field[]).findIndex(f => f.instanceId === instanceId);
  if (idx > -1) {
    (props.placedFields as Field[]).splice(idx, 1);
  }
  // Also emit to parent for synchronization
  emit('fieldRemoved', instanceId);
}

// Coordinate conversion helper functions
function normalizedToDisplay(
  normalizedX: number,
  normalizedY: number,
  normalizedWidth: number,
  normalizedHeight: number,
): { x: number; y: number; width: number; height: number } {
  const pdf = pdfNaturalDimensions.value;
  return {
    x: Math.round(normalizedX * pdf.width),
    y: Math.round(normalizedY * pdf.height),
    width: Math.round(normalizedWidth * pdf.width),
    height: Math.round(normalizedHeight * pdf.height),
  };
}

function displayToNormalized(
  displayX: number,
  displayY: number,
  displayWidth: number,
  displayHeight: number,
): { x: number; y: number; width: number; height: number } {
  const pdf = pdfNaturalDimensions.value;
  return {
    x: Math.round((displayX / pdf.width) * 10000) / 10000,
    y: Math.round((displayY / pdf.height) * 10000) / 10000,
    width: Math.round((displayWidth / pdf.width) * 10000) / 10000,
    height: Math.round((displayHeight / pdf.height) * 10000) / 10000,
  };
}

// Create a pdfRef object that provides coordinate conversion methods for child components
const pdfRef = reactive<any>({
  normalizedToDisplay,
  displayToNormalized,
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

    // Auto-calculate normalized coordinates for new fields
    props.placedFields.forEach((field) => {
      if (field.normalizedX === undefined || field.normalizedY === undefined) {
        // Use default display positions if not set (50, 50, 150, 40)
        const defaultX = 50;
        const defaultY = 50;
        const defaultWidth = 150;
        const defaultHeight = 40;

        // Calculate normalized coordinates from default pixel values
        const normalized = displayToNormalized(
          defaultX,
          defaultY,
          defaultWidth,
          defaultHeight,
        );

        // Emit update instead of direct mutation to avoid Vue warnings
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

// Debug: Watch uiScale changes
watch(() => props.uiScale, (_newScale, _oldScale) => {
  // Force canvas size update when scale changes
  nextTick(() => {
    updateCanvasSize();
  });
});

// ========================================
// Pan Scrolling (Drag to Scroll)
// ========================================
function startPan(event) {
  // ไม่ pan ถ้ากำลังลาก field หรือ resize
  if (activeDrag.value.isDragging || activeResize.value.isResizing)
    return;

  // ไม่ pan ถ้าคลิกบน field
  if (event.target.closest('.placed-field'))
    return;

  // ใช้เฉพาะ left click (button 0)
  if (event.button !== 0)
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

function handlePan(event) {
  if (!isPanning.value)
    return;

  const dx = event.clientX - panStart.value.x;
  const dy = event.clientY - panStart.value.y;

  previewContainer.value.scrollLeft = panStart.value.scrollLeft - dx;
  previewContainer.value.scrollTop = panStart.value.scrollTop - dy;
}

function stopPan() {
  isPanning.value = false;
}

// Update canvas display size for reactivity
function updateCanvasSize() {
  if (pdfCanvas.value) {
    const rect = pdfCanvas.value.getBoundingClientRect();
    canvasDisplaySize.value = { width: rect.width, height: rect.height };
  }
}

// Lifecycle
onMounted(() => {
  loadPdf();

  // Add window resize listener to update canvas size
  window.addEventListener('resize', updateCanvasSize);

  // Add pan scrolling listeners
  if (previewContainer.value) {
    previewContainer.value.addEventListener('mousedown', startPan);
    document.addEventListener('mousemove', handlePan);
    document.addEventListener('mouseup', stopPan);
    document.addEventListener('mouseleave', stopPan);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize);
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
defineExpose({
  displayToNormalized,
  normalizedToDisplay,
  getPdfBounds,
  pdfNaturalDimensions,
  pdfCanvas,
  saveTemplate,
});

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
}>({
  saveTemplate,
  normalizedToDisplay,
  displayToNormalized,
});
</script>

<template>
  <div class="card flex flex-col h-full">
    <!-- Field Toolbar - Fixed at Top -->
    <field-toolbar
      v-if="selectedField"
      :selected-field="selectedField"
      :pdf-ref="pdfRef"
      :scale="scale"
      @field-updated="handleFieldUpdate"
      @field-removed="handleFieldRemoval"
    />

    <!-- Canvas Area - Scrollable Below Toolbar -->
    <div class="card-body p-3 flex-1 overflow-auto">
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
            />

            <!-- Fields อยู่ใน pdf-container เดียวกับ canvas เพื่อให้ position: absolute ทำงานถูกต้อง -->
            <div
              v-for="field in fieldsWithDisplayCoords"
              :key="field.instanceId"
              class="placed-field"
              :class="{
                'field-selected': selectedField?.instanceId === field.instanceId && !props.readOnly,
                'read-only': props.readOnly,
              }"
              :style="{
                left: `${field.displayX}px`,
                top: `${field.displayY}px`,
                width: `${field.displayWidth}px`,
                height: `${field.displayHeight}px`,
                zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 100,
                fontSize: `${field.fontSize || 14}px`,
                fontFamily: field.fontFamily || 'Arial',
                cursor: props.readOnly ? 'default' : 'grab',
              }"
              @mousedown.stop.prevent="!props.readOnly && startDrag($event, field)"
              @touchstart.stop.prevent="!props.readOnly && startDrag($event, field)"
              @click.stop="!props.readOnly && selectField(field)"
            >
              <div class="field-content">
                <i v-if="field.name === 'Check Mark'" :class="field.icon" />
                <span v-if="field.label">{{ field.label }}</span>
                <span v-if="field.isGrouped" class="instance-num">#{{ field.instanceNumber }}</span>
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
      </div>

      <!-- Page Selector ด้านล่าง -->
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
</template>

<style scoped>
.card {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.card-body {
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.card-header {
  background: #007bff;
  border-bottom: none;
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #ffffff;
  font-size: 0.9rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 10;
}

.preview-area {
  position: relative;
  background:
    linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  min-height: 500px;
  margin: 0 auto;
  width: 100%;
  padding: 2rem;
  overflow: auto;
  max-height: calc(100vh - 300px);
  cursor: grab;
  user-select: none;
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
  display: inline-block;
}

.pdf-container {
  position: relative;
  width: fit-content;
}

.pdf-canvas {
  display: block;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
  max-width: none;
  height: auto;
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

.page-selector {
  text-align: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.page-selector label {
  margin: 0;
  font-size: 0.875rem;
  color: #495057;
}

.page-selector select {
  cursor: pointer;
}
</style>
