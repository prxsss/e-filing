<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean;
  height?: number;
  /** CSS aspect-ratio (width / height). When provided, overrides the fixed height prop. */
  aspectRatio?: number;
}>();

const emit = defineEmits<{
  confirm: [dataUrl: string];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const hasDrawn = ref(false);
let ctx: CanvasRenderingContext2D | null = null;
let points: Array<{ x: number; y: number; time: number }> = [];
let currentWidth = 2;
let resizeObserver: ResizeObserver | null = null;

// Stroke width range (DocuSign-style: slow=thick, fast=thin)
const MIN_WIDTH = 1;
const MAX_WIDTH = 4.5;
const VELOCITY_SCALE = 0.18;
const WIDTH_SMOOTHING = 0.82; // momentum factor for natural pen feel

function initCanvas() {
  if (!canvasRef.value)
    return;
  const canvas = canvasRef.value;
  const dpr = window.devicePixelRatio || 1;

  // Read CSS dimensions set by the wrapper div — reliable after nextTick
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width;
  const cssHeight = rect.height;

  // Set internal resolution to CSS size × DPR for crisp HiDPI rendering
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;

  ctx = canvas.getContext('2d');
  if (!ctx)
    return;
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = '#1e293b';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  hasDrawn.value = false;
}

function getPos(e: PointerEvent): { x: number; y: number } {
  const canvas = canvasRef.value;
  if (!canvas)
    return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Map client coordinates into canvas CSS-space (after HiDPI scaling).
  const scaleX = canvas.width / (rect.width * dpr);
  const scaleY = canvas.height / (rect.height * dpr);
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  return {
    x: Math.min(Math.max(x, 0), rect.width),
    y: Math.min(Math.max(y, 0), rect.height),
  };
}

function calcTargetWidth(velocity: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, MAX_WIDTH - velocity * VELOCITY_SCALE));
}

function startDraw(e: PointerEvent) {
  if (props.disabled)
    return;
  // Capture pointer so strokes don't break when cursor leaves canvas briefly
  (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  isDrawing.value = true;
  currentWidth = 2;
  points = [{ ...getPos(e), time: Date.now() }];
}

function draw(e: PointerEvent) {
  if (!isDrawing.value || !ctx)
    return;
  e.preventDefault();

  const pos = getPos(e);
  const now = Date.now();
  const prev = points[points.length - 1]!;
  const dt = Math.max(now - prev.time, 1);
  const velocity = Math.sqrt((pos.x - prev.x) ** 2 + (pos.y - prev.y) ** 2) / dt;

  // Smoothly interpolate width (pen pressure simulation)
  currentWidth = currentWidth * WIDTH_SMOOTHING + calcTargetWidth(velocity) * (1 - WIDTH_SMOOTHING);
  points.push({ x: pos.x, y: pos.y, time: now });
  hasDrawn.value = true;

  if (points.length < 3)
    return;

  const p0 = points[points.length - 3]!;
  const p1 = points[points.length - 2]!;
  const p2 = points[points.length - 1]!;

  // Quadratic Bézier through midpoints — continuous, smooth, no corner artifacts
  ctx.beginPath();
  ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
  ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  ctx.lineWidth = currentWidth;
  ctx.stroke();
}

function stopDraw(_e?: PointerEvent) {
  if (!isDrawing.value)
    return;
  isDrawing.value = false;

  // Cap the end of the stroke with a filled circle to avoid flat tail
  if (ctx && points.length >= 1) {
    const last = points[points.length - 1]!;
    ctx.beginPath();
    ctx.arc(last.x, last.y, currentWidth / 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
  }
  points = [];
}

function clear() {
  if (!ctx || !canvasRef.value)
    return;
  const rect = canvasRef.value.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  hasDrawn.value = false;
}

function confirm() {
  if (!canvasRef.value || !hasDrawn.value)
    return;
  emit('confirm', canvasRef.value.toDataURL('image/png'));
}

onMounted(async () => {
  await nextTick(); // ensure layout is complete before reading rect
  initCanvas();
  resizeObserver = new ResizeObserver(() => {
    const wasDrawn = hasDrawn.value;
    initCanvas();
    // Restore the flag — canvas was intentionally cleared by resize
    if (wasDrawn)
      hasDrawn.value = false;
  });
  if (canvasRef.value)
    resizeObserver.observe(canvasRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      class="relative border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden"
      :style="aspectRatio ? { aspectRatio: String(aspectRatio) } : { height: `${height ?? 200}px` }"
    >
      <canvas
        ref="canvasRef"
        class="block w-full h-full touch-none"
        :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'"
        @pointerdown="startDraw"
        @pointermove="draw"
        @pointerup="stopDraw"
        @pointercancel="stopDraw"
        @pointerleave="stopDraw"
      />
      <!-- Placeholder shown before drawing -->
      <p
        v-if="!hasDrawn"
        class="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none select-none"
      >
        {{ $t('signerSignDetail.signatureCanvas.placeholder') }}
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
        {{ $t('signerSignDetail.signatureCanvas.clear') }}
      </UButton>
      <UButton
        color="success"
        size="sm"
        icon="i-lucide-pen-line"
        :disabled="disabled || !hasDrawn"
        @click="confirm"
      >
        {{ $t('signerSignDetail.signatureCanvas.confirm') }}
      </UButton>
    </div>
  </div>
</template>
