import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Avatar, StatusBadge, Select, TextInput, Button } from '../components/ui.jsx';
import DailyUpdateForm from '../components/DailyUpdateForm.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { IconSearch, IconArrowRight, IconDownload } from '../components/icons.jsx';
import { formatDate, downloadCsv } from '../utils.js';

const STATUS_OPTIONS = ['Completed', 'In Progress'];

const COLUMNS = [
  { key: 'date', label: 'Date', width: '0.9fr', sortable: true },
  { key: 'employee', label: 'Employee', width: '1.1fr', sortable: true },
  { key: 'taskCompleted', label: 'Task Completed', width: '2fr', sortable: false },
  { key: 'conceptsCovered', label: 'Concepts Covered', width: '1.6fr', sortable: false },
  { key: 'practicalTask', label: 'Practical Task', width: '1.6fr', sortable: false },
  { key: 'status', label: 'Status', width: '0.9fr', sortable: true },
  { key: 'videosCompleted', label: 'Videos', width: '0.6fr', sortable: true },
  { key: 'videoLink', label: 'Video Link', width: '1fr', sortable: false },
  { key: 'task', label: 'Task', width: '0.7fr', sortable: false },
];

export default function DailyUpdateHistory() {
  const { currentUser, users, departments, scopedDailyUpdates, TODAY } = useApp();
  const navigate = useNavigate();
  const userById = (id) => users.find((u) => u.id === id) || null;

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const allUpdates = scopedDailyUpdates(currentUser);
  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);

  const scopeLabel = {
    [ROLES.SUPER_ADMIN]: 'Every daily update across the company',
    [ROLES.ADMIN]: 'Every daily update across the company',
    [ROLES.MANAGER]: `Daily updates across ${myDepartment?.name || 'your department'}`,
    [ROLES.ASSISTANT_MANAGER]: 'Daily updates from your team',
    [ROLES.TEAM_LEAD]: 'Daily updates from your team',
    [ROLES.EMPLOYEE]: 'Your daily updates',
  }[currentUser.role];

  const availableEmployees = useMemo(() => {
    const seen = new Map();
    allUpdates.forEach((u) => {
      const author = userById(u.userId);
      if (author && !seen.has(author.id)) seen.set(author.id, author);
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUpdates]);

  const filtered = useMemo(() => allUpdates.filter((u) => {
    if (dateFrom && u.date < dateFrom) return false;
    if (dateTo && u.date > dateTo) return false;
    if (employeeFilter !== 'all' && u.userId !== employeeFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const author = userById(u.userId);
      const haystack = `${u.taskCompleted} ${u.conceptsCovered} ${u.practicalTask} ${u.taskTitle} ${author?.name || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [allUpdates, dateFrom, dateTo, employeeFilter, statusFilter, search]);

  const updates = useMemo(() => {
    const withAuthor = filtered.map((u) => ({ ...u, employeeName: userById(u.userId)?.name || '' }));
    const dir = sortDir === 'asc' ? 1 : -1;
    return withAuthor.sort((a, b) => {
      if (sortKey === 'employee') return a.employeeName.localeCompare(b.employeeName) * dir;
      if (sortKey === 'videosCompleted') return ((a.videosCompleted || 0) - (b.videosCompleted || 0)) * dir;
      if (sortKey === 'status') return a.status.localeCompare(b.status) * dir;
      // date (default)
      if (a.date === b.date) return 0;
      return (a.date < b.date ? -1 : 1) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const showEmployeeFilter = availableEmployees.length > 1;
  const hasActiveFilters = search.trim() || dateFrom || dateTo || employeeFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo(''); setEmployeeFilter('all'); setStatusFilter('all');
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };

  const handleExport = () => {
    downloadCsv(`daily-updates-${TODAY}.csv`, updates, [
      { label: 'Date', value: (u) => u.date },
      { label: 'Employee', value: (u) => u.employeeName },
      { label: 'Task Completed', value: (u) => u.taskCompleted },
      { label: 'Concepts Covered', value: (u) => u.conceptsCovered },
      { label: 'Practical Task', value: (u) => u.practicalTask },
      { label: 'Status', value: (u) => u.status },
      { label: 'Videos Completed', value: (u) => u.videosCompleted || 0 },
      { label: 'Video Link', value: (u) => u.videoLink },
    ]);
  };

  const gridTemplate = COLUMNS.map((c) => c.width).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Daily work update history</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{scopeLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {currentUser.role === ROLES.EMPLOYEE && (
            <Button variant="secondary" onClick={() => setShowUpdateForm(true)}>Update today's entry</Button>
          )}
          <Button onClick={handleExport} disabled={updates.length === 0}>
            <IconDownload size={14} color="#FFFFFF" /> Export CSV
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
              placeholder="Search updates, tasks, employees..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          <div className="filter-field" style={{ width: 150 }}>
            <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]} />
          </div>
          {showEmployeeFilter && (
            <div className="filter-field" style={{ width: 170 }}>
              <Select value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: 'all', label: 'All employees' }, ...availableEmployees.map((u) => ({ value: u.id, label: u.name }))]} />
            </div>
          )}
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
          <div style={{ minWidth: 1180 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, background: 'var(--field-bg)', borderBottom: '2px solid var(--border)' }}>
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '11px 14px',
                    borderRight: '1px solid var(--border)', cursor: col.sortable ? 'pointer' : 'default',
                    fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: sortKey === col.key ? 'var(--accent-dark)' : 'var(--text-muted)',
                  }}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </div>
              ))}
            </div>

            {updates.map((u, i) => {
              const author = userById(u.userId);
              const linked = Boolean(u.taskId);
              const videoLinks = u.videoLink ? u.videoLink.split(',').map((v) => v.trim()).filter(Boolean) : [];
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'stretch',
                    background: i % 2 === 1 ? 'var(--field-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatDate(u.date)}</span></Cell>
                  <Cell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Avatar initial={author?.initial} size={20} />
                      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{author?.name}</span>
                    </div>
                  </Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.taskCompleted || '—'}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.conceptsCovered || '—'}</span></Cell>
                  <Cell><span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.practicalTask || '—'}</span></Cell>
                  <Cell><StatusBadge status={u.status} /></Cell>
                  <Cell><span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--heading)', fontVariantNumeric: 'tabular-nums' }}>{u.videosCompleted || 0}</span></Cell>
                  <Cell>
                    {videoLinks.length > 0 ? (
                      <a
                        href={videoLinks[0]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--accent-dark)' }}
                      >
                        {videoLinks.length > 1 ? `${videoLinks.length} links` : 'Link'}
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>—</span>}
                  </Cell>
                  <Cell>
                    {linked ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks/${u.taskId}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12,
                          color: 'var(--accent-dark)', background: 'transparent', border: 'none', padding: '4px 2px', cursor: 'pointer',
                        }}
                      >
                        View <IconArrowRight size={11} />
                      </button>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>—</span>}
                  </Cell>
                </div>
              );
            })}
            {updates.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                {allUpdates.length === 0 ? 'No daily updates submitted yet.' : 'No updates match your filters.'}
              </div>
            )}
          </div>
        </div>
      </Card>

      {updates.length > 0 && (
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)' }}>
          {updates.length} of {allUpdates.length} update{allUpdates.length === 1 ? '' : 's'}
        </div>
      )}

      {showUpdateForm && <DailyUpdateForm onClose={() => setShowUpdateForm(false)} />}
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
