import React from 'react';
import { Button } from '../ui.jsx';
import StatBar from '../StatBar.jsx';
import SearchFilterBar from './SearchFilterBar.jsx';
import DepartmentCard from './DepartmentCard.jsx';
import { IconPlusCircle } from '../icons.jsx';

// Overview tab: the company-wide stat strip plus the full department -> team
// structure. Filtering (search + department/lead/status) all happens in the
// parent (Settings.jsx owns the department/team data), this just lays out
// whatever rollup list it's handed.
export default function OrganizationOverview({
  statItems, visibleRollups, collapsed, onToggleDept,
  search, onSearchChange, departmentOptions, departmentFilter, onDepartmentFilterChange,
  leadOptions, leadFilter, onLeadFilterChange, statusOptions, statusFilter, onStatusFilterChange,
  onAddDepartment, onAddTeam, onEditDept, onDeleteDept, onEditTeam, onDeleteTeam, onViewTeam,
  hasAnyDepartments,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <StatBar items={statItems} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Organization Structure</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage departments, teams, and reporting structure.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button onClick={onAddDepartment}>
            <IconPlusCircle size={15} color="#FFFFFF" /> Add Department
          </Button>
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
          { value: departmentFilter, onChange: onDepartmentFilterChange, options: departmentOptions },
          { value: leadFilter, onChange: onLeadFilterChange, options: leadOptions },
          { value: statusFilter, onChange: onStatusFilterChange, options: statusOptions },
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
