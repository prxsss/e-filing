<script setup lang="ts">
definePageMeta({
  title: 'dashboard',
});

const localePath = useLocalePath();
const router = useRouter();
const authStore = useAuthStore();

// === Types ===
type NotificationType = 'sign_request' | 'signed' | 'completed' | 'rejected';

type Notification = {
  id: number;
  userId: string;
  type: NotificationType;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

// === Fetch notifications on page load and sync with socket ===
type NotificationsResponse = {
  success: boolean;
  data?: Notification[];
  error?: string;
};

const { notifications, connect, disconnect } = useSocket();
const loading = ref(true);

async function refresh() {
  loading.value = true;
  const res = await $fetch<NotificationsResponse>('/api/notifications');
  if (res.success && res.data && notifications.value) {
    // Replace notifications array in-place for reactivity
    notifications.value.splice(0, notifications.value.length, ...res.data);
  }
  loading.value = false;
}

onMounted(() => {
  if (authStore.session.user?.id) {
    connect(authStore.session.user.id);
  }

  refresh();
});

onUnmounted(() => {
  disconnect();
});

const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length);

// === Table ===
const UBadge = resolveComponent('UBadge');
const UIcon = resolveComponent('UIcon');

const notifTypeLabel: Record<NotificationType, string> = {
  sign_request: 'รอลงนาม',
  signed: 'ลงนามแล้ว',
  rejected: 'ปฏิเสธ',
  completed: 'เสร็จสมบูรณ์',
};

const notifTypeColor: Record<NotificationType, string> = {
  sign_request: 'warning',
  signed: 'success',
  rejected: 'error',
  completed: 'success',
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
  {
    accessorKey: 'message',
    header: 'ข้อความ',
  },
  {
    accessorKey: 'type',
    header: 'ประเภท',
    cell: (ctx: any) =>
      h(UBadge, {
        color: notifTypeColor[ctx.row.original.type as NotificationType] as any,
        variant: 'subtle',
        size: 'sm',
        label: notifTypeLabel[ctx.row.original.type as NotificationType] ?? ctx.row.original.type,
      }),
  },
  {
    accessorKey: 'createdAt',
    header: 'เวลา',
  },
  {
    id: 'navigate',
    header: '',
    size: 40,
    cell: (ctx: any) =>
      ctx.row.original.link
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

async function onRowSelect(_e: Event, row: any) {
  const notif: Notification = row.original;

  // Mark as read via API if still unread

  if (!notif.isRead) {
    await $fetch(`/api/notifications/${notif.id}/read`, { method: 'patch' });
    // Update local state
    if (notifications.value) {
      const idx = notifications.value.findIndex(n => n.id === notif.id);
      if (idx !== -1 && notifications.value[idx]) {
        notifications.value[idx].isRead = true;
      }
    }
  }

  // Navigate using the link column if present
  if (notif.link) {
    router.push(localePath(notif.link));
  }
}

async function markAllRead() {
  await $fetch('/api/notifications/read-all', { method: 'patch' });
  // Update all as read locally
  if (notifications.value) {
    notifications.value.forEach((n) => {
      n.isRead = true;
    });
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50">
    <UContainer class="space-y-8 pb-8">
      <!-- Banner -->
      <div class="bg-linear-to-r from-primary-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div class="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 translate-x-12 pointer-events-none" />

        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 class="text-2xl font-bold mb-2">
              ระบบจัดการเอกสาร
            </h2>
            <p class="text-white/90 max-w-lg">
              ตรวจสอบและลงนามเอกสารคำร้องของนิสิต ติดตามสถานะได้ตลอด 24 ชม.
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
          <template #message-cell="{ row }">
            <span :class="!row.original.isRead ? 'font-semibold text-gray-900' : 'text-gray-500 text-sm'">
              {{ row.original.message ?? '—' }}
            </span>
          </template>
          <template #createdAt-cell="{ row }">
            <span class="text-gray-500 text-sm">{{ formatRelativeTime(row.original.createdAt) }}</span>
          </template>
        </UTable>
      </UCard>

      <!-- Quick Links -->
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
