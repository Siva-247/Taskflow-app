import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, PRIORITY, ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, StatusBadge, PriorityDot, Button, Select, TextInput, Pagination, PAGE_SIZE } from '../components/ui.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { IconSearch, IconPlusCircle, IconArrowRight } from '../components/icons.jsx';

const STATUS_OPTIONS = [STATUS.PENDING_APPROVAL, STATUS.TODO, STATUS.IN_PROGRESS, STATUS.IN_REVIEW, STATUS.COMPLETED];
const PRIORITY_OPTIONS = [PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW];

export default function TaskList() {
  const { currentUser, users, teams, scopedTasks, bucketOf } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [priority, setPriority] = useState('all');
  const [teamFilter, setTeamFilter] = useState(params.get('team') || 'all');
  const [assigneeFilter, setAssigneeFilter] = useState(params.get('assignee') || 'all');
  const [dueBefore, setDueBefore] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  // This page is one route (/tasks) reused by several nav links that only
  // differ by query string (Approvals, Reviews, Overdue, "View all" from a
  // dashboard, etc). React Router doesn't remount the component for a
  // same-route navigation, so the useState initializers above only ever ran
  // once — clicking from Approvals to Reviews changed the URL but left the
  // filters stuck on whatever they were first mounted with. Re-sync them
  // whenever the URL's own filter params actually change.
  useEffect(() => {
    setStatus(params.get('status') || 'all');
    setTeamFilter(params.get('team') || 'all');
    setAssigneeFilter(params.get('assignee') || 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('status'), params.get('team'), params.get('assignee')]);

  const canCreate = [ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE].includes(currentUser.role);

  const scopeLabel = {
    [ROLES.SUPER_ADMIN]: 'All tasks — company-wide',
    [ROLES.ADMIN]: 'All tasks — company-wide',
    [ROLES.MANAGER]: 'Tasks across your department',
    [ROLES.ASSISTANT_MANAGER]: "Your team's tasks",
    [ROLES.TEAM_LEAD]: "Your team's tasks",
    [ROLES.EMPLOYEE]: 'Tasks assigned to you',
  }[currentUser.role];

  const visible = scopedTasks(currentUser).filter((t) => t.status !== STATUS.DRAFT);

  // A task "is an approval request" if its creator needed sign-off to publish
  // it in the first place (team lead or employee) — true for its whole life,
  // not just while it's sitting at Pending Approval. Lets a team lead's
  // Approvals view keep showing their reports' requests after they're
  // resolved, instead of the item just vanishing the moment it's approved.
  const isApprovalRequest = (task) => {
    const creator = users.find((u) => u.id === task.createdBy);
    return Boolean(creator && (creator.role === ROLES.TEAM_LEAD || creator.role === ROLES.EMPLOYEE));
  };

  const availableTeams = teams.filter((team) => visible.some((task) => task.teamId === team.id));
  const availableAssignees = users.filter((u) => visible.some((task) => task.assigneeId === u.id));

  // What the small approval/review-status tag under a task's Status badge
  // should say — shown in every filter view (not just "Pending Approval" or
  // "Approvals & Reviews"), so this history stays visible even once a
  // request is resolved and the task itself has dropped out of those
  // stricter filters. "Pending approval"/"Extension pending" while
  // something is still waiting on a decision, checked before the two
  // historical fallbacks (also in priority order: a review approval is
  // always the more recent, more relevant action on an already-completed
  // task than an earlier creation approval, so it wins when a task carries
  // both over its lifetime). Returns null for a task that's never touched
  // either flow.
  const approvalTag = (task) => {
    if (task.status === STATUS.PENDING_APPROVAL) return { label: 'Pending approval', resolved: false };
    if (task.requestedDueDate) return { label: 'Extension pending', resolved: false };
    if (task.reviewedBy) {
      const reviewer = users.find((u) => u.id === task.reviewedBy);
      return { label: task.reviewedBy === currentUser.id ? 'Reviewed by you' : `Reviewed by ${reviewer?.name || 'someone'}`, resolved: true };
    }
    if (task.approvedBy) {
      const approver = users.find((u) => u.id === task.approvedBy);
      return { label: task.approvedBy === currentUser.id ? 'Approved by you' : `Approved by ${approver?.name || 'someone'}`, resolved: true };
    }
    return null;
  };

  const filtered = useMemo(() => visible.filter((task) => {
    if (status === 'Approval Requests' && !isApprovalRequest(task)) return false;
    if (status === 'Overdue' && bucketOf(task) !== 'overdue') return false;
    if (status === STATUS.PENDING_APPROVAL) {
      // Strictly "still awaiting a decision" — a brand-new task awaiting
      // creation sign-off, or an existing task carrying an open due-date
      // extension request. `requestedDueDate` clears back to null the
      // moment that extension is approved or rejected (routes/tasks.js), so
      // this alone is a reliable "still open" check. A resolved creation
      // request drops out of this view once approved — find it via "All
      // statuses" or "Completed" instead.
      if (task.status !== STATUS.PENDING_APPROVAL && !task.requestedDueDate) return false;
    } else if (status === 'Approvals & Reviews') {
      // The landing view for the merged nav item: still-open items from
      // either flow (creation approval, due-date extension, or a review
      // submission awaiting sign-off) PLUS resolved history from either —
      // everything that ever needed this person's decision, unlike "All
      // statuses" which also includes tasks that never touched either flow.
      const stillOpen = task.status === STATUS.PENDING_APPROVAL || task.status === STATUS.IN_REVIEW || task.requestedDueDate;
      const resolved = task.approvedBy || task.reviewedBy;
      if (!stillOpen && !resolved) return false;
    } else if (status !== 'all' && status !== 'Overdue' && status !== 'Approval Requests' && task.status !== status) {
      return false;
    }
    if (priority !== 'all' && task.priority !== priority) return false;
    if (teamFilter !== 'all' && task.teamId !== teamFilter) return false;
    if (assigneeFilter !== 'all' && task.assigneeId !== assigneeFilter) return false;
    if (dueBefore && task.dueDate > dueBefore) return false;
    if (search.trim() && !task.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [visible, status, priority, teamFilter, assigneeFilter, dueBefore, search, bucketOf, users]);

  // A filter change makes "page 3" mean something completely different than
  // it did a moment ago — always land back on page 1 when the filters
  // themselves change. Deliberately NOT keyed on `filtered` itself, so a
  // background poll refresh (same filters, just newer data) doesn't yank
  // someone back to page 1 mid-browse.
  useEffect(() => setPage(1), [status, priority, teamFilter, assigneeFilter, dueBefore, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const showTeamColumn = availableTeams.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Tasks</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{scopeLabel}</div>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <IconPlusCircle size={15} color="#FFFFFF" /> Create task
          </Button>
        )}
      </div>

      <Card padded={false} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px' }}>
            <IconSearch size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by title..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          <div className="filter-field" style={{ width: 158 }}>
            <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })), { value: 'Overdue', label: 'Overdue' }, { value: 'Approval Requests', label: 'Approval Requests' }, { value: 'Approvals & Reviews', label: 'Approvals & Reviews' }]} />
          </div>
          <div className="filter-field" style={{ width: 140 }}>
            <Select value={priority} onChange={setPriority} options={[{ value: 'all', label: 'All priorities' }, ...PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))]} />
          </div>
          {availableTeams.length > 1 && (
            <div className="filter-field" style={{ width: 150 }}>
              <Select value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: 'All teams' }, ...availableTeams.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
          )}
          {availableAssignees.length > 1 && (
            <div className="filter-field" style={{ width: 150 }}>
              <Select value={assigneeFilter} onChange={setAssigneeFilter} options={[{ value: 'all', label: 'All assignees' }, ...availableAssignees.map((u) => ({ value: u.id, label: u.name }))]} />
            </div>
          )}
          <div className="filter-field" style={{ width: 150 }}>
            <DatePicker value={dueBefore} onChange={setDueBefore} placeholder="Due before" />
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
            <div className="table-head-brand" style={{ display: 'grid', gridTemplateColumns: showTeamColumn ? '2fr 1.1fr 1.1fr 0.9fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr' : '2fr 1.1fr 1.1fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr', padding: '12px 22px', borderBottom: '1px solid var(--border)' }}>
              {['Task', 'Assigned To', 'Assigned By', ...(showTeamColumn ? ['Team'] : []), 'Priority', 'Status', 'Progress', 'Due', 'Actions'].map((h) => (
                <div key={h} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {pageItems.map((task, i) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const assignedBy = users.find((u) => u.id === task.createdBy);
              const team = teamById(task.teamId);
              const tag = approvalTag(task);
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  style={{
                    display: 'grid', gridTemplateColumns: showTeamColumn ? '2fr 1.1fr 1.1fr 0.9fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr' : '2fr 1.1fr 1.1fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr', padding: '15px 22px', alignItems: 'center',
                    borderBottom: i < pageItems.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{task.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar initial={assignee?.initial} size={22} />
                    <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{assignee?.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{assignedBy?.name || '—'}</div>
                  {showTeamColumn && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{team?.name.replace("'s Team", '')}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <PriorityDot priority={task.priority} />
                    <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{task.priority}</span>
                  </div>
                  <div>
                    <StatusBadge status={task.status} />
                    {tag && (
                      <div style={{
                        marginTop: 5, display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                        fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5,
                        background: tag.resolved ? 'var(--accent-soft)' : 'var(--amber-bg)',
                        color: tag.resolved ? 'var(--accent-dark)' : 'var(--amber-text)',
                      }}>
                        {tag.label}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{task.progress}%</div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: bucketOf(task) === 'overdue' ? 'var(--amber-text)' : 'var(--text-muted)' }}>{task.dueDate ? task.dueDate.slice(5) : '—'}</div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Outfit',system-ui,sans-serif",
                      fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', background: 'transparent',
                      border: 'none', padding: '6px 4px', cursor: 'pointer', justifySelf: 'start',
                    }}
                  >
                    View <IconArrowRight size={12} />
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                No tasks match your filters.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Pagination page={page} totalItems={filtered.length} onChange={setPage} />

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
