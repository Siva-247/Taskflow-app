import React from 'react';
import { ROLES } from '../../data/mockData.js';
import { Card } from '../ui.jsx';
import { IconUsersGroup, IconBuilding, IconUsers, IconTarget, IconChecklist, IconUser, IconClipboard } from '../icons.jsx';

// Read-only description of the seven real access levels this app
// distinguishes (mirrors hierarchy.js's canManage/rankIndex exactly — see
// that file for the authoritative logic). Employee and Intern aren't
// separate entries in the ROLES enum — an intern is role 'employee' with
// title 'Intern' — split out here the same way AddEmployeeModal's own Role
// field already does, via `countMatch` instead of a plain role lookup.
// There is no backend for editable custom permissions, so this is
// reference material, not a configuration form.
const ROLE_INFO = [
  { key: 'super_admin', label: 'Super Admin', icon: IconTarget, description: 'Full reach across every department, team, and account, including other admins. Credentials are managed through the server environment only — not editable from this app.', countMatch: (u) => u.role === ROLES.SUPER_ADMIN },
  { key: 'admin', label: 'Admin', icon: IconUsersGroup, description: 'Manages the whole company except other admins — every department, team, and member below Super Admin.', countMatch: (u) => u.role === ROLES.ADMIN },
  { key: 'manager', label: 'Manager', icon: IconBuilding, description: 'Manages everyone within their own department — can add, edit, and place employees, teams, and team leads there.', countMatch: (u) => u.role === ROLES.MANAGER },
  { key: 'assistant_manager', label: 'Assistant Manager', icon: IconUsers, description: "Manages their own team, one rung below its Manager — reviews members' work and can step in when the Team Lead is unavailable.", countMatch: (u) => u.role === ROLES.ASSISTANT_MANAGER },
  { key: 'team_lead', label: 'Team Lead', icon: IconChecklist, description: "Manages their own team's day-to-day work — assigns tasks and reviews members' daily updates.", countMatch: (u) => u.role === ROLES.TEAM_LEAD },
  { key: 'employee', label: 'Employee', icon: IconUser, description: 'Completes assigned tasks and submits daily updates. No management access over anyone else.', countMatch: (u) => u.role === ROLES.EMPLOYEE && u.title !== 'Intern' },
  { key: 'intern', label: 'Intern', icon: IconClipboard, description: 'Same access as Employee — assigned tasks and daily updates. Distinguished only by title, not a separate role in the system.', countMatch: (u) => u.role === ROLES.EMPLOYEE && u.title === 'Intern' },
];

const FLAT_SHADOW = '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)';

// `roleKeys` restricts which cards show — a Manager's view drops Super
// Admin/Admin (company-level roles with no meaning inside one department;
// they'd always read 0 anyway since neither carries a departmentId that
// could match) and counts the rest against their department's own roster
// only (the caller pre-filters `users` accordingly).
export default function RolesPermissionsSection({ users, roleKeys }) {
  const visibleInfo = roleKeys ? ROLE_INFO.filter((r) => roleKeys.includes(r.key)) : ROLE_INFO;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Roles & Permissions</div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
          How access cascades through the organization — reference only, since roles are assigned when a member is added or edited, not configured here.
        </div>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', '--cols': 'repeat(2,1fr)', '--cols-tablet': '1fr', gap: 14 }}>
        {visibleInfo.map(({ key, label, icon: Icon, description, countMatch }) => {
          const count = users.filter(countMatch).length;
          return (
            <Card key={key} padded={false} style={{ boxShadow: FLAT_SHADOW, border: '1px solid var(--border)', padding: '18px 20px' }}>
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
