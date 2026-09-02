import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prepare } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { uploadChatImage, isStorageConfigured } from '../storage/supabase.js';
import { notifyUser, joinRoom } from '../socket/index.js';

const router = Router();
router.use(requireAuth);

const MESSAGE_SELECT = `SELECT id, conversation_id as "conversationId", sender_id as "senderId", text, image_url as "imageUrl", created_at as "createdAt" FROM chat_messages`;

async function isMember(conversationId, userId) {
  return !!(await prepare('SELECT 1 FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conversationId, userId));
}

async function memberRows(conversationId) {
  return prepare(`SELECT u.id, u.name, u.initial FROM chat_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`).all(conversationId);
}

// Who a person may add to a group they're creating — the same reach as
// credential management elsewhere: admin reaches anyone, a manager their
// own department, a team lead their own team. Deliberately not reused for
// DMs — anyone may DM anyone, no scoping there, same as canAddToGroup isn't
// consulted at all on that path below.
function canAddToGroup(actor, targetUser) {
  if (actor.role === 'admin') return true;
  if (actor.role === 'manager') return targetUser.department_id === actor.department_id;
  if (actor.role === 'team_lead') return targetUser.team_id === actor.team_id;
  return false;
}

router.get('/conversations', asyncRoute(async (req, res) => {
  const rows = await prepare(`
    SELECT c.id, c.type, c.name, c.created_by as "createdBy", c.created_at as "createdAt",
      cm.last_read_at as "lastReadAt",
      (SELECT text FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.seq DESC LIMIT 1) as "lastMessageText",
      (SELECT image_url FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.seq DESC LIMIT 1) as "lastMessageImage",
      (SELECT created_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.seq DESC LIMIT 1) as "lastMessageAt"
    FROM chat_conversations c
    JOIN chat_members cm ON cm.conversation_id = c.id
    WHERE cm.user_id = ?
    ORDER BY "lastMessageAt" DESC NULLS LAST, c.created_at DESC
  `).all(req.user.id);

  const conversations = [];
  for (const row of rows) {
    conversations.push({ ...row, members: await memberRows(row.id) });
  }
  res.json(conversations);
}));

router.get('/conversations/:id/messages', asyncRoute(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) {
    return res.status(403).json({ error: 'You are not a member of this conversation' });
  }
  const messages = await prepare(`${MESSAGE_SELECT} WHERE conversation_id = ? ORDER BY seq ASC`).all(req.params.id);
  res.json(messages);
}));

router.post('/conversations/:id/read', asyncRoute(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) {
    return res.status(403).json({ error: 'You are not a member of this conversation' });
  }
  await prepare('UPDATE chat_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?')
    .run(new Date().toISOString(), req.params.id, req.user.id);
  res.json({ ok: true });
}));

