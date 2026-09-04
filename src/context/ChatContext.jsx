import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useApp } from './AppContext.jsx';

const ChatContext = createContext(null);
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

async function chatRequest(path, options = {}, token) {
  const res = await fetch(`${API_BASE}/chat${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// Best-effort desktop/OS notification for a message that just arrived in a
// conversation the person isn't currently looking at — fires regardless of
// whether the browser tab itself is focused, so it also covers "on the
// Dashboard, not the Chat page" not just "tab minimized". Silently does
// nothing anywhere the Notification API or permission isn't available;
// this is a nice-to-have, never something the rest of the app should fail on.
// Modeled on WhatsApp's own desktop notification: app name up top, "<sender>
// sent a message '<text>'" as the body, and clicking it jumps straight to
// that conversation. `tag` keeps a second message in the same conversation
// replacing the first instead of piling up as separate notifications.
function notifyOutsideApp(message, users, onClick) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  const sender = users.find((u) => u.id === message.senderId);
  const senderName = sender?.name || 'Someone';
  const body = message.text
    ? `${senderName} sent a message "${message.text}"`
    : message.imageUrl
      ? `${senderName} sent a photo`
      : message.audioUrl
        ? `${senderName} sent a voice message`
        : `${senderName} sent a message`;
  try {
    const n = new Notification('MHS TMS', { body, tag: message.conversationId, renotify: true });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    // Some contexts (older browsers, certain mobile webviews) throw on
    // `new Notification(...)` even when the API exists — not worth surfacing.
  }
}

export function ChatProvider({ children }) {
  const { currentUser, token, showToast } = useApp();
  const [conversations, setConversations] = useState([]);
  // The app-wide `users` list is department-scoped, which hides admin from
  // everyone but themself — fine for the Teams/Employees pages, wrong for
  // chat (admin should be a reachable DM/group-member candidate for
  // anyone). This is chat's own unscoped directory for exactly that.
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [typingByConversation, setTypingByConversation] = useState({});
  const [connected, setConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const socketRef = useRef(null);
  // Read inside the message:new socket handler below, which is set up once
  // per connection and would otherwise close over a stale
  // activeConversationId (or users list) from whichever render first
  // created the socket.
  const activeConversationIdRef = useRef(null);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  const usersRef = useRef(directoryUsers);
  useEffect(() => { usersRef.current = directoryUsers; }, [directoryUsers]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      setConversations(await chatRequest('/conversations', {}, token));
    } catch {
      // Silent — the list just stays stale until the next successful load,
      // not worth a toast for a background refresh.
    }
  }, [token]);

  useEffect(() => {
    if (!token) { setDirectoryUsers([]); return; }
    chatRequest('/directory', {}, token).then(setDirectoryUsers).catch(() => {});
  }, [token]);

  // One socket per signed-in session, torn down and rebuilt on login/logout
  // (not on every render) — the server itself resolves which conversations
  // to join from the token, so nothing else here needs to re-run per message.
  useEffect(() => {
    if (!currentUser || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConversations([]);
      setMessagesByConversation({});
      return undefined;
    }

    loadConversations();

    // Asked once per signed-in session rather than the moment the Chat page
    // itself loads — that way a message can trigger a real notification
    // even the first time someone gets one while on a different page.
    // Silently does nothing if the browser doesn't support the API, or the
    // person already granted/denied it previously.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => { setConnected(false); setOnlineUserIds(new Set()); });

    socket.on('presence:snapshot', (userIds) => setOnlineUserIds(new Set(userIds)));
    socket.on('presence:update', ({ userId, online }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    });

    socket.on('message:new', (message) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: [...(prev[message.conversationId] || []), message],
      }));
      // A message for the conversation someone's actively looking at right
      // now shouldn't sit there counted as unread until they switch away
      // and back — mark it read immediately, both here (so the badge never
      // even flickers on) and on the server (so it stays read on reload).
      const isActiveConversation = message.conversationId === activeConversationIdRef.current;
      if (isActiveConversation) {
        chatRequest(`/conversations/${message.conversationId}/read`, { method: 'POST' }, token).catch(() => {});
      } else if (message.senderId !== currentUser.id) {
        notifyOutsideApp(message, usersRef.current, () => {
          setActiveConversationId(message.conversationId);
          if (!window.location.hash.startsWith('#/chat')) window.location.hash = '#/chat';
        });
      }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === message.conversationId);
        if (idx === -1) return prev; // a conversation:new event brings in ones we haven't loaded yet
        const grewUnread = !isActiveConversation && message.senderId !== currentUser.id;
        const updated = {
          ...prev[idx], lastMessageId: message.id, lastMessageText: message.text, lastMessageImage: message.imageUrl,
          lastMessageAudio: message.audioUrl, lastMessageDeletedAt: null,
          lastMessageAt: message.createdAt, lastMessageSenderId: message.senderId,
          lastReadAt: isActiveConversation ? message.createdAt : prev[idx].lastReadAt,
          unreadCount: grewUnread ? (prev[idx].unreadCount || 0) + 1 : (isActiveConversation ? 0 : prev[idx].unreadCount),
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    });

    // Someone else in a conversation just read up to lastReadAt — refresh
    // their entry in that conversation's members array so read-receipt
    // ticks on my own messages can flip live instead of only after a reload.
    socket.on('conversation:read', ({ conversationId, userId, lastReadAt }) => {
      setConversations((prev) => prev.map((c) => (c.id !== conversationId ? c : {
        ...c, members: c.members.map((m) => (m.id === userId ? { ...m, lastReadAt } : m)),
      })));
    });

    socket.on('reaction:updated', ({ messageId, conversationId, reactions }) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) => (m.id === messageId ? { ...m, reactions } : m)),
      }));
    });

    socket.on('message:edited', ({ id, conversationId, text, editedAt }) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) => (m.id === id ? { ...m, text, editedAt } : m)),
      }));
      setConversations((prev) => prev.map((c) => (c.id === conversationId && c.lastMessageId === id ? { ...c, lastMessageText: text } : c)));
    });

    socket.on('message:deleted', ({ id, conversationId, deletedAt }) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) => (m.id === id ? { ...m, text: null, imageUrl: null, audioUrl: null, deletedAt } : m)),
      }));
      setConversations((prev) => prev.map((c) => (c.id === conversationId && c.lastMessageId === id
        ? { ...c, lastMessageText: null, lastMessageImage: null, lastMessageAudio: null, lastMessageDeletedAt: deletedAt }
        : c)));
    });

    socket.on('conversation:new', (conversation) => {
      setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]));
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      setTypingByConversation((prev) => {
        const current = new Set(prev[conversationId] || []);
        if (isTyping) current.add(userId); else current.delete(userId);
        return { ...prev, [conversationId]: current };
      });
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, token]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!token) return;
    try {
      const messages = await chatRequest(`/conversations/${conversationId}/messages`, {}, token);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: messages }));
    } catch (err) {
      showToast(err.message || 'Could not load messages');
    }
  }, [token, showToast]);

  const sendMessage = useCallback((conversationId, text, imageUrl, audioUrl, replyToId) => new Promise((resolve, reject) => {
    if (!socketRef.current) { reject(new Error('Not connected')); return; }
    socketRef.current.emit('message:send', { conversationId, text, imageUrl, audioUrl, replyToId }, (ack) => {
      if (ack?.error) { showToast(ack.error); reject(new Error(ack.error)); }
      else resolve(ack?.message);
    });
  }), [showToast]);

  const toggleReaction = useCallback((messageId, emoji) => new Promise((resolve, reject) => {
    if (!socketRef.current) { reject(new Error('Not connected')); return; }
    socketRef.current.emit('reaction:toggle', { messageId, emoji }, (ack) => {
      if (ack?.error) { showToast(ack.error); reject(new Error(ack.error)); }
      else resolve(ack?.reactions);
    });
  }), [showToast]);

  const editMessage = useCallback((messageId, text) => new Promise((resolve, reject) => {
    if (!socketRef.current) { reject(new Error('Not connected')); return; }
    socketRef.current.emit('message:edit', { messageId, text }, (ack) => {
      if (ack?.error) { showToast(ack.error); reject(new Error(ack.error)); }
      else resolve(ack?.message);
    });
  }), [showToast]);

  const deleteMessage = useCallback((messageId) => new Promise((resolve, reject) => {
    if (!socketRef.current) { reject(new Error('Not connected')); return; }
    socketRef.current.emit('message:delete', { messageId }, (ack) => {
      if (ack?.error) { showToast(ack.error); reject(new Error(ack.error)); }
      else resolve();
    });
  }), [showToast]);

  const uploadImage = useCallback(async (conversationId, dataUri) => {
    const result = await chatRequest('/upload', { method: 'POST', body: JSON.stringify({ conversationId, dataUri, kind: 'image' }) }, token);
    return result.imageUrl;
  }, [token]);

  const uploadAudio = useCallback(async (conversationId, dataUri) => {
    const result = await chatRequest('/upload', { method: 'POST', body: JSON.stringify({ conversationId, dataUri, kind: 'audio' }) }, token);
    return result.audioUrl;
  }, [token]);

  const createGroup = useCallback(async (name, memberIds) => {
    try {
      const result = await chatRequest('/conversations/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) }, token);
      setConversations((prev) => [result.conversation, ...prev]);
      return result.conversation;
    } catch (err) {
      showToast(err.message || 'Could not create group');
      throw err;
    }
  }, [token, showToast]);

  const startDM = useCallback(async (userId) => {
    try {
      const result = await chatRequest('/conversations/dm', { method: 'POST', body: JSON.stringify({ userId }) }, token);
      setConversations((prev) => (prev.some((c) => c.id === result.conversation.id) ? prev : [result.conversation, ...prev]));
      return result.conversation;
    } catch (err) {
      showToast(err.message || 'Could not start chat');
      throw err;
    }
  }, [token, showToast]);

  const addMember = useCallback(async (conversationId, userId) => {
    try {
      const result = await chatRequest(`/conversations/${conversationId}/members`, { method: 'POST', body: JSON.stringify({ userId }) }, token);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, members: result.members } : c)));
      return result.members;
    } catch (err) {
      showToast(err.message || 'Could not add member');
      throw err;
    }
  }, [token, showToast]);

  const removeMember = useCallback(async (conversationId, userId) => {
    try {
      await chatRequest(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' }, token);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, members: c.members.filter((m) => m.id !== userId) } : c)));
    } catch (err) {
      showToast(err.message || 'Could not remove member');
      throw err;
    }
  }, [token, showToast]);

  const markRead = useCallback((conversationId) => {
    chatRequest(`/conversations/${conversationId}/read`, { method: 'POST' }, token)
      .then(() => setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastReadAt: new Date().toISOString(), unreadCount: 0 } : c))))
      .catch(() => {});
  }, [token]);

  const setTyping = useCallback((conversationId, isTyping) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  const value = {
    conversations, activeConversationId, setActiveConversationId, directoryUsers,
    messagesByConversation, typingByConversation, connected, onlineUserIds,
    loadMessages, sendMessage, editMessage, deleteMessage, uploadImage, uploadAudio, toggleReaction,
    createGroup, startDM, addMember, removeMember, markRead, setTyping,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
