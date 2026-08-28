import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, Select, TextInput, Button, Modal } from '../components/ui.jsx';
import { IconSearch } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

export default function Employees() {
  const { currentUser, users, teams, departments, tasks, statsFor, setUserActive } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const allowed = useRoleGuard([ROLES.ADMIN, ROLES.MANAGER]);
  if (!allowed) return null;

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const scopedTeams = isAdmin ? teams : teams.filter((t) => t.departmentId === currentUser.departmentId);
  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);
  const teamIds = new Set(scopedTeams.map((t) => t.id));

  const employees = users.filter((u) => u.role === ROLES.EMPLOYEE && teamIds.has(u.teamId));

  const rows = useMemo(() => employees
    .filter((u) => (teamFilter === 'all' || u.teamId === teamFilter))
    .filter((u) => !search.trim() || u.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map((u) => {
      const assigned = tasks.filter((t) => t.assigneeId === u.id);
      const uStats = statsFor(assigned);
      return { user: u, team: teamById(u.teamId), assigned: uStats.total, active: uStats.pending + uStats.inProgress, completed: uStats.completed, overdue: uStats.overdue };
    }), [employees, teamFilter, search, tasks, statsFor]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Employees</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {isAdmin ? 'Every employee across the company' : `Employees across ${myDepartment?.name || 'your department'}`}
        </div>
      </div>

      <Card padded={false} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px' }}>
            <IconSearch size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          {scopedTeams.length > 1 && (
            <div style={{ width: 170 }}>
              <Select value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: 'All teams' }, ...scopedTeams.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
          )}
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 0.9fr 0.8fr 0.8fr 1fr 1fr', padding: '12px 22px', background: 'var(--field-bg)', borderBottom: '1px solid var(--border)' }}>
              {['Employee', 'Team', 'Role', 'Assigned', 'Active', 'Completed', 'Status'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {rows.map((row, i) => {
              const isActive = row.user.isActive !== false;
              return (
                <div
                  key={row.user.id}
                  onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 0.9fr 0.8fr 0.8fr 1fr 1fr', padding: '14px 22px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: isActive ? 1 : 0.55 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initial={row.user.initial} size={26} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.team?.name}</div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.user.title}</div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.active}</div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: row.overdue > 0 ? 'var(--amber-text)' : 'var(--heading)' }}>
                    {row.completed}{row.overdue > 0 && <span style={{ fontWeight: 500, fontSize: 11.5, marginLeft: 5 }}>({row.overdue} overdue)</span>}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {isActive ? (
                      <span
                        onClick={() => setPendingDeactivate(row.user)}
                        style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--green-text, #1F7A44)', cursor: 'pointer' }}
                      >
                        ● Active
                      </span>
                    ) : (
                      <span
                        onClick={() => setUserActive(row.user.id, true)}
                        style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}
                      >
                        ● Inactive — Reactivate
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                No employees match your filters.
              </div>
            )}
          </div>
        </div>
      </Card>

      {pendingDeactivate && (
        <Modal title={`Deactivate ${pendingDeactivate.name}?`} onClose={() => setPendingDeactivate(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            They will no longer be able to sign in. Their existing tasks and history stay intact and can be reassigned or reviewed as normal — this can be undone at any time.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeactivate(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setUserActive(pendingDeactivate.id, false); setPendingDeactivate(null); }}>Deactivate</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
