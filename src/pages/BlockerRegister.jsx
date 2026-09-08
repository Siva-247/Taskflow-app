import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, BLOCKER_STATUS, BLOCKER_CATEGORIES, ESCALATION_LEVELS } from '../data/mockData.js';
import { canManage } from '../data/hierarchy.js';
import { Card, Select, Button } from '../components/ui.jsx';
import RaiseBlockerModal from '../components/RaiseBlockerModal.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { IconSearch, IconDownload, IconAlertTriangle } from '../components/icons.jsx';
import { formatDate, downloadCsv } from '../utils.js';

const STATUS_OPTIONS = Object.values(BLOCKER_STATUS);

const ESCALATION_COLOR = {
  Low: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' },
  Medium: { bg: 'var(--neutral-bg)', color: 'var(--text-secondary)' },
  High: { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
  Critical: { bg: 'var(--amber-fill)', color: '#FFFFFF' },
};
function EscalationBadge({ level }) {
  const s = ESCALATION_COLOR[level] || ESCALATION_COLOR.Medium;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11 }}>
      {level}
    </span>
  );
}

const BLOCKER_STATUS_COLOR = {
  [BLOCKER_STATUS.OPEN]: { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
  [BLOCKER_STATUS.IN_PROGRESS]: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' },
  [BLOCKER_STATUS.RESOLVED]: { bg: '#EDE4FB', color: 'var(--accent-dark)' },
  [BLOCKER_STATUS.CLOSED]: { bg: 'var(--neutral-bg)', color: 'var(--text-muted)' },
};
function BlockerStatusBadge({ status }) {
  const s = BLOCKER_STATUS_COLOR[status] || BLOCKER_STATUS_COLOR[BLOCKER_STATUS.OPEN];
  return (
    <span style={{ display: 'inline-block', padding: '4px 11px', borderRadius: 999, background: s.bg, color: s.color, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5 }}>
      {status}
    </span>
  );
}

const friendlyId = (b) => `BLK-${String(b.seq).padStart(4, '0')}`;

export default function BlockerRegister() {
  const { currentUser, blockers, blockerDirectory, TODAY } = useApp();
  const userById = (id) => blockerDirectory.find((u) => u.id === id) || null;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [escalationFilter, setEscalationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showRaise, setShowRaise] = useState(false);
  const [editingBlocker, setEditingBlocker] = useState(null);

  // Same "build filter options from what's actually there" idea as
  // DailyUpdateHistory's employee filter — a custom "Other" category (the
  // typed text, not the literal word) only becomes filterable this way,
  // since the fixed list's own "Other" entry is a form sentinel, not a real
  // stored value.
  const categoryOptions = useMemo(
    () => [...new Set([...BLOCKER_CATEGORIES.filter((c) => c !== 'Other'), ...blockers.map((b) => b.category).filter(Boolean)])],
    [blockers],
  );

  const daysOpen = (b) => {
    const start = new Date(`${b.raisedDate}T00:00:00`);
    const end = new Date(`${b.closedDate || TODAY}T00:00:00`);
    return Math.max(0, Math.round((end - start) / 86400000));
  };

  const canUpdate = (b) => {
    if (currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN) return true;
    if (currentUser.id === b.raisedBy || currentUser.id === b.ownerToResolveId) return true;
    const raiser = userById(b.raisedBy);
    return Boolean(raiser) && canManage(currentUser, raiser);
  };

  const filtered = useMemo(() => blockers.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    if (escalationFilter !== 'all' && b.escalationLevel !== escalationFilter) return false;
    if (dateFrom && b.raisedDate < dateFrom) return false;
    if (dateTo && b.raisedDate > dateTo) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const raiser = userById(b.raisedBy);
      const owner = userById(b.ownerToResolveId);
      const haystack = `${b.description} ${b.blockingWhat} ${b.project} ${raiser?.name || ''} ${owner?.name || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [blockers, statusFilter, categoryFilter, escalationFilter, dateFrom, dateTo, search, blockerDirectory]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.seq - a.seq), [filtered]);

  const hasActiveFilters = search.trim() || statusFilter !== 'all' || categoryFilter !== 'all' || escalationFilter !== 'all' || dateFrom || dateTo;
  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); setEscalationFilter('all'); setDateFrom(''); setDateTo('');
  };

  const handleExport = () => {
    downloadCsv(`blocker-register-${TODAY}.csv`, sorted, [
      { label: 'Blocker ID', value: friendlyId },
      { label: 'Linked Task S/N', value: (b) => b.linkedTaskTitle || '' },
      { label: 'Member Tab', value: (b) => userById(b.raisedBy)?.name || '' },
      { label: 'Project', value: (b) => b.project },
      { label: 'Raised By', value: (b) => userById(b.raisedBy)?.name || '' },
      { label: 'Raised Date', value: (b) => b.raisedDate },
      { label: 'Category', value: (b) => b.category },
      { label: 'Description', value: (b) => b.description },
      { label: 'Blocking What', value: (b) => b.blockingWhat },
      { label: 'Owner To Resolve', value: (b) => userById(b.ownerToResolveId)?.name || '' },
      { label: 'Target Resolution', value: (b) => b.targetResolution || '' },
      { label: 'Days', value: daysOpen },
      { label: 'Escalation Level', value: (b) => b.escalationLevel },
      { label: 'Status', value: (b) => b.status },
      { label: 'Closed Date', value: (b) => b.closedDate || '' },
      { label: 'Resolution Note', value: (b) => b.resolutionNote || '' },
    ]);
  };

  const gridTemplate = '0.8fr 1fr 1fr 1.1fr 2fr 1fr 0.9fr 0.6fr 0.9fr 0.9fr 0.7fr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Blocker Register</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Company-wide — anyone can raise or view a blocker, regardless of team
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => setShowRaise(true)}>
            <IconAlertTriangle size={14} color="#FFFFFF" /> Raise a blocker
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={sorted.length === 0}>
            <IconDownload size={14} color="var(--text-secondary)" /> Export CSV
          </Button>
        </div>
      </div>

      <Card padded={false} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px' }}>
            <IconSearch size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blockers, projects, people..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          <div className="filter-field" style={{ width: 150 }}>
            <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]} />
          </div>
          <div className="filter-field" style={{ width: 180 }}>
            <Select value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'all', label: 'All categories' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]} />
          </div>
          <div className="filter-field" style={{ width: 160 }}>
            <Select value={escalationFilter} onChange={setEscalationFilter} options={[{ value: 'all', label: 'All escalation levels' }, ...ESCALATION_LEVELS.map((l) => ({ value: l, label: l }))]} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>From</span>
            <div className="filter-field" style={{ width: 145 }}><DatePicker value={dateFrom} onChange={setDateFrom} /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>To</span>
            <div className="filter-field" style={{ width: 145 }}><DatePicker value={dateTo} onChange={setDateTo} /></div>
          </div>
          {hasActiveFilters && (
            <span onClick={clearFilters} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
              Clear filters
            </span>
          )}
        </div>
      </Card>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1240 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, background: 'var(--field-bg)', borderBottom: '2px solid var(--border)' }}>
              {['ID', 'Raised By', 'Project', 'Category', 'Description', 'Owner To Resolve', 'Target Resolution', 'Days', 'Escalation', 'Status', ''].map((h) => (
                <div key={h} style={{ padding: '11px 14px', borderRight: '1px solid var(--border)', fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {h}
                </div>
              ))}
            </div>

            {sorted.map((b, i) => {
              const raiser = userById(b.raisedBy);
              const owner = userById(b.ownerToResolveId);
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'stretch',
                    background: i % 2 === 1 ? 'var(--field-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>{friendlyId(b)}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{raiser?.name || '—'}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{b.project || '—'}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{b.category}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{b.description}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{owner?.name || '— Not assigned —'}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{b.targetResolution ? formatDate(b.targetResolution) : '—'}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--heading)', fontVariantNumeric: 'tabular-nums' }}>{daysOpen(b)}</span></Cell>
                  <Cell><EscalationBadge level={b.escalationLevel} /></Cell>
                  <Cell><BlockerStatusBadge status={b.status} /></Cell>
                  <Cell>
                    {canUpdate(b) ? (
                      <button
                        type="button"
                        onClick={() => setEditingBlocker(b)}
                        style={{
                          fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 12,
                          color: 'var(--accent-dark)', background: 'transparent', border: 'none', padding: '4px 2px', cursor: 'pointer',
                        }}
                      >
                        Update
                      </button>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>—</span>}
                  </Cell>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                {blockers.length === 0 ? 'No blockers raised yet.' : 'No blockers match your filters.'}
              </div>
            )}
          </div>
        </div>
      </Card>

      {sorted.length > 0 && (
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)' }}>
          {sorted.length} of {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
        </div>
      )}

      {showRaise && <RaiseBlockerModal onClose={() => setShowRaise(false)} />}
      {editingBlocker && <RaiseBlockerModal blocker={editingBlocker} onClose={() => setEditingBlocker(null)} />}
    </div>
  );
}

function Cell({ children }) {
  return (
    <div style={{ padding: '11px 14px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
