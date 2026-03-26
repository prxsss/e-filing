import type { IncomingMessage } from 'node:http';

import { Server } from 'socket.io';

export default defineNitroPlugin((nitroApp) => {
  let io: Server | null = null;

  nitroApp.hooks.hook('request', (event) => {
    if (io)
      return;

    const req = event.node.req as IncomingMessage;

    // Skip initialisation if this request is already a Socket.io handshake.
    // Without this guard, Socket.io tries to attach mid-handshake on its own
    // polling request, writes to a half-closed socket, and throws ECONNABORTED
    // which crashes the Nitro dev server.
    if (req.url?.startsWith('/socket.io'))
      return;

    const httpServer = (req.socket as any)?.server;
    if (!httpServer)
      return;

    // Swallow connection-level write errors (ECONNABORTED, EPIPE, ECONNRESET)
    // so a single dropped client can't bring down the whole dev server.
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (['ECONNABORTED', 'EPIPE', 'ECONNRESET'].includes(err.code ?? ''))
        return;
      console.error('[http server error]', err);
    });

    io = new Server(httpServer, {
      cors: { origin: '*' },
      transports: ['polling', 'websocket'],
    });

    ;(nitroApp as any).io = io;

    io.on('connection', (socket) => {
      socket.on('join', (userId: string) => {
        socket.join(userId);
      });

      // Absorb per-socket errors so they don't bubble up to the server
      socket.on('error', (err: NodeJS.ErrnoException) => {
        if (['ECONNABORTED', 'EPIPE', 'ECONNRESET'].includes(err.code ?? ''))
          return;
        console.error('[socket error]', err);
      });

      socket.on('disconnect', () => {});
    });
  });
});
