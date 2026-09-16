import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import AddEmployeeModal from '../components/AddEmployeeModal.jsx';
import { organizationStatItems } from '../components/StatBar.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';
import SettingsTabs from '../components/settings/SettingsTabs.jsx';
import OrganizationOverview from '../components/settings/OrganizationOverview.jsx';
import DepartmentsSection from '../components/settings/DepartmentsSection.jsx';
import TeamsSection from '../components/settings/TeamsSection.jsx';
import MembersSection from '../components/settings/MembersSection.jsx';
import RolesPermissionsSection from '../components/settings/RolesPermissionsSection.jsx';

// Cycled by department index purely for visual variety between department
// icons — not tied to any department property, so a renamed/reordered
// department may pick up a different color and that's fine.
const DEPT_COLORS = ['var(--cat-1)', 'var(--cat-4)', 'var(--cat-3)', 'var(--cat-2)', 'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)'];

// Same distinction Profile.jsx already draws: Manager/Assistant Manager/
// Team Lead show their role, an Employee shows their title instead
// (Developer/Intern/whatever a custom "Other" hire typed).
const MEMBER_ROLE_LABELS = {
  [ROLES.MANAGER]: 'Manager',
  [ROLES.ASSISTANT_MANAGER]: 'Assistant Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
};
const memberRoleLabel = (u) => MEMBER_ROLE_LABELS[u.role] || u.title || 'Employee';

const ALL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'departments', label: 'Departments' },
  { key: 'teams', label: 'Teams' },
  { key: 'members', label: 'Members' },
  { key: 'roles', label: 'Roles & Permissions' },
];
// A Manager has exactly one department (their own) — a "Departments" tab
// for managing/creating/deleting departments plural doesn't apply to them,
// so it's dropped rather than shown with nothing real to do in it.
const MANAGER_TABS = ALL_TABS.filter((t) => t.key !== 'departments');

