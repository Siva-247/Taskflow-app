import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, ROLES, teamById } from '../data/mockData.js';
import StatBar, { defaultStatItems } from '../components/StatBar.jsx';
import { Card, Avatar } from '../components/ui.jsx';
import { IconEye, IconAlertTriangle } from '../components/icons.jsx';
import Donut from '../components/Donut.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

export default function TeamLeadDashboard() {
  const { currentUser, users, departments, statsFor, scopedTasks, TODAY } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard(ROLES.TEAM_LEAD);
  if (!allowed) return null;

  const team = teamById(currentUser.teamId);
  const department = departments.find((d) => d.id === currentUser.departmentId);
  const teamTasks = scopedTasks(currentUser).filter((t) => t.status !== STATUS.DRAFT);
  const stats = statsFor(teamTasks);

  const members = users.filter((u) => u.teamId === currentUser.teamId && u.role === ROLES.EMPLOYEE);
  const memberRows = members.map((u) => {
    const assigned = teamTasks.filter((t) => t.assigneeId === u.id);
    const uStats = statsFor(assigned);
    return { user: u, assigned: uStats.total, completed: uStats.completed };
  });

  const reviewTasks = teamTasks.filter((t) => t.status === STATUS.IN_REVIEW);
  const overdueTasks = teamTasks.filter((t) => t.status !== STATUS.COMPLETED && t.status !== STATUS.PENDING_APPROVAL && t.dueDate < TODAY);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Good morning, {currentUser.name}</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{department?.name} — {team?.name}</div>
      </div>

      <StatBar items={defaultStatItems(stats, 'Total Tasks')} />

      <Card padded={false}>
        <div style={{ padding: '22px 26px 4px', fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Team members</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', padding: '12px 26px', marginTop: 12, background: 'var(--field-bg)' }}>
              {['Employee', 'Role', 'Assigned', 'Completed'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {memberRows.map((row, i) => (
              <div
                key={row.user.id}
                onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', padding: '13px 26px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === memberRows.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar initial={row.user.initial} size={24} />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                </div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.user.title}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Tasks requiring review</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {reviewTasks.length === 0 && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '11px 0' }}>Nothing waiting on you.</div>}
            {reviewTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              return (
                <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <IconEye size={16} color="var(--amber-text)" />
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)' }}>{task.title} — {assignee?.name}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Overdue tasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {overdueTasks.length === 0 && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '11px 0' }}>Nothing overdue right now.</div>}
            {overdueTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const daysOver = Math.round((new Date(TODAY) - new Date(task.dueDate)) / 86400000);
              return (
                <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <IconAlertTriangle size={16} />
                  <div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{task.title}</div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{assignee?.name} · {daysOver} day{daysOver === 1 ? '' : 's'} overdue</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card style={{ maxWidth: 420 }}>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Team task completion</div>
        <Donut stats={stats} />
      </Card>
    </div>
  );
}
