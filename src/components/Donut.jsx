import React from 'react';

const R = 46;
const CIRC = 2 * Math.PI * R;

function seg(fraction, offset, color) {
  const len = fraction * CIRC;
  return (
    <circle
      cx="59" cy="59" r={R} fill="none" stroke={color} strokeWidth="13"
      strokeDasharray={`${len} ${CIRC}`} strokeDashoffset={-offset}
      transform="rotate(-90 59 59)"
    />
  );
}

export default function Donut({ stats }) {
  const { total, completed, inProgress, pending, overdue } = stats;
  const safeTotal = total || 1;
  const fCompleted = completed / safeTotal;
  const fInProgress = inProgress / safeTotal;
  const fPending = pending / safeTotal;
  const fOverdue = overdue / safeTotal;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 18 }}>
      <div style={{ position: 'relative', width: 118, height: 118, flexShrink: 0 }}>
        <svg width="118" height="118" viewBox="0 0 118 118" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="59" cy="59" r={R} fill="none" stroke="var(--track-bg)" strokeWidth="13" />
          {total > 0 && (
            <>
              {seg(fCompleted, 0, 'var(--accent-dark)')}
              {seg(fInProgress, fCompleted * CIRC, 'var(--accent)')}
              {seg(fPending, (fCompleted + fInProgress) * CIRC, 'var(--accent-deep)')}
              {seg(fOverdue, (fCompleted + fInProgress + fPending) * CIRC, 'var(--amber-fill)')}
            </>
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--heading)' }}>{total}</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>total</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {[
          { label: 'Completed', value: completed, color: 'var(--accent-dark)' },
          { label: 'In Progress', value: inProgress, color: 'var(--accent)' },
          { label: 'Pending', value: pending, color: 'var(--accent-deep)' },
          { label: 'Overdue', value: overdue, color: 'var(--amber-fill)' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: row.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 15, color: 'var(--text-primary)' }}>{row.label}</span>
            <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--heading)' }}>
              {total ? Math.round((row.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
