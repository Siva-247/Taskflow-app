import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Avatar, Select } from '../components/ui.jsx';
import {
  IconTarget, IconTaskList, IconCheckCircle, IconPending, IconBarChart, IconAlertTriangle,
  IconLayers, IconClipboard, IconBlock, IconCheck, IconArrowRight, IconChat,
} from '../components/icons.jsx';
import { formatDate } from '../utils.js';

const CHART_COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)'];

function pad(n) { return String(n).padStart(2, '0'); }
function toLocalISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysBack(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - (n - 1));
  return toLocalISO(d);
}
function monthStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
function periodPresets(today) {
  return [
    { key: 'all', label: 'All Time' },
    { key: '7d', label: 'Last 7 Days', from: daysBack(today, 7), to: today },
    { key: '30d', label: 'Last 30 Days', from: daysBack(today, 30), to: today },
    { key: 'month', label: 'This Month', from: monthStart(today), to: today },
  ];
}

function FilterField({ label, children }) {
  return (
    <div className="filter-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

const SEVERITY_COLOR = { high: { bg: 'rgba(225,29,72,.10)', fg: 'var(--red-deep)', dot: 'var(--red)' }, medium: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)', dot: 'var(--amber-fill)' }, low: { bg: 'var(--surface)', fg: 'var(--text-secondary)', dot: 'var(--text-muted)' } };

function AttentionRow({ item, onClick }) {
  const tone = SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.low;
  return (
    <div
      onClick={onClick}
      className="table-glass-row"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: onClick ? 'pointer' : 'default' }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--heading)' }}>{item.title}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.detail}</div>
      </div>
      {onClick && <IconArrowRight size={13} color="var(--text-muted)" />}
    </div>
  );
}

// A generic donut + legend — GenericDonut rather than reusing Donut.jsx,
// which is hardwired to Task's fixed 4-status shape; this needs an
// arbitrary number of segments (projects, milestones, reliability buckets).
function GenericDonut({ segments, centerLabel, centerValue }) {
  const R = 46; const CIRC = 2 * Math.PI * R;
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  let cursor = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
        <svg width="112" height="112" viewBox="0 0 118 118" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="59" cy="59" r={R} fill="none" stroke="var(--track-bg)" strokeWidth="13" />
          {total > 0 && segments.map((seg, i) => {
            const frac = seg.count / total;
            const len = frac * CIRC;
            const offset = -cursor * CIRC;
            cursor += frac;
            return (
              <circle
                key={seg.label} cx="59" cy="59" r={R} fill="none" stroke={seg.color} strokeWidth="13"
                strokeDasharray={`${len} ${CIRC}`} strokeDashoffset={offset} transform="rotate(-90 59 59)"
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--heading)' }}>{centerValue}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{centerLabel}</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2.5, background: seg.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--heading)' }}>{seg.pct}% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({seg.count})</span></span>
          </div>
        ))}
        {total === 0 && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>No data in this range.</div>}
      </div>
    </div>
  );
}

