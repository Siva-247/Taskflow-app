// Mock data for the TaskFlow prototype. No backend — everything lives in memory
// for the session (see AppContext for the mutable copies used at runtime).
// Org structure reflects the real AI Department: one manager, two team leads,
// each with their own developers/interns. Nothing here is invented beyond
// what the org chart specifies.

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TEAM_LEAD: 'team_lead',
  EMPLOYEE: 'employee',
};

export const STATUS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'Submitted for Review',
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
};

export const PRIORITY = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const CATEGORIES = ['Development', 'AI/ML', 'Testing', 'Documentation', 'Research'];

// The real current date (viewer's local time), recomputed on every page
// load. Built from getFullYear/Month/Date rather than toISOString() so it
// reflects the viewer's local calendar day, not UTC's.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const TODAY = localToday();

export const departments = [
  { id: 'dept-ai', name: 'AI Department' },
];

export const teams = [
  { id: 'team-1', name: "Santhosh's Team", departmentId: 'dept-ai', leadId: 'santhosh' },
  { id: 'team-2', name: "Hari's Team", departmentId: 'dept-ai', leadId: 'hari' },
];

// teamById() below is used throughout the app as a plain function import
// (not through context), so it can only ever see fresh teams if this same
// array is mutated in place — AppContext calls this after loading/creating
// teams so every existing teamById() call site stays correct for free.
export function syncTeams(freshTeams) {
  teams.length = 0;
  teams.push(...freshTeams);
}

export const users = [
  { id: 'admin-1', name: 'Admin', role: ROLES.ADMIN, teamId: null, departmentId: null, initial: 'A' },

  { id: 'thamilarasu', name: 'Thamilarasu', role: ROLES.MANAGER, teamId: null, departmentId: 'dept-ai', title: 'Manager / Department Head', initial: 'T' },

  { id: 'santhosh', name: 'Santhosh', role: ROLES.TEAM_LEAD, teamId: 'team-1', departmentId: 'dept-ai', title: 'Team Lead', initial: 'SN' },
  { id: 'hari', name: 'Hari', role: ROLES.TEAM_LEAD, teamId: 'team-2', departmentId: 'dept-ai', title: 'Team Lead', initial: 'H' },

  // Santhosh's Team
  { id: 'chandraprakash', name: 'Chandraprakash', role: ROLES.EMPLOYEE, teamId: 'team-1', departmentId: 'dept-ai', title: 'Developer', initial: 'CP' },
  { id: 'dhinesh', name: 'Dhinesh', role: ROLES.EMPLOYEE, teamId: 'team-1', departmentId: 'dept-ai', title: 'Developer', initial: 'DN' },
  { id: 'sivakavitha', name: 'Sivakavitha', role: ROLES.EMPLOYEE, teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'SK' },
  { id: 'vishal', name: 'Vishal', role: ROLES.EMPLOYEE, teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'VS' },
  { id: 'lokesh', name: 'Lokesh', role: ROLES.EMPLOYEE, teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'LK' },
  { id: 'yathish', name: 'Yathish', role: ROLES.EMPLOYEE, teamId: 'team-1', departmentId: 'dept-ai', title: 'Intern', initial: 'YT' },

  // Hari's Team
  { id: 'muthupandi', name: 'Muthupandi', role: ROLES.EMPLOYEE, teamId: 'team-2', departmentId: 'dept-ai', title: 'Developer', initial: 'MP' },
  { id: 'yuvaraj', name: 'Yuvaraj', role: ROLES.EMPLOYEE, teamId: 'team-2', departmentId: 'dept-ai', title: 'Developer', initial: 'YV' },
  { id: 'dhivakar', name: 'Dhivakar', role: ROLES.EMPLOYEE, teamId: 'team-2', departmentId: 'dept-ai', title: 'Developer', initial: 'DV' },
  { id: 'sanjay', name: 'Sanjay', role: ROLES.EMPLOYEE, teamId: 'team-2', departmentId: 'dept-ai', title: 'Intern', initial: 'SJ' },
  { id: 'pooja', name: 'Pooja', role: ROLES.EMPLOYEE, teamId: 'team-2', departmentId: 'dept-ai', title: 'Intern', initial: 'PJ' },
  { id: 'dhasarathy', name: 'Dhasarathy', role: ROLES.EMPLOYEE, teamId: 'team-2', departmentId: 'dept-ai', title: 'Intern', initial: 'DS' },
];

export const userById = (id) => users.find((u) => u.id === id) || null;
export const teamById = (id) => teams.find((t) => t.id === id) || null;
export const departmentById = (id) => departments.find((d) => d.id === id) || null;

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

let taskSeq = 1;
// A task already due before "today" must have started before its due date
// too — defaulting startDate to TODAY for every task (regardless of a past
// dueDate) produced impossible ranges for completed/overdue seed data.
const t = (overrides) => {
  const defaultStartDate = overrides.dueDate && overrides.dueDate < TODAY ? addDays(overrides.dueDate, -3) : TODAY;
  return {
    id: `task-${taskSeq++}`,
    description: '',
    category: 'Development',
    estimatedEffort: '4 hours',
    startDate: defaultStartDate,
    subtasks: [],
    comments: [],
    activityLog: [],
    ...overrides,
  };
};

export const initialTasks = [
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

export const initialDailyUpdates = [
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
