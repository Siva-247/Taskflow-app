import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { verifyToken } from '../auth/tokens.js';
import { prepare } from '../database/db.js';
import { reactionsForMessages } from '../database/helpers.js';

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

// Who's currently online, by user id — a person counts as online as long as
// they have at least one live socket (any tab/device), so closing one tab
// while another stays open doesn't flip them offline.
export function onlineUserIds() {
  return [...socketsByUser.keys()];
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
    const wasOffline = !socketsByUser.has(userId);
    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId).add(socket.id);

    // A newly-connected socket needs to know who's already online (it can't
    // have missed any past presence:update, since it wasn't connected yet);
    // everyone else just needs the one-line delta for this person going online.
    socket.emit('presence:snapshot', onlineUserIds());
    if (wasOffline) socket.broadcast.emit('presence:update', { userId, online: true });

    // Every listener below is registered synchronously, before the async
    // room-join that follows — a client that emits immediately after
    // connecting (a fast automated client, or just an unlucky race) would
    // otherwise have that first event silently dropped: socket.io has
    // nothing listening for it yet while this handler is still `await`ing.
    conversationIdsOf(userId).then((conversationIds) => {
      for (const conversationId of conversationIds) socket.join(conversationId);
    });

    socket.on('message:send', async ({ conversationId, text, imageUrl, audioUrl, replyToId }, ack) => {
      try {
        if (!conversationId || (!text?.trim() && !imageUrl && !audioUrl)) {
          return ack?.({ error: 'A message needs text, an image, or a voice clip' });
        }
        if (!(await isMember(conversationId, userId))) {
          return ack?.({ error: 'You are not a member of this conversation' });
        }
        // A reply must point at a real message in this same conversation —
        // otherwise silently drop the reference rather than reject the send,
        // since a stale/edited-away reply target shouldn't block sending.
        let validReplyToId = null;
        if (replyToId) {
          const target = await prepare('SELECT id FROM chat_messages WHERE id = ? AND conversation_id = ?').get(replyToId, conversationId);
          if (target) validReplyToId = target.id;
        }
        const id = `msg-${randomUUID()}`;
        const createdAt = new Date().toISOString();
        await prepare(`INSERT INTO chat_messages (id, conversation_id, sender_id, text, image_url, audio_url, reply_to_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, conversationId, userId, text?.trim() || null, imageUrl || null, audioUrl || null, validReplyToId, createdAt);
        const message = {
          id, conversationId, senderId: userId, text: text?.trim() || null, imageUrl: imageUrl || null,
          audioUrl: audioUrl || null, editedAt: null, deletedAt: null, replyToId: validReplyToId, reactions: [], createdAt,
        };
        io.to(conversationId).emit('message:new', message);
        ack?.({ message });
      } catch (err) {
        ack?.({ error: err.message || 'Could not send message' });
      }
    });

    // Toggling the SAME emoji removes it; picking a different one replaces
    // it — one reaction per person per message, enforced by the unique
    // index on (message_id, user_id) as the real backstop.
    socket.on('reaction:toggle', async ({ messageId, emoji }, ack) => {
      try {
        if (!messageId || !emoji) return ack?.({ error: 'messageId and emoji are required' });
        const existing = await prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId);
        if (!existing) return ack?.({ error: 'Message not found' });
        if (!(await isMember(existing.conversation_id, userId))) return ack?.({ error: 'You are not a member of this conversation' });

        const mine = await prepare('SELECT id, emoji FROM chat_reactions WHERE message_id = ? AND user_id = ?').get(messageId, userId);
        if (mine && mine.emoji === emoji) {
          await prepare('DELETE FROM chat_reactions WHERE id = ?').run(mine.id);
        } else if (mine) {
          await prepare('UPDATE chat_reactions SET emoji = ?, created_at = ? WHERE id = ?').run(emoji, new Date().toISOString(), mine.id);
        } else {
          await prepare('INSERT INTO chat_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(`rx-${randomUUID()}`, messageId, userId, emoji, new Date().toISOString());
        }

        const reactions = (await reactionsForMessages([messageId])).get(messageId) || [];
        const payload = { messageId, conversationId: existing.conversation_id, reactions };
        io.to(existing.conversation_id).emit('reaction:updated', payload);
        ack?.({ reactions });
      } catch (err) {
        ack?.({ error: err.message || 'Could not update reaction' });
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
        if (set.size === 0) {
          socketsByUser.delete(userId);
          socket.broadcast.emit('presence:update', { userId, online: false });
        }
      }
    });
  });

  return io;
}
