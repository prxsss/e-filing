import { Server } from 'socket.io';

export default defineNitroPlugin((nitroApp) => {
  const io = new Server(nitroApp.h3App as any, {
    cors: { origin: '*' },
  })

  // Make io available globally on nitroApp
  ;(nitroApp as any).io = io;

  io.on('connection', (socket) => {
    console.warn('Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.warn('Client disconnected:', socket.id);
    });
  });
});
