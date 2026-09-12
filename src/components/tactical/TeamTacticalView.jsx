import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { ROLES } from '../../data/mockData.js';
import { Card, Select, Avatar } from '../ui.jsx';
import DatePicker from '../DatePicker.jsx';
import {
  IconTaskList, IconCheckCircle, IconPending, IconTarget, IconUsersGroup, IconBarChart, IconLayers, IconClipboard,
  IconAlertTriangle, IconBlock, IconChecklist, IconPlus, IconCheck,
} from '../icons.jsx';
import {
  CHART_COLORS, periodPresets, FilterField, MultiSelectField, GenericDonut, TrendBarChart, KpiCard, SectionTitle, EmptyNote,
} from './shared.jsx';
import TeamProjectCalendar from './TeamProjectCalendar.jsx';
import KpiScorecard from './KpiScorecard.jsx';

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

function ActionItemsPanel({ departmentId, canManage }) {
  const { apiCall, showToast } = useApp();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    const q = departmentId ? `?departmentId=${departmentId}` : '';
    apiCall(`/tactical/action-items${q}`).then((r) => setItems(r.items || [])).catch(() => showToast('Could not load action items'));
  };
  useEffect(load, [departmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await apiCall('/tactical/action-items', { method: 'POST', body: JSON.stringify({ departmentId, action: trimmed }) });
      setDraft('');
      load();
    } catch (err) {
      showToast(err?.message || 'Could not add that action item');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    const nextStatus = item.status === 'Completed' ? 'Open' : 'Completed';
    try {
      await apiCall(`/tactical/action-items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      load();
    } catch (err) {
      showToast(err?.message || 'Could not update that item');
    }
  };

  return (
    <Card>
      <SectionTitle icon={<IconChecklist size={16} color="var(--accent)" />}>Action Items</SectionTitle>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14 }}>
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Add an action item for this meeting…"
            style={{ flex: 1, padding: '9px 13px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--field-bg)', fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-primary)' }}
          />
          <button
            type="button" onClick={add} disabled={saving || !draft.trim()}
            className="btn-3d" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: 0, borderRadius: 9, background: 'var(--brand-grad)', color: '#FFFFFF', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            <IconPlus size={12} /> Add
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyNote>No action items logged yet{canManage ? ' — add one above.' : '.'}</EmptyNote>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              {canManage && (
                <button
                  type="button" onClick={() => toggleStatus(item)} title={item.status === 'Completed' ? 'Mark open' : 'Mark completed'}
                  style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${item.status === 'Completed' ? 'var(--green-deep)' : 'var(--line)'}`,
                    background: item.status === 'Completed' ? 'var(--accent-soft)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  {item.status === 'Completed' && <IconCheck size={11} color="var(--green-deep)" />}
                </button>
              )}
              <span style={{
                flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5,
                color: item.status === 'Completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: item.status === 'Completed' ? 'line-through' : 'none',
              }}>
                {item.action}
              </span>
              {item.ownerName && <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.ownerName}</span>}
              {item.dueDate && <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.dueDate}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
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
// source of truth this whole page reads from. "Dashboard Risk Rule" and
// derived Project Health status are explicitly disclosed as dashboard-side
// heuristics, not official company KPIs — see the tooltips on those
// sections.
// Sections a viewer can jump straight to — a lightweight stand-in for the
// separate Projects/KPI-Scorecard/Blockers/Reports pages a full nav rail
// would need; this page already has all of that data in one place, so
// "navigating" there is just scrolling to the right anchor instead of a
// fresh page load. Reports is the one genuinely separate page in the app.
const QUICK_NAV = [
  { id: 'section-team-performance', label: 'Team' },
  { id: 'section-kpi-scorecard', label: 'KPI / Scorecard' },
  { id: 'section-blockers', label: 'Blockers' },
];

export default function TeamTacticalView({ onSelectMember }) {
  const { currentUser, apiCall, showToast, TODAY } = useApp();
  const navigate = useNavigate();
  const canSelectOthers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD].includes(currentUser.role);
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [teamFilter, setTeamFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [memberMode, setMemberMode] = useState('all');
  const [individualSelectedIds, setIndividualSelectedIds] = useState([]);
  const [periodKey, setPeriodKey] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState(null);

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

  const reloadKpiScorecards = () => {
    if (!effectiveFrom || !effectiveTo) return;
    apiCall(`/tactical/kpi-scorecard?from=${effectiveFrom}&to=${effectiveTo}`)
      .then((r) => setKpiData(r))
      .catch(() => showToast('Could not load KPI scorecards'));
  };
  useEffect(() => {
    reloadKpiScorecards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFrom, effectiveTo]);

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
    overdueCount, notDueCount, delayedCount, taskGap,
    memberPerformance, projectDistribution, activityTypeDistribution, timeline,
    roleComparison, workloadStatus, deliveryTrend,
    whoNeedsAttention, blockerSummary, keyInsights, focusAreas,
  } = data;

  const totalActiveDays = projectDistribution.reduce((s, p) => s + p.activeDays, 0);
  const projectSegments = capDonutSegments(projectDistribution.map((p, i) => ({ label: p.label, count: p.activeDays, pct: p.pct, color: CHART_COLORS[i % CHART_COLORS.length] })));
  const activitySegments = capDonutSegments(activityTypeDistribution.map((a, i) => ({ ...a, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] })));
  const workloadSegments = capDonutSegments(workloadStatus.map((w, i) => ({ ...w, color: CHART_COLORS[i % CHART_COLORS.length] })));

  const onTimeSamples = memberPerformance.filter((m) => m.onTimeRate !== null);
  const avgOnTimeRate = onTimeSamples.length > 0
    ? Math.round((onTimeSamples.reduce((s, m) => s + m.onTimeRate, 0) / onTimeSamples.length) * 10) / 10
    : null;

  const canOpenMember = (memberId) => canSelectOthers || memberId === currentUser.id;
  const openMember = (memberId) => { if (canOpenMember(memberId)) onSelectMember(memberId); };

  const filteredMembers = memberPerformance.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'completionRate') return b.completionRate - a.completionRate;
    if (sortKey === 'totalEntries') return b.totalEntries - a.totalEntries;
    if (sortKey === 'overdue') return b.overdue - a.overdue;
    return 0;
  });

  const trendSeries = [
    { key: 'created', color: 'var(--brand-grad-raised)', label: 'Created' },
    { key: 'completed', color: 'var(--green-deep)', label: 'Completed' },
    { key: 'overdue', color: 'var(--red-deep)', label: 'Overdue' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {filterRow}

      {/* Quick-nav strip — same section groupings the reference mockup's
          nav rail uses (Team / KPI-Scorecard / Projects / Blockers /
          Reports), implemented as anchor-scroll within this one page rather
          than separate routed pages, since every section already shares the
          same fetch/filter above. */}
      <div className="btn-3d btn-glass" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 5, borderRadius: 999, alignSelf: 'flex-start' }}>
        {QUICK_NAV.map((s) => (
          <button
            key={s.id} type="button" onClick={() => scrollToSection(s.id)}
            style={{ padding: '7px 14px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button" onClick={() => navigate('/reports')}
          style={{ padding: '7px 14px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          Reports
        </button>
      </div>

      {/* KPI row — only real, server-computed numbers; every card traces to
          a field in getTeamTacticalAnalytics's response. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KpiCard icon={<IconUsersGroup size={18} color="var(--accent)" />} value={totalInterns} label="Team Members" />
        <KpiCard icon={<IconTaskList size={18} color="var(--accent)" />} value={totalEntries} label="Planned Work" />
        <KpiCard icon={<IconCheckCircle size={18} color="var(--green-deep)" />} value={completedEntries} label="Completed" />
        <KpiCard icon={<IconTarget size={18} color="var(--accent-dark)" />} value={`${completionRate}%`} label="Target Attainment" />
        <KpiCard icon={<IconTarget size={18} color="var(--accent-dark)" />} value={avgOnTimeRate !== null ? `${avgOnTimeRate}%` : '—'} label="On-Time Delivery" />
        <KpiCard icon={<IconAlertTriangle size={18} />} value={overdueCount} label="Overdue" tone={overdueCount > 0 ? 'danger' : undefined} />
        <KpiCard icon={<IconBlock size={18} />} value={blockerSummary.openCount} label="Open Blockers" tone={blockerSummary.openCount > 0 ? 'danger' : undefined} />
        <KpiCard icon={<IconUsersGroup size={18} color="var(--amber-text)" />} value={whoNeedsAttention.length} label="People at Risk" />
      </div>

      {/* Team Delivery Performance + role comparison, side by side. */}
      <div id="section-team-performance" className="responsive-grid" style={{ display: 'grid', '--cols': '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card padded={false}>
          <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <SectionTitle icon={<IconUsersGroup size={16} color="var(--accent)" />}>Team Delivery Performance</SectionTitle>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--surface)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)', width: 120 }}
              />
              <Select value={sortKey} onChange={setSortKey} options={[{ value: 'name', label: 'Sort: Name' }, { value: 'completionRate', label: 'Sort: Attainment' }, { value: 'totalEntries', label: 'Sort: Total' }, { value: 'overdue', label: 'Sort: Overdue' }]} />
            </div>
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            {sortedMembers.length === 0 ? (
              <div style={{ padding: '0 22px 20px' }}><EmptyNote>No members match.</EmptyNote></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['#', 'Member', 'Total', 'Completed', 'Attainment', 'Overdue', 'Delayed'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m, i) => {
                    const clickable = canOpenMember(m.id);
                    return (
                      <tr key={m.id} className="table-glass-row" onClick={clickable ? () => openMember(m.id) : undefined} style={{ cursor: clickable ? 'pointer' : 'default', borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <Avatar initial={m.name[0]} size={24} gradient />
                            <span title={m.name} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: clickable ? 'var(--brand)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{m.totalEntries}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--green-deep)' }}>{m.completed}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{m.totalEntries > 0 ? `${m.completionRate}%` : '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: m.overdue > 0 ? 'var(--red-deep)' : 'var(--text-muted)' }}>{m.overdue || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: m.delayed > 0 ? 'var(--amber-text)' : 'var(--text-muted)' }}>{m.delayed || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<IconUsersGroup size={16} color="var(--accent)" />}>Team Lead vs Developer</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            Averaged from real completion/on-time rates, grouped by KPI role.
          </div>
          {roleComparison.length === 0 ? <EmptyNote>No KPI-roster members in view.</EmptyNote> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {roleComparison.map((r) => (
                <div key={r.role}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>{r.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({r.memberCount})</span></span>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{r.avgCompletionRate}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ width: `${r.avgCompletionRate}%`, height: '100%', borderRadius: 999, background: 'var(--brand-grad-raised)' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 10.5, color: 'var(--text-muted)' }}>
                    On-time: {r.avgOnTimeRate !== null ? `${r.avgOnTimeRate}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* KPI Scorecards — the AI department's role-weighted designation
          scorecard (see kpiMatrix.js), only ever shown for the fixed
          8-person roster who also fall inside the current filters. */}
      {(() => {
        const visibleMemberIds = new Set(data.availableMembers.map((m) => m.id));
        const visibleScorecards = (kpiData?.scorecards || []).filter((s) => visibleMemberIds.has(s.userId));
        if (visibleScorecards.length === 0) return null;

        const scored = visibleScorecards.filter((s) => s.weightedScore !== null);
        const avgScore = scored.length > 0
          ? Math.round((scored.reduce((sum, s) => sum + s.weightedScore, 0) / scored.length) * 10) / 10
          : null;
        const onTrackCount = scored.filter((s) => s.weightedScore >= 90).length;
        const needsAttentionCount = scored.filter((s) => s.weightedScore < 75).length;
        const avgWeightMeasured = Math.round(
          (visibleScorecards.reduce((sum, s) => sum + s.weightMeasuredPct, 0) / visibleScorecards.length) * 10,
        ) / 10;

        return (
          <Card id="section-kpi-scorecard">
            <SectionTitle icon={<IconTarget size={16} color="var(--accent)" />}>KPI / Scorecard</SectionTitle>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
              Role-weighted scorecards for the selected period — missing inputs show "—", never 0%. "% of weight measured" shows how much of the formula has real data behind it.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
              <KpiCard icon={<IconTarget size={18} color="var(--accent-dark)" />} value={avgScore !== null ? `${avgScore}%` : '—'} label="Measured KPI Score" />
              <KpiCard icon={<IconCheckCircle size={18} color="var(--green-deep)" />} value={onTrackCount} label="On Target" />
              <KpiCard icon={<IconAlertTriangle size={18} />} value={needsAttentionCount} label="Needs Attention" tone={needsAttentionCount > 0 ? 'danger' : undefined} />
              <KpiCard icon={<IconClipboard size={18} color="var(--accent)" />} value={`${avgWeightMeasured}%`} label="Data Completeness" />
            </div>

            <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 14 }}>
              {visibleScorecards.map((s) => (
                <KpiScorecard key={s.userId} scorecard={s} />
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Delivery Trend + Workload/Status */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.4fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card>
          <SectionTitle icon={<IconBarChart size={16} color="var(--accent)" />}>Delivery Trend</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            Weekly buckets — Created (logged), Completed (closed), Overdue (due that week, still open today).
          </div>
          {deliveryTrend.length === 0 ? <EmptyNote>Insufficient data for a trend in this range.</EmptyNote> : (
            <TrendBarChart buckets={deliveryTrend} series={trendSeries} granularity="weekly" />
          )}
        </Card>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Workload / Status</SectionTitle>
          <div style={{ marginTop: 14 }}>
            {workloadSegments.length === 0 ? <EmptyNote>No data in this range.</EmptyNote> : (
              <GenericDonut segments={workloadSegments} centerLabel="Total Work" centerValue={totalEntries} />
            )}
          </div>
        </Card>
      </div>

      {/* Blockers & Escalations */}
      <Card id="section-blockers" padded={false}>
          <div style={{ padding: '20px 22px 0' }}>
            <SectionTitle icon={<IconBlock size={16} />}>Blockers & Escalations</SectionTitle>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 22px 0' }}>
            <KpiCard icon={<IconBlock size={16} />} value={blockerSummary.openCount} label="Total Open" tone={blockerSummary.openCount > 0 ? 'danger' : undefined} />
            {blockerSummary.byEscalation.map((e) => (
              <KpiCard key={e.level} icon={<IconAlertTriangle size={16} />} value={e.count} label={e.level} />
            ))}
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            {blockerSummary.blockers.length === 0 ? (
              <div style={{ padding: '0 22px 20px' }}><EmptyNote>No blockers raised in this range.</EmptyNote></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['Project', 'Member', 'Blocking', 'Owner', 'Days Open', 'Escalation', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blockerSummary.blockers.map((b) => (
                    <tr key={b.id} className="table-glass-row" style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{b.project}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{b.memberName}</td>
                      <td title={b.blockingWhat} style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.blockingWhat}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{b.ownerName}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{b.daysOpen}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{b.escalationLevel}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: b.status === 'Open' || b.status === 'In Progress' ? 'var(--amber-text)' : 'var(--green-deep)' }}>{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

      {/* Key Insights + Focus Areas — auto-generated strings, built only
          from numbers already computed above. */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconAlertTriangle size={16} color="var(--amber-text)" />}>Key Insights</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {keyInsights.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>{line}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle icon={<IconTarget size={16} color="var(--accent)" />}>Focus Areas for the Meeting</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {focusAreas.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--brand)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
                }}>{i + 1}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{line}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ActionItemsPanel departmentId={departmentFilter !== 'all' ? departmentFilter : (data.availableDepartments[0]?.id || null)} canManage={canSelectOthers} />

      {/* Team's Current Projects — calendar/gantt only, driven entirely by
          this page's own Department/Team/Intern-Developer/Period filters. */}
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
