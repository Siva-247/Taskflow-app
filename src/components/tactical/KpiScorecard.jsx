import React from 'react';
import { Avatar } from '../ui.jsx';

const BAND_TONE = {
  EPI: { bg: 'var(--accent-soft)', fg: 'var(--green-deep)' },
  MPI: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
  LPI: { bg: 'rgba(225,29,72,.08)', fg: 'var(--red-deep)' },
};

const KPI_ROLE_LABEL = {
  manager: 'Manager',
  team_lead: 'Team Lead',
  senior_developer: 'Senior Developer',
  junior_developer: 'Junior Developer',
};

// One metric row — only ever rendered for metrics that actually have a
// value this period (KpiScorecard below filters out "Not yet trackable"
// and not-yet-entered manual metrics before mapping), so there's nothing
// blank to show and nothing to edit inline here.
function MetricRow({ metric }) {
  const tone = metric.band ? BAND_TONE[metric.band] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span title={metric.formula} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>
          {metric.label}
          <span style={{ marginLeft: 6, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{metric.type}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--heading)' }}>{metric.actual}%</span>
          {tone && (
            <span style={{ padding: '2px 8px', borderRadius: 999, background: tone.bg, color: tone.fg, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10 }}>{metric.band}</span>
          )}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 10.5, color: 'var(--text-muted)' }}>
        Target {metric.epiTarget} · weight {Math.round(metric.weight * 100)}%
      </div>
    </div>
  );
}

// One person's role-weighted KPI scorecard — ported from the AI department
// manager's spreadsheet (`KPI TARGETS` sheet). `weightedScore` is a weighted
// average over only the metrics that have a value this period (never
// treating "not yet trackable"/not-entered as zero, same rule the server
// applies — see tactical.js's GET /kpi-scorecard). Only measured metrics are
// shown at all — a blank "—" row or an edit affordance for one with no data
// adds noise without adding information.
export default function KpiScorecard({ scorecard }) {
  const measuredMetrics = scorecard.metrics.filter((m) => m.actual !== null);

  const band = scorecard.weightedScore === null ? null
    : scorecard.weightedScore >= 90 ? 'EPI'
      : scorecard.weightedScore >= 75 ? 'MPI'
        : 'LPI';
  const scoreTone = band ? BAND_TONE[band] : null;

  return (
    <div style={{
      border: '1px solid var(--line)', borderLeft: `4px solid ${scoreTone ? scoreTone.fg : 'var(--line)'}`,
      borderRadius: 14, padding: '16px 18px', background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar initial={scorecard.name[0]} size={32} gradient />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scorecard.name}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)' }}>{KPI_ROLE_LABEL[scorecard.kpiRole] || scorecard.kpiRole}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: scoreTone ? scoreTone.fg : 'var(--text-muted)' }}>
            {scorecard.weightedScore !== null ? `${scorecard.weightedScore}%` : '—'}
          </div>
          {band && (
            <span style={{ padding: '3px 9px', borderRadius: 999, background: scoreTone.bg, color: scoreTone.fg, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5 }}>{band}</span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Weight measured</span>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10.5, color: 'var(--text-secondary)' }}>{scorecard.weightMeasuredPct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden' }}>
          <div className="anim-scale-in" style={{ width: `${scorecard.weightMeasuredPct}%`, height: '100%', borderRadius: 999, background: 'var(--accent)' }} />
        </div>
      </div>

      <div>
        {measuredMetrics.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No measured metrics yet for this period.</div>
        ) : (
          measuredMetrics.map((m) => <MetricRow key={m.key} metric={m} />)
        )}
      </div>
    </div>
  );
}
