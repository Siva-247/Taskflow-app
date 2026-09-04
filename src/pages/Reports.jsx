import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, PRIORITY, ROLES, teamById } from '../data/mockData.js';
import { Card, Select, TextInput, Button, StatusBadge } from '../components/ui.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { IconDownload } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';
import { formatDate, downloadCsv } from '../utils.js';

const STATUS_OPTIONS = [STATUS.PENDING_APPROVAL, STATUS.TODO, STATUS.IN_PROGRESS, STATUS.IN_REVIEW, STATUS.COMPLETED];

export default function Reports() {
  const { currentUser, users, teams, departments, scopedTasks, bucketOf, statsFor, TODAY } = useApp();
  const allowed = useRoleGuard([ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAM_LEAD]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');

  if (!allowed) return null;

  const scoped = scopedTasks(currentUser).filter((t) => t.status !== STATUS.DRAFT);
  const availableTeams = teams.filter((team) => scoped.some((t) => t.teamId === team.id));

  const filtered = useMemo(() => scoped.filter((task) => {
    if (statusFilter === 'Overdue' && bucketOf(task) !== 'overdue') return false;
    if (statusFilter !== 'all' && statusFilter !== 'Overdue' && task.status !== statusFilter) return false;
    if (teamFilter !== 'all' && task.teamId !== teamFilter) return false;
    if (dueFrom && task.dueDate < dueFrom) return false;
    if (dueTo && task.dueDate > dueTo) return false;
    return true;
  }), [scoped, statusFilter, teamFilter, dueFrom, dueTo, bucketOf]);

  const stats = statsFor(filtered);
  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);
  const scopeLabel = {
    [ROLES.ADMIN]: 'Company-wide report',
    [ROLES.MANAGER]: `${myDepartment?.name || 'Department'} report`,
    [ROLES.TEAM_LEAD]: 'Team report',
  }[currentUser.role];

  const handleExport = () => {
    downloadCsv(`taskflow-report-${TODAY}.csv`, filtered, [
      { label: 'Task', value: (t) => t.title },
      { label: 'Assignee', value: (t) => users.find((u) => u.id === t.assigneeId)?.name || '' },
      { label: 'Assigned By', value: (t) => users.find((u) => u.id === t.createdBy)?.name || '' },
      { label: 'Team', value: (t) => teamById(t.teamId)?.name || '' },
      { label: 'Priority', value: (t) => t.priority },
      { label: 'Status', value: (t) => t.status },
      { label: 'Progress', value: (t) => `${t.progress}%` },
      { label: 'Start Date', value: (t) => t.startDate },
      { label: 'Due Date', value: (t) => t.dueDate },
      { label: 'Overdue', value: (t) => (bucketOf(t) === 'overdue' ? 'Yes' : 'No') },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--heading)' }}>Reports</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 16, color: 'var(--text-secondary)', marginTop: 4 }}>{scopeLabel}</div>
        </div>
        <Button onClick={handleExport} disabled={filtered.length === 0}>
          <IconDownload size={14} color="#FFFFFF" /> Export CSV
        </Button>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', '--cols': 'repeat(5,1fr)', gap: 14 }}>
        <ReportStat value={stats.total} label="Total tasks" />
        <ReportStat value={stats.completed} label="Completed" color="var(--accent-dark)" />
        <ReportStat value={stats.inProgress} label="In progress" color="var(--accent-mid)" />
        <ReportStat value={stats.overdue} label="Overdue" color="var(--amber-text)" />
        <ReportStat value={`${completionRate}%`} label="Completion rate" />
      </div>

      <Card padded={false} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="filter-field" style={{ width: 170 }}>
            <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })), { value: 'Overdue', label: 'Overdue' }]} />
          </div>
          {availableTeams.length > 1 && (
            <div className="filter-field" style={{ width: 170 }}>
              <Select value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: 'All teams' }, ...availableTeams.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
          )}
          <div className="filter-field" style={{ width: 160 }}>
            <DatePicker value={dueFrom} onChange={setDueFrom} placeholder="Due from" />
          </div>
          <div className="filter-field" style={{ width: 160 }}>
            <DatePicker value={dueTo} onChange={setDueTo} placeholder="Due to" />
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.1fr 1fr 0.8fr 1.1fr 0.8fr 0.8fr', padding: '12px 22px', background: 'var(--field-bg)', borderBottom: '1px solid var(--border)' }}>
              {['Task', 'Assignee', 'Team', 'Priority', 'Status', 'Progress', 'Due'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {filtered.map((task, i) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const team = teamById(task.teamId);
              return (
                <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.1fr 1fr 0.8fr 1.1fr 0.8fr 0.8fr', padding: '13px 22px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{task.title}</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 15, color: 'var(--text-secondary)' }}>{assignee?.name}</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 15, color: 'var(--text-secondary)' }}>{team?.name.replace("'s Team", '')}</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14.5, color: 'var(--text-secondary)' }}>{task.priority}</div>
                  <div><StatusBadge status={task.status} /></div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--heading)' }}>{task.progress}%</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14.5, color: bucketOf(task) === 'overdue' ? 'var(--amber-text)' : 'var(--text-muted)' }}>{formatDate(task.dueDate)}</div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 15.5, color: 'var(--text-muted)' }}>
                No tasks match your filters.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReportStat({ value, label, color = 'var(--heading)' }) {
  return (
    <Card style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color }}>{value}</div>
      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </Card>
  );
}