function KpiCard({ icon, value, label, tone }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14, background: tone === 'danger' ? 'rgba(225,29,72,.08)' : 'var(--accent-soft)',
      display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 150px', minWidth: 140,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: tone === 'danger' ? 'rgba(225,29,72,.14)' : 'var(--surface-strong)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: tone === 'danger' ? 'var(--red-deep)' : 'var(--heading)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export default function TacticalMeeting() {
  const { currentUser, apiCall, showToast, TODAY } = useApp();
  const navigate = useNavigate();
  const canSelectOthers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD].includes(currentUser.role);

  const [roster, setRoster] = useState([]);
  const [teamFilter, setTeamFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(currentUser.id);
  const [periodKey, setPeriodKey] = useState('30d');
  const [trendGranularity, setTrendGranularity] = useState('weekly');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const presets = useMemo(() => periodPresets(TODAY), [TODAY]);
  const preset = presets.find((p) => p.key === periodKey);

  useEffect(() => {
    if (!canSelectOthers) return;
    apiCall('/tactical/roster')
      .then((r) => {
        const users = r.users || [];
        setRoster(users);
        // The viewer's own id is never in this roster (self-excluded, same
        // as everywhere else) — defaulting selectedId to currentUser.id
        // would pick a person the dropdown can't actually represent, so
        // land on the first available person instead once the roster is in.
        if (users.length > 0) setSelectedId(users[0].id);
      })
      .catch(() => showToast('Could not load the team roster'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSelectOthers]);

  const teamOptions = useMemo(() => [...new Set(roster.map((u) => u.teamId).filter(Boolean))], [roster]);
  const filteredRoster = teamFilter === 'all' ? roster : roster.filter((u) => u.teamId === teamFilter);

  // Narrowing the Team filter can drop the currently-selected person out of
  // the list entirely — fall forward to the new list's first person rather
  // than leaving the dropdown pointed at someone it can no longer show.
  useEffect(() => {
    if (!canSelectOthers || filteredRoster.length === 0) return;
    if (!filteredRoster.some((u) => u.id === selectedId)) setSelectedId(filteredRoster[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, filteredRoster.length]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = preset?.from && preset?.to ? `?from=${preset.from}&to=${preset.to}` : '';
    apiCall(`/tactical/${selectedId}${query}`)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) showToast("Could not load that person's tactical data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, periodKey]);

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageHeader />
        <Card><div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>Loading…</div></Card>
      </div>
    );
  }

  const { profile, attentionItems, activityTrend, projectDistribution, activityTypeDistribution, recentDeliveries, deliveryReliability, plannedVsActual, taskHealth, developmentJourney, discussionPrompts } = data;

  const trendBuckets = activityTrend[trendGranularity] || [];
  const trendMax = Math.max(1, ...trendBuckets.map((b) => b.count));

  const projectSegments = projectDistribution.map((p, i) => ({ ...p, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const activitySegments = activityTypeDistribution.map((a, i) => ({ ...a, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] }));
  const reliabilitySegments = [
    { label: 'On Time', count: deliveryReliability.onTime, color: 'var(--green)' },
    { label: '1–2 Days Late', count: deliveryReliability.oneToTwoDaysLate, color: 'var(--amber)' },
    { label: '3+ Days Late', count: deliveryReliability.threePlusDaysLate, color: 'var(--red)' },
  ].filter((s) => s.count > 0).map((s) => ({ ...s, pct: Math.round((s.count / Math.max(1, deliveryReliability.onTime + deliveryReliability.oneToTwoDaysLate + deliveryReliability.threePlusDaysLate)) * 1000) / 10 }));
  const healthSegments = [
    { label: 'Healthy', count: taskHealth.healthy, color: 'var(--green)' },
    { label: 'At Risk', count: taskHealth.atRisk, color: 'var(--amber)' },
    { label: 'Blocked', count: taskHealth.blocked, color: 'var(--red)' },
    { label: 'Data Unavailable', count: taskHealth.unavailable, color: 'var(--text-muted)' },
  ].filter((s) => s.count > 0).map((s) => ({ ...s, pct: Math.round((s.count / Math.max(1, taskHealth.total)) * 1000) / 10 }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader />

      <Card style={{ padding: '18px 22px' }}>
        <div className="stack-mobile" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          {canSelectOthers ? (
            <>
              {teamOptions.length > 1 && (
                <FilterField label="Team">
                  <Select
                    value={teamFilter}
                    onChange={(v) => { setTeamFilter(v); }}
                    options={[{ value: 'all', label: 'All Teams' }, ...teamOptions.map((t) => ({ value: t, label: t }))]}
                  />
                </FilterField>
              )}
              <FilterField label="Intern / Developer">
                <Select
                  value={selectedId}
                  onChange={setSelectedId}
                  options={filteredRoster.map((u) => ({ value: u.id, label: `${u.name}${u.title ? ' · ' + u.title : ''}` }))}
                />
              </FilterField>
            </>
          ) : (
            <FilterField label="Intern / Developer">
              <div style={{ padding: '12px 15px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>
                {currentUser.name}
              </div>
            </FilterField>
          )}
          <FilterField label="Period">
            <Select value={periodKey} onChange={setPeriodKey} options={presets.map((p) => ({ value: p.key, label: p.label }))} />
          </FilterField>
        </div>
      </Card>

      {/* Profile + KPIs */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '300px 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '22px 20px' }}>
          <Avatar initial={profile.name?.[0] || '?'} size={64} gradient />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--heading)' }}>{profile.name}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{profile.title || 'Team Member'}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{profile.department?.name}{profile.team?.name ? ` · ${profile.team.name}` : ''}</div>
          </div>
          {profile.currentProjects.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
              {profile.currentProjects.slice(0, 3).map((p) => (
                <span key={p} style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--accent-soft)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, color: 'var(--brand)' }}>{p}</span>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <KpiCard icon={<IconTaskList size={18} color="var(--accent)" />} value={data.totalUpdates} label="Total Updates" />
          <KpiCard icon={<IconCheckCircle size={18} color="var(--green-deep)" />} value={data.completed} label="Completed" />
          <KpiCard icon={<IconPending size={18} color="var(--amber-deep)" />} value={data.pending} label="Pending" />
          <KpiCard icon={<IconTarget size={18} color="var(--accent-dark)" />} value={`${data.completionRate}%`} label="Completion Rate" />
          <KpiCard icon={<IconAlertTriangle size={18} color="var(--red-deep)" />} value={attentionItems.length} label="Attention Required" tone={attentionItems.length > 0 ? 'danger' : undefined} />
        </div>
      </div>

      {/* Charts row */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.3fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle icon={<IconBarChart size={16} color="var(--accent)" />}>Activity Trend</SectionTitle>
            <Select value={trendGranularity} onChange={setTrendGranularity} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
          </div>
          {trendBuckets.length === 0 ? (
            <EmptyNote>No activity logged in this range.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, paddingTop: 10, overflowX: 'auto' }}>
              {trendBuckets.map((b) => (
                <div key={b.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto', width: 40 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: 'var(--heading)' }}>{b.count}</span>
                  <div className="anim-scale-in" style={{
                    width: 20, height: Math.max(4, (b.count / trendMax) * 90), borderRadius: '6px 6px 2px 2px',
                    background: 'var(--brand-grad-raised)',
                  }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Work Distribution</SectionTitle>
          <div style={{ marginTop: 14 }}>
            <GenericDonut segments={projectSegments} centerLabel="Total Updates" centerValue={data.totalUpdates} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<IconClipboard size={16} color="var(--accent)" />}>Activity Type</SectionTitle>
          <div style={{ marginTop: 14 }}>
            <GenericDonut segments={activitySegments} centerLabel="Total Updates" centerValue={data.totalUpdates} />
          </div>
        </Card>
      </div>

      {/* Manager Attention */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <SectionTitle icon={<IconAlertTriangle size={16} color="var(--red-deep)" />}>Manager Attention</SectionTitle>
          {attentionItems.length > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(225,29,72,.12)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: 'var(--red-deep)' }}>
              {attentionItems.length} item{attentionItems.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {attentionItems.length === 0 ? (
          <EmptyNote>Nothing needs attention in this range.</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {attentionItems.map((item) => (
              <AttentionRow key={item.id} item={item} onClick={item.taskId ? () => navigate(`/tasks/${item.taskId}`) : undefined} />
            ))}
          </div>
        )}
      </Card>

      {/* Project Progress + Recent Deliveries */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Project Progress</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            Share of logged activity per project — not project completion.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {projectSegments.map((p) => (
              <div key={p.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>{p.label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)' }}>{p.count} activities · {p.pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
                  <div className="anim-scale-in" style={{ width: `${p.pct}%`, height: '100%', borderRadius: 999, background: p.color }} />
                </div>
              </div>
            ))}
            {projectSegments.length === 0 && <EmptyNote>No data in this range.</EmptyNote>}
          </div>
        </Card>

        <Card padded={false}>
          <div style={{ padding: '20px 22px 0' }}>
            <SectionTitle icon={<IconTaskList size={16} color="var(--accent)" />}>Recent Deliveries / Key Activities</SectionTitle>
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            {recentDeliveries.length === 0 ? (
              <div style={{ padding: '0 22px 20px' }}><EmptyNote>No entries in this range.</EmptyNote></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['Task ID', 'Project', 'Task / Deliverable', 'Milestone', 'Status', 'Due Date'].map((h) => (
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
      </div>

      {/* Reliability + Planned vs Actual + Task Health */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1.2fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconCheck size={16} color="var(--accent)" />}>Delivery Reliability</SectionTitle>
          <div style={{ marginTop: 14 }}>
            {reliabilitySegments.length === 0 ? <EmptyNote>Insufficient data — needs both a due date and an actual close date.</EmptyNote> : (
              <GenericDonut segments={reliabilitySegments} centerLabel="On Time" centerValue={deliveryReliability.onTimePct != null ? `${deliveryReliability.onTimePct}%` : '—'} />
            )}
          </div>
          {deliveryReliability.insufficientData > 0 && (
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12 }}>
              {deliveryReliability.insufficientData} additional {deliveryReliability.insufficientData === 1 ? 'entry has' : 'entries have'} insufficient data (missing due/close date).
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div style={{ padding: '20px 22px 0' }}>
            <SectionTitle icon={<IconTarget size={16} color="var(--accent)" />}>Planned vs Actual</SectionTitle>
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            {plannedVsActual.length === 0 ? (
              <div style={{ padding: '0 22px 20px' }}><EmptyNote>No entries in this range.</EmptyNote></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['Task ID', 'Planned', 'Actual', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plannedVsActual.map((r) => (
                    <tr key={r.displayId} className="table-glass-row" style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--brand)' }}>{r.displayId}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{r.actualCloseDate ? formatDate(r.actualCloseDate) : '—'}</td>
                      <td style={{ padding: '10px 14px' }}><ReliabilityPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<IconBlock size={16} color="var(--accent)" />}>Task Health</SectionTitle>
          <div style={{ marginTop: 14 }}>
            {healthSegments.length === 0 ? <EmptyNote>No data in this range.</EmptyNote> : (
              <GenericDonut segments={healthSegments} centerLabel="Total Tasks" centerValue={taskHealth.total} />
            )}
          </div>
        </Card>
      </div>

      {/* Development Journey + Tactical Discussion */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Development Journey</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            Skills and technologies mentioned in {profile.name.split(' ')[0]}'s own deliverables.
          </div>
          {developmentJourney.length === 0 ? (
            <EmptyNote>No recognized skill keywords found in this range's entries.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {developmentJourney.map((skill) => (
                <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <IconCheck size={13} color="var(--green-deep)" />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{skill}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<IconChat size={16} color="var(--accent)" />}>Tactical Discussion</SectionTitle>
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

function PageHeader() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconTarget size={20} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--heading)' }}>Tactical Meeting</div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-secondary)' }}>Track · Review · Discuss · Drive Results</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5, color: 'var(--heading)' }}>{children}</span>
    </div>
  );
}

function EmptyNote({ children }) {
  return <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--text-muted)', padding: '10px 0' }}>{children}</div>;
}

const DAILY_STATUS_TONE = {
  Completed: { bg: 'var(--accent-soft)', fg: 'var(--green-deep)' },
  Pending: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  Inprogress: { bg: 'var(--accent-soft)', fg: 'var(--accent-dark)' },
  Open: { bg: 'var(--surface)', fg: 'var(--text-secondary)' },
  Hold: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  Cancelled: { bg: 'var(--surface)', fg: 'var(--text-muted)' },
};
function DailyStatusPill({ status }) {
  const tone = DAILY_STATUS_TONE[status] || DAILY_STATUS_TONE.Open;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11 }}>{status}</span>
  );
}

const RELIABILITY_TONE = {
  'On Time': { bg: 'rgba(16,185,129,.12)', fg: 'var(--green-deep)' },
  '1–2 Days Late': { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  '3+ Days Late': { bg: 'rgba(225,29,72,.10)', fg: 'var(--red-deep)' },
};
function ReliabilityPill({ status }) {
  const tone = RELIABILITY_TONE[status] || { bg: 'var(--surface)', fg: 'var(--text-secondary)' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11 }}>{status}</span>
  );
}
