import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { ROLES } from '../../data/mockData.js';
import { Card, Select, Avatar } from '../ui.jsx';
import DatePicker from '../DatePicker.jsx';
import {
  IconTaskList, IconCheckCircle, IconPending, IconTarget, IconAlertTriangle, IconUsersGroup,
  IconBarChart, IconLayers, IconClipboard, IconCheck, IconChat,
} from '../icons.jsx';
import { formatDate } from '../../utils.js';
import {
  CHART_COLORS, periodPresets, FilterField, GenericDonut, KpiCard, SectionTitle, EmptyNote, DailyStatusPill,
} from './shared.jsx';

const ATTENTION_TONE = {
  healthy: { color: 'var(--green-deep)', dot: 'var(--green)', label: 'Healthy' },
  attention: { color: 'var(--amber-text)', dot: 'var(--amber-fill)', label: 'Attention' },
  critical: { color: 'var(--red-deep)', dot: 'var(--red)', label: 'Critical' },
};
function AttentionDot({ level, reason }) {
  const tone = ATTENTION_TONE[level] || ATTENTION_TONE.healthy;
  return (
    <span title={reason} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'help' }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: tone.dot, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: tone.color }}>{tone.label}</span>
    </span>
  );
}

const SEVERITY_TONE = { high: { bg: 'rgba(225,29,72,.10)', fg: 'var(--red-deep)', dot: 'var(--red)' }, medium: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)', dot: 'var(--amber-fill)' }, low: { bg: 'var(--surface)', fg: 'var(--text-secondary)', dot: 'var(--text-muted)' } };
function AttentionRow({ item }) {
  const tone = SEVERITY_TONE[item.severity] || SEVERITY_TONE.low;
  return (
    <div className="table-glass-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--heading)' }}>{item.title}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.detail}</div>
      </div>
    </div>
  );
}

