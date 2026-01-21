<script setup>
// const supabase = useSupabaseClient(); // Temporarily disabled

const props = defineProps({
  pdfFile: { type: File, default: null },
  placedFields: { type: Array, default: () => [] },
  selectedField: { type: Object, default: null },
  newTemplateName: { type: String, default: '' },
  selectedContractId: { type: [String, Number], default: null },
});

const emit = defineEmits([
  'fieldSelected',
  'pdfLoaded',
  'templateSaved',
  'currentPageChanged',
]);

const previewContainer = ref(null);
const pdfPageContainer = ref(null);
const pdfCanvas = ref(null);

const pdfLoaded = ref(false);
const pdfDoc = shallowRef(null);
const pdfjsLib = shallowRef(null);
const totalPages = ref(1);
const currentPage = ref(1);
const pdfBytes = ref(null);
const scale = ref(1.5);
const pdfNaturalDimensions = ref({ width: 0, height: 0 });
const renderTask = shallowRef(null);
const isRendering = ref(false);

const activeDrag = ref({
  isDragging: false,
  field: null,
  offsetX: 0,
  offsetY: 0,
});
const activeResize = ref({
  isResizing: false,
  field: null,
  direction: null,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0,
});

const placedFieldsOnCurrentPage = computed(() => {
  return props.placedFields.filter(
    field => !field.pageNumber || field.pageNumber === currentPage.value,
  );
});

async function initPdfJs() {
  if (pdfjsLib.value)
    return pdfjsLib.value;

  try {
    const pdfjs = await import('pdfjs-dist');
    if (import.meta.client) {
      // Use local worker from node_modules instead of CDN
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    }
    pdfjsLib.value = pdfjs;
    return pdfjs;
  }
  catch (error) {
    console.error('Error loading PDF.js:', error);
    throw new Error('Failed to load PDF library');
  }
}

function getPdfBounds() {
  if (!pdfCanvas.value) {
    return {
      displayWidth: 0,
      displayHeight: 0,
      naturalWidth: 0,
      naturalHeight: 0,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const canvas = pdfCanvas.value;
  const canvasRect = canvas.getBoundingClientRect();
  const displayWidth = canvasRect.width;
  const displayHeight = canvasRect.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;
  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;

  return {
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight,
    scaleX,
    scaleY,
  };
}

async function loadPdf() {
  if (!props.pdfFile)
    return;

  try {
    pdfLoaded.value = false;
    if (!pdfPageContainer.value)
      throw new Error('PDF container not found');

    const arrayBuffer = await props.pdfFile.arrayBuffer();
    pdfBytes.value = new Uint8Array(arrayBuffer);

    const pdfjs = await initPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: pdfBytes.value,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });

    const loadedDoc = await loadingTask.promise;
    pdfDoc.value = loadedDoc;
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
  catch (error) {
    console.error('Error loading PDF:', error);
    console.error(`Error loading PDF: ${error.message}`);
    pdfLoaded.value = false;
  }
}

async function renderCurrentPage() {
  if (!pdfDoc.value || !pdfCanvas.value)
    return;

  // Cancel any ongoing render operation
  if (renderTask.value) {
    try {
      await renderTask.value.cancel();
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
    const page = await pdfDoc.value.getPage(pageNumber);
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: scale.value });

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Store render task for potential cancellation
    renderTask.value = page.render({ canvasContext: context, viewport });
    await renderTask.value.promise;
    renderTask.value = null;

    emit('currentPageChanged', pageNumber);
  }
  catch (error) {
    if (error.name === 'RenderingCancelledException') {
      console.warn('PDF rendering was cancelled');
    }
    else {
      console.error('Error rendering PDF:', error);
      console.error(`Error rendering PDF: ${error.message}`);
    }
  }
  finally {
    isRendering.value = false;
  }
}

function selectField(field) {
  emit('fieldSelected', field);
}

function getEventCoordinates(event) {
  if (event.touches && event.touches.length > 0) {
    return {
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY,
    };
  }
  return { clientX: event.clientX, clientY: event.clientY };
}

