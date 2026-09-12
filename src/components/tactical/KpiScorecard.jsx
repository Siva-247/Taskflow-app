import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { Avatar } from '../ui.jsx';
import { IconEdit, IconCheck, IconX } from '../icons.jsx';

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

// One metric row: shows the server-computed actual/band for auto metrics,
// the last-entered value for manual ones, and — only when `canEdit` and the
// metric is actually of type 'manual' — a small inline editor that posts
// straight to POST /tactical/kpi-scorecard/manual-entry. 'unavailable'
// metrics never get an editor here; there's deliberately no field anywhere
// in the app to type that data into (see kpiMatrix.js).
function MetricRow({ metric, canEdit, onSubmitManual }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const tone = metric.band ? BAND_TONE[metric.band] : null;

  const startEdit = () => { setDraft(metric.actual ?? ''); setEditing(true); };

  const save = async () => {
    const value = Number(draft);
    if (!Number.isFinite(value)) return;
    setSaving(true);
    try {
      await onSubmitManual(metric.key, value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span title={metric.formula} style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>
          {metric.label}
          <span style={{ marginLeft: 6, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{metric.type}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {editing ? (
            <>
              <input
                autoFocus type="number" value={draft} onChange={(e) => setDraft(e.target.value)}
                style={{ width: 64, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--field-bg)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)' }}
              />
              <button type="button" onClick={save} disabled={saving} title="Save" style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <IconCheck size={14} />
              </button>
              <button type="button" onClick={() => setEditing(false)} title="Cancel" style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <IconX size={14} color="var(--text-muted)" />
              </button>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--heading)' }}>
                {metric.actual !== null ? `${metric.actual}%` : (metric.compute === 'unavailable' ? 'Not yet trackable' : '—')}
              </span>
              {tone && (
                <span style={{ padding: '2px 8px', borderRadius: 999, background: tone.bg, color: tone.fg, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10 }}>{metric.band}</span>
              )}
              {canEdit && metric.compute === 'manual' && (
                <button type="button" onClick={startEdit} title="Enter score" style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <IconEdit size={13} />
                </button>
              )}
            </>
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
// applies — see tactical.js's GET /kpi-scorecard).
export default function KpiScorecard({ scorecard, canEdit, periodFrom, periodTo, onManualEntrySaved }) {
  const { apiCall, showToast } = useApp();

  const handleSubmitManual = async (metricKey, value) => {
    try {
      await apiCall('/tactical/kpi-scorecard/manual-entry', {
        method: 'POST',
        body: JSON.stringify({ userId: scorecard.userId, periodFrom, periodTo, metricKey, value }),
      });
      onManualEntrySaved();
    } catch (err) {
      showToast(err?.message || 'Could not save that score');
      throw err;
    }
  };

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
        {scorecard.metrics.map((m) => (
          <MetricRow key={m.key} metric={m} canEdit={canEdit} onSubmitManual={handleSubmitManual} />
        ))}
      </div>
    </div>
  );
}
