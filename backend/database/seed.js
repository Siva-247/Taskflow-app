import { STATUS, TODAY } from './constants.js';
import { hashPassword } from '../auth/passwords.js';
import { prepare } from './db.js';

const PRIORITY = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

// Every seed account shares this temp password and must change it on first
// login — see auth/passwords.js and routes/auth.js. Test-only, obviously.
const SEED_PASSWORD = 'TaskFlow@123';

const departments = [
  { id: 'dept-ai', name: 'AI Department' },
];

const teams = [
  { id: 'team-1', name: "Santhosh's Team", departmentId: 'dept-ai', leadId: 'santhosh' },
  { id: 'team-2', name: "Hari's Team", departmentId: 'dept-ai', leadId: 'hari' },
];

const users = [
  { id: 'admin-1', name: 'Admin', role: 'admin', teamId: null, departmentId: null, title: null, initial: 'A' },
  { id: 'thamilarasu', name: 'Thamilarasu', role: 'manager', teamId: null, departmentId: 'dept-ai', title: 'Manager / Department Head', initial: 'T' },
  { id: 'santhosh', name: 'Santhosh', role: 'team_lead', teamId: 'team-1', departmentId: 'dept-ai', title: 'Team Lead', initial: 'SN' },
  { id: 'hari', name: 'Hari', role: 'team_lead', teamId: 'team-2', departmentId: 'dept-ai', title: 'Team Lead', initial: 'H' },
  { id: 'chandraprakash', name: 'Chandraprakash', role: 'employee', teamId: 'team-1', departmentId: 'dept-ai', title: 'Developer', initial: 'CP' },
  { id: 'dhinesh', name: 'Dhinesh', role: 'employee', teamId: 'team-1', departmentId: 'dept-ai', title: 'Developer', initial: 'DN' },
  { id: 'sivakavitha', name: 'Sivakavitha', role: 'employee', teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'SK' },
  { id: 'vishal', name: 'Vishal', role: 'employee', teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'VS' },
  { id: 'lokesh', name: 'Lokesh', role: 'employee', teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'LK' },
  { id: 'yathish', name: 'Yathish', role: 'employee', teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'YT' },
  { id: 'muthupandi', name: 'Muthupandi', role: 'employee', teamId: 'team-2', departmentId: 'dept-ai', title: 'Developer', initial: 'MP' },
  { id: 'yuvaraj', name: 'Yuvaraj', role: 'employee', teamId: 'team-2', departmentId: 'dept-ai', title: 'Developer', initial: 'YV' },
  { id: 'dhivakar', name: 'Dhivakar', role: 'employee', teamId: 'team-2', departmentId: 'dept-ai', title: 'Developer', initial: 'DV' },
  { id: 'sanjay', name: 'Sanjay', role: 'employee', teamId: 'team-2', departmentId: 'dept-ai', title: 'Intern', initial: 'SJ' },
  { id: 'pooja', name: 'Pooja', role: 'employee', teamId: 'team-2', departmentId: 'dept-ai', title: 'Intern', initial: 'PJ' },
  { id: 'dhasarathy', name: 'Dhasarathy', role: 'employee', teamId: 'team-2', departmentId: 'dept-ai', title: 'Intern', initial: 'DS' },
].map((u) => ({ ...u, email: `${u.id}@taskflow.local`, mustChangePassword: 1 }));
// passwordHash is deliberately NOT computed here — seedIfEmpty almost always
// short-circuits (the DB is already seeded), and doing 16 synchronous bcrypt
// hashes at module-import time on every server boot was pure waste. It's
// computed once, lazily, only on the one-time path where seeding actually happens.

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

let taskSeq = 1;
const t = (overrides) => {
  // A task already due before "today" must have started before its due date
  // too — defaulting startDate to TODAY for every task (regardless of a
  // past dueDate) produced impossible ranges for completed/overdue seed data.
  // Tasks still due today or later are presumed to have started today.
  const defaultStartDate = overrides.dueDate && overrides.dueDate < TODAY ? addDays(overrides.dueDate, -3) : TODAY;
  return {
    id: `task-${taskSeq++}`,
    description: '',
    category: 'Development',
    estimatedEffort: '4 hours',
    startDate: defaultStartDate,
    subtasks: [],
    comments: [],
    ...overrides,
  };
};

