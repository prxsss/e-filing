<script setup>
const props = defineProps({
  pdfBytes: {
    type: Uint8Array,
    default: null,
  },
  originalPdfBytes: {
    type: Uint8Array,
    default: null,
  },
  placedFields: {
    type: Array,
    default: () => [],
  },
  selectedField: {
    type: Object,
    default: null,
  },
  templateName: {
    type: String,
    default: '',
  },
  selectedContractId: {
    type: [String, Number],
    default: null,
  },
  templateId: {
    type: [String, Number],
    default: null,
  },
  originalCompositeUrl: {
    type: String,
    default: null,
  },
  imageWidth: {
    type: Number,
    default: 0,
  },
  imageHeight: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  'fieldSelected',
  'pdfLoaded',
  'templateSaved',
  'currentPageChanged',
]);

const supabase = useSupabaseClient();

// Refs
const previewContainer = ref(null);
const pdfPageContainer = ref(null);
const pdfCanvas = ref(null);

// PDF State
const pdfLoaded = ref(false);
const pdfDoc = shallowRef(null);
const pdfjsLib = shallowRef(null);
const totalPages = ref(1);
const currentPage = ref(1);
const scale = ref(1.5);
const pdfNaturalDimensions = ref({ width: 0, height: 0 });
const canvasDisplaySize = ref({ width: 0, height: 0 }); // Track canvas display size for reactivity

// Drag State
const activeDrag = ref({
  isDragging: false,
  field: null,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
});

// Helper functions for coordinate conversion
function displayToNormalized(x, y, width, height) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const bounds = getPdfBounds();
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  // Convert display coordinates to natural coordinates first
  const naturalX = x * bounds.scaleX;
  const naturalY = y * bounds.scaleY;
  const naturalW = width * bounds.scaleX;
  const naturalH = height * bounds.scaleY;

  // Normalize (0-1) based on natural PDF dimensions
  return {
    x: naturalX / naturalWidth,
    y: naturalY / naturalHeight,
    width: naturalW / naturalWidth,
    height: naturalH / naturalHeight,
  };
}

function normalizedToDisplay(normX, normY, normWidth, normHeight) {
  if (!pdfCanvas.value || !pdfNaturalDimensions.value.width) {
    return { x: 50, y: 50, width: 150, height: 40 };
  }

  const bounds = getPdfBounds();
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  // Convert normalized to natural coordinates
  const naturalX = normX * naturalWidth;
  const naturalY = normY * naturalHeight;
  const naturalW = normWidth * naturalWidth;
  const naturalH = normHeight * naturalHeight;

  // Convert natural to display coordinates
  return {
    x: naturalX / bounds.scaleX,
    y: naturalY / bounds.scaleY,
    width: naturalW / bounds.scaleX,
    height: naturalH / bounds.scaleY,
  };
}

// Computed: Filter fields for current page only
const placedFieldsOnCurrentPage = computed(() => {
  return props.placedFields.filter(
    field => !field.pageNumber || field.pageNumber === currentPage.value,
  );
});

// Computed: Get display coordinates for each field
// MUST depend on scale, canvas, and natural dimensions for reactivity
const fieldsWithDisplayCoords = computed(() => {
  // Force dependency on these values to trigger recalculation when they change
  const _scale = scale.value;
  const _canvas = pdfCanvas.value;
  const _dims = pdfNaturalDimensions.value;
  const _canvasSize = canvasDisplaySize.value; // Also depend on canvas display size

  // If PDF not loaded yet, return empty array
  if (!_canvas || !_dims.width) {
    return [];
  }

  return placedFieldsOnCurrentPage.value.map((field) => {
    // If field has normalized coordinates, use them
    if (field.normalizedX !== undefined && field.normalizedY !== undefined) {
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
    // Fallback to pixel coordinates (for old data or new fields)
    return {
      ...field,
      displayX: field.x || 50,
      displayY: field.y || 50,
      displayWidth: field.width || 150,
      displayHeight: field.height || 40,
    };
  });
});

// Initialize PDF.js
async function initPdfJs() {
  if (pdfjsLib.value)
    return pdfjsLib.value;

  try {
    const pdfjs = await import('pdfjs-dist');

    if (import.meta.client) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    }

    pdfjsLib.value = pdfjs;
    return pdfjs;
  }
  catch (error) {
    console.error('Error loading PDF.js:', error);
    throw new Error('Failed to load PDF library');
  }
}

