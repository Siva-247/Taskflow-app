import React, { useMemo } from 'react';
import { Button } from '../ui.jsx';
import SearchFilterBar from './SearchFilterBar.jsx';
import TeamCard from './TeamCard.jsx';
import { IconPlusCircle } from '../icons.jsx';

// Teams tab: every team across every department, flattened into one list
// (each row names its own department since there's no nesting here) —
// department-level detail lives in the Departments tab instead.
export default function TeamsSection({
  rollups, departments, search, onSearchChange, departmentFilter, onDepartmentFilterChange,
  onAddTeam, onEditTeam, onDeleteTeam, onViewTeam,
}) {
  const q = search.trim().toLowerCase();
  const allTeamRows = useMemo(() => rollups.flatMap((r) => r.teamRows.map((t) => ({ ...t, departmentId: r.dept.id, departmentName: r.dept.name }))), [rollups]);
  const visible = allTeamRows
    .filter((t) => departmentFilter === 'all' || t.departmentId === departmentFilter)
    .filter((t) => !q || t.team.name.toLowerCase().includes(q));

  const departmentOptions = [{ value: 'all', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>Teams</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Every team across the company, with its lead and member count.
          </div>
        </div>
        <Button onClick={() => onAddTeam()}>
          <IconPlusCircle size={15} color="#FFFFFF" /> Add Team
        </Button>
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search teams..."
        filters={[{ value: departmentFilter, onChange: onDepartmentFilterChange, options: departmentOptions }]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((t) => (
          <TeamCard
            key={t.team.id}
            team={t.team}
            lead={t.lead}
            members={t.members}
            departmentName={t.departmentName}
            onEdit={() => onEditTeam(t.team)}
            onDelete={() => onDeleteTeam(t.team)}
            onViewTeam={() => onViewTeam(t.team)}
          />
        ))}
        {visible.length === 0 && (
          <div style={{ padding: '28px 0', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
            {allTeamRows.length === 0 ? 'No teams yet — add one to get started.' : 'No teams match your search.'}
          </div>
        )}
      </div>
    </div>
  );
}
