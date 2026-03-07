<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean;
  width?: number;
  height?: number;
}>();

const emit = defineEmits<{
  confirm: [dataUrl: string];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const hasDrawn = ref(false);
let ctx: CanvasRenderingContext2D | null = null;
let lastX = 0;
let lastY = 0;

function initCanvas() {
  if (!canvasRef.value)
    return;
  ctx = canvasRef.value.getContext('2d');
  if (!ctx)
    return;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  if (e instanceof TouchEvent) {
    const touch = e.touches[0]!;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function startDraw(e: MouseEvent | TouchEvent) {
  if (props.disabled)
    return;
  isDrawing.value = true;
  hasDrawn.value = true;
  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;
  ctx?.beginPath();
  ctx?.moveTo(lastX, lastY);
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing.value || !ctx)
    return;
  e.preventDefault();
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  lastX = pos.x;
  lastY = pos.y;
}

function stopDraw() {
  isDrawing.value = false;
}

function clear() {
  if (!ctx || !canvasRef.value)
    return;
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  hasDrawn.value = false;
}

function confirm() {
  if (!canvasRef.value || !hasDrawn.value)
    return;
  const dataUrl = canvasRef.value.toDataURL('image/png');
  emit('confirm', dataUrl);
}

onMounted(() => {
  initCanvas();
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden">
      <canvas
        ref="canvasRef"
        :width="width ?? 600"
        :height="height ?? 200"
        class="w-full touch-none"
        :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'"
        @mousedown="startDraw"
        @mousemove="draw"
        @mouseup="stopDraw"
        @mouseleave="stopDraw"
        @touchstart.prevent="startDraw"
        @touchmove.prevent="draw"
        @touchend="stopDraw"
      />
      <!-- Placeholder shown before drawing -->
      <p
        v-if="!hasDrawn"
        class="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none select-none"
      >
        ลงลายมือชื่อที่นี่ / Sign here
      </p>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        icon="i-lucide-eraser"
        :disabled="disabled || !hasDrawn"
        @click="clear"
      >
        ล้าง
      </UButton>
      <UButton
        color="success"
        size="sm"
        icon="i-lucide-pen-line"
        :disabled="disabled || !hasDrawn"
        @click="confirm"
      >
        ยืนยันลายเซ็น
      </UButton>
    </div>
  </div>
</template>
