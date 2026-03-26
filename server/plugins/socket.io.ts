import { createServer } from 'node:http';
import { Server } from 'socket.io';

export default defineNitroPlugin((nitroApp) => {
  // In Nuxt dev mode, Nitro runs behind Vite's HMR server.
  // Attaching Socket.io to req.socket.server hands it Vite's server,
  // which conflicts with Vite's own WebSocket upgrade handler and causes
  // "Invalid frame header" + server crash.
  // Running Socket.io on a dedicated HTTP server on a separate port
  // is the only reliable approach in the Nuxt dev environment.
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['polling', 'websocket'],
  });

  const SOCKET_PORT = 3001;
  httpServer.listen(SOCKET_PORT, () => {
    console.warn(`[socket.io] Listening on port ${SOCKET_PORT}`);
  });

  ;(nitroApp as any).io = io;

  io.on('connection', (socket) => {
    socket.on('join', (userId: string) => {
      socket.join(userId);
    });

    socket.on('disconnect', () => {});
  });
});
