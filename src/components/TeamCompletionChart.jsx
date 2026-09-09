import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Card, Avatar, Select } from './ui.jsx';
import DatePicker from './DatePicker.jsx';
import { IconBarChart } from './icons.jsx';
import { formatDate } from '../utils.js';

// Grouped bar chart, hand-rolled with plain divs (same reasoning Donut.jsx
// uses SVG arcs for its own shape — a straight bar doesn't need SVG at all).
// One column per team member: a taller "Total" bar next to a "Completed"
// bar, scaled against the largest total in the visible set. Fed by
// AppContext's `memberStats` for the default "All time" range (see GET
// /daily-updates/member-stats) — a non-default date range is fetched fresh
// from that same endpoint, since the aggregate itself changes per range, not
// just which rows are shown; the server-side role scoping (team/department)
// is identical either way.
const CHART_HEIGHT = 160;
const GRID_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

function daysAgo(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function startOfMonth(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function datePresets(today) {
  return [
    { key: 'all', label: 'All time', from: null, to: null },
    { key: 'today', label: 'Today', from: today, to: today },
    { key: '7d', label: 'Last 7 days', from: daysAgo(today, 6), to: today },
    { key: 'month', label: 'This month', from: startOfMonth(today), to: today },
    { key: 'custom', label: 'Custom range', from: null, to: null },
  ];
}

// Green/amber/muted reuse the app's existing semantic tones rather than
// introducing a new color — same idea as StatusBadge's palette, just applied
// to a computed percentage instead of an enum.
function rateColor(pct) {
  if (pct >= 75) return 'var(--accent-dark)';
  if (pct >= 40) return 'var(--accent)';
  return 'var(--amber-text)';
}

function FilterField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

function StatChip({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 19, color: accent || 'var(--heading)' }}>{value}</div>
      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function MemberColumn({ member, max, hovered, onHover }) {
  const pct = member.total ? Math.round((member.completed / member.total) * 100) : 0;
  const totalPct = max > 0 ? Math.max((member.total / max) * 100, member.total > 0 ? 4 : 0) : 0;
  const completedPct = max > 0 ? Math.max((member.completed / max) * 100, member.completed > 0 ? 4 : 0) : 0;

  return (
    <div
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 9px', position: 'relative', flexShrink: 0, width: 74 }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', bottom: CHART_HEIGHT + 30, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--heading)', color: '#FFFFFF', borderRadius: 8, padding: '9px 13px',
          whiteSpace: 'nowrap', zIndex: 3, boxShadow: '0 8px 20px -8px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, marginBottom: 5 }}>{member.name}</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 11 }}>Total entries: {member.total}</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 11 }}>Completed: {member.completed}</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, marginTop: 2, color: '#D9CBFB' }}>{pct}% completion rate</div>
        </div>
      )}

      <div style={{ height: 18, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>{member.total || ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 5, height: CHART_HEIGHT, alignItems: 'flex-end' }}>
        <div style={{ width: 16, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', height: `${totalPct}%`, borderRadius: '4px 4px 0 0', background: 'var(--accent-deep)', transition: 'height 200ms ease' }} />
        </div>
        <div style={{ width: 16, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', height: `${completedPct}%`, borderRadius: '4px 4px 0 0', background: 'var(--accent)', transition: 'height 200ms ease' }} />
        </div>
      </div>
      <Avatar initial={member.name?.[0] || '?'} size={22} />
      <div style={{
        fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)',
        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%',
      }}>
        {member.name}
      </div>
      <div style={{
        fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, color: rateColor(pct),
        background: 'var(--neutral-bg)', padding: '2px 8px', borderRadius: 999,
      }}>
        {pct}%
      </div>
    </div>
  );
}

// Groups already-sorted (by department, then name) members into
// contiguous {name, members} sections, each sized to how many columns it
// spans — used to draw the department "bracket" row under the chart.
function groupSections(sortedMembers, groupByDepartment) {
  if (!groupByDepartment) return [{ name: null, members: sortedMembers }];
  const sections = [];
  for (const m of sortedMembers) {
    const last = sections[sections.length - 1];
    if (last && last.name === (m.departmentName || 'Unassigned')) last.members.push(m);
    else sections.push({ name: m.departmentName || 'Unassigned', members: [m] });
  }
  return sections;
}

export default function TeamCompletionChart({ title, members, today, groupByDepartment = false }) {
  const { apiCall, showToast } = useApp();
  const [hovered, setHovered] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rangeMembers, setRangeMembers] = useState(null);
  const [loading, setLoading] = useState(false);
  const presets = useMemo(() => datePresets(today), [today]);

  // The effective range for whatever's currently selected — a preset's own
  // from/to, or the two date pickers once both are filled in for "Custom".
  const activeRange = datePreset === 'custom'
    ? (customFrom && customTo ? { from: customFrom, to: customTo } : null)
    : presets.find((p) => p.key === datePreset);

  useEffect(() => {
    if (datePreset === 'all' || !activeRange || !activeRange.from) { setRangeMembers(null); return undefined; }
    let cancelled = false;
    const fetchStats = (showSpinner) => {
      if (showSpinner) setLoading(true);
      return apiCall(`/daily-updates/member-stats?from=${activeRange.from}&to=${activeRange.to}`)
        .then((r) => { if (!cancelled) setRangeMembers(r.members || []); })
        .catch(() => { if (!cancelled && showSpinner) showToast('Could not load that date range'); })
        .finally(() => { if (!cancelled && showSpinner) setLoading(false); });
    };
    fetchStats(true);
    // Same reasoning as ProjectTimelineBoard's own poll — no push channel,
    // so a short silent refresh is what keeps this range's numbers current
    // as new entries land instead of only on the next filter change.
    const interval = window.setInterval(() => fetchStats(false), 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, activeRange?.from, activeRange?.to]);

  // Role dropdown options come from the full all-time roster, not the
  // currently-filtered set, so the list itself doesn't shuffle/shrink as the
  // date range narrows.
  const roleOptions = useMemo(() => [...new Set(members.map((m) => m.title).filter(Boolean))].sort(), [members]);

  const waitingOnCustomRange = datePreset === 'custom' && !(customFrom && customTo);
  const baseMembers = datePreset === 'all' ? members : (rangeMembers || []);
  const visible = (roleFilter === 'all' ? baseMembers : baseMembers.filter((m) => m.title === roleFilter))
    .slice()
    .sort((a, b) => {
      if (groupByDepartment) {
        const byDept = (a.departmentName || '').localeCompare(b.departmentName || '');
        if (byDept !== 0) return byDept;
      }
      return b.total - a.total || a.name.localeCompare(b.name);
    });
  const sections = groupSections(visible, groupByDepartment);

  const max = Math.max(1, ...visible.map((m) => m.total));
  const totalEntries = visible.reduce((sum, m) => sum + m.total, 0);
  const completedEntries = visible.reduce((sum, m) => sum + m.completed, 0);
  const completionRate = totalEntries ? Math.round((completedEntries / totalEntries) * 100) : 0;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconBarChart size={17} color="var(--accent)" />
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>{title}</div>
      </div>
      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
        Every daily update entry counts as one, completed entries counted separately.
      </div>

      <div className="stack-mobile" style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 18 }}>
        <StatChip label="Total entries" value={totalEntries} />
        <StatChip label="Completed" value={completedEntries} />
        <StatChip label="Completion rate" value={`${completionRate}%`} accent={rateColor(completionRate)} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', alignItems: 'flex-end' }}>
        <FilterField label="Role">
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            options={[{ value: 'all', label: 'All roles' }, ...roleOptions.map((t) => ({ value: t, label: t }))]}
          />
        </FilterField>

        <FilterField label="Date range">
          <Select
            value={datePreset}
            onChange={(v) => { setDatePreset(v); if (v !== 'custom') { setCustomFrom(''); setCustomTo(''); } }}
            options={presets.map((p) => ({ value: p.key, label: p.label }))}
          />
        </FilterField>

        {datePreset === 'custom' && (
          <>
            <FilterField label="From">
              <DatePicker value={customFrom} onChange={setCustomFrom} />
            </FilterField>
            <FilterField label="To">
              <DatePicker value={customTo} onChange={setCustomTo} min={customFrom} />
            </FilterField>
          </>
        )}

        {activeRange?.from && activeRange?.to && (
          <div style={{
            fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--accent-dark)',
            background: 'var(--accent-soft)', padding: '7px 13px', borderRadius: 999, marginBottom: 1,
          }}>
            {formatDate(activeRange.from)} – {formatDate(activeRange.to)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 20 }}>
        <Legend color="var(--accent-deep)" label="Total entries" />
        <Legend color="var(--accent)" label="Completed" />
      </div>

      {waitingOnCustomRange ? (
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '30px 0 6px', textAlign: 'center' }}>
          Pick a from and to date to see that range.
        </div>
      ) : loading ? (
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '30px 0 6px', textAlign: 'center' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)', padding: '30px 0 6px', textAlign: 'center' }}>
          Nobody in scope matches these filters.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', minWidth: visible.length * 74 + 38, paddingLeft: 38 }}>
            <div style={{ position: 'absolute', left: 0, top: 26, width: '100%', height: CHART_HEIGHT, pointerEvents: 'none' }}>
              {GRID_FRACTIONS.map((f) => (
                <div key={f} style={{ position: 'absolute', left: 38, right: 0, bottom: `${f * CHART_HEIGHT}px`, borderTop: '1px dashed var(--border)' }}>
                  <span style={{ position: 'absolute', left: -38, bottom: -6, width: 32, textAlign: 'right', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 10, color: 'var(--text-muted)' }}>
                    {Math.round(max * f)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
              {sections.map((section, si) => (
                <div
                  key={section.name || 'all'}
                  style={{ display: 'flex', alignItems: 'flex-end', borderLeft: si > 0 ? '1px dashed var(--border)' : 'none', paddingLeft: si > 0 ? 6 : 0, marginLeft: si > 0 ? 6 : 0 }}
                >
                  {section.members.map((m) => (
                    <MemberColumn key={m.id} member={m} max={max} hovered={hovered === m.id} onHover={setHovered} />
                  ))}
                </div>
              ))}
            </div>
            {groupByDepartment && (
              <div style={{ display: 'flex', marginTop: 8 }}>
                {sections.map((section, si) => (
                  <div
                    key={section.name || 'all'}
                    style={{
                      width: section.members.length * 74, textAlign: 'center', paddingTop: 6,
                      borderTop: '2px solid var(--accent)', marginLeft: si > 0 ? 6 : 0,
                    }}
                  >
                    <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--accent-dark)' }}>
                      {section.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}
