import type { IncomingMessage } from 'node:http';

import { Server } from 'socket.io';

export default defineNitroPlugin((nitroApp) => {
  let io: Server | null = null;

  // Grab the http.Server from the first incoming request's socket,
  // which is the only reliable way to access it inside a Nitro runtime plugin.
  nitroApp.hooks.hook('request', (event) => {
    if (io)
      return; // already initialised, skip all subsequent requests

    const req = event.node.req as IncomingMessage;
    // Fix: Cast req.socket to any before accessing .server to avoid TS error
    const httpServer = (req.socket as any)?.server;

    if (!httpServer)
      return;

    io = new Server(httpServer, {
      cors: { origin: '*' },
      transports: ['polling', 'websocket'],
    });

    // Make io available globally on nitroApp for use in API routes
    ;(nitroApp as any).io = io;

    io.on('connection', (socket) => {
      socket.on('join', (userId: string) => {
        socket.join(userId);
      });

      socket.on('disconnect', () => {});
    });
  });
});
