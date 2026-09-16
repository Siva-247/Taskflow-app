import React from 'react';
import { Button } from '../ui.jsx';
import StatBar from '../StatBar.jsx';
import SearchFilterBar from './SearchFilterBar.jsx';
import DepartmentCard from './DepartmentCard.jsx';
import { IconPlusCircle } from '../icons.jsx';
import { ROLES } from '../../data/mockData.js';

// Overview tab: the company-wide stat strip plus the full department -> team
// structure. Filtering (search + department/role) all happens in the parent
// (Settings.jsx owns the department/team data), this just lays out whatever
// rollup list it's handed. `showDepartmentFilter=false` (a Manager, who only
// ever has their own single department to look at) drops that dropdown
// entirely rather than showing it with just one meaningless option.
export default function OrganizationOverview({
  statItems, visibleRollups, collapsed, onToggleDept,
  search, onSearchChange, departmentOptions, departmentFilter, onDepartmentFilterChange, showDepartmentFilter = true,
  roleOptions, roleFilter, onRoleFilterChange,
  onAddDepartment, onAddTeam, onEditDept, onDeleteDept, onEditTeam, onDeleteTeam, onViewTeam, onViewDepartment,
  hasAnyDepartments, subtitle = 'Manage departments, teams, and reporting structure.',
  canAddDepartment = true, canEditDept = true, canDeleteDept = true, canEditTeam = true, canDeleteTeam = true,
}) {
  // A manager has no team_id, so filtering by "Manager" always empties every
  // team row out (see Settings.jsx's visibleRollups) — the usual "No teams
  // created yet / Create a team" empty state would misread as the department
  // having no teams at all, so it gets a message that explains what's
  // actually going on instead, with no "Create Team" call-to-action (a new
  // team wouldn't make the filtered-out manager appear in it).
  const managerFilterActive = roleFilter === ROLES.MANAGER;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <StatBar items={statItems} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Organization Structure</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            {subtitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canAddDepartment && (
            <Button onClick={onAddDepartment}>
              <IconPlusCircle size={15} color="#FFFFFF" /> Add Department
            </Button>
          )}
          <Button variant="secondary" onClick={() => onAddTeam()}>
            <IconPlusCircle size={15} color="var(--accent-dark)" /> Add Team
          </Button>
        </div>
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search departments or teams..."
        filters={[
          ...(showDepartmentFilter ? [{ value: departmentFilter, onChange: onDepartmentFilterChange, options: departmentOptions }] : []),
          { value: roleFilter, onChange: onRoleFilterChange, options: roleOptions },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visibleRollups.map((r) => (
          <DepartmentCard
            key={r.dept.id}
            dept={r.dept}
            color={r.color}
            memberCount={r.memberCount}
            teamRows={r.teamRows}
            isCollapsed={collapsed.has(r.dept.id)}
            onToggle={() => onToggleDept(r.dept.id)}
            onAddTeam={() => onAddTeam(r.dept.id)}
            onEdit={() => onEditDept(r.dept)}
            onDelete={() => onDeleteDept(r.dept)}
            onEditTeam={onEditTeam}
            onDeleteTeam={onDeleteTeam}
            onViewTeam={onViewTeam}
            onViewDepartment={() => onViewDepartment(r.dept)}
            canEdit={canEditDept}
            canDelete={canDeleteDept}
            canEditTeam={canEditTeam}
            canDeleteTeam={canDeleteTeam}
            emptyTeamsTitle={managerFilterActive ? 'No teams to show' : undefined}
            emptyTeamsSubtitle={managerFilterActive ? "This department's manager isn't assigned to a team — see them in the Members tab." : undefined}
            emptyTeamsShowCreate={!managerFilterActive}
          />
        ))}
        {visibleRollups.length === 0 && (
          <div style={{ padding: '28px 0', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
            {hasAnyDepartments ? 'No departments or teams match your search.' : 'No departments yet — add one to get started.'}
          </div>
        )}
      </div>
    </div>
  );
}
