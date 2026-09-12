import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Card, Avatar, Select } from './ui.jsx';
import DatePicker from './DatePicker.jsx';
import { IconLayers } from './icons.jsx';
import { formatDate } from '../utils.js';

// A Gantt-style board: one row per teammate, one horizontal lane of colored
// segments per row — each segment is a run of consecutive days where they
// logged the SAME "Project" value on their Daily Update. A different project
// (or a gap where nothing was logged) starts a new segment, so a project
// switch is visible exactly where it happened rather than smoothed over.
// Every teammate in scope gets a row, even one who's logged nothing at all
// this range (see GET /daily-updates/timeline's scopedRoster) — a manager
// should be able to see who's quiet, not just who's active. Entirely
// self-fetching since the date range (and, for Admin/Super Admin, the
// department filter) live inside this component, unlike TeamCompletionChart
// which takes its default data from AppContext.
const DAY_WIDTH = 60;
const NAME_COL_WIDTH = 176;
const ROW_HEIGHT = 46;
const GROUP_HEADER_HEIGHT = 34;

// First-seen-across-the-dataset order, not alphabetical, so the same
// project keeps the same color as the date range changes and new/older
// projects scroll in and out of view.
const PALETTE = [
  'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)',
  'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)',
];

function colorFor(project, colorByProject) {
  if (!colorByProject.has(project)) colorByProject.set(project, PALETTE[colorByProject.size % PALETTE.length]);
  return colorByProject.get(project);
}

// `.toISOString()` reads a Date's UTC calendar day, which silently shifts
// by one in any timezone ahead of UTC (a local midnight becomes "yesterday,
// late evening" in UTC) — for someone in IST that quietly dropped today's
// entries off the end of the grid. Every date string here instead comes
// from the Date object's own local getters, matching DatePicker.jsx's own
// toISO helper elsewhere in this app.
function pad(n) { return String(n).padStart(2, '0'); }
function toLocalISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function isoDaysBetween(from, to) {
  const out = [];
  const cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cur <= end) {
    out.push(toLocalISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function dayLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), num: d.getDate() };
}
function daysBack(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - (n - 1));
  return toLocalISO(d);
}
function rangePresets(today) {
  return [
    { key: 'all', label: 'All time' },
    { key: 'week', label: 'One week', from: daysBack(today, 7), to: today },
    { key: 'month', label: '1 month', from: daysBack(today, 30), to: today },
    { key: '3months', label: 'Last 3 months', from: daysBack(today, 90), to: today },
    { key: 'custom', label: 'Custom range' },
  ];
}

// Merge date-sorted entries into runs of consecutive visible days sharing
// the same project — a day missing from `dayIndexOf` (submitted outside the
// currently-visible range, shouldn't happen given the fetch is range-scoped,
// but a defensive skip rather than a crash) simply breaks the run.
function toSegments(entries, dayIndexOf) {
  const segments = [];
  let current = null;
  for (const e of entries) {
    const idx = dayIndexOf.get(e.date);
    if (idx === undefined) continue;
    if (current && current.project === e.project && idx === current.endIndex + 1) {
      current.endIndex = idx;
      current.lastStatus = e.status;
    } else {
      if (current) segments.push(current);
      current = { project: e.project, startIndex: idx, endIndex: idx, startDate: e.date, lastStatus: e.status };
    }
  }
  if (current) segments.push(current);
  return segments;
}

// Flattens the row list into name-column-order items, inserting a header
// pseudo-row wherever the department changes — both the name column and the
// grid column map over this SAME list so a header lines up across both,
// instead of two independently-sorted maps drifting apart.
function withGroupHeaders(rows, groupByDepartment) {
  if (!groupByDepartment) return rows.map((r) => ({ type: 'member', row: r }));
  const sorted = [...rows].sort((a, b) => (a.departmentName || '').localeCompare(b.departmentName || '') || a.name.localeCompare(b.name));
  const items = [];
  let lastDept = undefined;
  for (const r of sorted) {
    if (r.departmentName !== lastDept) {
      items.push({ type: 'header', label: r.departmentName || 'Unassigned' });
      lastDept = r.departmentName;
    }
    items.push({ type: 'member', row: r });
  }
  return items;
}

function FilterField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

