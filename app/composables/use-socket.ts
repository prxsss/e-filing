import type { Socket } from 'socket.io-client';

import { io } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket() {
  const notifications = useState<Notification[]>('notifications', () => []);

  function connect() {
    if (socket?.connected)
      return;

    socket = io('/', { path: '/socket.io' });

    socket.on('notification', (data: Notification) => {
      notifications.value.unshift(data);
    });
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
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
