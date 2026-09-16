import React from 'react';
import { Select } from '../ui.jsx';
import { IconSearch } from '../icons.jsx';

// One search box plus an arbitrary row of dropdown filters — shared by every
// Settings tab that lists departments/teams/members, so a filter row never
// has to be rebuilt by hand per tab. `filters` is [{ value, onChange, options }],
// each already carrying its own "All ..." option — this component only lays
// them out, it has no opinion on what they filter.
export default function SearchFilterBar({ search, onSearchChange, placeholder = 'Search...', filters = [] }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: '1 1 260px', minWidth: 200, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', background: 'var(--field-bg)' }}>
        <IconSearch size={15} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)', background: 'transparent' }}
        />
      </div>
      {filters.map((f, i) => (
        <div key={i} className="filter-field" style={{ width: 170 }}>
          <Select value={f.value} onChange={f.onChange} options={f.options} />
        </div>
      ))}
    </div>
  );
}
