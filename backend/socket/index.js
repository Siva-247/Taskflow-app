import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { verifyToken } from '../auth/tokens.js';
import { prepare } from '../database/db.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;

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

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId).add(socket.id);

    // Every listener below is registered synchronously, before the async
    // room-join that follows — a client that emits immediately after
    // connecting (a fast automated client, or just an unlucky race) would
    // otherwise have that first event silently dropped: socket.io has
    // nothing listening for it yet while this handler is still `await`ing.
    conversationIdsOf(userId).then((conversationIds) => {
      for (const conversationId of conversationIds) socket.join(conversationId);
    });

    socket.on('message:send', async ({ conversationId, text, imageUrl, audioUrl }, ack) => {
      try {
        if (!conversationId || (!text?.trim() && !imageUrl && !audioUrl)) {
          return ack?.({ error: 'A message needs text, an image, or a voice clip' });
        }
        if (!(await isMember(conversationId, userId))) {
          return ack?.({ error: 'You are not a member of this conversation' });
        }
        const id = `msg-${randomUUID()}`;
        const createdAt = new Date().toISOString();
        await prepare(`INSERT INTO chat_messages (id, conversation_id, sender_id, text, image_url, audio_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, conversationId, userId, text?.trim() || null, imageUrl || null, audioUrl || null, createdAt);
        const message = {
          id, conversationId, senderId: userId, text: text?.trim() || null, imageUrl: imageUrl || null,
          audioUrl: audioUrl || null, editedAt: null, deletedAt: null, createdAt,
        };
        io.to(conversationId).emit('message:new', message);
        ack?.({ message });
      } catch (err) {
        ack?.({ error: err.message || 'Could not send message' });
      }
    });

    // Editing is sender-only and time-boxed — past 15 minutes the option is
    // simply gone, matching how the frontend hides it, but this is the real
    // enforcement since a client can't be trusted to police its own edits.
    socket.on('message:edit', async ({ messageId, text }, ack) => {
      try {
        const trimmed = (text || '').trim();
        if (!messageId || !trimmed) return ack?.({ error: 'A message needs text' });
        const existing = await prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
        if (!existing) return ack?.({ error: 'Message not found' });
        if (existing.sender_id !== userId) return ack?.({ error: 'You can only edit your own messages' });
        if (existing.deleted_at) return ack?.({ error: 'This message was deleted' });
        if (Date.now() - new Date(existing.created_at).getTime() > EDIT_WINDOW_MS) {
          return ack?.({ error: 'This message is too old to edit (15 minute window)' });
        }
        const editedAt = new Date().toISOString();
        await prepare('UPDATE chat_messages SET text = ?, edited_at = ? WHERE id = ?').run(trimmed, editedAt, messageId);
        const payload = { id: messageId, conversationId: existing.conversation_id, text: trimmed, editedAt };
        io.to(existing.conversation_id).emit('message:edited', payload);
        ack?.({ message: payload });
      } catch (err) {
        ack?.({ error: err.message || 'Could not edit message' });
      }
    });

    // Delete is also sender-only and time-boxed (2 hours), and clears the
    // actual content rather than just flagging it hidden — same as
    // WhatsApp, the text/image/voice clip themselves are gone, not just
    // hidden from view, so there's nothing left to recover client-side.
    socket.on('message:delete', async ({ messageId }, ack) => {
      try {
        if (!messageId) return ack?.({ error: 'messageId is required' });
        const existing = await prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
        if (!existing) return ack?.({ error: 'Message not found' });
        if (existing.sender_id !== userId) return ack?.({ error: 'You can only delete your own messages' });
        if (existing.deleted_at) return ack?.({ ok: true }); // already deleted, nothing to do
        if (Date.now() - new Date(existing.created_at).getTime() > DELETE_WINDOW_MS) {
          return ack?.({ error: 'This message is too old to delete (2 hour window)' });
        }
        const deletedAt = new Date().toISOString();
        await prepare('UPDATE chat_messages SET text = NULL, image_url = NULL, audio_url = NULL, deleted_at = ? WHERE id = ?')
          .run(deletedAt, messageId);
        const payload = { id: messageId, conversationId: existing.conversation_id, deletedAt };
        io.to(existing.conversation_id).emit('message:deleted', payload);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message || 'Could not delete message' });
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
