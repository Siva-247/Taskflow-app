import { randomUUID } from 'node:crypto';
import { prepare } from './db.js';
import { TODAY } from './constants.js';

export async function getTask(taskId) {
  const task = await prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const subtasks = (await prepare('SELECT id, title, done FROM task_subtasks WHERE task_id = ? ORDER BY seq ASC')
    .all(taskId)).map((s) => ({ ...s, done: !!s.done }));
  const comments = await prepare('SELECT id, author_id as "authorId", text, created_at as "createdAt" FROM comments WHERE task_id = ? ORDER BY seq ASC').all(taskId);
  const activityLog = await prepare('SELECT id, text, at FROM activity_logs WHERE task_id = ? ORDER BY seq ASC').all(taskId);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    instructions: task.instructions,
    teamId: task.team_id,
    assigneeId: task.assignee_id,
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    startDate: task.start_date,
    dueDate: task.due_date,
    estimatedEffort: task.estimated_effort,
    category: task.category,
    createdBy: task.created_by,
    marks: task.marks,
    requestedDueDate: task.requested_due_date,
    extensionReason: task.extension_reason,
    submissionNote: task.submission_note,
    approvedBy: task.approved_by,
    subtasks,
    comments,
    activityLog,
  };
}

// Aggregates chat_reactions into one {emoji, userIds}[] per message, so
// callers never have to reduce raw reaction rows themselves — used for the
// initial message-history fetch and after a single reaction toggle. Lives
// here (not in routes/chat.js or socket/index.js) so both can import it
// without those two modules importing each other.
export async function reactionsForMessages(messageIds) {
  if (messageIds.length === 0) return new Map();
  const placeholders = messageIds.map(() => '?').join(', ');
  const rows = await prepare(`SELECT message_id as "messageId", user_id as "userId", emoji FROM chat_reactions WHERE message_id IN (${placeholders})`).all(...messageIds);
  const byMessage = new Map();
  for (const row of rows) {
    if (!byMessage.has(row.messageId)) byMessage.set(row.messageId, new Map());
    const byEmoji = byMessage.get(row.messageId);
    if (!byEmoji.has(row.emoji)) byEmoji.set(row.emoji, []);
    byEmoji.get(row.emoji).push(row.userId);
  }
  const result = new Map();
  for (const [messageId, byEmoji] of byMessage) {
    result.set(messageId, [...byEmoji.entries()].map(([emoji, userIds]) => ({ emoji, userIds })));
  }
  return result;
}

export async function getGlobalActivity() {
  return prepare('SELECT id, type, text, team_id as "teamId", at FROM activity_logs WHERE type IS NOT NULL ORDER BY seq DESC LIMIT 30').all();
}

export async function insertTaskEvent(taskId, text) {
  await prepare('INSERT INTO activity_logs (id, task_id, type, text, team_id, at) VALUES (?, ?, NULL, ?, NULL, ?)')
    .run(`ev-${randomUUID()}`, taskId, text, TODAY);
}

export async function insertGlobalActivity(type, text, teamId) {
  await prepare('INSERT INTO activity_logs (id, task_id, type, text, team_id, at) VALUES (?, NULL, ?, ?, ?, ?)')
    .run(`act-${randomUUID()}`, type, text, teamId || null, String(Date.now()));
}

export async function userName(userId) {
  const row = await prepare('SELECT name FROM users WHERE id = ?').get(userId);
  return row?.name || 'Someone';
}

// Never notifies someone about their own action — e.g. a lead who is also
// the assignee shouldn't get a "you were assigned" notification for their own task.
export async function insertNotification(userId, actorId, type, text, taskId) {
  if (!userId || userId === actorId) return;
  await prepare('INSERT INTO notifications (id, user_id, type, text, task_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(`note-${randomUUID()}`, userId, type, text, taskId, TODAY);
}

export function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

export function initialsOf(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export async function uniqueUserId(name) {
  const base = slugify(name) || 'member';
  let id = base;
  let n = 1;
  while (await prepare('SELECT 1 FROM users WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  return id;
}

export async function uniqueTeamId(name) {
  const base = slugify(name) || 'team';
  let id = base;
  let n = 1;
  while (await prepare('SELECT 1 FROM teams WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  return id;
}

// scopeTasks, scopeUsers, scopeTeams, scopeDailyUpdates, userCanAccessTask,
// userCanReview, userCanApproveCreation, and validateAssignee all moved to
// ../database/hierarchy.js as part of the role-hierarchy overhaul — that
// module is now the single source of truth for every role/rank-based
// authorization decision, replacing the near-duplicate 4-branch chains that
// used to live here.
