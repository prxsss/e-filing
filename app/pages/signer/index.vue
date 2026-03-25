<script setup lang="ts">
definePageMeta({
  title: 'dashboard',
  middleware: ['permission'],
  permission: 'dashboard.signer.view',
});

const localePath = useLocalePath();
const router = useRouter();

// === Types ===
type NotificationType = 'to_sign' | 'signed' | 'rejected' | 'completed' | 'info';

type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  description: string;
  requestId: number | null;
  isRead: boolean;
  createdAt: string;
};

// === Notifications ===
// To connect a real API, replace this block with:
//   const { data: notifResponse } = await useFetch('/api/notifications', { query: { limit: 20 } })
//   const notifications = computed<Notification[]>(() => notifResponse.value?.data ?? [])
const notifications = ref<Notification[]>([
  {
    id: 1,
    type: 'to_sign',
    title: 'มีเอกสารรอลงนาม',
    description: 'คำร้องขอลาออก — นายสมชาย ใจดี (รหัส #1042)',
    requestId: 1042,
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 2,
    type: 'to_sign',
    title: 'มีเอกสารรอลงนาม',
    description: 'คำร้องขอเทียบโอนรายวิชา — น.ส.มาลี สวยงาม (รหัส #1039)',
    requestId: 1039,
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 3,
    type: 'signed',
    title: 'ลงนามเอกสารสำเร็จ',
    description: 'คำร้องขอหนังสือรับรอง — นายวิชัย มั่นคง (รหัส #1035)',
    requestId: 1035,
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 4,
    type: 'completed',
    title: 'คำร้องดำเนินการเสร็จสมบูรณ์',
    description: 'คำร้องขอผ่อนผันค่าธรรมเนียม — น.ส.ณัฐนรี ขยัน (รหัส #1031)',
    requestId: 1031,
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: 5,
    type: 'rejected',
    title: 'เอกสารถูกปฏิเสธในขั้นตอนถัดไป',
    description: 'คำร้องขอลงทะเบียนล่าช้า — นายประเสริฐ ตั้งใจ (รหัส #1028)',
    requestId: 1028,
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 6,
    type: 'info',
    title: 'ระบบแจ้งเตือน',
    description: 'มีการอัปเดตนโยบายการลงนามเอกสาร กรุณาตรวจสอบ',
    requestId: null,
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]);

const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length);

// === Table ===
const UIcon = resolveComponent('UIcon');
const UBadge = resolveComponent('UBadge');

const notifTypeLabel: Record<NotificationType, string> = {
  to_sign: 'รอลงนาม',
  signed: 'ลงนามแล้ว',
  rejected: 'ปฏิเสธ',
  completed: 'เสร็จสมบูรณ์',
  info: 'ทั่วไป',
};

const notifTypeColor: Record<NotificationType, string> = {
  to_sign: 'warning',
  signed: 'success',
  rejected: 'error',
  completed: 'success',
  info: 'info',
};

const columns = [
  {
    id: 'unread',
    header: '',
    size: 12,
    cell: (ctx: any) =>
      !ctx.row.original.isRead
        ? h('span', { class: 'block w-2 h-2 rounded-full bg-primary-500 mx-auto' })
        : null,
  },
  { accessorKey: 'title', header: 'การแจ้งเตือน' },
  { accessorKey: 'description', header: 'รายละเอียด' },
  {
    accessorKey: 'type',
    header: 'ประเภท',
    cell: (ctx: any) =>
      h(UBadge, {
        color: notifTypeColor[ctx.row.original.type as NotificationType] as any,
        variant: 'subtle',
        size: 'sm',
        label: notifTypeLabel[ctx.row.original.type as NotificationType],
      }),
  },
  { accessorKey: 'createdAt', header: 'เวลา' },
  {
    id: 'navigate',
    header: '',
    size: 40,
    cell: (ctx: any) =>
      ctx.row.original.requestId
        ? h(UIcon, { name: 'i-lucide-chevron-right', class: 'w-5 h-5 text-gray-400' })
        : null,
  },
];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1)
    return 'เมื่อกี้';
  if (mins < 60)
    return `${mins} นาทีที่แล้ว`;
  if (hours < 24)
    return `${hours} ชั่วโมงที่แล้ว`;
  return `${days} วันที่แล้ว`;
}

function onRowSelect(_e: Event, row: any) {
  const notif = notifications.value.find(n => n.id === row.original.id);
  if (notif)
    notif.isRead = true;
  if (row.original.requestId)
    router.push(localePath(`/signer/sign/${row.original.requestId}`));
}

function markAllRead() {
  notifications.value.forEach(n => (n.isRead = true));
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50">
    <UContainer class="space-y-8 pb-8">
      <!-- Banner -->
      <div class="bg-linear-to-r from-primary-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <!-- Decorative Background Element (same as student dashboard) -->
        <div class="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 translate-x-12 pointer-events-none" />

        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 class="text-2xl font-bold mb-2">
              ระบบจัดการเอกสาร
            </h2>
            <p class="text-white/90 max-w-lg">
              ตรวจสอบและลงนามเอกสารคำร้องของนักศึกษา ติดตามสถานะได้ตลอด 24 ชม.
            </p>
          </div>
        </div>
      </div>

      <!-- Notification List -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-bell" class="text-gray-400 w-5 h-5" />
              <h3 class="font-semibold text-gray-800">
                การแจ้งเตือน
              </h3>
              <UBadge
                v-if="unreadCount > 0"
                :label="String(unreadCount)"
                color="error"
                variant="solid"
                size="xs"
              />
            </div>
            <UButton
              v-if="unreadCount > 0"
              variant="link"
              color="primary"
              label="อ่านทั้งหมด"
              :padded="false"
              @click="markAllRead"
            />
          </div>
        </template>

        <UTable
          :data="notifications"
          :columns="columns"
          class="w-full"
          empty="ไม่มีการแจ้งเตือน"
          :ui="{ tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
          @select="onRowSelect"
        >
          <template #title-cell="{ row }">
            <span :class="!row.original.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'">
              {{ row.original.title }}
            </span>
          </template>
          <template #description-cell="{ row }">
            <span class="text-gray-500 text-sm">{{ row.original.description }}</span>
          </template>
          <template #createdAt-cell="{ row }">
            {{ formatRelativeTime(row.original.createdAt) }}
          </template>
        </UTable>
      </UCard>

      <!-- Quick Links (same pattern as student dashboard help section) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          class="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex items-start gap-4 hover:bg-orange-50 transition-colors cursor-pointer"
          @click="router.push(localePath('/signer/to-sign'))"
        >
          <div class="bg-white p-2.5 rounded-lg text-orange-600 shadow-sm flex items-center justify-center">
            <UIcon name="i-lucide-pen-line" class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              รายการรอลงนาม
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              ดูเอกสารทั้งหมดที่รอการลงนามของคุณ
            </p>
          </div>
        </div>
        <div
          class="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-4 hover:bg-blue-50 transition-colors cursor-pointer"
          @click="router.push(localePath('/signer/signed-history'))"
        >
          <div class="bg-white p-2.5 rounded-lg text-blue-600 shadow-sm flex items-center justify-center">
            <UIcon name="i-heroicons-clock" class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              ประวัติการลงนาม
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              เอกสารที่คุณเคยลงนามหรือปฏิเสธทั้งหมด
            </p>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