export default function ProjectTimelineBoard({ title, today, groupByDepartment = false, departments = [] }) {
  const { apiCall, showToast } = useApp();
  const [rangeKey, setRangeKey] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  // Only ever passed in (and only ever rendered) for the Admin/Super Admin
  // dashboard's company-wide board — every other dashboard already scopes
  // this widget to one department/team server-side, so there's nothing to
  // filter there. Sourced from AppContext's live `departments` list, which
  // already refetches on login and reflects any department added since —
  // no separate lookup or hardcoded list to go stale.
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSeg, setHoveredSeg] = useState(null);
  const presets = useMemo(() => rangePresets(today), [today]);
  const preset = presets.find((p) => p.key === rangeKey);

  const effectiveFrom = rangeKey === 'custom' ? customFrom : preset?.from;
  const effectiveTo = rangeKey === 'custom' ? customTo : preset?.to;
  const waitingOnCustomRange = rangeKey === 'custom' && !(customFrom && customTo);

  useEffect(() => {
    if (waitingOnCustomRange) return undefined;
    let cancelled = false;
    const params = new URLSearchParams();
    if (effectiveFrom && effectiveTo) { params.set('from', effectiveFrom); params.set('to', effectiveTo); }
    if (departmentFilter !== 'all') params.set('departmentId', departmentFilter);
    const query = params.toString() ? `?${params.toString()}` : '';
    const fetchTimeline = (showSpinner) => {
      if (showSpinner) setLoading(true);
      return apiCall(`/daily-updates/timeline${query}`)
        .then((r) => { if (!cancelled) setMembers(r.members || []); })
        .catch(() => { if (!cancelled && showSpinner) showToast('Could not load the project timeline'); })
        .finally(() => { if (!cancelled && showSpinner) setLoading(false); });
    };
    fetchTimeline(true);
    // No real-time channel in this app (same reasoning as AppContext's own
    // notification/task polling) — a short poll is what makes a project
    // someone else just logged show up here without a manual reload, close
    // enough to "instant" for a dashboard widget. Silent (no spinner, no
    // error toast) so a background refresh never flickers the board.
    const interval = window.setInterval(() => fetchTimeline(false), 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFrom, effectiveTo, waitingOnCustomRange, departmentFilter]);

  // Role dropdown options come from the full roster, not the
  // currently-filtered set, so the list itself doesn't shuffle/shrink as
  // the filter narrows.
  const roleOptions = useMemo(() => [...new Set(members.map((m) => m.title).filter(Boolean))].sort(), [members]);
  const filteredMembers = roleFilter === 'all' ? members : members.filter((m) => m.title === roleFilter);

  // "All time" has no fixed from/to — the visible window is whatever the
  // (filtered) data itself actually spans, so the grid doesn't start in some
  // arbitrary year with nothing in it.
  const allDates = filteredMembers.flatMap((m) => m.entries.map((e) => e.date));
  const gridFrom = rangeKey === 'all' ? allDates.sort()[0] : effectiveFrom;
  const gridTo = rangeKey === 'all' ? (allDates.sort().at(-1) || today) : effectiveTo;

  const days = useMemo(() => (gridFrom && gridTo ? isoDaysBetween(gridFrom, gridTo) : []), [gridFrom, gridTo]);
  const dayIndexOf = useMemo(() => new Map(days.map((d, i) => [d, i])), [days]);
  const todayIndex = dayIndexOf.get(today);

  // Every roster member (matching the role filter) gets a row regardless of
  // activity — a blank lane is itself the information ("nothing logged this
  // range"), not a reason to hide the person.
  const rows = useMemo(() => filteredMembers.map((m) => ({ ...m, segments: toSegments(m.entries, dayIndexOf) })), [filteredMembers, dayIndexOf]);
  const renderItems = useMemo(() => withGroupHeaders(rows, groupByDepartment), [rows, groupByDepartment]);

  // First-seen order (row order, then each row's date-sorted segments) so
  // the legend and every bar agree on which color a project got.
  const colorByProject = useMemo(() => {
    const map = new Map();
    for (const m of rows) for (const s of m.segments) colorFor(s.project, map);
    return map;
  }, [rows]);

  const gridWidth = days.length * DAY_WIDTH;

  return (
    <Card padded={false}>
      <div style={{ padding: '22px 26px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconLayers size={17} color="var(--accent)" />
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>{title}</div>
        </div>
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
          Built from each person's Daily Update "Project" entry — a bar breaks and recolors wherever the logged project changes.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', alignItems: 'flex-end' }}>
          {departments.length > 0 && (
            <FilterField label="Department">
              <Select
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={[{ value: 'all', label: 'All departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              />
            </FilterField>
          )}

          <FilterField label="Role">
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={[{ value: 'all', label: 'All roles' }, ...roleOptions.map((t) => ({ value: t, label: t }))]}
            />
          </FilterField>

          <FilterField label="Date range">
            <Select value={rangeKey} onChange={setRangeKey} options={presets.map((p) => ({ value: p.key, label: p.label }))} />
          </FilterField>
          {rangeKey === 'custom' && (
            <>
              <FilterField label="From">
                <DatePicker value={customFrom} onChange={setCustomFrom} />
              </FilterField>
              <FilterField label="To">
                <DatePicker value={customTo} onChange={setCustomTo} min={customFrom} />
              </FilterField>
            </>
          )}
          {gridFrom && gridTo && (
            <div style={{
              fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--accent-dark)',
              background: 'var(--accent-soft)', padding: '7px 13px', borderRadius: 999, marginBottom: 1,
            }}>
              {formatDate(gridFrom)} – {formatDate(gridTo)}
            </div>
          )}
        </div>

        {colorByProject.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 18, paddingBottom: 4 }}>
            {[...colorByProject.entries()].map(([project, color]) => (
              <div key={project} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2.5, background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{project}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflow: 'hidden', borderRadius: '0 0 18px 18px' }}>
      {waitingOnCustomRange ? (
        <EmptyState>Pick a from and to date to see that range.</EmptyState>
      ) : loading ? (
        <EmptyState>Loading…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>Nobody in scope yet.</EmptyState>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 20, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', minWidth: NAME_COL_WIDTH + gridWidth }}>
            <div style={{ flexShrink: 0, width: NAME_COL_WIDTH, position: 'sticky', left: 0, zIndex: 2, background: 'var(--glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '3px 0 8px -4px rgba(23,18,38,0.08)' }}>
              <div style={{ height: 40, borderBottom: '1px solid var(--border)' }} />
              {renderItems.map((item, i) => (item.type === 'header' ? (
                <div key={`h-${item.label}-${i}`} style={{
                  height: GROUP_HEADER_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 16px',
                  background: 'var(--field-bg)', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                </div>
              ) : (
                <div key={item.row.id} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px 0 20px', borderBottom: '1px solid var(--border)' }}>
                  <Avatar initial={item.row.name[0]} size={23} />
                  <span style={{
                    fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.row.name}
                  </span>
                </div>
              )))}
            </div>

            <div style={{ position: 'relative', width: gridWidth }}>
              <div style={{ display: 'flex', height: 40, borderBottom: '1px solid var(--border)' }}>
                {days.map((d, i) => {
                  const { weekday, num } = dayLabel(d);
                  return (
                    <div key={d} style={{
                      width: DAY_WIDTH, flexShrink: 0, textAlign: 'center', paddingTop: 5, borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                      background: i === todayIndex ? 'var(--accent-soft)' : 'transparent',
                    }}>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 10, color: 'var(--text-muted)' }}>{weekday}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: i === todayIndex ? 'var(--accent-dark)' : 'var(--text-primary)' }}>{num}</div>
                    </div>
                  );
                })}
              </div>

              {todayIndex !== undefined && (
                <div style={{
                  position: 'absolute', top: 40, bottom: 0, left: todayIndex * DAY_WIDTH, width: DAY_WIDTH,
                  background: 'var(--accent-soft)', opacity: 0.45, pointerEvents: 'none',
                }} />
              )}

              {renderItems.map((item, i) => (item.type === 'header' ? (
                <div key={`hg-${item.label}-${i}`} style={{ height: GROUP_HEADER_HEIGHT, background: 'var(--field-bg)', borderBottom: '1px solid var(--border)' }} />
              ) : (
                <div key={item.row.id} style={{ position: 'relative', height: ROW_HEIGHT, borderBottom: '1px solid var(--border)' }}>
                  {item.row.segments.map((seg, si) => {
                    const span = seg.endIndex - seg.startIndex + 1;
                    const color = colorFor(seg.project, colorByProject);
                    const segId = `${item.row.id}-${si}`;
                    return (
                      <div
                        key={segId}
                        onMouseEnter={() => setHoveredSeg(segId)}
                        onMouseLeave={() => setHoveredSeg(null)}
                        style={{
                          position: 'absolute', top: 8, left: seg.startIndex * DAY_WIDTH + 3, width: span * DAY_WIDTH - 6, height: ROW_HEIGHT - 16,
                          background: color, borderRadius: 7, display: 'flex', alignItems: 'center', padding: '0 12px',
                          cursor: 'default', boxShadow: hoveredSeg === segId ? '0 6px 16px -5px rgba(0,0,0,0.4)' : '0 1px 2px rgba(23,18,38,0.12)',
                          zIndex: hoveredSeg === segId ? 2 : 1, transition: 'box-shadow 120ms ease',
                        }}
                      >
                        <span style={{
                          fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: '#FFFFFF',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {seg.project}
                        </span>
                        {hoveredSeg === segId && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, background: 'var(--ink)', color: '#FFFFFF',
                            borderRadius: 9, padding: '9px 13px', whiteSpace: 'nowrap', zIndex: 3, boxShadow: '0 10px 24px -8px rgba(0,0,0,0.45)',
                          }}>
                            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, marginBottom: 4 }}>{seg.project}</div>
                            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 11 }}>{item.row.name}</div>
                            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 11 }}>
                              {span === 1 ? formatDate(days[seg.startIndex]) : `${formatDate(days[seg.startIndex])} – ${formatDate(days[seg.endIndex])}`}
                            </div>
                            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, marginTop: 2, color: '#D9CBFB' }}>{seg.lastStatus}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )))}
            </div>
          </div>
        </div>
      )}
      </div>
    </Card>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{
      fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)',
      padding: '30px 26px', textAlign: 'center', borderTop: '1px solid var(--border)', marginTop: 18,
    }}>
      {children}
    </div>
  );
}