router.post('/conversations/group', asyncRoute(async (req, res) => {
  if (!['admin', 'manager', 'team_lead'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an admin, manager, or team lead can create a group' });
  }
  const name = (req.body.name || '').trim();
  const memberIds = Array.isArray(req.body.memberIds) ? [...new Set(req.body.memberIds)] : [];
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  if (memberIds.length === 0) return res.status(400).json({ error: 'Add at least one member' });

  for (const memberId of memberIds) {
    const target = await prepare('SELECT id, team_id, department_id FROM users WHERE id = ?').get(memberId);
    if (!target) return res.status(404).json({ error: `Member ${memberId} not found` });
    if (!canAddToGroup(req.user, target)) {
      return res.status(403).json({ error: 'You can only add people from your own team/department' });
    }
  }

  const id = `conv-${randomUUID()}`;
  const createdAt = new Date().toISOString();
  await prepare('INSERT INTO chat_conversations (id, type, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, 'group', name, req.user.id, createdAt);

  const allMemberIds = [...new Set([req.user.id, ...memberIds])];
  for (const memberId of allMemberIds) {
    await prepare('INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(`cm-${randomUUID()}`, id, memberId, createdAt);
  }

  const conversation = { id, type: 'group', name, createdBy: req.user.id, createdAt, members: await memberRows(id) };
  joinRoom(req.user.id, id);
  for (const memberId of memberIds) notifyUser(memberId, 'conversation:new', conversation);
  res.status(201).json({ conversation });
}));

// Starts a DM, or returns the existing one — WhatsApp-style, messaging the
// same person twice never creates a second thread. Unlike groups, anyone
// may DM anyone; there's no scoping to check here.
router.post('/conversations/dm', asyncRoute(async (req, res) => {
  const otherUserId = req.body.userId;
  if (!otherUserId) return res.status(400).json({ error: 'userId is required' });
  if (otherUserId === req.user.id) return res.status(400).json({ error: "You can't start a chat with yourself" });
  const other = await prepare('SELECT id, name, initial FROM users WHERE id = ?').get(otherUserId);
  if (!other) return res.status(404).json({ error: 'User not found' });

  const existing = await prepare(`
    SELECT c.id FROM chat_conversations c
    JOIN chat_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
    JOIN chat_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
    WHERE c.type = 'dm'
  `).get(req.user.id, otherUserId);

  if (existing) {
    const conversation = await prepare('SELECT id, type, name, created_by as "createdBy", created_at as "createdAt" FROM chat_conversations WHERE id = ?').get(existing.id);
    joinRoom(req.user.id, existing.id); // harmless no-op if already joined, cheap safety net
    return res.json({ conversation: { ...conversation, members: await memberRows(existing.id) } });
  }

  const id = `conv-${randomUUID()}`;
  const createdAt = new Date().toISOString();
  await prepare('INSERT INTO chat_conversations (id, type, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, 'dm', null, req.user.id, createdAt);
  await prepare('INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, ?)')
    .run(`cm-${randomUUID()}`, id, req.user.id, createdAt);
  await prepare('INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, ?)')
    .run(`cm-${randomUUID()}`, id, otherUserId, createdAt);

  const conversation = { id, type: 'dm', name: null, createdBy: req.user.id, createdAt, members: await memberRows(id) };
  joinRoom(req.user.id, id);
  notifyUser(otherUserId, 'conversation:new', conversation);
  res.status(201).json({ conversation });
}));

router.post('/conversations/:id/members', asyncRoute(async (req, res) => {
  const conversation = await prepare('SELECT * FROM chat_conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (conversation.type !== 'group') return res.status(400).json({ error: 'Only groups can have members added' });
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'You are not a member of this group' });
  if (!['admin', 'manager', 'team_lead'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an admin, manager, or team lead can add members' });
  }

  const memberId = req.body.userId;
  const target = await prepare('SELECT id, team_id, department_id FROM users WHERE id = ?').get(memberId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!canAddToGroup(req.user, target)) return res.status(403).json({ error: 'You can only add people from your own team/department' });
  if (await isMember(req.params.id, memberId)) return res.status(409).json({ error: 'Already a member' });

  await prepare('INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (?, ?, ?, ?)')
    .run(`cm-${randomUUID()}`, req.params.id, memberId, new Date().toISOString());
  const members = await memberRows(req.params.id);
  notifyUser(memberId, 'conversation:new', {
    id: conversation.id, type: conversation.type, name: conversation.name,
    createdBy: conversation.created_by, createdAt: conversation.created_at, members,
  });
  res.status(201).json({ members });
}));

router.delete('/conversations/:id/members/:userId', asyncRoute(async (req, res) => {
  const conversation = await prepare('SELECT * FROM chat_conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (conversation.type !== 'group') return res.status(400).json({ error: 'Only groups have members to remove' });
  // Removing yourself ("leave group") is always allowed; removing someone
  // else requires the same authority that let you add them in the first place.
  const isSelf = req.params.userId === req.user.id;
  if (!isSelf) {
    if (!['admin', 'manager', 'team_lead'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only an admin, manager, or team lead can remove members' });
    }
    const target = await prepare('SELECT id, team_id, department_id FROM users WHERE id = ?').get(req.params.userId);
    if (!target || !canAddToGroup(req.user, target)) {
      return res.status(403).json({ error: 'You can only remove people from your own team/department' });
    }
  }
  await prepare('DELETE FROM chat_members WHERE conversation_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ ok: true });
}));

router.post('/upload', asyncRoute(async (req, res) => {
  if (!isStorageConfigured()) return res.status(503).json({ error: 'Image sharing is not configured on this server' });
  const { conversationId, dataUri } = req.body;
  if (!conversationId || !dataUri) return res.status(400).json({ error: 'conversationId and dataUri are required' });
  if (!(await isMember(conversationId, req.user.id))) return res.status(403).json({ error: 'You are not a member of this conversation' });

  const imageUrl = await uploadChatImage(dataUri, conversationId);
  res.json({ imageUrl });
}));

export default router;
