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

export function ChatProvider({ children }) {
  const { currentUser, token, showToast } = useApp();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [typingByConversation, setTypingByConversation] = useState({});
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      setConversations(await chatRequest('/conversations', {}, token));
    } catch {
      // Silent — the list just stays stale until the next successful load,
      // not worth a toast for a background refresh.
    }
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

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('message:new', (message) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: [...(prev[message.conversationId] || []), message],
      }));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === message.conversationId);
        if (idx === -1) return prev; // a conversation:new event brings in ones we haven't loaded yet
        const updated = { ...prev[idx], lastMessageText: message.text, lastMessageImage: message.imageUrl, lastMessageAt: message.createdAt };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
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

  const sendMessage = useCallback((conversationId, text, imageUrl) => new Promise((resolve, reject) => {
    if (!socketRef.current) { reject(new Error('Not connected')); return; }
    socketRef.current.emit('message:send', { conversationId, text, imageUrl }, (ack) => {
      if (ack?.error) { showToast(ack.error); reject(new Error(ack.error)); }
      else resolve(ack?.message);
    });
  }), [showToast]);

  const uploadImage = useCallback(async (conversationId, dataUri) => {
    const result = await chatRequest('/upload', { method: 'POST', body: JSON.stringify({ conversationId, dataUri }) }, token);
    return result.imageUrl;
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
      .then(() => setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastReadAt: new Date().toISOString() } : c))))
      .catch(() => {});
  }, [token]);

  const setTyping = useCallback((conversationId, isTyping) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  const value = {
    conversations, activeConversationId, setActiveConversationId,
    messagesByConversation, typingByConversation, connected,
    loadMessages, sendMessage, uploadImage, createGroup, startDM, addMember, removeMember, markRead, setTyping,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
