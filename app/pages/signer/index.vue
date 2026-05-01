<script setup lang="ts">
definePageMeta({
  title: 'signerDashboard.title',
  middleware: ['permission'],
  permission: 'dashboard.signer.view',
});

const localePath = useLocalePath();
const router = useRouter();
const authStore = useAuthStore();
const { t, locale } = useI18n();

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
  sign_request: t('signerDashboard.notifications.types.signRequest'),
  signed: t('signerDashboard.notifications.types.signed'),
  rejected: t('signerDashboard.notifications.types.rejected'),
  completed: t('signerDashboard.notifications.types.completed'),
};

const notifTypeColor: Record<NotificationType, string> = {
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

const columns = [
  {
    id: 'unread',
    header: '',
    size: 20,
    cell: (ctx: any) => {
      if (ctx.row.original.isRead) {
        return h('span', { class: 'block w-2 h-2 rounded-full bg-gray-200 mx-auto' });
      }
      return h('span', { class: 'relative flex items-center justify-center mx-auto w-3 h-3' }, [
        h('span', { class: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-60' }),
        h('span', { class: 'relative block w-2 h-2 rounded-full bg-primary-500' }),
      ]);
    },
  },
  {
    accessorKey: 'messageEng',
    header: t('signerDashboard.notifications.table.message'),
    cell: (ctx: any) => getNotificationMessage(ctx.row.original as Notification),
  },
  {
    accessorKey: 'type',
    header: t('signerDashboard.notifications.table.type'),
    cell: (ctx: any) => {
      const isRead = ctx.row.original.isRead;
      return h(UBadge, {
        color: notifTypeColor[ctx.row.original.type as NotificationType] as any,
        variant: isRead ? 'subtle' : 'solid',
        size: 'sm',
        label: notifTypeLabel[ctx.row.original.type as NotificationType] ?? ctx.row.original.type,
      });
    },
  },
  {
    accessorKey: 'createdAt',
    header: t('signerDashboard.notifications.table.time'),
  },
  {
    id: 'navigate',
    header: '',
    size: 40,
    cell: (ctx: any) => {
      if (!ctx.row.original.link)
        return null;
      const isRead = ctx.row.original.isRead;
      return h(UIcon, {
        name: 'i-lucide-chevron-right',
        class: isRead ? 'w-5 h-5 text-gray-300' : 'w-5 h-5 text-primary-500',
      });
    },
  },
];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1)
    return t('justNow');
  if (mins < 60)
    return t('minutesAgo', { count: mins });
  if (hours < 24)
    return t('hoursAgo', { count: hours });
  return t('daysAgo', { count: days });
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
              {{ $t('signerDashboard.banner.title') }}
            </h2>
            <p class="text-white/90 max-w-lg">
              {{ $t('signerDashboard.banner.description') }}
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
                {{ $t('signerDashboard.notifications.title') }}
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
              :label="$t('signerDashboard.notifications.readAll')"
              :padded="false"
              @click="markAllRead"
            />
          </div>
        </template>

        <UTable
          :data="notifications"
          :columns="columns"
          class="w-full"
          :empty="$t('signerDashboard.notifications.empty')"
          :ui="{ tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors' }"
          @select="onRowSelect"
        >
          <!-- Message cell: bold + dark for unread, muted for read -->
          <template #message-cell="{ row }">
            <div v-if="!row.original.isRead" class="flex items-center gap-2">
              <span class="font-semibold text-gray-900 leading-snug">
                {{ getNotificationMessage(row.original) }}
              </span>
            </div>
            <span v-else class="text-gray-400 text-sm leading-snug">
              {{ getNotificationMessage(row.original) }}
            </span>
          </template>

          <!-- Time cell: primary-colored for unread, muted for read -->
          <template #createdAt-cell="{ row }">
            <span
              class="text-sm whitespace-nowrap"
              :class="!row.original.isRead ? 'text-primary-600 font-medium' : 'text-gray-400'"
            >
              {{ formatRelativeTime(row.original.createdAt) }}
            </span>
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
              {{ $t('signerDashboard.quickLinks.toSign.title') }}
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              {{ $t('signerDashboard.quickLinks.toSign.description') }}
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
              {{ $t('signerDashboard.quickLinks.signedHistory.title') }}
            </h4>
            <p class="text-xs text-gray-500 mt-1">
              {{ $t('signerDashboard.quickLinks.signedHistory.description') }}
            </p>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