// Get PDF bounds for coordinate transformation
function getPdfBounds() {
  if (!pdfCanvas.value) {
    return {
      displayWidth: 0,
      displayHeight: 0,
      canvasWidth: 0,
      canvasHeight: 0,
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
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const naturalWidth = pdfNaturalDimensions.value.width;
  const naturalHeight = pdfNaturalDimensions.value.height;

  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;

  return {
    displayWidth,
    displayHeight,
    canvasWidth,
    canvasHeight,
    naturalWidth,
    naturalHeight,
    scaleX,
    scaleY,
  };
}

// Load PDF
async function loadPdf() {
  if (!props.pdfBytes) {
    return;
  }

  try {
    pdfLoaded.value = false;

    if (!pdfPageContainer.value) {
      throw new Error('PDF container not found in DOM');
    }

    // Initialize PDF.js
    const pdfjs = await initPdfJs();

    // Load PDF document
    const loadingTask = pdfjs.getDocument({
      data: props.pdfBytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });

    const loadedDoc = await loadingTask.promise;
    pdfDoc.value = loadedDoc;

    totalPages.value = loadedDoc.numPages;
    currentPage.value = 1;

    // Get natural dimensions (at scale 1.0)
    const firstPage = await loadedDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    pdfNaturalDimensions.value = {
      width: viewport.width,
      height: viewport.height,
    };

    // Wait for DOM update
    await nextTick();

    // Render first page
    setTimeout(async () => {
      await renderCurrentPage();
      pdfLoaded.value = true;
      emit('pdfLoaded');
    }, 100);
  }
  catch (error) {
    console.error('[TemplatePdfPreviewEdit] Error loading PDF:', error);
    console.error(`Error loading PDF: ${error.message}`);
    pdfLoaded.value = false;
  }
}

// Render current page
async function renderCurrentPage() {
  if (!pdfDoc.value || !pdfCanvas.value) {
    return;
  }

  try {
    const pageNumber = currentPage.value;
    const page = await pdfDoc.value.getPage(pageNumber);
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');

    const viewport = page.getViewport({ scale: scale.value });

    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    // Render the page
    await page.render(renderContext).promise;

    // Update canvas display size after render
    updateCanvasSize();

    // Emit page change
    emit('currentPageChanged', pageNumber);
  }
  catch (error) {
    console.error('[TemplatePdfPreviewEdit] Error rendering PDF page:', error);
    console.error(`Error rendering PDF page: ${error.message}`);
  }
}

// Field selection
function selectField(field) {
  emit('fieldSelected', field);
}

// Get event coordinates
function getEventCoordinates(event) {
  if (event.touches && event.touches.length > 0) {
    return {
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY,
    };
  }
  return { clientX: event.clientX, clientY: event.clientY };
}

// Start dragging field
function startDrag(event, field) {
  if (!previewContainer.value || !field)
    return;

  const coords = getEventCoordinates(event);
  const containerRect = previewContainer.value.getBoundingClientRect();

  // Get current display position from normalized coordinates
  const display = field.normalizedX !== undefined
    ? normalizedToDisplay(field.normalizedX, field.normalizedY, field.normalizedWidth, field.normalizedHeight)
    : { x: 50, y: 50, width: 150, height: 40 };
  const displayX = display.x;
  const displayY = display.y;

  activeDrag.value = {
    isDragging: true,
    field,
    offsetX: coords.clientX - containerRect.left - displayX,
    offsetY: coords.clientY - containerRect.top - displayY,
    startX: coords.clientX,
    startY: coords.clientY,
  };

  emit('fieldSelected', field);

  event.preventDefault();
  event.stopPropagation();

  document.addEventListener('mousemove', drag, { passive: false });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', stopDrag);
}

// Drag field
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

  // Get current display dimensions from normalized coordinates
  const currentDisplay = activeDrag.value.field.normalizedWidth !== undefined
    ? normalizedToDisplay(0, 0, activeDrag.value.field.normalizedWidth, activeDrag.value.field.normalizedHeight)
    : { width: 150, height: 40 };
  const fieldWidth = currentDisplay.width;
  const fieldHeight = currentDisplay.height;

  newX = Math.max(0, Math.min(newX, containerWidth - fieldWidth));
  newY = Math.max(0, Math.min(newY, containerHeight - fieldHeight));

  // Convert to normalized coordinates and update
  const normalized = displayToNormalized(newX, newY, fieldWidth, fieldHeight);
  activeDrag.value.field.normalizedX = normalized.x;
  activeDrag.value.field.normalizedY = normalized.y;
  activeDrag.value.field.normalizedWidth = normalized.width;
  activeDrag.value.field.normalizedHeight = normalized.height;
}

// Stop dragging
function stopDrag(_event) {
  if (activeDrag.value.isDragging) {
    activeDrag.value.isDragging = false;
    activeDrag.value.field = null;

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
  }
}

function extractFilePathFromUrl(url) {
  if (!url)
    return null;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const relevantParts = pathParts.filter(part => part);
    if (relevantParts.length >= 3) {
      return relevantParts.slice(5).join('/');
    }
  }
  catch (error) {
    console.error('Error extracting file path from URL:', error);
  }
  return null;
}

