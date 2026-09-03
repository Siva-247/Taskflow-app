import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Avatar, Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import {
  IconPlusCircle, IconSend, IconImage, IconSearch, IconMic, IconStopCircle, IconTrash, IconEdit, IconCheck, IconX,
  IconSmile, IconReply, IconDotsVertical, IconCheckDouble, IconArrowRight,
} from '../components/icons.jsx';

const CAN_CREATE_GROUP = [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAM_LEAD];
// Mirrors the server's own enforcement in backend/socket/index.js — these
// only drive which options the UI offers; the socket handlers are what
// actually reject an edit/delete outside the window.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const COMPOSER_EMOJIS = [
  '😀', '😂', '🥲', '😊', '😍', '🤔', '😅', '😎', '🙌', '👍', '👏', '🙏',
  '❤️', '🔥', '🎉', '✅', '👀', '💡', '🚀', '😢', '😮', '🤝', '📌', '⏰',
];
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;!?)\]'"])/gi;

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMessageTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function calendarDayKey(iso) {
  return new Date(iso).toDateString();
}

function formatDaySeparator(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
}

// Splits message text on "@Name" for any name that's actually a member of
// this conversation (highlighted) and on bare URLs (turned into clickable
// links) — mentions are matched first so a URL can never split a name apart.
function renderMessageText(text, members, mine) {
  const names = [...members].map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionPattern = escaped.length ? new RegExp(`@(${escaped.join('|')})\\b`, 'g') : null;

  const linkifyPlain = (chunk, keyPrefix) => {
    const parts = [];
    let last = 0;
    let match = URL_PATTERN.exec(chunk);
    while (match !== null) {
      if (match.index > last) parts.push(chunk.slice(last, match.index));
      const href = match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
      parts.push(
        <a
          key={`${keyPrefix}-l${match.index}`}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          style={{ color: mine ? '#FFFFFF' : 'var(--accent-dark)', textDecoration: 'underline', textUnderlineOffset: 2, fontWeight: 600 }}
        >
          {match[1]}
        </a>,
      );
      last = match.index + match[0].length;
      match = URL_PATTERN.exec(chunk);
    }
    if (last < chunk.length) parts.push(chunk.slice(last));
    return parts;
  };

  if (!mentionPattern) return linkifyPlain(text, 'm0');

  const parts = [];
  let lastIndex = 0;
  let match = mentionPattern.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) parts.push(...linkifyPlain(text.slice(lastIndex, match.index), `m${match.index}`));
    parts.push(
      <span
        key={match.index}
        style={{
          fontWeight: 800, borderRadius: 4, padding: '1px 4px',
          background: mine ? 'rgba(255,255,255,0.28)' : 'var(--accent-soft)',
          color: mine ? '#FFFFFF' : 'var(--accent-dark)',
        }}
      >
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
    match = mentionPattern.exec(text);
  }
  if (lastIndex < text.length) parts.push(...linkifyPlain(text.slice(lastIndex), `mend`));
  return parts;
}

// A short one-line summary for a reply-quote preview or a group's last
// message — image/voice/deleted don't have text, so this fills in for those.
function messageSummary(m) {
  if (!m) return '';
  if (m.deletedAt) return 'This message was deleted';
  if (m.text) return m.text;
  if (m.imageUrl) return '📷 Photo';
  if (m.audioUrl) return '🎤 Voice message';
  return '';
}

