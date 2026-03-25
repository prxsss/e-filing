import { io } from 'socket.io-client';

export default defineNuxtPlugin(() => {
  const socket = io('/', { path: '/socket.io' });

  return {
    provide: { io: socket },
  };
});
