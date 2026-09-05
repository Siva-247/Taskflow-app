import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { teamById } from '../data/mockData.js';
import { Avatar, Drawer } from './ui.jsx';

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee' };

// The Profile page's identity content, laid out for the narrow side panel
// opened from the header avatar — single column throughout (Profile.jsx's
// own 2- and 4-column grids only collapse below a 768px *viewport*, so
// they'd render cramped inside a ~320-420px panel on an otherwise-wide
// screen). Task-activity stats live on the full Profile page, not here.
export default function ProfilePanel({ onClose }) {
  const { currentUser, users, departments, logout } = useApp();
  const navigate = useNavigate();

  const team = teamById(currentUser.teamId);
  const department = departments.find((d) => d.id === (currentUser.departmentId || team?.departmentId)) || null;
  const teamLead = team ? users.find((u) => u.id === team.leadId) : null;
  const manager = department ? users.find((u) => u.role === 'manager' && u.departmentId === department.id) : null;
  // "Intern" is a job title, not its own role value (interns are role
  // 'employee' underneath) — but the Role field should still read "Intern"
  // for them rather than the generic "Employee".
  const roleLabel = currentUser.title === 'Intern' ? 'Intern' : ROLE_LABEL[currentUser.role];

  const go = (to) => { onClose(); navigate(to); };

  return (
    <Drawer title="Profile" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <Avatar initial={currentUser.initial} size={56} gradient />
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--heading)' }}>{currentUser.name}</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', marginTop: 2 }}>{currentUser.title || roleLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <DetailRow label="Role" value={roleLabel} />
        {currentUser.email && <DetailRow label="Email" value={currentUser.email} />}
        {department && <DetailRow label="Department" value={department.name} />}
        {team && <DetailRow label="Team" value={team.name} />}
        {currentUser.role === 'employee' && teamLead && <DetailRow label="Team Lead" value={teamLead.name} />}
        {(currentUser.role === 'employee' || currentUser.role === 'team_lead') && manager && <DetailRow label="Manager" value={manager.name} />}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
