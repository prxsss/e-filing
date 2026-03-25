import type { Socket } from 'socket.io-client';

import { io } from 'socket.io-client';

const useSocketState = () => useState<Socket | null>('socket-instance', () => null);

export function useSocket() {
  const socket = useSocketState();
  const notifications = useState<Notification[]>('notifications', () => []);

  function connect(userId: string) {
    if (socket.value?.connected)
      return;

    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }

    // Connect to the dedicated Socket.io port, not the Nuxt dev server port.
    // In production, change this to your actual domain/port.
    const SOCKET_URL = import.meta.dev
      ? 'http://localhost:3001'
      : window.location.origin;

    socket.value = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
    });

    socket.value.on('connect', () => {
      socket.value!.emit('join', userId);
    });

    socket.value.on('connect_error', (_err) => {
      socket.value?.disconnect();
      socket.value = null;
    });

    socket.value.on('notification', (data: Notification) => {
      notifications.value.unshift(data);
    });

    socket.value.on('error', (err: any) => {
      console.error('[Socket error]', err);
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
