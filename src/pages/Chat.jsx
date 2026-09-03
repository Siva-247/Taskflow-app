import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Avatar, Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import { IconPlusCircle, IconSend, IconImage, IconSearch } from '../components/icons.jsx';

const CAN_CREATE_GROUP = [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAM_LEAD];

function formatMessageTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// Splits message text on "@Name" for any name that's actually a member of
// this conversation, highlighting each — longest names first, so "@Vishal"
// isn't half-matched by a shorter name that happens to be its prefix.
function renderWithMentions(text, members, mine) {
  const names = [...members].map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`@(${escaped.join('|')})\\b`, 'g');
  const parts = [];
  let lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
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
    match = pattern.exec(text);
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function Chat() {
  const { currentUser, users } = useApp();
  const {
    conversations, activeConversationId, setActiveConversationId, messagesByConversation, typingByConversation,
    connected, loadMessages, sendMessage, uploadImage, createGroup, startDM, addMember, removeMember, markRead, setTyping,
  } = useChat();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const canCreateGroup = CAN_CREATE_GROUP.includes(currentUser.role);
  const active = conversations.find((c) => c.id === activeConversationId) || null;
  const messages = activeConversationId ? (messagesByConversation[activeConversationId] || []) : [];
  const typingUserIds = activeConversationId ? [...(typingByConversation[activeConversationId] || [])].filter((id) => id !== currentUser.id) : [];

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

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      markRead(activeConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const conversationLabel = (c) => {
    if (c.type === 'group') return c.name;
    const other = c.members.find((m) => m.id !== currentUser.id);
    return other?.name || 'Unknown';
  };
  const conversationAvatarInitial = (c) => {
    if (c.type === 'group') return c.name?.slice(0, 2).toUpperCase() || 'GR';
    const other = c.members.find((m) => m.id !== currentUser.id);
    return other?.initial || '?';
  };
  const isUnread = (c) => c.lastMessageAt && (!c.lastReadAt || c.lastMessageAt > c.lastReadAt) && c.lastMessageSenderId !== currentUser.id;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeConversationId) return;
    setSending(true);
    setDraft('');
    setTyping(activeConversationId, false);
    try {
      await sendMessage(activeConversationId, text, null);
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

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeConversationId) return;
    if (file.size > 8 * 1024 * 1024) { return; }
    setSending(true);
    try {
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const imageUrl = await uploadImage(activeConversationId, dataUri);
      await sendMessage(activeConversationId, '', imageUrl);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="responsive-grid" style={{ display: 'grid', '--cols': '320px 1fr', gap: 20, height: 'calc(100vh - 132px)', minHeight: 480 }}>
      <div style={{ display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--heading)' }}>Chats</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreateGroup && (
              <button type="button" onClick={() => setShowNewGroup(true)} title="New group" style={iconBtnStyle}>
                <IconPlusCircle size={16} color="var(--accent-dark)" />
              </button>
            )}
            <button type="button" onClick={() => setShowNewDM(true)} title="New chat" style={iconBtnStyle}>
              <IconSearch size={15} color="var(--accent-dark)" />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: '32px 18px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
              No chats yet. Start one with the search icon above{canCreateGroup ? ', or create a group.' : '.'}
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveConversationId(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', cursor: 'pointer',
                background: c.id === activeConversationId ? 'var(--accent-soft)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Avatar initial={conversationAvatarInitial(c)} size={38} gradient={c.type === 'group'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: isUnread(c) ? 800 : 600, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conversationLabel(c)}
                  </span>
                  {c.lastMessageAt && <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatMessageTime(c.lastMessageAt)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: isUnread(c) ? 700 : 500, fontSize: 12.5, color: isUnread(c) ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.lastMessageText || (c.lastMessageImage ? '📷 Photo' : 'No messages yet')}
                  </span>
                  {isUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
            Select a chat to start messaging
          </div>
        ) : (
          <>
            <div
              onClick={() => active.type === 'group' && setShowGroupInfo(true)}
              style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, cursor: active.type === 'group' ? 'pointer' : 'default' }}
            >
              <Avatar initial={conversationAvatarInitial(active)} size={34} gradient={active.type === 'group'} />
              <div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{conversationLabel(active)}</div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {active.type === 'group' ? `${active.members.length} members` : (connected ? 'Online' : 'Connecting…')}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((m) => {
                const mine = m.senderId === currentUser.id;
                const sender = users.find((u) => u.id === m.senderId);
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    {active.type === 'group' && !mine && (
                      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', marginBottom: 2, marginLeft: 4 }}>{sender?.name}</span>
                    )}
                    <div style={{
                      maxWidth: '70%', padding: m.imageUrl ? 6 : '9px 13px', borderRadius: 14,
                      borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
                      background: mine ? 'var(--accent)' : 'var(--field-bg)',
                      color: mine ? '#FFFFFF' : 'var(--text-primary)',
                    }}>
                      {m.imageUrl && <img src={m.imageUrl} alt="Shared" style={{ maxWidth: '100%', borderRadius: 9, display: 'block' }} />}
                      {m.text && (
                        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, lineHeight: 1.4, marginTop: m.imageUrl ? 6 : 0, padding: m.imageUrl ? '0 6px' : 0 }}>
                          {renderWithMentions(m.text, active.members, mine)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{formatMessageTime(m.createdAt)}</span>
                  </div>
                );
              })}
              {typingUserIds.length > 0 && (
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {typingUserIds.map((id) => users.find((u) => u.id === id)?.name || 'Someone').join(', ')} typing…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ position: 'relative', padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {mentionCandidates.length > 0 && (
                <div style={{
                  position: 'absolute', left: 18, right: 18, bottom: '100%', marginBottom: 6,
                  background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10,
                  boxShadow: '0 10px 28px -12px rgba(59,30,112,0.25)', overflow: 'hidden', zIndex: 10,
                }}>
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
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending} style={iconBtnStyle} title="Share an image">
                <IconImage size={18} />
              </button>
              <div style={{ flex: 1 }}>
                <TextInput value={draft} onChange={handleDraftChange} placeholder="Type a message… (@ to mention)" />
              </div>
              <Button variant="primary" style={{ padding: '10px 14px' }} onClick={handleSend} disabled={sending || !draft.trim()}>
                <IconSend size={15} />
              </Button>
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

const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9,
  border: '1px solid var(--border)', background: '#FFFFFF', cursor: 'pointer', flexShrink: 0,
};

// Mirrors the backend's canAddToGroup exactly, so the picker never offers a
// choice the server would reject — admin reaches anyone, a manager or a
// team lead both reach their whole department (every team in it, each
// other, the manager themself), not just a team lead's own team.
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
