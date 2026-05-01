<script setup lang="ts">
const authStore = useAuthStore();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();

// === Types ===
type NotificationType = 'sign_request' | 'signed' | 'completed' | 'rejected';
type Notification = {
  id: number;
  userId: string;
  type: NotificationType;
  messageEng: string | null;
  messageTh: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};
type NotificationsResponse = {
  success: boolean;
  data?: Notification[];
  error?: string;
};

const { notifications, connect, disconnect } = useSocket();
const loading = ref(true);
const popoverOpen = ref(false);

async function refresh() {
  loading.value = true;
  const res = await $fetch<NotificationsResponse>('/api/notifications');
  if (res.success && res.data && notifications.value) {
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

const unreadCount = computed(() => notifications.value.filter((n: Notification) => !n.isRead).length);

const notifTypeLabel: Record<NotificationType, string> = {
  sign_request: t('signRequest'),
  signed: t('signedHistory'),
  rejected: t('rejected'),
  completed: t('completed'),
};
const notifTypeColor: Record<NotificationType, 'warning' | 'success' | 'error' | 'primary' | 'secondary' | 'info' | 'neutral' | undefined> = {
  sign_request: 'warning',
  signed: 'success',
  rejected: 'error',
  completed: 'success',
};

function getNotificationMessage(notif: Notification): string {
  if (locale.value === 'th')
    return notif.messageTh ?? notif.messageEng ?? notifTypeLabel[notif.type] ?? '—';
  return notif.messageEng ?? notif.messageTh ?? notifTypeLabel[notif.type] ?? '—';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1)
    return t('justNow') || 'just now';
  if (mins < 60)
    return t('minutesAgo', { count: mins }) || `${mins} minutes ago`;
  if (hours < 24)
    return t('hoursAgo', { count: hours }) || `${hours} hours ago`;
  return t('daysAgo', { count: days }) || `${days} days ago`;
}

async function onNotificationClick(notif: Notification) {
  if (!notif.isRead) {
    await $fetch(`/api/notifications/${notif.id}/read`, { method: 'patch' });
    if (notifications.value) {
      const idx = notifications.value.findIndex((n: Notification) => n.id === notif.id);
      if (idx !== -1 && notifications.value[idx]) {
        notifications.value[idx].isRead = true;
      }
    }
  }
  if (notif.link) {
    popoverOpen.value = false;
    router.push(localePath(notif.link));
  }
}
</script>

<template>
  <UPopover v-model:open="popoverOpen" arrow>
    <UButton
      color="neutral"
      variant="ghost"
      square
      aria-label="Notifications"
    >
      <UChip v-if="unreadCount > 0" color="error" inset>
        <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
      </UChip>
      <template v-else>
        <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
      </template>
    </UButton>
    <template #content>
      <div class="w-80 max-w-xs">
        <div class="flex justify-between items-center px-4 pt-4 pb-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bell" class="text-gray-400 w-5 h-5" />
            <span class="font-semibold text-gray-800">{{ t('notifications') }}</span>
            <UBadge v-if="unreadCount > 0" :label="String(unreadCount)" color="error" variant="solid" size="xs" />
          </div>
        </div>
        <div class="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          <div
            v-for="notif in notifications"
            :key="notif.id"
            class="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
            :class="{ 'bg-gray-50': !notif.isRead }"
            @click="onNotificationClick(notif)"
          >
            <span v-if="!notif.isRead" class="relative flex items-center justify-center mt-1 w-3 h-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-60" />
              <span class="relative block w-2 h-2 rounded-full bg-primary-500" />
            </span>
            <span v-else class="block w-2 h-2 rounded-full bg-gray-200 mt-1" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <UBadge
                  :color="notifTypeColor[notif.type as NotificationType]"
                  :variant="notif.isRead ? 'subtle' : 'solid'"
                  size="xs"
                  :label="notifTypeLabel[notif.type as NotificationType] ?? notif.type"
                />
                <span class="text-xs text-gray-400">{{ formatRelativeTime(notif.createdAt) }}</span>
              </div>
              <div :class="notif.isRead ? 'text-gray-400 text-sm' : 'font-semibold text-gray-900'">
                {{ getNotificationMessage(notif) }}
              </div>
            </div>
            <UIcon
              v-if="notif.link"
              name="i-lucide-chevron-right"
              :class="notif.isRead ? 'w-5 h-5 text-gray-300' : 'w-5 h-5 text-primary-500'"
            />
          </div>
          <div v-if="!notifications.length && !loading" class="text-center text-gray-400 py-6">
            {{ t('noNotifications') }}
          </div>
          <div v-if="loading" class="text-center py-6">
            <USkeleton class="h-4 w-24 mx-auto mb-2" />
            <USkeleton class="h-3 w-16 mx-auto" />
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
