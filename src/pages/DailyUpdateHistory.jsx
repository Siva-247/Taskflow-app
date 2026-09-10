import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, DAILY_MILESTONES, DAILY_UPDATE_STATUSES, BLOCKER_STATUS } from '../data/mockData.js';
import { canManage } from '../data/hierarchy.js';
import { Card, Avatar, PriorityDot, Select, Field, TextArea, Button, Modal, Pagination, PAGE_SIZE, DailyStatusBadge } from '../components/ui.jsx';
import DailyUpdateForm from '../components/DailyUpdateForm.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { IconSearch, IconArrowRight, IconDownload, IconAlertTriangle } from '../components/icons.jsx';
import { formatDate, downloadCsv } from '../utils.js';

const OPEN_BLOCKER_STATUSES = [BLOCKER_STATUS.RESOLVED, BLOCKER_STATUS.CLOSED];

const MILESTONE_COLOR = {
  Videos: { bg: 'var(--neutral-bg)', color: 'var(--text-secondary)' },
  Develop: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' },
  Testing: { bg: 'var(--amber-bg)', color: 'var(--amber-text)' },
};

function MilestoneBadge({ milestone }) {
  const s = MILESTONE_COLOR[milestone] || { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5 }}>
      {milestone}
    </span>
  );
}

// Reads through to the older schema (concepts_covered/practical_task/
// video_link) for entries logged before this format existed, so historical
// rows still show something meaningful instead of a blank column.
const selfNote = (u) => u.selfAssessment || [u.conceptsCovered, u.practicalTask].filter(Boolean).join(' / ');
const resourceLink = (u) => u.resources || u.videoLink || '';
// Rows backfilled from an external tracker spreadsheet carry their own
// verbatim id (e.g. "TK001") in customTaskId — every other row keeps the
// normal DU-0001 style id derived from seq.
const friendlyDuId = (u) => u.customTaskId || `DU-${String(u.seq).padStart(4, '0')}`;
const friendlyBlockerId = (b) => `BLK-${String(b.seq).padStart(4, '0')}`;

// Task ID -> Department -> Project -> Milestone -> Task -> Deliverable ->
// Assignee -> Priority -> Start Date -> Due Date -> Status -> Actual Close
// Date -> Blocker -> Resources, per the second revision of this format.
// BDM Remarks and the linked-task view stay appended at the end — additions
// from the first revision, not part of the spreadsheet's own column set.
const COLUMNS = [
  { key: 'taskId', label: 'Task ID' },
  { key: 'department', label: 'Department' },
  { key: 'project', label: 'Project' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'task', label: 'Task' },
  { key: 'deliverable', label: 'Deliverable' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'status', label: 'Status' },
  { key: 'actualCloseDate', label: 'Actual Close Date' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'resources', label: 'Resources' },
  { key: 'bdmRemarks', label: 'BDM Remarks' },
  { key: 'linkedTask', label: 'Task' },
];
// Starting pixel widths, roughly matching the old fr proportions — from
// here every column is user-adjustable and remembered per browser (see
// COL_WIDTHS_KEY below), not fixed like a normal table's.
const DEFAULT_COL_WIDTHS = {
  taskId: 90, department: 115, project: 115, milestone: 90, task: 200, deliverable: 150,
  assignee: 125, priority: 90, startDate: 100, dueDate: 100, status: 100, actualCloseDate: 115,
  blocker: 90, resources: 90, bdmRemarks: 165, linkedTask: 80,
};
const MIN_COL_WIDTH = 60;
const DEFAULT_ROW_HEIGHT = 44;
const MIN_ROW_HEIGHT = 32;
const MAX_ROW_HEIGHT = 160;
const COL_WIDTHS_KEY = 'dailyUpdateColWidths';
const ROW_HEIGHT_KEY = 'dailyUpdateRowHeight';