async function deleteOldComposite() {
  if (!props.originalCompositeUrl)
    return;

  const filePath = extractFilePathFromUrl(props.originalCompositeUrl);
  if (!filePath)
    return;

  try {
    const { error: _error } = await supabase.storage
      .from('contract')
      .remove([filePath]);
  }
  catch (error) {
    console.error('Error in deleteOldComposite:', error);
  }
}

async function saveCompositeToStorage(templateName, compositePdfBytes) {
  const timestamp = Date.now();
  const compositeFileName = `${templateName}_${timestamp}_composite.pdf`;
  const compositeFilePath = `composites/${compositeFileName}`;

  const compositeBlob = new Blob([compositePdfBytes], {
    type: 'application/pdf',
  });

  const { error: uploadError } = await supabase.storage
    .from('contract')
    .upload(compositeFilePath, compositeBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error uploading composite PDF: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('contract')
    .getPublicUrl(compositeFilePath);

  return publicUrlData.publicUrl;
}

// Save template
async function saveTemplate() {
  try {
    // Use originalPdfBytes for saving (not detached)
    const bytesToUse = props.originalPdfBytes || props.pdfBytes;

    if (!bytesToUse || bytesToUse.length === 0) {
      console.error('PDF not loaded');
      return;
    }

    if (props.placedFields.length === 0) {
      console.error('Please add at least one field to the template');
      return;
    }

    const templateName = props.templateName;
    if (!templateName?.trim()) {
      console.error('Please enter a template name');
      return;
    }

    if (!props.selectedContractId) {
      console.error('Contract not selected');
      return;
    }

    if (!props.templateId) {
      console.error('Template ID not found');
      return;
    }

    // Verify PDF is valid - use try-catch for slice operation
    let header;
    try {
      header = String.fromCharCode.apply(
        null,
        Array.from(bytesToUse.slice(0, 5)),
      );
    }
    catch (error) {
      console.error(
        '[TemplatePdfPreviewEdit] Error reading PDF header:',
        error,
      );
      console.error('Error accessing PDF data. Please try reloading the page.');
      return;
    }

    if (header !== '%PDF-') {
      console.error('[TemplatePdfPreviewEdit] Invalid PDF header:', header);
      console.error('Invalid PDF file. The file may be corrupted.');
      return;
    }

    const naturalWidth = pdfNaturalDimensions.value.width;
    const naturalHeight = pdfNaturalDimensions.value.height;

    // Group fields by page and transform coordinates for each page
    const fieldsByPage = {};

    props.placedFields.forEach((field) => {
      const pageNum = field.pageNumber || 1;
      if (!fieldsByPage[pageNum]) {
        fieldsByPage[pageNum] = [];
      }

      // Transform from normalized coordinates to natural PDF coordinates
      const naturalX = field.normalizedX * naturalWidth;
      const naturalY = field.normalizedY * naturalHeight;
      const naturalW = field.normalizedWidth * naturalWidth;
      const naturalH = field.normalizedHeight * naturalHeight;

      fieldsByPage[pageNum].push({
        ...field,
        x: naturalX,
        y: naturalY,
        width: naturalW,
        height: naturalH,
      });
    });

    // Generate composite PDF with fields on ALL pages
    const { generateCompositePdf } = usePdfOperations();

    // Generate composite for each page that has fields
    // Use the original bytes (not detached)
    let compositePdfBytes = bytesToUse;

    for (const [pageNum, pageFields] of Object.entries(fieldsByPage)) {
      compositePdfBytes = await generateCompositePdf(
        compositePdfBytes,
        pageFields,
        Number.parseInt(pageNum),
      );
    }

    if (!compositePdfBytes) {
      console.error('Failed to generate composite PDF');
      return;
    }

    // Delete old composite
    await deleteOldComposite();

    // Upload new composite
    const compositeImageUrl = await saveCompositeToStorage(
      templateName,
      compositePdfBytes,
    );

    // Use stored natural dimensions for database
    const _imageWidth = props.imageWidth || pdfNaturalDimensions.value.width;
    const _imageHeight = props.imageHeight || pdfNaturalDimensions.value.height;

    // Save only normalized coordinates (vector-based positioning)
    // Security: Validate all fields before saving
    const normalizedFields = [];
    for (const field of props.placedFields) {
      const validation = validateNormalizedField(field);
      if (!validation.valid) {
        console.error('Field validation failed:', validation.error, field);
        continue; // Skip invalid fields
      }

      normalizedFields.push({
        id: field.id,
        instanceId: field.instanceId,
        instanceNumber: field.instanceNumber,
        normalizedX: Math.max(0, Math.min(1, field.normalizedX)), // Clamp to 0-1
        normalizedY: Math.max(0, Math.min(1, field.normalizedY)),
        normalizedWidth: Math.max(0, Math.min(1, field.normalizedWidth)),
        normalizedHeight: Math.max(0, Math.min(1, field.normalizedHeight)),
        type: field.type,
        groupId: field.groupId,
        isGrouped: field.isGrouped,
        groupSize: field.groupSize,
        groupPosition: field.groupPosition,
        pageNumber: field.pageNumber || 1,
        label: field.label?.substring(0, 255) || '', // Limit label length
        fontSize: Math.max(8, Math.min(72, field.fontSize || 14)), // Clamp font size 8-72
        fontFamily: field.fontFamily || 'Arial',
      });
    }

    if (normalizedFields.length === 0) {
      console.error('No valid fields to save');
      return;
    }

    // Prepare update data
    const templateData = {
      name: templateName.trim(),
      composite_image_url: compositeImageUrl,
      placed_fields_data: normalizedFields,
    };

    // Update template in database
    const { data, error } = await supabase
      .from('contract_templates')
      .update(templateData)
      .eq('id', props.templateId)
      .select()
      .single();

    if (error) {
      console.error('[TemplatePdfPreviewEdit] Database error:', error);
      console.error(`Error saving template: ${error.message}`);
      return;
    }

    console.warn('Template updated successfully!');

    emit('templateSaved', data);
  }
  catch (error) {
    console.error('[TemplatePdfPreviewEdit] Error in saveTemplate:', error);
    console.error(`Error saving template: ${error.message}`);
  }
}

// Watch for PDF bytes changes
watch(
  () => props.pdfBytes,
  async (newBytes) => {
    if (newBytes && newBytes.length > 0) {
      await nextTick();
      await loadPdf();
    }
  },
  { immediate: true },
);

// Watch for page changes
watch(currentPage, () => {
  if (pdfLoaded.value) {
    renderCurrentPage();
  }
});

// Auto-calculate normalized coordinates for fields that don't have them yet
watch(
  () => [props.placedFields, pdfLoaded.value, pdfNaturalDimensions.value],
  () => {
    if (!pdfLoaded.value || !pdfNaturalDimensions.value.width)
      return;

    // Process fields that don't have normalized coordinates
    props.placedFields.forEach((field) => {
      if (field.normalizedX === undefined || field.normalizedY === undefined) {
        // Calculate normalized coordinates from pixel values
        const normalized = displayToNormalized(
          field.x || 50,
          field.y || 50,
          field.width || 150,
          field.height || 40,
        );

        // Update the field with normalized coordinates
        field.normalizedX = normalized.x;
        field.normalizedY = normalized.y;
        field.normalizedWidth = normalized.width;
        field.normalizedHeight = normalized.height;
      }
    });
  },
  { deep: true },
);

// Update canvas display size for reactivity
function updateCanvasSize() {
  if (pdfCanvas.value) {
    const rect = pdfCanvas.value.getBoundingClientRect();
    canvasDisplaySize.value = { width: rect.width, height: rect.height };
  }
}

// Lifecycle
onMounted(() => {
  // Add window resize listener to update canvas size
  window.addEventListener('resize', updateCanvasSize);
});

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize);
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
});

