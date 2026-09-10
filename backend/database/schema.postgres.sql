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

-- Added after `teams` and `users` already existed live, so CREATE TABLE IF
-- NOT EXISTS alone (a no-op there) wouldn't apply it — runs every time this
-- file is applied, itself a no-op once the column is already present. Must
-- come after `users` is created (it references users(id)). Unlike `lead_id`
-- (a legacy plain column with no FK), this one gets a real FK — one
-- Assistant Manager per team, the same granularity as a team's lead,
-- sitting between the team's lead and the department's one manager.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS assistant_manager_id TEXT REFERENCES users(id);

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
  reviewed_by TEXT REFERENCES users(id),
  seq BIGSERIAL
);

-- Added after `tasks` already existed live, so CREATE TABLE IF NOT EXISTS
-- alone (a no-op there) wouldn't apply it — runs every time this file is
-- applied, itself a no-op once the column is already present.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by TEXT REFERENCES users(id);
-- Who approved a submitted-for-review task's completion — the review
-- counterpart to approved_by (creation sign-off). Kept as a separate
-- column rather than reusing approved_by since a single task can go
-- through both flows in its lifetime (creation approval, then later a
-- review approval), and each needs to be independently attributable.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id);

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

-- Added after daily_updates already existed live, matching the interns
-- tracker.xlsx work-log format (milestone/project/deliverables per entry,
-- plus a reviewer's own remarks) — additive only, so existing rows and the
-- older concepts_covered/practical_task/videos_completed/video_link columns
-- above are untouched; the new form just stops writing to them.
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS milestone TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS deliverables TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS self_assessment TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS resources TEXT;
-- Second revision of the format, per the Task ID/Department/.../Blocker
-- column spec — department_id and actual_close_date are always
-- server-computed (never trusted from the client), the same way user_id
-- always comes from the session below; priority/due_date are plain
-- author-supplied fields. self_assessment above is superseded by this
-- revision (no longer written by the form) but stays for old rows.
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id);
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS due_date TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS actual_close_date TEXT;
-- Third revision: Priority and "Start Date" are no longer asked for on the
-- form at all — both are snapshotted server-side from the linked task the
-- same moment task_title already is (denormalized on write, same reasoning:
-- the linked task's own visibility stays scoped, this row's doesn't). With
-- no task linked, both simply stay null. task_start_date is deliberately
-- its own column, not a reuse of `date` above — `date` is this row's own
-- day (drives the one-entry-per-day rule and the edit-lock), a completely
-- different thing from the linked task's start date.
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS task_start_date TEXT;
-- A reviewer's remarks on someone else's entry — written by whoever has
-- management authority over the author (hierarchy.canManage), never the
-- author themselves. Separate from the author-only fields above the same
-- way Task Details' reviewer actions are separate from the assignee's own.
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS bdm_remarks TEXT;
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS bdm_remarks_by TEXT REFERENCES users(id);
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS bdm_remarks_at TEXT;
-- A real "TK001"-style id, first introduced to let a historical spreadsheet
-- backfill survive import with its own numbering intact, now the standard
-- id for every new daily update going forward too (see routes/dailyUpdates.js
-- POST) — null only stays possible for rows written before this existed,
-- where the UI's fallback DU-0001-style id (derived from `seq`) keeps
-- covering the display.
ALTER TABLE daily_updates ADD COLUMN IF NOT EXISTS custom_task_id TEXT;

-- Atomic, race-free numbering for the TK### id above — a MAX(...)+1 query
-- would double-assign under concurrent submissions, a sequence can't. Primed
-- to continue right after the 174 ids the spreadsheet backfill already
-- assigned by hand; the `is_called` guard makes that priming a genuine
-- one-time thing, so re-running this file never rewinds the sequence
-- backwards once real submissions have already advanced it past 174.
CREATE SEQUENCE IF NOT EXISTS daily_update_task_id_seq;
DO $$
BEGIN
  IF NOT (SELECT is_called FROM daily_update_task_id_seq) THEN
    PERFORM setval('daily_update_task_id_seq', 174, true);
  END IF;
END $$;

-- Anyone can raise a blocker; it's visible to the WHOLE company regardless of
-- role/department/team (see routes/blockers.js — deliberately unscoped, the
-- one resource in this app where that's true), since resolving one often
-- needs someone outside the raiser's own chain.
CREATE TABLE IF NOT EXISTS blockers (
  id TEXT PRIMARY KEY,
  linked_task_id TEXT REFERENCES tasks(id),
  -- Denormalized snapshot, same reasoning as daily_updates.task_title: the
  -- blocker itself is visible company-wide, but the linked task's own
  -- visibility stays scoped — without this, a viewer outside that task's
  -- scope would see a blocker pointing at a task they can't look up.
  linked_task_title TEXT NOT NULL DEFAULT '',
  raised_by TEXT NOT NULL REFERENCES users(id),
  project TEXT NOT NULL DEFAULT '',
  raised_date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  blocking_what TEXT NOT NULL DEFAULT '',
  owner_to_resolve_id TEXT REFERENCES users(id),
  target_resolution TEXT,
  escalation_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  closed_date TEXT,
  resolution_note TEXT NOT NULL DEFAULT '',
  seq BIGSERIAL
);
CREATE INDEX IF NOT EXISTS idx_blockers_raised_by ON blockers(raised_by);
CREATE INDEX IF NOT EXISTS idx_blockers_owner ON blockers(owner_to_resolve_id);

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

-- Blockers aren't tasks, so the existing insertNotification() helper
-- (hardwired to notifications.task_id) can't target one — added after
-- `blockers` exists, since this column references it.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS blocker_id TEXT REFERENCES blockers(id) ON DELETE CASCADE;

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
  reply_to_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  seq BIGSERIAL
);

-- Each of these was added after chat_messages already existed live, so
-- CREATE TABLE IF NOT EXISTS alone (a no-op there) wouldn't apply it —
-- these run every time this file is applied, and are themselves no-ops
-- once the column is already present.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL;

-- One reaction per person per message — picking a new emoji replaces the
-- old one (upsert on conflict), matching how a single-reaction-per-person
-- chat reaction picker behaves.
CREATE TABLE IF NOT EXISTS chat_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  seq BIGSERIAL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_reactions_unique ON chat_reactions(message_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id);

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