function startDrag(event, field) {
  if (!previewContainer.value || !field)
    return;

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();

  activeDrag.value = {
    isDragging: true,
    field,
    offsetX: coords.clientX - containerRect.left - field.x,
    offsetY: coords.clientY - containerRect.top - field.y,
  };

  emit('fieldSelected', field);
  event.preventDefault();
  event.stopPropagation();

  document.addEventListener('mousemove', drag, { passive: false });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', stopDrag);
}

function drag(event) {
  if (
    !activeDrag.value.isDragging
    || !activeDrag.value.field
    || !previewContainer.value
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();

  let newX = coords.clientX - containerRect.left - activeDrag.value.offsetX;
  let newY = coords.clientY - containerRect.top - activeDrag.value.offsetY;

  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;
  const fieldWidth = activeDrag.value.field.width || 150;
  const fieldHeight = activeDrag.value.field.height || 40;

  newX = Math.max(0, Math.min(newX, containerWidth - fieldWidth));
  newY = Math.max(0, Math.min(newY, containerHeight - fieldHeight));

  activeDrag.value.field.x = Math.round(newX);
  activeDrag.value.field.y = Math.round(newY);
}

function stopDrag() {
  if (activeDrag.value.isDragging) {
    activeDrag.value.isDragging = false;
    activeDrag.value.field = null;

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
  }
}

function startResize(event, field, direction) {
  if (!field)
    return;

  event.preventDefault();
  event.stopPropagation();

  activeResize.value = {
    isResizing: true,
    field,
    direction,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: field.width,
    startHeight: field.height,
  };

  emit('fieldSelected', field);

  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
}

function handleResize(event) {
  if (!activeResize.value.isResizing || !activeResize.value.field)
    return;

  event.preventDefault();

  const deltaX = event.clientX - activeResize.value.startX;
  const deltaY = event.clientY - activeResize.value.startY;

  const field = activeResize.value.field;
  const direction = activeResize.value.direction;

  if (direction === 'right' || direction === 'corner') {
    field.width = Math.max(20, activeResize.value.startWidth + deltaX);
  }

  if (direction === 'bottom' || direction === 'corner') {
    field.height = Math.max(20, activeResize.value.startHeight + deltaY);
  }
}

function stopResize() {
  if (activeResize.value.isResizing) {
    activeResize.value.isResizing = false;
    activeResize.value.field = null;

    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
}

async function saveImagesToStorage(templateName, _compositePdfBytes) {
  // Temporarily disabled - return mock URLs
  console.warn('Storage upload disabled - using mock URLs');

  const timestamp = Date.now();
  const fileExtension = props.pdfFile.name.split('.').pop();
  const originalFileName = `${templateName}_${timestamp}.${fileExtension}`;
  const compositeFileName = `${templateName}_${timestamp}_composite.pdf`;

  return {
    originalImageUrl: `https://example.com/templates/${originalFileName}`,
    compositeImageUrl: `https://example.com/composites/${compositeFileName}`,
  };

  /*
  const originalFilePath = `templates/${originalFileName}`;

  const { error: uploadError1 } = await supabase.storage
    .from("contract")
    .upload(originalFilePath, props.pdfFile, {
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError1)
    throw new Error("Error uploading original PDF: " + uploadError1.message);

  const { data: publicUrlData1 } = supabase.storage
    .from("contract")
    .getPublicUrl(originalFilePath);

  const compositeFilePath = `composites/${compositeFileName}`;
  const compositeBlob = new Blob([compositePdfBytes], {
    type: "application/pdf",
  });

  const { error: uploadError2 } = await supabase.storage
    .from("contract")
    .upload(compositeFilePath, compositeBlob, {
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError2)
    throw new Error("Error uploading composite PDF: " + uploadError2.message);

  const { data: publicUrlData2 } = supabase.storage
    .from("contract")
    .getPublicUrl(compositeFilePath);

  return {
    originalImageUrl: publicUrlData1.publicUrl,
    compositeImageUrl: publicUrlData2.publicUrl,
  };
  */
}

async function saveTemplate() {
  try {
    if (!props.pdfFile) {
      console.error('Please upload a PDF file first');
      return;
    }

    if (props.placedFields.length === 0) {
      console.error('Please add at least one field');
      return;
    }

    const templateName = props.newTemplateName;
    if (!templateName?.trim()) {
      console.error('Please enter a template name');
      return;
    }

    if (!props.selectedContractId) {
      console.error('Please select a contract');
      return;
    }

    if (!pdfBytes.value || pdfBytes.value.length === 0) {
      const arrayBuffer = await props.pdfFile.arrayBuffer();
      pdfBytes.value = new Uint8Array(arrayBuffer);
    }

    const header = String.fromCharCode.apply(null, pdfBytes.value.slice(0, 5));
    if (header !== '%PDF-') {
      console.error('Invalid PDF file');
      return;
    }

    const bounds = getPdfBounds();
    const transformedFields = props.placedFields
      .filter(
        field => !field.pageNumber || field.pageNumber === currentPage.value,
      )
      .map(field => ({
        ...field,
        x: field.x * bounds.scaleX,
        y: field.y * bounds.scaleY,
        width: field.width * bounds.scaleX,
        height: field.height * bounds.scaleY,
      }));

    const { generateCompositePdf } = usePdfOperations();
    const compositePdfBytes = await generateCompositePdf(
      pdfBytes.value,
      transformedFields,
      currentPage.value,
    );

    if (!compositePdfBytes) {
      console.error('Failed to generate composite PDF');
      return;
    }

    const { originalImageUrl, compositeImageUrl } = await saveImagesToStorage(
      templateName,
      compositePdfBytes,
    );

    const normalizedFields = props.placedFields.map(field => ({
      id: field.id,
      instanceId: field.instanceId,
      instanceNumber: field.instanceNumber,
      x: Math.round(field.x),
      y: Math.round(field.y),
      width: Math.round(field.width),
      height: Math.round(field.height),
      type: field.type,
      groupId: field.groupId,
      isGrouped: field.isGrouped,
      groupSize: field.groupSize,
      groupPosition: field.groupPosition,
      pageNumber: field.pageNumber || currentPage.value,
    }));

    const templateData = {
      name: templateName.trim(),
      contract_id: props.selectedContractId,
      background_image_url: originalImageUrl,
      composite_image_url: compositeImageUrl,
      image_width: Math.round(pdfNaturalDimensions.value.width),
      image_height: Math.round(pdfNaturalDimensions.value.height),
      placed_fields_data: normalizedFields,
      created_at: new Date().toISOString(),
    };

    // Temporarily disabled - skip database insert
    console.warn('Database insert disabled - template data:', templateData);
    console.warn('Template saved successfully! (Mock mode - no database)');
    emit('templateSaved', { id: Date.now(), ...templateData });

    /*
    const { data, error } = await supabase
      .from("contract_templates")
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      alert("Error saving template: " + error.message);
      return;
    }

    alert("Template saved successfully!");
    emit("template-saved", data);
    */
  }
  catch (error) {
    console.error('Save error:', error);
    console.error(`Error saving template: ${error.message}`);
  }
}

watch(
  () => props.pdfFile,
  async (newFile) => {
    if (newFile) {
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

onUnmounted(() => {
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
});
</script>

<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <span>Preview</span>
      <button class="btn btn-success btn-sm" @click="saveTemplate">
        <i class="fas fa-save" /> Save Template
      </button>
    </div>
    <div class="card-body p-3">
      <div
        id="pdf-preview-container"
        ref="previewContainer"
        class="preview-area"
        @mouseup="stopDrag"
        @mousemove="drag"
        @mouseleave="stopDrag"
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
        </div>

        <div
          v-for="field in placedFieldsOnCurrentPage"
          :key="field.instanceId"
          class="placed-field"
          :class="{
            'field-selected': selectedField?.instanceId === field.instanceId,
          }"
          :style="{
            left: `${field.x}px`,
            top: `${field.y}px`,
            width: `${field.width}px`,
            height: `${field.height}px`,
            fontSize: `${field.fontSize || 14}px`,
            fontFamily: field.fontFamily || 'Arial',
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

          <!-- Resize handles -->
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
}

.card-header .btn-success {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
}

.preview-area {
  position: relative;
  background:
    linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  min-height: 400px;
  margin: 0 auto;
  width: 55vw;
  max-width: 800px;
}

.pdf-container {
  position: relative;
  width: 100%;
  margin: 0 auto;
}

.pdf-canvas {
  width: 100%;
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
}

.placed-field:hover {
  background: rgba(255, 255, 255, 0.4);
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
