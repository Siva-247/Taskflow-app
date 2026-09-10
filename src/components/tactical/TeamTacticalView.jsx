import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { ROLES } from '../../data/mockData.js';
import { Card, Select, Avatar } from '../ui.jsx';
import DatePicker from '../DatePicker.jsx';
import {
  IconTaskList, IconCheckCircle, IconPending, IconTarget, IconUsersGroup, IconBarChart, IconLayers, IconClipboard,
} from '../icons.jsx';
import {
  CHART_COLORS, periodPresets, FilterField, MultiSelectField, GenericDonut, KpiCard, SectionTitle, EmptyNote, MemberBarChart,
} from './shared.jsx';
import TeamProjectCalendar from './TeamProjectCalendar.jsx';

const MEMBER_MODE_OPTIONS = [
  { value: 'all', label: 'All Members' },
  { value: 'interns', label: 'Interns' },
  { value: 'developers', label: 'Developers' },
  { value: 'individual', label: 'Individual' },
];

// A donut with 20+ tiny slivers (this app's real Milestone/Project data runs
// that long-tailed — one typo-variant milestone can be its own 1-entry
// category) reads as noise, not a chart. Caps to the top MAX_DONUT_SEGMENTS-1
// by size plus one grouped "Other" slice — display-only: the underlying
// distribution the server sends stays fully itemized, this just decides how
// many of those real categories get their own wedge.
const MAX_DONUT_SEGMENTS = 7;
function capDonutSegments(segments) {
  if (segments.length <= MAX_DONUT_SEGMENTS) return segments;
  const top = segments.slice(0, MAX_DONUT_SEGMENTS - 1);
  const rest = segments.slice(MAX_DONUT_SEGMENTS - 1);
  const restCount = rest.reduce((s, seg) => s + seg.count, 0);
  const restPct = Math.round(rest.reduce((s, seg) => s + seg.pct, 0) * 10) / 10;
  return [...top, { label: `Other (${rest.length} more)`, count: restCount, pct: restPct, color: 'var(--text-muted)' }];
}