export default function Chat() {
  const { currentUser, users, showToast } = useApp();
  const {
    conversations, activeConversationId, setActiveConversationId, messagesByConversation, typingByConversation,
    connected, onlineUserIds, loadMessages, sendMessage, editMessage, deleteMessage, uploadImage, uploadAudio,
    toggleReaction, createGroup, startDM, addMember, removeMember, markRead, setTyping,
  } = useChat();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [openMenuMessageId, setOpenMenuMessageId] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const composerRef = useRef(null);
  const messageNodesRef = useRef(new Map());
  const dividerBaselineRef = useRef({});
  const highlightTimeoutRef = useRef(null);

  const canCreateGroup = CAN_CREATE_GROUP.includes(currentUser.role);
  const active = conversations.find((c) => c.id === activeConversationId) || null;
  const messages = activeConversationId ? (messagesByConversation[activeConversationId] || []) : [];
  const typingUserIds = activeConversationId ? [...(typingByConversation[activeConversationId] || [])].filter((id) => id !== currentUser.id) : [];

  const filteredConversations = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => conversationLabelFor(c, currentUser).toLowerCase().includes(q));
  }, [conversations, listSearch, currentUser]);

  const visibleMessages = useMemo(() => {
    const q = threadSearchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.text || '').toLowerCase().includes(q));
  }, [messages, threadSearchQuery]);

  // A trailing "@word" at the very end of the draft triggers the mention
  // picker — e.g. typing "hey @po" while the cursor sits right after it.
  // Simpler than tracking real caret position, and covers the common case
  // of mentioning someone as you're typing rather than editing mid-sentence.
  const mentionMatch = /(?:^|\s)@(\w*)$/.exec(draft);
  const mentionQuery = mentionMatch ? mentionMatch[1] : null;
  const mentionCandidates = active && mentionQuery !== null
    ? active.members.filter((m) => m.id !== currentUser.id && m.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const insertMention = (name) => {
    setDraft((prev) => prev.replace(/(^|\s)@(\w*)$/, (whole, prefix) => `${prefix}@${name} `));
  };

  // Freezes "where should the new-messages divider sit" the instant a
  // conversation is opened, from whatever lastReadAt was BEFORE this visit
  // marks it read — otherwise the divider would vanish the moment markRead
  // resolves, instead of staying put for the rest of this visit.
  useEffect(() => {
    if (activeConversationId && !(activeConversationId in dividerBaselineRef.current)) {
      dividerBaselineRef.current[activeConversationId] = active?.lastReadAt || null;
    }
  }, [activeConversationId, active?.lastReadAt]);

  const dividerMessageId = useMemo(() => {
    if (!activeConversationId) return null;
    const baseline = dividerBaselineRef.current[activeConversationId];
    if (baseline === undefined) return null;
    const firstUnread = messages.find((m) => m.senderId !== currentUser.id && (!baseline || m.createdAt > baseline));
    return firstUnread?.id || null;
  }, [messages, activeConversationId, currentUser.id]);

  useEffect(() => {
    if (!activeConversationId) return undefined;
    delete dividerBaselineRef.current[activeConversationId];
    setLoadingMessages(true);
    setThreadSearchOpen(false);
    setThreadSearchQuery('');
    setReplyingTo(null);
    loadMessages(activeConversationId).finally(() => setLoadingMessages(false));
    markRead(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Stops the mic and clears the tick timer if someone navigates away
  // mid-recording — otherwise the stream (and the browser's "mic in use"
  // indicator) would keep running after the page unmounts.
  useEffect(() => () => {
    window.clearInterval(recordingTimerRef.current);
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    window.clearTimeout(highlightTimeoutRef.current);
  }, []);

  // Grows the composer with a multi-line draft (Shift+Enter adds a line)
  // and shrinks it back down once text is removed, capped so a long paste
  // doesn't push the whole thread panel around.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const conversationLabel = (c) => conversationLabelFor(c, currentUser);
  const conversationAvatarInitial = (c) => {
    if (c.type === 'group') return c.name?.slice(0, 2).toUpperCase() || 'GR';
    const other = c.members.find((m) => m.id !== currentUser.id);
    return other?.initial || '?';
  };
  const otherMemberOf = (c) => (c.type === 'dm' ? c.members.find((m) => m.id !== currentUser.id) : null);
  const isUnread = (c) => (c.unreadCount || 0) > 0;

  const scrollToMessage = (id) => {
    const node = messageNodesRef.current.get(id);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(id);
    window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedMessageId(null), 1400);
  };

  // A message I sent counts as "read" once every other member of the
  // conversation has read up to at least its own timestamp — reuses the
  // per-conversation lastReadAt already tracked per member rather than
  // needing separate per-message delivery/read rows.
  const readStatus = (m) => {
    if (m.senderId !== currentUser.id || !active) return null;
    const others = active.members.filter((mem) => mem.id !== currentUser.id);
    if (others.length === 0) return 'sent';
    return others.every((mem) => mem.lastReadAt && mem.lastReadAt >= m.createdAt) ? 'read' : 'sent';
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeConversationId) return;
    setSending(true);
    setDraft('');
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);
    setTyping(activeConversationId, false);
    try {
      await sendMessage(activeConversationId, text, null, null, replyToId);
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (val) => {
    setDraft(val);
    if (!activeConversationId) return;
    setTyping(activeConversationId, true);
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => setTyping(activeConversationId, false), 2000);
  };

  const insertEmoji = (emoji) => {
    setDraft((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleComposerKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return; // Shift+Enter inserts a newline instead of sending
    e.preventDefault();
    if (!sending && draft.trim()) handleSend();
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeConversationId) return;
    if (file.size > 8 * 1024 * 1024) { return; }
    setSending(true);
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);
    try {
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const imageUrl = await uploadImage(activeConversationId, dataUri);
      await sendMessage(activeConversationId, '', imageUrl, null, replyToId);
    } finally {
      setSending(false);
    }
  };

  const stopRecordingStream = () => {
    window.clearInterval(recordingTimerRef.current);
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    if (!activeConversationId || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = window.MediaRecorder?.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setRecording(true);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      showToast('Microphone access is needed to record a voice message');
    }
  };

  // Stops recording without sending — used for the cancel (×) button.
  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.stop();
    }
    audioChunksRef.current = [];
    stopRecordingStream();
  };

  const finishRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);
    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      audioChunksRef.current = [];
      if (blob.size > 0 && activeConversationId) {
        setSending(true);
        try {
          const dataUri = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const audioUrl = await uploadAudio(activeConversationId, dataUri);
          await sendMessage(activeConversationId, '', null, audioUrl, replyToId);
        } finally {
          setSending(false);
        }
      }
    };
    recorder.stop();
    stopRecordingStream();
  };

  const canEditMessage = (m) => m.senderId === currentUser.id && !m.deletedAt && Date.now() - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;
  const canDeleteMessage = (m) => m.senderId === currentUser.id && !m.deletedAt && Date.now() - new Date(m.createdAt).getTime() <= DELETE_WINDOW_MS;

  const startEditMessage = (m) => {
    setEditingMessageId(m.id);
    setEditDraft(m.text || '');
    setOpenMenuMessageId(null);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const submitEditMessage = async () => {
    const text = editDraft.trim();
    const messageId = editingMessageId;
    if (!text || !messageId) { cancelEditMessage(); return; }
    try {
      await editMessage(messageId, text);
    } finally {
      cancelEditMessage();
    }
  };

  const handleDeleteMessage = async (m) => {
    setOpenMenuMessageId(null);
    try {
      await deleteMessage(m.id);
    } catch {
      // ChatContext already surfaced a toast for this.
    }
  };

  const handleReact = async (m, emoji) => {
    setReactionPickerId(null);
    try {
      await toggleReaction(m.id, emoji);
    } catch {
      // ChatContext already surfaced a toast for this.
    }
  };

  const closeAllPopovers = () => {
    setOpenMenuMessageId(null);
    setReactionPickerId(null);
  };

  return (
    <div
      className="responsive-grid chat-shell"
      style={{ display: 'grid', '--cols': '360px 1fr', '--cols-tablet': '1fr', gap: 18, height: 'calc(100vh - 132px)', minHeight: 480 }}
    >
      <div className={`chat-list-panel${activeConversationId ? ' has-active' : ''}`} style={panelStyle}>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--heading)' }}>Chats</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {canCreateGroup && (
                <button type="button" onClick={() => setShowNewGroup(true)} title="New group" style={iconBtnStyle}>
                  <IconPlusCircle size={16} color="var(--accent-dark)" />
                </button>
              )}
              <button type="button" onClick={() => setShowNewDM(true)} title="New chat" style={iconBtnStyle}>
                <IconEdit size={15} color="var(--accent-dark)" />
              </button>
            </div>
          </div>
          <div style={searchFieldStyle}>
            <IconSearch size={14} color="var(--text-muted)" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search chats"
              style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13, color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={emptyStateStyle}>
              No chats yet. Start one with the compose icon above{canCreateGroup ? ', or create a group.' : '.'}
            </div>
          )}
          {conversations.length > 0 && filteredConversations.length === 0 && (
            <div style={emptyStateStyle}>No chats match “{listSearch}”.</div>
          )}
          {filteredConversations.map((c) => {
            const other = otherMemberOf(c);
            const online = other && onlineUserIds.has(other.id);
            const unread = isUnread(c);
            return (
              <div
                key={c.id}
                onClick={() => setActiveConversationId(c.id)}
                className="chat-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '11px 18px', cursor: 'pointer',
                  background: c.id === activeConversationId ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: c.id === activeConversationId ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar initial={conversationAvatarInitial(c)} size={44} gradient={c.type === 'group'} />
                  {c.type === 'dm' && (
                    <span style={{
                      position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: 999,
                      background: online ? '#22C55E' : 'var(--text-muted)', border: '2px solid #FFFFFF',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: unread ? 800 : 600, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conversationLabel(c)}
                    </span>
                    {c.lastMessageAt && <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: unread ? 700 : 500, fontSize: 11, color: unread ? 'var(--accent-dark)' : 'var(--text-muted)', flexShrink: 0 }}>{formatMessageTime(c.lastMessageAt)}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: unread ? 700 : 500, fontSize: 12.5, color: unread ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.type === 'group' && c.lastMessageSenderId && !c.lastMessageDeletedAt && `${c.lastMessageSenderId === currentUser.id ? 'You' : users.find((u) => u.id === c.lastMessageSenderId)?.name?.split(' ')[0] || ''}: `}
                      {c.lastMessageDeletedAt ? 'This message was deleted'
                        : c.lastMessageText || (c.lastMessageImage ? '📷 Photo' : c.lastMessageAudio ? '🎤 Voice message' : 'No messages yet')}
                    </span>
                    {unread && (
                      <span style={{
                        minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: '#FFFFFF',
                      }}>
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`chat-thread-panel${activeConversationId ? ' has-active' : ''}`} style={panelStyle}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, ...bgPatternStyle }}>
            <div style={{ width: 72, height: 72, borderRadius: 999, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconSend size={26} color="var(--accent)" />
            </div>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--heading)' }}>Select a chat to start messaging</div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 12.5, color: 'var(--text-muted)' }}>Your conversations stay private to their members.</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setActiveConversationId(null)} className="chat-back-btn" style={{ ...iconBtnStyle, display: 'none' }} title="Back to chats">
                <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
                  <IconArrowRight size={15} color="var(--text-secondary)" />
                </span>
              </button>
              <div
                onClick={() => active.type === 'group' && setShowGroupInfo(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: active.type === 'group' ? 'pointer' : 'default', flex: 1, minWidth: 0 }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar initial={conversationAvatarInitial(active)} size={38} gradient={active.type === 'group'} />
                  {active.type === 'dm' && onlineUserIds.has(otherMemberOf(active)?.id) && (
                    <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 999, background: '#22C55E', border: '2px solid #FFFFFF' }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversationLabel(active)}</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {active.type === 'group'
                      ? `${active.members.length} members`
                      : (onlineUserIds.has(otherMemberOf(active)?.id) ? 'Online' : (connected ? 'Offline' : 'Connecting…'))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { setThreadSearchOpen((v) => !v); if (threadSearchOpen) setThreadSearchQuery(''); }}
                  title="Search in conversation"
                  style={{ ...iconBtnStyle, background: threadSearchOpen ? 'var(--accent-soft)' : '#FFFFFF' }}
                >
                  <IconSearch size={14} color={threadSearchOpen ? 'var(--accent-dark)' : 'var(--text-secondary)'} />
                </button>
                {active.type === 'group' && (
                  <div style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setThreadMenuOpen((v) => !v)} title="More options" style={iconBtnStyle}>
                      <IconDotsVertical size={16} />
                    </button>
                    {threadMenuOpen && (
                      <div style={dropdownStyle}>
                        <div style={menuItemStyle} onClick={() => { setThreadMenuOpen(false); setShowGroupInfo(true); }}>Group info</div>
                        <div
                          style={{ ...menuItemStyle, color: 'var(--amber-text)' }}
                          onClick={() => { setThreadMenuOpen(false); removeMember(active.id, currentUser.id); setActiveConversationId(null); }}
                        >
                          Leave group
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {threadSearchOpen && (
              <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--field-bg)' }}>
                <div style={searchFieldStyle}>
                  <IconSearch size={14} color="var(--text-muted)" />
                  <input
                    autoFocus
                    value={threadSearchQuery}
                    onChange={(e) => setThreadSearchQuery(e.target.value)}
                    placeholder="Search in this conversation"
                    style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13, color: 'var(--text-primary)' }}
                  />
                </div>
                {threadSearchQuery.trim() && (
                  <div style={{ marginTop: 6, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {visibleMessages.length} result{visibleMessages.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            )}

            <div onClick={closeAllPopovers} style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 3, ...bgPatternStyle }}>
              {loadingMessages ? (
                <MessagesSkeleton />
              ) : visibleMessages.length === 0 && threadSearchQuery.trim() ? (
                <div style={{ margin: 'auto', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
                  No messages match “{threadSearchQuery}”.
                </div>
              ) : (
                visibleMessages.map((m, i) => {
                  const mine = m.senderId === currentUser.id;
                  const sender = users.find((u) => u.id === m.senderId);
                  const isEditing = editingMessageId === m.id;
                  const isDeleted = !!m.deletedAt;
                  const menuOpen = openMenuMessageId === m.id;
                  const pickerOpen = reactionPickerId === m.id;
                  const prev = visibleMessages[i - 1];
                  const showDaySeparator = !prev || calendarDayKey(prev.createdAt) !== calendarDayKey(m.createdAt);
                  const repliedMsg = m.replyToId ? messages.find((x) => x.id === m.replyToId) : null;
                  const status = readStatus(m);
                  const highlighted = highlightedMessageId === m.id;
                  return (
                    <React.Fragment key={m.id}>
                      {showDaySeparator && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                          <span style={{
                            background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 14px',
                            fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-muted)',
                          }}>
                            {formatDaySeparator(m.createdAt)}
                          </span>
                        </div>
                      )}
                      {dividerMessageId === m.id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
                          <div style={{ flex: 1, height: 1, background: 'var(--amber-fill)', opacity: 0.5 }} />
                          <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: 'var(--amber-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>New messages</span>
                          <div style={{ flex: 1, height: 1, background: 'var(--amber-fill)', opacity: 0.5 }} />
                        </div>
                      )}
                      <div
                        ref={(el) => { if (el) messageNodesRef.current.set(m.id, el); else messageNodesRef.current.delete(m.id); }}
                        className="chat-bubble-row"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', padding: '3px 0' }}
                      >
                        {active.type === 'group' && !mine && (
                          <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', marginBottom: 2, marginLeft: 4 }}>{sender?.name}</span>
                        )}
                        <div
                          style={{
                            position: 'relative', maxWidth: 'min(70%, 480px)', display: 'flex', alignItems: 'flex-end', gap: 4,
                            flexDirection: mine ? 'row-reverse' : 'row',
                          }}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              padding: m.imageUrl && !isDeleted ? 6 : '9px 13px', borderRadius: 16,
                              borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4,
                              background: isDeleted ? 'var(--field-bg)' : (mine ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' : '#FFFFFF'),
                              color: mine && !isDeleted ? '#FFFFFF' : 'var(--text-primary)',
                              border: mine || isDeleted ? 'none' : '1px solid var(--border)',
                              boxShadow: mine && !isDeleted ? '0 4px 14px -6px rgba(91,33,182,0.45)' : '0 1px 2px rgba(59,30,112,0.04)',
                              outline: highlighted ? '2px solid var(--accent-mid)' : 'none',
                              outlineOffset: 2, transition: 'outline-color 0.2s ease',
                            }}
                          >
                            {isDeleted && (
                              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontStyle: 'italic', fontSize: 13, opacity: 0.75 }}>
                                This message was deleted
                              </div>
                            )}
                            {!isDeleted && isEditing && (
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minWidth: 180 }} onClick={(e) => e.stopPropagation()}>
                                <textarea
                                  autoFocus
                                  rows={1}
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEditMessage(); }
                                    if (e.key === 'Escape') cancelEditMessage();
                                  }}
                                  style={{
                                    flex: 1, border: 'none', outline: 'none', background: 'rgba(255,255,255,0.18)',
                                    borderRadius: 7, padding: '5px 8px', fontFamily: "'Manrope',system-ui,sans-serif",
                                    fontWeight: 500, fontSize: 13.5, color: mine ? '#FFFFFF' : 'var(--text-primary)',
                                    resize: 'none', maxHeight: 120, overflowY: 'auto',
                                  }}
                                />
                                <button type="button" onClick={submitEditMessage} title="Save" style={{ ...bubbleIconBtnStyle, background: 'rgba(255,255,255,0.22)' }}>
                                  <IconCheck size={12} color={mine ? '#FFFFFF' : 'var(--accent-dark)'} />
                                </button>
                                <button type="button" onClick={cancelEditMessage} title="Cancel" style={{ ...bubbleIconBtnStyle, background: 'rgba(255,255,255,0.22)' }}>
                                  <IconX size={12} color={mine ? '#FFFFFF' : 'var(--text-primary)'} />
                                </button>
                              </div>
                            )}
                            {!isDeleted && !isEditing && (
                              <>
                                {repliedMsg && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); scrollToMessage(repliedMsg.id); }}
                                    style={{
                                      display: 'flex', flexDirection: 'column', gap: 1, padding: '6px 9px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                                      background: mine ? 'rgba(255,255,255,0.16)' : 'var(--field-bg)',
                                      borderLeft: `3px solid ${mine ? 'rgba(255,255,255,0.55)' : 'var(--accent)'}`,
                                    }}
                                  >
                                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: mine ? 'rgba(255,255,255,0.85)' : 'var(--accent-dark)' }}>
                                      {repliedMsg.senderId === currentUser.id ? 'You' : users.find((u) => u.id === repliedMsg.senderId)?.name || 'Someone'}
                                    </span>
                                    <span style={{
                                      fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, opacity: 0.85,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240,
                                    }}>
                                      {messageSummary(repliedMsg)}
                                    </span>
                                  </div>
                                )}
                                {m.imageUrl && <img src={m.imageUrl} alt="Shared" style={{ maxWidth: '100%', borderRadius: 10, display: 'block' }} />}
                                {m.audioUrl && (
                                  <audio controls src={m.audioUrl} style={{ display: 'block', width: 220, maxWidth: '100%' }} />
                                )}
                                {m.text && (
                                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: m.imageUrl ? 6 : 0, padding: m.imageUrl ? '0 6px' : 0 }}>
                                    {renderMessageText(m.text, active.members, mine)}
                                    {m.editedAt && (
                                      <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.7, marginLeft: 6 }}>(edited)</span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {!isDeleted && !isEditing && (
                            <div className="chat-bubble-toolbar" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s ease' }}>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setReactionPickerId((prevId) => (prevId === m.id ? null : m.id)); setOpenMenuMessageId(null); }} title="React" style={hoverToolBtnStyle}>
                                <IconSmile size={14} />
                              </button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(m); composerRef.current?.focus(); }} title="Reply" style={hoverToolBtnStyle}>
                                <IconReply size={14} />
                              </button>
                              {(canEditMessage(m) || canDeleteMessage(m)) && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setOpenMenuMessageId((prevId) => (prevId === m.id ? null : m.id)); setReactionPickerId(null); }} title="More" style={hoverToolBtnStyle}>
                                  <IconDotsVertical size={14} />
                                </button>
                              )}
                            </div>
                          )}

                          {pickerOpen && (
                            <div onClick={(e) => e.stopPropagation()} style={{ ...popoverStyle, [mine ? 'right' : 'left']: 0, bottom: '100%', marginBottom: 6, display: 'flex', gap: 4, padding: '6px 8px' }}>
                              {REACTION_EMOJIS.map((emoji) => (
                                <span key={emoji} onClick={() => handleReact(m, emoji)} style={{ fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 3, borderRadius: 6 }}>{emoji}</span>
                              ))}
                            </div>
                          )}

                          {menuOpen && (
                            <div onClick={(e) => e.stopPropagation()} style={{ ...popoverStyle, [mine ? 'right' : 'left']: 0, top: '100%', marginTop: 4, minWidth: 130 }}>
                              {canEditMessage(m) && m.text && (
                                <div onClick={() => startEditMessage(m)} style={menuItemStyle}>
                                  <IconEdit size={13} /> <span>Edit</span>
                                </div>
                              )}
                              {canDeleteMessage(m) && (
                                <div onClick={() => handleDeleteMessage(m)} style={menuItemStyle}>
                                  <IconTrash size={13} /> <span style={{ color: 'var(--amber-text)' }}>Delete</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {m.reactions?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                            {m.reactions.map((r) => {
                              const reactedByMe = r.userIds.includes(currentUser.id);
                              return (
                                <span
                                  key={r.emoji}
                                  onClick={() => handleReact(m, r.emoji)}
                                  title={r.userIds.map((id) => (id === currentUser.id ? 'You' : users.find((u) => u.id === id)?.name || '')).filter(Boolean).join(', ')}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, cursor: 'pointer',
                                    background: reactedByMe ? 'var(--accent-soft)' : '#FFFFFF', border: `1px solid ${reactedByMe ? 'var(--accent)' : 'var(--border)'}`,
                                    fontSize: 12,
                                  }}
                                >
                                  <span>{r.emoji}</span>
                                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: reactedByMe ? 'var(--accent-dark)' : 'var(--text-muted)' }}>{r.userIds.length}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 10.5, color: 'var(--text-muted)' }}>{formatMessageTime(m.createdAt)}</span>
                          {status === 'sent' && <IconCheck size={11} color="var(--text-muted)" />}
                          {status === 'read' && <IconCheckDouble size={13} color="var(--accent)" />}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              {typingUserIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <span className="typing-dots" style={{ display: 'inline-flex', gap: 3, padding: '8px 12px', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14 }}>
                    <i /><i /><i />
                  </span>
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {typingUserIds.map((id) => users.find((u) => u.id === id)?.name?.split(' ')[0] || 'Someone').join(', ')} typing
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {replyingTo && (
              <div style={{ padding: '9px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--field-bg)' }}>
                <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--accent)', borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)' }}>
                    Replying to {replyingTo.senderId === currentUser.id ? 'yourself' : users.find((u) => u.id === replyingTo.senderId)?.name || 'someone'}
                  </div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {messageSummary(replyingTo)}
                  </div>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} style={iconBtnStyle} title="Cancel reply">
                  <IconX size={14} />
                </button>
              </div>
            )}

            <div style={{ position: 'relative', padding: '12px 18px', borderTop: replyingTo ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {mentionCandidates.length > 0 && (
                <div style={{ ...popoverStyle, left: 18, right: 18, bottom: '100%', marginBottom: 6 }}>
                  {mentionCandidates.map((m) => (
                    <div
                      key={m.id}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <Avatar initial={m.initial} size={22} />
                      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {showEmojiPicker && (
                <div style={{ ...popoverStyle, left: 18, bottom: '100%', marginBottom: 6, width: 240, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 2, padding: 8 }}>
                  {COMPOSER_EMOJIS.map((emoji) => (
                    <span key={emoji} onClick={() => insertEmoji(emoji)} style={{ fontSize: 19, textAlign: 'center', cursor: 'pointer', padding: 5, borderRadius: 6, lineHeight: 1 }}>{emoji}</span>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
              {recording ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={cancelRecording} title="Cancel" style={iconBtnStyle}>
                    <IconX size={16} />
                  </button>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--amber-text)', animation: 'pulse 1.2s infinite' }} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      Recording… {formatDuration(recordingSeconds)}
                    </span>
                  </div>
                  <Button variant="primary" style={{ padding: '10px 14px' }} onClick={finishRecording}>
                    <IconStopCircle size={15} />
                  </Button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => setShowEmojiPicker((v) => !v)} disabled={sending} style={iconBtnStyle} title="Emoji">
                    <IconSmile size={18} color={showEmojiPicker ? 'var(--accent-dark)' : 'var(--text-secondary)'} />
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending} style={iconBtnStyle} title="Share an image">
                    <IconImage size={18} />
                  </button>
                  <div style={{ flex: 1 }}>
                    <textarea
                      ref={composerRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      onFocus={() => setShowEmojiPicker(false)}
                      placeholder="Type a message… (@ to mention, Enter to send, Shift+Enter for a new line)"
                      className="chat-composer-input"
                      style={composerTextareaStyle}
                    />
                  </div>
                  {draft.trim() ? (
                    <Button variant="primary" style={{ padding: '10px 14px' }} onClick={handleSend} disabled={sending}>
                      <IconSend size={15} />
                    </Button>
                  ) : (
                    <button type="button" onClick={startRecording} disabled={sending} style={iconBtnStyle} title="Record a voice message">
                      <IconMic size={18} color="var(--accent-dark)" />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreate={async (name, memberIds) => {
            const conversation = await createGroup(name, memberIds);
            setShowNewGroup(false);
            setActiveConversationId(conversation.id);
          }}
        />
      )}

      {showNewDM && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          onPick={async (userId) => {
            const conversation = await startDM(userId);
            setShowNewDM(false);
            setActiveConversationId(conversation.id);
          }}
        />
      )}

      {showGroupInfo && active?.type === 'group' && (
        <GroupInfoModal
          conversation={active}
          onClose={() => setShowGroupInfo(false)}
          onAddMember={(userId) => addMember(active.id, userId)}
          onRemoveMember={(userId) => removeMember(active.id, userId)}
        />
      )}
    </div>
  );
}

function conversationLabelFor(c, currentUser) {
  if (c.type === 'group') return c.name;
  const other = c.members.find((m) => m.id !== currentUser.id);
  return other?.name || 'Unknown';
}

function MessagesSkeleton() {
  const widths = [180, 240, 140, 210, 160];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      {widths.map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
          <div className="chat-skeleton-pulse" style={{ width: w, height: 34, borderRadius: 14, background: 'var(--field-bg)', border: '1px solid var(--border)' }} />
        </div>
      ))}
    </div>
  );
}

const panelStyle = {
  display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid var(--border)',
  borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--card-shadow)',
};

const bgPatternStyle = {
  backgroundColor: 'var(--page-bg)',
  backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

const emptyStateStyle = {
  padding: '36px 20px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
};

const searchFieldStyle = {
  display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 10,
  padding: '8px 12px', background: 'var(--field-bg)',
};

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9,
  border: '1px solid var(--border)', background: '#FFFFFF', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s ease, box-shadow 0.15s ease',
};

const hoverToolBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999,
  border: '1px solid var(--border)', background: '#FFFFFF', cursor: 'pointer', flexShrink: 0, color: 'var(--text-secondary)',
  boxShadow: '0 2px 6px -2px rgba(59,30,112,0.2)',
};

const bubbleIconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6,
  border: 'none', cursor: 'pointer', flexShrink: 0,
};

const popoverStyle = {
  position: 'absolute', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 12,
  boxShadow: '0 14px 32px -12px rgba(59,30,112,0.3)', overflow: 'hidden', zIndex: 30,
};

const dropdownStyle = {
  position: 'absolute', top: 40, right: 0, background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10,
  boxShadow: '0 14px 32px -12px rgba(59,30,112,0.3)', overflow: 'hidden', zIndex: 30, minWidth: 150,
};

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', cursor: 'pointer',
  fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', whiteSpace: 'nowrap',
};

const composerTextareaStyle = {
  width: '100%', padding: '11px 15px', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--field-bg)',
  fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)',
  resize: 'none', maxHeight: 120, overflowY: 'auto', lineHeight: 1.4, display: 'block',
};

