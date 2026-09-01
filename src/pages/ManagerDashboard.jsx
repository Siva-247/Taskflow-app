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

  // Ranked by average marks across every graded task (Submitted for Review or
  // Completed tasks that have actually been marked) — someone with zero
  // graded tasks isn't ranked at all, rather than showing a misleading 0%.
  const performerStats = deptEmployees.map((u) => {
    const graded = deptTasks.filter((t) => t.assigneeId === u.id && t.marks != null);
    if (graded.length === 0) return null;
    const avgMarks = Math.round(graded.reduce((sum, t) => sum + t.marks, 0) / graded.length);
    const team = teams.find((tm) => tm.id === u.teamId);
    return { user: u, teamId: u.teamId, teamName: team?.name?.replace("'s Team", '') || '—', avgMarks, gradedCount: graded.length };
  }).filter(Boolean).sort((a, b) => b.avgMarks - a.avgMarks || b.gradedCount - a.gradedCount);

  const overallTopPerformers = performerStats.slice(0, 3);
  const topPerformersByTeam = deptTeams
    .map((team) => ({ team, top3: performerStats.filter((p) => p.teamId === team.id).slice(0, 3) }))
    .filter((row) => row.top3.length > 0);
  const workload = deptEmployees.map((u) => {
    const assigned = deptTasks.filter((t) => t.assigneeId === u.id && t.status !== STATUS.DRAFT);
    const uStats = statsFor(assigned);
    const team = teams.find((tm) => tm.id === u.teamId);
    return { user: u, teamName: team?.name || '—', assigned: uStats.total, completed: uStats.completed };
  }).sort((a, b) => b.assigned - a.assigned);

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

      {overallTopPerformers.length > 0 && (
        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Top performers</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Ranked by average marks across graded work
          </div>

          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 20 }}>
            {department?.name || 'Department'}-wide
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
            {overallTopPerformers.map((p, i) => <PerformerCard key={p.user.id} rank={i + 1} performer={p} onClick={() => navigate(`/tasks?assignee=${p.user.id}`)} />)}
          </div>

          {topPerformersByTeam.length > 0 && (
            <>
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 24 }}>
                By team
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(topPerformersByTeam.length, 2)}, 1fr)`, gap: 20, marginTop: 10 }}>
                {topPerformersByTeam.map(({ team, top3 }) => (
                  <div key={team.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 10 }}>{team.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {top3.map((p, i) => (
                        <div key={p.user.id} onClick={() => navigate(`/tasks?assignee=${p.user.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <RankBadge rank={i + 1} size={22} />
                          <Avatar initial={p.user.initial} size={22} />
                          <span style={{ flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{p.user.name}</span>
                          <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--accent-dark)' }}>{p.avgMarks}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

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
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', padding: '12px 26px', marginTop: 12, background: 'var(--field-bg)' }}>
              {['Employee', 'Team', 'Role', 'Assigned', 'Completed'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {workload.map((row, i) => (
              <div
                key={row.user.id}
                onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', padding: '12px 26px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === workload.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar initial={row.user.initial} size={24} />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                </div>
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.teamName.replace("'s Team", '')}</div>
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

// #1 gets the full accent color, #2/#3 step down in weight rather than
// reaching for literal gold/silver/bronze — keeps the rank readable without
// clashing with the app's own purple palette.
const RANK_COLOR = { 1: 'var(--accent-dark)', 2: 'var(--accent)', 3: 'var(--text-muted)' };
function RankBadge({ rank, size = 26 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: RANK_COLOR[rank] || 'var(--text-muted)', color: '#FFFFFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: size * 0.5,
    }}>
      {rank}
    </div>
  );
}

function PerformerCard({ rank, performer, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
        padding: '18px 12px', borderRadius: 12, cursor: 'pointer',
        border: rank === 1 ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: rank === 1 ? 'var(--accent-soft)' : 'transparent',
      }}
    >
      <RankBadge rank={rank} size={28} />
      <Avatar initial={performer.user.initial} size={38} />
      <div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{performer.user.name}</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{performer.teamName}</div>
      </div>
      <div>
        <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--accent-dark)' }}>{performer.avgMarks}%</span>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>
          avg · {performer.gradedCount} graded
        </div>
      </div>
    </div>
  );
}