// Expose functions and refs for parent component
defineExpose({
  displayToNormalized,
  normalizedToDisplay,
  getPdfBounds,
  pdfNaturalDimensions,
  pdfCanvas,
});
</script>

<template>
  <div class="card card-primary">
    <div class="card-header">
      <h3 class="card-title">
        Preview
      </h3>
      <div class="card-tools">
        <button
          type="submit"
          class="btn btn-success btn-sm"
          @click="saveTemplate"
        >
          <i class="fas fa-save" /> Save Template
        </button>
      </div>
    </div>
    <div class="card-body p-3">
      <div
        id="pdf-preview-container"
        ref="previewContainer"
        class="template-preview-area"
      >
        <!-- PDF Page Container -->
        <div
          id="pdf-page-container"
          ref="pdfPageContainer"
          class="pdf-page-container"
        >
          <!-- Loading State -->
          <div
            v-if="!pdfLoaded"
            class="d-flex align-items-center justify-content-center"
            style="min-height: 400px"
          >
            <div class="text-center text-muted">
              <i class="fas fa-file-pdf fa-3x mb-3" />
              <p>Loading PDF...</p>
            </div>
          </div>

          <!-- PDF Canvas -->
          <canvas
            v-show="pdfLoaded"
            ref="pdfCanvas"
            class="pdf-page-canvas"
          />
        </div>

        <!-- Placed Fields Overlay (only for current page) -->
        <div
          v-for="field in fieldsWithDisplayCoords"
          :key="field.instanceId"
          class="placed-field"
          :class="{
            'field-selected': selectedField?.instanceId === field.instanceId,
          }"
          :style="{
            left: `${field.displayX}px`,
            top: `${field.displayY}px`,
            width: `${field.displayWidth}px`,
            height: `${field.displayHeight}px`,
            transform:
              activeDrag.isDragging
              && activeDrag.field?.instanceId === field.instanceId
                ? 'scale(1.05)'
                : 'scale(1)',
            zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 1,
          }"
          @mousedown="startDrag($event, field)"
          @touchstart="startDrag($event, field)"
          @click="selectField(field)"
        >
          <div class="field-content">
            <i
              v-if="field.name === 'Check Mark'"
              :class="field.icon"
              style="font-size: 1.2em"
            />
            <span v-if="field.label" class="field-label">{{
              field.label
            }}</span>
            <span v-if="field.isGrouped" class="instance-number">
              #{{ field.instanceNumber }}
            </span>
          </div>
        </div>

        <!-- Page Selector -->
        <div v-if="pdfLoaded && totalPages > 1" class="page-selector mb-2">
          <label class="form-label small">Page:</label>
          <select
            v-model="currentPage"
            class="form-select form-select-sm d-inline-block w-auto"
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
@media (max-width: 820px) {
  #pdf-preview-container {
    width: 100% !important;
    margin: 0 !important;
  }
}

