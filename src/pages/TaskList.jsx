import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, PRIORITY, ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, StatusBadge, PriorityDot, Button, Select, TextInput } from '../components/ui.jsx';
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

  const canCreate = currentUser.role === ROLES.TEAM_LEAD || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.EMPLOYEE;

  const scopeLabel = {
    [ROLES.ADMIN]: 'All tasks — company-wide',
    [ROLES.MANAGER]: 'Tasks across your department',
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

  const filtered = useMemo(() => visible.filter((task) => {
    if (status === 'Approval Requests' && !isApprovalRequest(task)) return false;
    if (status === 'Overdue' && bucketOf(task) !== 'overdue') return false;
    if (status !== 'all' && status !== 'Overdue' && status !== 'Approval Requests' && task.status !== status) return false;
    if (priority !== 'all' && task.priority !== priority) return false;
    if (teamFilter !== 'all' && task.teamId !== teamFilter) return false;
    if (assigneeFilter !== 'all' && task.assigneeId !== assigneeFilter) return false;
    if (dueBefore && task.dueDate > dueBefore) return false;
    if (search.trim() && !task.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [visible, status, priority, teamFilter, assigneeFilter, dueBefore, search, bucketOf, users]);

  const showTeamColumn = availableTeams.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Tasks</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{scopeLabel}</div>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/tasks/new')}>
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
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ width: 158 }}>
            <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })), { value: 'Overdue', label: 'Overdue' }, { value: 'Approval Requests', label: 'Approval Requests' }]} />
          </div>
          <div style={{ width: 140 }}>
            <Select value={priority} onChange={setPriority} options={[{ value: 'all', label: 'All priorities' }, ...PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))]} />
          </div>
          {availableTeams.length > 1 && (
            <div style={{ width: 150 }}>
              <Select value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: 'All teams' }, ...availableTeams.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
          )}
          {availableAssignees.length > 1 && (
            <div style={{ width: 150 }}>
              <Select value={assigneeFilter} onChange={setAssigneeFilter} options={[{ value: 'all', label: 'All assignees' }, ...availableAssignees.map((u) => ({ value: u.id, label: u.name }))]} />
            </div>
          )}
          <div style={{ width: 150 }}>
            <TextInput type="date" value={dueBefore} onChange={setDueBefore} placeholder="Due before" />
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
            <div style={{ display: 'grid', gridTemplateColumns: showTeamColumn ? '2fr 1.1fr 1.1fr 0.9fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr' : '2fr 1.1fr 1.1fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr', padding: '12px 22px', background: 'var(--field-bg)', borderBottom: '1px solid var(--border)' }}>
              {['Task', 'Assigned To', 'Assigned By', ...(showTeamColumn ? ['Team'] : []), 'Priority', 'Status', 'Progress', 'Due', 'Actions'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {filtered.map((task, i) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const assignedBy = users.find((u) => u.id === task.createdBy);
              const team = teamById(task.teamId);
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  style={{
                    display: 'grid', gridTemplateColumns: showTeamColumn ? '2fr 1.1fr 1.1fr 0.9fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr' : '2fr 1.1fr 1.1fr 0.8fr 1.1fr 1.2fr 0.8fr 0.7fr', padding: '15px 22px', alignItems: 'center',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{task.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar initial={assignee?.initial} size={22} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{assignee?.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{assignedBy?.name || '—'}</div>
                  {showTeamColumn && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{team?.name.replace("'s Team", '')}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <PriorityDot priority={task.priority} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{task.priority}</span>
                  </div>
                  <div><StatusBadge status={task.status} /></div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{task.progress}%</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: bucketOf(task) === 'overdue' ? 'var(--amber-text)' : 'var(--text-muted)' }}>{task.dueDate.slice(5)}</div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Manrope',system-ui,sans-serif",
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
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                No tasks match your filters.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
