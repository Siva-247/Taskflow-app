import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { teamById } from '../data/mockData.js';
import { Avatar, Drawer, ProgressBar } from './ui.jsx';

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee' };

// The Profile page's content, laid out for the narrow side panel opened from
// the header avatar — single column throughout (Profile.jsx's own 2- and
// 4-column grids only collapse below a 768px *viewport*, so they'd render
// cramped inside a ~320-420px panel on an otherwise-wide screen).
export default function ProfilePanel({ onClose }) {
  const { currentUser, users, departments, scopedTasks, statsFor, logout } = useApp();
  const navigate = useNavigate();

  const team = teamById(currentUser.teamId);
  const department = departments.find((d) => d.id === (currentUser.departmentId || team?.departmentId)) || null;
  const teamLead = team ? users.find((u) => u.id === team.leadId) : null;
  const manager = department ? users.find((u) => u.role === 'manager' && u.departmentId === department.id) : null;
  const myTasks = scopedTasks(currentUser);
  const stats = statsFor(myTasks);
  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  const go = (to) => { onClose(); navigate(to); };

  return (
    <Drawer title="Profile" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <Avatar initial={currentUser.initial} size={56} gradient />
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--heading)' }}>{currentUser.name}</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', marginTop: 2 }}>{currentUser.title || ROLE_LABEL[currentUser.role]}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <DetailRow label="Role" value={ROLE_LABEL[currentUser.role]} />
        {currentUser.email && <DetailRow label="Email" value={currentUser.email} />}
        {department && <DetailRow label="Department" value={department.name} />}
        {team && <DetailRow label="Team" value={team.name} />}
        {currentUser.role === 'employee' && teamLead && <DetailRow label="Team Lead" value={teamLead.name} />}
        {(currentUser.role === 'employee' || currentUser.role === 'team_lead') && manager && <DetailRow label="Manager" value={manager.name} />}
      </div>

      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--heading)', marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        Your task activity
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 12 }}>
        <MiniStat value={stats.total} label="Total" />
        <MiniStat value={stats.completed} label="Completed" color="var(--accent-dark)" />
        <MiniStat value={stats.inProgress + stats.pending} label="Active" color="var(--accent-mid)" />
        <MiniStat value={stats.overdue} label="Overdue" color="var(--amber-text)" />
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>Completion rate</span>
          <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{completionRate}%</span>
        </div>
        <ProgressBar value={completionRate} height={7} />
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <PanelLink onClick={() => go('/tasks')}>View all your tasks →</PanelLink>
        <PanelLink onClick={() => go('/change-password')}>Change password</PanelLink>
        <PanelLink onClick={() => { onClose(); logout(); navigate('/'); }} amber>Log out</PanelLink>
      </div>
    </Drawer>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function MiniStat({ value, label, color = 'var(--heading)' }) {
  return (
    <div style={{ padding: '11px 8px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color }}>{value}</div>
      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function PanelLink({ children, onClick, amber }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 4px', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13,
        color: amber ? 'var(--amber-text)' : 'var(--accent-dark)', cursor: 'pointer',
      }}
    >
      {children}
    </div>
  );
}