function loadStoredColWidths() {
  try {
    const raw = JSON.parse(localStorage.getItem(COL_WIDTHS_KEY));
    if (!raw || typeof raw !== 'object') return DEFAULT_COL_WIDTHS;
    const merged = { ...DEFAULT_COL_WIDTHS };
    for (const key of Object.keys(DEFAULT_COL_WIDTHS)) {
      if (typeof raw[key] === 'number' && raw[key] >= MIN_COL_WIDTH) merged[key] = raw[key];
    }
    return merged;
  } catch {
    return DEFAULT_COL_WIDTHS; // localStorage unavailable (private mode etc) — fall back silently
  }
}
function loadStoredRowHeight() {
  try {
    const raw = Number(localStorage.getItem(ROW_HEIGHT_KEY));
    if (raw >= MIN_ROW_HEIGHT && raw <= MAX_ROW_HEIGHT) return raw;
  } catch {
    // localStorage unavailable — fall back silently
  }
  return DEFAULT_ROW_HEIGHT;
}

export default function DailyUpdateHistory() {
  const { currentUser, users, departments, blockers, scopedDailyUpdates, TODAY, openBlockerRegister, reviewDailyUpdate } = useApp();
  const departmentById = (id) => departments.find((d) => d.id === id) || null;
  const openBlockerForTask = (taskId) => (taskId ? blockers.find((b) => b.linkedTaskId === taskId && !OPEN_BLOCKER_STATUSES.includes(b.status)) : null);
  const navigate = useNavigate();
  const userById = (id) => users.find((u) => u.id === id) || null;

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [milestoneFilter, setMilestoneFilter] = useState('all');
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [page, setPage] = useState(1);
  const [reviewingUpdate, setReviewingUpdate] = useState(null);

  // Drag-to-resize table layout — column widths and row height, both
  // user-adjustable and remembered per browser (mirrors Sidebar.jsx's own
  // drag-to-resize-and-remember pattern). `dragRef` holds the pointer's
  // start position plus whatever's being resized' start size so each
  // mousemove only needs a cheap delta, not a re-read of DOM layout.
  const [colWidths, setColWidths] = useState(loadStoredColWidths);
  const [rowHeight, setRowHeight] = useState(loadStoredRowHeight);
  const [draggingCol, setDraggingCol] = useState(null);
  const [draggingRow, setDraggingRow] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startWidth: 0, startHeight: 0 });
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;

  const startColDrag = (colKey) => (e) => {
    e.preventDefault();
    dragRef.current.startX = e.clientX;
    dragRef.current.startWidth = colWidths[colKey];
    setDraggingCol(colKey);
  };
  const startRowDrag = (e) => {
    e.preventDefault();
    dragRef.current.startY = e.clientY;
    dragRef.current.startHeight = rowHeight;
    setDraggingRow(true);
  };

  useEffect(() => {
    if (!draggingCol) return undefined;
    const handleMove = (e) => {
      const next = Math.max(MIN_COL_WIDTH, dragRef.current.startWidth + (e.clientX - dragRef.current.startX));
      setColWidths((prev) => ({ ...prev, [draggingCol]: next }));
    };
    const stopDrag = () => {
      setDraggingCol(null);
      try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidthsRef.current)); } catch { /* ignore */ }
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [draggingCol]);

  useEffect(() => {
    if (!draggingRow) return undefined;
    const handleMove = (e) => {
      const next = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, dragRef.current.startHeight + (e.clientY - dragRef.current.startY)));
      setRowHeight(next);
    };
    const stopDrag = () => {
      setDraggingRow(false);
      try { localStorage.setItem(ROW_HEIGHT_KEY, String(rowHeightRef.current)); } catch { /* ignore */ }
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [draggingRow]);

  const resetLayout = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
    setRowHeight(DEFAULT_ROW_HEIGHT);
    try {
      localStorage.removeItem(COL_WIDTHS_KEY);
      localStorage.removeItem(ROW_HEIGHT_KEY);
    } catch { /* ignore */ }
  };
  const layoutIsCustom = rowHeight !== DEFAULT_ROW_HEIGHT || COLUMNS.some((c) => colWidths[c.key] !== DEFAULT_COL_WIDTHS[c.key]);

  const gridTemplate = COLUMNS.map((c) => `${colWidths[c.key]}px`).join(' ');
  const tableWidth = COLUMNS.reduce((sum, c) => sum + colWidths[c.key], 0);

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

  const availableMilestones = useMemo(
    () => [...new Set([...DAILY_MILESTONES.filter((m) => m !== 'Other'), ...allUpdates.map((u) => u.milestone).filter(Boolean)])],
    [allUpdates],
  );

  const filtered = useMemo(() => allUpdates.filter((u) => {
    if (dateFrom && u.date < dateFrom) return false;
    if (dateTo && u.date > dateTo) return false;
    if (employeeFilter !== 'all' && u.userId !== employeeFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (milestoneFilter !== 'all' && u.milestone !== milestoneFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const author = userById(u.userId);
      const haystack = `${u.taskCompleted} ${selfNote(u)} ${u.project || ''} ${u.taskTitle} ${author?.name || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [allUpdates, dateFrom, dateTo, employeeFilter, statusFilter, milestoneFilter, search]);

  const updates = useMemo(() => {
    const withAuthor = filtered.map((u) => ({ ...u, employeeName: userById(u.userId)?.name || '' }));
    return withAuthor.sort((a, b) => (a.date === b.date ? 0 : (a.date < b.date ? 1 : -1)));
  }, [filtered]);

  // A filter change redefines what "page 3" means; a background poll
  // refresh under unchanged filters should not reset it.
  useEffect(() => setPage(1), [dateFrom, dateTo, employeeFilter, statusFilter, milestoneFilter, search]);

  const pageCount = Math.max(1, Math.ceil(updates.length / PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pageItems = updates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const completed = updates.filter((u) => u.status === 'Completed').length;
    return { total: updates.length, completed, inProgress: updates.length - completed, members: new Set(updates.map((u) => u.userId)).size };
  }, [updates]);

  const showEmployeeFilter = availableEmployees.length > 1;
  const hasActiveFilters = search.trim() || dateFrom || dateTo || employeeFilter !== 'all' || statusFilter !== 'all' || milestoneFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo(''); setEmployeeFilter('all'); setStatusFilter('all'); setMilestoneFilter('all');
  };

  const handleSaveReview = async (updateId, remarks) => {
    await reviewDailyUpdate(updateId, remarks);
  };

  const handleExport = () => {
    downloadCsv(`daily-updates-${TODAY}.csv`, updates, [
      { label: 'Task ID', value: (u) => friendlyDuId(u) },
      { label: 'Department', value: (u) => departmentById(u.departmentId)?.name || '' },
      { label: 'Project', value: (u) => u.project || '' },
      { label: 'Milestone', value: (u) => u.milestone || '' },
      { label: 'Task', value: (u) => u.taskCompleted },
      { label: 'Deliverable', value: (u) => u.deliverables || '' },
      { label: 'Assignee', value: (u) => u.employeeName },
      { label: 'Priority', value: (u) => u.priority || '' },
      { label: 'Start Date', value: (u) => u.taskStartDate || '' },
      { label: 'Due Date', value: (u) => u.dueDate || '' },
      { label: 'Status', value: (u) => u.status },
      { label: 'Actual Close Date', value: (u) => u.actualCloseDate || '' },
      { label: 'Blocker', value: (u) => { const b = openBlockerForTask(u.taskId); return b ? friendlyBlockerId(b) : ''; } },
      { label: 'Resources', value: (u) => resourceLink(u) },
      { label: 'BDM Remarks', value: (u) => u.bdmRemarks || '' },
      { label: 'Reviewed By', value: (u) => userById(u.bdmRemarksBy)?.name || '' },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Daily work update history</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{scopeLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {currentUser.role === ROLES.EMPLOYEE && (
            <Button variant="secondary" onClick={() => setShowUpdateForm(true)}>Update today's entry</Button>
          )}
          {/* Visible to every role, unlike the button above — a blocker can
              come from anyone on the team, not just Employees. */}
          <Button variant="secondary" onClick={openBlockerRegister}>
            <IconAlertTriangle size={14} color="var(--amber-text)" /> Blocker Register
          </Button>
          <Button onClick={handleExport} disabled={updates.length === 0}>
            <IconDownload size={14} color="#FFFFFF" /> Export CSV
          </Button>
        </div>
      </div>

      <Card style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <Stat value={stats.total} label="Entries shown" />
          <Stat value={stats.completed} label="Completed" color="var(--accent-dark)" />
          <Stat value={stats.inProgress} label="In progress" color="var(--amber-text)" />
          <Stat value={stats.members} label="Members" />
        </div>
      </Card>

      <Card padded={false} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px' }}>
            <IconSearch size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search updates, projects, employees..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          <div className="filter-field" style={{ width: 150 }}>
            <Select value={milestoneFilter} onChange={setMilestoneFilter} options={[{ value: 'all', label: 'All milestones' }, ...availableMilestones.map((m) => ({ value: m, label: m }))]} />
          </div>
          <div className="filter-field" style={{ width: 150 }}>
            <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...DAILY_UPDATE_STATUSES.map((s) => ({ value: s, label: s }))]} />
          </div>
          {showEmployeeFilter && (
            <div className="filter-field" style={{ width: 170 }}>
              <Select value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: 'all', label: 'All employees' }, ...availableEmployees.map((u) => ({ value: u.id, label: u.name }))]} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>From</span>
            <div className="filter-field" style={{ width: 145 }}><DatePicker value={dateFrom} onChange={setDateFrom} /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>To</span>
            <div className="filter-field" style={{ width: 145 }}><DatePicker value={dateTo} onChange={setDateTo} /></div>
          </div>
          {hasActiveFilters && (
            <span onClick={clearFilters} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
              Clear filters
            </span>
          )}
        </div>
      </Card>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>
            Drag a column edge to resize it, or a row edge to resize row height — your layout is remembered.
          </span>
          {layoutIsCustom && (
            <span onClick={resetLayout} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--accent-dark)', cursor: 'pointer', flexShrink: 0 }}>
              Reset layout
            </span>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: tableWidth }}>
            <div className="table-head-brand" style={{ display: 'grid', gridTemplateColumns: gridTemplate, borderBottom: '2px solid var(--border)' }}>
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  style={{
                    position: 'relative', padding: '11px 14px', borderRight: '1px solid var(--border)',
                    fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}
                >
                  {col.label}
                  <ColResizeHandle onMouseDown={startColDrag(col.key)} active={draggingCol === col.key} />
                </div>
              ))}
            </div>

            {pageItems.map((u, i) => {
              const author = userById(u.userId);
              const canReview = author && canManage(currentUser, author);
              const link = resourceLink(u);
              const blocker = openBlockerForTask(u.taskId);
              return (
                <div
                  key={u.id}
                  style={{
                    position: 'relative', display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'stretch',
                    minHeight: rowHeight, background: i % 2 === 1 ? 'var(--field-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <RowResizeHandle onMouseDown={startRowDrag} active={draggingRow} />
                  <Cell><span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>{friendlyDuId(u)}</span></Cell>
                  <Cell><CellText>{departmentById(u.departmentId)?.name}</CellText></Cell>
                  <Cell><CellText>{u.project}</CellText></Cell>
                  <Cell>{u.milestone ? <MilestoneBadge milestone={u.milestone} /> : <Dash />}</Cell>
                  <Cell><CellText>{u.taskCompleted}</CellText></Cell>
                  <Cell><CellText>{u.deliverables}</CellText></Cell>
                  <Cell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Avatar initial={author?.initial} size={20} />
                      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{author?.name}</span>
                    </div>
                  </Cell>
                  <Cell>
                    {u.priority ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PriorityDot priority={u.priority} />
                        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.priority}</span>
                      </div>
                    ) : <Dash />}
                  </Cell>
                  <Cell>{u.taskStartDate ? <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatDate(u.taskStartDate)}</span> : <Dash />}</Cell>
                  <Cell>{u.dueDate ? <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatDate(u.dueDate)}</span> : <Dash />}</Cell>
                  <Cell><DailyStatusBadge status={u.status} /></Cell>
                  <Cell>{u.actualCloseDate ? <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatDate(u.actualCloseDate)}</span> : <Dash />}</Cell>
                  <Cell>
                    {blocker ? (
                      <span style={{
                        display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: 'var(--amber-bg)', color: 'var(--amber-text)',
                        fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11,
                      }}>
                        {friendlyBlockerId(blocker)}
                      </span>
                    ) : <Dash />}
                  </Cell>
                  <Cell>
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--accent-dark)' }}>
                        Link
                      </a>
                    ) : <Dash />}
                  </Cell>
                  <Cell>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                      {u.bdmRemarks ? (
                        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.bdmRemarks}</span>
                      ) : <Dash />}
                      {canReview && (
                        <span
                          onClick={() => setReviewingUpdate(u)}
                          style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}
                        >
                          {u.bdmRemarks ? 'Edit review' : 'Add review'}
                        </span>
                      )}
                    </div>
                  </Cell>
                  <Cell>
                    {u.taskId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks/${u.taskId}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12,
                          color: 'var(--accent-dark)', background: 'transparent', border: 'none', padding: '4px 2px', cursor: 'pointer',
                        }}
                      >
                        View <IconArrowRight size={11} />
                      </button>
                    ) : <Dash />}
                  </Cell>
                </div>
              );
            })}
            {updates.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                {allUpdates.length === 0 ? 'No daily updates submitted yet.' : 'No updates match your filters.'}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Pagination page={page} totalItems={updates.length} onChange={setPage} />

      {showUpdateForm && <DailyUpdateForm onClose={() => setShowUpdateForm(false)} />}
      {reviewingUpdate && (
        <ReviewModal update={reviewingUpdate} onClose={() => setReviewingUpdate(null)} onSave={handleSaveReview} reviewerName={currentUser.name} />
      )}
    </div>
  );
}

function Stat({ value, label, color = 'var(--heading)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 92 }}>
      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 21, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function Cell({ children }) {
  return (
    <div style={{ padding: '11px 14px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
      {children}
    </div>
  );
}

// A wide-but-invisible hit area over a header cell's right border — actual
// drag logic (and the width state it updates) lives in the page component;
// this just supplies the grab target and its hover/active highlight.
function ColResizeHandle({ onMouseDown, active }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`col-resize-handle${active ? ' active' : ''}`}
      style={{ position: 'absolute', top: 0, bottom: 0, right: -5, width: 10, cursor: 'col-resize', zIndex: 3 }}
    >
      <div className="resize-line" style={{ width: 2, height: '100%', margin: '0 auto', background: 'var(--accent)' }} />
    </div>
  );
}

// Same idea along a row's bottom edge — every row renders one, but they all
// drive the single shared `rowHeight` (see DailyUpdateHistory's own state),
// so grabbing any row resizes them uniformly rather than one at a time.
function RowResizeHandle({ onMouseDown, active }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`row-resize-handle${active ? ' active' : ''}`}
      style={{ position: 'absolute', left: 0, right: 0, bottom: -4, height: 8, cursor: 'row-resize', zIndex: 3 }}
    >
      <div className="resize-line" style={{ height: 2, width: '100%', margin: 'auto 0', background: 'var(--accent)' }} />
    </div>
  );
}

function CellText({ children }) {
  if (!children) return <Dash />;
  return <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{children}</span>;
}

function Dash() {
  return <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>—</span>;
}

// Reviewing someone else's entry is a separate, narrower action than editing
// your own (see backend routes/dailyUpdates.js's dedicated /review endpoint,
// authorized by hierarchy.canManage) — a small standalone modal rather than
// inline table editing, same as how RaiseBlockerModal handles editing a row
// from BlockerRegisterModal's own dense table.
function ReviewModal({ update, onClose, onSave }) {
  const [draft, setDraft] = useState(update.bdmRemarks || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onSave(update.id, draft.trim());
      onClose();
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="BDM review" onClose={onClose} maxWidth={440}>
      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {update.employeeName}'s entry from {formatDate(update.date)}
      </div>
      <Field label="Remarks">
        <TextArea value={draft} onChange={setDraft} placeholder="Your review notes for this entry" minHeight={90} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={!draft.trim() || saving}>{saving ? 'Saving…' : 'Save review'}</Button>
      </div>
    </Modal>
  );
}
