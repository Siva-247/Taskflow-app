import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Avatar } from '../components/ui.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

export default function Settings() {
  const { users, teams, departments } = useApp();
  const allowed = useRoleGuard([ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!allowed) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Settings</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Organization reference</div>
      </div>

      <Card>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Organization structure</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {departments.map((dept) => (
            <div key={dept.id}>
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{dept.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingLeft: 14 }}>
                {teams.filter((t) => t.departmentId === dept.id).map((team) => {
                  const lead = users.find((u) => u.id === team.leadId);
                  const memberCount = users.filter((u) => u.teamId === team.id && u.role === ROLES.EMPLOYEE).length;
                  return (
                    <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initial={lead?.initial} size={22} />
                      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {team.name} — led by {lead?.name} · {memberCount} member{memberCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ background: 'var(--field-bg)', border: '1px dashed var(--border)' }}>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          User management, role changes, and organization editing aren't available in this prototype — the org structure above is fixed reference data.
        </div>
      </Card>
    </div>
  );
}
