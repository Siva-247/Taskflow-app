import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { verifyToken } from '../auth/tokens.js';
import { prepare } from '../database/db.js';

const MESSAGE_SELECT = `SELECT id, conversation_id as "conversationId", sender_id as "senderId", text, image_url as "imageUrl", created_at as "createdAt" FROM chat_messages`;

async function isMember(conversationId, userId) {
  return !!(await prepare('SELECT 1 FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conversationId, userId));
}

async function conversationIdsOf(userId) {
  const rows = await prepare('SELECT conversation_id FROM chat_members WHERE user_id = ?').all(userId);
  return rows.map((r) => r.conversation_id);
}

let io = null;
// One user can have several live sockets (multiple tabs/devices) — track
// all of them so a REST-driven change (added to a group, someone else's
// socket action) reaches every open session, not just the first one found.
const socketsByUser = new Map();

export function getIo() {
  return io;
}

// Called by REST routes after creating a conversation or adding a member —
// makes that person's already-open sockets join the new room immediately
// and pushes them the fresh conversation object, so their conversation list
// updates live without needing a manual refresh or reconnect.
export function notifyUser(userId, event, payload) {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    if (event === 'conversation:new' && payload?.id) socket.join(payload.id);
    socket.emit(event, payload);
  }
}

// Same room-join as above but with no event emitted — for the person who
// just created the conversation via REST. They already got the conversation
// object back in that response and added it to their own list client-side,
// so a duplicate conversation:new push would be redundant; their socket
// still needs to join the room, or their own messages in it would never
// broadcast back to them.
export function joinRoom(userId, conversationId) {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) {
    io.sockets.sockets.get(socketId)?.join(conversationId);
  }
}

export function attachSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token && verifyToken(token);
    if (!payload) return next(new Error('Unauthorized'));
    const user = await prepare('SELECT id, name, role FROM users WHERE id = ?').get(payload.userId);
    if (!user) return next(new Error('Unauthorized'));
    socket.user = user;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId).add(socket.id);

    for (const conversationId of await conversationIdsOf(userId)) {
      socket.join(conversationId);
    }

    socket.on('message:send', async ({ conversationId, text, imageUrl }, ack) => {
      try {
        if (!conversationId || (!text?.trim() && !imageUrl)) {
          return ack?.({ error: 'A message needs text or an image' });
        }
        if (!(await isMember(conversationId, userId))) {
          return ack?.({ error: 'You are not a member of this conversation' });
        }
        const id = `msg-${randomUUID()}`;
        const createdAt = new Date().toISOString();
        await prepare(`INSERT INTO chat_messages (id, conversation_id, sender_id, text, image_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`).run(id, conversationId, userId, text?.trim() || null, imageUrl || null, createdAt);
        const message = { id, conversationId, senderId: userId, text: text?.trim() || null, imageUrl: imageUrl || null, createdAt };
        io.to(conversationId).emit('message:new', message);
        ack?.({ message });
      } catch (err) {
        ack?.({ error: err.message || 'Could not send message' });
      }
    });

    // Deliberately not persisted — a typing indicator is a live-only signal,
    // same as WhatsApp's, with no reason to survive a reconnect or be part
    // of message history.
    socket.on('typing', ({ conversationId, isTyping }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing', { conversationId, userId, isTyping: !!isTyping });
    });

    socket.on('disconnect', () => {
      const set = socketsByUser.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) socketsByUser.delete(userId);
      }
    });
  });

  return io;
}
