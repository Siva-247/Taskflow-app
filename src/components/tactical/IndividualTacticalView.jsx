import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { ROLES } from '../../data/mockData.js';
import { Card, Avatar, Select } from '../ui.jsx';
import DatePicker from '../DatePicker.jsx';
import {
  IconTarget, IconTaskList, IconCheckCircle, IconPending, IconBarChart,
  IconLayers, IconClipboard,
} from '../icons.jsx';
import { formatDate } from '../../utils.js';
import {
  CHART_COLORS, periodPresets, FilterField, GenericDonut, KpiCard, SectionTitle, EmptyNote, DailyStatusPill, TrendBarChart,
} from './shared.jsx';

// The Individual View — built first, and deliberately self-contained (reads
// currentUser itself rather than taking it as a prop) so the page shell
// (TacticalMeeting.jsx) can mount it with zero wiring. Team View was added
// later alongside it as a sibling, not a rewrite of this file.
export default function IndividualTacticalView({ initialSelectedId, onBackToTeamView } = {}) {
  const { currentUser, apiCall, showToast, TODAY } = useApp();
  const navigate = useNavigate();
  const canSelectOthers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD].includes(currentUser.role);

  const [roster, setRoster] = useState([]);
  const [teamFilter, setTeamFilter] = useState('all');
  // initialSelectedId arrives from Team View's "click a member" hand-off
  // (see TacticalMeeting.jsx) — this component remounts fresh each time the
  // Individual/Team toggle switches, so the prop is only ever read once per
  // visit, same as currentUser.id was before.
  const [selectedId, setSelectedId] = useState(initialSelectedId || currentUser.id);
  const [periodKey, setPeriodKey] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [trendGranularity, setTrendGranularity] = useState('weekly');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const presets = useMemo(() => periodPresets(TODAY), [TODAY]);
  const preset = presets.find((p) => p.key === periodKey);
  const effectiveFrom = periodKey === 'custom' ? customFrom : preset?.from;
  const effectiveTo = periodKey === 'custom' ? customTo : preset?.to;
  const waitingOnCustomRange = periodKey === 'custom' && !(customFrom && customTo);

  useEffect(() => {
    if (!canSelectOthers) return;
    apiCall('/tactical/roster')
      .then((r) => {
        const users = r.users || [];
        setRoster(users);
        // The viewer's own id is never in this roster (self-excluded, same
        // as everywhere else) — defaulting selectedId to currentUser.id
        // would pick a person the dropdown can't actually represent, so
        // land on the first available person instead once the roster is
        // in — but only when nobody was already handed to us explicitly.
        if (users.length > 0 && !initialSelectedId) setSelectedId(users[0].id);
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
    if (waitingOnCustomRange) return undefined;
    let cancelled = false;
    setLoading(true);
    const query = effectiveFrom && effectiveTo ? `?from=${effectiveFrom}&to=${effectiveTo}` : '';
    apiCall(`/tactical/${selectedId}${query}`)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) showToast("Could not load that person's tactical data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, effectiveFrom, effectiveTo, waitingOnCustomRange]);

  const backLink = onBackToTeamView && (
    <button
      type="button"
      onClick={onBackToTeamView}
      style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, color: 'var(--text-secondary)' }}
    >
      ← Back to Team View
    </button>
  );

  const filterRow = (
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
        {backLink}
        {filterRow}
        <Card>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
            {waitingOnCustomRange ? 'Pick a from and to date to see that range.' : 'Loading…'}
          </div>
        </Card>
      </div>
    );
  }

  const { profile, activityTrend, projectDistribution, activityTypeDistribution, recentDeliveries } = data;

  const trendBuckets = activityTrend[trendGranularity] || [];

  const projectSegments = projectDistribution.map((p, i) => ({ ...p, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const activitySegments = activityTypeDistribution.map((a, i) => ({ ...a, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {backLink}
      {filterRow}

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
        </div>
      </div>

      {/* Charts row */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1.3fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle icon={<IconBarChart size={16} color="var(--accent)" />}>Activity Trend</SectionTitle>
            <Select value={trendGranularity} onChange={setTrendGranularity} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
          </div>
          <TrendBarChart
            buckets={trendBuckets.map((b) => ({ key: b.key, label: b.label, count: b.count }))}
            series={[{ key: 'count', color: 'var(--brand-grad-raised)', label: 'Updates' }]}
            granularity={trendGranularity}
          />
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

      {/* Project Progress + Recent Deliveries */}
      <div className="responsive-grid" style={{ display: 'grid', '--cols': '1fr 1.5fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle icon={<IconLayers size={16} color="var(--accent)" />}>Project Progress</SectionTitle>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
            Share of logged activity per project — not project completion.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {projectSegments.map((p) => (
              <div key={p.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <span title={p.label} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{p.count} activities · {p.pct}%</span>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr className="table-glass-head">
                    {['Task ID', 'Project', 'Task / Deliverable', 'Status', 'Due Date'].map((h) => (
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
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12.5, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.deliverable || d.task}</td>
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
    </div>
  );
}
