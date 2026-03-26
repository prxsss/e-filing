import type { Socket } from 'socket.io-client';

import { io } from 'socket.io-client';

const useSocketState = () => useState<Socket | null>('socket-instance', () => null);

export function useSocket() {
  const socket = useSocketState();
  const notifications = useState<Notification[]>('notifications', () => []);

  function connect(userId: string) {
    if (socket.value?.connected) {
      return;
    }

    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }

    socket.value = io('/', {
      path: '/socket.io',
      // Allow polling first so the HTTP handshake can complete,
      // then upgrade to WebSocket. Pure 'websocket' fails silently
      // on Nitro's h3App because the upgrade isn't handled the same way.
      transports: ['polling', 'websocket'],
    });

    socket.value.on('connect', () => {
      socket.value!.emit('join', userId);
    });

    socket.value.on('connect_error', (_err) => {
      // Optionally, you can show a user notification or log the error
      // For now, just disconnect to avoid stale state
      socket.value?.disconnect();
      socket.value = null;
    });

    socket.value.on('disconnect', (_reason) => {
      // Optionally handle disconnect reason
    });

    socket.value.on('notification', (data: Notification) => {
      notifications.value.unshift(data);
    });
  }

  function disconnect() {
    if (!socket.value)
      return;
    socket.value.removeAllListeners();
    socket.value.disconnect();
    socket.value = null;
  }

  return { notifications, connect, disconnect };
}

type Notification = {
  id: number;
  userId: string;
  type: 'sign_request' | 'signed' | 'completed' | 'rejected';
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};