const HEAT_TONE = { logged: 'var(--green)', blocked: 'var(--red)', none: 'var(--track-bg)' };
function heatmapDayLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// The Team View — a sibling to Individual View, not a rewrite of it. Same
// shared visual pieces (shared.jsx), its own data source
// (GET /tactical/team), and its own filter set. Visible to every
// authenticated role; the server decides the actual scope (own team for an
// Intern/Developer, own department for a Manager, everything for Admin) —
// the filters below only ever narrow whatever that authorized scope is.
export default function TeamTacticalView({ onSelectMember }) {
  const { currentUser, apiCall, showToast, TODAY } = useApp();
  const navigate = useNavigate();
  const canSelectOthers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD].includes(currentUser.role);

  const [teamFilter, setTeamFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [projectOptions, setProjectOptions] = useState([]);
  const [periodKey, setPeriodKey] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [trendGranularity, setTrendGranularity] = useState('weekly');
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
    if (projectFilter !== 'all') params.set('project', projectFilter);
    apiCall(`/tactical/team?${params.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        // Only refresh the Project filter's own option list from an
        // unfiltered-by-project response — otherwise picking a project
        // would collapse the dropdown down to just that one option.
        if (projectFilter === 'all') setProjectOptions(r.projectDistribution.map((p) => p.label));
      })
      .catch(() => { if (!cancelled) showToast('Could not load the team tactical data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, departmentFilter, projectFilter, effectiveFrom, effectiveTo, waitingOnCustomRange]);

  // Switching Department (admin only) can strand the Team filter on a team
  // that no longer belongs to it — reset rather than silently keep filtering
  // by an id the new department doesn't recognize.
  useEffect(() => { setTeamFilter('all'); }, [departmentFilter]);

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
        {projectOptions.length > 1 && (
          <FilterField label="Project">
            <Select value={projectFilter} onChange={setProjectFilter} options={[{ value: 'all', label: 'All Projects' }, ...projectOptions.map((p) => ({ value: p, label: p }))]} />
          </FilterField>
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
    totalMembers, totalUpdates, completed, pending, completionRate, memberPerformance, managerAttention,
    activityTrend, projectDistribution, activityTypeDistribution, deliveryReliability, taskHealth,
    recentDeliveries, developmentJourney, heatmap, discussionPrompts,
  } = data;

  const trendBuckets = activityTrend[trendGranularity] || [];
  const trendMax = Math.max(1, ...trendBuckets.map((b) => b.total));

  const projectSegments = projectDistribution.map((p, i) => ({ ...p, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const activitySegments = activityTypeDistribution.map((a, i) => ({ ...a, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] }));
  const reliabilitySegments = [
    { label: 'On Time', count: deliveryReliability.onTime, color: 'var(--green)' },
    { label: '1–2 Days Late', count: deliveryReliability.oneToTwoDaysLate, color: 'var(--amber)' },
    { label: '3+ Days Late', count: deliveryReliability.threePlusDaysLate, color: 'var(--red)' },
  ].filter((s) => s.count > 0).map((s) => ({ ...s, pct: Math.round((s.count / Math.max(1, deliveryReliability.onTime + deliveryReliability.oneToTwoDaysLate + deliveryReliability.threePlusDaysLate)) * 1000) / 10 }));
  const healthSegments = [
    { label: 'Healthy', count: taskHealth.healthy, color: 'var(--green)' },
    { label: 'Attention', count: taskHealth.attention, color: 'var(--amber)' },
    { label: 'Blocked', count: taskHealth.blocked, color: 'var(--red)' },
    { label: 'Pending', count: taskHealth.pending, color: 'var(--blue)' },
  ].filter((s) => s.count > 0).map((s) => ({ ...s, pct: Math.round((s.count / Math.max(1, taskHealth.total)) * 1000) / 10 }));
  const maxProjectCount = Math.max(1, ...projectDistribution.map((p) => p.count));
  const maxSkillCount = Math.max(1, ...developmentJourney.map((s) => s.memberCount));

  const canOpenMember = (memberId) => canSelectOthers || memberId === currentUser.id;
  const openMember = (memberId) => { if (canOpenMember(memberId)) onSelectMember(memberId); };

  const filteredMembers = memberPerformance.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'completionRate') return b.completionRate - a.completionRate;
    if (sortKey === 'total') return b.total - a.total;
    if (sortKey === 'pending') return b.pending - a.pending;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {filterRow}

      {/* KPI row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KpiCard icon={<IconUsersGroup size={18} color="var(--accent)" />} value={totalMembers} label="Total Members" />
        <KpiCard icon={<IconTaskList size={18} color="var(--accent)" />} value={totalUpdates} label="Total Updates" />
        <KpiCard icon={<IconCheckCircle size={18} color="var(--green-deep)" />} value={completed} label="Completed" />
        <KpiCard icon={<IconPending size={18} color="var(--amber-deep)" />} value={pending} label="Pending" />
        <KpiCard icon={<IconTarget size={18} color="var(--accent-dark)" />} value={`${completionRate}%`} label="Team Completion" />
        <KpiCard icon={<IconAlertTriangle size={18} color="var(--red-deep)" />} value={managerAttention.length} label="Need Attention" tone={managerAttention.length > 0 ? 'danger' : undefined} />
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
              <Select value={sortKey} onChange={setSortKey} options={[{ value: 'name', label: 'Sort: Name' }, { value: 'completionRate', label: 'Sort: Completion' }, { value: 'total', label: 'Sort: Updates' }, { value: 'pending', label: 'Sort: Pending' }]} />
            </div>
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            {sortedMembers.length === 0 ? (
              <div style={{ padding: '0 22px 20px' }}><EmptyNote>No members match.</EmptyNote></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['#', 'Member', 'Department', 'Updates', 'Completed', 'Pending', 'Completion %', 'Attention'].map((h) => (
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
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar initial={m.name[0]} size={24} gradient />
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: clickable ? 'var(--brand)' : 'var(--text-primary)' }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{m.departmentName || '—'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{m.total}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--green-deep)' }}>{m.completed}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{m.pending}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{m.completionRate}%</td>
                        <td style={{ padding: '10px 14px' }}><AttentionDot level={m.attentionLevel} reason={m.attentionReason} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle icon={<IconBarChart size={16} color="var(--accent)" />}>Team Activity Trend</SectionTitle>
            <Select value={trendGranularity} onChange={setTrendGranularity} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
          </div>
          {trendBuckets.length === 0 ? (
            <EmptyNote>No activity logged in this range.</EmptyNote>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-deep)' }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>Total Updates</span></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-mid)' }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>Completed</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, overflowX: 'auto' }}>
                {trendBuckets.map((b) => (
                  <div key={b.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto', width: 44 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
                      <div className="anim-scale-in" style={{ width: 14, height: Math.max(4, (b.total / trendMax) * 90), borderRadius: '4px 4px 1px 1px', background: 'var(--accent-deep)' }} />
                      <div className="anim-scale-in" style={{ width: 14, height: Math.max(4, (b.completed / trendMax) * 90), borderRadius: '4px 4px 1px 1px', background: 'var(--accent-mid)' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Work Distribution + Activity Type + Delivery Reliability */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Work Distribution</SectionTitle>
          <div style={{ marginTop: 14 }}>
            <GenericDonut segments={projectSegments} centerLabel="Total Activity" centerValue={totalUpdates} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={<IconClipboard size={16} color="var(--accent)" />}>Activity Type</SectionTitle>
          <div style={{ marginTop: 14 }}>
            <GenericDonut segments={activitySegments} centerLabel="Total Activity" centerValue={totalUpdates} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={<IconCheck size={16} color="var(--accent)" />}>Delivery Reliability</SectionTitle>
          <div style={{ marginTop: 14 }}>
            {reliabilitySegments.length === 0 ? <EmptyNote>Insufficient data for completed deliveries in this range.</EmptyNote> : (
              <GenericDonut segments={reliabilitySegments} centerLabel="On Time" centerValue={deliveryReliability.onTimePct != null ? `${deliveryReliability.onTimePct}%` : '—'} />
            )}
          </div>
          {deliveryReliability.insufficientData > 0 && (
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              {deliveryReliability.insufficientData} completed with insufficient date data.
            </div>
          )}
        </Card>
      </div>

      {/* Team Heatmap + Manager Attention */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card padded={false}>
          <div style={{ padding: '20px 22px 0' }}>
            <SectionTitle icon={<IconBarChart size={16} color="var(--accent)" />}>Team Activity Heatmap <span style={{ fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>(last 7 days)</span></SectionTitle>
          </div>
          <div className="table-scroll" style={{ padding: '14px 22px 20px' }}>
            {heatmap.length === 0 ? <EmptyNote>No members in scope.</EmptyNote> : (
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, color: 'var(--text-muted)' }}></th>
                    {heatmap[0].days.map((d) => (
                      <th key={d.date} style={{ padding: '4px 8px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{heatmapDayLabel(d.date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row) => (
                    <tr key={row.memberId}>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.memberName}</td>
                      {row.days.map((d) => (
                        <td key={d.date} style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <span title={`${d.date}: ${d.state === 'logged' ? 'Update logged' : d.state === 'blocked' ? 'Linked to an open blocker' : 'Nothing logged'}`} style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 999, background: HEAT_TONE[d.state], border: d.state === 'none' ? '1px solid var(--line)' : 'none' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
              {[['Logged', HEAT_TONE.logged], ['Nothing logged', HEAT_TONE.none], ['Open blocker', HEAT_TONE.blocked]].map(([label, color]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: color, border: color === HEAT_TONE.none ? '1px solid var(--line)' : 'none' }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <SectionTitle icon={<IconAlertTriangle size={16} color="var(--red-deep)" />}>Manager Attention</SectionTitle>
            {managerAttention.length > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(225,29,72,.12)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: 'var(--red-deep)' }}>
                {managerAttention.length} item{managerAttention.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {managerAttention.length === 0 ? (
            <EmptyNote>Nothing needs attention in this range.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {managerAttention.map((item) => <AttentionRow key={item.id} item={item} />)}
            </div>
          )}
        </Card>
      </div>

      {/* Project Activity + Task Health */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Project Activity</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {projectDistribution.map((p, i) => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 150, flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
                  <div className="anim-scale-in" style={{ width: `${(p.count / maxProjectCount) * 100}%`, height: '100%', borderRadius: 999, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <span style={{ width: 34, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--heading)' }}>{p.count}</span>
              </div>
            ))}
            {projectDistribution.length === 0 && <EmptyNote>No data in this range.</EmptyNote>}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<IconClipboard size={16} color="var(--accent)" />}>Team Task Health</SectionTitle>
          <div style={{ marginTop: 14 }}>
            {healthSegments.length === 0 ? <EmptyNote>No data in this range.</EmptyNote> : (
              <GenericDonut segments={healthSegments} centerLabel="Total" centerValue={taskHealth.total} />
            )}
          </div>
        </Card>
      </div>

      {/* Recent Team Deliveries */}
      <Card padded={false}>
        <div style={{ padding: '20px 22px 0' }}>
          <SectionTitle icon={<IconTaskList size={16} color="var(--accent)" />}>Recent Deliveries / Key Activities</SectionTitle>
        </div>
        <div className="table-scroll" style={{ marginTop: 14 }}>
          {recentDeliveries.length === 0 ? (
            <div style={{ padding: '0 22px 20px' }}><EmptyNote>No entries in this range.</EmptyNote></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr className="table-glass-head">
                  {['Task ID', 'Project', 'Task / Deliverable', 'Member', 'Milestone', 'Status', 'Due Date'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((d) => (
                  <tr
                    key={d.id} className="table-glass-row"
                    onClick={d.taskId ? () => navigate(`/tasks/${d.taskId}`) : undefined}
                    style={{ cursor: d.taskId ? 'pointer' : 'default', borderBottom: '1px solid var(--line)' }}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--brand)' }}>{d.displayId}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{d.project}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12.5, color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.deliverable || d.task}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{d.memberName}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{d.milestone}</td>
                    <td style={{ padding: '10px 14px' }}><DailyStatusPill status={d.status} /></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{d.dueDate ? formatDate(d.dueDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Development Journey + Tactical Discussion */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Team Development Journey</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            Skills mentioned in the team's own deliverables — how many members' entries reference each.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {developmentJourney.map((s, i) => (
              <div key={s.skill} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 110, flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{s.skill}</span>
                <div style={{ flex: 1, height: 9, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
                  <div className="anim-scale-in" style={{ width: `${(s.memberCount / maxSkillCount) * 100}%`, height: '100%', borderRadius: 999, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <span style={{ width: 60, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)' }}>{s.memberCount} member{s.memberCount === 1 ? '' : 's'}</span>
              </div>
            ))}
            {developmentJourney.length === 0 && <EmptyNote>No recognized skill keywords found in this range's entries.</EmptyNote>}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<IconChat size={16} color="var(--accent)" />}>Tactical Discussion <span style={{ fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)' }}>— Key Questions &amp; Next Steps</span></SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {discussionPrompts.map((prompt, i) => (
              <div key={prompt} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11,
                }}>{i + 1}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{prompt}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
