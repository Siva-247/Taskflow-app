import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { teamById } from '../data/mockData.js';
import { Card, Avatar, ProgressBar } from '../components/ui.jsx';

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee' };

export default function Profile() {
  const { currentUser, users, departments, scopedTasks, statsFor } = useApp();
  const navigate = useNavigate();

  const team = teamById(currentUser.teamId);
  const department = departments.find((d) => d.id === (currentUser.departmentId || team?.departmentId)) || null;
  const teamLead = team ? users.find((u) => u.id === team.leadId) : null;
  const manager = department ? users.find((u) => u.role === 'manager' && u.departmentId === department.id) : null;
  const myTasks = scopedTasks(currentUser);
  const stats = statsFor(myTasks);
  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Profile</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Your account and activity summary</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <Avatar initial={currentUser.initial} size={64} gradient />
            <div>
              <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--heading)' }}>{currentUser.name}</div>
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--accent-dark)', marginTop: 2 }}>{currentUser.title || ROLE_LABEL[currentUser.role]}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <DetailRow label="Role" value={ROLE_LABEL[currentUser.role]} />
            {currentUser.email && <DetailRow label="Email" value={currentUser.email} />}
            {department && <DetailRow label="Department" value={department.name} />}
            {team && <DetailRow label="Team" value={team.name} />}
            {currentUser.role === 'employee' && teamLead && <DetailRow label="Team Lead" value={teamLead.name} />}
            {(currentUser.role === 'employee' || currentUser.role === 'team_lead') && manager && <DetailRow label="Manager" value={manager.name} />}
          </div>
          <div
            onClick={() => navigate('/change-password')}
            style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--accent-dark)', cursor: 'pointer', textAlign: 'center' }}
          >
            Change password
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Your task activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 16 }}>
            <MiniStat value={stats.total} label="Total" />
            <MiniStat value={stats.completed} label="Completed" color="var(--accent-dark)" />
            <MiniStat value={stats.inProgress + stats.pending} label="Active" color="var(--accent-mid)" />
            <MiniStat value={stats.overdue} label="Overdue" color="var(--amber-text)" />
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-muted)' }}>Completion rate</span>
              <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--heading)' }}>{completionRate}%</span>
            </div>
            <ProgressBar value={completionRate} height={8} />
          </div>
          <div
            onClick={() => navigate('/tasks')}
            style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--accent-dark)', cursor: 'pointer' }}
          >
            View all your tasks →
          </div>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function MiniStat({ value, label, color = 'var(--heading)' }) {
  return (
    <div style={{ padding: '14px 12px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 20, color }}>{value}</div>
      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
