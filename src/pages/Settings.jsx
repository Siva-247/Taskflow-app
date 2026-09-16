import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import AddEmployeeModal from '../components/AddEmployeeModal.jsx';
import StatBar, { organizationStatItems } from '../components/StatBar.jsx';
import { IconSearch, IconPlusCircle, IconChevronDown, IconEdit, IconTrash, IconBuilding } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

// Cycled by department index purely for visual variety between department
// icons — not tied to any department property, so a renamed/reordered
// department may pick up a different color and that's fine.
const DEPT_COLORS = ['var(--cat-1)', 'var(--cat-4)', 'var(--cat-3)', 'var(--cat-2)', 'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)'];

// Same distinction Employees.jsx (and Profile.jsx) already draw: Manager/
// Assistant Manager/Team Lead show their role, an Employee shows their
// title instead (Developer/Intern/whatever a custom "Other" hire typed).
const MEMBER_ROLE_LABELS = {
  [ROLES.MANAGER]: 'Manager',
  [ROLES.ASSISTANT_MANAGER]: 'Assistant Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
};
const memberRoleLabel = (u) => MEMBER_ROLE_LABELS[u.role] || u.title || 'Employee';

const RowAction = ({ onClick, children, title }) => (
  <span
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title={title}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, cursor: 'pointer' }}
    className="settings-row-action"
  >
    {children}
  </span>
);

