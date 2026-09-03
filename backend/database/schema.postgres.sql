-- Postgres equivalent of schema.sql (SQLite). Structurally identical —
-- same tables, same columns, same foreign keys — with the SQLite-specific
-- pieces translated:
--   * `email TEXT UNIQUE COLLATE NOCASE` -> a plain TEXT column plus a
--     case-insensitive UNIQUE INDEX on LOWER(email) below, since Postgres
--     has no NOCASE collation. Queries compare with LOWER(email) = LOWER($1)
--     to match.
--   * No AUTOINCREMENT anywhere — every primary key here is an
--     app-generated TEXT id (uuid or slug), so there's nothing to translate.
--   * `seq BIGSERIAL` on every table — SQLite's implicit `rowid` gave every
--     query a free, perfect "in insertion order" column; Postgres has no
--     equivalent, so every table gets an explicit auto-incrementing one.
--     Every `ORDER BY rowid` in the route files became `ORDER BY seq`.

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id),
  lead_id TEXT,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id),
  department_id TEXT REFERENCES departments(id),
  title TEXT,
  initial TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  seq BIGSERIAL
);

-- Short-lived, single-use tokens for the forgot-password flow. token_hash is
-- a plain SHA-256 digest (not bcrypt) — the raw token already has enough
-- entropy that a fast deterministic lookup is correct here, unlike a password.
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  team_id TEXT REFERENCES teams(id),
  assignee_id TEXT REFERENCES users(id),
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  due_date TEXT,
  estimated_effort TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Development',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  marks INTEGER,
  requested_due_date TEXT,
  extension_reason TEXT,
  submission_note TEXT,
  approved_by TEXT REFERENCES users(id),
  seq BIGSERIAL
);

-- Added after `tasks` already existed live, so CREATE TABLE IF NOT EXISTS
-- alone (a no-op there) wouldn't apply it — runs every time this file is
-- applied, itself a no-op once the column is already present.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by TEXT REFERENCES users(id);

CREATE TABLE IF NOT EXISTS task_subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS daily_updates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  task_id TEXT REFERENCES tasks(id),
  task_title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  task_completed TEXT NOT NULL,
  concepts_covered TEXT NOT NULL DEFAULT '',
  practical_task TEXT NOT NULL DEFAULT '',
  videos_completed INTEGER NOT NULL DEFAULT 0,
  video_link TEXT NOT NULL DEFAULT '',
  seq BIGSERIAL
);

-- Serves both the per-task activity timeline (task_id set, type NULL) and the
-- global recent-activity feed (task_id NULL, type set) — one table, two views.
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT,
  text TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id),
  at TEXT NOT NULL,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  type TEXT,
  text TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  seq BIGSERIAL
);

-- 'group' (name set, members added explicitly by whoever's allowed to
-- create one) or 'dm' (name NULL, always exactly two members, reused
-- rather than duplicated the next time those two people message each other).
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS chat_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  last_read_at TEXT,
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id),
  text TEXT,
  image_url TEXT,
  audio_url TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  seq BIGSERIAL
);

-- The three columns above were added after chat_messages already existed
-- live, so CREATE TABLE IF NOT EXISTS alone (a no-op there) wouldn't apply
-- them — these run every time this file is applied, and are themselves
-- no-ops once the column is already present.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_members_conversation ON chat_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_members_unique ON chat_members(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_updates_user ON daily_updates(user_id);
-- One daily update per person per day — enforced at the database, not just the UI.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_updates_user_date ON daily_updates(user_id, date);

-- Case-insensitive email uniqueness, replacing SQLite's COLLATE NOCASE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
