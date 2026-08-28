CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id),
  lead_id TEXT
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id),
  department_id TEXT REFERENCES departments(id),
  title TEXT,
  initial TEXT NOT NULL,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Short-lived, single-use tokens for the forgot-password flow. token_hash is
-- a plain SHA-256 digest (not bcrypt) — the raw token already has enough
-- entropy that a fast deterministic lookup is correct here, unlike a password.
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
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
  extension_reason TEXT
);

CREATE TABLE task_subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE daily_updates (
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
  video_link TEXT NOT NULL DEFAULT ''
);

-- Serves both the per-task activity timeline (task_id set, type NULL) and the
-- global recent-activity feed (task_id NULL, type set) — one table, two views.
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT,
  text TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id),
  at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  type TEXT,
  text TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_team ON tasks(team_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_subtasks_task ON task_subtasks(task_id);
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_activity_task ON activity_logs(task_id);
CREATE INDEX idx_daily_updates_user ON daily_updates(user_id);
