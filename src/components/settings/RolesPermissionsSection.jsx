import React from 'react';
import { ROLES } from '../../data/mockData.js';
import { Card } from '../ui.jsx';
import { IconUsersGroup, IconBuilding, IconUsers, IconTarget, IconChecklist, IconUser } from '../icons.jsx';

// Read-only description of the six real roles this app enforces (mirrors
// hierarchy.js's canManage/rankIndex exactly — see that file for the
// authoritative logic). There is no backend for editable custom
// permissions, so this is reference material, not a configuration form.
const ROLE_INFO = [
  { role: ROLES.SUPER_ADMIN, label: 'Super Admin', icon: IconTarget, description: 'Full reach across every department, team, and account, including other admins. Credentials are managed through the server environment only — not editable from this app.' },
  { role: ROLES.ADMIN, label: 'Admin', icon: IconUsersGroup, description: 'Manages the whole company except other admins — every department, team, and member below Super Admin.' },
  { role: ROLES.MANAGER, label: 'Manager', icon: IconBuilding, description: 'Manages everyone within their own department — can add, edit, and place employees, teams, and team leads there.' },
  { role: ROLES.ASSISTANT_MANAGER, label: 'Assistant Manager', icon: IconUsers, description: "Manages their own team, one rung below its Manager — reviews members' work and can step in when the Team Lead is unavailable." },
  { role: ROLES.TEAM_LEAD, label: 'Team Lead', icon: IconChecklist, description: "Manages their own team's day-to-day work — assigns tasks and reviews members' daily updates." },
  { role: ROLES.EMPLOYEE, label: 'Employee', icon: IconUser, description: 'Completes assigned tasks and submits daily updates. No management access over anyone else.' },
];

const FLAT_SHADOW = '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)';

export default function RolesPermissionsSection({ users }) {
  const countFor = (role) => users.filter((u) => u.role === role).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Roles & Permissions</div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
          How access cascades through the organization — reference only, since roles are assigned when a member is added or edited, not configured here.
        </div>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', '--cols': 'repeat(2,1fr)', '--cols-tablet': '1fr', gap: 14 }}>
        {ROLE_INFO.map(({ role, label, icon: Icon, description }) => {
          const count = countFor(role);
          return (
            <Card key={role} padded={false} style={{ boxShadow: FLAT_SHADOW, border: '1px solid var(--border)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color="var(--accent-dark)" />
                  </div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 14.5, color: 'var(--heading)' }}>{label}</div>
                </div>
                <div style={{
                  fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)',
                  background: 'var(--accent-soft)', padding: '4px 10px', borderRadius: 999, flexShrink: 0,
                }}>
                  {count} {count === 1 ? 'person' : 'people'}
                </div>
              </div>
              <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 12 }}>
                {description}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