// The Team View — a sibling to Individual View, not a rewrite of it. Same
// shared visual pieces (shared.jsx), its own data source
// (GET /tactical/team), and its own filter set. Visible to every
// authenticated role; the server decides the actual scope (own team for an
// Intern/Developer, own department for a Manager, everything for Admin) —
// the filters below only ever narrow whatever that authorized scope is.
//
// Every number on this page is server-computed from live Employees / Daily
// Update History rows for exactly one filtered dataset — no mock/derived
// client-side math, no fixed category lists. See
// backend/routes/tactical.js's getTeamTacticalAnalytics for the single
// source of truth this whole page reads from.
export default function TeamTacticalView({ onSelectMember }) {
  const { currentUser, apiCall, showToast, TODAY } = useApp();
  const canSelectOthers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD].includes(currentUser.role);

  const [teamFilter, setTeamFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  // The Intern/Developer filter is two-tier: pick a whole category in one
  // click (Interns/Developers, resolved server-side from each person's real
  // title — never a client-side guess), or drop into "Individual" to hand-
  // pick specific people via the checkbox list.
  const [memberMode, setMemberMode] = useState('all');
  const [individualSelectedIds, setIndividualSelectedIds] = useState([]);
  const [periodKey, setPeriodKey] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const presets = useMemo(() => periodPresets(TODAY), [TODAY]);
  const preset = presets.find((p) => p.key === periodKey);
  const effectiveFrom = periodKey === 'custom' ? customFrom : preset?.from;
  const effectiveTo = periodKey === 'custom' ? customTo : preset?.to;
  const waitingOnCustomRange = periodKey === 'custom' && !(customFrom && customTo);

  useEffect(() => {
    if (waitingOnCustomRange) return undefined;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (effectiveFrom && effectiveTo) { params.set('from', effectiveFrom); params.set('to', effectiveTo); }
    if (teamFilter !== 'all') params.set('teamId', teamFilter);
    if (departmentFilter !== 'all') params.set('departmentId', departmentFilter);
    if (memberMode === 'interns') params.set('titleGroup', 'intern');
    else if (memberMode === 'developers') params.set('titleGroup', 'developer');
    else if (memberMode === 'individual' && individualSelectedIds.length > 0) params.set('memberIds', individualSelectedIds.join(','));
    apiCall(`/tactical/team?${params.toString()}`)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) showToast('Could not load the team tactical data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, departmentFilter, memberMode, individualSelectedIds, effectiveFrom, effectiveTo, waitingOnCustomRange]);

  // Switching Department (admin only) can strand the Team filter on a team
  // that no longer belongs to it, and strand an Individual selection on
  // people outside the newly scoped roster — reset both rather than
  // silently filtering by ids the new department doesn't recognize.
  useEffect(() => { setTeamFilter('all'); setMemberMode('all'); setIndividualSelectedIds([]); }, [departmentFilter]);
  useEffect(() => { setMemberMode('all'); setIndividualSelectedIds([]); }, [teamFilter]);

  const filterRow = (
    <Card style={{ padding: '18px 22px' }}>
      <div className="stack-mobile" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        {data && data.availableDepartments.length > 1 && (
          <FilterField label="Department">
            <Select value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: 'all', label: 'All Departments' }, ...data.availableDepartments.map((d) => ({ value: d.id, label: d.name }))]} />
          </FilterField>
        )}
        {data && data.availableTeams.length > 1 && (
          <FilterField label="Team">
            <Select value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: 'All Teams' }, ...data.availableTeams.map((t) => ({ value: t.id, label: t.name }))]} />
          </FilterField>
        )}
        {data && data.availableMembers.length > 1 && (
          <FilterField label="Intern / Developer">
            <Select value={memberMode} onChange={setMemberMode} options={MEMBER_MODE_OPTIONS} />
          </FilterField>
        )}
        {data && memberMode === 'individual' && (
          <MultiSelectField
            label="Members" allLabel="Choose members"
            options={data.availableMembers.map((m) => ({ value: m.id, label: `${m.name}${m.title ? ' · ' + m.title : ''}` }))}
            selected={individualSelectedIds} onChange={setIndividualSelectedIds}
          />
        )}
        <FilterField label="Period">
          <Select value={periodKey} onChange={setPeriodKey} options={presets.map((p) => ({ value: p.key, label: p.label }))} />
        </FilterField>
        {periodKey === 'custom' && (
          <>
            <FilterField label="From">
              <DatePicker value={customFrom} onChange={setCustomFrom} />
            </FilterField>
            <FilterField label="To">
              <DatePicker value={customTo} onChange={setCustomTo} min={customFrom} />
            </FilterField>
          </>
        )}
      </div>
    </Card>
  );

  if (waitingOnCustomRange || loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {filterRow}
        <Card>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
            {waitingOnCustomRange ? 'Pick a from and to date to see that range.' : 'Loading…'}
          </div>
        </Card>
      </div>
    );
  }

  const {
    totalInterns, totalEntries, completedEntries, pendingEntries, completionRate,
    memberPerformance, projectDistribution, activityTypeDistribution, timeline,
  } = data;

  const totalActiveDays = projectDistribution.reduce((s, p) => s + p.activeDays, 0);
  const projectSegments = capDonutSegments(projectDistribution.map((p, i) => ({ label: p.label, count: p.activeDays, pct: p.pct, color: CHART_COLORS[i % CHART_COLORS.length] })));
  const activitySegments = capDonutSegments(activityTypeDistribution.map((a, i) => ({ ...a, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] })));

  const canOpenMember = (memberId) => canSelectOthers || memberId === currentUser.id;
  const openMember = (memberId) => { if (canOpenMember(memberId)) onSelectMember(memberId); };

  const filteredMembers = memberPerformance.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'completionRate') return b.completionRate - a.completionRate;
    if (sortKey === 'totalEntries') return b.totalEntries - a.totalEntries;
    if (sortKey === 'pending') return b.pending - a.pending;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {filterRow}

      {/* KPI row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KpiCard icon={<IconUsersGroup size={18} color="var(--accent)" />} value={totalInterns} label="Total Members" />
        <KpiCard icon={<IconTaskList size={18} color="var(--accent)" />} value={totalEntries} label="Total Entries" />
        <KpiCard icon={<IconCheckCircle size={18} color="var(--green-deep)" />} value={completedEntries} label="Completed" />
        <KpiCard icon={<IconPending size={18} color="var(--amber-deep)" />} value={pendingEntries} label="Pending" />
        <KpiCard icon={<IconTarget size={18} color="var(--accent-dark)" />} value={`${completionRate}%`} label="Team Completion Rate" />
      </div>

      {/* Team Performance + Activity Trend */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card padded={false}>
          <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <SectionTitle icon={<IconUsersGroup size={16} color="var(--accent)" />}>Team Performance Overview</SectionTitle>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--surface)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)', width: 120 }}
              />
              <Select value={sortKey} onChange={setSortKey} options={[{ value: 'name', label: 'Sort: Name' }, { value: 'completionRate', label: 'Sort: Completion' }, { value: 'totalEntries', label: 'Sort: Entries' }, { value: 'pending', label: 'Sort: Pending' }]} />
            </div>
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            {sortedMembers.length === 0 ? (
              <div style={{ padding: '0 22px 20px' }}><EmptyNote>No members match.</EmptyNote></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['#', 'Member', 'Total Entries', 'Completed', 'Pending', 'Completion Rate'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, i) => {
                    const clickable = canOpenMember(m.id);
                    return (
                      <tr
                        key={m.id} className="table-glass-row" onClick={clickable ? () => openMember(m.id) : undefined}
                        style={{ cursor: clickable ? 'pointer' : 'default', borderBottom: '1px solid var(--line)' }}
                      >
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <Avatar initial={m.name[0]} size={24} gradient />
                            <span title={m.name} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: clickable ? 'var(--brand)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{m.totalEntries}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--green-deep)' }}>{m.completed}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{m.pending}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{m.totalEntries > 0 ? `${m.completionRate}%` : 'No entries'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<IconBarChart size={16} color="var(--accent)" />}>Team Activity Trend</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            One bar pair per team member — same people, same search/sort, as Team Performance Overview.
          </div>
          <MemberBarChart members={sortedMembers} />
        </Card>
      </div>

      {/* Team's Current Projects — calendar/gantt only, driven entirely by
          this page's own Department/Team/Intern-Developer/Period filters
          (same idea as the Dashboard's ProjectTimelineBoard, no filters of
          its own). */}
      <Card>
        <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Team's Current Projects</SectionTitle>
        <div style={{ marginTop: 14 }}>
          <TeamProjectCalendar timeline={timeline} from={effectiveFrom} to={effectiveTo} today={TODAY} />
        </div>
      </Card>

      {/* Work Distribution + Activity Type */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Work Distribution by Project</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Distinct days the team logged work against each project.
          </div>
          <div style={{ marginTop: 14 }}>
            <GenericDonut segments={projectSegments} centerLabel="Active Days" centerValue={totalActiveDays} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={<IconClipboard size={16} color="var(--accent)" />}>Activity Type</SectionTitle>
          <div style={{ marginTop: 14 }}>
            <GenericDonut segments={activitySegments} centerLabel="Total Entries" centerValue={totalEntries} />
          </div>
        </Card>
      </div>
    </div>
  );
}
