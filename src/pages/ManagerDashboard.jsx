import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, ROLES, teamById } from '../data/mockData.js';
import StatBar, { defaultStatItems } from '../components/StatBar.jsx';
import { Card, Avatar } from '../components/ui.jsx';
import { IconAlertTriangle, IconCheckCircle, IconPlusCircle, IconUser, IconArrowRight } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

const WEEKS = [
  { label: 'Aug 1–7', start: '2026-08-01', end: '2026-08-07' },
  { label: 'Aug 8–14', start: '2026-08-08', end: '2026-08-14' },
  { label: 'Aug 15–21', start: '2026-08-15', end: '2026-08-21' },
  { label: 'Aug 22–28', start: '2026-08-22', end: '2026-08-28' },
  { label: 'Aug 29–Sep 4', start: '2026-08-29', end: '2026-09-04' },
];

export default function ManagerDashboard() {
  const { currentUser, users, teams, departments, statsFor, scopedTasks, activity, TODAY } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard(ROLES.MANAGER);
  if (!allowed) return null;

  const department = departments.find((d) => d.id === currentUser.departmentId);
  const deptTasks = scopedTasks(currentUser);
  const stats = statsFor(deptTasks);
  const deptTeams = teams.filter((team) => team.departmentId === currentUser.departmentId);

  const teamRows = deptTeams.map((team) => {
    const teamTasks = deptTasks.filter((task) => task.teamId === team.id);
    const teamStats = statsFor(teamTasks);
    const lead = users.find((u) => u.id === team.leadId);
    const completionRate = teamStats.total ? Math.round((teamStats.completed / teamStats.total) * 100) : 0;
    return { team, lead, ...teamStats, completionRate };
  });

  const deptEmployees = users.filter((u) => u.departmentId === currentUser.departmentId && u.role === ROLES.EMPLOYEE);
  const workload = deptEmployees.map((u) => {
    const assigned = deptTasks.filter((t) => t.assigneeId === u.id && t.status !== STATUS.DRAFT);
    const uStats = statsFor(assigned);
    const active = uStats.pending + uStats.inProgress;
    const team = teams.find((tm) => tm.id === u.teamId);
    return { user: u, teamName: team?.name || '—', assigned: uStats.total, active, completed: uStats.completed, overdue: uStats.overdue };
  }).sort((a, b) => b.active - a.active);

  const overdueTasks = deptTasks.filter((t) => t.status !== STATUS.COMPLETED && t.status !== STATUS.DRAFT && t.dueDate < TODAY);

  const trend = WEEKS.map((week) => {
    const weekTasks = deptTasks.filter((t) => t.status !== STATUS.DRAFT && t.dueDate >= week.start && t.dueDate <= week.end);
    const completed = weekTasks.filter((t) => t.status === STATUS.COMPLETED).length;
    return { label: week.label, pct: weekTasks.length ? Math.round((completed / weekTasks.length) * 100) : null, count: weekTasks.length };
  }).filter((w) => w.count > 0);

  const deptActivity = activity.filter((a) => teamById(a.teamId)?.departmentId === currentUser.departmentId).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Good morning, {currentUser.name}</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {department?.name || 'Department'} — {deptTeams.length} team{deptTeams.length === 1 ? '' : 's'}
        </div>
      </div>

      <StatBar items={defaultStatItems(stats, 'Total Tasks')} />

      <Card padded={false}>
        <div style={{ padding: '22px 26px 4px', fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Team performance</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 1.2fr', padding: '12px 26px', marginTop: 12, background: 'var(--field-bg)' }}>
              {['Team', 'Team Lead', 'Total Tasks', 'Completed', 'In Progress', 'Completion Rate'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {teamRows.map((row, i) => (
              <div
                key={row.team.id}
                onClick={() => navigate(`/tasks?team=${row.team.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 1.2fr', padding: '15px 26px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === teamRows.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              >
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.team.name}</div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)' }}>{row.lead?.name}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.total}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.inProgress}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
                    <div style={{ width: `${row.completionRate}%`, height: '100%', borderRadius: 999, background: ['var(--accent-dark)', 'var(--accent)'][i % 2] }} />
                  </div>
                  <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--heading)', width: 34, textAlign: 'right' }}>{row.completionRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: '22px 26px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Employee workload</div>
          <div onClick={() => navigate('/daily-updates')} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--accent-dark)' }}>Daily updates</span>
            <IconArrowRight size={13} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 26px', marginTop: 12, background: 'var(--field-bg)' }}>
              {['Employee', 'Team', 'Role', 'Assigned', 'Active', 'Completed'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {workload.map((row, i) => (
              <div
                key={row.user.id}
                onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 26px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === workload.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar initial={row.user.initial} size={24} />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                </div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.teamName.replace("'s Team", '')}</div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.user.title}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.active}</div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: row.overdue > 0 ? 'var(--amber-text)' : 'var(--heading)' }}>
                  {row.completed}{row.overdue > 0 && <span style={{ fontWeight: 500, fontSize: 11.5, marginLeft: 5 }}>({row.overdue} overdue)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Overdue tasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {overdueTasks.length === 0 && (
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '11px 0' }}>Nothing overdue right now.</div>
            )}
            {overdueTasks.map((task) => {
              const team = teams.find((tm) => tm.id === task.teamId);
              const daysOver = Math.round((new Date(TODAY) - new Date(task.dueDate)) / 86400000);
              return (
                <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <IconAlertTriangle size={16} />
                  <div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{task.title}</div>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {team?.name} · {daysOver} day{daysOver === 1 ? '' : 's'} overdue
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Recent department activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {deptActivity.length === 0 && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '11px 0' }}>Nothing yet.</div>}
            {deptActivity.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                {item.type === 'completed' ? <IconCheckCircle size={16} color="var(--accent-dark)" /> : item.type === 'update' ? <IconUser size={16} color="var(--amber-text)" /> : <IconPlusCircle size={16} color="var(--accent)" />}
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)' }}>{item.text}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {trend.length > 0 && (
        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 18 }}>Completion trend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {trend.map((week) => (
              <div key={week.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 110, flexShrink: 0, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{week.label}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
                  <div style={{ width: `${week.pct}%`, height: '100%', borderRadius: 999, background: 'var(--accent)' }} />
                </div>
                <div style={{ width: 38, textAlign: 'right', fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--heading)' }}>{week.pct}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
