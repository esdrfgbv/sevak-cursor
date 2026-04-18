import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { corsOrigins } from '../lib/env.js';

export type RealtimeServer = Server;

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('subscribe:tasks', ({ event_id }: { event_id: string }) => {
      socket.join(`event:${event_id}:tasks`);
    });
    socket.on('subscribe:volunteer-status', ({ event_id }: { event_id: string }) => {
      socket.join(`event:${event_id}:volunteer-status`);
    });
  });

  return io;
}

export function getIo() {
  return io;
}

export function emitTaskUpdated(eventId: string, payload: unknown) {
  io?.to(`event:${eventId}:tasks`).emit('task_updated', payload);
}

export function emitVolunteerStatus(eventId: string, payload: unknown) {
  io?.to(`event:${eventId}:volunteer-status`).emit('volunteer_status', payload);
}

