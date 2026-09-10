import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../ui.jsx';
import { formatDate } from '../../utils.js';
import { CHART_COLORS, EmptyNote } from './shared.jsx';

// A Gantt-style calendar rendering of Team's Current Projects — one row per
// teammate, one horizontal lane of colored segments per row, each segment a
// run of consecutive days where they logged the SAME (canonical) project.
// Unlike the Dashboard's self-fetching ProjectTimelineBoard, this is fully
// controlled: `timeline`/`from`/`to` come from TeamTacticalView's own
// already-filtered data, so the calendar always matches whatever
// Department/Team/Intern-Developer/Period the rest of the page is showing
// — no separate Role/Date-range pickers of its own.
const DAY_WIDTH = 56;
const NAME_COL_WIDTH = 168;
const ROW_HEIGHT = 44;

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

// Same "merge consecutive same-project days into one bar" rule as
// ProjectTimelineBoard — a project switch (or a gap) starts a new segment.
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
      current = { project: e.project, startIndex: idx, endIndex: idx, lastStatus: e.status };
    }
  }
  if (current) segments.push(current);
  return segments;
}

function colorFor(project, colorByProject) {
  if (!colorByProject.has(project)) colorByProject.set(project, CHART_COLORS[colorByProject.size % CHART_COLORS.length]);
  return colorByProject.get(project);
}

export default function TeamProjectCalendar({ timeline, from, to, today }) {
  // { segId, top, left } of the hovered segment, in viewport coordinates —
  // portaled to <body> as `position: fixed`. A plain `position: absolute`
  // tooltip here gets double-clipped: by the horizontally-scrolling grid's
  // own `overflowX: auto` container AND by the ancestor `card-glass` Card's
  // backdrop-filter + border-radius boundary (same bug fixed in
  // MemberBarChart/TrendBarChart) — either alone is enough to hide it for
  // any segment near the top row or off the visible scroll position.
  const [hoveredSeg, setHoveredSeg] = useState(null);

  // "All Time" (no from/to selected) has no fixed bound — the visible
  // window is whatever the filtered data itself actually spans, so the
  // grid doesn't open on some arbitrary far-past date with nothing in it.
  const allDates = timeline.flatMap((m) => m.entries.map((e) => e.date));
  const gridFrom = from || allDates.sort()[0];
  const gridTo = to || (allDates.sort().at(-1) || today);

  const days = useMemo(() => (gridFrom && gridTo ? isoDaysBetween(gridFrom, gridTo) : []), [gridFrom, gridTo]);
  const dayIndexOf = useMemo(() => new Map(days.map((d, i) => [d, i])), [days]);
  const todayIndex = dayIndexOf.get(today);

  const rows = useMemo(() => timeline.map((m) => ({ ...m, segments: toSegments(m.entries, dayIndexOf) })), [timeline, dayIndexOf]);

  const colorByProject = useMemo(() => {
    const map = new Map();
    for (const m of rows) for (const s of m.segments) colorFor(s.project, map);
    return map;
  }, [rows]);

  const gridWidth = days.length * DAY_WIDTH;

  if (!gridFrom || !gridTo || rows.length === 0) {
    return <EmptyNote>No activity to plot in this range.</EmptyNote>;
  }

  return (
    <div>
      {colorByProject.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 16px', marginBottom: 14 }}>
          {[...colorByProject.entries()].map(([project, color]) => (
            <div key={project} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2.5, background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11.5, color: 'var(--text-secondary)' }}>{project}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
        <div style={{ display: 'flex', minWidth: NAME_COL_WIDTH + gridWidth }}>
          <div style={{ flexShrink: 0, width: NAME_COL_WIDTH, position: 'sticky', left: 0, zIndex: 2, background: 'var(--field-bg)', boxShadow: '3px 0 8px -4px rgba(23,18,38,0.15)' }}>
            <div style={{ height: 36, borderBottom: '1px solid var(--line)' }} />
            {rows.map((row) => (
              <div key={row.id} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid var(--line)' }}>
                <Avatar initial={row.name[0]} size={21} gradient />
                <span title={row.name} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </span>
              </div>
            ))}
          </div>

          <div style={{ position: 'relative', width: gridWidth }}>
            <div style={{ display: 'flex', height: 36, borderBottom: '1px solid var(--line)' }}>
              {days.map((d, i) => {
                const { weekday, num } = dayLabel(d);
                return (
                  <div key={d} style={{ width: DAY_WIDTH, flexShrink: 0, textAlign: 'center', paddingTop: 3, borderLeft: i > 0 ? '1px solid var(--line)' : 'none', background: i === todayIndex ? 'var(--accent-soft)' : 'transparent' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9, color: 'var(--text-muted)' }}>{weekday}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: i === todayIndex ? 'var(--brand)' : 'var(--text-primary)' }}>{num}</div>
                  </div>
                );
              })}
            </div>

            {todayIndex !== undefined && (
              <div style={{ position: 'absolute', top: 36, bottom: 0, left: todayIndex * DAY_WIDTH, width: DAY_WIDTH, background: 'var(--accent-soft)', opacity: 0.5, pointerEvents: 'none' }} />
            )}

            {rows.map((row) => (
              <div key={row.id} style={{ position: 'relative', height: ROW_HEIGHT, borderBottom: '1px solid var(--line)' }}>
                {row.segments.map((seg, si) => {
                  const span = seg.endIndex - seg.startIndex + 1;
                  const color = colorFor(seg.project, colorByProject);
                  const segId = `${row.id}-${si}`;
                  return (
                    <div
                      key={segId}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setHoveredSeg({ segId, top: r.top - 8, left: r.left });
                      }}
                      onMouseLeave={() => setHoveredSeg(null)}
                      style={{
                        position: 'absolute', top: 7, left: seg.startIndex * DAY_WIDTH + 3, width: span * DAY_WIDTH - 6, height: ROW_HEIGHT - 14,
                        background: color, borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 10px',
                        cursor: 'default', boxShadow: hoveredSeg?.segId === segId ? '0 6px 16px -5px rgba(0,0,0,0.4)' : '0 1px 2px rgba(23,18,38,0.12)',
                        zIndex: hoveredSeg?.segId === segId ? 2 : 1,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {seg.project}
                      </span>
                      {hoveredSeg?.segId === segId && createPortal(
                        <div style={{
                          position: 'fixed', top: hoveredSeg.top, left: hoveredSeg.left, transform: 'translateY(-100%)', background: 'var(--ink)', color: '#FFFFFF',
                          borderRadius: 9, padding: '9px 13px', whiteSpace: 'nowrap', zIndex: 4000, pointerEvents: 'none', boxShadow: '0 10px 24px -8px rgba(0,0,0,0.45)',
                        }}>
                          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11.5, marginBottom: 4 }}>{seg.project}</div>
                          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11 }}>{row.name}</div>
                          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11 }}>
                            {span === 1 ? formatDate(days[seg.startIndex]) : `${formatDate(days[seg.startIndex])} – ${formatDate(days[seg.endIndex])}`}
                          </div>
                          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, marginTop: 2, color: '#D9CBFB' }}>{seg.lastStatus}</div>
                        </div>,
                        document.body,
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
