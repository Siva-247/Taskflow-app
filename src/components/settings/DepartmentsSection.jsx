import React from 'react';
import { Button } from '../ui.jsx';
import SearchFilterBar from './SearchFilterBar.jsx';
import DepartmentCard from './DepartmentCard.jsx';
import { IconPlusCircle } from '../icons.jsx';

// Departments tab: department-only management (name, team/member roll-up
// counts, edit/delete) — team-level detail lives in the Teams tab, so cards
// here never expand.
export default function DepartmentsSection({
  rollups, search, onSearchChange, onAddDepartment, onEditDept, onDeleteDept, onViewDepartment, hasAnyDepartments,
}) {
  const q = search.trim().toLowerCase();
  const visible = q ? rollups.filter((r) => r.dept.name.toLowerCase().includes(q)) : rollups;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Departments</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Every department in the company, with its team and member counts.
          </div>
        </div>
        <Button onClick={onAddDepartment}>
          <IconPlusCircle size={15} color="#FFFFFF" /> Add Department
        </Button>
      </div>

      <SearchFilterBar search={search} onSearchChange={onSearchChange} placeholder="Search departments..." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map((r) => (
          <DepartmentCard
            key={r.dept.id}
            dept={r.dept}
            color={r.color}
            memberCount={r.memberCount}
            teamRows={r.teamRows}
            expandable={false}
            onEdit={() => onEditDept(r.dept)}
            onDelete={() => onDeleteDept(r.dept)}
            onAddTeam={() => {}}
            onViewDepartment={() => onViewDepartment(r.dept)}
          />
        ))}
        {visible.length === 0 && (
          <div style={{ padding: '28px 0', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
            {hasAnyDepartments ? 'No departments match your search.' : 'No departments yet — add one to get started.'}
          </div>
        )}
      </div>
    </div>
  );
}