@media (max-width: 768px) {
  .card-body {
    padding: 1rem;
  }
}

#pdf-preview-container {
  background-image:
    linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  min-height: 400px;
  position: relative;
}

.pdf-page-container {
  position: relative;
  width: 100%;
  margin: 0 auto;
}

.pdf-page-canvas {
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
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.3);
  border: 1px solid #ddd;
}

.placed-field * {
  user-select: none;
  pointer-events: none;
}

.placed-field:active {
  cursor: grabbing;
  transform: scale(1.05);
  z-index: 1000;
}

.placed-field:hover {
  background-color: rgba(255, 255, 255, 0.35);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.field-selected {
  border: rgba(0, 0, 255, 0.3) 2px dashed !important;
  background-color: rgba(0, 0, 255, 0.05) !important;
}

.field-content {
  padding: 2px 5px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  pointer-events: none;
  width: 100%;
  overflow: hidden;
}

.field-name {
  color: #333;
  font-size: 0.75rem;
}

.field-label {
  font-weight: bold;
  margin-left: 8px;
  font-size: 0.75rem;
}

.instance-number {
  font-size: 0.6rem;
  color: #666;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 3px;
}

.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid rgba(0, 0, 0, 0.125);
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

.template-preview-area {
  position: relative;
  border: 1px dashed #6c757d !important;
  background-color: #f8f9fa;
  user-select: none;
  margin-left: auto;
  margin-right: auto;
  width: 55vw;
  max-width: 800px;
}

.page-selector {
  text-align: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
}
</style>
