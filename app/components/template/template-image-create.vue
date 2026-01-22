<script setup>
// const supabase = useSupabaseClient(); // Temporarily disabled

const props = defineProps({
  previewImageUrl: { type: String, default: null },
  placedFields: { type: Array, default: () => [] },
  selectedField: { type: Object, default: null },
  newTemplateName: { type: String, default: '' },
  selectedContractId: { type: [String, Number], default: null },
  originalFile: { type: File, default: null },
});

const emit = defineEmits(['fieldSelected', 'imageLoaded', 'templateSaved']);

const previewContainer = ref(null);
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

function onImageLoad() {
  emit('imageLoaded');
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

function getImageBounds() {
  if (!previewContainer.value) {
    return {
      offsetX: 0,
      offsetY: 0,
      width: 0,
      height: 0,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const containerRect = previewContainer.value.getBoundingClientRect();
  const img = previewContainer.value.querySelector('img');

  if (!img) {
    return {
      offsetX: 0,
      offsetY: 0,
      width: containerRect.width,
      height: containerRect.height,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const naturalWidth = img.naturalWidth || containerRect.width;
  const naturalHeight = img.naturalHeight || containerRect.height;

  if (!naturalWidth || !naturalHeight) {
    return {
      offsetX: 0,
      offsetY: 0,
      width: containerRect.width,
      height: containerRect.height,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const naturalAspectRatio = naturalWidth / naturalHeight;
  const maxWidth = 800;
  const containerWidth = Math.min(containerRect.width, maxWidth);

  let imageDisplayWidth, imageDisplayHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (naturalWidth > naturalHeight) {
    imageDisplayWidth = containerWidth;
    imageDisplayHeight = containerWidth / naturalAspectRatio;
  }
  else {
    const maxHeight = containerRect.height;
    imageDisplayHeight = Math.min(
      maxHeight,
      containerWidth / naturalAspectRatio,
    );
    imageDisplayWidth = imageDisplayHeight * naturalAspectRatio;
  }

  offsetX = (containerWidth - imageDisplayWidth) / 2;
  offsetY = (containerRect.height - imageDisplayHeight) / 2;

  return {
    offsetX: Math.max(0, offsetX),
    offsetY: Math.max(0, offsetY),
    width: imageDisplayWidth,
    height: imageDisplayHeight,
    scaleX: naturalWidth / imageDisplayWidth,
    scaleY: naturalHeight / imageDisplayHeight,
  };
}

const {
  createCanvas,
  loadImage,
  drawBackgroundImage,
  renderCheckMark,
  renderTextWithWrapping,
  canvasToBlob,
  calculateFontSize,
  isFieldInBounds,
} = useCanvasOperations();

async function generateCompositeImage() {
  try {
    if (!props.previewImageUrl || !previewContainer.value) {
      throw new Error('No image or container available');
    }

    const tempImage = await loadImage(props.previewImageUrl);
    const originalWidth = tempImage.naturalWidth;
    const originalHeight = tempImage.naturalHeight;

    const canvas = createCanvas(originalWidth, originalHeight);
    const ctx = canvas.getContext('2d');
    drawBackgroundImage(ctx, tempImage, originalWidth, originalHeight);

    const imageBounds = getImageBounds();
    const baseFontSize = Math.min(originalWidth, originalHeight) * 0.02;

    for (const field of props.placedFields) {
      const scaledX = (field.x - imageBounds.offsetX) * imageBounds.scaleX;
      const scaledY = (field.y - imageBounds.offsetY) * imageBounds.scaleY;
      const scaledWidth = field.width * imageBounds.scaleX;
      const scaledHeight = field.height * imageBounds.scaleY;

      if (
        !isFieldInBounds(
          scaledX,
          scaledY,
          scaledWidth,
          scaledHeight,
          originalWidth,
          originalHeight,
        )
      ) {
        continue;
      }

      const fieldFontSize = calculateFontSize(
        scaledWidth,
        scaledHeight,
        baseFontSize,
      );

      if (field.name === 'Check Mark') {
        renderCheckMark(
          ctx,
          scaledX,
          scaledY,
          scaledWidth,
          scaledHeight,
          fieldFontSize,
        );
      }
      else {
        const textToRender = field.label ? field.label.trim() : '';
        if (textToRender) {
          renderTextWithWrapping(
            ctx,
            textToRender,
            scaledX,
            scaledY,
            scaledWidth,
            scaledHeight,
            fieldFontSize,
            '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif',
          );
        }
      }
    }

    return await canvasToBlob(canvas, 'image/png', 0.95);
  }
  catch (error) {
    console.error('Error generating composite:', error);
    return null;
  }
}

async function saveImagesToStorage(templateName, originalFile, _compositeBlob) {
  // Temporarily disabled - return mock URLs
  console.warn('Storage upload disabled - using mock URLs');

  const timestamp = Date.now();
  const fileExtension = originalFile.name.split('.').pop();
  const originalFileName = `${templateName}_${timestamp}.${fileExtension}`;
  const compositeFileName = `${templateName}_${timestamp}.png`;

  return {
    originalImageUrl: `https://example.com/templates/${originalFileName}`,
    compositeImageUrl: `https://example.com/composites/${compositeFileName}`,
  };

  /*
  const originalFilePath = `templates/${originalFileName}`;

  const { error: uploadError1 } = await supabase.storage
    .from("contract")
    .upload(originalFilePath, originalFile, {
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError1)
    throw new Error("Error uploading original image: " + uploadError1.message);

  const { data: publicUrlData1 } = supabase.storage
    .from("contract")
    .getPublicUrl(originalFilePath);

  const compositeFilePath = `composites/${compositeFileName}`;

  const { error: uploadError2 } = await supabase.storage
    .from("contract")
    .upload(compositeFilePath, compositeBlob, {
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError2)
    throw new Error("Error uploading composite image: " + uploadError2.message);

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
    if (!props.previewImageUrl) {
      console.error('Please upload a background image first');
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

    if (!props.originalFile) {
      console.error('Please select an image file');
      return;
    }

    const originalImage = new Image();
    const imageData = await new Promise((resolve, reject) => {
      originalImage.onload = () =>
        resolve({
          naturalWidth: originalImage.naturalWidth,
          naturalHeight: originalImage.naturalHeight,
        });
      originalImage.onerror = reject;
      originalImage.src = props.previewImageUrl;
    });

    const compositeBlob = await generateCompositeImage();
    if (!compositeBlob) {
      console.error('Failed to generate composite image');
      return;
    }

    const { originalImageUrl, compositeImageUrl } = await saveImagesToStorage(
      templateName,
      props.originalFile,
      compositeBlob,
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
    }));

    const templateData = {
      name: templateName.trim(),
      contract_id: props.selectedContractId,
      background_image_url: originalImageUrl,
      composite_image_url: compositeImageUrl,
      image_width: Math.round(imageData.naturalWidth),
      image_height: Math.round(imageData.naturalHeight),
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
        id="preview-container"
        ref="previewContainer"
        class="preview-area"
        @mouseup="stopDrag"
        @mousemove="drag"
        @mouseleave="stopDrag"
      >
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          @load="onImageLoad"
        >
        <div v-else class="text-center py-5">
          <i class="fas fa-image fa-3x text-muted mb-3" />
          <p class="text-muted mb-0">
            Upload an image to start
          </p>
        </div>

        <div
          v-for="field in placedFields"
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
            zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 1,
            fontSize: `${field.fontSize || 14}px`,
            fontFamily: field.fontFamily || 'Arial',
          }"
          @click.stop="selectField(field)"
          @mousedown.prevent="startDrag($event, field)"
          @touchstart.prevent="startDrag($event, field)"
        >
          <div class="field-content">
            <i v-if="field.name === 'Check Mark'" :class="field.icon" />
            <span v-if="field.label">{{ field.label }}</span>
            <span v-if="field.instanceNumber > 1" class="instance-num">
              #{{ field.instanceNumber }}
            </span>
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

.preview-area img {
  width: 100%;
  height: auto;
  display: block;
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
</style>
