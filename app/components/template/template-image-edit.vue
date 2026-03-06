<script setup>
const props = defineProps({
  previewImageUrl: {
    type: String,
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
});

const emit = defineEmits(['fieldSelected', 'imageLoaded', 'templateSaved']);

const supabase = useSupabaseClient();

const previewContainer = ref(null);
const imageNaturalWidth = ref(0);
const imageNaturalHeight = ref(0);

const activeDrag = ref({
  isDragging: false,
  field: null,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
});

function onImageLoad(event) {
  const img = event.target;
  imageNaturalWidth.value = img.naturalWidth;
  imageNaturalHeight.value = img.naturalHeight;
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

function getImageBounds() {
  if (!previewContainer.value || !props.previewImageUrl) {
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
  const naturalWidth = imageNaturalWidth.value;
  const naturalHeight = imageNaturalHeight.value;

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
  const displayedAspectRatio = containerRect.width / containerRect.height;

  let imageDisplayWidth;
  let imageDisplayHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (naturalAspectRatio > displayedAspectRatio) {
    imageDisplayWidth = containerRect.width;
    imageDisplayHeight = containerRect.width / naturalAspectRatio;
    offsetY = (containerRect.height - imageDisplayHeight) / 2;
  }
  else {
    imageDisplayHeight = containerRect.height;
    imageDisplayWidth = containerRect.height * naturalAspectRatio;
    offsetX = (containerRect.width - imageDisplayWidth) / 2;
  }

  return {
    offsetX,
    offsetY,
    width: imageDisplayWidth,
    height: imageDisplayHeight,
    scaleX: naturalWidth / imageDisplayWidth,
    scaleY: naturalHeight / imageDisplayHeight,
  };
}

// Import canvas operations composable
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

    // Load background image
    const tempImage = await loadImage(props.previewImageUrl);
    const originalWidth = tempImage.naturalWidth;
    const originalHeight = tempImage.naturalHeight;

    // Create canvas with original image dimensions
    const canvas = createCanvas(originalWidth, originalHeight);
    const ctx = canvas.getContext('2d');
    drawBackgroundImage(ctx, tempImage, originalWidth, originalHeight);

    // Get the image bounds for scaling calculations
    const imageBounds = getImageBounds();

    // Calculate responsive font size based on image dimensions
    const baseFontSize = Math.min(originalWidth, originalHeight) * 0.02;

    // Render each field onto the canvas
    for (const field of props.placedFields) {
      // Calculate position on the original image
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
    console.error('Error generating composite image:', error);
    return null;
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

async function saveCompositeToStorage(templateName, compositeBlob) {
  const timestamp = Date.now();
  const compositeFileName = `${templateName}_${timestamp}.png`;
  const compositeFilePath = `composites/${compositeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('contract')
    .upload(compositeFilePath, compositeBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error uploading composite image: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('contract')
    .getPublicUrl(compositeFilePath);

  return publicUrlData.publicUrl;
}

async function saveTemplate() {
  try {
    if (!props.previewImageUrl) {
      console.error('Image not loaded');
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

    // Generate composite image
    const compositeBlob = await generateCompositeImage();
    if (!compositeBlob) {
      console.error('Failed to generate composite image');
      return;
    }

    // Delete old composite
    await deleteOldComposite();

    // Upload new composite
    const compositeImageUrl = await saveCompositeToStorage(
      templateName,
      compositeBlob,
    );

    // Normalize fields
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
      console.error('Database error:', error);
      console.error(`Error saving template: ${error.message}`);
      return;
    }

    console.warn('Template updated successfully!');
    emit('templateSaved', data);
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
        id="preview-container"
        ref="previewContainer"
        class="template-preview-area"
        @mouseup="stopDrag"
        @mousemove="drag"
        @mouseleave="stopDrag"
      >
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          class="d-block"
          @load="onImageLoad"
        >
        <div
          v-else
          class="d-flex align-items-center justify-content-center"
          style="min-height: 400px"
        >
          <div class="text-center text-muted">
            <i class="fas fa-image fa-3x mb-3" />
            <p>Loading image...</p>
          </div>
        </div>

        <div
          v-for="field in placedFields"
          :key="field.instanceId"
          class="placed-field border-2 d-flex align-items-center p-2 small text-nowrap overflow-hidden rounded"
          :class="{
            'field-selected': selectedField?.instanceId === field.instanceId,
          }"
          :style="{
            left: `${field.x}px`,
            top: `${field.y}px`,
            width: `${field.width}px`,
            height: `${field.height}px`,
            transform:
              activeDrag.isDragging
              && activeDrag.field?.instanceId === field.instanceId
                ? 'scale(1.05)'
                : 'scale(1)',
            zIndex: selectedField?.instanceId === field.instanceId ? 1000 : 1,
          }"
          @click.stop="selectField(field)"
          @mousedown.prevent="startDrag($event, field)"
          @touchstart.prevent="startDrag($event, field)"
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
            <span v-if="field.instanceNumber > 1" class="instance-number">
              #{{ field.instanceNumber }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 820px) {
  #preview-container {
    width: 100% !important;
    margin: 0 !important;
  }

  #preview-container img {
    width: 100% !important;
  }
}

@media (max-width: 768px) {
  .card-body {
    padding: 1rem;
  }
}

#preview-container {
  background-image:
    linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  min-height: 400px;
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

.template-preview-area img {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
}
</style>
