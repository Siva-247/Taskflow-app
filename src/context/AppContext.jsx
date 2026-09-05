import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ROLES, STATUS, TODAY, users as seedUsers, teams as seedTeams, departments as seedDepartments, syncTeams,
} from '../data/mockData.js';

const AppContext = createContext(null);
// VITE_API_BASE_URL lets a deployed build point at its real backend — Vite
// only inlines env vars prefixed VITE_, and only at build time, so this must
// be set before running `npm run build` for a deployment, not just at runtime.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'taskflow_token';

function readStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable — session just won't survive a refresh */ }
}

async function apiRequest(path, options = {}, token) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Could not reach the backend server. Is it running on port 4000?');
  }
  if (res.status === 401) {
    // A 401 on an authenticated call (a token was sent) means the session
    // itself is invalid — `call` below turns that into a forced sign-out.
    // A 401 with no token is just login/signup rejecting bad credentials,
    // a normal error that should surface its real message like any other.
    if (token) throw new Error('__UNAUTHORIZED__');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Not authorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export function AppProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  // True only while we're validating a token restored from a previous
  // session (page refresh) — keeps the login screen from flashing before we
  // know whether that token still works.
  const [sessionRestoring, setSessionRestoring] = useState(() => !!readStoredToken());
  const [users, setUsers] = useState(seedUsers);
  const [departments, setDepartments] = useState(seedDepartments);
  const [teams, setTeamsState] = useState(seedTeams);
  // Keeps context state AND the plain teamById()/mockData.js array (used
  // directly by ~10 pages outside context) in sync from one call site.
  const setTeams = useCallback((next) => {
    setTeamsState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      syncTeams(resolved);
      return resolved;
    });
  }, []);
  const [tasks, setTasks] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [activity, setActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Every authenticated request goes through here so a session that's
  // expired or been rejected server-side signs the user out immediately,
  // instead of silently failing one request at a time.
  const call = useCallback(async (path, options) => {
    try {
      return await apiRequest(path, options, token);
    } catch (err) {
      if (err.message === '__UNAUTHORIZED__') {
        showToast('Your session expired — please sign in again');
        setToken(null);
        setCurrentUserId(null);
        setMustChangePassword(false);
        writeStoredToken(null);
        throw new Error('Session expired');
      }
      throw err;
    }
  }, [token, showToast]);

  const currentUser = useMemo(() => users.find((u) => u.id === currentUserId) || null, [users, currentUserId]);

  // True for the brief window right after login/signup where a token exists
  // but the live user list hasn't loaded yet. Someone who is genuinely new
  // (added by an admin/manager/team lead, not one of the original seeded
  // people) won't be found in `users` until that fetch resolves — without
  // this, Layout's "no currentUser -> bounce to sign-in" guard fires on that
  // first render and kicks a freshly-authenticated person right back out.
  const authPending = !!token && !dataReady;

  const login = useCallback(async (email, password) => {
    try {
      const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(result.token);
      setCurrentUserId(result.user.id);
      setMustChangePassword(result.user.mustChangePassword);
      writeStoredToken(result.token);
      return { ok: true, mustChangePassword: result.user.mustChangePassword, role: result.user.role };
    } catch (err) {
      // Login.jsx shows this inline on the form itself — a toast alone was
      // easy to miss and disappeared before anyone read it.
      return { ok: false, error: err.message || 'Could not sign in' };
    }
  }, []);

  // Claims an existing seeded identity by name (see backend/routes/auth.js)
  // — signup never creates a new person. `role`/`departmentId` are the
  // dropdown selections, used server-side to disambiguate/validate against
  // what's on file for that name rather than as a free choice.
  const signup = useCallback(async (name, email, password, role, departmentId) => {
    try {
      const result = await apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password, role, departmentId }) });
      setToken(result.token);
      setCurrentUserId(result.user.id);
      setMustChangePassword(false);
      writeStoredToken(result.token);
      return { ok: true, role: result.user.role };
    } catch (err) {
      showToast(err.message || 'Could not create your account');
      return { ok: false };
    }
  }, [showToast]);

  // Pre-login department list/create for the Sign Up form's Department
  // dropdown — see the public backend/routes/auth.js `/departments` routes.
  const fetchSignupDepartments = useCallback(async () => {
    try {
      return await apiRequest('/auth/departments');
    } catch {
      return [];
    }
  }, []);

  const addSignupDepartment = useCallback(async (name) => {
    try {
      const result = await apiRequest('/auth/departments', { method: 'POST', body: JSON.stringify({ name }) });
      return result.department;
    } catch (err) {
      showToast(err.message || 'Could not add that department');
      return null;
    }
  }, [showToast]);

  const logout = useCallback(() => {
    setToken(null);
    setCurrentUserId(null);
    setMustChangePassword(false);
    writeStoredToken(null);
    setTasks([]);
    setDailyUpdates([]);
    setActivity([]);
    setNotifications([]);
    setDataReady(false);
  }, []);

  // Restore a session from a token left over from a previous page load (a
  // refresh, or the tab being reopened) — without this, reloading the page
  // silently signs everyone out even though their token is still valid.
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) { setSessionRestoring(false); return; }
    let cancelled = false;
    apiRequest('/auth/me', {}, stored).then((result) => {
      if (cancelled) return;
      setToken(stored);
      setCurrentUserId(result.user.id);
      setMustChangePassword(result.user.mustChangePassword);
    }).catch(() => {
      if (!cancelled) writeStoredToken(null);
    }).finally(() => { if (!cancelled) setSessionRestoring(false); });
    return () => { cancelled = true; };
  }, []);

  // Protected data can only be fetched once we hold a valid session token —
  // this effect (re-)loads it right after login, not before.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setDataReady(false);
      try {
        const [userList, departmentList, teamList, taskList, updateList, activityList, notificationList] = await Promise.all([
          apiRequest('/users', {}, token),
          apiRequest('/departments', {}, token),
          apiRequest('/teams', {}, token),
          apiRequest('/tasks', {}, token),
          apiRequest('/daily-updates', {}, token),
          apiRequest('/activity', {}, token),
          apiRequest('/notifications', {}, token),
        ]);
        if (cancelled) return;
        setUsers(userList);
        setDepartments(departmentList);
        setTeams(teamList);
        setTasks(taskList);
        setDailyUpdates(updateList);
        setActivity(activityList);
        setNotifications(notificationList);
      } catch (err) {
        console.error('Failed to load TaskFlow data from the backend:', err);
        showToast('Could not reach the backend server — is it running on port 4000?');
      } finally {
        if (!cancelled) setDataReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // No real-time channel in this demo, so poll for new notifications (someone
  // else's action — e.g. being assigned a task — otherwise wouldn't show up
  // until the next full data reload).
  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      apiRequest('/notifications', {}, token).then(setNotifications).catch(() => {});
    }, 20000);
    return () => window.clearInterval(interval);
  }, [token]);

  // Same problem for tasks and daily updates — they're otherwise only ever
  // loaded once at login, so anything someone else does (a reviewer approves
  // a task, a teammate submits their update) stays invisible in this tab
  // until a manual reload. Poll a little less aggressively than notifications
  // since these are heavier fetches.
  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      apiRequest('/tasks', {}, token).then(setTasks).catch(() => {});
      apiRequest('/daily-updates', {}, token).then(setDailyUpdates).catch(() => {});
    }, 30000);
    return () => window.clearInterval(interval);
  }, [token]);

  // Scope: which tasks a given user is allowed to see. The backend now
  // enforces this same rule on every request (a role can't fetch or mutate
  // outside it via a direct API call either) — this client-side copy just
  // keeps the existing per-page filtering (e.g. "my team" vs "my tasks") working.
  const scopedTasks = useCallback((user) => {
    if (!user) return [];
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) return tasks;
    if (user.role === ROLES.MANAGER) return tasks.filter((task) => {
      const team = teams.find((t) => t.id === task.teamId);
      return team && team.departmentId === user.departmentId;
    });
    if (user.role === ROLES.ASSISTANT_MANAGER || user.role === ROLES.TEAM_LEAD) return tasks.filter((task) => task.teamId === user.teamId);
    if (user.role === ROLES.EMPLOYEE) return tasks.filter((task) => task.assigneeId === user.id);
    return [];
  }, [tasks, teams]);

  // Same scoping rule, applied to daily updates instead of tasks.
  const scopedDailyUpdates = useCallback((user) => {
    if (!user) return [];
    const authorTeam = (update) => users.find((u) => u.id === update.userId)?.teamId;
    const authorDept = (update) => users.find((u) => u.id === update.userId)?.departmentId;
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) return dailyUpdates;
    if (user.role === ROLES.MANAGER) return dailyUpdates.filter((u) => authorDept(u) === user.departmentId);
    if (user.role === ROLES.ASSISTANT_MANAGER || user.role === ROLES.TEAM_LEAD) return dailyUpdates.filter((u) => authorTeam(u) === user.teamId);
    if (user.role === ROLES.EMPLOYEE) return dailyUpdates.filter((u) => u.userId === user.id);
    return [];
  }, [dailyUpdates, users]);

  // A task counts as overdue whenever its due date has passed and it isn't
  // done yet — regardless of which of the other buckets it would otherwise
  // fall into. That mirrors how the KPI cards are meant to read: overdue is
  // called out on its own rather than double-counted inside "in progress".
  const bucketOf = useCallback((task) => {
    if (task.status === STATUS.DRAFT) return 'draft';
    if (task.status === STATUS.COMPLETED) return 'completed';
    // Not yet approved to start work, so a stale due date shouldn't read as overdue.
    if (task.status === STATUS.PENDING_APPROVAL) return 'pending';
    if (task.dueDate && task.dueDate < TODAY) return 'overdue';
    if (task.status === STATUS.TODO) return 'pending';
    return 'inProgress'; // In Progress or Submitted for Review
  }, []);

  const statsFor = useCallback((taskList) => {
    const visible = taskList.filter((task) => task.status !== STATUS.DRAFT);
    const completed = visible.filter((task) => bucketOf(task) === 'completed').length;
    const overdue = visible.filter((task) => bucketOf(task) === 'overdue').length;
    const pending = visible.filter((task) => bucketOf(task) === 'pending').length;
    const inProgress = visible.length - completed - overdue - pending;
    return { total: visible.length, completed, inProgress, pending, overdue };
  }, [bucketOf]);

  const replaceTask = useCallback((task) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [task, ...prev];
      const next = prev.slice();
      next[idx] = task;
      return next;
    });
  }, []);

  const applyMutation = useCallback((result) => {
    if (result.task) replaceTask(result.task);
    if (result.activity) setActivity(result.activity);
  }, [replaceTask]);

  // Tasks are only bulk-loaded once at login, so a task's detail page can
  // otherwise show stale data if another user (a reviewer, a team lead)
  // changed it in the meantime — this pulls the current version on demand.
  const refreshTask = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}`);
      replaceTask(result.task);
    } catch {
      // silent — the page still has whatever it last loaded
    }
  }, [call, replaceTask]);

  const createTask = useCallback(async (data) => {
    try {
      const result = await call('/tasks', { method: 'POST', body: JSON.stringify(data) });
      applyMutation(result);
      if (data.isDraft) showToast('Draft saved');
      else if (result.task.status === STATUS.PENDING_APPROVAL) showToast('Sent for approval');
      else showToast(`Task assigned to ${users.find((u) => u.id === data.assigneeId)?.name}`);
      return result.task;
    } catch (err) {
      showToast(err.message || 'Could not save task');
      throw err;
    }
  }, [call, applyMutation, showToast, users]);

  const updateTask = useCallback(async (taskId, patch) => {
    try {
      const result = await call(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(patch) });
      applyMutation(result);
      showToast('Task updated');
      return result.task;
    } catch (err) {
      showToast(err.message || 'Could not update task');
      throw err;
    }
  }, [call, applyMutation, showToast]);

  // Drafts are just tasks with status DRAFT — kept out of every stats/list
  // view already (see bucketOf/statsFor), but need their own lifecycle here.
  const myDrafts = useCallback((userId) => tasks.filter((t) => t.status === STATUS.DRAFT && t.createdBy === userId), [tasks]);

  // Same endpoint deletes a draft or a published task — the backend checks
  // ownership either way, so one function covers both call sites.
  const deleteTask = useCallback(async (taskId, { isDraft } = {}) => {
    try {
      await call(`/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast(isDraft ? 'Draft deleted' : 'Task deleted');
    } catch (err) {
      showToast(err.message || 'Could not delete task');
    }
  }, [call, showToast]);

  const publishDraft = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}/publish`, { method: 'POST' });
      applyMutation(result);
      showToast(result.task.status === STATUS.PENDING_APPROVAL
        ? 'Sent for approval'
        : `Task assigned to ${users.find((u) => u.id === result.task.assigneeId)?.name}`);
    } catch (err) {
      showToast(err.message || 'Could not publish draft');
    }
  }, [call, applyMutation, showToast, users]);

  const approveTaskCreation = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}/approve-creation`, { method: 'POST' });
      applyMutation(result);
      showToast('Task approved');
    } catch (err) {
      showToast(err.message || 'Could not approve this task');
    }
  }, [call, applyMutation, showToast]);

  const rejectTaskCreation = useCallback(async (taskId, reason) => {
    try {
      const result = await call(`/tasks/${taskId}/reject-creation`, { method: 'POST', body: JSON.stringify({ reason }) });
      applyMutation(result);
      showToast('Sent back for changes');
    } catch (err) {
      showToast(err.message || 'Could not send this back');
    }
  }, [call, applyMutation, showToast]);

  const setTaskProgress = useCallback(async (taskId, progress) => {
    try {
      const result = await call(`/tasks/${taskId}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) });
      applyMutation(result);
      showToast('Progress updated');
    } catch (err) {
      showToast(err.message || 'Could not update progress');
    }
  }, [call, applyMutation, showToast]);

  const setTaskStatus = useCallback(async (taskId, status) => {
    try {
      const result = await call(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      applyMutation(result);
      showToast(`Status changed to "${status}"`);
    } catch (err) {
      showToast(err.message || 'Could not update status');
    }
  }, [call, applyMutation, showToast]);

  const requestChanges = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}/request-changes`, { method: 'POST' });
      applyMutation(result);
      showToast('Changes requested');
    } catch (err) {
      showToast(err.message || 'Could not request changes');
    }
  }, [call, applyMutation, showToast]);

  const submitForReview = useCallback(async (taskId, note) => {
    try {
      const result = await call(`/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify({ note }) });
      applyMutation(result);
      showToast('Submitted for review');
    } catch (err) {
      showToast(err.message || 'Could not submit for review');
    }
  }, [call, applyMutation, showToast]);

  const approveTask = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}/approve`, { method: 'POST' });
      applyMutation(result);
      showToast('Task approved');
    } catch (err) {
      showToast(err.message || 'Could not approve task');
    }
  }, [call, applyMutation, showToast]);

  const reassignTask = useCallback(async (taskId, assigneeId) => {
    try {
      const result = await call(`/tasks/${taskId}/reassign`, { method: 'POST', body: JSON.stringify({ assigneeId }) });
      applyMutation(result);
      showToast(`Reassigned to ${users.find((u) => u.id === assigneeId)?.name}`);
    } catch (err) {
      showToast(err.message || 'Could not reassign this task');
    }
  }, [call, applyMutation, showToast, users]);

  const requestExtension = useCallback(async (taskId, requestedDueDate, reason) => {
    try {
      const result = await call(`/tasks/${taskId}/request-extension`, { method: 'POST', body: JSON.stringify({ requestedDueDate, reason }) });
      applyMutation(result);
      showToast('Extension requested');
    } catch (err) {
      showToast(err.message || 'Could not request an extension');
    }
  }, [call, applyMutation, showToast]);

  const approveExtension = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}/approve-extension`, { method: 'POST' });
      applyMutation(result);
      showToast('Extension approved');
    } catch (err) {
      showToast(err.message || 'Could not approve the extension');
    }
  }, [call, applyMutation, showToast]);

  const rejectExtension = useCallback(async (taskId) => {
    try {
      const result = await call(`/tasks/${taskId}/reject-extension`, { method: 'POST' });
      applyMutation(result);
      showToast('Extension declined');
    } catch (err) {
      showToast(err.message || 'Could not decline the extension');
    }
  }, [call, applyMutation, showToast]);

  const setTaskMarks = useCallback(async (taskId, marks) => {
    try {
      const result = await call(`/tasks/${taskId}/marks`, { method: 'PATCH', body: JSON.stringify({ marks }) });
      applyMutation(result);
      showToast(marks === null ? 'Marks cleared' : `Marked ${marks}%`);
    } catch (err) {
      showToast(err.message || 'Could not save marks');
    }
  }, [call, applyMutation, showToast]);

  const toggleSubtask = useCallback(async (taskId, subtaskId) => {
    try {
      const result = await call(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH' });
      applyMutation(result);
    } catch (err) {
      showToast(err.message || 'Could not update subtask');
    }
  }, [call, applyMutation, showToast]);

  const addComment = useCallback(async (taskId, authorId, text) => {
    if (!text || !text.trim()) return;
    try {
      const result = await call(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ authorId, text: text.trim() }) });
      applyMutation(result);
      showToast('Comment added');
    } catch (err) {
      showToast(err.message || 'Could not add comment');
    }
  }, [call, applyMutation, showToast]);

  const editComment = useCallback(async (taskId, commentId, text) => {
    if (!text || !text.trim()) return;
    try {
      const result = await call(`/tasks/${taskId}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ text: text.trim() }) });
      applyMutation(result);
      showToast('Comment updated');
    } catch (err) {
      showToast(err.message || 'Could not update comment');
    }
  }, [call, applyMutation, showToast]);

  const deleteComment = useCallback(async (taskId, commentId) => {
    try {
      const result = await call(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
      applyMutation(result);
      showToast('Comment deleted');
    } catch (err) {
      showToast(err.message || 'Could not delete comment');
    }
  }, [call, applyMutation, showToast]);

  const addDailyUpdate = useCallback(async (data) => {
    try {
      const result = await call('/daily-updates', { method: 'POST', body: JSON.stringify(data) });
      setDailyUpdates((prev) => [result.dailyUpdate, ...prev]);
      if (result.activity) setActivity(result.activity);
      showToast('Daily update submitted');
      return result.dailyUpdate;
    } catch (err) {
      showToast(err.message || 'Could not submit daily update');
      throw err;
    }
  }, [call, showToast]);

  const editDailyUpdate = useCallback(async (updateId, data) => {
    try {
      const result = await call(`/daily-updates/${updateId}`, { method: 'PATCH', body: JSON.stringify(data) });
      setDailyUpdates((prev) => prev.map((u) => (u.id === updateId ? result.dailyUpdate : u)));
      showToast('Daily update saved');
      return result.dailyUpdate;
    } catch (err) {
      showToast(err.message || 'Could not update daily update');
      throw err;
    }
  }, [call, showToast]);

  const deleteDailyUpdate = useCallback(async (updateId) => {
    try {
      await call(`/daily-updates/${updateId}`, { method: 'DELETE' });
      setDailyUpdates((prev) => prev.filter((u) => u.id !== updateId));
      showToast('Daily update deleted');
    } catch (err) {
      showToast(err.message || 'Could not delete daily update');
    }
  }, [call, showToast]);

  // Returns { user, tempPassword } — there's no email delivery wired up yet,
  // so the caller (a modal on My Team / Departments) is responsible for
  // showing that temp password once so it can be handed to the new hire.
  const addTeamMember = useCallback(async (data) => {
    try {
      const result = await call('/users', { method: 'POST', body: JSON.stringify(data) });
      setUsers((prev) => [...prev, result.user]);
      showToast(`${result.user.name} added to the team`);
      return result;
    } catch (err) {
      showToast(err.message || 'Could not add team member');
      throw err;
    }
  }, [call, showToast]);

  const addManager = useCallback(async (data) => {
    try {
      const result = await call('/users', { method: 'POST', body: JSON.stringify({ ...data, role: 'manager' }) });
      setUsers((prev) => [...prev, result.user]);
      showToast(`${result.user.name} added as manager`);
      return result;
    } catch (err) {
      showToast(err.message || 'Could not add manager');
      throw err;
    }
  }, [call, showToast]);

  // Admin/Manager: adds a new Assistant Manager onto an EXISTING team (data
  // must include teamId) — unlike addTeamLead below, this never creates a
  // new team, since Assistant Manager slots into a team that already has a
  // lead. One per team; the backend 409s if that team already has one.
  const addAssistantManager = useCallback(async (data) => {
    try {
      const result = await call('/users', { method: 'POST', body: JSON.stringify({ ...data, role: 'assistant_manager' }) });
      setUsers((prev) => [...prev, result.user]);
      setTeams((prev) => prev.map((t) => (t.id === data.teamId ? { ...t, assistantManagerId: result.user.id } : t)));
      showToast(`${result.user.name} added as Assistant Manager`);
      return result;
    } catch (err) {
      showToast(err.message || 'Could not add assistant manager');
      throw err;
    }
  }, [call, showToast, setTeams]);

  // Manager-only: adds a new Team Lead along with a brand-new team for them
  // to run (see backend/routes/users.js — every existing team already has a
  // lead, so there's never an existing headless team to assign into instead).
  const addTeamLead = useCallback(async (data) => {
    try {
      const result = await call('/users', { method: 'POST', body: JSON.stringify({ ...data, role: 'team_lead' }) });
      setUsers((prev) => [...prev, result.user]);
      setTeams((prev) => [...prev, { id: result.user.teamId, name: data.teamName, departmentId: result.user.departmentId, leadId: result.user.id }]);
      showToast(`${result.user.name} added as Team Lead of ${data.teamName}`);
      return result;
    } catch (err) {
      showToast(err.message || 'Could not add team lead');
      throw err;
    }
  }, [call, showToast, setTeams]);

  // Admin-only: a standalone, lead-less team — addTeamLead above already
  // covers the normal "new team lead needs a fresh team" path; this fills
  // the gap it leaves (a pre-staffed placeholder, or replacing one removed
  // via deleteTeam).
  const addTeam = useCallback(async (data) => {
    try {
      const result = await call('/teams', { method: 'POST', body: JSON.stringify(data) });
      setTeams((prev) => [...prev, result.team]);
      showToast(`${result.team.name} added`);
      return result.team;
    } catch (err) {
      showToast(err.message || 'Could not add team');
      throw err;
    }
  }, [call, showToast, setTeams]);

  const editTeam = useCallback(async (id, data) => {
    try {
      const result = await call(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      setTeams((prev) => prev.map((t) => (t.id === id ? result.team : t)));
      showToast('Team updated');
      return result.team;
    } catch (err) {
      showToast(err.message || 'Could not update team');
      throw err;
    }
  }, [call, showToast, setTeams]);

  const deleteTeam = useCallback(async (id) => {
    try {
      await call(`/teams/${id}`, { method: 'DELETE' });
      setTeams((prev) => prev.filter((t) => t.id !== id));
      showToast('Team deleted');
    } catch (err) {
      showToast(err.message || 'Could not delete team');
      throw err;
    }
  }, [call, showToast, setTeams]);

  // Scoped the same way on the backend as creation: admin manages anyone,
  // a manager manages their own department, a team lead their own team.
  const setUserActive = useCallback(async (userId, isActive) => {
    try {
      const result = await call(`/users/${userId}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      setUsers((prev) => prev.map((u) => (u.id === userId ? result.user : u)));
      showToast(isActive ? `${result.user.name} reactivated` : `${result.user.name} deactivated`);
    } catch (err) {
      showToast(err.message || 'Could not update this account');
    }
  }, [call, showToast]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await call('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      setMustChangePassword(false);
      showToast('Password updated');
    } catch (err) {
      showToast(err.message || 'Could not update password');
      throw err;
    }
  }, [call, showToast]);

  // Deliberately not routed through `call` — this must work for a
  // signed-out visitor who forgot their password, so it can't require a token.
  const requestPasswordReset = useCallback(async (email) => {
    try {
      return await apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    } catch (err) {
      showToast(err.message || 'Could not process that request');
      throw err;
    }
  }, [showToast]);

  const resetPassword = useCallback(async (resetToken, newPassword) => {
    try {
      await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, newPassword }) });
      showToast('Password reset — you can sign in now');
    } catch (err) {
      showToast(err.message || 'Could not reset password');
      throw err;
    }
  }, [showToast]);

  const addDepartment = useCallback(async (data) => {
    try {
      const result = await call('/departments', { method: 'POST', body: JSON.stringify(data) });
      setDepartments((prev) => [...prev, result.department]);
      showToast(`${result.department.name} added`);
      return result.department;
    } catch (err) {
      showToast(err.message || 'Could not add department');
      throw err;
    }
  }, [call, showToast]);

  const editDepartment = useCallback(async (id, data) => {
    try {
      const result = await call(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      setDepartments((prev) => prev.map((d) => (d.id === id ? result.department : d)));
      showToast('Department updated');
      return result.department;
    } catch (err) {
      showToast(err.message || 'Could not update department');
      throw err;
    }
  }, [call, showToast]);

  const deleteDepartment = useCallback(async (id) => {
    try {
      await call(`/departments/${id}`, { method: 'DELETE' });
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      showToast('Department deleted');
    } catch (err) {
      showToast(err.message || 'Could not delete department');
      throw err;
    }
  }, [call, showToast]);

  const editUser = useCallback(async (id, data) => {
    try {
      const result = await call(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      setUsers((prev) => prev.map((u) => (u.id === id ? result.user : u)));
      showToast('Member updated');
      return result.user;
    } catch (err) {
      showToast(err.message || 'Could not update member');
      throw err;
    }
  }, [call, showToast]);

  const deleteUser = useCallback(async (id) => {
    try {
      await call(`/users/${id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast('Member removed');
    } catch (err) {
      showToast(err.message || 'Could not remove member');
      throw err;
    }
  }, [call, showToast]);

  // No toast here — the caller shows the returned temp password in a modal
  // instead, since it's a one-time value the admin needs to actually read
  // and relay, not a message that can just flash and disappear.
  const resetUserPassword = useCallback(async (id) => {
    try {
      const result = await call(`/users/${id}/password`, { method: 'PATCH' });
      return result.tempPassword;
    } catch (err) {
      showToast(err.message || 'Could not reset password');
      throw err;
    }
  }, [call, showToast]);

  const markNotificationRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await call(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // non-critical — the next poll will reconcile either way
    }
  }, [call]);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await call('/notifications/read-all', { method: 'POST' });
    } catch {
      // non-critical — the next poll will reconcile either way
    }
  }, [call]);

  const value = {
    users, teams, departments, TODAY, token,
    currentUser, login, signup, fetchSignupDepartments, addSignupDepartment, logout, dataReady, authPending, sessionRestoring,
    mustChangePassword, changePassword, requestPasswordReset, resetPassword,
    tasks, dailyUpdates, activity, notifications,
    scopedTasks, scopedDailyUpdates, statsFor, bucketOf, myDrafts,
    createTask, updateTask, deleteTask, publishDraft, refreshTask, setTaskProgress, setTaskStatus, requestChanges, submitForReview, approveTask, approveTaskCreation, rejectTaskCreation, reassignTask, requestExtension, approveExtension, rejectExtension, setTaskMarks, toggleSubtask,
    addComment, editComment, deleteComment, addDailyUpdate, editDailyUpdate, deleteDailyUpdate, addTeamMember, addManager, addAssistantManager, addTeamLead, addTeam, editTeam, deleteTeam, addDepartment, editDepartment, deleteDepartment, editUser, deleteUser, resetUserPassword, setUserActive,
    markNotificationRead, markAllNotificationsRead,
    toast, showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