export default function Settings() {
  const {
    users, teams, departments, tasks, statsFor,
    addDepartment, editDepartment, deleteDepartment, addTeam, editTeam, deleteTeam,
    setUserActive, deleteUser, resetUserPassword,
  } = useApp();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());

  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptError, setDeptError] = useState('');

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDept, setNewTeamDept] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');

  const [editingDept, setEditingDept] = useState(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptSaving, setEditDeptSaving] = useState(false);
  const [editDeptError, setEditDeptError] = useState('');

  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamSaving, setEditTeamSaving] = useState(false);
  const [editTeamError, setEditTeamError] = useState('');

  const [pendingDeleteDept, setPendingDeleteDept] = useState(null);
  const [deletingDept, setDeletingDept] = useState(false);
  const [deleteDeptError, setDeleteDeptError] = useState('');

  const [pendingDeleteTeam, setPendingDeleteTeam] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [deleteTeamError, setDeleteTeamError] = useState('');

  const [memberSearch, setMemberSearch] = useState('');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [pendingDeleteMember, setPendingDeleteMember] = useState(null);
  const [deleteMemberError, setDeleteMemberError] = useState('');
  const [deletingMember, setDeletingMember] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetResult, setPasswordResetResult] = useState(null);

  const allowed = useRoleGuard([ROLES.SUPER_ADMIN, ROLES.ADMIN]);

  const rollups = useMemo(() => departments.map((dept, i) => {
    const deptTeams = teams.filter((t) => t.departmentId === dept.id);
    const deptMembers = users.filter((u) => u.departmentId === dept.id && u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN);
    return {
      dept,
      color: DEPT_COLORS[i % DEPT_COLORS.length],
      memberCount: deptMembers.length,
      teamRows: deptTeams.map((team) => ({
        team,
        lead: users.find((u) => u.id === team.leadId),
        members: users.filter((u) => u.teamId === team.id),
      })),
    };
  }), [departments, teams, users]);

  const q = search.trim().toLowerCase();
  const visibleRollups = useMemo(() => {
    if (!q) return rollups;
    return rollups.filter((r) => r.dept.name.toLowerCase().includes(q) || r.teamRows.some((t) => t.team.name.toLowerCase().includes(q)));
  }, [rollups, q]);

  // Company-wide roster grouped by department — the same shape Employees.jsx's
  // admin view used, ported here so Settings can fully replace it for
  // admin/super_admin (Manager keeps their own department-scoped Employees
  // page unchanged, since Settings stays out of their reach).
  const memberGroups = useMemo(() => {
    const mq = memberSearch.trim().toLowerCase();
    return departments
      .map((dept) => {
        const people = users
          .filter((u) => u.departmentId === dept.id && u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN)
          .filter((u) => !mq || u.name.toLowerCase().includes(mq))
          .map((u) => {
            const assigned = tasks.filter((t) => t.assigneeId === u.id);
            const uStats = statsFor(assigned);
            return { user: u, team: teamById(u.teamId), assigned: uStats.total, completed: uStats.completed };
          });
        return { dept, people };
      })
      .filter((g) => g.people.length > 0 || !memberSearch.trim());
  }, [departments, users, memberSearch, tasks, statsFor]);

  if (!allowed) return null;

  const nonAdminUsers = users.filter((u) => u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN);
  const activeMembers = nonAdminUsers.filter((u) => u.isActive === undefined || u.isActive).length;
  const statItems = organizationStatItems({
    totalMembers: nonAdminUsers.length,
    totalDepartments: departments.length,
    totalTeams: teams.length,
    activeMembers,
  });

  const toggleDept = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openAddTeam = (departmentId) => { setNewTeamDept(departmentId || departments[0]?.id || ''); setNewTeamName(''); setTeamError(''); setShowAddTeam(true); };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) { setDeptError('Name is required.'); return; }
    setDeptSaving(true);
    try {
      await addDepartment({ name: newDeptName.trim() });
      setShowAddDept(false); setNewDeptName(''); setDeptError('');
    } catch (err) {
      setDeptError(err.message || 'Could not add department');
    } finally {
      setDeptSaving(false);
    }
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) { setTeamError('Name is required.'); return; }
    if (!newTeamDept) { setTeamError('Choose a department.'); return; }
    setTeamSaving(true);
    try {
      await addTeam({ name: newTeamName.trim(), departmentId: newTeamDept });
      setShowAddTeam(false); setNewTeamName(''); setTeamError('');
    } catch (err) {
      setTeamError(err.message || 'Could not add team');
    } finally {
      setTeamSaving(false);
    }
  };

  const startEditDept = (dept) => { setEditingDept(dept); setEditDeptName(dept.name); setEditDeptError(''); };
  const handleSaveDeptEdit = async () => {
    if (!editDeptName.trim()) { setEditDeptError('Name is required.'); return; }
    setEditDeptSaving(true);
    try {
      await editDepartment(editingDept.id, { name: editDeptName.trim() });
      setEditingDept(null);
    } catch (err) {
      setEditDeptError(err.message || 'Could not save changes');
    } finally {
      setEditDeptSaving(false);
    }
  };

  const startEditTeam = (team) => { setEditingTeam(team); setEditTeamName(team.name); setEditTeamError(''); };
  const handleSaveTeamEdit = async () => {
    if (!editTeamName.trim()) { setEditTeamError('Name is required.'); return; }
    setEditTeamSaving(true);
    try {
      await editTeam(editingTeam.id, { name: editTeamName.trim() });
      setEditingTeam(null);
    } catch (err) {
      setEditTeamError(err.message || 'Could not save changes');
    } finally {
      setEditTeamSaving(false);
    }
  };

  const handleDeleteDept = async () => {
    setDeletingDept(true); setDeleteDeptError('');
    try {
      await deleteDepartment(pendingDeleteDept.id);
      setPendingDeleteDept(null);
    } catch (err) {
      setDeleteDeptError(err.message || 'Could not remove department');
    } finally {
      setDeletingDept(false);
    }
  };

  const handleDeleteTeam = async () => {
    setDeletingTeam(true); setDeleteTeamError('');
    try {
      await deleteTeam(pendingDeleteTeam.id);
      setPendingDeleteTeam(null);
    } catch (err) {
      setDeleteTeamError(err.message || 'Could not remove team');
    } finally {
      setDeletingTeam(false);
    }
  };

  const handleDeleteMember = async () => {
    setDeletingMember(true); setDeleteMemberError('');
    try {
      await deleteUser(pendingDeleteMember.id);
      setPendingDeleteMember(null);
    } catch (err) {
      setDeleteMemberError(err.message || 'Could not remove member');
    } finally {
      setDeletingMember(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    setResettingPassword(true);
    try {
      const tempPassword = await resetUserPassword(pendingPasswordReset.id);
      setPasswordResetResult({ name: pendingPasswordReset.name, tempPassword });
      setPendingPasswordReset(null);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setResettingPassword(false);
    }
  };

  const memberActionCell = (user) => {
    const isActive = user.isActive === undefined || !!user.isActive;
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span onClick={() => setEditingMember(user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
          Edit
        </span>
        <span onClick={() => setPendingPasswordReset(user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
          Reset password
        </span>
        {isActive ? (
          <span onClick={() => setPendingDeactivate(user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--green-text, #1F7A44)', cursor: 'pointer' }}>
            ● Active
          </span>
        ) : (
          <span onClick={() => setUserActive(user.id, true)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}>
            ● Inactive — Reactivate
          </span>
        )}
        <span onClick={() => { setPendingDeleteMember(user); setDeleteMemberError(''); }} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
          Delete
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <style>{`.settings-row-action:hover { background: var(--surface-strong); }`}</style>
      <div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Settings</div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Manage your organization's departments, teams, and reporting structure
        </div>
      </div>

      <StatBar items={statItems} />

      <Card padded={false}>
        <div style={{ padding: '22px 26px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Organization Structure</div>
            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Departments and teams, with who leads each one
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => openAddTeam()}>
              <IconPlusCircle size={15} color="var(--accent-dark)" /> Add Team
            </Button>
            <Button onClick={() => { setNewDeptName(''); setDeptError(''); setShowAddDept(true); }}>
              <IconPlusCircle size={15} color="#FFFFFF" /> Add Department
            </Button>
          </div>
        </div>

        <div style={{ padding: '18px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', maxWidth: 420 }}>
            <IconSearch size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments or teams..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)', background: 'transparent' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 26px 26px' }}>
          {visibleRollups.map((r) => {
            const isCollapsed = collapsed.has(r.dept.id);
            return (
              <div key={r.dept.id} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleDept(r.dept.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', cursor: 'pointer', background: 'var(--surface)' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconBuilding size={19} color="#FFFFFF" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--heading)' }}>{r.dept.name}</div>
                    <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {r.teamRows.length} team{r.teamRows.length === 1 ? '' : 's'} · {r.memberCount} member{r.memberCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RowAction title="Add a team here" onClick={() => openAddTeam(r.dept.id)}><IconPlusCircle size={16} color="var(--accent-dark)" /></RowAction>
                    <RowAction title="Rename department" onClick={() => startEditDept(r.dept)}><IconEdit size={15} /></RowAction>
                    <RowAction title="Delete department" onClick={() => { setPendingDeleteDept(r.dept); setDeleteDeptError(''); }}><IconTrash size={15} /></RowAction>
                    <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s ease' }}>
                      <IconChevronDown size={14} color="var(--text-muted)" />
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 18px 16px' }}>
                    {r.teamRows.map(({ team, lead, members }) => (
                      <div
                        key={team.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', marginLeft: 54, borderRadius: 10, background: 'var(--field-bg)', flexWrap: 'wrap' }}
                      >
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{team.name}</div>
                          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {lead ? `Led by ${lead.name}` : 'No team lead yet'} · {members.length} member{members.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {members.slice(0, 4).map((m, idx) => (
                            <div key={m.id} title={m.name} style={{ marginLeft: idx === 0 ? 0 : -8, borderRadius: 999, border: '2px solid var(--field-bg)' }}>
                              <Avatar initial={m.initial} size={26} />
                            </div>
                          ))}
                          {members.length > 4 && (
                            <div style={{
                              marginLeft: -8, width: 26, height: 26, borderRadius: 999, background: 'var(--neutral-bg)',
                              border: '2px solid var(--field-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10, color: 'var(--text-secondary)',
                            }}>
                              +{members.length - 4}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <RowAction title="Rename team" onClick={() => startEditTeam(team)}><IconEdit size={13} /></RowAction>
                          <RowAction title="Delete team" onClick={() => { setPendingDeleteTeam(team); setDeleteTeamError(''); }}><IconTrash size={13} /></RowAction>
                        </div>
                      </div>
                    ))}
                    {r.teamRows.length === 0 && (
                      <div style={{ marginLeft: 54, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 0' }}>
                        No teams yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {visibleRollups.length === 0 && (
            <div style={{ padding: '28px 0', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
              {departments.length === 0 ? 'No departments yet — add one to get started.' : 'No departments or teams match your search.'}
            </div>
          )}
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: '22px 26px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Members</div>
            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Every department across the company
            </div>
          </div>
          <Button onClick={() => setShowAddEmployee(true)}>
            <IconPlusCircle size={15} color="#FFFFFF" /> Add employee
          </Button>
        </div>

        <div style={{ padding: '18px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', maxWidth: 420 }}>
            <IconSearch size={15} />
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search employees..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)', background: 'transparent' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 26px 26px' }}>
          {memberGroups.map(({ dept, people }) => (
            <Card key={dept.id} padded={false}>
              <div style={{ padding: '18px 22px 4px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>{dept.name}</div>
                <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{people.length} member{people.length === 1 ? '' : 's'}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 800 }}>
                  <div className="table-head-brand" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.7fr 0.9fr 1.2fr', padding: '10px 22px', marginTop: 8 }}>
                    {['Employee', 'Team', 'Role', 'Assigned', 'Completed', 'Status'].map((h) => (
                      <div key={h} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                    ))}
                  </div>
                  {people.map((row, i) => (
                    <div
                      key={row.user.id}
                      onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                      style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.7fr 0.9fr 1.2fr', padding: '13px 22px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === people.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: (row.user.isActive === undefined || row.user.isActive) ? 1 : 0.55 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={row.user.initial} size={26} />
                        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                      </div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.team?.name || '—'}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{memberRoleLabel(row.user)}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
                      {memberActionCell(row.user)}
                    </div>
                  ))}
                  {people.length === 0 && (
                    <div style={{ padding: '22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
                      No one in this department yet.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {memberGroups.length === 0 && (
            <Card>
              <div style={{ textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>No departments yet.</div>
            </Card>
          )}
        </div>
      </Card>

      {showAddDept && (
        <Modal title="Add department" onClose={() => setShowAddDept(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Department name" required>
              <TextInput value={newDeptName} onChange={setNewDeptName} placeholder="e.g. Operations" />
            </Field>
            {deptError && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{deptError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setShowAddDept(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddDept} disabled={deptSaving}>{deptSaving ? 'Adding…' : 'Add department'}</Button>
          </div>
        </Modal>
      )}

      {showAddTeam && (
        <Modal title="Add team" onClose={() => setShowAddTeam(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Team name" required>
              <TextInput value={newTeamName} onChange={setNewTeamName} placeholder="e.g. Platform Team" />
            </Field>
            <Field label="Department" required>
              <Select value={newTeamDept} onChange={setNewTeamDept} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
            </Field>
            {teamError && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{teamError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setShowAddTeam(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddTeam} disabled={teamSaving}>{teamSaving ? 'Adding…' : 'Add team'}</Button>
          </div>
        </Modal>
      )}

      {editingDept && (
        <Modal title={`Rename ${editingDept.name}`} onClose={() => setEditingDept(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Department name" required>
              <TextInput value={editDeptName} onChange={setEditDeptName} placeholder="Department name" />
            </Field>
            {editDeptError && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{editDeptError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setEditingDept(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveDeptEdit} disabled={editDeptSaving}>{editDeptSaving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </Modal>
      )}

      {editingTeam && (
        <Modal title={`Rename ${editingTeam.name}`} onClose={() => setEditingTeam(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Team name" required>
              <TextInput value={editTeamName} onChange={setEditTeamName} placeholder="Team name" />
            </Field>
            {editTeamError && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{editTeamError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setEditingTeam(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveTeamEdit} disabled={editTeamSaving}>{editTeamSaving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </Modal>
      )}

      {pendingDeleteDept && (
        <Modal title={`Delete ${pendingDeleteDept.name}?`} onClose={() => setPendingDeleteDept(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This only works once the department has no teams or members left on it — move or remove them first if it still does.
          </div>
          {deleteDeptError && <div style={{ marginTop: 12, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteDeptError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteDept(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteDept} disabled={deletingDept}>{deletingDept ? 'Deleting…' : 'Delete department'}</Button>
          </div>
        </Modal>
      )}

      {pendingDeleteTeam && (
        <Modal title={`Delete ${pendingDeleteTeam.name}?`} onClose={() => setPendingDeleteTeam(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This only works once the team has no members or tasks left on it — reassign or remove them first if it still does.
          </div>
          {deleteTeamError && <div style={{ marginTop: 12, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteTeamError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteTeam(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteTeam} disabled={deletingTeam}>{deletingTeam ? 'Deleting…' : 'Delete team'}</Button>
          </div>
        </Modal>
      )}

      {showAddEmployee && <AddEmployeeModal onClose={() => setShowAddEmployee(false)} />}

      {editingMember && <AddEmployeeModal user={editingMember} onClose={() => setEditingMember(null)} />}

      {pendingDeactivate && (
        <Modal title={`Deactivate ${pendingDeactivate.name}?`} onClose={() => setPendingDeactivate(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            They will no longer be able to sign in. Their existing tasks and history stay intact and can be reassigned or reviewed as normal — this can be undone at any time.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeactivate(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setUserActive(pendingDeactivate.id, false); setPendingDeactivate(null); }}>Deactivate</Button>
          </div>
        </Modal>
      )}

      {pendingDeleteMember && (
        <Modal title={`Delete ${pendingDeleteMember.name}?`} onClose={() => setPendingDeleteMember(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This permanently removes their account. It only works if they have no tasks, comments, or daily updates yet — if they've done any real work, deactivate them instead so that history stays intact.
          </div>
          {deleteMemberError && <div style={{ marginTop: 12, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteMemberError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteMember(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteMember} disabled={deletingMember}>{deletingMember ? 'Deleting…' : 'Delete member'}</Button>
          </div>
        </Modal>
      )}

      {pendingPasswordReset && (
        <Modal title={`Reset ${pendingPasswordReset.name}'s password?`} onClose={() => setPendingPasswordReset(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Their current password stops working immediately. You'll get a new temporary password to hand off to them directly — they'll be asked to set their own on next sign-in.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingPasswordReset(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmPasswordReset} disabled={resettingPassword}>{resettingPassword ? 'Resetting…' : 'Reset password'}</Button>
          </div>
        </Modal>
      )}

      {passwordResetResult && (
        <Modal title={`${passwordResetResult.name}'s new temporary password`} onClose={() => setPasswordResetResult(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Share this with them now — it won't be shown again. They'll be asked to set their own password the next time they sign in.
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16,
            padding: '12px 16px', background: 'var(--field-bg)', border: '1px solid var(--border)', borderRadius: 9,
          }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', color: 'var(--heading)' }}>
              {passwordResetResult.tempPassword}
            </span>
            <Button
              variant="secondary"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={() => navigator.clipboard?.writeText(passwordResetResult.tempPassword)}
            >
              Copy
            </Button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <Button variant="primary" onClick={() => setPasswordResetResult(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