// Mirrors the backend's canAddToGroup exactly, so the picker never offers a
// choice the server would reject — admin reaches anyone, a manager or a
// team lead both reach their whole department (every team in it, each
// other, the manager themself), not just their own team.
function pickableMembers(currentUser, users) {
  return users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (currentUser.role === ROLES.ADMIN) return true;
    if (currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.TEAM_LEAD) return u.departmentId === currentUser.departmentId;
    return false;
  });
}

function NewGroupModal({ onClose, onCreate }) {
  const { currentUser, users } = useApp();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const candidates = useMemo(() => pickableMembers(currentUser, users), [currentUser, users]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleCreate = async () => {
    if (!name.trim()) { setError('Group name is required.'); return; }
    if (selected.size === 0) { setError('Add at least one member.'); return; }
    setSaving(true);
    try {
      await onCreate(name.trim(), [...selected]);
    } catch (err) {
      setError(err.message || 'Could not create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New group" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Group name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Sprint Planning" />
        </Field>
        <Field label={`Add members (${selected.size} selected)`}>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 9 }}>
            {candidates.length === 0 && (
              <div style={{ padding: 14, fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 12.5, color: 'var(--text-muted)' }}>Nobody available to add.</div>
            )}
            {candidates.map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                <Avatar initial={u.initial} size={24} />
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{u.name}</span>
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>{u.title}</span>
              </label>
            ))}
          </div>
        </Field>
        {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create group'}</Button>
      </div>
    </Modal>
  );
}