const tasks = [
  // ---- Santhosh's Team ----
  t({ title: 'Develop dashboard UI', teamId: 'team-1', assigneeId: 'chandraprakash', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 60, dueDate: '2026-08-29', description: 'Build the analytics dashboard UI for the internal ML monitoring tool.' }),
  t({ title: 'API integration - payment module', teamId: 'team-1', assigneeId: 'chandraprakash', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-15' }),
  t({ title: 'Documentation - API reference', teamId: 'team-1', assigneeId: 'chandraprakash', createdBy: 'santhosh', category: 'Documentation', priority: PRIORITY.LOW, status: STATUS.IN_REVIEW, progress: 100, dueDate: '2026-08-22', description: 'Write the reference docs for the internal model-serving API.' }),
  t({ title: 'Bug fixing - login timeout issue', teamId: 'team-1', assigneeId: 'chandraprakash', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.HIGH, status: STATUS.TODO, progress: 0, dueDate: '2026-09-01' }),

  t({ title: 'Data preprocessing pipeline', teamId: 'team-1', assigneeId: 'dhinesh', createdBy: 'santhosh', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 45, dueDate: '2026-08-30', description: 'Build the preprocessing pipeline for the incoming support-ticket dataset.' }),
  t({ title: 'Model testing - accuracy benchmarks', teamId: 'team-1', assigneeId: 'dhinesh', createdBy: 'santhosh', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-12' }),
  t({ title: 'Research - vector database options', teamId: 'team-1', assigneeId: 'dhinesh', createdBy: 'santhosh', category: 'Research', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-09-03' }),
  t({ title: 'Testing - regression suite', teamId: 'team-1', assigneeId: 'dhinesh', createdBy: 'santhosh', category: 'Testing', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 55, dueDate: '2026-08-20' }),

  t({ title: 'Dataset preparation for NLP model', teamId: 'team-1', assigneeId: 'sivakavitha', createdBy: 'santhosh', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-14', description: 'Clean and label the intent-classification training set.' }),
  t({ title: 'Model evaluation report', teamId: 'team-1', assigneeId: 'sivakavitha', createdBy: 'santhosh', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 55, dueDate: '2026-08-29', description: 'Summarize precision/recall results for the latest intent model.' }),
  t({ title: 'Research - transformer architectures', teamId: 'team-1', assigneeId: 'sivakavitha', createdBy: 'santhosh', category: 'Research', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-09-04' }),
  t({
    title: 'Frontend integration - chatbot UI', teamId: 'team-1', assigneeId: 'sivakavitha', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.IN_REVIEW, progress: 100, dueDate: '2026-08-21',
    description: 'Wire the chatbot widget UI up to the new intents API.',
    subtasks: [{ id: 'st-1', title: 'Connect widget to intents API', done: true }, { id: 'st-2', title: 'Handle loading/error states', done: true }, { id: 'st-3', title: 'Cross-browser check', done: false }],
    comments: [{ id: 'c-seed-1', authorId: 'santhosh', text: 'Looks solid — double check it on Safari before you submit.', createdAt: '2026-08-24' }],
  }),
  t({ title: 'Bug fixing - chatbot response lag', teamId: 'team-1', assigneeId: 'sivakavitha', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.HIGH, status: STATUS.IN_PROGRESS, progress: 35, dueDate: '2026-08-19', description: 'Investigate the response delay reported on the staging chatbot.' }),

  t({ title: 'Dataset preparation - image labeling', teamId: 'team-1', assigneeId: 'vishal', createdBy: 'santhosh', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 50, dueDate: '2026-08-28' }),
  t({ title: 'Documentation - user guide draft', teamId: 'team-1', assigneeId: 'vishal', createdBy: 'santhosh', category: 'Documentation', priority: PRIORITY.LOW, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-13' }),
  t({ title: 'Bug fixing - UI alignment issues', teamId: 'team-1', assigneeId: 'vishal', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-09-02' }),

  t({ title: 'Research - LLM fine-tuning approaches', teamId: 'team-1', assigneeId: 'lokesh', createdBy: 'santhosh', category: 'Research', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 30, dueDate: '2026-08-31' }),
  t({ title: 'Model evaluation - test cases', teamId: 'team-1', assigneeId: 'lokesh', createdBy: 'santhosh', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-16' }),
  t({ title: 'Frontend integration - settings page', teamId: 'team-1', assigneeId: 'lokesh', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-08-18' }),

  t({ title: 'API integration - notification service', teamId: 'team-1', assigneeId: 'yathish', createdBy: 'santhosh', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.IN_REVIEW, progress: 100, dueDate: '2026-08-23' }),
  t({ title: 'Testing - unit test coverage', teamId: 'team-1', assigneeId: 'yathish', createdBy: 'santhosh', category: 'Testing', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 65, dueDate: '2026-08-27' }),
  t({ title: 'Documentation - onboarding guide', teamId: 'team-1', assigneeId: 'yathish', createdBy: 'santhosh', category: 'Documentation', priority: PRIORITY.LOW, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-17' }),

  // ---- Hari's Team ----
  t({ title: 'Build authentication API - OAuth flow', teamId: 'team-2', assigneeId: 'muthupandi', createdBy: 'hari', category: 'Development', priority: PRIORITY.HIGH, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-14' }),
  t({ title: 'API integration - third-party ML service', teamId: 'team-2', assigneeId: 'muthupandi', createdBy: 'hari', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 55, dueDate: '2026-08-29' }),
  t({ title: 'Bug fixing - memory leak in inference service', teamId: 'team-2', assigneeId: 'muthupandi', createdBy: 'hari', category: 'Development', priority: PRIORITY.HIGH, status: STATUS.IN_REVIEW, progress: 100, dueDate: '2026-08-22' }),
  t({ title: 'Documentation - deployment guide', teamId: 'team-2', assigneeId: 'muthupandi', createdBy: 'hari', category: 'Documentation', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-09-01' }),

  t({ title: 'Data preprocessing - text normalization', teamId: 'team-2', assigneeId: 'yuvaraj', createdBy: 'hari', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-11' }),
  t({ title: 'Model testing - load testing', teamId: 'team-2', assigneeId: 'yuvaraj', createdBy: 'hari', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 40, dueDate: '2026-08-19' }),
  t({ title: 'Research - model compression techniques', teamId: 'team-2', assigneeId: 'yuvaraj', createdBy: 'hari', category: 'Research', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-09-05' }),

  t({ title: 'Develop dashboard UI - analytics charts', teamId: 'team-2', assigneeId: 'dhivakar', createdBy: 'hari', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 75, dueDate: '2026-08-28', subtasks: [{ id: 'st-4', title: 'Wire chart library', done: true }, { id: 'st-5', title: 'Connect to live metrics API', done: true }, { id: 'st-6', title: 'Polish empty/loading states', done: false }] }),
  t({ title: 'API integration - auth service', teamId: 'team-2', assigneeId: 'dhivakar', createdBy: 'hari', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-13' }),
  t({ title: 'Testing - end-to-end test suite', teamId: 'team-2', assigneeId: 'dhivakar', createdBy: 'hari', category: 'Testing', priority: PRIORITY.MEDIUM, status: STATUS.IN_REVIEW, progress: 100, dueDate: '2026-08-24' }),

  t({ title: 'Dataset preparation - audio samples', teamId: 'team-2', assigneeId: 'sanjay', createdBy: 'hari', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 35, dueDate: '2026-08-30' }),
  t({ title: 'Documentation - API examples', teamId: 'team-2', assigneeId: 'sanjay', createdBy: 'hari', category: 'Documentation', priority: PRIORITY.LOW, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-15' }),
  t({ title: 'Bug fixing - form validation', teamId: 'team-2', assigneeId: 'sanjay', createdBy: 'hari', category: 'Development', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-09-02' }),

  t({ title: 'Research - chatbot intents design', teamId: 'team-2', assigneeId: 'pooja', createdBy: 'hari', category: 'Research', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 20, dueDate: '2026-08-18' }),
  t({ title: 'Model evaluation - precision/recall metrics', teamId: 'team-2', assigneeId: 'pooja', createdBy: 'hari', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-16' }),
  t({ title: 'Frontend integration - chat widget', teamId: 'team-2', assigneeId: 'pooja', createdBy: 'hari', category: 'Development', priority: PRIORITY.MEDIUM, status: STATUS.IN_REVIEW, progress: 100, dueDate: '2026-08-20' }),

  t({ title: 'Testing - smoke tests', teamId: 'team-2', assigneeId: 'dhasarathy', createdBy: 'hari', category: 'Testing', priority: PRIORITY.LOW, status: STATUS.TODO, progress: 0, dueDate: '2026-08-31' }),
  t({ title: 'Data preprocessing - deduplication script', teamId: 'team-2', assigneeId: 'dhasarathy', createdBy: 'hari', category: 'AI/ML', priority: PRIORITY.MEDIUM, status: STATUS.IN_PROGRESS, progress: 60, dueDate: '2026-08-27' }),
  t({ title: 'Documentation - README updates', teamId: 'team-2', assigneeId: 'dhasarathy', createdBy: 'hari', category: 'Documentation', priority: PRIORITY.LOW, status: STATUS.COMPLETED, progress: 100, dueDate: '2026-08-09' }),
];

const dailyUpdates = [
  {
    id: 'du-1', userId: 'sivakavitha', date: '2026-08-24', taskTitle: 'Model evaluation report',
    taskCompleted: 'Continued work on the NLP intent-model evaluation report.',
    conceptsCovered: 'Precision/recall tradeoffs for multi-class classification.',
    practicalTask: 'Ran evaluation scripts against the held-out validation set.',
    status: 'Completed', videosCompleted: 1, videoLink: 'training.internal/model-eval-metrics',
  },
  {
    id: 'du-2', userId: 'chandraprakash', date: '2026-08-24', taskTitle: 'Develop dashboard UI',
    taskCompleted: 'Worked on the analytics dashboard UI components.',
    conceptsCovered: 'React state management patterns for live-updating charts.',
    practicalTask: 'Built the chart components for the monitoring dashboard.',
    status: 'Completed', videosCompleted: 0, videoLink: '',
  },
  {
    id: 'du-3', userId: 'muthupandi', date: '2026-08-24', taskTitle: 'API integration - third-party ML service',
    taskCompleted: 'Continued the OAuth integration work for the ML service.',
    conceptsCovered: 'OAuth 2.0 client-credentials flow.',
    practicalTask: 'Tested the third-party ML service integration end to end.',
    status: 'Completed', videosCompleted: 0, videoLink: '',
  },
];

const globalActivitySeed = [
  { id: 'act-seed-1', type: 'created', text: 'Santhosh assigned "Frontend integration - chatbot UI" to Sivakavitha', teamId: 'team-1', atOffsetMs: 1000 * 60 * 60 * 5 },
  { id: 'act-seed-2', type: 'submitted', text: 'Dhivakar submitted "Testing - end-to-end test suite" for review', teamId: 'team-2', atOffsetMs: 1000 * 60 * 60 * 9 },
  { id: 'act-seed-3', type: 'completed', text: 'Muthupandi completed "Build authentication API - OAuth flow"', teamId: 'team-2', atOffsetMs: 1000 * 60 * 60 * 26 },
];

// Every statement here goes through the cached `prepare()` from db.js, never
// raw db.prepare() — this function runs on every server startup (the
// alreadySeeded check below always fires), and a fresh uncached Statement
// created on every boot is exactly the pattern that has been observed to
// crash Node's isolate cleanup natively (see db.js for the full story).
export function seedIfEmpty(db) {
  const alreadySeeded = prepare('SELECT COUNT(*) as n FROM users').get().n > 0;
  if (alreadySeeded) return;

  const seedPasswordHash = hashPassword(SEED_PASSWORD);

  const insertMany = db.transaction(() => {
    const insDept = prepare('INSERT INTO departments (id, name) VALUES (@id, @name)');
    departments.forEach((d) => insDept.run(d));

    const insTeam = prepare('INSERT INTO teams (id, name, department_id, lead_id) VALUES (@id, @name, @departmentId, @leadId)');
    teams.forEach((tm) => insTeam.run(tm));

    const insUser = prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
      VALUES (@id, @name, @role, @teamId, @departmentId, @title, @initial, @email, @passwordHash, @mustChangePassword)`);
    users.forEach((u) => insUser.run({ ...u, passwordHash: seedPasswordHash }));

    const insTask = prepare(`INSERT INTO tasks (id, title, description, instructions, team_id, assignee_id, priority, status, progress, start_date, due_date, estimated_effort, category, created_by, created_at)
      VALUES (@id, @title, @description, '', @teamId, @assigneeId, @priority, @status, @progress, @startDate, @dueDate, @estimatedEffort, @category, @createdBy, @createdAt)`);
    const insSubtask = prepare('INSERT INTO task_subtasks (id, task_id, title, done) VALUES (?, ?, ?, ?)');
    const insComment = prepare('INSERT INTO comments (id, task_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)');
    const insEvent = prepare('INSERT INTO activity_logs (id, task_id, type, text, team_id, at) VALUES (?, ?, NULL, ?, NULL, ?)');

    let eventSeq = 1;
    tasks.forEach((task) => {
      insTask.run({ ...task, createdAt: TODAY });
      task.subtasks.forEach((s) => insSubtask.run(s.id, task.id, s.title, s.done ? 1 : 0));
      task.comments.forEach((c) => insComment.run(c.id, task.id, c.authorId, c.text, c.createdAt));
      const assigneeName = users.find((u) => u.id === task.assigneeId)?.name;
      insEvent.run(`ev-seed-${eventSeq++}`, task.id, `Task created and assigned to ${assigneeName}`, TODAY);
    });

    const insUpdate = prepare(`INSERT INTO daily_updates (id, user_id, task_id, task_title, date, status, task_completed, concepts_covered, practical_task, videos_completed, video_link)
      VALUES (@id, @userId, NULL, @taskTitle, @date, @status, @taskCompleted, @conceptsCovered, @practicalTask, @videosCompleted, @videoLink)`);
    dailyUpdates.forEach((u) => insUpdate.run(u));

    const insGlobal = prepare('INSERT INTO activity_logs (id, task_id, type, text, team_id, at) VALUES (?, NULL, ?, ?, ?, ?)');
    const now = Date.now();
    globalActivitySeed.forEach((a) => insGlobal.run(a.id, a.type, a.text, a.teamId, String(now - a.atOffsetMs)));
  });

  insertMany();
  console.log(`Seeded database: ${users.length} users, ${tasks.length} tasks, ${dailyUpdates.length} daily updates.`);
}
