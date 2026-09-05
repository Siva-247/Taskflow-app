import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { STATUS, ROLES, teamById } from '../data/mockData.js';
import StatBar, { defaultStatItems, orgStatItems } from '../components/StatBar.jsx';
import { Card } from '../components/ui.jsx';
import { IconPlusCircle, IconUser, IconCheckCircle } from '../components/icons.jsx';
import Donut from '../components/Donut.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

export default function AdminDashboard() {
  const { currentUser, users, tasks, departments, statsFor, activity } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard([ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!allowed) return null;

  const stats = statsFor(tasks);
  const totalEmployees = users.filter((u) => u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN).length;

  const deptRows = departments.map((dept) => {
    const deptTasks = tasks.filter((task) => {
      const team = teamById(task.teamId);
      return team && team.departmentId === dept.id && task.status !== STATUS.DRAFT;
    });
    const completed = deptTasks.filter((t) => t.status === STATUS.COMPLETED).length;
    const pct = deptTasks.length ? Math.round((completed / deptTasks.length) * 100) : 0;
    return { name: dept.name.replace(' Department', ''), pct };
  });

  const colors = ['var(--accent-dark)', 'var(--accent)', 'var(--accent-deep)', 'var(--accent-mid)'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Welcome to today's update, {currentUser.name}</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Company-wide task overview</div>
      </div>

      <StatBar items={orgStatItems({ totalEmployees, totalDepartments: departments.length })} />
      <StatBar items={defaultStatItems(stats, 'Total Tasks')} />

      <Card>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)', marginBottom: 20 }}>Department performance</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {deptRows.map((row, i) => (
            <div key={row.name} onClick={() => navigate('/departments')} style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <div style={{ width: 130, flexShrink: 0, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.name}</div>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
                <div style={{ width: `${row.pct}%`, height: '100%', borderRadius: 999, background: colors[i % colors.length] }} />
              </div>
              <div style={{ width: 38, textAlign: 'right', fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--heading)' }}>{row.pct}%</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1.2fr', gap: 20 }}>
        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Task status</div>
          <Donut stats={stats} />
        </Card>

        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Recent activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
            {activity.slice(0, 5).map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                {item.type === 'completed'
                  ? <IconCheckCircle size={16} color="var(--accent-dark)" />
                  : item.type === 'update'
                    ? <IconUser size={16} color="var(--amber-text)" />
                    : <IconPlusCircle size={16} color="var(--accent)" />}
                <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-primary)' }}>{item.text}</div>
              </div>
            ))}
            {activity.length === 0 && (
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '11px 0' }}>No activity yet.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