export default function Settings() {
  const {
    currentUser, users, teams, departments: allDepartments, tasks, statsFor,
    addDepartment, editDepartment, deleteDepartment, addTeam, editTeam, deleteTeam,
    setUserActive, deleteUser, resetUserPassword,
  } = useApp();

  const isManager = currentUser.role === ROLES.MANAGER;
  // Same page, same components, for every role this page serves — a Manager
  // just gets `departments` pre-narrowed to their own, so every rollup/
  // roster/tab built on top of it (Overview, Teams, Members, Roles &
  // Permissions) is automatically department-scoped with no special-casing
  // elsewhere. Generic on currentUser.departmentId, not any specific
  // department, so a brand-new manager in a brand-new department gets
  // exactly the same experience as every other one.
  const departments = isManager ? allDepartments.filter((d) => d.id === currentUser.departmentId) : allDepartments;
  const TABS = isManager ? MANAGER_TABS : ALL_TABS;

  const [activeTab, setActiveTab] = useState('overview');

  // ---- Overview tab: search + department/role filters ----
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  // ---- Departments / Teams tabs: their own independent search ----
  const [deptTabSearch, setDeptTabSearch] = useState('');
  const [teamTabSearch, setTeamTabSearch] = useState('');
  const [teamTabDeptFilter, setTeamTabDeptFilter] = useState('all');

  // ---- Add/Edit/Delete Department ----
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptError, setNewDeptError] = useState('');
  const [deptSaving, setDeptSaving] = useState(false);

  const [editingDept, setEditingDept] = useState(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptSaving, setEditDeptSaving] = useState(false);
  const [editDeptError, setEditDeptError] = useState('');

  const [pendingDeleteDept, setPendingDeleteDept] = useState(null);
  const [deletingDept, setDeletingDept] = useState(false);
  const [deleteDeptError, setDeleteDeptError] = useState('');

  // ---- Add/Edit/Delete Team ----
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDept, setNewTeamDept] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');

  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamSaving, setEditTeamSaving] = useState(false);
  const [editTeamError, setEditTeamError] = useState('');

  const [pendingDeleteTeam, setPendingDeleteTeam] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [deleteTeamError, setDeleteTeamError] = useState('');

  // ---- Members tab ----
  const [memberSearch, setMemberSearch] = useState('');
  // Set only by "View Team" (Overview/Teams tab, per-team) or "View Team"
  // on a department card (Overview/Departments tab, whole department) —
  // pins the Members tab to just that team/department until cleared,
  // independent of the free-text search box above.
  const [memberDeptFocus, setMemberDeptFocus] = useState(null);
  const [memberTeamFocus, setMemberTeamFocus] = useState(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [pendingDeleteMember, setPendingDeleteMember] = useState(null);
  const [deleteMemberError, setDeleteMemberError] = useState('');
  const [deletingMember, setDeletingMember] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetResult, setPasswordResetResult] = useState(null);

  const allowed = useRoleGuard([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]);

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

  // "Employee" and "Intern" aren't distinct entries in the ROLES enum — an
  // intern is role 'employee' with title 'Employee' — same UI convenience
  // split AddEmployeeModal's own Role field already uses, mirrored here so
  // this filter offers the same five categories that form does.
  const personMatchesRoleFilter = (user, filter) => {
    if (filter === 'all') return true;
    if (filter === 'employee') return user.role === ROLES.EMPLOYEE && user.title !== 'Intern';
    if (filter === 'intern') return user.role === ROLES.EMPLOYEE && user.title === 'Intern';
    return user.role === filter;
  };

  const q = search.trim().toLowerCase();
  const roleFilterActive = roleFilter !== 'all';
  // Manager is department-scoped, not team-scoped (a manager has no team_id
  // at all) — so filtering by it narrows which DEPARTMENTS show, leaving
  // their teams untouched, while every other role narrows which TEAMS show
  // within a department (team membership already includes that team's own
  // lead/assistant manager, since they share the same team_id).
  const visibleRollups = useMemo(() => rollups
    .filter((r) => departmentFilter === 'all' || r.dept.id === departmentFilter)
    .map((r) => {
      if (!roleFilterActive || roleFilter === ROLES.MANAGER) return r;
      const filteredTeams = r.teamRows.filter((t) => t.members.some((m) => personMatchesRoleFilter(m, roleFilter)));
      return { ...r, teamRows: filteredTeams };
    })
    .filter((r) => {
      if (!roleFilterActive) return true;
      if (roleFilter === ROLES.MANAGER) return users.some((u) => u.role === ROLES.MANAGER && u.departmentId === r.dept.id);
      return r.teamRows.length > 0;
    })
    .filter((r) => !q || r.dept.name.toLowerCase().includes(q) || r.teamRows.some((t) => t.team.name.toLowerCase().includes(q))),
  [rollups, q, departmentFilter, roleFilter, roleFilterActive, users]);

  const departmentOptions = useMemo(() => [{ value: 'all', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))], [departments]);
  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: ROLES.MANAGER, label: 'Manager' },
    { value: ROLES.ASSISTANT_MANAGER, label: 'Assistant Manager' },
    { value: ROLES.TEAM_LEAD, label: 'Team Lead' },
    { value: 'employee', label: 'Employee' },
    { value: 'intern', label: 'Intern' },
  ];

  // Roster grouped by department (department-scoped automatically for a
  // Manager, since `departments` already is, above). Free-text
  // search filters people by name; `memberDeptFocus`/`memberTeamFocus` (set
  // only by a "View Team" jump) separately pin down to one department or
  // team regardless of what's typed in search — a department's own name
  // isn't reliably a substring of any of its members' names, so that jump
  // can't just reuse the search box the way the per-team one used to.
  const memberGroups = useMemo(() => {
    const mq = memberSearch.trim().toLowerCase();
    return departments
      .filter((dept) => !memberDeptFocus || dept.id === memberDeptFocus)
      .map((dept) => {
        const people = users
          .filter((u) => u.departmentId === dept.id && u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN)
          .filter((u) => !memberTeamFocus || u.teamId === memberTeamFocus)
          .filter((u) => !mq || u.name.toLowerCase().includes(mq))
          .map((u) => {
            const assigned = tasks.filter((t) => t.assigneeId === u.id);
            const uStats = statsFor(assigned);
            return { user: u, team: teams.find((t) => t.id === u.teamId), assigned: uStats.total, completed: uStats.completed };
          });
        return { dept, people };
      })
      .filter((g) => g.people.length > 0 || (!memberSearch.trim() && !memberTeamFocus));
  }, [departments, users, memberSearch, memberDeptFocus, memberTeamFocus, tasks, statsFor, teams]);

  const memberFocusLabel = memberTeamFocus
    ? teams.find((t) => t.id === memberTeamFocus)?.name
    : (memberDeptFocus ? allDepartments.find((d) => d.id === memberDeptFocus)?.name : null);
  const clearMemberFocus = () => { setMemberDeptFocus(null); setMemberTeamFocus(null); };

  if (!allowed) return null;

  const nonAdminUsers = users.filter((u) => u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN && (!isManager || u.departmentId === currentUser.departmentId));
  const activeMembers = nonAdminUsers.filter((u) => u.isActive === undefined || u.isActive).length;
  // Team count comes from `rollups` (already department-scoped) rather than
  // the raw `teams` list from context, which is never narrowed for a Manager.
  const totalTeams = rollups.reduce((sum, r) => sum + r.teamRows.length, 0);
  const statItems = organizationStatItems({
    totalMembers: nonAdminUsers.length,
    totalDepartments: departments.length,
    totalTeams,
    activeMembers,
  });

  const toggleDept = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openAddTeam = (departmentId) => { setNewTeamDept(departmentId || departments[0]?.id || ''); setNewTeamName(''); setTeamError(''); setShowAddTeam(true); };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) { setNewDeptError('Name is required.'); return; }
    setDeptSaving(true);
    try {
      await addDepartment({ name: newDeptName.trim() });
      setShowAddDept(false); setNewDeptName(''); setNewDeptError('');
    } catch (err) {
      setNewDeptError(err.message || 'Could not add department');
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

  // "View Team"/"View Team" (on a department card) have nowhere dedicated to
  // navigate to (no per-team or per-department detail route exists) — the
  // closest real, working equivalent is jumping to the Members tab pinned to
  // just that team's or department's roster.
  const handleViewTeam = (team) => {
    setActiveTab('members');
    setMemberSearch('');
    setMemberDeptFocus(team.departmentId);
    setMemberTeamFocus(team.id);
  };

  const handleViewDepartment = (dept) => {
    setActiveTab('members');
    setMemberSearch('');
    setMemberTeamFocus(null);
    setMemberDeptFocus(dept.id);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{'.settings-row-action:hover { background: var(--surface-strong); }'}</style>

      <div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--heading)' }}>Settings</div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {isManager ? "Manage your department's teams, members, and structure." : 'Manage your organization, teams, members, and permissions.'}
        </div>
      </div>

      <SettingsTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <OrganizationOverview
          statItems={statItems}
          visibleRollups={visibleRollups}
          collapsed={collapsed}
          onToggleDept={toggleDept}
          search={search}
          onSearchChange={setSearch}
          departmentOptions={departmentOptions}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          roleOptions={roleOptions}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          onAddDepartment={() => { setNewDeptName(''); setNewDeptError(''); setShowAddDept(true); }}
          onAddTeam={openAddTeam}
          onEditDept={startEditDept}
          onDeleteDept={(dept) => { setPendingDeleteDept(dept); setDeleteDeptError(''); }}
          onEditTeam={startEditTeam}
          onDeleteTeam={(team) => { setPendingDeleteTeam(team); setDeleteTeamError(''); }}
          onViewTeam={handleViewTeam}
          onViewDepartment={handleViewDepartment}
          hasAnyDepartments={departments.length > 0}
          subtitle={isManager ? 'Your department, its teams, and reporting structure.' : 'Manage departments, teams, and reporting structure.'}
          canAddDepartment={!isManager}
          canEditDept={!isManager}
          canDeleteDept={!isManager}
          canEditTeam={!isManager}
          canDeleteTeam={!isManager}
        />
      )}

      {activeTab === 'departments' && (
        <DepartmentsSection
          rollups={rollups}
          search={deptTabSearch}
          onSearchChange={setDeptTabSearch}
          onAddDepartment={() => { setNewDeptName(''); setNewDeptError(''); setShowAddDept(true); }}
          onEditDept={startEditDept}
          onDeleteDept={(dept) => { setPendingDeleteDept(dept); setDeleteDeptError(''); }}
          onViewDepartment={handleViewDepartment}
          hasAnyDepartments={departments.length > 0}
        />
      )}

      {activeTab === 'teams' && (
        <TeamsSection
          rollups={rollups}
          departments={departments}
          search={teamTabSearch}
          onSearchChange={setTeamTabSearch}
          departmentFilter={teamTabDeptFilter}
          onDepartmentFilterChange={setTeamTabDeptFilter}
          onAddTeam={openAddTeam}
          onEditTeam={startEditTeam}
          onDeleteTeam={(team) => { setPendingDeleteTeam(team); setDeleteTeamError(''); }}
          onViewTeam={handleViewTeam}
          subtitle={isManager ? "Your department's teams, with their lead and member count." : 'Every team across the company, with its lead and member count.'}
          showDepartmentFilter={!isManager}
          canEditTeam={!isManager}
          canDeleteTeam={!isManager}
        />
      )}

      {activeTab === 'members' && (
        <MembersSection
          memberGroups={memberGroups}
          search={memberSearch}
          onSearchChange={setMemberSearch}
          onAddEmployee={() => setShowAddEmployee(true)}
          roleLabel={memberRoleLabel}
          onEdit={setEditingMember}
          onResetPassword={setPendingPasswordReset}
          onDeactivate={setPendingDeactivate}
          onReactivate={(user) => setUserActive(user.id, true)}
          onDelete={(user) => { setPendingDeleteMember(user); setDeleteMemberError(''); }}
          hasAnyDepartments={departments.length > 0}
          subtitle={isManager ? "Your department's roster." : 'Every department across the company.'}
          canResetPassword={!isManager}
          focusLabel={memberFocusLabel}
          onClearFocus={clearMemberFocus}
        />
      )}

      {activeTab === 'roles' && (
        <RolesPermissionsSection
          users={isManager ? users.filter((u) => u.departmentId === currentUser.departmentId) : users}
          roleKeys={isManager ? ['manager', 'assistant_manager', 'team_lead', 'employee', 'intern'] : undefined}
        />
      )}

      {showAddDept && (
        <Modal title="Add department" onClose={() => setShowAddDept(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Department name" required>
              <TextInput value={newDeptName} onChange={setNewDeptName} placeholder="e.g. Operations" />
            </Field>
            {newDeptError && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{newDeptError}</div>}
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
        <Modal title={`Edit ${editingDept.name}`} onClose={() => setEditingDept(null)}>
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
        <Modal title={`Edit ${editingTeam.name}`} onClose={() => setEditingTeam(null)}>
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