function NewDMModal({ onClose, onPick }) {
  const { currentUser, users } = useApp();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const candidates = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && (!search.trim() || u.name.toLowerCase().includes(search.trim().toLowerCase()))),
    [users, currentUser, search],
  );

  const handlePick = async (userId) => {
    setError('');
    try {
      await onPick(userId);
    } catch (err) {
      setError(err.message || 'Could not start chat');
    }
  };

  return (
    <Modal title="New chat" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextInput value={search} onChange={setSearch} placeholder="Search people…" />
        {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 9 }}>
          {candidates.map((u) => (
            <div key={u.id} onClick={() => handlePick(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              <Avatar initial={u.initial} size={28} />
              <div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{u.name}</div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>{u.title}</div>
              </div>
            </div>
          ))}
          {candidates.length === 0 && (
            <div style={{ padding: 14, fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 12.5, color: 'var(--text-muted)' }}>No one matches.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function GroupInfoModal({ conversation, onClose, onAddMember, onRemoveMember }) {
  const { currentUser, users } = useApp();
  const [adding, setAdding] = useState(false);
  const [pickUserId, setPickUserId] = useState('');
  const [error, setError] = useState('');
  const canManage = CAN_CREATE_GROUP.includes(currentUser.role);
  const memberIds = new Set(conversation.members.map((m) => m.id));
  const candidates = useMemo(
    () => pickableMembers(currentUser, users).filter((u) => !memberIds.has(u.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, users, conversation.members],
  );

  const handleAdd = async () => {
    if (!pickUserId) return;
    setError('');
    try {
      await onAddMember(pickUserId);
      setPickUserId('');
      setAdding(false);
    } catch (err) {
      setError(err.message || 'Could not add member');
    }
  };

  return (
    <Modal title={conversation.name} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {conversation.members.length} members
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {conversation.members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initial={m.initial} size={26} />
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}{m.id === currentUser.id ? ' (you)' : ''}</span>
              </div>
              {canManage && m.id !== currentUser.id && (
                <span onClick={() => onRemoveMember(m.id)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}>Remove</span>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Select value={pickUserId} onChange={setPickUserId} options={[{ value: '', label: 'Choose someone' }, ...candidates.map((u) => ({ value: u.id, label: u.name }))]} />
              {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!pickUserId} onClick={handleAdd}>Add</Button>
                <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setAdding(false); setPickUserId(''); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <span onClick={() => setAdding(true)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>+ Add member</span>
          )
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
